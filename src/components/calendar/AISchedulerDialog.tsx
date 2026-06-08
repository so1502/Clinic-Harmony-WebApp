import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Trash2, AlertTriangle, CheckCircle, Calendar, Clock, User, Home, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ProposedAppointment {
  id: string; // client-side temp id for rendering and deleting
  start_time: string; // YYYY-MM-DDTHH:mm:ss
  end_time: string; // YYYY-MM-DDTHH:mm:ss
  therapist_id: string | null;
  room_id: string | null;
  therapy_type_id: string | null;
  notes: string;
}

interface AISchedulerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeClinicId: string | null;
}

export function AISchedulerDialog({
  isOpen,
  onOpenChange,
  activeClinicId,
}: AISchedulerDialogProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const currentLocale = i18n.language === "de" ? de : enUS;

  // Form State
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [instruction, setInstruction] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposals, setProposals] = useState<ProposedAppointment[]>([]);

  // Load API key from env on mount or dialog open
  useEffect(() => {
    if (isOpen) {
      const key = import.meta.env.VITE_GEMINI_API_KEY || "";
      setApiKey(key);
    }
  }, [isOpen]);

  // Fetch relations for dropdowns and context building
  const { data: patients } = useQuery({
    queryKey: ["patients", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("patients").select("*").eq("clinic_id", activeClinicId).order("full_name");
      return data || [];
    },
    enabled: !!activeClinicId && isOpen,
  });

  const { data: therapists } = useQuery({
    queryKey: ["therapists", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("therapists").select("*, profiles(full_name)").eq("clinic_id", activeClinicId);
      return data || [];
    },
    enabled: !!activeClinicId && isOpen,
  });

  const { data: rooms } = useQuery({
    queryKey: ["rooms", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("rooms").select("*").eq("clinic_id", activeClinicId).order("name");
      return data || [];
    },
    enabled: !!activeClinicId && isOpen,
  });

  const { data: therapyTypes } = useQuery({
    queryKey: ["therapyTypes", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("therapy_types").select("*").eq("clinic_id", activeClinicId).order("name");
      return data || [];
    },
    enabled: !!activeClinicId && isOpen,
  });

  // Fetch existing scheduled appointments (not cancelled) for conflict detection context
  const { data: allAppointments } = useQuery({
    queryKey: ["appointments-all", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("appointments").select("*").eq("clinic_id", activeClinicId).neq("status", "cancelled");
      return data || [];
    },
    enabled: !!activeClinicId && isOpen,
  });

  // Presets configuration
  const presets = [
    { text: t("aiScheduler.preset1"), prompt: "10x Physiotherapie und 5x Ultraschalltherapie über die nächsten 3 Wochen" },
    { text: t("aiScheduler.preset2"), prompt: "5x Lymphdrainage über die nächsten 2 Wochen" },
    { text: t("aiScheduler.preset3"), prompt: "3x Ganzkörpermassage über die nächste 1 Woche" },
  ];

  // Date local ISO formatting helper (without timezone shift/Z suffix)
  const formatLocalISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  // Check overlap helper
  const hasOverlap = (startA: string, endA: string, startB: string, endB: string) => {
    const sA = new Date(startA).getTime();
    const eA = new Date(endA).getTime();
    const sB = new Date(startB).getTime();
    const eB = new Date(endB).getTime();
    return sA < eB && eA > sB;
  };

  // Perform Gemini AI Generation
  const handleGenerate = async () => {
    if (!apiKey) {
      toast.error(t("aiScheduler.missingApiKey"));
      return;
    }
    if (!selectedPatientId) {
      toast.error(t("aiScheduler.selectPatient"));
      return;
    }
    if (!instruction.trim()) {
      toast.error(t("aiScheduler.instructionPlaceholder"));
      return;
    }

    setIsGenerating(true);
    setProposals([]);

    try {
      const patient = patients?.find((p) => p.id === selectedPatientId);
      const patientName = patient ? patient.full_name : "Unknown Patient";

      // Formulate context lists for the LLM
      const formattedTherapists = therapists
        ?.map(
          (t) =>
            `- ID: "${t.id}", Name: "${t.profiles?.full_name || "Unknown"}", Specialties: "${t.specialties || "None"}"`
        )
        .join("\n") || "None";

      const formattedRooms = rooms
        ?.map((r) => `- ID: "${r.id}", Name: "${r.name}", Capacity: ${r.capacity || 1}`)
        .join("\n") || "None";

      const formattedTherapyTypes = therapyTypes
        ?.map((tt) => `- ID: "${tt.id}", Name: "${tt.name}", Default Duration: ${tt.duration || 30} minutes`)
        .join("\n") || "None";

      // Compile booked appointments within the upcoming 30 days
      const startSearch = new Date();
      const endSearch = new Date();
      endSearch.setDate(startSearch.getDate() + 30);

      const existingList = allAppointments
        ?.filter((a) => {
          const d = new Date(a.start_time);
          return d >= startSearch && d <= endSearch;
        })
        .map((a) => {
          const therapistName = therapists?.find((t) => t.id === a.therapist_id)?.profiles?.full_name || "Unknown";
          const roomName = rooms?.find((r) => r.id === a.room_id)?.name || "Unknown";
          const patientName = patients?.find((p) => p.id === a.patient_id)?.full_name || "Unknown";
          
          // Format times relative to local timezone of the client for cleaner AI scheduling
          const localStart = formatLocalISO(new Date(a.start_time));
          const localEnd = formatLocalISO(new Date(a.end_time));

          return `- Therapist: "${therapistName}" (ID: "${a.therapist_id}"), Patient: "${patientName}" (ID: "${a.patient_id}"), Room: "${roomName}" (ID: "${a.room_id}"), Local Time: from ${localStart} to ${localEnd}`;
        })
        .join("\n") || "No existing appointments booked in the next 30 days.";

      const systemPrompt = `You are a clinical scheduling assistant for "Clinic-Harmony", a therapy clinic.
Your goal is to automatically schedule conflict-free treatment plans for patients.

Today's Local Date: ${formatLocalISO(new Date())} (${new Date().toLocaleDateString('de-DE', { weekday: 'long' })})
Target Patient Name: ${patientName} (ID: ${selectedPatientId})

Current Resources:
THERAPISTS:
${formattedTherapists}

ROOMS:
${formattedRooms}

THERAPY TYPES:
${formattedTherapyTypes}

EXISTING APPOINTMENTS (Do NOT overlap with these):
${existingList}

Scheduling Constraints:
1. Working Hours: Clinic is open ONLY Monday to Friday, 07:30 to 17:30. Never schedule on weekends (Saturday, Sunday) or outside these hours (e.g., do not schedule at 18:00, or at 07:15).
2. Interval: Appointments must start at 15-minute boundaries (e.g. 08:00, 08:15, 08:30, 08:45, 09:00, etc.).
3. Patient Overlap: The target patient must not have overlapping appointments.
4. Therapist Overlap: A therapist cannot have overlapping appointments. If therapist_id is null, this constraint does not apply.
5. Room Overlap: A room cannot have more overlapping appointments than its capacity. If room_id is null, this constraint does not apply.
6. Spread appointments logically across weeks. For example, if the request is "10x Physiotherapie in 3 Wochen", you should schedule roughly 3 sessions in week 1, 3 in week 2, and 4 in week 3. Prefer scheduling on different weekdays (e.g., Mon, Wed, Fri) and try to space them out (not on consecutive hours, but e.g. at 09:00 each day or varied times).
7. Select the correct room based on capacity and select a therapist who is qualified (matches specialties) for the requested therapy type. If the therapy doesn't require a therapist (e.g. standard blocks, self-exercises), therapist_id can be null.
8. Start planning from tomorrow or the next available weekday.

Output Format:
You must respond with a JSON object containing an array of 'appointments' matching the requested schema. Ensure all fields (start_time, end_time, therapist_id, room_id, therapy_type_id, notes) are populated or null if not needed.
All start_time and end_time values must be formatted as YYYY-MM-DDTHH:mm:ss (without timezone offset or 'Z').
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: systemPrompt + "\n\nUser request: " + instruction,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  appointments: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        start_time: {
                          type: "STRING",
                          description: "ISO 8601 string for start date and time in local format (YYYY-MM-DDTHH:mm:ss, e.g. 2026-06-15T08:15:00)"
                        },
                        end_time: {
                          type: "STRING",
                          description: "ISO 8601 string for end date and time in local format (YYYY-MM-DDTHH:mm:ss, e.g. 2026-06-15T09:00:00)"
                        },
                        therapist_id: {
                          type: "STRING",
                          description: "ID of the therapist, or null if therapist not needed or not specified"
                        },
                        room_id: {
                          type: "STRING",
                          description: "ID of the room, or null if room not needed or not specified"
                        },
                        therapy_type_id: {
                          type: "STRING",
                          description: "ID of the therapy type, or null if not specified"
                        },
                        notes: {
                          type: "STRING",
                          description: "Short explanation or note (e.g., 'Termin 1 von 10 - Physiotherapie')"
                        }
                      },
                      required: ["start_time", "end_time", "notes"]
                    }
                  }
                },
                required: ["appointments"]
              }
            }
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error?.message || "Gemini API error");
      }

      const resJson = await response.json();
      const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) {
        throw new Error("Empty response received from Gemini.");
      }

      const parsed = JSON.parse(responseText);
      const generatedApts: ProposedAppointment[] = (parsed.appointments || []).map((a: any, idx: number) => ({
        id: `proposal-${idx}-${Date.now()}`,
        start_time: a.start_time,
        end_time: a.end_time,
        therapist_id: a.therapist_id || null,
        room_id: a.room_id || null,
        therapy_type_id: a.therapy_type_id || null,
        notes: a.notes || "",
      }));

      setProposals(generatedApts);
      toast.success(t("aiScheduler.successMessage", { count: generatedApts.length }) || `${generatedApts.length} Termine vorgeschlagen!`);
    } catch (error: any) {
      console.error("Gemini Scheduling Error:", error);
      toast.error(error.message || t("aiScheduler.errorMessage"));
    } finally {
      setIsGenerating(false);
    }
  };

  // Perform Local Conflict Validation
  const validateProposal = (item: ProposedAppointment, allProposals: ProposedAppointment[]) => {
    const errors: string[] = [];
    const start = new Date(item.start_time);
    const end = new Date(item.end_time);

    // 1. Operating Hours Constraint
    const day = start.getDay(); // 0 is Sunday, 6 is Saturday
    if (day === 0 || day === 6) {
      errors.push("Wochenende: Termine nur von Montag bis Freitag.");
    }
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    if (startMinutes < 450 || endMinutes > 1050) { // 07:30 to 17:30
      errors.push("Außerhalb der Arbeitszeiten (07:30 - 17:30).");
    }

    // Convert local proposed dates to standard comparison strings
    const proposalStartISO = start.toISOString();
    const proposalEndISO = end.toISOString();

    // 2. Patient Overlap Check (with Database)
    const dbPatientConflict = allAppointments?.find(
      (a) => a.patient_id === selectedPatientId && hasOverlap(a.start_time, a.end_time, proposalStartISO, proposalEndISO)
    );
    if (dbPatientConflict) {
      errors.push("Patient ist bereits in der Datenbank zu dieser Zeit gebucht.");
    }

    // 3. Therapist Overlap Check (with Database)
    if (item.therapist_id) {
      const dbTherapistConflict = allAppointments?.find(
        (a) => a.therapist_id === item.therapist_id && hasOverlap(a.start_time, a.end_time, proposalStartISO, proposalEndISO)
      );
      if (dbTherapistConflict) {
        const therapistName = therapists?.find((t) => t.id === item.therapist_id)?.profiles?.full_name || "Therapeut";
        errors.push(`${therapistName} hat bereits einen Termin in der Datenbank.`);
      }
    }

    // 4. Room Capacity Check (with Database)
    if (item.room_id) {
      const targetRoom = rooms?.find((r) => r.id === item.room_id);
      const capacity = targetRoom ? (targetRoom.capacity || 1) : 1;
      const dbRoomOccupiedCount = allAppointments?.filter(
        (a) => a.room_id === item.room_id && hasOverlap(a.start_time, a.end_time, proposalStartISO, proposalEndISO)
      ).length || 0;

      if (dbRoomOccupiedCount >= capacity) {
        errors.push(`Raum '${targetRoom?.name || "Unbekannt"}' ist bereits voll belegt.`);
      }
    }

    // 5. Overlaps within the proposed batch itself
    const otherProposals = allProposals.filter((p) => p.id !== item.id);
    
    // Patient overlap in batch
    const batchPatientConflict = otherProposals.some(
      (p) => hasOverlap(p.start_time, p.end_time, item.start_time, item.end_time)
    );
    if (batchPatientConflict) {
      errors.push("Patientenüberschneidung im selben Vorschlags-Zeitplan.");
    }

    // Therapist overlap in batch
    if (item.therapist_id) {
      const batchTherapistConflict = otherProposals.some(
        (p) => p.therapist_id === item.therapist_id && hasOverlap(p.start_time, p.end_time, item.start_time, item.end_time)
      );
      if (batchTherapistConflict) {
        const therapistName = therapists?.find((t) => t.id === item.therapist_id)?.profiles?.full_name || "Therapeut";
        errors.push(`${therapistName} ist mehrfach zur selben Zeit im Vorschlags-Zeitplan eingeteilt.`);
      }
    }

    // Room capacity check in batch
    if (item.room_id) {
      const targetRoom = rooms?.find((r) => r.id === item.room_id);
      const capacity = targetRoom ? (targetRoom.capacity || 1) : 1;
      const batchRoomOccupiedCount = otherProposals.filter(
        (p) => p.room_id === item.room_id && hasOverlap(p.start_time, p.end_time, item.start_time, item.end_time)
      ).length;

      const dbRoomOccupiedCount = allAppointments?.filter(
        (a) => a.room_id === item.room_id && hasOverlap(a.start_time, a.end_time, proposalStartISO, proposalEndISO)
      ).length || 0;

      if (batchRoomOccupiedCount + dbRoomOccupiedCount >= capacity) {
        errors.push(`Raum '${targetRoom?.name || "Unbekannt"}' überschreitet die Kapazität.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  // Remove individual proposal
  const handleDeleteProposal = (id: string) => {
    setProposals((prev) => prev.filter((p) => p.id !== id));
  };

  // Bulk Book Mutation
  const bookProposalsMutation = useMutation({
    mutationFn: async () => {
      if (!activeClinicId) throw new Error("No active clinic selected.");
      if (proposals.length === 0) return;

      const insertData = proposals.map((p) => {
        // Parse the local date strings constructed in client local timezone
        const startDateTime = new Date(p.start_time);
        const endDateTime = new Date(p.end_time);

        return {
          clinic_id: activeClinicId,
          patient_id: selectedPatientId,
          therapist_id: p.therapist_id || null,
          room_id: p.room_id || null,
          therapy_type_id: p.therapy_type_id || null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: "scheduled",
          notes: p.notes || "",
          required_equipment_ids: [],
        };
      });

      const { error } = await supabase.from("appointments").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate queries to refresh calendar instantly
      queryClient.invalidateQueries({ queryKey: ["appointments", activeClinicId] });
      queryClient.invalidateQueries({ queryKey: ["appointments-all", activeClinicId] });
      queryClient.invalidateQueries({ queryKey: ["appointments-day"] });
      
      toast.success(t("aiScheduler.successMessage", { count: proposals.length }));
      setProposals([]);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || t("aiScheduler.errorMessage"));
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-slate-200 shadow-2xl rounded-2xl">
        {/* Banner with sparkle aesthetics */}
        <div className="relative p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-between">
          <div className="space-y-1">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-yellow-300 animate-pulse" />
              {t("aiScheduler.title")}
            </DialogTitle>
            <DialogDescription className="text-blue-100 text-sm">
              {t("aiScheduler.subtitle")}
            </DialogDescription>
          </div>
        </div>

        {/* Missing API Key Warning */}
        {!apiKey && (
          <div className="p-4 mx-6 mt-6 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">{t("aiScheduler.missingApiKey")}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main setup: select patient and write prompt */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              {/* Patient Selector */}
              <div className="space-y-2">
                <Label htmlFor="patient-select" className="text-sm font-semibold text-slate-700">
                  {t("pinboard.selectPatient")}
                </Label>
                <Select value={selectedPatientId} onValueChange={(val) => setSelectedPatientId(val || "")}>
                  <SelectTrigger id="patient-select" className="bg-white border-slate-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 rounded-lg">
                    <SelectValue placeholder={t("aiScheduler.selectPatient")}>
                      {patients?.find(p => p.id === selectedPatientId)?.full_name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {patients?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Presets */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
                  {t("aiScheduler.presetTitle")}
                </Label>
                <div className="flex flex-col gap-2">
                  {presets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInstruction(preset.prompt)}
                      className="text-left text-xs p-2.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-slate-700 hover:text-indigo-700 shadow-sm transition-all duration-200 transform hover:-translate-y-[1px]"
                    >
                      {preset.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Instruction prompt */}
            <div className="md:col-span-2 flex flex-col space-y-2">
              <Label htmlFor="prompt-instruction" className="text-sm font-semibold text-slate-700">
                {t("aiScheduler.instructionLabel")}
              </Label>
              <Textarea
                id="prompt-instruction"
                rows={6}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={t("aiScheduler.instructionPlaceholder")}
                className="bg-white border-slate-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 rounded-lg resize-none flex-1 p-3 text-slate-800"
              />
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !apiKey || !selectedPatientId || !instruction.trim()}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md px-6 py-2 rounded-lg gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("aiScheduler.generating")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-yellow-300" />
                      {t("aiScheduler.generateButton")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Proposals List Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-500" />
                {t("aiScheduler.previewTitle")}
              </h3>
              <p className="text-xs text-slate-500">
                {t("aiScheduler.previewSubtitle")}
              </p>
            </div>

            {proposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-white text-slate-400 space-y-2">
                <HelpCircle className="h-10 w-10 text-slate-300 animate-bounce" />
                <p className="text-sm">{t("aiScheduler.noProposals")}</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm max-h-[350px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider">
                      <th className="p-3 pl-4">{t("aiScheduler.colDateTime")}</th>
                      <th className="p-3">{t("aiScheduler.colTherapy")}</th>
                      <th className="p-3">{t("aiScheduler.colTherapist")}</th>
                      <th className="p-3">{t("aiScheduler.colRoom")}</th>
                      <th className="p-3">{t("aiScheduler.colNotes")}</th>
                      <th className="p-3 text-center w-[120px]">Status</th>
                      <th className="p-3 pr-4 text-center w-[60px]">&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                    {proposals.map((item) => {
                      const validation = validateProposal(item, proposals);
                      const therapyType = therapyTypes?.find((tt) => tt.id === item.therapy_type_id);
                      const therapist = therapists?.find((t) => t.id === item.therapist_id);
                      const room = rooms?.find((r) => r.id === item.room_id);

                      // Localized Date & Time parsing
                      const startDateObj = new Date(item.start_time);
                      const endDateObj = new Date(item.end_time);

                      const dateFormatted = format(startDateObj, "eeee, dd.MM.yyyy", { locale: currentLocale });
                      const timeRangeFormatted = `${format(startDateObj, "HH:mm")} - ${format(endDateObj, "HH:mm")}`;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                          {/* Date and Time */}
                          <td className="p-3 pl-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-800">{dateFormatted}</span>
                              <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" /> {timeRangeFormatted}
                              </span>
                            </div>
                          </td>

                          {/* Therapy Type */}
                          <td className="p-3">
                            {therapyType ? (
                              <Badge style={{ backgroundColor: therapyType.color || '#3b82f6', color: '#fff' }}>
                                {therapyType.name}
                              </Badge>
                            ) : (
                              <span className="text-slate-400 italic">No treatment</span>
                            )}
                          </td>

                          {/* Therapist */}
                          <td className="p-3">
                            {therapist ? (
                              <span className="flex items-center gap-1.5 text-slate-700">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                {therapist.profiles?.full_name}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                {t("aiScheduler.noTherapistNeeded")}
                              </span>
                            )}
                          </td>

                          {/* Room */}
                          <td className="p-3">
                            {room ? (
                              <span className="flex items-center gap-1.5 text-slate-700">
                                <Home className="h-3.5 w-3.5 text-slate-400" />
                                {room.name}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                {t("aiScheduler.noRoomNeeded")}
                              </span>
                            )}
                          </td>

                          {/* Notes */}
                          <td className="p-3 max-w-[200px] truncate" title={item.notes}>
                            {item.notes}
                          </td>

                          {/* Status Badge */}
                          <td className="p-3 text-center">
                            {validation.isValid ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-full py-0.5 gap-1 shadow-sm">
                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                OK
                              </Badge>
                            ) : (
                              <div className="flex flex-col items-center">
                                <Badge className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-full py-0.5 gap-1 shadow-sm cursor-help" title={validation.errors.join("\n")}>
                                  <AlertTriangle className="h-3 w-3 text-rose-500 animate-pulse" />
                                  {t("common.error") || "Konflikt"}
                                </Badge>
                                <span className="text-[10px] text-rose-500 mt-1 max-w-[120px] leading-tight block text-center truncate" title={validation.errors.join(", ")}>
                                  {validation.errors[0]}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Action - Delete row */}
                          <td className="p-3 pr-4 text-center">
                            <button
                              onClick={() => handleDeleteProposal(item.id)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all"
                              title={t("pinboard.deleteBlock") || "Termin löschen"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 bg-slate-100 border-t border-slate-200 flex sm:justify-between items-center gap-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-300 hover:bg-slate-200 rounded-lg"
          >
            {t("pinboard.cancel")}
          </Button>

          <Button
            onClick={() => bookProposalsMutation.mutate()}
            disabled={proposals.length === 0 || bookProposalsMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md px-6 py-2 rounded-lg gap-2"
          >
            {bookProposalsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Speichern...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                {t("aiScheduler.bookButton", { count: proposals.length })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

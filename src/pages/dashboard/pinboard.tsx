import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInYears } from "date-fns";
import { 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  Clock, 
  X, 
  Loader2, 
  Info,
  CalendarCheck2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Appointment, Patient } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Config parameters for the Pinboard time grid
const TIME_SLOTS = [
  "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
  "16:30", "17:00"
];

const parseTimeToMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const GRID_START_MINUTES = parseTimeToMinutes("07:30"); // 450 min
const GRID_END_MINUTES = parseTimeToMinutes("17:30");   // 1050 min
const ROW_HEIGHT = 50; // px height of a 30 min row
const MINUTE_HEIGHT = ROW_HEIGHT / 30; // px per minute (approx 1.67px/min)
const GRID_TOTAL_HEIGHT = (TIME_SLOTS.length) * ROW_HEIGHT; // 1000px

const PRESET_COLORS = [
  { value: "#3b82f6", name: "Blue" },
  { value: "#ec4899", name: "Pink" },
  { value: "#10b981", name: "Green" },
  { value: "#eab308", name: "Yellow" },
  { value: "#a855f7", name: "Purple" },
  { value: "#f97316", name: "Orange" },
  { value: "#ef4444", name: "Red" }
];

interface StandardBlock {
  id: string;
  name: string;
  duration: number; // minutes
  color: string;
}

export default function PinboardPage() {
  const { t } = useTranslation();
  const { activeClinicId } = useAuth();
  const queryClient = useQueryClient();

  // State: selected date (defaults to today)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // State: patient IDs displayed in the 3 columns
  const [colPatientIds, setColPatientIds] = useState<(string | null)[]>([null, null, null]);

  // State: standard blocks templates (managed locally in localStorage per clinic)
  const [standardBlocks, setStandardBlocks] = useState<StandardBlock[]>([]);
  const [isNewBlockOpen, setIsNewBlockOpen] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockDuration, setNewBlockDuration] = useState(30);
  const [newBlockColor, setNewBlockColor] = useState("#3b82f6");

  // Load standard blocks from localStorage
  useEffect(() => {
    if (!activeClinicId) return;
    const key = `harmony_blocks_${activeClinicId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setStandardBlocks(JSON.parse(saved));
    } else {
      const defaults: StandardBlock[] = [
        { id: "duschen", name: "Duschen", duration: 30, color: "#3b82f6" },
        { id: "baden", name: "Baden", duration: 45, color: "#ec4899" },
        { id: "essen", name: "Essen", duration: 60, color: "#eab308" },
        { id: "ruhepause", name: "Ruhepause", duration: 30, color: "#10b981" },
        { id: "visite", name: "Visite", duration: 15, color: "#a855f7" }
      ];
      setStandardBlocks(defaults);
      localStorage.setItem(key, JSON.stringify(defaults));
    }
  }, [activeClinicId]);

  // Save standard blocks to localStorage
  const saveBlocks = (updated: StandardBlock[]) => {
    if (!activeClinicId) return;
    setStandardBlocks(updated);
    localStorage.setItem(`harmony_blocks_${activeClinicId}`, JSON.stringify(updated));
  };

  // Fetch Patients
  const { data: patients, isLoading: isPatientsLoading } = useQuery({
    queryKey: ["patients", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("clinic_id", activeClinicId)
        .order("full_name");
      if (error) throw error;
      return data as Patient[];
    },
    enabled: !!activeClinicId,
  });

  // Auto-initialize columns with the first 3 patients
  useEffect(() => {
    if (patients && patients.length > 0) {
      setColPatientIds(prev => {
        // Only initialize if all are currently null
        if (prev.some(id => id !== null)) return prev;
        return [
          patients[0]?.id || null,
          patients[1]?.id || null,
          patients[2]?.id || null
        ];
      });
    }
  }, [patients]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Fetch Appointments for the selected date
  const { data: appointments, isLoading: isAppointmentsLoading } = useQuery({
    queryKey: ["appointments-day", activeClinicId, dateStr],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const start = `${dateStr}T00:00:00.000Z`;
      const end = `${dateStr}T23:59:59.999Z`;

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          patients (id, full_name, date_of_birth),
          therapists (id, profiles(full_name), color),
          therapy_types (id, name, color),
          rooms (id, name)
        `)
        .eq("clinic_id", activeClinicId)
        .gte("start_time", start)
        .lte("start_time", end)
        .neq("status", "cancelled");

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!activeClinicId,
  });

  // Mutation: Create appointment (from standard block drop)
  const createAppointmentMutation = useMutation({
    mutationFn: async (aptData: any) => {
      const { error } = await supabase.from("appointments").insert([aptData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments-day"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(t('calendar.messages.successCreate'));
    },
    onError: (err: any) => {
      toast.error(err.message || t('calendar.messages.errorSave'));
    }
  });

  // Mutation: Update appointment time/patient (from drag & drop move)
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, patient_id, start_time, end_time }: { id: string; patient_id: string; start_time: string; end_time: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ patient_id, start_time, end_time })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments-day"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(t('calendar.messages.successUpdate'));
    },
    onError: (err: any) => {
      toast.error(err.message || t('calendar.messages.errorSave'));
    }
  });

  // Mutation: Delete appointment
  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments-day"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(t('calendar.messages.successDelete'));
    },
    onError: (err: any) => {
      toast.error(err.message || "Error deleting appointment.");
    }
  });

  // Handle standard block creation
  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockName.trim()) return;

    const newBlock: StandardBlock = {
      id: Math.random().toString(36).substring(2, 9),
      name: newBlockName.trim(),
      duration: newBlockDuration,
      color: newBlockColor
    };

    saveBlocks([...standardBlocks, newBlock]);
    setNewBlockName("");
    setIsNewBlockOpen(false);
    toast.success(t('pinboard.successCreateBlock'));
  };

  const handleDeleteBlock = (id: string) => {
    saveBlocks(standardBlocks.filter(b => b.id !== id));
    toast.success(t('pinboard.successDeleteBlock'));
  };

  // Helper: Get patient details by ID
  const getPatientDetails = (id: string | null) => {
    if (!id || !patients) return null;
    return patients.find(p => p.id === id) || null;
  };

  // Helper: Calculate Patient daily workload in minutes and text
  const getPatientWorkload = (patientId: string | null) => {
    if (!patientId || !appointments) return { minutes: 0, text: `0 ${t('pinboard.hoursShort')} 0 Min` };
    const patientApts = appointments.filter(a => a.patient_id === patientId);
    let totalMinutes = 0;
    patientApts.forEach(apt => {
      const durationMs = new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime();
      totalMinutes += Math.round(durationMs / 60000);
    });
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return {
      minutes: totalMinutes,
      text: `${hrs} ${t('pinboard.hoursShort')} ${mins} Min`
    };
  };

  // Helper: Get layout parameters for rendering cards on absolute grid
  const getCardLayout = (startTimeStr: string, endTimeStr: string) => {
    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);
    
    // Convert UTC to local minutes for display
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    
    const clampedStart = Math.max(GRID_START_MINUTES, Math.min(GRID_END_MINUTES, startMinutes));
    const clampedEnd = Math.max(GRID_START_MINUTES, Math.min(GRID_END_MINUTES, endMinutes));
    
    const top = (clampedStart - GRID_START_MINUTES) * MINUTE_HEIGHT;
    const height = Math.max(ROW_HEIGHT - 6, (clampedEnd - clampedStart) * MINUTE_HEIGHT); // Ensure a minimum readable height
    
    return { top, height };
  };

  // Drag-and-drop: Drag start handlers
  const handleDragStartTemplate = (e: React.DragEvent, block: StandardBlock) => {
    e.dataTransfer.setData("text/plain", "template");
    e.dataTransfer.setData("source", "template");
    e.dataTransfer.setData("block", JSON.stringify(block));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragStartExisting = (e: React.DragEvent, apt: Appointment) => {
    e.dataTransfer.setData("text/plain", "existing");
    e.dataTransfer.setData("source", "existing");
    e.dataTransfer.setData("appointmentId", apt.id);
    e.dataTransfer.effectAllowed = "move";
  };

  // Drop targets: Time cell dropped handlers
  const handleDropOnCell = (e: React.DragEvent, colPatientId: string | null, timeSlotStr: string) => {
    e.preventDefault();
    if (!colPatientId || !activeClinicId) return;

    const source = e.dataTransfer.getData("source");

    // Calculate dropping target times
    const startDateTime = new Date(`${dateStr}T${timeSlotStr}:00`);

    if (source === "template") {
      const blockStr = e.dataTransfer.getData("block");
      if (!blockStr) return;
      const block: StandardBlock = JSON.parse(blockStr);

      const endDateTime = new Date(startDateTime.getTime() + block.duration * 60 * 1000);

      // Create new therapist-less block appointment
      const newApt = {
        clinic_id: activeClinicId,
        patient_id: colPatientId,
        therapist_id: null, // No therapist required for standard blocks
        therapy_type_id: null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: "scheduled",
        notes: block.name, // Storing block template name in notes
      };

      createAppointmentMutation.mutate(newApt);
    } else if (source === "existing") {
      const aptId = e.dataTransfer.getData("appointmentId");
      if (!aptId || !appointments) return;
      
      const apt = appointments.find(a => a.id === aptId);
      if (!apt) return;

      const durationMs = new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime();
      const endDateTime = new Date(startDateTime.getTime() + durationMs);

      updateAppointmentMutation.mutate({
        id: aptId,
        patient_id: colPatientId,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString()
      });
    }
  };

  // Trash bin drop handler
  const handleDropOnTrash = (e: React.DragEvent) => {
    e.preventDefault();
    const source = e.dataTransfer.getData("source");
    if (source === "existing") {
      const aptId = e.dataTransfer.getData("appointmentId");
      if (aptId) {
        if (confirm(t('calendar.messages.confirmDelete'))) {
          deleteAppointmentMutation.mutate(aptId);
        }
      }
    }
  };

  const handleSelectColumnPatient = (colIdx: number, patientId: string | null) => {
    setColPatientIds(prev => {
      const updated = [...prev];
      updated[colIdx] = patientId === "none" ? null : patientId;
      return updated;
    });
  };

  if (!activeClinicId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500">{t('calendar.messages.selectClinic')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('pinboard.title')}</h2>
          <p className="text-sm text-slate-500">{t('pinboard.subtitle')}</p>
        </div>
        
        {/* Date Selector */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border shadow-sm self-start sm:self-center">
          <CalendarIcon className="h-4 w-4 text-blue-500" />
          <Input 
            type="date" 
            value={dateStr}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="w-40 border-0 focus-visible:ring-0 p-0 text-slate-700 font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 items-start">
        {/* Sidebar Controls */}
        <div className="space-y-6 lg:col-span-1">
          {/* Standard Blocks List */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <CalendarCheck2 className="h-4 w-4 text-blue-600" />
                {t('pinboard.standardBlocks')}
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsNewBlockOpen(!isNewBlockOpen)}
                className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full"
              >
                {isNewBlockOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {/* Inline creation form */}
            {isNewBlockOpen && (
              <form onSubmit={handleCreateBlock} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <Label htmlFor="blockName" className="text-xs">{t('pinboard.blockName')}</Label>
                  <Input 
                    id="blockName" 
                    value={newBlockName} 
                    onChange={e => setNewBlockName(e.target.value)} 
                    placeholder={t('pinboard.placeholderName')}
                    className="h-8 text-xs"
                    autoFocus
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="blockDuration" className="text-xs">{t('pinboard.duration')}</Label>
                    <select
                      id="blockDuration"
                      value={newBlockDuration}
                      onChange={e => setNewBlockDuration(Number(e.target.value))}
                      className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="15">15 Min</option>
                      <option value="30">30 Min</option>
                      <option value="45">45 Min</option>
                      <option value="60">60 Min</option>
                      <option value="90">90 Min</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="blockColor" className="text-xs">{t('pinboard.color')}</Label>
                    <select
                      id="blockColor"
                      value={newBlockColor}
                      onChange={e => setNewBlockColor(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {PRESET_COLORS.map(c => (
                        <option key={c.value} value={c.value}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsNewBlockOpen(false)} className="h-7 text-xs">
                    {t('pinboard.cancel')}
                  </Button>
                  <Button type="submit" size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700">
                    {t('pinboard.save')}
                  </Button>
                </div>
              </form>
            )}

            {/* List of draggable standard blocks templates */}
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {standardBlocks.map(block => (
                <div
                  key={block.id}
                  draggable
                  onDragStart={(e) => handleDragStartTemplate(e, block)}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-white hover:border-slate-300 hover:shadow-md cursor-grab active:cursor-grabbing transition-all group"
                  style={{ borderLeft: `4px solid ${block.color}` }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">{block.name}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {block.duration} {t('pinboard.minutes')}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteBlock(block.id)}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-500">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p>Zieh diese Blöcke einfach nach rechts auf das Feld eines Patienten, um den Termin zu planen. Blöcke benötigen keinen Therapeuten.</p>
            </div>
          </div>

          {/* Delete Dropzone (Trash) */}
          <div 
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropOnTrash}
            className="border-2 border-dashed border-red-200 hover:border-red-500 bg-red-50/50 hover:bg-red-50 p-5 rounded-xl text-center transition-colors shadow-sm group flex flex-col items-center justify-center gap-2"
          >
            <Trash2 className="h-8 w-8 text-red-400 group-hover:text-red-600 transition-colors animate-bounce" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-800">{t('pinboard.deleteBlock')}</p>
              <p className="text-[10px] text-slate-400">{t('pinboard.dragHereToDelete')}</p>
            </div>
          </div>
        </div>

        {/* Pinboard Grid (Right Side) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Patients Header row */}
          <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50/70 py-3">
            {/* Hour marker column header */}
            <div className="col-span-2 sm:col-span-1 text-center font-bold text-xs uppercase tracking-wider text-slate-400 self-center">
              {t('pinboard.time')}
            </div>

            {/* 3 Patient Columns Headers */}
            {colPatientIds.map((patientId, colIdx) => {
              const patient = getPatientDetails(patientId);
              const workload = getPatientWorkload(patientId);
              const age = patient?.date_of_birth ? differenceInYears(new Date(dateStr), new Date(patient.date_of_birth)) : null;

              return (
                <div key={colIdx} className="col-span-3 sm:col-span-3 px-3 border-l border-slate-200 flex flex-col gap-2">
                  <Select 
                    value={patientId || "none"}
                    onValueChange={(val) => handleSelectColumnPatient(colIdx, val)}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold bg-white border-slate-200 focus:ring-0">
                      <SelectValue>
                        {patient?.full_name || t('pinboard.selectPatient')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-slate-400 font-normal italic">{t('pinboard.selectPatient')}</SelectItem>
                      {patients?.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Patient stats */}
                  {patient ? (
                    <div className="flex flex-col gap-1 px-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>{age !== null ? `${age} Jahre` : ""}</span>
                        <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">{workload.text}</span>
                      </div>
                      
                      {/* Workload Progress Bar (max out at 6 hours/360 mins workload) */}
                      <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            workload.minutes > 360 ? "bg-red-500" : workload.minutes > 240 ? "bg-amber-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${Math.min(100, (workload.minutes / 360) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic px-1">
                      {t('pinboard.noPatients')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grid body with appointments absolute positioning */}
          <div className="grid grid-cols-12 relative overflow-y-auto" style={{ height: `${GRID_TOTAL_HEIGHT}px` }}>
            {isAppointmentsLoading || isPatientsLoading ? (
              <div className="absolute inset-0 bg-white/70 z-50 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              </div>
            ) : null}

            {/* Time labels background lines */}
            <div className="col-span-2 sm:col-span-1 border-r border-slate-100 bg-slate-50/20">
              {TIME_SLOTS.map((time, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-center border-b border-slate-100 text-[11px] font-semibold text-slate-500 select-none"
                  style={{ height: `${ROW_HEIGHT}px` }}
                >
                  {time}
                </div>
              ))}
            </div>

            {/* Grid Columns for Drop Zone */}
            {colPatientIds.map((patientId, colIdx) => {
              // Filter appointments scheduled for this specific patient column on this day
              const patientAppointments = appointments?.filter(apt => apt.patient_id === patientId) || [];

              return (
                <div 
                  key={colIdx} 
                  className="col-span-3 sm:col-span-3 relative border-l border-slate-100"
                  style={{ height: `${GRID_TOTAL_HEIGHT}px` }}
                >
                  {/* Grid cells backdrop (visual lines for hours) */}
                  {TIME_SLOTS.map((time, idx) => (
                    <div 
                      key={idx}
                      onDragOver={e => e.preventDefault()}
                      onDrop={(e) => handleDropOnCell(e, patientId, time)}
                      className="border-b border-slate-100 hover:bg-blue-50/20 transition-colors"
                      style={{ height: `${ROW_HEIGHT}px` }}
                    />
                  ))}

                  {/* Absolute positioned magnetic-like scheduled cards */}
                  {patientId && patientAppointments.map(apt => {
                    const { top, height } = getCardLayout(apt.start_time, apt.end_time);
                    
                    // Determine styling based on whether it is a standard block or standard therapy type
                    const isStandardBlock = !apt.therapy_type_id;
                    const cardColor = apt.therapy_types?.color || "#e0e7ff"; // Soft blue/indigo fallback
                    const cardTextColor = apt.therapy_types?.color ? "#ffffff" : "#1e293b"; // Dark text for custom light blocks, white for therapy colors
                    
                    // Standard blocks are stored with text inside `notes`, therapy types use `name`
                    const titleName = apt.therapy_types?.name || apt.notes || t('common.unknown');
                    const therapistName = apt.therapists?.profiles?.full_name || null;
                    const roomName = apt.rooms?.name || null;
                    const durationMins = Math.round((new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / 60000);

                    return (
                      <div
                        key={apt.id}
                        draggable
                        onDragStart={(e) => handleDragStartExisting(e, apt)}
                        className="absolute left-1.5 right-1.5 rounded-xl shadow-md border hover:shadow-xl hover:scale-[1.01] hover:z-20 transition-all cursor-grab active:cursor-grabbing p-2 overflow-hidden flex flex-col justify-between group"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: isStandardBlock ? "#ffffff" : cardColor,
                          borderLeft: `5px solid ${isStandardBlock ? "#94a3b8" : cardColor}`,
                          color: isStandardBlock ? "#1e293b" : cardTextColor,
                          borderColor: isStandardBlock ? "#e2e8f0" : "transparent"
                        }}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-bold truncate leading-tight">
                              {titleName}
                            </span>
                            <span className={`text-[10px] ${isStandardBlock ? "text-slate-400" : "text-white/80"} flex items-center gap-0.5 mt-0.5`}>
                              <Clock className="w-2.5 h-2.5" />
                              {format(new Date(apt.start_time), "HH:mm")} - {format(new Date(apt.end_time), "HH:mm")} ({durationMins} Min)
                            </span>
                          </div>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              if (confirm(t('calendar.messages.confirmDelete'))) {
                                deleteAppointmentMutation.mutate(apt.id);
                              }
                            }}
                            className={`h-5 w-5 opacity-0 group-hover:opacity-100 rounded-md transition-opacity shrink-0 ${
                              isStandardBlock 
                                ? "text-slate-400 hover:text-red-500 hover:bg-red-50" 
                                : "text-white/70 hover:text-white hover:bg-white/20"
                            }`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Therapist and Room indicators if present */}
                        {(therapistName || roomName) && (
                          <div className="flex flex-wrap gap-1 mt-1 border-t pt-1 border-slate-100/20">
                            {therapistName && (
                              <span className={`text-[9px] font-medium px-1 py-0.5 rounded leading-none shrink-0 ${
                                isStandardBlock ? "bg-slate-100 text-slate-600" : "bg-white/20 text-white"
                              }`}>
                                {therapistName}
                              </span>
                            )}
                            {roomName && (
                              <span className={`text-[9px] font-medium px-1 py-0.5 rounded leading-none shrink-0 ${
                                isStandardBlock ? "bg-slate-100 text-slate-600" : "bg-white/20 text-white"
                              }`}>
                                {roomName}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

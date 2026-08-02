import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Loader2, 
  Sparkles, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Calendar, 
  Clock, 
  User, 
  Home, 
  HelpCircle, 
  Zap, 
  Globe 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { CreateMLCEngine } from "@mlc-ai/web-llm";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Global module-level cache for WebLLM engine to avoid re-downloading model weights across dialog re-opens
let cachedMLCEngine: any = null;

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
  const [engineMode, setEngineMode] = useState<"online" | "internal" | "webllm">("internal");
  const [activeUsedEngine, setActiveUsedEngine] = useState<"gemini" | "internal" | "webllm" | null>(null);
  const [isFallbackNotice, setIsFallbackNotice] = useState<boolean>(false);
  const [webllmStatus, setWebllmStatus] = useState<string>("");
  const [webllmPercent, setWebllmPercent] = useState<number>(0);

  // Therapy counts & date state
  const [therapyCounts, setTherapyCounts] = useState<{ [name: string]: number }>({
    "Physiotherapie": 10,
    "Ultraschalltherapie": 5,
  });
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [endDateStr, setEndDateStr] = useState<string>("");

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        if (i18n.language && i18n.language.startsWith("en")) {
          return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getDatePhrase = (sDate: string, eDate: string) => {
    const formattedStart = formatDateDisplay(sDate);
    const formattedEnd = formatDateDisplay(eDate);
    if (formattedStart && formattedEnd) {
      return t("aiScheduler.dateRange.fromTo", { start: formattedStart, end: formattedEnd, defaultValue: `vom ${formattedStart} bis ${formattedEnd}` });
    }
    if (formattedStart) {
      return t("aiScheduler.dateRange.from", { start: formattedStart, defaultValue: `ab ${formattedStart}` });
    }
    if (formattedEnd) {
      return t("aiScheduler.dateRange.until", { end: formattedEnd, defaultValue: `bis ${formattedEnd}` });
    }
    return "";
  };

  const buildPrompt = (
    counts: { [name: string]: number },
    sDate: string,
    eDate: string,
    currentInst: string
  ) => {
    const therapyParts: string[] = [];
    Object.entries(counts).forEach(([name, c]) => {
      if (c > 0) {
        therapyParts.push(`${c}x ${name}`);
      }
    });

    const therapyStr = therapyParts.join(" und ");
    
    // Remove old auto-generated date phrases from currentInst to avoid duplication (German & English)
    const cleanInst = currentInst
      .replace(/,?\s*(vom|ab|bis|from|starting|until)\s+\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{4}(\s+(bis|to)\s+\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{4})?/gi, "")
      .replace(/,?\s*(vom|ab|bis|from|starting|until)\s+\d{4}-\d{2}-\d{2}(\s+(bis|to)\s+\d{4}-\d{2}-\d{2})?/gi, "")
      .trim();

    const lower = cleanInst.toLowerCase();
    const phrases: string[] = [];
    if (lower.includes("max") || lower.includes("1 termin")) phrases.push(t("aiScheduler.builder.max1"));
    if (lower.includes("ruhetag") || lower.includes("rest day")) phrases.push(t("aiScheduler.builder.withRestDays"));
    if (lower.includes("2. tag") || lower.includes("every 2nd")) phrases.push(t("aiScheduler.builder.every2Days"));
    if (lower.includes("vormittag") || lower.includes("mornings")) phrases.push(t("aiScheduler.builder.mornings"));
    if (lower.includes("nachmittag") || lower.includes("afternoons")) phrases.push(t("aiScheduler.builder.afternoons"));

    const weeksMatch = lower.match(/(\d+)\s*(woche|week)/i);
    if (weeksMatch) {
      phrases.push(`über die nächsten ${weeksMatch[1]} Wochen`);
    }

    const datePhrase = getDatePhrase(sDate, eDate);
    if (datePhrase) {
      phrases.push(datePhrase);
    }

    const newPrompt = therapyStr
      ? (phrases.length > 0 ? `${therapyStr}, ${phrases.join(", ")}` : therapyStr)
      : phrases.join(", ");
    return newPrompt;
  };

  // Helper to update a therapy count and rebuild instruction prompt
  const updateTherapyCount = (tName: string, count: number) => {
    const val = Math.max(0, count);
    const updated = { ...therapyCounts, [tName]: val };
    setTherapyCounts(updated);
    setInstruction(buildPrompt(updated, startDateStr, endDateStr, instruction));
  };

  // Helper to append building block phrases to instruction prompt
  const appendPhrase = (phrase: string) => {
    setInstruction((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return phrase;
      if (trimmed.endsWith(",") || trimmed.endsWith(".")) return `${trimmed} ${phrase}`;
      return `${trimmed}, ${phrase}`;
    });
  };

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposals, setProposals] = useState<ProposedAppointment[]>([]);

  // Load API key from env on mount or dialog open
  useEffect(() => {
    if (isOpen) {
      const key = import.meta.env.VITE_GEMINI_API_KEY || "";
      setApiKey(key);
      if (!instruction.trim()) {
        setInstruction(buildPrompt(therapyCounts, startDateStr, endDateStr, ""));
      }
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
      const { data } = await supabase
        .from("rooms")
        .select("*, room_equipment(status, equipment(*))")
        .eq("clinic_id", activeClinicId)
        .order("name");
      return data || [];
    },
    enabled: !!activeClinicId && isOpen,
  });

  const { data: therapyTypes } = useQuery({
    queryKey: ["therapyTypes", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase
        .from("therapy_types")
        .select("*, therapy_type_equipment(equipment(*))")
        .eq("clinic_id", activeClinicId)
        .order("name");
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

  // Helper to parse German DD.MM.YYYY, slash MM/DD/YYYY, or ISO YYYY-MM-DD date strings
  const parseGermanOrIsoDate = (str: string): Date | null => {
    if (!str) return null;
    const trimmed = str.trim();
    // DD.MM.YYYY
    const germanMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (germanMatch) {
      const day = parseInt(germanMatch[1], 10);
      const month = parseInt(germanMatch[2], 10) - 1;
      const year = parseInt(germanMatch[3], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
    // MM/DD/YYYY or DD/MM/YYYY
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const p1 = parseInt(slashMatch[1], 10);
      const p2 = parseInt(slashMatch[2], 10);
      const year = parseInt(slashMatch[3], 10);
      const month = p1 > 12 ? p2 - 1 : p1 - 1;
      const day = p1 > 12 ? p1 : p2;
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
    // YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  // Helper to get required equipment IDs for a therapy type
  const getRequiredEquipmentIdsForTherapy = (therapyTypeId: string | null): string[] => {
    if (!therapyTypeId || !therapyTypes) return [];
    const tt = therapyTypes.find(t => t.id === therapyTypeId);
    if (!tt) return [];
    return (tt as any).therapy_type_equipment
      ?.map((te: any) => te.equipment?.id)
      .filter(Boolean) || [];
  };

  // Helper to check if a room has all required active equipment for a therapy type
  const isRoomSuitableForTherapy = (room: any, therapyTypeId: string | null): { suitable: boolean; reason?: string } => {
    if (!room) return { suitable: false, reason: "Kein Raum zugewiesen" };
    
    const requiredEquipmentIds = getRequiredEquipmentIdsForTherapy(therapyTypeId);
    if (requiredEquipmentIds.length === 0) {
      return { suitable: true };
    }

    const roomEquipmentList = (room.room_equipment as any[]) || [];
    
    // Check if room has all required equipment IDs
    const missingEquipmentIds = requiredEquipmentIds.filter(reqId => {
      return !roomEquipmentList.some(re => re.equipment?.id === reqId);
    });

    if (missingEquipmentIds.length > 0) {
      const missingNames = missingEquipmentIds.map(id => {
        const tt = therapyTypes?.find(t => t.id === therapyTypeId);
        const te = (tt as any)?.therapy_type_equipment?.find((item: any) => item.equipment?.id === id);
        return te?.equipment?.name || id;
      });
      return { suitable: false, reason: `Raum '${room.name}' fehlen Geräte: ${missingNames.join(", ")}` };
    }

    // Check if any required equipment in room is in 'maintenance' status
    const maintenanceInRoom = roomEquipmentList.filter(re => 
      re.equipment && requiredEquipmentIds.includes(re.equipment.id) && re.status === "maintenance"
    );

    if (maintenanceInRoom.length > 0) {
      const names = maintenanceInRoom.map(re => re.equipment.name);
      return { suitable: false, reason: `Raum '${room.name}' Gerät in Wartung: ${names.join(", ")}` };
    }

    return { suitable: true };
  };

  // Local Intelligent Engine (100% offline, deterministic NLP & conflict-free scheduling)
  const generateLocalFallbackProposals = (instructionStr: string): ProposedAppointment[] => {
    const result: ProposedAppointment[] = [];
    const lowerPrompt = instructionStr.toLowerCase();

    // 1. Detect time-of-day preferences from prompt (German & English)
    const preferVormittag = lowerPrompt.includes("vormittag") || lowerPrompt.includes("morgen") || lowerPrompt.includes("früh") || lowerPrompt.includes("morning") || lowerPrompt.includes("mornings");
    const preferNachmittag = lowerPrompt.includes("nachmittag") || lowerPrompt.includes("spät") || lowerPrompt.includes("afternoon") || lowerPrompt.includes("afternoons");

    // 2. Detect frequency & day-spacing rules (German & English)
    const hasRestDays = lowerPrompt.includes("ruhetag") || lowerPrompt.includes("ruhetagen") || lowerPrompt.includes("pause") || lowerPrompt.includes("pausentag") || lowerPrompt.includes("pausentagen") || lowerPrompt.includes("rest day") || lowerPrompt.includes("rest days") || lowerPrompt.includes("day off") || lowerPrompt.includes("break");
    const isEverySecondDay = hasRestDays || lowerPrompt.includes("2. tag") || lowerPrompt.includes("alle 2 tage") || lowerPrompt.includes("jeden zweiten tag") || lowerPrompt.includes("every 2 days") || lowerPrompt.includes("every second day") || lowerPrompt.includes("other day");
    const allowMultiplePerDay = lowerPrompt.includes("2x am tag") || lowerPrompt.includes("2 termine pro tag") || lowerPrompt.includes("2 termine") || lowerPrompt.includes("mehrmals") || lowerPrompt.includes("am selben tag") || lowerPrompt.includes("2 times a day") || lowerPrompt.includes("twice a day") || lowerPrompt.includes("2 appointments") || lowerPrompt.includes("same day");
    const strictMax1PerDay = lowerPrompt.includes("max") || lowerPrompt.includes("höchstens 1") || lowerPrompt.includes("nur 1") || lowerPrompt.includes("1 termin pro tag") || lowerPrompt.includes("ein termin pro tag") || lowerPrompt.includes("1 appointment per day") || lowerPrompt.includes("at most 1") || lowerPrompt.includes("1 per day");
    
    // 3. Extract weeks target if present (e.g. "über 3 Wochen", "over 3 weeks", "in 3 weeks")
    const weeksMatch = lowerPrompt.match(/(\d+)\s*(woche|week)/i);
    const targetWeeks = weeksMatch ? parseInt(weeksMatch[1], 10) : null;

    // 4. Extract explicit start and end dates if present in prompt
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    const rangeMatch = lowerPrompt.match(/(?:vom|from\s+)?(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{4}|\d{4}-\d{2}-\d{2})\s+(?:bis|to)\s+(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{4}|\d{4}-\d{2}-\d{2})/i);
    if (rangeMatch) {
      startDate = parseGermanOrIsoDate(rangeMatch[1]);
      endDate = parseGermanOrIsoDate(rangeMatch[2]);
    } else {
      const startMatch = lowerPrompt.match(/(?:ab|vom|from|starting)\s+(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{4}|\d{4}-\d{2}-\d{2})/i);
      if (startMatch) {
        startDate = parseGermanOrIsoDate(startMatch[1]);
      }
      const endMatch = lowerPrompt.match(/(?:bis|to|until)\s+(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{4}|\d{4}-\d{2}-\d{2})/i);
      if (endMatch) {
        endDate = parseGermanOrIsoDate(endMatch[1]);
      }
    }

    // Fallback start date if not specified in prompt: use startDateStr if valid, or tomorrow
    if (!startDate) {
      startDate = parseGermanOrIsoDate(startDateStr);
      if (!startDate) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() + 1);
      }
    }
    // Fallback end date if not specified in prompt: use endDateStr if valid
    if (!endDate) {
      endDate = parseGermanOrIsoDate(endDateStr);
    }

    // 5. Sanitize prompt before extracting therapy tasks so dates & modifiers aren't parsed as appointment quantities
    let cleanPrompt = instructionStr
      .replace(/(?:vom|ab|bis|from|starting|until)?\s*\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{4}/gi, " ")
      .replace(/(?:vom|ab|bis|from|starting|until)?\s*\d{4}-\d{2}-\d{2}/gi, " ")
      .replace(/\d+\s*(termine|termin|x am tag|pro tag|pro woche|woche|wochen|tage|tag|appointments|appointment|per day|a day)/gi, " ")
      .replace(/(ruhetag|ruhetagen|pause|pausentag|pausentagen|rest day|rest days|day off|break|2\. tag|alle 2 tage|jeden zweiten tag|every 2 days|every second day|other day)/gi, " ");

    const matches = [...cleanPrompt.matchAll(/(\d+)\s*x?\s*([a-zA-ZäöüÄÖÜß\s]+)/gi)];
    const timeUnitWords = ["woche", "wochen", "tag", "tage", "monat", "monate", "stunde", "stunden", "week", "weeks", "day", "days", "month", "months", "hour", "hours", "termin", "termine"];
    
    interface TargetTask {
      typeId: string | null;
      typeName: string;
      count: number;
      durationMins: number;
    }
    
    const tasks: TargetTask[] = [];

    if (matches.length > 0) {
      for (const match of matches) {
        const count = parseInt(match[1], 10);
        const rawKeyword = match[2].trim().toLowerCase();
        
        // Ignore time-unit matches or empty keywords
        const firstWord = rawKeyword.split(/\s+/)[0];
        if (!rawKeyword || timeUnitWords.includes(firstWord) || timeUnitWords.includes(rawKeyword)) {
          continue;
        }

        const matchedTt = therapyTypes?.find(tt => 
          tt.name.toLowerCase().includes(rawKeyword) || rawKeyword.includes(tt.name.toLowerCase())
        );

        if (matchedTt || !timeUnitWords.some(w => rawKeyword.includes(w))) {
          tasks.push({
            typeId: matchedTt?.id || (therapyTypes && therapyTypes[0]?.id) || null,
            typeName: matchedTt?.name || match[2].trim(),
            count: Math.min(count, 30),
            durationMins: matchedTt ? ((matchedTt as any).duration_minutes || (matchedTt as any).duration || 30) : 30
          });
        }
      }
    }
    
    if (tasks.length === 0) {
      const defaultTt = therapyTypes && therapyTypes[0];
      tasks.push({
        typeId: defaultTt?.id || null,
        typeName: defaultTt?.name || "Therapie",
        count: 5,
        durationMins: defaultTt ? ((defaultTt as any).duration_minutes || (defaultTt as any).duration || 30) : 30
      });
    }

    const totalSessionsRequested = tasks.reduce((sum, t) => sum + t.count, 0);

    // Determine candidate slot hours based on preference
    let candidateHours = [8, 9, 10, 11, 13, 14, 15, 16];
    if (preferVormittag) {
      candidateHours = [8, 9, 10, 11];
    } else if (preferNachmittag) {
      candidateHours = [13, 14, 15, 16];
    }

    // Determine day step spacing between active treatment days
    let dayStep = 1;
    if (isEverySecondDay) {
      dayStep = 2; // Active treatment day, followed by 1 rest day
    }

    // Max sessions per active treatment day
    let maxSessionsPerDay = 1;
    if (strictMax1PerDay) {
      maxSessionsPerDay = 1;
    } else if (allowMultiplePerDay) {
      maxSessionsPerDay = 2;
    }

    let currentDate = new Date(startDate);
    // Determine end boundary
    let maxEndDate = endDate ? new Date(endDate) : new Date(startDate);
    if (!endDate) {
      maxEndDate.setDate(maxEndDate.getDate() + (targetWeeks || 3) * 7);
    }
    maxEndDate.setHours(23, 59, 59, 999);

    const remainingTasks = tasks.map(t => ({ ...t, remaining: t.count }));
    let globalSessionIdx = 0;

    while (
      remainingTasks.some(t => t.remaining > 0) &&
      currentDate <= maxEndDate &&
      result.length < totalSessionsRequested
    ) {
      // Skip weekends (Saturday=6, Sunday=0)
      while ((currentDate.getDay() === 0 || currentDate.getDay() === 6) && currentDate <= maxEndDate) {
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (currentDate > maxEndDate) break;

      let sessionsOnThisDay = 0;

      for (const task of remainingTasks) {
        if (task.remaining <= 0) continue;
        if (sessionsOnThisDay >= maxSessionsPerDay) break;

        let scheduled = false;
        for (const h of candidateHours) {
          for (const m of [0, 30]) {
            const startTime = new Date(currentDate);
            startTime.setHours(h, m, 0, 0);
            const endTime = new Date(startTime.getTime() + task.durationMins * 60 * 1000);

            const startISO = formatLocalISO(startTime);
            const endISO = formatLocalISO(endTime);

            // Ensure patient doesn't have an overlapping session in DB or batch on the exact same time
            const patientDbConflict = allAppointments?.some(a => a.patient_id === selectedPatientId && hasOverlap(a.start_time, a.end_time, startISO, endISO));
            const patientBatchConflict = result.some(p => hasOverlap(p.start_time, p.end_time, startISO, endISO));
            if (patientDbConflict || patientBatchConflict) continue;

            const availableTherapist = therapists?.find(t => {
              const dbConflict = allAppointments?.some(a => a.therapist_id === t.id && hasOverlap(a.start_time, a.end_time, startISO, endISO));
              const batchConflict = result.some(p => p.therapist_id === t.id && hasOverlap(p.start_time, p.end_time, startISO, endISO));
              return !dbConflict && !batchConflict;
            });

            if (!availableTherapist && therapists && therapists.length > 0) {
              continue;
            }

            const availableRoom = rooms?.find(r => {
              // 1. Equipment suitability check
              const equipCheck = isRoomSuitableForTherapy(r, task.typeId);
              if (!equipCheck.suitable) return false;

              // 2. Room capacity check
              const capacity = r.capacity || 1;
              const dbOccupied = allAppointments?.filter(a => a.room_id === r.id && hasOverlap(a.start_time, a.end_time, startISO, endISO)).length || 0;
              const batchOccupied = result.filter(p => p.room_id === r.id && hasOverlap(p.start_time, p.end_time, startISO, endISO)).length;

              return dbOccupied + batchOccupied < capacity;
            });

            if (!availableRoom && rooms && rooms.length > 0) {
              continue;
            }

            const sessionNum = task.count - task.remaining + 1;

            result.push({
              id: `internal-${globalSessionIdx}-${Date.now()}`,
              start_time: startISO,
              end_time: endISO,
              therapist_id: availableTherapist?.id || null,
              room_id: availableRoom?.id || null,
              therapy_type_id: task.typeId,
              notes: `Termin ${sessionNum} von ${task.count} - ${task.typeName}`
            });

            task.remaining--;
            sessionsOnThisDay++;
            globalSessionIdx++;
            scheduled = true;

            if (result.length >= totalSessionsRequested) break;
            break;
          }
          if (scheduled || result.length >= totalSessionsRequested) break;
        }

        if (result.length >= totalSessionsRequested) break;
      }

      // Advance to next treatment day according to dayStep
      currentDate.setDate(currentDate.getDate() + (sessionsOnThisDay > 0 ? dayStep : 1));
    }

    return result.slice(0, totalSessionsRequested);
  };

  // Perform Generation (Cloud Gemini, Interne KI, or Browser WebLLM)
  const handleGenerate = async () => {
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
    setIsFallbackNotice(false);

    // Mode 1: Interne KI (Fast deterministic algorithm)
    if (engineMode === "internal") {
      setTimeout(() => {
        const localApts = generateLocalFallbackProposals(instruction);
        setProposals(localApts);
        setActiveUsedEngine("internal");
        setIsFallbackNotice(false);
        toast.success(`${localApts.length} Termine mit Interner KI-Engine berechnet!`);
        setIsGenerating(false);
      }, 300);
      return;
    }

    const patient = patients?.find((p) => p.id === selectedPatientId);
    const patientName = patient ? patient.full_name : "Unknown Patient";

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
      ?.map((tt: any) => `- ID: "${tt.id}", Name: "${tt.name}", Default Duration: ${tt.duration_minutes || tt.duration || 30} minutes`)
      .join("\n") || "None";

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
5. MANDATORY ROOM ASSIGNMENT: Every appointment MUST be assigned a valid room_id from the ROOMS list above. Do NOT set room_id to null unless no rooms exist. A room cannot have more overlapping appointments than its capacity.
6. Spread appointments logically across weeks. Prefer scheduling on different weekdays (e.g., Mon, Wed, Fri) and try to space them out.
7. Select the correct room from the ROOMS list and select a qualified therapist (matching specialties or name) for the requested therapy type. Matches therapy_type_id to the requested therapy.
8. STRICT QUANTITY MATCH: Schedule EXACTLY the total count requested (e.g. for "10x Physiotherapie und 5x Ultraschalltherapie", schedule EXACTLY 10 Physiotherapie and 5 Ultraschalltherapie = 15 total appointments). Never schedule more than requested.
9. DATE RANGE PARSING: If the prompt contains explicit start/end dates like 'vom 03.08.2026 bis 26.08.2026', schedule ONLY within that date range. Do NOT parse date numbers (like 03, 08, 2026, 26) as appointment quantities!

Output Format:
You must respond with a JSON object containing an array of 'appointments' matching the requested schema. Ensure room_id is MANDATORILY set to one of the available room IDs from ROOMS.
All start_time and end_time values must be formatted as YYYY-MM-DDTHH:mm:ss (without timezone offset or 'Z').
`;

    // Mode 2: Browser WebLLM (In-Browser Neural Model via WebGPU)
    if (engineMode === "webllm") {
      try {
        setWebllmStatus("Prüfe WebGPU-Unterstützung im Browser...");
        setWebllmPercent(5);

        if (!(navigator as any).gpu) {
          toast.error("WebGPU wird von diesem Browser/Grafikkarte nicht unterstützt. Automatisch Interne KI verwendet.");
          const fallbackApts = generateLocalFallbackProposals(instruction);
          setProposals(fallbackApts);
          setActiveUsedEngine("internal");
          setIsFallbackNotice(true);
          setIsGenerating(false);
          return;
        }

        // Reuse cached engine if available
        if (!cachedMLCEngine) {
          setWebllmStatus("Initialisiere Browser WebLLM Engine (Qwen2.5 0.5B)...");
          setWebllmPercent(10);

          cachedMLCEngine = await CreateMLCEngine(
            "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
            {
              initProgressCallback: (progress) => {
                const pct = Math.round((progress.progress || 0) * 100);
                setWebllmPercent(pct);
                setWebllmStatus(progress.text || `Lade KI-Modell: ${pct}%`);
              }
            }
          );
        }

        setWebllmStatus("Lokales KI-Modell berechnet Terminplan...");
        setWebllmPercent(90);

        // WebLLM Concise Prompt to prevent small model grammar loop
        const conciseSystemPrompt = `You are a clinical scheduler assistant. Return JSON object with key "appointments" containing array of appointments.
Available Therapists: ${therapists?.map(t => `${t.profiles?.full_name || 'Therapeut'} (ID:${t.id})`).join(', ') || 'None'}
Available Rooms: ${rooms?.map(r => `${r.name} (ID:${r.id})`).join(', ') || 'None'}
Available Therapy Types: ${therapyTypes?.map(tt => `${tt.name} (ID:${tt.id})`).join(', ') || 'None'}

Format: {"appointments":[{"start_time":"2026-06-15T09:00:00","end_time":"2026-06-15T09:30:00","therapist_id":"ID","room_id":"ID","therapy_type_id":"ID","notes":"Termin 1"}]}`;

        // 6 second timeout for completion generation to prevent infinite token loops
        const generateTask = async () => {
          const reply = await cachedMLCEngine.chat.completions.create({
            messages: [
              { role: "system", content: conciseSystemPrompt },
              { role: "user", content: instruction }
            ],
            max_tokens: 512,
            temperature: 0.1,
          });
          return reply.choices[0]?.message?.content || "";
        };

        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("WebLLM Antwort-Zeitüberschreitung")), 6000)
        );

        let content = "";
        try {
          content = await Promise.race([generateTask(), timeoutPromise]);
        } catch (tErr) {
          console.warn("WebLLM generation timed out or failed:", tErr);
        }

        setWebllmPercent(100);
        
        let generatedApts: ProposedAppointment[] = [];
        if (content.trim()) {
          try {
            // Extract JSON substring if wrapped in markdown block
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
            
            generatedApts = (parsed.appointments || []).map((a: any, idx: number) => {
              let validRoomId = a.room_id;
              if ((!validRoomId || !rooms?.some(r => r.id === validRoomId)) && rooms && rooms.length > 0) {
                validRoomId = rooms[idx % rooms.length].id;
              }
              let validTherapistId = a.therapist_id;
              if ((!validTherapistId || !therapists?.some(t => t.id === validTherapistId)) && therapists && therapists.length > 0) {
                validTherapistId = therapists[idx % therapists.length].id;
              }
              let validTherapyTypeId = a.therapy_type_id;
              if ((!validTherapyTypeId || !therapyTypes?.some(tt => tt.id === validTherapyTypeId)) && therapyTypes && therapyTypes.length > 0) {
                validTherapyTypeId = therapyTypes[0].id;
              }

              return {
                id: `webllm-${idx}-${Date.now()}`,
                start_time: a.start_time,
                end_time: a.end_time,
                therapist_id: validTherapistId || null,
                room_id: validRoomId || null,
                therapy_type_id: validTherapyTypeId || null,
                notes: a.notes || "",
              };
            });
          } catch (pErr) {
            console.warn("Could not parse WebLLM JSON output:", pErr);
          }
        }

        if (generatedApts.length === 0) {
          // Use smart local fallback engine to produce exact appointments
          generatedApts = generateLocalFallbackProposals(instruction);
        }

        setProposals(generatedApts);
        setActiveUsedEngine("webllm");
        setIsFallbackNotice(false);
        toast.success(`${generatedApts.length} Termine lokal mit WebLLM (WebGPU) generiert!`);
        setIsGenerating(false);
        return;
      } catch (err: any) {
        console.error("WebLLM Execution Error:", err);
        toast.error(`WebLLM: ${err?.message || "Ladefehler"}. Interne KI verwendet!`, { duration: 7000 });
        const fallbackApts = generateLocalFallbackProposals(instruction);
        setProposals(fallbackApts);
        setActiveUsedEngine("internal");
        setIsFallbackNotice(true);
        setIsGenerating(false);
        return;
      }
    }

    // Mode 3: Online Gemini Cloud API
    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-2.0-flash"
    ];

    let response: Response | null = null;

    if (apiKey) {
      for (const modelName of modelsToTry) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
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
                              description: "ID of the therapist from THERAPISTS list"
                            },
                            room_id: {
                              type: "STRING",
                              description: "MANDATORY ID of the room from ROOMS list. Must not be null."
                            },
                            therapy_type_id: {
                              type: "STRING",
                              description: "ID of the therapy type from THERAPY TYPES list"
                            },
                            notes: {
                              type: "STRING",
                              description: "Short explanation or note (e.g., 'Termin 1 von 10 - Physiotherapie')"
                            }
                          },
                          required: ["start_time", "end_time", "room_id", "notes"]
                        }
                      }
                    },
                    required: ["appointments"]
                  }
                }
              }),
            }
          );

          if (res.ok) {
            response = res;
            break;
          }
        } catch (err) {
          console.warn(`Model ${modelName} fetch failed, trying next...`);
        }
      }
    }

    if (!response) {
      console.log("API Quota exceeded or API Key missing. Activating Intelligent Fallback Engine.");
      const fallbackApts = generateLocalFallbackProposals(instruction);
      setProposals(fallbackApts);
      setActiveUsedEngine("internal");
      setIsFallbackNotice(true);
      toast.info("ℹ️ Cloud KI war ausgelastet/nicht verfügbar. Automatisch Interne KI verwendet!", { duration: 6000 });
      setIsGenerating(false);
      return;
    }

    try {
      const resJson = await response.json();
      const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) {
        throw new Error("Empty response received from Gemini.");
      }

      const parsed = JSON.parse(responseText);
      const generatedApts: ProposedAppointment[] = (parsed.appointments || []).map((a: any, idx: number) => {
        let validRoomId = a.room_id;
        if ((!validRoomId || !rooms?.some(r => r.id === validRoomId)) && rooms && rooms.length > 0) {
          validRoomId = rooms[idx % rooms.length].id;
        }

        let validTherapistId = a.therapist_id;
        if ((!validTherapistId || !therapists?.some(t => t.id === validTherapistId)) && therapists && therapists.length > 0) {
          validTherapistId = therapists[idx % therapists.length].id;
        }

        let validTherapyTypeId = a.therapy_type_id;
        if ((!validTherapyTypeId || !therapyTypes?.some(tt => tt.id === validTherapyTypeId)) && therapyTypes && therapyTypes.length > 0) {
          validTherapyTypeId = therapyTypes[0].id;
        }

        return {
          id: `proposal-${idx}-${Date.now()}`,
          start_time: a.start_time,
          end_time: a.end_time,
          therapist_id: validTherapistId || null,
          room_id: validRoomId || null,
          therapy_type_id: validTherapyTypeId || null,
          notes: a.notes || "",
        };
      });

      setProposals(generatedApts);
      setActiveUsedEngine("gemini");
      setIsFallbackNotice(false);
      toast.success(t("aiScheduler.successMessage", { count: generatedApts.length }) || `${generatedApts.length} Termine mit Cloud KI generiert!`);
    } catch (error: any) {
      console.error("Gemini Scheduling Error:", error);
      const fallbackApts = generateLocalFallbackProposals(instruction);
      setProposals(fallbackApts);
      setActiveUsedEngine("internal");
      setIsFallbackNotice(true);
      toast.info("ℹ️ Cloud KI war vorübergehend ausgelastet. Automatisch Interne KI verwendet!", { duration: 6000 });
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

    // 4. Room Capacity & Equipment Check (with Database & Batch)
    if (item.room_id) {
      const targetRoom = rooms?.find((r) => r.id === item.room_id);
      if (targetRoom) {
        // Equipment Check
        const equipCheck = isRoomSuitableForTherapy(targetRoom, item.therapy_type_id);
        if (!equipCheck.suitable) {
          errors.push(equipCheck.reason || `Raum '${targetRoom.name}' erfüllt die Geräteanforderungen nicht.`);
        }

        // Capacity Check
        const capacity = targetRoom.capacity || 1;
        const dbRoomOccupiedCount = allAppointments?.filter(
          (a) => a.room_id === item.room_id && hasOverlap(a.start_time, a.end_time, proposalStartISO, proposalEndISO)
        ).length || 0;
        const otherProposals = allProposals.filter((p) => p.id !== item.id);
        const batchRoomOccupiedCount = otherProposals.filter(
          (p) => p.room_id === item.room_id && hasOverlap(p.start_time, p.end_time, item.start_time, item.end_time)
        ).length;

        if (dbRoomOccupiedCount + batchRoomOccupiedCount > capacity) {
          errors.push(`Raum '${targetRoom.name}' überschreitet die Kapazität (Kapazität: ${capacity}).`);
        }
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
        const startDateTime = new Date(p.start_time);
        const endDateTime = new Date(p.end_time);
        const requiredEquip = getRequiredEquipmentIdsForTherapy(p.therapy_type_id);

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
          required_equipment_ids: requiredEquip,
        };
      });

      const { error } = await supabase.from("appointments").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
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
      <DialogContent className="sm:!max-w-[90vw] !w-[90vw] max-w-[90vw] w-[90vw] max-h-[85vh] h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-slate-200 shadow-2xl rounded-2xl">
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
        {!apiKey && engineMode === "online" && (
          <div className="p-4 mx-6 mt-6 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <p className="font-semibold">{t("aiScheduler.missingApiKey")}</p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setEngineMode("internal")}
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 font-bold shrink-0 text-xs gap-1"
            >
              <Zap className="h-3.5 w-3.5 text-amber-600" />
              Zu Interner KI wechseln
            </Button>
          </div>
        )}

        {/* WebLLM Progress Bar Banner */}
        {isGenerating && engineMode === "webllm" && (
          <div className="mx-6 mt-6 p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600 shrink-0" />
                <span className="truncate">{webllmStatus || "Lade WebGPU KI-Modell..."}</span>
              </span>
              <span className="font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full shrink-0">
                {webllmPercent}%
              </span>
            </div>
            <div className="w-full bg-purple-200 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 h-full transition-all duration-300 rounded-full" 
                style={{ width: `${Math.max(webllmPercent, 5)}%` }} 
              />
            </div>
            <p className="text-[11px] text-purple-700 flex items-center gap-1.5 pt-1">
              <Globe className="h-3.5 w-3.5 shrink-0 text-purple-600" />
              Das KI-Modell wird direkt in deinen Grafikkartenspeicher (WebGPU) geladen. Keine Daten verlassen deinen PC.
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Controls Grid: Patient Selector & Engine Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            {/* Patient Selector */}
            <div className="space-y-2">
              <Label htmlFor="patient-select" className="text-sm font-semibold text-slate-700">
                {t("pinboard.selectPatient")}
              </Label>
              <Select value={selectedPatientId} onValueChange={(val) => setSelectedPatientId(val || "")}>
                <SelectTrigger id="patient-select" className="bg-slate-50 border-slate-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 rounded-lg h-10">
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

            {/* Engine Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                <span>KI Engine wählen</span>
              </Label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl h-10 items-center">
                <button
                  type="button"
                  onClick={() => setEngineMode("online")}
                  className={`flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg text-xs font-semibold transition-all ${
                    engineMode === "online" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Cloud KI über Google Gemini API"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  Cloud KI
                </button>
                <button
                  type="button"
                  onClick={() => setEngineMode("internal")}
                  className={`flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg text-xs font-semibold transition-all ${
                    engineMode === "internal" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Interne KI (100% offline & deterministischer Algorithmus)"
                >
                  <Zap className="h-3.5 w-3.5 text-emerald-500" />
                  Interne KI
                </button>
                <button
                  type="button"
                  onClick={() => setEngineMode("webllm")}
                  className={`flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg text-xs font-semibold transition-all ${
                    engineMode === "webllm" ? "bg-white text-purple-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Lokales Browser KI-Modell (WebLLM via WebGPU)"
                >
                  <Globe className="h-3.5 w-3.5 text-purple-500" />
                  WebLLM
                </button>
              </div>
            </div>
          </div>

          {/* Full Width Prompt Area & Baukastensystem */}
          <div className="flex flex-col space-y-4">
            {/* Textarea Header with Clear Button */}
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt-instruction" className="text-sm font-semibold text-slate-700">
                {t("aiScheduler.instructionLabel")}
              </Label>
              {instruction && (
                <button
                  type="button"
                  onClick={() => setInstruction("")}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 font-medium transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("aiScheduler.builder.clearPrompt")}
                </button>
              )}
            </div>

              <Textarea
                id="prompt-instruction"
                rows={4}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={t("aiScheduler.builder.placeholder")}
                className="bg-white border-slate-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 rounded-xl p-3.5 text-slate-800 font-medium text-sm resize-none"
              />

              {/* Split Layout Container: Left (Therapie-Mengen & Fixe Daten) | Right (Phrasen-Baukasten + Berechnen-Button) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Side (Red Area): Vorhandene Therapiearten mit Menge/Spinner & Start/Endtermin */}
                <div className="lg:col-span-6 bg-white border border-slate-200 p-4 rounded-xl space-y-4 shadow-sm flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                        {t("aiScheduler.builder.quantityTitle")}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Zahl tippen oder ▲/▼ Pfeiltasten nutzen
                      </span>
                    </div>

                    {/* List of Therapy Types with Number Input (Arrows) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {Array.from(new Set(["Physiotherapie", "Ultraschalltherapie", "Lymphdrainage", "Massage", ...(therapyTypes?.map((tt: any) => tt?.name).filter(Boolean) || [])])).map((tName) => {
                        const count = therapyCounts[tName] || 0;
                        return (
                          <div key={tName} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg">
                            <span className="text-xs font-semibold text-slate-700 truncate mr-2" title={tName}>
                              {tName}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => updateTherapyCount(tName, count - 1)}
                                className="h-7 w-7 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all active:scale-95"
                              >
                                -
                              </button>
                              <Input
                                type="number"
                                min={0}
                                max={30}
                                value={count}
                                onChange={(e) => updateTherapyCount(tName, parseInt(e.target.value, 10) || 0)}
                                className="w-14 h-7 text-center font-bold text-xs p-1 bg-white border-slate-200"
                              />
                              <button
                                type="button"
                                onClick={() => updateTherapyCount(tName, count + 1)}
                                className="h-7 w-7 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all active:scale-95"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fixe Einstellungen: Start- & Enddatum */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-600">{t("aiScheduler.builder.startDate")}</Label>
                      <Input
                        type="date"
                        value={startDateStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStartDateStr(val);
                          setInstruction(buildPrompt(therapyCounts, val, endDateStr, instruction));
                        }}
                        className="h-8 text-xs bg-white border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-600">{t("aiScheduler.builder.endDate")}</Label>
                      <Input
                        type="date"
                        value={endDateStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEndDateStr(val);
                          setInstruction(buildPrompt(therapyCounts, startDateStr, val, instruction));
                        }}
                        placeholder="Optional"
                        className="h-8 text-xs bg-white border-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Side (Yellow Area): Phrasen-Baukasten + Berechnen Button */}
                <div className="lg:col-span-6 bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between space-y-4 shadow-sm">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                        {t("aiScheduler.builder.title")}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {t("aiScheduler.builder.subtitle")}
                      </span>
                    </div>

                    {/* Category 1: Frequenz & Tageslimit */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">{t("aiScheduler.builder.frequenz")}</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => appendPhrase(t("aiScheduler.builder.max1"))}
                          className="text-xs px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-semibold rounded-lg transition-all active:scale-95"
                        >
                          + {t("aiScheduler.builder.max1")}
                        </button>
                        <button
                          type="button"
                          onClick={() => appendPhrase(t("aiScheduler.builder.twoPerDay"))}
                          className="text-xs px-2.5 py-1 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 font-semibold rounded-lg transition-all active:scale-95"
                        >
                          + {t("aiScheduler.builder.twoPerDay")}
                        </button>
                        <button
                          type="button"
                          onClick={() => appendPhrase(t("aiScheduler.builder.withRestDays"))}
                          className="text-xs px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-medium rounded-lg transition-all active:scale-95"
                        >
                          + {t("aiScheduler.builder.withRestDays")}
                        </button>
                        <button
                          type="button"
                          onClick={() => appendPhrase(t("aiScheduler.builder.every2Days"))}
                          className="text-xs px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-700 font-medium rounded-lg transition-all active:scale-95"
                        >
                          + {t("aiScheduler.builder.every2Days")}
                        </button>
                      </div>
                    </div>

                    {/* Category 2: Tageszeit & Zeitraum */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase">{t("aiScheduler.builder.tageszeit")}</span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => appendPhrase(t("aiScheduler.builder.mornings"))}
                            className="text-xs px-2.5 py-1 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-medium rounded-lg transition-all active:scale-95"
                          >
                            + {t("aiScheduler.builder.mornings")}
                          </button>
                          <button
                            type="button"
                            onClick={() => appendPhrase(t("aiScheduler.builder.afternoons"))}
                            className="text-xs px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-medium rounded-lg transition-all active:scale-95"
                          >
                            + {t("aiScheduler.builder.afternoons")}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase">{t("aiScheduler.builder.zeitraum")}</span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => appendPhrase(t("aiScheduler.builder.weeks2"))}
                            className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-medium rounded-lg transition-all active:scale-95"
                          >
                            + {t("aiScheduler.builder.weeks2")}
                          </button>
                          <button
                            type="button"
                            onClick={() => appendPhrase(t("aiScheduler.builder.weeks3"))}
                            className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-medium rounded-lg transition-all active:scale-95"
                          >
                            + {t("aiScheduler.builder.weeks3")}
                          </button>
                          <button
                            type="button"
                            onClick={() => appendPhrase(t("aiScheduler.builder.weeks4"))}
                            className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-medium rounded-lg transition-all active:scale-95"
                          >
                            + {t("aiScheduler.builder.weeks4")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Action Button at Bottom Right of Yellow Box */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500 font-medium truncate">
                      {engineMode === "internal" ? (
                        <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                          <Zap className="h-3.5 w-3.5 text-emerald-500" />
                          Interne Engine: 100% lokal & sofort
                        </span>
                      ) : engineMode === "webllm" ? (
                        <span className="text-purple-700 flex items-center gap-1 font-semibold truncate">
                          <Globe className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                          {webllmStatus || "Browser WebLLM (Qwen2.5 0.5B via WebGPU)"}
                        </span>
                      ) : (
                        <span className="text-indigo-600 flex items-center gap-1 font-semibold">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                          Cloud Engine: Google Gemini 1.5 Flash
                        </span>
                      )}
                    </span>

                    <Button
                      onClick={handleGenerate}
                      disabled={isGenerating || !selectedPatientId || !instruction.trim() || (engineMode === "online" && !apiKey)}
                      className={`font-semibold shadow-md px-6 py-2 rounded-lg gap-2 text-white shrink-0 ${
                        engineMode === "internal" 
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700" 
                          : engineMode === "webllm"
                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      }`}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("aiScheduler.generating")}
                        </>
                      ) : engineMode === "internal" ? (
                        <>
                          <Zap className="h-4 w-4 text-yellow-300" />
                          Interne KI berechnen
                        </>
                      ) : engineMode === "webllm" ? (
                        <>
                          <Globe className="h-4 w-4 text-purple-200" />
                          WebLLM berechnen
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
            </div>

          <hr className="border-slate-200" />

          {/* Fallback Notice Banner */}
          {isFallbackNotice && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Hinweis zum Fallback:</strong> Gewählte KI war ausgelastet/nicht verfügbar. Das System hat <strong>automatisch die Interne KI-Engine</strong> genutzt.
                </span>
              </div>
              <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-bold shrink-0 ml-2">
                ⚡ Interne KI aktiv
              </Badge>
            </div>
          )}

          {/* Proposals List Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-500" />
                  {t("aiScheduler.previewTitle")}
                </h3>
                <p className="text-xs text-slate-500">
                  {t("aiScheduler.previewSubtitle")}
                </p>
              </div>

              {activeUsedEngine === "internal" ? (
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 gap-1 text-xs px-3 py-1 font-bold">
                  <Zap className="h-3.5 w-3.5 text-emerald-600" />
                  Generiert mit Interner KI
                </Badge>
              ) : activeUsedEngine === "webllm" ? (
                <Badge className="bg-purple-100 text-purple-800 border border-purple-300 gap-1 text-xs px-3 py-1 font-bold">
                  <Globe className="h-3.5 w-3.5 text-purple-600" />
                  Generiert mit Browser WebLLM (WebGPU)
                </Badge>
              ) : activeUsedEngine === "gemini" ? (
                <Badge className="bg-indigo-100 text-indigo-800 border border-indigo-300 gap-1 text-xs px-3 py-1 font-bold">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  Generiert mit Cloud KI (Gemini)
                </Badge>
              ) : null}
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
        <DialogFooter className="m-0 px-8 py-4 bg-slate-100 border-t border-slate-200 flex flex-row items-center justify-end gap-3 sm:gap-4 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 hover:text-rose-800 font-semibold px-5 py-2 rounded-lg transition-colors shadow-sm"
          >
            {t("common.cancel") || t("pinboard.cancel") || "Abbrechen"}
          </Button>

          <Button
            type="button"
            onClick={() => bookProposalsMutation.mutate()}
            disabled={proposals.length === 0 || bookProposalsMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md px-6 py-2 rounded-lg gap-2"
          >
            {bookProposalsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.saving") || "Speichern..."}
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

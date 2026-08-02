import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInYears } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  Clock, 
  X, 
  Loader2, 
  Info,
  CalendarCheck2,
  Printer,
  SlidersHorizontal,
  FileSpreadsheet,
  Tv,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Utensils,
  Zap
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const generateTimeSlots = () => {
  const slots = [];
  let hour = 7;
  let minute = 30;
  while (hour < 17 || (hour === 17 && minute === 0)) {
    const hStr = hour.toString().padStart(2, "0");
    const mStr = minute.toString().padStart(2, "0");
    slots.push(`${hStr}:${mStr}`);
    minute += 15;
    if (minute === 60) {
      hour += 1;
      minute = 0;
    }
  }
  return slots;
};

// Config parameters for the Pinboard time grid
const TIME_SLOTS = generateTimeSlots();

const parseTimeToMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const GRID_START_MINUTES = parseTimeToMinutes("07:30"); // 450 min
const GRID_END_MINUTES = parseTimeToMinutes("18:00");   // 1080 min
const ROW_HEIGHT = 30; // px height of a 15 min row
const MINUTE_HEIGHT = ROW_HEIGHT / 15; // 2px per minute
const GRID_TOTAL_HEIGHT = TIME_SLOTS.length * ROW_HEIGHT; // 39 * 30 = 1170px

const PRINT_ROW_HEIGHT = 16.5; // px height of 15 min row in print grid for optimal page fill
const PRINT_MINUTE_HEIGHT = PRINT_ROW_HEIGHT / 15; // 1.1px per min

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
  const { t, i18n } = useTranslation();
  const { activeClinicId } = useAuth();
  const queryClient = useQueryClient();
  const currentLocale = i18n.language.startsWith("en") ? enUS : de;

  // State: selected date (defaults to today)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // State: patient IDs displayed in the 3 columns
  const [colPatientIds, setColPatientIds] = useState<(string | null)[]>([null, null, null]);

  // State: temporary custom end times during active drag resizing for real-time visual feedback
  const [tempResizedApts, setTempResizedApts] = useState<Record<string, string>>({});

  // State: standard blocks templates (managed locally in localStorage per clinic)
  const [standardBlocks, setStandardBlocks] = useState<StandardBlock[]>([]);
  const [isNewBlockOpen, setIsNewBlockOpen] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockDuration, setNewBlockDuration] = useState(30);
  const [newBlockColor, setNewBlockColor] = useState("#3b82f6");

  // State: Print / PDF Export Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printScope, setPrintScope] = useState<"scheduled" | "active">("scheduled");
  const [printOrientation, setPrintOrientation] = useState<"landscape" | "portrait">("landscape");
  const [patientsPerPage, setPatientsPerPage] = useState<number>(5);

  // State: TV Mode
  const [isTvModeOpen, setIsTvModeOpen] = useState(false);
  const [tvCurrentPage, setTvCurrentPage] = useState(0);
  const [tvIntervalSeconds, setTvIntervalSeconds] = useState(10);
  const [isTvAutoPlay, setIsTvAutoPlay] = useState(true);

  // State: Fixed Daily Routines (Meal times, rest breaks)
  interface FixedRoutine {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string;
  }
  const [fixedRoutines, setFixedRoutines] = useState<FixedRoutine[]>([]);
  const [isNewRoutineOpen, setIsNewRoutineOpen] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineStart, setNewRoutineStart] = useState("12:00");
  const [newRoutineEnd, setNewRoutineEnd] = useState("13:00");
  const [newRoutineColor, setNewRoutineColor] = useState("#f97316");

  // Load fixed routines from localStorage
  useEffect(() => {
    if (!activeClinicId) return;
    const key = `harmony_fixed_routines_${activeClinicId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setFixedRoutines(JSON.parse(saved));
    } else {
      const defaults: FixedRoutine[] = [
        { id: "fruehstueck", name: "Frühstück", startTime: "08:00", endTime: "08:30", color: "#eab308" },
        { id: "mittagessen", name: "Mittagessen", startTime: "12:00", endTime: "13:00", color: "#f97316" },
        { id: "ruhepause", name: "Ruhepause", startTime: "13:00", endTime: "14:00", color: "#10b981" },
        { id: "abendessen", name: "Abendessen", startTime: "17:30", endTime: "18:00", color: "#a855f7" }
      ];
      setFixedRoutines(defaults);
      localStorage.setItem(key, JSON.stringify(defaults));
    }
  }, [activeClinicId]);

  const saveRoutines = (updated: FixedRoutine[]) => {
    if (!activeClinicId) return;
    setFixedRoutines(updated);
    localStorage.setItem(`harmony_fixed_routines_${activeClinicId}`, JSON.stringify(updated));
  };

  const handleCreateRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutineName.trim()) return;

    const newRoutine: FixedRoutine = {
      id: Math.random().toString(36).substring(2, 9),
      name: newRoutineName.trim(),
      startTime: newRoutineStart,
      endTime: newRoutineEnd,
      color: newRoutineColor
    };

    saveRoutines([...fixedRoutines, newRoutine]);
    setNewRoutineName("");
    setIsNewRoutineOpen(false);
    toast.success("Routine hinzugefügt!");
  };

  const handleDeleteRoutine = (id: string) => {
    saveRoutines(fixedRoutines.filter(r => r.id !== id));
    toast.success("Routine gelöscht!");
  };

  const handleApplyFixedRoutines = async () => {
    if (!activeClinicId || fixedRoutines.length === 0) return;

    const activePatients = colPatientIds.filter(Boolean) as string[];
    if (activePatients.length === 0) {
      toast.error(t('pinboard.selectPatient') || "Bitte wählen Sie mindestens einen Patienten aus.");
      return;
    }

    const newAptsToInsert: any[] = [];
    let countAdded = 0;

    for (const pId of activePatients) {
      for (const routine of fixedRoutines) {
        const startDateTime = new Date(`${dateStr}T${routine.startTime}:00`);
        const endDateTime = new Date(`${dateStr}T${routine.endTime}:00`);

        const hasConflict = checkLocalPatientOverlap(pId, startDateTime, endDateTime);
        if (!hasConflict) {
          newAptsToInsert.push({
            clinic_id: activeClinicId,
            patient_id: pId,
            therapist_id: null,
            therapy_type_id: null,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            status: "scheduled",
            notes: routine.name
          });
          countAdded++;
        }
      }
    }

    if (newAptsToInsert.length === 0) {
      toast.info("Keine neuen Routinen eingetragen (bereits belegt oder vorhanden).");
      return;
    }

    const { error } = await supabase.from("appointments").insert(newAptsToInsert);
    if (error) {
      toast.error(error.message || "Fehler beim Eintragen der Routinen.");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["appointments-day"] });
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    toast.success(t('pinboard.successApplyRoutines', { count: countAdded }) || `Feste Routinen (${countAdded} Blöcke) eingetragen!`);
  };

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

  // Fetch Clinic Info
  const { data: clinic } = useQuery({
    queryKey: ["clinic", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return null;
      const { data, error } = await supabase
        .from("clinics")
        .select("*")
        .eq("id", activeClinicId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeClinicId,
  });

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
          patients (id, full_name, date_of_birth, ssn_svn),
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

  // Helper: Check if an appointment overlaps with existing ones for the same patient
  const checkLocalPatientOverlap = (
    patientId: string,
    start: Date,
    end: Date,
    excludeAptId?: string
  ): boolean => {
    if (!appointments) return false;
    
    const targetStart = start.getTime();
    const targetEnd = end.getTime();
    
    return appointments.some(apt => {
      if (apt.patient_id !== patientId) return false;
      if (excludeAptId && apt.id === excludeAptId) return false;
      
      const aptStart = new Date(apt.start_time).getTime();
      const aptEnd = new Date(apt.end_time).getTime();
      
      return targetStart < aptEnd && targetEnd > aptStart;
    });
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

  // Helper: Get layout parameters for rendering cards on screen grid
  const getCardLayout = (startTimeStr: string, endTimeStr: string) => {
    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);
    
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    
    const clampedStart = Math.max(GRID_START_MINUTES, Math.min(GRID_END_MINUTES, startMinutes));
    const clampedEnd = Math.max(GRID_START_MINUTES, Math.min(GRID_END_MINUTES, endMinutes));
    
    const top = (clampedStart - GRID_START_MINUTES) * MINUTE_HEIGHT;
    const height = Math.max(ROW_HEIGHT - 6, (clampedEnd - clampedStart) * MINUTE_HEIGHT);
    
    return { top, height };
  };

  // Helper: Get layout parameters for print grid
  const getPrintCardLayout = (startTimeStr: string, endTimeStr: string) => {
    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);
    
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    
    const clampedStart = Math.max(GRID_START_MINUTES, Math.min(GRID_END_MINUTES, startMinutes));
    const clampedEnd = Math.max(GRID_START_MINUTES, Math.min(GRID_END_MINUTES, endMinutes));
    
    const top = (clampedStart - GRID_START_MINUTES) * PRINT_MINUTE_HEIGHT;
    const height = Math.max(PRINT_ROW_HEIGHT - 1, (clampedEnd - clampedStart) * PRINT_MINUTE_HEIGHT);
    
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

  const handleResizeStart = (e: React.MouseEvent, apt: Appointment) => {
    e.stopPropagation();
    e.preventDefault();
    
    const initialY = e.clientY;
    const initialEnd = new Date(apt.end_time);
    const initialStart = new Date(apt.start_time);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - initialY;
      const deltaMinutes = Math.round(deltaY / ROW_HEIGHT) * 15;
      const newEnd = new Date(initialEnd.getTime() + deltaMinutes * 60 * 1000);
      
      if (newEnd.getTime() - initialStart.getTime() >= 15 * 60 * 1000) {
        setTempResizedApts(prev => ({
          ...prev,
          [apt.id]: newEnd.toISOString()
        }));
      }
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      
      const deltaY = upEvent.clientY - initialY;
      const deltaMinutes = Math.round(deltaY / ROW_HEIGHT) * 15;
      const newEnd = new Date(initialEnd.getTime() + deltaMinutes * 60 * 1000);
      
      setTempResizedApts(prev => {
        const next = { ...prev };
        delete next[apt.id];
        return next;
      });

      if (newEnd.getTime() - initialStart.getTime() >= 15 * 60 * 1000) {
        if (checkLocalPatientOverlap(apt.patient_id, initialStart, newEnd, apt.id)) {
          toast.error("Terminkonflikt: Diese Größenänderung überschneidet sich mit einem anderen Termin.");
          return;
        }
        
        updateAppointmentMutation.mutate({
          id: apt.id,
          patient_id: apt.patient_id,
          start_time: apt.start_time,
          end_time: newEnd.toISOString()
        });
      }
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Drop targets: Time cell dropped handlers
  const handleDropOnCell = (e: React.DragEvent, colPatientId: string | null, timeSlotStr: string) => {
    e.preventDefault();
    if (!colPatientId || !activeClinicId) return;

    const source = e.dataTransfer.getData("source");
    const startDateTime = new Date(`${dateStr}T${timeSlotStr}:00`);

    if (source === "template") {
      const blockStr = e.dataTransfer.getData("block");
      if (!blockStr) return;
      const block: StandardBlock = JSON.parse(blockStr);
      const endDateTime = new Date(startDateTime.getTime() + block.duration * 60 * 1000);

      if (checkLocalPatientOverlap(colPatientId, startDateTime, endDateTime)) {
        toast.error("Terminkonflikt: Der Patient hat in dieser Zeit bereits einen Termin.");
        return;
      }

      const newApt = {
        clinic_id: activeClinicId,
        patient_id: colPatientId,
        therapist_id: null,
        therapy_type_id: null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: "scheduled",
        notes: block.name,
      };

      createAppointmentMutation.mutate(newApt);
    } else if (source === "existing") {
      const aptId = e.dataTransfer.getData("appointmentId");
      if (!aptId || !appointments) return;
      
      const apt = appointments.find(a => a.id === aptId);
      if (!apt) return;

      const durationMs = new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime();
      const endDateTime = new Date(startDateTime.getTime() + durationMs);

      if (checkLocalPatientOverlap(colPatientId, startDateTime, endDateTime, aptId)) {
        toast.error("Terminkonflikt: Der Patient hat in dieser Zeit bereits einen Termin.");
        return;
      }

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

  // Print Patient Chunking Logic
  const getPrintPatients = () => {
    if (!patients) return [];

    if (printScope === "scheduled" && appointments) {
      const scheduledPatientIds = new Set(appointments.map(a => a.patient_id));
      const scheduledList = patients.filter(p => scheduledPatientIds.has(p.id));
      if (scheduledList.length > 0) return scheduledList;
    }

    // Fallback or "all active" scope
    return patients.filter(p => p.is_active !== false && p.status !== "discharged" && p.status !== "inactive");
  };

  const printPatientsList = getPrintPatients();
  const patientChunks: Patient[][] = [];
  for (let i = 0; i < printPatientsList.length; i += patientsPerPage) {
    patientChunks.push(printPatientsList.slice(i, i + patientsPerPage));
  }

  // Auto-rotate TV slides timer
  useEffect(() => {
    if (!isTvModeOpen || !isTvAutoPlay || patientChunks.length <= 1) return;
    const interval = setInterval(() => {
      setTvCurrentPage(prev => (prev + 1) % patientChunks.length);
    }, tvIntervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [isTvModeOpen, isTvAutoPlay, tvIntervalSeconds, patientChunks.length]);

  const handleTriggerPrint = () => {
    setIsPrintModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Export Pinboard schedule to CSV format for medical software / Excel integration
  const handleExportCSV = () => {
    if (!appointments || !patients) return;

    const exportPatients = getPrintPatients();
    const exportPatientIds = new Set(exportPatients.map(p => p.id));
    const relevantApts = appointments.filter(a => exportPatientIds.has(a.patient_id));

    // CSV Headers (semicolon delimited for German Excel compatibility)
    const headers = [
      "Datum",
      "Uhrzeit Start",
      "Uhrzeit Ende",
      "Dauer (Min)",
      "Patient Name",
      "SVN / SSN",
      "Geburtsdatum",
      "Behandlung / Notiz",
      "Therapeut",
      "Raum",
      "Status"
    ];

    const escapeCSV = (val: string | null | undefined) => {
      if (!val) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = relevantApts.map(apt => {
      const patient = patients.find(p => p.id === apt.patient_id);
      const start = new Date(apt.start_time);
      const end = new Date(apt.end_time);
      const duration = Math.round((end.getTime() - start.getTime()) / 60000);
      const titleName = apt.therapy_types?.name || apt.notes || "";
      const therapistName = apt.therapists?.profiles?.full_name || "";
      const roomName = apt.rooms?.name || "";

      return [
        format(start, "yyyy-MM-dd"),
        format(start, "HH:mm"),
        format(end, "HH:mm"),
        duration,
        escapeCSV(patient?.full_name),
        escapeCSV(patient?.ssn_svn),
        patient?.date_of_birth ? format(new Date(patient.date_of_birth), "yyyy-MM-dd") : "",
        escapeCSV(titleName),
        escapeCSV(therapistName),
        escapeCSV(roomName),
        escapeCSV(apt.status || "scheduled")
      ].join(";");
    });

    // sep=;\n header + UTF-8 BOM so Excel & Medizintechnik software open German characters & columns properly
    const csvContent = "\uFEFFsep=;\n" + headers.join(";") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `stecktafel_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("CSV Datei erfolgreich heruntergeladen!");
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
        
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          {/* TV Mode Button */}
          <Button
            variant="outline"
            onClick={() => {
              setTvCurrentPage(0);
              setIsTvModeOpen(true);
            }}
            className="bg-slate-900 text-white hover:bg-slate-800 border-slate-900 font-medium shadow-sm"
          >
            <Tv className="mr-2 h-4 w-4 text-emerald-400" />
            {t('pinboard.tvMode')}
          </Button>

          {/* Print / PDF Export Button */}
          <Button
            variant="outline"
            onClick={() => setIsPrintModalOpen(true)}
            className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-medium shadow-sm"
          >
            <Printer className="mr-2 h-4 w-4 text-blue-600" />
            {t('pinboard.print')}
          </Button>

          {/* Date Selector */}
          <div className="flex items-center gap-3 bg-white p-2 rounded-lg border shadow-sm">
            <CalendarIcon className="h-4 w-4 text-blue-500" />
            <Input 
              type="date" 
              value={dateStr}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="w-40 border-0 focus-visible:ring-0 p-0 text-slate-700 font-medium"
            />
          </div>
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
              <p>{t('pinboard.helpText')}</p>
            </div>
          </div>

          {/* Delete Dropzone (Trash) */}
          <div 
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropOnTrash}
            className="border-2 border-dashed border-red-200 hover:border-red-500 bg-red-50/50 hover:bg-red-50 p-4 rounded-xl text-center transition-colors shadow-sm group flex flex-col items-center justify-center gap-2"
          >
            <Trash2 className="h-6 w-6 text-red-400 group-hover:text-red-600 transition-colors animate-bounce" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-800">{t('pinboard.deleteBlock')}</p>
              <p className="text-[10px] text-slate-400">{t('pinboard.dragHereToDelete')}</p>
            </div>
          </div>

          {/* Fixed Daily Routines Block (Meal Times & Rest Breaks) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-xs">
                <Utensils className="h-4 w-4 text-amber-500" />
                {t('pinboard.fixedRoutinesTitle') || "Feste Tages-Routinen"}
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsNewRoutineOpen(!isNewRoutineOpen)}
                className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-full"
              >
                {isNewRoutineOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>

            <p className="text-[11px] text-slate-500 leading-tight">
              {t('pinboard.fixedRoutinesSubtitle') || "Feste Essens- und Ruhezeiten automatisch eintragen."}
            </p>

            {/* Inline creation form */}
            {isNewRoutineOpen && (
              <form onSubmit={handleCreateRoutine} className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200 space-y-2.5 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <Label htmlFor="routineName" className="text-xs">{t('pinboard.routineName') || "Routine Name"}</Label>
                  <Input 
                    id="routineName" 
                    value={newRoutineName} 
                    onChange={e => setNewRoutineName(e.target.value)} 
                    placeholder="z.B. Mittagessen"
                    className="h-7 text-xs bg-white"
                    autoFocus
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="routineStart" className="text-xs">{t('pinboard.routineStart') || "Beginn"}</Label>
                    <Input 
                      type="time" 
                      id="routineStart" 
                      value={newRoutineStart} 
                      onChange={e => setNewRoutineStart(e.target.value)} 
                      className="h-7 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="routineEnd" className="text-xs">{t('pinboard.routineEnd') || "Ende"}</Label>
                    <Input 
                      type="time" 
                      id="routineEnd" 
                      value={newRoutineEnd} 
                      onChange={e => setNewRoutineEnd(e.target.value)} 
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsNewRoutineOpen(false)} className="h-6 text-xs">
                    {t('pinboard.cancel')}
                  </Button>
                  <Button type="submit" size="sm" className="h-6 text-xs bg-amber-600 hover:bg-amber-700 text-white">
                    {t('pinboard.save')}
                  </Button>
                </div>
              </form>
            )}

            {/* List of active fixed routine rules */}
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
              {fixedRoutines.map(routine => (
                <div
                  key={routine.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50/50 hover:border-slate-200 transition-all group"
                  style={{ borderLeft: `4px solid ${routine.color}` }}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-800">{routine.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" /> {routine.startTime} - {routine.endTime}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteRoutine(routine.id)}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Auto-Apply Button */}
            <Button
              onClick={handleApplyFixedRoutines}
              className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-xs h-8 shadow-md gap-1.5 rounded-lg border-0 transition-all"
            >
              <Zap className="h-3.5 w-3.5 text-yellow-200 animate-pulse" />
              {t('pinboard.applyRoutines') || "⚡ Routinen eintragen"}
            </Button>
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
                      
                      {/* Workload Progress Bar */}
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
              const patientAppointments = appointments?.filter(apt => apt.patient_id === patientId) || [];

              return (
                <div 
                  key={colIdx} 
                  className="col-span-3 sm:col-span-3 relative border-l border-slate-100"
                  style={{ height: `${GRID_TOTAL_HEIGHT}px` }}
                >
                  {/* Grid cells backdrop */}
                  {TIME_SLOTS.map((time, idx) => (
                    <div 
                      key={idx}
                      onDragOver={e => e.preventDefault()}
                      onDrop={(e) => handleDropOnCell(e, patientId, time)}
                      className="border-b border-slate-100 hover:bg-blue-50/20 transition-colors"
                      style={{ height: `${ROW_HEIGHT}px` }}
                    />
                  ))}

                  {/* Absolute positioned scheduled cards */}
                  {patientId && patientAppointments.map(apt => {
                    const currentEndTime = tempResizedApts[apt.id] || apt.end_time;
                    const { top, height } = getCardLayout(apt.start_time, currentEndTime);
                    
                    const isStandardBlock = !apt.therapy_type_id;
                    const titleName = apt.therapy_types?.name || apt.notes || t('common.unknown');
                    
                    const matchedBlock = isStandardBlock 
                      ? standardBlocks.find(b => b.name.toLowerCase() === titleName.toLowerCase()) 
                      : null;
                    const blockColor = matchedBlock ? matchedBlock.color : "#94a3b8";

                    const cardColor = apt.therapy_types?.color || "#e0e7ff";
                    const cardTextColor = apt.therapy_types?.color ? "#ffffff" : "#1e293b";
                    const therapistName = apt.therapists?.profiles?.full_name || null;
                    const roomName = apt.rooms?.name || null;
                    const durationMins = Math.round((new Date(currentEndTime).getTime() - new Date(apt.start_time).getTime()) / 60000);

                    return (
                      <div
                        key={apt.id}
                        draggable
                        onDragStart={(e) => handleDragStartExisting(e, apt)}
                        className="absolute left-1.5 right-1.5 rounded-xl shadow-md border hover:shadow-xl hover:scale-[1.01] hover:z-20 transition-all cursor-grab active:cursor-grabbing p-1.5 px-2 overflow-hidden flex flex-col justify-start group"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: isStandardBlock ? (blockColor + "15") : cardColor,
                          borderLeft: `5px solid ${isStandardBlock ? blockColor : cardColor}`,
                          color: isStandardBlock ? "#1e293b" : cardTextColor,
                          borderColor: isStandardBlock ? (blockColor + "30") : "transparent"
                        }}
                      >
                        {height < 40 ? (
                          /* Compact layout for short duration appointments (15 min) */
                          <div className="flex flex-col justify-center h-full px-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs truncate leading-tight">{titleName}</span>
                              <span className="text-[10px] font-medium opacity-80 shrink-0">
                                {format(new Date(apt.start_time), "HH:mm")} - {format(new Date(currentEndTime), "HH:mm")}
                              </span>
                            </div>
                            {(therapistName || roomName) && (
                              <div className="text-[9px] opacity-90 truncate leading-none mt-0.5 font-medium">
                                {therapistName}{therapistName && roomName ? " • " : ""}{roomName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start gap-1">
                              <div className="flex flex-col truncate">
                                <span className="text-xs font-bold truncate leading-tight">
                                  {titleName}
                                </span>
                                <span className={`text-[10px] ${isStandardBlock ? "text-slate-500" : "text-white/90"} flex items-center gap-0.5 leading-none mt-0.5 font-medium`}>
                                  <Clock className="w-2.5 h-2.5 shrink-0" />
                                  {format(new Date(apt.start_time), "HH:mm")} - {format(new Date(currentEndTime), "HH:mm")} ({durationMins} Min)
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

                            {(therapistName || roomName) && (
                              <div className="flex items-center gap-1 mt-1 border-t pt-0.5 border-white/20 text-[9.5px] font-semibold truncate leading-tight">
                                {therapistName}{therapistName && roomName ? " • " : ""}{roomName}
                              </div>
                            )}
                          </>
                        )}

                        <div 
                          draggable={false}
                          onMouseDown={(e) => handleResizeStart(e, apt)}
                          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize flex items-center justify-center hover:bg-slate-500/20 group-hover:bg-slate-400/10 transition-colors z-30"
                        >
                          <div className="w-6 h-0.5 bg-slate-400/40 rounded-full group-hover:bg-slate-400/60" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Print / PDF Export Settings Modal */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className="sm:max-w-[620px] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Printer className="h-5 w-5 text-blue-600" />
              {t('pinboard.printModalTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('pinboard.printModalSubtitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Filter Scope Option */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-800">{t('pinboard.title')} Export Umfang</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  printScope === "scheduled" ? "border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm" : "border-slate-200 hover:bg-slate-50"
                }`}>
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="printScope" 
                      value="scheduled"
                      checked={printScope === "scheduled"}
                      onChange={() => setPrintScope("scheduled")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-medium">{t('pinboard.printFilterOnlyAppointments')}</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">
                    {appointments ? new Set(appointments.map(a => a.patient_id)).size : 0}
                  </span>
                </label>

                <label className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  printScope === "active" ? "border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm" : "border-slate-200 hover:bg-slate-50"
                }`}>
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="printScope" 
                      value="active"
                      checked={printScope === "active"}
                      onChange={() => setPrintScope("active")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-medium">{t('pinboard.printFilterAllActive')}</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 shrink-0">
                    {patients?.filter(p => p.is_active !== false && p.status !== "discharged").length || 0}
                  </span>
                </label>
              </div>
            </div>

            {/* Orientation Option */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-800">{t('pinboard.orientation')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrintOrientation("landscape")}
                  className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    printOrientation === "landscape" ? "border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-sm" : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {t('pinboard.landscape')}
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOrientation("portrait")}
                  className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    printOrientation === "portrait" ? "border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-sm" : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {t('pinboard.portrait')}
                </button>
              </div>
            </div>

            {/* Patients Per Page Option */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-800">{t('pinboard.patientsPerPage')}</Label>
              <select
                value={patientsPerPage}
                onChange={(e) => setPatientsPerPage(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value={2}>2 Patienten pro Seite (sehr groß)</option>
                <option value={3}>3 Patienten pro Seite (groß)</option>
                <option value={4}>4 Patienten pro Seite (sehr gut lesbar)</option>
                <option value={5}>5 Patienten pro Seite (Standard Querformat - 1 Blatt fit)</option>
                <option value={6}>6 Patienten pro Seite (kompakt)</option>
                <option value={8}>8 Patienten pro Seite (sehr kompakt)</option>
                <option value={10}>10 Patienten pro Seite (Übersicht)</option>
              </select>
            </div>

          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-t pt-4 mt-2">
            <Button 
              type="button"
              variant="outline" 
              onClick={handleExportCSV}
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 shrink-0"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
              {t('pinboard.exportCSV')}
            </Button>

            <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
              <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>
                {t('pinboard.cancel')}
              </Button>
              <Button onClick={handleTriggerPrint} className="bg-blue-600 hover:bg-blue-700">
                <Printer className="mr-2 h-4 w-4" />
                {t('pinboard.exportPDF')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dedicated Printable PDF Layout (Visible only in print media) */}
      <div id="printable-pinboard" className="hidden print:block">
        <style>{`
          @media print {
            @page {
              size: ${printOrientation};
              margin: 0;
            }
            html, body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: 100% !important;
              overflow: hidden !important;
            }
            body * {
              visibility: hidden !important;
            }
            #printable-pinboard, #printable-pinboard * {
              visibility: visible !important;
            }
            #printable-pinboard {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              z-index: 999999 !important;
            }
            .print-page-break {
              box-sizing: border-box !important;
              width: 100vw !important;
              height: 100vh !important;
              max-height: 100vh !important;
              padding: 4mm !important;
              overflow: hidden !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print-page-break:not(:last-child) {
              page-break-after: always !important;
              break-after: page !important;
            }
          }
        `}</style>

        {patientChunks.map((chunk, pageIdx) => (
          <div key={pageIdx} className="print-page-break p-2 bg-white text-slate-900 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex justify-between items-center border-b-2 border-slate-900 pb-1 mb-2">
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-slate-900">
                    {clinic?.name || "Clinic Harmony"} – {t('pinboard.dailyScheduleTitle')}
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {t('pinboard.date')}: {format(selectedDate, i18n.language.startsWith("en") ? "EEEE, MMMM dd, yyyy" : "EEEE, dd. MMMM yyyy", { locale: currentLocale })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 border border-slate-300 rounded">
                    {t('pinboard.page')} {pageIdx + 1} / {patientChunks.length}
                  </span>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    {t('pinboard.printedOn', { date: format(new Date(), i18n.language.startsWith("en") ? "MM/dd/yyyy HH:mm" : "dd.MM.yyyy HH:mm") })}
                  </p>
                </div>
              </div>

              {/* Patient Columns Grid Header & Grid */}
              <div className="border border-slate-400 rounded overflow-hidden">
                <div 
                  className="grid bg-slate-100 border-b border-slate-400 font-semibold text-xs py-1 text-center"
                  style={{ gridTemplateColumns: `55px repeat(${chunk.length}, 1fr)` }}
                >
                  <div className="border-r border-slate-400 text-slate-600 self-center uppercase text-[9px] tracking-wider font-bold">
                    {t('pinboard.time')}
                  </div>
                  {chunk.map((patient) => {
                    const workload = getPatientWorkload(patient.id);
                    const age = patient.date_of_birth ? differenceInYears(selectedDate, new Date(patient.date_of_birth)) : null;
                    return (
                      <div key={patient.id} className="border-r border-slate-400 px-2 py-0.5 text-left flex flex-col justify-between">
                        <div className="font-bold text-slate-900 text-xs truncate leading-tight">{patient.full_name}</div>
                        <div className="flex justify-between items-center text-[9px] text-slate-600 mt-0.5">
                          <span>{patient.ssn_svn || (age !== null ? `${age} ${t('pinboard.yearsOldShort')}` : "")}</span>
                          <span className="font-bold text-slate-900 bg-slate-200 px-1 rounded">{workload.text}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Printable Grid Body (Fills safely within 1 page height) */}
                <div className="relative" style={{ height: `${TIME_SLOTS.length * PRINT_ROW_HEIGHT}px` }}>
                  <div 
                    className="grid absolute inset-0"
                    style={{ gridTemplateColumns: `55px repeat(${chunk.length}, 1fr)` }}
                  >
                    <div className="border-r border-slate-300 bg-slate-50/50 flex flex-col">
                      {TIME_SLOTS.map((time, idx) => (
                        <div key={idx} className="border-b border-slate-200 text-[9px] font-semibold text-slate-600 text-center flex items-center justify-center" style={{ height: `${PRINT_ROW_HEIGHT}px` }}>
                          {time}
                        </div>
                      ))}
                    </div>
                    {chunk.map((patient) => (
                      <div key={patient.id} className="border-r border-slate-300 flex flex-col">
                        {TIME_SLOTS.map((_, idx) => (
                          <div key={idx} className="border-b border-slate-100" style={{ height: `${PRINT_ROW_HEIGHT}px` }} />
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Printable Appointment Cards */}
                  <div 
                    className="grid absolute inset-0 pointer-events-none"
                    style={{ gridTemplateColumns: `55px repeat(${chunk.length}, 1fr)` }}
                  >
                    <div />
                    {chunk.map((patient) => {
                      const patientApts = appointments?.filter(a => a.patient_id === patient.id) || [];
                      return (
                        <div key={patient.id} className="relative border-r border-transparent">
                          {patientApts.map(apt => {
                            const { top, height } = getPrintCardLayout(apt.start_time, apt.end_time);
                            const isStandardBlock = !apt.therapy_type_id;
                            const titleName = apt.therapy_types?.name || apt.notes || t('common.unknown');
                            const therapistName = apt.therapists?.profiles?.full_name;
                            const roomName = apt.rooms?.name;
                            const matchedBlock = isStandardBlock ? standardBlocks.find(b => b.name.toLowerCase() === titleName.toLowerCase()) : null;
                            const blockColor = matchedBlock ? matchedBlock.color : "#475569";

                            return (
                              <div
                                key={apt.id}
                                className="absolute left-0.5 right-0.5 rounded p-0.5 px-1 border overflow-hidden flex flex-col justify-start"
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                  backgroundColor: isStandardBlock ? (blockColor + "20") : (apt.therapy_types?.color ? (apt.therapy_types.color + "25") : "#e2e8f0"),
                                  borderColor: isStandardBlock ? blockColor : (apt.therapy_types?.color || "#64748b"),
                                  borderLeftWidth: "4px",
                                  color: "#0f172a"
                                }}
                              >
                                <div className="flex items-center justify-between gap-1 w-full min-w-0">
                                  <span className="font-bold text-[9px] truncate leading-tight text-slate-900">{titleName}</span>
                                  <span className="text-[8px] font-bold text-slate-800 bg-white/90 border border-slate-300 px-1 py-[1px] rounded leading-none shrink-0">
                                    {format(new Date(apt.start_time), "HH:mm")}-{format(new Date(apt.end_time), "HH:mm")}
                                  </span>
                                </div>
                                {(therapistName || roomName) && (
                                  <div className="text-[7.5px] text-slate-700 font-semibold truncate leading-tight mt-[1px]">
                                    {therapistName}{therapistName && roomName ? " • " : ""}{roomName}
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
          </div>
        ))}
      </div>

      {/* Fullscreen TV / Monitor Mode Overlay */}
      {isTvModeOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col p-6 overflow-hidden animate-in fade-in duration-300">
          {/* TV Top Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Monitor className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  {clinic?.name || "Clinic Harmony"} <span className="text-slate-500">•</span> {t('pinboard.tvTitle')}
                </h1>
                <p className="text-sm text-slate-400">
                  {t('pinboard.date')}: {format(selectedDate, i18n.language.startsWith("en") ? "EEEE, MMMM dd, yyyy" : "EEEE, dd. MMMM yyyy", { locale: currentLocale })}
                </p>
              </div>
            </div>

            {/* TV Playback Controls & Progress Indicator */}
            <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-xl border border-slate-800 shadow-xl">
              <span className="text-xs font-semibold text-slate-300 px-3 py-1 bg-slate-800 rounded-lg">
                {t('pinboard.page')} {tvCurrentPage + 1} / {Math.max(1, patientChunks.length)}
              </span>

              {/* Prev / Next controls */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTvCurrentPage(prev => (prev - 1 + patientChunks.length) % patientChunks.length)}
                  className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsTvAutoPlay(!isTvAutoPlay)}
                  className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-slate-800"
                  title={isTvAutoPlay ? "Pause" : "Play"}
                >
                  {isTvAutoPlay ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTvCurrentPage(prev => (prev + 1) % patientChunks.length)}
                  className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              {/* Interval Selector */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 border-l border-slate-800 pl-3">
                <span>{t('pinboard.tvInterval')}:</span>
                <select
                  value={tvIntervalSeconds}
                  onChange={(e) => setTvIntervalSeconds(Number(e.target.value))}
                  className="h-8 rounded-md bg-slate-800 border border-slate-700 px-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value={5}>5 {t('pinboard.seconds')}</option>
                  <option value={10}>10 {t('pinboard.seconds')}</option>
                  <option value={15}>15 {t('pinboard.seconds')}</option>
                  <option value={30}>30 {t('pinboard.seconds')}</option>
                </select>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsTvModeOpen(false)}
                className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg ml-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* TV Main Patient Grid Body */}
          {patientChunks.length > 0 && patientChunks[tvCurrentPage] ? (
            <div className="flex-1 border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden flex flex-col shadow-2xl">
              {/* Header Row */}
              <div 
                className="grid bg-slate-900 border-b border-slate-800 py-3 text-center"
                style={{ gridTemplateColumns: `80px repeat(${patientChunks[tvCurrentPage].length}, 1fr)` }}
              >
                <div className="border-r border-slate-800 text-slate-400 font-bold text-xs self-center uppercase tracking-wider">
                  {t('pinboard.time')}
                </div>
                {patientChunks[tvCurrentPage].map((patient) => {
                  const workload = getPatientWorkload(patient.id);
                  const age = patient.date_of_birth ? differenceInYears(selectedDate, new Date(patient.date_of_birth)) : null;
                  return (
                    <div key={patient.id} className="border-r border-slate-800 px-4 py-1 text-left flex flex-col justify-between">
                      <div className="font-extrabold text-white text-lg truncate tracking-tight">{patient.full_name}</div>
                      <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                        <span>{patient.ssn_svn || (age !== null ? `${age} ${t('pinboard.yearsOld')}` : "")}</span>
                        <span className="font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">{workload.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TV Grid Area */}
              <div className="flex-1 relative overflow-hidden">
                <div 
                  className="grid absolute inset-0"
                  style={{ gridTemplateColumns: `80px repeat(${patientChunks[tvCurrentPage].length}, 1fr)` }}
                >
                  <div className="border-r border-slate-800/80 bg-slate-950/40 flex flex-col">
                    {TIME_SLOTS.map((time, idx) => (
                      <div key={idx} className="border-b border-slate-800/50 text-xs font-semibold text-slate-400 text-center flex items-center justify-center" style={{ height: `${PRINT_ROW_HEIGHT * 1.15}px` }}>
                        {time}
                      </div>
                    ))}
                  </div>
                  {patientChunks[tvCurrentPage].map((patient) => (
                    <div key={patient.id} className="border-r border-slate-800/60 flex flex-col">
                      {TIME_SLOTS.map((_, idx) => (
                        <div key={idx} className="border-b border-slate-800/30" style={{ height: `${PRINT_ROW_HEIGHT * 1.15}px` }} />
                      ))}
                    </div>
                  ))}
                </div>

                {/* TV Cards */}
                <div 
                  className="grid absolute inset-0 pointer-events-none"
                  style={{ gridTemplateColumns: `80px repeat(${patientChunks[tvCurrentPage].length}, 1fr)` }}
                >
                  <div />
                  {patientChunks[tvCurrentPage].map((patient) => {
                    const patientApts = appointments?.filter(a => a.patient_id === patient.id) || [];
                    return (
                      <div key={patient.id} className="relative border-r border-transparent">
                        {patientApts.map(apt => {
                          const { top, height } = getPrintCardLayout(apt.start_time, apt.end_time);
                          const tvTop = top * 1.15;
                          const tvHeight = height * 1.15;
                          const isStandardBlock = !apt.therapy_type_id;
                          const titleName = apt.therapy_types?.name || apt.notes || t('common.unknown');
                          const therapistName = apt.therapists?.profiles?.full_name;
                          const roomName = apt.rooms?.name;
                          const matchedBlock = isStandardBlock ? standardBlocks.find(b => b.name.toLowerCase() === titleName.toLowerCase()) : null;
                          const blockColor = matchedBlock ? matchedBlock.color : "#38bdf8";

                          return (
                            <div
                              key={apt.id}
                              className="absolute left-1.5 right-1.5 rounded-xl p-2 border text-xs overflow-hidden flex flex-col justify-between shadow-lg backdrop-blur-sm"
                              style={{
                                top: `${tvTop}px`,
                                height: `${tvHeight}px`,
                                backgroundColor: isStandardBlock ? (blockColor + "30") : (apt.therapy_types?.color ? (apt.therapy_types.color + "40") : "#334155"),
                                borderColor: isStandardBlock ? blockColor : (apt.therapy_types?.color || "#64748b"),
                                borderLeftWidth: "6px",
                                color: "#ffffff"
                              }}
                            >
                              {tvHeight < 45 ? (
                                <div className="flex flex-col justify-center h-full px-0.5">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-xs truncate leading-tight text-white">{titleName}</span>
                                    <span className="text-[10px] font-semibold text-slate-300 shrink-0">
                                      {format(new Date(apt.start_time), "HH:mm")} - {format(new Date(apt.end_time), "HH:mm")}
                                    </span>
                                  </div>
                                  {(therapistName || roomName) && (
                                    <div className="text-[10px] text-slate-300 truncate leading-none mt-0.5">
                                      {therapistName}{therapistName && roomName ? " • " : ""}{roomName}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <div className="flex justify-between items-start">
                                    <span className="font-bold text-sm text-white truncate">{titleName}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-slate-200">
                                      {format(new Date(apt.start_time), "HH:mm")} - {format(new Date(apt.end_time), "HH:mm")}
                                    </span>
                                  </div>
                                  {(therapistName || roomName) && (
                                    <div className="flex flex-wrap gap-1 mt-1 border-t border-white/10 pt-1">
                                      {therapistName && (
                                        <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded">
                                          {therapistName}
                                        </span>
                                      )}
                                      {roomName && (
                                        <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded">
                                          {roomName}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </>
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
          ) : null}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2, Trash2, CalendarIcon, Clock, CheckCircle2, AlertTriangle, XCircle, Info, Wrench } from "lucide-react";
import { toast } from "sonner";
import { format, isWithinInterval, parseISO } from "date-fns";
import type { Appointment, Therapist, Room, Equipment, TherapyType } from "@/types";
import { supabase } from "@/lib/supabase";
import { checkAppointmentConflicts } from "@/services/scheduling";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const appointmentSchema = (t: any) => z.object({
  patient_id: z.string().min(1, t('common.required')),
  therapist_id: z.string().min(1, t('common.required')),
  therapy_type_id: z.string().optional(),
  room_id: z.string().optional(),
  start_date: z.string().min(1, t('common.required')),
  start_time: z.string().min(1, t('common.required')),
  end_time: z.string().min(1, t('common.required')),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).default('scheduled'),
  notes: z.string().optional(),
  required_equipment_ids: z.array(z.string()).default([]),
});

type AppointmentFormValues = z.infer<ReturnType<typeof appointmentSchema>>;

interface EventDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeClinicId: string | null;
  selectedAppointment: Appointment | null;
  selectedSlot: { start: Date; end: Date } | null;
}

export function EventDialog({
  isOpen,
  onOpenChange,
  activeClinicId,
  selectedAppointment,
  selectedSlot,
}: EventDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showAllRooms, setShowAllRooms] = useState(false);

  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema(t)),
    defaultValues: {
      patient_id: "",
      therapist_id: "",
      therapy_type_id: "",
      room_id: "",
      start_date: format(new Date(), "yyyy-MM-dd"),
      start_time: "09:00",
      end_time: "10:00",
      status: "scheduled",
      notes: "",
      required_equipment_ids: [],
    }
  });

  const watchTherapyTypeId = watch("therapy_type_id");
  const watchStartDate = watch("start_date");
  const watchStartTime = watch("start_time");
  const watchEndTime = watch("end_time");
  const watchRoomId = watch("room_id");
  const watchRequiredEquipmentIds = watch("required_equipment_ids");

  // Fetch relations for dropdowns
  const { data: patients } = useQuery({
    queryKey: ["patients", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("patients").select("*").eq("clinic_id", activeClinicId).order("full_name");
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const { data: therapists } = useQuery({
    queryKey: ["therapists", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("therapists").select("*, profiles(full_name)").eq("clinic_id", activeClinicId);
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const { data: rooms } = useQuery({
    queryKey: ["rooms-extended", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase
        .from("rooms")
        .select("*, room_equipment(equipment(*))")
        .eq("clinic_id", activeClinicId)
        .order("name");
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const { data: therapyTypes } = useQuery({
    queryKey: ["therapyTypes-extended", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase
        .from("therapy_types")
        .select("*, therapy_type_equipment(equipment(*))")
        .eq("clinic_id", activeClinicId)
        .order("name");
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const { data: allAppointments } = useQuery({
    queryKey: ["appointments-all", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("appointments").select("id, room_id, start_time, end_time").eq("clinic_id", activeClinicId);
      return data || [];
    },
    enabled: !!activeClinicId && isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      if (selectedAppointment) {
        const start = new Date(selectedAppointment.start_time);
        const end = new Date(selectedAppointment.end_time);
        reset({
          patient_id: selectedAppointment.patient_id,
          therapist_id: selectedAppointment.therapist_id,
          therapy_type_id: selectedAppointment.therapy_type_id || "",
          room_id: selectedAppointment.room_id || "",
          start_date: format(start, "yyyy-MM-dd"),
          start_time: format(start, "HH:mm"),
          end_time: format(end, "HH:mm"),
          status: selectedAppointment.status as any,
          notes: selectedAppointment.notes || "",
          required_equipment_ids: selectedAppointment.required_equipment_ids || [],
        });
      } else if (selectedSlot) {
        reset({
          patient_id: "",
          therapist_id: "",
          therapy_type_id: "",
          room_id: "",
          start_date: format(selectedSlot.start, "yyyy-MM-dd"),
          start_time: format(selectedSlot.start, "HH:mm"),
          end_time: format(selectedSlot.end, "HH:mm"),
          status: "scheduled",
          notes: "",
          required_equipment_ids: [],
        });
      }
    }
  }, [isOpen, selectedAppointment, selectedSlot, reset]);

  // Update required equipment when therapy type changes
  useEffect(() => {
    if (watchTherapyTypeId && therapyTypes) {
      const type = therapyTypes.find(t => t.id === watchTherapyTypeId);
      if (type) {
        const equipIds = type.therapy_type_equipment?.map((te: any) => te.equipment?.id).filter(Boolean) || [];
        setValue("required_equipment_ids", equipIds);
      }
    }
  }, [watchTherapyTypeId, therapyTypes, setValue]);

  // Room availability logic
  const roomStatuses = useMemo(() => {
    if (!rooms || !allAppointments || !watchStartDate || !watchStartTime || !watchEndTime) return {};

    const start = new Date(`${watchStartDate}T${watchStartTime}`);
    const end = new Date(`${watchStartDate}T${watchEndTime}`);

    const statuses: Record<string, { status: 'green' | 'orange' | 'red'; reason?: string; missingEquipment?: string[] }> = {};

    rooms.forEach(room => {
      // 1. Check if occupied
      const isOccupied = allAppointments.some(apt => {
        if (apt.room_id !== room.id) return false;
        if (selectedAppointment && apt.id === selectedAppointment.id) return false;
        
        const aptStart = parseISO(apt.start_time);
        const aptEnd = parseISO(apt.end_time);
        
        return (start < aptEnd && end > aptStart);
      });

      if (isOccupied) {
        statuses[room.id] = { status: 'red', reason: t('calendar.messages.roomOccupied') || 'Besetzt' };
        return;
      }

      // 2. Check equipment requirements
      const roomEquipment = room.room_equipment?.map((re: any) => re.equipment) || [];
      const roomEquipmentIds = roomEquipment.map((e: any) => e.id);
      
      const missingEquipment = watchRequiredEquipmentIds.filter(id => !roomEquipmentIds.includes(id));
      
      if (missingEquipment.length > 0) {
        const names = missingEquipment.map(id => {
          // Find name from therapy types or equipment list
          return equipmentList?.find(e => e.id === id)?.name || id;
        });
        statuses[room.id] = { status: 'red', reason: t('equipment.scheduling.warningMissing', { name: names.join(", ") }), missingEquipment: names };
        return;
      }

      // 3. Check for maintenance
      const requiredInMaintenance = roomEquipment.filter((e: any) => 
        watchRequiredEquipmentIds.includes(e.id) && e.status === 'maintenance'
      );

      if (requiredInMaintenance.length > 0) {
        const names = requiredInMaintenance.map((e: any) => e.name);
        statuses[room.id] = { status: 'orange', reason: t('equipment.scheduling.warningMaintenance', { name: names.join(", ") }) };
        return;
      }

      // 4. Default to green
      statuses[room.id] = { status: 'green' };
    });

    return statuses;
  }, [rooms, allAppointments, watchStartDate, watchStartTime, watchEndTime, watchRequiredEquipmentIds, selectedAppointment, t]);

  const saveMutation = useMutation({
    mutationFn: async (values: AppointmentFormValues) => {
      if (!activeClinicId) throw new Error(t('patients.messages.selectClinic'));

      const startDateTime = new Date(`${values.start_date}T${values.start_time}`);
      const endDateTime = new Date(`${values.start_date}T${values.end_time}`);

      // Check for conflicts
      const conflict = await checkAppointmentConflicts(
        activeClinicId,
        startDateTime,
        endDateTime,
        values.therapist_id,
        values.room_id === "none" ? null : values.room_id,
        selectedAppointment?.id
      );

      if (conflict.hasConflict) {
        throw new Error(conflict.message);
      }

      // Extra check for equipment if room is selected
      if (values.room_id && values.room_id !== "none") {
        const roomStatus = roomStatuses[values.room_id];
        if (roomStatus && (roomStatus.status === 'red' || roomStatus.status === 'orange')) {
          throw new Error(roomStatus.reason);
        }
      }

      const aptData = {
        clinic_id: activeClinicId,
        patient_id: values.patient_id,
        therapist_id: values.therapist_id,
        therapy_type_id: values.therapy_type_id === "none" ? null : (values.therapy_type_id || null),
        room_id: values.room_id === "none" ? null : (values.room_id || null),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: values.status,
        notes: values.notes,
        required_equipment_ids: values.required_equipment_ids,
      };

      if (selectedAppointment) {
        const { error } = await supabase.from("appointments").update(aptData).eq("id", selectedAppointment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("appointments").insert([aptData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(selectedAppointment ? t('calendar.messages.successUpdate') : t('calendar.messages.successCreate'));
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('calendar.messages.errorSave'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAppointment) return;
      const { error } = await supabase.from("appointments").delete().eq("id", selectedAppointment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(t('calendar.messages.successDelete'));
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error.");
    }
  });

  const onSubmit = (data: AppointmentFormValues) => {
    saveMutation.mutate(data);
  };

  const handleRoomClick = (roomId: string) => {
    const status = roomStatuses[roomId];
    if (status?.status === 'red' || status?.status === 'orange') {
      toast.error(status.reason, {
        icon: status.status === 'orange' ? <AlertTriangle className="h-4 w-4 text-orange-500" /> : <XCircle className="h-4 w-4 text-red-500" />
      });
      return;
    }
    setValue("room_id", roomId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] overflow-y-auto max-h-[90vh]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="text-xl text-blue-800">
              {selectedAppointment ? t('calendar.eventDetails') : t('calendar.newEvent')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Personell Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('calendar.form.patient')}</Label>
                <Controller
                  name="patient_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('calendar.form.patientSelect')}>
                          {patients?.find(p => p.id === field.value)?.full_name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {patients?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.patient_id && <p className="text-xs text-red-500">{errors.patient_id.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>{t('calendar.form.therapist')}</Label>
                <Controller
                  name="therapist_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('calendar.form.therapistSelect')}>
                          {therapists?.find((t: any) => t.id === field.value)?.profiles?.full_name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {therapists?.map((t: Therapist) => (
                          <SelectItem key={t.id} value={t.id}>{t.profiles?.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.therapist_id && <p className="text-xs text-red-500">{errors.therapist_id.message}</p>}
              </div>
            </div>

            {/* Time Row */}
            <div className="grid grid-cols-3 gap-4 border-y border-slate-100 py-4 bg-slate-50/50 -mx-6 px-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> {t('calendar.form.date')}</Label>
                <Input type="date" {...register("start_date")} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="w-3 h-3"/> {t('calendar.form.from')}</Label>
                <Input type="time" {...register("start_time")} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="w-3 h-3"/> {t('calendar.form.to')}</Label>
                <Input type="time" {...register("end_time")} className="bg-white" />
              </div>
            </div>

            {/* Therapy Type Row */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>{t('calendar.form.therapyType')}</Label>
                <Controller
                  name="therapy_type_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('calendar.form.therapyTypeSelect')}>
                          {therapyTypes?.find(t => t.id === field.value)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-slate-400">{t('calendar.form.none')}</SelectItem>
                        {therapyTypes?.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="flex items-center">
                            <div className="flex items-center w-full">
                              <div className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: t.color }} />
                              {t.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              
              {/* Required Equipment Badges */}
              {watchRequiredEquipmentIds.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center">
                    <Wrench className="h-3 w-3 mr-1" /> {t('equipment.scheduling.required')}:
                  </span>
                  {watchRequiredEquipmentIds.map(id => {
                    const name = therapyTypes?.flatMap(t => t.therapy_type_equipment || []).find((te: any) => te.equipment?.id === id)?.equipment?.name || id;
                    return <Badge key={id} variant="secondary" className="text-[10px]">{name}</Badge>;
                  })}
                </div>
              )}
            </div>

            {/* Smart Room Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center">
                  {t('calendar.form.room')}
                  {watchRoomId && watchRoomId !== 'none' && (
                    <Badge variant="success" className="ml-2 scale-90">
                      {rooms?.find(r => r.id === watchRoomId)?.name}
                    </Badge>
                  )}
                </Label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500">{t('equipment.scheduling.seeAll')}</span>
                  <Switch checked={showAllRooms} onCheckedChange={setShowAllRooms} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={watchRoomId === "none" ? "default" : "outline"}
                  className="justify-start h-12"
                  onClick={() => setValue("room_id", "none")}
                >
                  <span className="text-xs truncate">{t('calendar.form.none')}</span>
                </Button>

                {rooms?.map((room) => {
                  const status = roomStatuses[room.id] || { status: 'green' };
                  const isSelected = watchRoomId === room.id;
                  
                  if (!showAllRooms && status.status === 'red' && !isSelected) return null;

                  return (
                    <Button
                      key={room.id}
                      type="button"
                      variant="outline"
                      className={cn(
                        "justify-start h-auto py-2 px-3 flex flex-col items-start gap-1 relative overflow-hidden transition-all",
                        isSelected && "ring-2 ring-blue-600 bg-blue-50 border-blue-200",
                        !isSelected && status.status === 'green' && "hover:border-emerald-200 hover:bg-emerald-50",
                        !isSelected && status.status === 'orange' && "border-orange-200 bg-orange-50/30 opacity-80",
                        !isSelected && status.status === 'red' && "border-red-100 bg-red-50/30 opacity-60 grayscale-[0.5]"
                      )}
                      onClick={() => handleRoomClick(room.id)}
                    >
                      <div className="flex items-center w-full justify-between">
                        <span className={cn("text-xs font-bold", isSelected ? "text-blue-700" : "text-slate-900")}>
                          {room.name}
                        </span>
                        {status.status === 'green' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                        {status.status === 'orange' && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                        {status.status === 'red' && <XCircle className="h-3 w-3 text-red-400" />}
                      </div>
                      
                      {status.reason && (
                        <span className="text-[9px] text-slate-500 leading-tight text-left line-clamp-1">
                          {status.reason}
                        </span>
                      )}
                      
                      {/* Visual indicator bar at bottom */}
                      <div className={cn(
                        "absolute bottom-0 left-0 right-0 h-1",
                        status.status === 'green' ? "bg-emerald-500" : 
                        status.status === 'orange' ? "bg-orange-500" : "bg-red-400"
                      )} />
                    </Button>
                  );
                })}
              </div>
            </div>

             <div className="space-y-2 border-t pt-4">
              <Label>{t('calendar.form.status')}</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                     <SelectContent>
                      <SelectItem value="scheduled">{t('calendar.status.scheduled')}</SelectItem>
                      <SelectItem value="confirmed">{t('calendar.status.confirmed')}</SelectItem>
                      <SelectItem value="in_progress">{t('calendar.status.in_progress')}</SelectItem>
                      <SelectItem value="completed">{t('calendar.status.completed')}</SelectItem>
                      <SelectItem value="cancelled">{t('calendar.status.cancelled')}</SelectItem>
                      <SelectItem value="no_show">{t('calendar.status.no_show')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

             <div className="space-y-2">
              <Label>{t('calendar.form.notes')}</Label>
              <Textarea {...register("notes")} placeholder={t('calendar.form.notesPlaceholder')} className="resize-none h-20" />
            </div>

          </div>

          <DialogFooter className="flex items-center justify-between border-t pt-6">
            {selectedAppointment ? (
              <Button 
                type="button" 
                variant="destructive" 
                 onClick={() => {
                  if (confirm(t('calendar.messages.confirmDelete'))) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                 {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                {t('common.delete')}
              </Button>
            ) : (
              <div /> // Placeholder for spacing
            )}
            
             <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 min-w-[100px]">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

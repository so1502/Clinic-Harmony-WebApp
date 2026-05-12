import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2, Trash2, CalendarIcon, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type {  Appointment, Therapist  } from "@/types";
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
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

interface EventDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeClinicId: string | null;
  selectedAppointment: Appointment | null; // existing appointment
  selectedSlot: { start: Date; end: Date } | null; // clicked empty slot
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

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<any>({
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
    }
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
        });
      } else {
        reset({
          patient_id: "",
          therapist_id: "",
          therapy_type_id: "",
          room_id: "",
          start_date: format(new Date(), "yyyy-MM-dd"),
          start_time: "09:00",
          end_time: "10:00",
          status: "scheduled",
          notes: "",
        });
      }
    }
  }, [isOpen, selectedAppointment, selectedSlot, reset]);

  // Fetch relations for dropdowns
  const { data: patients } = useQuery({
    queryKey: ["patients", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("patients").select("*").eq("clinic_id", activeClinicId);
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
    queryKey: ["rooms", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("rooms").select("*").eq("clinic_id", activeClinicId);
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const { data: therapyTypes } = useQuery({
    queryKey: ["therapyTypes", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("therapy_types").select("*").eq("clinic_id", activeClinicId);
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: AppointmentFormValues) => {
      if (!activeClinicId) throw new Error(t('patients.messages.selectClinic'));

      const startDateTime = new Date(`${values.start_date}T${values.start_time}`);
      const endDateTime = new Date(`${values.start_date}T${values.end_time}`);

      // Step 5: Check for conflicts
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
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
                        <SelectValue>
                          {patients?.find(p => p.id === field.value)?.full_name || t('calendar.form.patientSelect')}
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
                        <SelectValue>
                          {therapists?.find((t: any) => t.id === field.value)?.profiles?.full_name || t('calendar.form.therapistSelect')}
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
            <div className="grid grid-cols-3 gap-4 border-y border-slate-100 py-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> {t('calendar.form.date')}</Label>
                <Input type="date" {...register("start_date")} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="w-3 h-3"/> {t('calendar.form.from')}</Label>
                <Input type="time" {...register("start_time")} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="w-3 h-3"/> {t('calendar.form.to')}</Label>
                <Input type="time" {...register("end_time")} />
              </div>
            </div>

            {/* Details Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('calendar.form.therapyType')}</Label>
                <Controller
                  name="therapy_type_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <SelectTrigger>
                        <SelectValue>
                          {therapyTypes?.find(t => t.id === field.value)?.name || t('calendar.form.therapyTypeSelect')}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-slate-400">{t('calendar.form.none')}</SelectItem>
                        {therapyTypes?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

               <div className="space-y-2">
                <Label>{t('calendar.form.room')}</Label>
                <Controller
                  name="room_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <SelectTrigger>
                        <SelectValue>
                          {rooms?.find(r => r.id === field.value)?.name || t('calendar.form.roomSelect')}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-slate-400">{t('calendar.form.none')}</SelectItem>
                        {rooms?.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

             <div className="space-y-2">
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

          <DialogFooter className="flex items-center justify-between">
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
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
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

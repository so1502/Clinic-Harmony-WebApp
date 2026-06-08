import { useState, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import withDragAndDropModule from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/de';
import { useTranslation } from 'react-i18next';
import type {  Appointment  } from "@/types";
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { checkAppointmentConflicts } from '@/services/scheduling';

// Import styles
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const localizer = momentLocalizer(moment);
const withDragAndDrop = (withDragAndDropModule as any).default || withDragAndDropModule;
const DnDCalendar = withDragAndDrop(Calendar);

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
}

interface CalendarViewProps {
  appointments: Appointment[]; 
  activeClinicId: string | null;
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
}

export function CalendarView({ appointments, activeClinicId, onSelectEvent, onSelectSlot }: CalendarViewProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  // Set moment locale based on i18next language
  useMemo(() => {
    moment.locale(i18n.language);
  }, [i18n.language]);

  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());

  // Map our Appointment type to react-big-calendar Event type
  const events: CalendarEvent[] = useMemo(() => {
    return appointments.map((apt) => ({
      id: apt.id,
      title: `${apt.patients?.full_name || t('common.unknown')} - ${apt.therapy_types?.name || apt.notes || t('calendar.form.none')}`,
      start: new Date(apt.start_time),
      end: new Date(apt.end_time),
      resource: apt,
    }));
  }, [appointments, t]);

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, start, end, therapist_id, room_id }: { id: string; start: Date; end: Date; therapist_id: string; room_id: string | null }) => {
      if (!activeClinicId) throw new Error(t('patients.messages.selectClinic'));

      // Check for conflicts
      const conflict = await checkAppointmentConflicts(
        activeClinicId,
        start,
        end,
        therapist_id,
        room_id,
        id
      );

      if (conflict.hasConflict) {
        throw new Error(conflict.message);
      }

      const { error } = await supabase
        .from('appointments')
        .update({
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success(t('calendar.messages.successUpdate'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('calendar.messages.errorSave'));
    }
  });

  const onEventDrop = useCallback(
    ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
      if (!activeClinicId) return;
      updateAppointmentMutation.mutate({ 
        id: event.id, 
        start, 
        end, 
        therapist_id: event.resource.therapist_id,
        room_id: event.resource.room_id
      });
    },
    [updateAppointmentMutation, activeClinicId]
  );

  const onEventResize = useCallback(
    ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
      if (!activeClinicId) return;
      updateAppointmentMutation.mutate({ 
        id: event.id, 
        start, 
        end, 
        therapist_id: event.resource.therapist_id,
        room_id: event.resource.room_id
      });
    },
    [updateAppointmentMutation, activeClinicId]
  );

  const eventStyleGetter = (event: CalendarEvent) => {
    const therapyColor = event.resource?.therapy_types?.color || '#3b82f6';
    const style = {
      backgroundColor: therapyColor,
      borderRadius: '6px',
      opacity: 0.9,
      color: 'white',
      border: '0px',
      display: 'block',
      padding: '2px 6px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      transition: 'all 0.2s',
      fontWeight: 500,
      fontSize: '0.8rem',
    };
    return { style };
  };

  return (
    <div className="h-[750px] w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <DnDCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        view={view}
        date={date}
        onNavigate={setDate}
        onView={setView}
        onEventDrop={onEventDrop}
        onEventResize={onEventResize}
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        resizable
        selectable
        step={15}
        timeslots={4}
        defaultView={Views.WEEK}
        min={new Date(0, 0, 0, 7, 0, 0)} // Starts at 7 AM
        max={new Date(0, 0, 0, 20, 0, 0)} // Ends at 8 PM
        messages={{
          today: t('calendar.messages.today'),
          previous: t('calendar.messages.previous'),
          next: t('calendar.messages.next'),
          month: t('calendar.messages.month'),
          week: t('calendar.messages.week'),
          day: t('calendar.messages.day'),
          agenda: t('calendar.messages.agenda'),
          date: t('calendar.messages.date'),
          time: t('calendar.messages.time'),
          event: t('calendar.messages.event'),
          noEventsInRange: t('calendar.messages.noEventsInRange'),
        }}
        eventPropGetter={eventStyleGetter}
        className="font-sans text-slate-700"
      />
    </div>
  );
}

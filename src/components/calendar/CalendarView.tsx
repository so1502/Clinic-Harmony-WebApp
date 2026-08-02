import { useState, useCallback, useMemo, useEffect } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import withDragAndDropModule from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
// @ts-ignore
import 'moment/locale/de';
import { useTranslation } from 'react-i18next';
import type { Appointment } from "@/types";
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { checkAppointmentConflicts } from '@/services/scheduling';
import { 
  Filter, 
  FilterX, 
  User, 
  Home, 
  Layers, 
  Sparkles, 
  Clock, 
  Calendar as CalendarIcon,
  ChevronRight,
  X,
  UserCheck,
  Building2,
  Stethoscope
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  isCluster?: boolean;
  clusterAppointments?: Appointment[];
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
  useEffect(() => {
    moment.locale(i18n.language);
  }, [i18n.language]);

  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());

  // Filter States
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>("all");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [selectedTherapyTypeId, setSelectedTherapyTypeId] = useState<string>("all");
  const [isClusterMode, setIsClusterMode] = useState<boolean>(true);

  // Cluster Modal State
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);
  const [clusterModalData, setClusterModalData] = useState<{
    start: Date;
    end: Date;
    appointments: Appointment[];
  } | null>(null);

  // Fetch dropdown filter options
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
      const { data } = await supabase.from("rooms").select("*").eq("clinic_id", activeClinicId).order("name");
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const { data: therapyTypes } = useQuery({
    queryKey: ["therapyTypes", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data } = await supabase.from("therapy_types").select("*").eq("clinic_id", activeClinicId).order("name");
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  // Filter appointments based on dropdown criteria
  const filteredAppointments = useMemo(() => {
    if (!Array.isArray(appointments)) return [];
    return appointments.filter((apt) => {
      if (!apt || !apt.start_time || !apt.end_time) return false;
      if (selectedTherapistId !== "all" && String(apt.therapist_id) !== String(selectedTherapistId)) return false;
      if (selectedRoomId !== "all" && String(apt.room_id) !== String(selectedRoomId)) return false;
      if (selectedTherapyTypeId !== "all" && String(apt.therapy_type_id) !== String(selectedTherapyTypeId)) return false;
      return true;
    });
  }, [appointments, selectedTherapistId, selectedRoomId, selectedTherapyTypeId]);

  // Transform appointments to CalendarEvent objects (with clustering when >= 3 parallel sessions exist)
  const events: CalendarEvent[] = useMemo(() => {
    if (!filteredAppointments.length) return [];

    if (!isClusterMode) {
      // Normal 1-to-1 event mapping
      return filteredAppointments.map((apt) => ({
        id: apt.id,
        title: `${apt.patients?.full_name || t('common.unknown')} - ${apt.therapy_types?.name || apt.notes || t('calendar.form.none')}`,
        start: new Date(apt.start_time),
        end: new Date(apt.end_time),
        resource: apt,
      }));
    }

    // Group overlapping appointments by start & end time slot
    const groups: { [key: string]: Appointment[] } = {};
    filteredAppointments.forEach((apt) => {
      const key = `${apt.start_time}_${apt.end_time}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(apt);
    });

    const resultEvents: CalendarEvent[] = [];

    Object.entries(groups).forEach(([key, groupApts]) => {
      if (groupApts.length >= 3) {
        // Create an aggregated Cluster Event Capsule
        const start = new Date(groupApts[0].start_time);
        const end = new Date(groupApts[0].end_time);

        resultEvents.push({
          id: `cluster-${key}`,
          title: `⚡ ${groupApts.length} ${t('pinboard.scheduledHours') || 'Parallele Termine'}`,
          start,
          end,
          isCluster: true,
          clusterAppointments: groupApts,
          resource: groupApts[0],
        });
      } else {
        // Render 1-2 overlapping appointments normally
        groupApts.forEach((apt) => {
          resultEvents.push({
            id: apt.id,
            title: `${apt.patients?.full_name || t('common.unknown')} - ${apt.therapy_types?.name || apt.notes || t('calendar.form.none')}`,
            start: new Date(apt.start_time),
            end: new Date(apt.end_time),
            resource: apt,
          });
        });
      }
    });

    return resultEvents;
  }, [filteredAppointments, isClusterMode, t]);

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, start, end, therapist_id, patient_id, room_id }: { id: string; start: Date; end: Date; therapist_id: string; patient_id: string; room_id: string | null }) => {
      if (!activeClinicId) throw new Error(t('patients.messages.selectClinic'));

      const conflict = await checkAppointmentConflicts(
        activeClinicId,
        start,
        end,
        therapist_id,
        patient_id,
        room_id,
        id
      );

      if (conflict.hasConflict) {
        throw new Error(conflict.message);
      }

      const { data, error } = await supabase
        .from('appointments')
        .update({
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        })
        .eq('id', id)
        .select();
      
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(t('calendar.messages.unauthorizedUpdate'));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-all'] });
      toast.success(t('calendar.messages.successUpdate'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('calendar.messages.errorSave'));
    }
  });

  const onEventDrop = useCallback(
    ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
      if (!activeClinicId || event.isCluster) return;
      updateAppointmentMutation.mutate({ 
        id: event.id, 
        start, 
        end, 
        therapist_id: event.resource.therapist_id,
        patient_id: event.resource.patient_id,
        room_id: event.resource.room_id
      });
    },
    [updateAppointmentMutation, activeClinicId]
  );

  const onEventResize = useCallback(
    ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
      if (!activeClinicId || event.isCluster) return;
      updateAppointmentMutation.mutate({ 
        id: event.id, 
        start, 
        end, 
        therapist_id: event.resource.therapist_id,
        patient_id: event.resource.patient_id,
        room_id: event.resource.room_id
      });
    },
    [updateAppointmentMutation, activeClinicId]
  );

  const handleEventClick = (event: CalendarEvent) => {
    if (event.isCluster && event.clusterAppointments) {
      setClusterModalData({
        start: event.start,
        end: event.end,
        appointments: event.clusterAppointments,
      });
      setIsClusterModalOpen(true);
    } else if (onSelectEvent) {
      onSelectEvent(event);
    }
  };

  const hasActiveFilters = selectedTherapistId !== "all" || selectedRoomId !== "all" || selectedTherapyTypeId !== "all";

  const clearFilters = () => {
    setSelectedTherapistId("all");
    setSelectedRoomId("all");
    setSelectedTherapyTypeId("all");
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    if (event.isCluster) {
      return {
        style: {
          background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)',
          borderRadius: '8px',
          opacity: 0.95,
          color: 'white',
          border: '1px solid rgba(255,255,255,0.3)',
          display: 'block',
          padding: '3px 8px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
          fontWeight: 700,
          fontSize: '0.82rem',
          cursor: 'pointer',
        }
      };
    }

    const therapyColor = event.resource?.therapy_types?.color || '#3b82f6';
    return {
      style: {
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
      }
    };
  };

  return (
    <div className="space-y-4">
      {/* Filter Toolbar & Capsule Mode Control */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200 shadow-sm backdrop-blur-sm">
        {/* Left Filter Group */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mr-1">
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span>Filter:</span>
          </div>

          {/* Therapist Filter */}
          <Select value={selectedTherapistId} onValueChange={setSelectedTherapistId}>
            <SelectTrigger className="h-8 text-xs w-[170px] bg-white border-slate-200 truncate">
              <User className="h-3.5 w-3.5 mr-1.5 text-slate-500 shrink-0" />
              <SelectValue>
                {selectedTherapistId === "all"
                  ? (t('calendar.allTherapists') || t('pinboard.allTherapists') || 'Alle Therapeuten')
                  : (therapists?.find((tItem: any) => String(tItem.id) === String(selectedTherapistId))?.profiles?.full_name || "Therapeut")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('calendar.allTherapists') || t('pinboard.allTherapists') || 'Alle Therapeuten'}</SelectItem>
              {therapists?.map((tItem: any) => (
                <SelectItem key={tItem.id} value={tItem.id}>
                  {tItem.profiles?.full_name || "Therapeut"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Room Filter */}
          <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
            <SelectTrigger className="h-8 text-xs w-[150px] bg-white border-slate-200 truncate">
              <Home className="h-3.5 w-3.5 mr-1.5 text-slate-500 shrink-0" />
              <SelectValue>
                {selectedRoomId === "all"
                  ? (t('calendar.allRooms') || t('pinboard.allRooms') || 'Alle Räume')
                  : (rooms?.find((r: any) => String(r.id) === String(selectedRoomId))?.name || "Raum")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('calendar.allRooms') || t('pinboard.allRooms') || 'Alle Räume'}</SelectItem>
              {rooms?.map((r: any) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Therapy Type Filter */}
          <Select value={selectedTherapyTypeId} onValueChange={setSelectedTherapyTypeId}>
            <SelectTrigger className="h-8 text-xs w-[170px] bg-white border-slate-200 truncate">
              <Stethoscope className="h-3.5 w-3.5 mr-1.5 text-slate-500 shrink-0" />
              <SelectValue>
                {selectedTherapyTypeId === "all"
                  ? (t('calendar.allTherapies') || t('pinboard.allTherapies') || 'Alle Therapien')
                  : (therapyTypes?.find((tt: any) => String(tt.id) === String(selectedTherapyTypeId))?.name || "Therapie")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('calendar.allTherapies') || t('pinboard.allTherapies') || 'Alle Therapien'}</SelectItem>
              {therapyTypes?.map((tt: any) => (
                <SelectItem key={tt.id} value={tt.id}>
                  {tt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg px-2 gap-1"
            >
              <FilterX className="h-3.5 w-3.5" />
              {t('calendar.clearFilters') || t('pinboard.clearFilters') || 'Filter zurücksetzen'}
            </Button>
          )}
        </div>

        {/* Right Controls: Cluster Mode Toggle & Total Counter */}
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-white text-slate-600 font-medium text-xs py-1 px-2.5 shadow-sm border-slate-200">
            {filteredAppointments.length} {t('calendar.filterTherapist') ? "Termine" : "Termine"}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsClusterMode(!isClusterMode)}
            className={`h-8 text-xs font-semibold gap-1.5 shadow-sm transition-all rounded-lg ${
              isClusterMode 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers className={`h-3.5 w-3.5 ${isClusterMode ? 'text-indigo-600' : 'text-slate-400'}`} />
            {t('calendar.clusterMode') || t('pinboard.clusterMode') || 'Terminkapseln'}
            {isClusterMode && <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />}
          </Button>
        </div>
      </div>

      {/* Main Calendar View - Dynamic Full Height */}
      <div className="h-[calc(100vh-210px)] min-h-[750px] w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
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
          onSelectEvent={handleEventClick}
          onSelectSlot={onSelectSlot}
          resizable
          selectable
          step={15}
          timeslots={4}
          defaultView={Views.WEEK}
          min={new Date(1970, 0, 1, 7, 0, 0)}
          max={new Date(1970, 0, 1, 20, 0, 0)}
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

      {/* Cluster Details Modal (Opens when clicking on a grouped Capsule Event) */}
      <Dialog open={isClusterModalOpen} onOpenChange={setIsClusterModalOpen}>
        <DialogContent className="max-w-2xl bg-white rounded-2xl p-0 overflow-hidden shadow-2xl border-slate-200">
          <div className="p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-300 animate-pulse" />
                {t('pinboard.clusterTitle', { count: clusterModalData?.appointments.length || 0 })}
              </DialogTitle>
              <DialogDescription className="text-xs text-blue-100">
                {clusterModalData?.start && moment(clusterModalData.start).format("dddd, DD. MMMM YYYY • HH:mm")} - {clusterModalData?.end && moment(clusterModalData.end).format("HH:mm")}
              </DialogDescription>
            </div>
            <Badge className="bg-white/20 text-white border-0 font-semibold px-3 py-1 text-xs">
              {clusterModalData?.appointments.length} Behandlungen
            </Badge>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 bg-slate-50">
            {clusterModalData?.appointments.map((apt) => {
              const therapyColor = apt.therapy_types?.color || '#3b82f6';
              return (
                <div
                  key={apt.id}
                  className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-indigo-300 hover:shadow-md transition-all"
                  style={{ borderLeft: `6px solid ${therapyColor}` }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {apt.patients?.full_name || t('common.unknown')}
                      </span>
                      <span 
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white shadow-xs"
                        style={{ backgroundColor: therapyColor }}
                      >
                        {apt.therapy_types?.name || apt.notes || t('calendar.form.none')}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                        {apt.therapists?.profiles?.full_name || "Kein Therapeut"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {apt.rooms?.name || "Kein Raum"}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsClusterModalOpen(false);
                      if (onSelectEvent) {
                        onSelectEvent({
                          id: apt.id,
                          title: `${apt.patients?.full_name} - ${apt.therapy_types?.name || apt.notes}`,
                          start: new Date(apt.start_time),
                          end: new Date(apt.end_time),
                          resource: apt,
                        });
                      }
                    }}
                    className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 font-semibold text-xs gap-1"
                  >
                    {t('pinboard.openAppointment')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

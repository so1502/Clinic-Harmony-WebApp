import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CalendarView } from "@/components/calendar/CalendarView";
import type { CalendarEvent } from "@/components/calendar/CalendarView";
import { EventDialog } from "@/components/calendar/EventDialog";
import type {  Appointment  } from "@/types";

export default function CalendarPage() {
  const { activeClinicId } = useAuth();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedAppointment(event.resource);
    setSelectedSlot(null);
    setIsDialogOpen(true);
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    setSelectedAppointment(null);
    setSelectedSlot(slotInfo);
    setIsDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setSelectedAppointment(null);
    setSelectedSlot(null);
    setIsDialogOpen(true);
  };
  
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["appointments", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          patients (id, full_name),
          therapists (id, profiles(full_name), color),
          therapy_types (id, name, color),
          rooms (id, name)
        `)
        .eq("clinic_id", activeClinicId);
        
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!activeClinicId,
  });

  if (!activeClinicId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500">Bitte wählen Sie eine Klinik aus, um den Kalender zu sehen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Kalender</h2>
          <p className="text-sm text-slate-500">Termine planen, verschieben und verwalten.</p>
        </div>
        <div className="flex gap-2">
          {/* Filters will go here later */}
          <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" /> Neuer Termin
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[750px] items-center justify-center rounded-xl border bg-white shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : (
        <>
          <CalendarView 
            appointments={appointments || []} 
            activeClinicId={activeClinicId} 
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
          />
          <EventDialog
            isOpen={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            activeClinicId={activeClinicId}
            selectedAppointment={selectedAppointment}
            selectedSlot={selectedSlot}
          />
        </>
      )}
    </div>
  );
}


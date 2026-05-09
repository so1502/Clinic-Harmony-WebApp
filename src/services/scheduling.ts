import { supabase } from "@/lib/supabase";
import type { Appointment } from "@/types";

export interface ConflictResult {
  hasConflict: boolean;
  type?: 'therapist' | 'room' | 'both';
  conflictingAppointment?: Appointment;
  message?: string;
}

/**
 * Checks for overlapping appointments for a specific therapist or room within a clinic.
 */
export async function checkAppointmentConflicts(
  clinicId: string,
  startTime: Date | string,
  endTime: Date | string,
  therapistId: string,
  roomId?: string | null,
  excludeAppointmentId?: string
): Promise<ConflictResult> {
  const start = typeof startTime === 'string' ? startTime : startTime.toISOString();
  const end = typeof endTime === 'string' ? endTime : endTime.toISOString();

  // Query appointments that overlap with the given time range
  // Overlap logic: (A.start < B.end) AND (A.end > B.start)
  let query = supabase
    .from("appointments")
    .select("*, therapists(*), rooms(*), patients(*)")
    .eq("clinic_id", clinicId)
    .neq("status", "cancelled") // Ignore cancelled appointments
    .lt("start_time", end)
    .gt("end_time", start);

  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error checking conflicts:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    return { hasConflict: false };
  }

  // Check specifically for therapist or room overlap
  const therapistConflict = data.find(a => a.therapist_id === therapistId);
  const roomConflict = roomId ? data.find(a => a.room_id === roomId) : null;

  if (therapistConflict && roomConflict) {
    return {
      hasConflict: true,
      type: 'both',
      conflictingAppointment: therapistConflict as Appointment,
      message: "Sowohl der Therapeut als auch der Raum sind zu dieser Zeit bereits belegt."
    };
  }

  if (therapistConflict) {
    return {
      hasConflict: true,
      type: 'therapist',
      conflictingAppointment: therapistConflict as Appointment,
      message: `Der Therapeut ist bereits für einen anderen Termin (${therapistConflict.patients?.full_name || 'Unbekannt'}) gebucht.`
    };
  }

  if (roomConflict) {
    return {
      hasConflict: true,
      type: 'room',
      conflictingAppointment: roomConflict as Appointment,
      message: `Der Raum ist bereits durch einen anderen Termin belegt.`
    };
  }

  return { hasConflict: false };
}

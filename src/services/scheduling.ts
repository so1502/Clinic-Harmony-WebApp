import { supabase } from "@/lib/supabase";
import type { Appointment } from "@/types";

export interface ConflictResult {
  hasConflict: boolean;
  type?: 'therapist' | 'room' | 'patient' | 'multiple';
  conflictingAppointment?: Appointment;
  message?: string;
}

/**
 * Checks for overlapping appointments for a specific therapist, patient, or room within a clinic.
 */
export async function checkAppointmentConflicts(
  clinicId: string,
  startTime: Date | string,
  endTime: Date | string,
  therapistId: string,
  patientId: string,
  roomId?: string | null,
  excludeAppointmentId?: string
): Promise<ConflictResult> {
  const start = typeof startTime === 'string' ? startTime : startTime.toISOString();
  const end = typeof endTime === 'string' ? endTime : endTime.toISOString();

  let query = supabase
    .from("appointments")
    .select("*, therapists(*), rooms(*), patients(*)")
    .eq("clinic_id", clinicId)
    .neq("status", "cancelled")
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

  const therapistConflict = data.find(a => String(a.therapist_id) === String(therapistId));
  const patientConflict = data.find(a => String(a.patient_id) === String(patientId));
  
  let roomConflict = null;
  if (roomId) {
    const overlappingInRoom = data.filter(a => String(a.room_id) === String(roomId));
    if (overlappingInRoom.length > 0) {
      // Use capacity from the joined rooms table, fallback to 1
      const capacityRaw = overlappingInRoom[0].rooms?.capacity;
      const roomCapacity = capacityRaw ? Number(capacityRaw) : 1;
      
      if (overlappingInRoom.length >= roomCapacity) {
        roomConflict = overlappingInRoom[0];
      }
    }
  }

  const conflictCount = (therapistConflict ? 1 : 0) + (patientConflict ? 1 : 0) + (roomConflict ? 1 : 0);

  if (conflictCount > 1) {
    return {
      hasConflict: true,
      type: 'multiple',
      message: "Es gibt mehrere Terminüberschneidungen (Therapeut, Patient oder Raum)."
    };
  }

  if (patientConflict) {
    return {
      hasConflict: true,
      type: 'patient',
      conflictingAppointment: patientConflict as Appointment,
      message: `Der Patient ist bereits für einen anderen Termin zu dieser Zeit gebucht.`
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
      message: `Der Raum ist bereits durch einen anderen Termin belegt (Kapazität erreicht).`
    };
  }

  return { hasConflict: false };
}

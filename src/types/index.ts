export type UserRole = 'system_admin' | 'clinic_admin' | 'therapist' | 'receptionist' | 'scheduler' | 'viewer';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  clinic_id: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface UserContextType {
  user: any | null; // Supabase User
  profile: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  activeClinicId: string | null;
  setActiveClinicId: (id: string | null) => void;
  signOut: () => Promise<void>;
}

export interface Room {
  id: string;
  clinic_id: string;
  name: string;
  capacity: number;
  equipment: string[];
}

export interface TherapyType {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  color: string;
}

export type TherapistStatus = 'pending' | 'active';

export interface Therapist {
  id: string;
  user_id: string | null;
  clinic_id: string;
  specialization: string | null;
  bio: string | null;
  color: string;
  status: TherapistStatus;
  profiles?: { full_name: string; email: string };
}

export interface Patient {
  id: string;
  clinic_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: string;
  clinic_id: string;
  therapist_id: string;
  patient_id: string;
  therapy_type_id: string | null;
  room_id: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Optional joined relations
  therapists?: Therapist;
  patients?: Patient;
  therapy_types?: TherapyType;
  rooms?: Room;
}

export type UserRole = 'system_admin' | 'clinic_admin' | 'therapist' | 'receptionist' | 'scheduler' | 'viewer';
export type TherapistStatus = 'pending' | 'active';

export interface Clinic {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  country_code: string;
  created_at: string;
  updated_at: string;
}

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

export interface Equipment {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'maintenance';
  created_at: string;
  updated_at: string;
}

export interface RoomEquipment {
  room_id: string;
  equipment_id: string;
  status: 'active' | 'maintenance';
  equipment?: Equipment;
}

export interface Room {
  id: string;
  clinic_id: string;
  name: string;
  capacity: number;
  equipment?: string[]; // Legacy
  room_equipment?: RoomEquipment[];
}


export interface TherapyType {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  therapy_type_equipment?: { equipment: Equipment }[];
}

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
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  ssn_svn: string | null;
  street: string | null;
  house_number: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  address: string | null; // Keeping for legacy
  insurance_provider: string | null;
  insurance_number: string | null;
  insurance_group: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  preferred_language: string | null;
  notes: string | null;
  is_active?: boolean;
  status?: string;
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
  required_equipment_ids: string[];
  
  // Optional joined relations
  therapists?: Therapist;
  patients?: Patient;
  therapy_types?: TherapyType;
  rooms?: Room;
}

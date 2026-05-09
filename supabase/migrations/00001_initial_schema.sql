-- Initial Schema for Clinic-Harmony

-- Enums
CREATE TYPE user_role AS ENUM ('system_admin', 'clinic_admin', 'therapist', 'receptionist');
CREATE TYPE therapist_status AS ENUM ('pending', 'active');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

-- Table: Clinics
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: Profiles (Extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: UserRoles
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    UNIQUE(user_id, role)
);

-- Table: Therapists
CREATE TABLE therapists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    specialization TEXT,
    bio TEXT,
    color TEXT DEFAULT '#3b82f6',
    status therapist_status NOT NULL DEFAULT 'pending',
    UNIQUE(user_id)
);

-- Table: Patients
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth DATE,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: TherapyTypes
CREATE TABLE therapy_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    color TEXT DEFAULT '#10b981'
);

-- Table: Rooms
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity INTEGER DEFAULT 1,
    equipment TEXT[] DEFAULT '{}'
);

-- Table: Appointments
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    therapy_type_id UUID REFERENCES therapy_types(id) ON DELETE SET NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status appointment_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT appointment_time_check CHECK (end_time > start_time)
);

-- Row Level Security (RLS) Setup

-- Helper function to get user's clinic_id
CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS UUID AS $$
    SELECT clinic_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to check if user has a specific role
CREATE OR REPLACE FUNCTION has_role(required_role user_role)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = required_role
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapy_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policies for Profiles
CREATE POLICY "Users can view users in same clinic" ON profiles
    FOR SELECT USING (
        clinic_id = get_user_clinic_id() 
        OR has_role('system_admin')
        OR id = auth.uid()
    );

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- Policies for Clinics
CREATE POLICY "Users can view their own clinic" ON clinics
    FOR SELECT USING (
        id = get_user_clinic_id()
        OR has_role('system_admin')
    );

-- Policies for Patients
CREATE POLICY "Users can view patients in their clinic" ON patients
    FOR SELECT USING (clinic_id = get_user_clinic_id() OR has_role('system_admin'));

CREATE POLICY "Clinic Admins and Receptionists can insert patients" ON patients
    FOR INSERT WITH CHECK (
        (clinic_id = get_user_clinic_id() AND (has_role('clinic_admin') OR has_role('receptionist')))
        OR has_role('system_admin')
    );

CREATE POLICY "Clinic Admins and Receptionists can update patients" ON patients
    FOR UPDATE USING (
        (clinic_id = get_user_clinic_id() AND (has_role('clinic_admin') OR has_role('receptionist')))
        OR has_role('system_admin')
    );

-- Policies for Therapists
CREATE POLICY "Users can view therapists in their clinic" ON therapists
    FOR SELECT USING (clinic_id = get_user_clinic_id() OR has_role('system_admin'));

CREATE POLICY "Clinic Admins can manage therapists" ON therapists
    FOR ALL USING (
        (clinic_id = get_user_clinic_id() AND has_role('clinic_admin'))
        OR has_role('system_admin')
    );

-- Policies for Rooms
CREATE POLICY "Users can view rooms in their clinic" ON rooms
    FOR SELECT USING (clinic_id = get_user_clinic_id() OR has_role('system_admin'));

CREATE POLICY "Clinic Admins can manage rooms" ON rooms
    FOR ALL USING (
        (clinic_id = get_user_clinic_id() AND has_role('clinic_admin'))
        OR has_role('system_admin')
    );

-- Policies for Therapy Types
CREATE POLICY "Users can view therapy types in their clinic" ON therapy_types
    FOR SELECT USING (clinic_id = get_user_clinic_id() OR has_role('system_admin'));

CREATE POLICY "Clinic Admins can manage therapy types" ON therapy_types
    FOR ALL USING (
        (clinic_id = get_user_clinic_id() AND has_role('clinic_admin'))
        OR has_role('system_admin')
    );

-- Policies for Appointments
CREATE POLICY "Users can view appointments in their clinic" ON appointments
    FOR SELECT USING (clinic_id = get_user_clinic_id() OR has_role('system_admin'));

CREATE POLICY "Receptionists and Admins can manage appointments" ON appointments
    FOR ALL USING (
        (clinic_id = get_user_clinic_id() AND (has_role('clinic_admin') OR has_role('receptionist')))
        OR has_role('system_admin')
    );

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


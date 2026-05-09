-- =============================================================================
-- Migration 00008: Refine Roles (Viewer addition & Staff merging)
-- =============================================================================

-- 1. Add 'viewer' role to enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'viewer';

-- 2. Update RLS Policies for the new 'viewer' role
-- Note: 'viewer' should only have SELECT access to clinic data.

-- Appointments
DROP POLICY IF EXISTS "Viewers can read appointments" ON public.appointments;
CREATE POLICY "Viewers can read appointments" ON public.appointments
    FOR SELECT USING (clinic_id = get_user_clinic_id() AND has_role('viewer'));

-- Patients
DROP POLICY IF EXISTS "Viewers can read patients" ON public.patients;
CREATE POLICY "Viewers can read patients" ON public.patients
    FOR SELECT USING (clinic_id = get_user_clinic_id() AND has_role('viewer'));

-- Rooms
DROP POLICY IF EXISTS "Viewers can read rooms" ON public.rooms;
CREATE POLICY "Viewers can read rooms" ON public.rooms
    FOR SELECT USING (clinic_id = get_user_clinic_id() AND has_role('viewer'));

-- Therapy Types
DROP POLICY IF EXISTS "Viewers can read therapy types" ON public.therapy_types;
CREATE POLICY "Viewers can read therapy types" ON public.therapy_types
    FOR SELECT USING (clinic_id = get_user_clinic_id() AND has_role('viewer'));

-- Therapists
DROP POLICY IF EXISTS "Viewers can read therapists" ON public.therapists;
CREATE POLICY "Viewers can read therapists" ON public.therapists
    FOR SELECT USING (clinic_id = get_user_clinic_id() AND has_role('viewer'));

-- 3. Ensure 'receptionist' is treated as the combined Staff role
-- (We already did this in 00007, but let's double check invitations)
DROP POLICY IF EXISTS "Clinic staff can manage invitations for own clinic" ON public.invitations;
CREATE POLICY "Clinic staff can manage invitations for own clinic" ON public.invitations
    FOR ALL
    TO authenticated
    USING (
        has_role('system_admin')
        OR
        (
            (has_role('clinic_admin') OR has_role('receptionist'))
            AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
        )
    )
    WITH CHECK (
        has_role('system_admin')
        OR
        (
            (has_role('clinic_admin') OR has_role('receptionist'))
            AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
        )
    );

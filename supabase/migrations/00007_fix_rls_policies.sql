-- =============================================================================
-- Migration 00007: Comprehensive RLS Policy Fixes (RECURSION FIXED)
-- =============================================================================

-- Fix 1: user_roles — Add missing READ policy
-- Note: We use the has_role() helper to avoid infinite RLS recursion.
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System admins can read all roles" ON public.user_roles;
CREATE POLICY "System admins can read all roles" ON public.user_roles
    FOR SELECT
    USING (has_role('system_admin'));

DROP POLICY IF EXISTS "System admins can manage all roles" ON public.user_roles;
CREATE POLICY "System admins can manage all roles" ON public.user_roles
    FOR ALL
    USING (has_role('system_admin'))
    WITH CHECK (has_role('system_admin'));


-- Fix 2: invitations — Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic admins can manage invitations for own clinic" ON public.invitations;
CREATE POLICY "Clinic admins can manage invitations for own clinic" ON public.invitations
    FOR ALL
    TO authenticated
    USING (
        has_role('system_admin')
        OR
        (
            has_role('clinic_admin')
            AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
        )
    )
    WITH CHECK (
        has_role('system_admin')
        OR
        (
            has_role('clinic_admin')
            AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
        )
    );


-- Fix 3: clinics — system_admin full CRUD access
DROP POLICY IF EXISTS "System admins can manage clinics" ON public.clinics;
CREATE POLICY "System admins can manage clinics" ON public.clinics
    FOR ALL
    USING (has_role('system_admin'))
    WITH CHECK (has_role('system_admin'));

DROP POLICY IF EXISTS "Clinic admins can update own clinic" ON public.clinics;
CREATE POLICY "Clinic admins can update own clinic" ON public.clinics
    FOR UPDATE
    USING (
        id = get_user_clinic_id() AND has_role('clinic_admin')
    )
    WITH CHECK (
        id = get_user_clinic_id() AND has_role('clinic_admin')
    );


-- Fix 4: appointments — Therapists can update their own appointments
DROP POLICY IF EXISTS "Therapists can update own appointment status" ON public.appointments;
CREATE POLICY "Therapists can update own appointment status" ON public.appointments
    FOR UPDATE
    USING (
        clinic_id = get_user_clinic_id()
        AND therapist_id IN (
            SELECT id FROM public.therapists WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        clinic_id = get_user_clinic_id()
        AND therapist_id IN (
            SELECT id FROM public.therapists WHERE user_id = auth.uid()
        )
    );

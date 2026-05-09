-- =============================================================================
-- Migration 00009: Manage Roles & Therapist Sync
-- =============================================================================

-- 1. Update RLS Policies for user_roles to allow management by admins
-- Note: has_role() is SECURITY DEFINER, so it avoids recursion.

DROP POLICY IF EXISTS "Clinic admins can manage roles in their clinic" ON public.user_roles;
CREATE POLICY "Clinic admins can manage roles in their clinic" ON public.user_roles
    FOR ALL
    TO authenticated
    USING (
        has_role('system_admin')
        OR (
            has_role('clinic_admin')
            AND user_id IN (
                SELECT id FROM public.profiles WHERE clinic_id = get_user_clinic_id()
            )
        )
    )
    WITH CHECK (
        has_role('system_admin')
        OR (
            has_role('clinic_admin')
            AND user_id IN (
                SELECT id FROM public.profiles WHERE clinic_id = get_user_clinic_id()
            )
            -- Prevent clinic admins from giving system_admin role
            AND role != 'system_admin'
        )
    );

-- 2. Trigger function to sync therapists table with user_roles
CREATE OR REPLACE FUNCTION public.sync_therapist_record()
RETURNS TRIGGER AS $$
DECLARE
    u_clinic_id UUID;
BEGIN
    -- Handle INSERT and UPDATE
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.role = 'therapist' THEN
            -- Get clinic_id from profiles
            SELECT clinic_id INTO u_clinic_id FROM public.profiles WHERE id = NEW.user_id;
            
            -- Insert into therapists if not exists, or set to active
            INSERT INTO public.therapists (user_id, clinic_id, status)
            VALUES (NEW.user_id, u_clinic_id, 'active')
            ON CONFLICT (user_id) DO UPDATE SET status = 'active';
        ELSIF (TG_OP = 'UPDATE' AND OLD.role = 'therapist' AND NEW.role != 'therapist') THEN
            -- If they lose therapist role, set status to pending
            UPDATE public.therapists SET status = 'pending' WHERE user_id = OLD.user_id;
        END IF;
    END IF;

    -- Handle DELETE
    IF (TG_OP = 'DELETE' AND OLD.role = 'therapist') THEN
        UPDATE public.therapists SET status = 'pending' WHERE user_id = OLD.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_role_change ON public.user_roles;
CREATE TRIGGER on_user_role_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_therapist_record();

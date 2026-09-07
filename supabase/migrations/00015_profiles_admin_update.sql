-- Migration: 00015_profiles_admin_update.sql
-- Allow system_admin and clinic_admin to update profiles in their clinic

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
    FOR UPDATE
    USING (
        has_role('system_admin')
        OR (has_role('clinic_admin') AND clinic_id = get_user_clinic_id())
        OR id = auth.uid()
    )
    WITH CHECK (
        has_role('system_admin')
        OR (has_role('clinic_admin') AND clinic_id = get_user_clinic_id())
        OR id = auth.uid()
    );

-- Update all LKH Hochzirl staff profiles to their clinic_id
DO $$
DECLARE
  lkh_id UUID;
BEGIN
  SELECT id INTO lkh_id FROM clinics WHERE name LIKE '%LKH Hochzirl%' LIMIT 1;
  
  IF lkh_id IS NOT NULL THEN
    UPDATE profiles SET clinic_id = lkh_id WHERE email LIKE '%@tirol-kliniken.at' OR email LIKE '%@lkh-hochzirl.at';
  END IF;
END $$;

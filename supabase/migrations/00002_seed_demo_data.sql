-- Supabase Seed Script für Demo-User und Klinik
-- Dieses Skript erstellt die 4 gewünschten Accounts, eine Demo-Klinik und weist die Rollen zu.

-- 1. Pgcrypto Extension sicherstellen (für Passwort-Hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ 
DECLARE
  sys_admin_id UUID := gen_random_uuid();
  clinic_admin_id UUID := gen_random_uuid();
  therapist_id UUID := gen_random_uuid();
  receptionist_id UUID := gen_random_uuid();
  new_clinic_id UUID := gen_random_uuid();
BEGIN

  -- 2. User in auth.users anlegen
  
  -- SYSTEM ADMIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (sys_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', crypt('Admin123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name": "System Admin"}', now(), now());

  -- CLINIC ADMIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (clinic_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clinic.admin@example.com', crypt('ClinicAdmin123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name": "Clinic Admin"}', now(), now());

  -- THERAPIST
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (therapist_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'therapist.one@example.com', crypt('Therapist123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name": "Dr. Therapist"}', now(), now());

  -- RECEPTIONIST
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (receptionist_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'receptionist@example.com', crypt('Reception123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name": "Empfang"}', now(), now());

  -- Hinweis: Der Trigger `on_auth_user_created` (aus Schritt 1) hat nun bereits 4 Einträge in der `profiles` Tabelle erstellt!

  -- 3. Demo-Klinik erstellen
  INSERT INTO clinics (id, name, address, phone, email) 
  VALUES (new_clinic_id, 'Clinic 1', 'Musterstraße 1, 12345 Berlin', '030-1234567', 'info@clinic1.com');

  -- 4. Profile updaten und mit Klinik verknüpfen (System Admin braucht keine Clinic)
  UPDATE profiles SET full_name = 'System Admin' WHERE id = sys_admin_id;
  UPDATE profiles SET full_name = 'Clinic Admin', clinic_id = new_clinic_id WHERE id = clinic_admin_id;
  UPDATE profiles SET full_name = 'Dr. Therapist', clinic_id = new_clinic_id WHERE id = therapist_id;
  UPDATE profiles SET full_name = 'Empfang', clinic_id = new_clinic_id WHERE id = receptionist_id;

  -- 5. Rollen vergeben
  INSERT INTO user_roles (user_id, role) VALUES (sys_admin_id, 'system_admin');
  INSERT INTO user_roles (user_id, role) VALUES (clinic_admin_id, 'clinic_admin');
  INSERT INTO user_roles (user_id, role) VALUES (therapist_id, 'therapist');
  INSERT INTO user_roles (user_id, role) VALUES (receptionist_id, 'receptionist');

  -- 6. Therapist Eintrag erstellen (damit der Therapeut im Kalender auftaucht)
  INSERT INTO therapists (user_id, clinic_id, specialization, color, status)
  VALUES (therapist_id, new_clinic_id, 'Physiotherapie', '#3b82f6', 'active');

END $$;

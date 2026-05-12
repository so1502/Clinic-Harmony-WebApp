-- Expand Patient Data and Clinic Localization

-- Update Clinics table
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'AT';

-- Expand Patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ssn_svn TEXT; -- Social Security Number (US) / Sozialversicherungsnummer (AT)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS house_number TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS state_province TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_provider TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_number TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_group TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'de';

-- Optional: Update existing patients to split full_name if possible (basic split)
UPDATE patients SET 
  first_name = split_part(full_name, ' ', 1),
  last_name = substr(full_name, length(split_part(full_name, ' ', 1)) + 2)
WHERE first_name IS NULL AND full_name LIKE '% %';

-- If no space, just put it in first_name
UPDATE patients SET first_name = full_name WHERE first_name IS NULL;

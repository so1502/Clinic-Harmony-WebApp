-- Migration: Add status & is_active columns to patients table

ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Update existing records to active
UPDATE patients SET is_active = TRUE, status = 'active' WHERE is_active IS NULL;

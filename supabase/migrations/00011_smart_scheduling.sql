-- Migration: 00011_smart_scheduling.sql
-- Description: Adds structured equipment management, maintenance status, and links to rooms and therapy types.

-- 1. Create Equipment Table
CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Room-Equipment Junction Table
CREATE TABLE room_equipment (
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    PRIMARY KEY (room_id, equipment_id)
);

-- 3. Create Therapy-Type-Equipment Junction Table
CREATE TABLE therapy_type_equipment (
    therapy_type_id UUID NOT NULL REFERENCES therapy_types(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    PRIMARY KEY (therapy_type_id, equipment_id)
);

-- 4. Update Appointments Table
ALTER TABLE appointments ADD COLUMN required_equipment_ids UUID[] DEFAULT '{}';

-- 5. RLS Policies

-- Equipment
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view equipment in their clinic" ON equipment
    FOR SELECT USING (clinic_id = get_user_clinic_id() OR has_role('system_admin'));

CREATE POLICY "Clinic Admins can manage equipment" ON equipment
    FOR ALL USING (
        (clinic_id = get_user_clinic_id() AND has_role('clinic_admin'))
        OR has_role('system_admin')
    );

-- Room Equipment
ALTER TABLE room_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view room equipment" ON room_equipment
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM rooms WHERE id = room_id AND (clinic_id = get_user_clinic_id() OR has_role('system_admin')))
    );

CREATE POLICY "Clinic Admins can manage room equipment" ON room_equipment
    FOR ALL USING (
        EXISTS (SELECT 1 FROM rooms WHERE id = room_id AND (clinic_id = get_user_clinic_id() AND has_role('clinic_admin')))
        OR has_role('system_admin')
    );

-- Therapy Type Equipment
ALTER TABLE therapy_type_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view therapy type equipment" ON therapy_type_equipment
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM therapy_types WHERE id = therapy_type_id AND (clinic_id = get_user_clinic_id() OR has_role('system_admin')))
    );

CREATE POLICY "Clinic Admins can manage therapy type equipment" ON therapy_type_equipment
    FOR ALL USING (
        EXISTS (SELECT 1 FROM therapy_types WHERE id = therapy_type_id AND (clinic_id = get_user_clinic_id() AND has_role('clinic_admin')))
        OR has_role('system_admin')
    );

-- 6. Migrate Existing Data (Helper Script)
-- This logic extracts existing equipment strings from rooms and creates equipment records
DO $$
DECLARE
    room_record RECORD;
    equip_name TEXT;
    new_equip_id UUID;
BEGIN
    FOR room_record IN SELECT id, clinic_id, equipment FROM rooms WHERE array_length(equipment, 1) > 0 LOOP
        FOREACH equip_name IN ARRAY room_record.equipment LOOP
            -- Check if equipment already exists for this clinic
            SELECT id INTO new_equip_id FROM equipment WHERE clinic_id = room_record.clinic_id AND name = equip_name;
            
            IF new_equip_id IS NULL THEN
                INSERT INTO equipment (clinic_id, name) VALUES (room_record.clinic_id, equip_name) RETURNING id INTO new_equip_id;
            END IF;
            
            -- Link to room
            INSERT INTO room_equipment (room_id, equipment_id) VALUES (room_record.id, new_equip_id) ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 7. Clean up (Optional: You might want to drop the old column later, but keeping it for now as safety)
-- ALTER TABLE rooms DROP COLUMN equipment;

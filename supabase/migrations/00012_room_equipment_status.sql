-- Migration: 00012_room_equipment_status.sql
-- Description: Adds a status column to room_equipment to allow room-specific maintenance status.

ALTER TABLE room_equipment 
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance'));

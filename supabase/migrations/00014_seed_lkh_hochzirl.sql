-- Migration: 00014_seed_lkh_hochzirl.sql
-- Setup for Ö. LKH Hochzirl – Natters (Neurologie HZ)

-- 1. Extend patients table for station and medical alerts if not existing
ALTER TABLE patients ADD COLUMN IF NOT EXISTS station TEXT DEFAULT 'Neuro I';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_alert TEXT DEFAULT 'none';

DO $$
DECLARE
  lkh_clinic_id UUID := gen_random_uuid();
  
  -- Therapy Type IDs
  tt_pt UUID := gen_random_uuid();
  tt_lp UUID := gen_random_uuid();
  tt_et UUID := gen_random_uuid();
  tt_r UUID := gen_random_uuid();
  tt_pf UUID := gen_random_uuid();
  tt_bt UUID := gen_random_uuid();

  -- Equipment IDs
  eq_liege UUID := gen_random_uuid();
  eq_stehtisch UUID := gen_random_uuid();
  eq_tisch_sessel UUID := gen_random_uuid();
  eq_therapiekueche UUID := gen_random_uuid();
  eq_adl UUID := gen_random_uuid();
  eq_gipsraum UUID := gen_random_uuid();
  eq_seilzug UUID := gen_random_uuid();
  eq_lagerung UUID := gen_random_uuid();
  eq_stehbett_schlingentisch UUID := gen_random_uuid();
  eq_gehbarren_sprossenwand UUID := gen_random_uuid();
  eq_cmill UUID := gen_random_uuid();
  eq_hirob UUID := gen_random_uuid();
  eq_armeo_spring UUID := gen_random_uuid();
  eq_amadeo UUID := gen_random_uuid();
  eq_lokomat UUID := gen_random_uuid();
  eq_robert UUID := gen_random_uuid();
  eq_erigo UUID := gen_random_uuid();
  eq_armeo_power UUID := gen_random_uuid();
  eq_lp_material UUID := gen_random_uuid();
  eq_et_material UUID := gen_random_uuid();

  -- Room IDs
  r_4_G0_113 UUID := gen_random_uuid();
  r_4_G0_035 UUID := gen_random_uuid();
  r_4_G0_036 UUID := gen_random_uuid();
  r_4_G0_037 UUID := gen_random_uuid();
  r_4_G0_038 UUID := gen_random_uuid();
  r_5_G1_005 UUID := gen_random_uuid();
  r_5_G1_009 UUID := gen_random_uuid();
  r_5_G1_041 UUID := gen_random_uuid();
  r_4_G2_010 UUID := gen_random_uuid();
  r_4_G2_012 UUID := gen_random_uuid();
  r_4_G2_013 UUID := gen_random_uuid();
  r_5_G2_003 UUID := gen_random_uuid();
  r_5_G2_005 UUID := gen_random_uuid();
  r_5_G2_007 UUID := gen_random_uuid();
  r_5_G2_009 UUID := gen_random_uuid();
  r_5_G2_024 UUID := gen_random_uuid();
  r_5_G2_033 UUID := gen_random_uuid();
  r_5_G2_031 UUID := gen_random_uuid();

BEGIN
  -- Check if LKH Hochzirl already exists to avoid duplication
  IF EXISTS (SELECT 1 FROM clinics WHERE name LIKE '%LKH Hochzirl%') THEN
    SELECT id INTO lkh_clinic_id FROM clinics WHERE name LIKE '%LKH Hochzirl%' LIMIT 1;
  ELSE
    -- Create LKH Hochzirl Clinic
    INSERT INTO clinics (id, name, address, phone, email, country_code)
    VALUES (
      lkh_clinic_id,
      'Ö. LKH Hochzirl – Natters (Neurologie HZ)',
      'Hochzirl 1, A-6170 Zirl',
      '+43 50 504-0',
      'neurologie.hochzirl@tirol-kliniken.at',
      'AT'
    );
  END IF;

  -- Insert Therapy Types with specified colors
  INSERT INTO therapy_types (id, clinic_id, name, description, duration_minutes, color) VALUES
  (tt_pt, lkh_clinic_id, 'Physiotherapie (PT)', 'Physiotherapeutische Behandlung', 45, '#3b82f6'),
  (tt_lp, lkh_clinic_id, 'Logopädie (LP)', 'Sprach-, Sprech- und Schlucktherapie', 45, '#eab308'),
  (tt_et, lkh_clinic_id, 'Ergotherapie (ET)', 'Motorisch-funktionelle & neuropsychologische ET', 45, '#22c55e'),
  (tt_r,  lkh_clinic_id, 'Robotik (R)', 'Ganzheitliche robotikgestützte Rehabilitation', 60, '#6b7280'),
  (tt_pf, lkh_clinic_id, 'Pflege', 'Pflegerische Unterstützung & Frühmobilisation', 30, '#ef4444'),
  (tt_bt, lkh_clinic_id, 'Bädertherapie', 'Hydrotherapie & Medizinische Bäder', 45, '#f97316')
  ON CONFLICT DO NOTHING;

  -- Insert Equipment Catalog for LKH Hochzirl
  INSERT INTO equipment (id, clinic_id, name, description, status) VALUES
  (eq_liege, lkh_clinic_id, 'Therapieliege', 'Elektrisch höhenverstellbare Behandlungsliege', 'active'),
  (eq_stehtisch, lkh_clinic_id, 'Stehtisch', 'Kippstehtisch zur Stehbereitschaft', 'active'),
  (eq_tisch_sessel, lkh_clinic_id, 'Therapietisch & Sessel', 'Tisch-Sessel-Ensemble für LP/ET', 'active'),
  (eq_therapiekueche, lkh_clinic_id, 'Therapieküche', 'Barrierefreie Übungsküche', 'active'),
  (eq_adl, lkh_clinic_id, 'ET-Materialien ADL', 'Alltagsrelevante Trainingsmaterialien', 'active'),
  (eq_gipsraum, lkh_clinic_id, 'Gipsraum-Ausstattung', 'Schiene und Orthesenversorgung', 'active'),
  (eq_seilzug, lkh_clinic_id, 'Seilzug & Hanteln', 'Kraft- und Zugapparat mit Kurzhanteln', 'active'),
  (eq_lagerung, lkh_clinic_id, 'Lagerungsmaterial', 'Positionierungskeile & Bobath-Kissen', 'active'),
  (eq_stehbett_schlingentisch, lkh_clinic_id, 'Stehbett & Schlingentisch', 'Vertikalisierung und Entlastung', 'active'),
  (eq_gehbarren_sprossenwand, lkh_clinic_id, 'Gehbarren & Sprossenwand', 'Gangbahn, Pezzibälle, Turnmatten', 'active'),
  (eq_cmill, lkh_clinic_id, 'C-Mill', 'Virtuelles Laufbandtraining', 'active'),
  (eq_hirob, lkh_clinic_id, 'hirob', 'Reittherapie-Simulator für Rumpfsteuerung', 'active'),
  (eq_armeo_spring, lkh_clinic_id, 'Armeo-Spring', 'Exoskelett für Armrehabilitation', 'active'),
  (eq_amadeo, lkh_clinic_id, 'Amadeo', 'Finger-Hand-Rehabilitationssystem', 'active'),
  (eq_lokomat, lkh_clinic_id, 'Lokomat', 'Robotisches Gangorthesen-System', 'active'),
  (eq_robert, lkh_clinic_id, 'ROBERT', 'Robotische Beinmobilisierung', 'active'),
  (eq_erigo, lkh_clinic_id, 'Erigo', 'Stufenlose Vertikalisierung mit Beinbewegung', 'active'),
  (eq_armeo_power, lkh_clinic_id, 'Armeo Power', 'Angetriebenes Arm-Exoskelett', 'active'),
  (eq_lp_material, lkh_clinic_id, 'LP-Therapiematerial', 'Aphasie- & Dysphagie-Materialien', 'active'),
  (eq_et_material, lkh_clinic_id, 'ET-Materialien', 'Feinmotorik- & Wahrnehmungsmaterial', 'active')
  ON CONFLICT DO NOTHING;

  -- Insert Rooms
  INSERT INTO rooms (id, clinic_id, name, capacity) VALUES
  (r_4_G0_113, lkh_clinic_id, '4-G0-113 (alle)', 3),
  (r_4_G0_035, lkh_clinic_id, '4-G0-035 (LP)', 1),
  (r_4_G0_036, lkh_clinic_id, '4-G0-036 (LP)', 1),
  (r_4_G0_037, lkh_clinic_id, '4-G0-037 (LP)', 1),
  (r_4_G0_038, lkh_clinic_id, '4-G0-038 (LP)', 1),
  (r_5_G1_005, lkh_clinic_id, '5-G1-005 (ET)', 4),
  (r_5_G1_009, lkh_clinic_id, '5-G1-009 (ET Therapieküche)', 2),
  (r_5_G1_041, lkh_clinic_id, '5-G1-041 (ET ADL)', 1),
  (r_4_G2_010, lkh_clinic_id, '4-G2-010 (ET Gipsraum)', 1),
  (r_4_G2_012, lkh_clinic_id, '4-G2-012 (PT)', 1),
  (r_4_G2_013, lkh_clinic_id, '4-G2-013 (PT)', 3),
  (r_5_G2_003, lkh_clinic_id, '5-G2-003 (PT)', 2),
  (r_5_G2_005, lkh_clinic_id, '5-G2-005 (PT)', 2),
  (r_5_G2_007, lkh_clinic_id, '5-G2-007 (PT)', 3),
  (r_5_G2_009, lkh_clinic_id, '5-G2-009 (R)', 4),
  (r_5_G2_024, lkh_clinic_id, '5-G2-024 (R Lokomat/ROBERT)', 4),
  (r_5_G2_033, lkh_clinic_id, '5-G2-033 (LP)', 1),
  (r_5_G2_031, lkh_clinic_id, '5-G2-031 (LP)', 1)
  ON CONFLICT DO NOTHING;

  -- Link Rooms with Equipment
  INSERT INTO room_equipment (room_id, equipment_id) VALUES
  (r_4_G0_113, eq_liege), (r_4_G0_113, eq_stehtisch),
  (r_4_G0_035, eq_tisch_sessel),
  (r_4_G0_036, eq_tisch_sessel),
  (r_4_G0_037, eq_tisch_sessel), (r_4_G0_037, eq_liege),
  (r_4_G0_038, eq_tisch_sessel), (r_4_G0_038, eq_liege),
  (r_5_G1_005, eq_liege), (r_5_G1_005, eq_tisch_sessel), (r_5_G1_005, eq_lagerung), (r_5_G1_005, eq_et_material),
  (r_5_G1_009, eq_therapiekueche),
  (r_5_G1_041, eq_liege), (r_5_G1_041, eq_adl),
  (r_4_G2_010, eq_liege), (r_4_G2_010, eq_gipsraum),
  (r_4_G2_012, eq_liege), (r_4_G2_012, eq_seilzug),
  (r_4_G2_013, eq_liege), (r_4_G2_013, eq_lagerung),
  (r_5_G2_003, eq_liege), (r_5_G2_003, eq_lagerung),
  (r_5_G2_005, eq_liege), (r_5_G2_005, eq_stehbett_schlingentisch),
  (r_5_G2_007, eq_liege), (r_5_G2_007, eq_gehbarren_sprossenwand), (r_5_G2_007, eq_lagerung),
  (r_5_G2_009, eq_cmill), (r_5_G2_009, eq_hirob), (r_5_G2_009, eq_armeo_spring), (r_5_G2_009, eq_amadeo), (r_5_G2_009, eq_liege),
  (r_5_G2_024, eq_lokomat), (r_5_G2_024, eq_robert), (r_5_G2_024, eq_erigo), (r_5_G2_024, eq_armeo_power),
  (r_5_G2_033, eq_tisch_sessel), (r_5_G2_033, eq_liege), (r_5_G2_033, eq_lagerung), (r_5_G2_033, eq_lp_material),
  (r_5_G2_031, eq_tisch_sessel)
  ON CONFLICT DO NOTHING;

  -- Insert 15 Qualified Therapists (PT, LP, ET, Robotik, Pflege, Bädertherapie)
  INSERT INTO therapists (clinic_id, specialization, color, status, bio) VALUES
  (lkh_clinic_id, 'Physiotherapie (PT)', '#3b82f6', 'active', 'PT Markus Huber - Schwerpunkte Neuro-Reha & Bobath'),
  (lkh_clinic_id, 'Physiotherapie (PT)', '#3b82f6', 'active', 'PT Sabine Hofer - Spezialistin für Gangschulung'),
  (lkh_clinic_id, 'Physiotherapie (PT)', '#3b82f6', 'active', 'PT Thomas Gruber - Schwerpunkte Manuelle Therapie'),
  (lkh_clinic_id, 'Physiotherapie (PT)', '#3b82f6', 'active', 'PT Laura Steiner - Schwerpunkte Gleichgewicht & Motorik'),
  (lkh_clinic_id, 'Logopädie (LP)', '#eab308', 'active', 'LP Elisabeth Pichler - Aphasie & Trachealkanülenmanagement'),
  (lkh_clinic_id, 'Logopädie (LP)', '#eab308', 'active', 'LP Michael Rauch - Dysphagietherapie & FEES'),
  (lkh_clinic_id, 'Logopädie (LP)', '#eab308', 'active', 'LP Anna Koller - Dysarthrie & Sprechapraxie'),
  (lkh_clinic_id, 'Ergotherapie (ET)', '#22c55e', 'active', 'ET Maria Schmid - Handfunktion & ADL-Training'),
  (lkh_clinic_id, 'Ergotherapie (ET)', '#22c55e', 'active', 'ET Christian Moser - Neuropsychologie & Kognition'),
  (lkh_clinic_id, 'Ergotherapie (ET)', '#22c55e', 'active', 'ET Julia Wallner - Hilfsmittelberatung & Schienenbau'),
  (lkh_clinic_id, 'Robotik (R)', '#6b7280', 'active', 'R-Therapeut Stefan Berger - Lokomat & C-Mill Spezialist'),
  (lkh_clinic_id, 'Robotik (R)', '#6b7280', 'active', 'R-Therapeutin Katharina Mayr - Armeo Power & Erigo'),
  (lkh_clinic_id, 'Pflege', '#ef4444', 'active', 'Pflegekraft David Egger - Aktivierend-therapeutische Pflege'),
  (lkh_clinic_id, 'Pflege', '#ef4444', 'active', 'Pflegekraft Birgit Plattner - Frühmobilisation & Bobath-Pflege'),
  (lkh_clinic_id, 'Bädertherapie', '#f97316', 'active', 'Bädertherapeut Florian Lindner - Hydro- & Balneotherapie')
  ON CONFLICT DO NOTHING;

  -- Insert 25 Patients distributed across Station Neuro I, II, III
  -- Alerts: 'none', 'schlechter_az_infektion', 'bei_pflege_melden', 'both'
  INSERT INTO patients (clinic_id, full_name, first_name, last_name, gender, date_of_birth, ssn_svn, station, medical_alert, notes, preferred_language, status, is_active) VALUES
  -- Neuro I (8 Patients)
  (lkh_clinic_id, 'Karl Pichler', 'Karl', 'Pichler', 'M', '1958-04-12', '1042120458', 'Neuro I', 'schlechter_az_infektion', 'Isolationszimmer wegen MRSA. Frühestens ab 11:00 Frühstück im Bett.', 'de', 'active', true),
  (lkh_clinic_id, 'Johanna Hofer', 'Johanna', 'Hofer', 'W', '1965-09-23', '2153230965', 'Neuro I', 'bei_pflege_melden', 'Transfer nur mit 2 Pflegekräften. Bei Pflege melden!', 'de', 'active', true),
  (lkh_clinic_id, 'Franz Steiner', 'Franz', 'Steiner', 'M', '1952-11-05', '3021051152', 'Neuro I', 'none', 'Z.n. Insult re. Hemiparese links. Motivation hoch.', 'de', 'active', true),
  (lkh_clinic_id, 'Helga Bauer', 'Helga', 'Bauer', 'W', '1970-03-18', '4192180370', 'Neuro I', 'none', 'Dysphagie Grad II. Schluckkost Stufe 2.', 'de', 'active', true),
  (lkh_clinic_id, 'Stefan Egger', 'Stefan', 'Egger', 'M', '1982-07-30', '5120300782', 'Neuro I', 'bei_pflege_melden', 'Z.n. SHT Grad III. Rollstuhlpflichtig.', 'de', 'active', true),
  (lkh_clinic_id, 'Monika Koller', 'Monika', 'Koller', 'W', '1961-01-14', '1402140161', 'Neuro I', 'none', 'Multiple Sklerose (EDSS 4.5). Ermüdbar ab 14 Uhr.', 'de', 'active', true),
  (lkh_clinic_id, 'Anton Plattner', 'Anton', 'Plattner', 'M', '1949-08-27', '2891270849', 'Neuro I', 'both', 'Infektionsgefahr (VRE) & Sturzrisiko hoch! Bei Pflege melden!', 'de', 'active', true),
  (lkh_clinic_id, 'Renate Lindner', 'Renate', 'Lindner', 'W', '1955-12-09', '3410091255', 'Neuro I', 'none', 'Parkinson-Syndrom. Wirkungstief vor 10:00 Uhr.', 'de', 'active', true),

  -- Neuro II (8 Patients)
  (lkh_clinic_id, 'Josef Mair', 'Josef', 'Mair', 'M', '1963-05-19', '1182190563', 'Neuro II', 'none', 'Z.n. SAB. Lokomat-Training bevorzugt.', 'de', 'active', true),
  (lkh_clinic_id, 'Maria Haider', 'Maria', 'Haider', 'W', '1974-10-02', '2411021074', 'Neuro II', 'schlechter_az_infektion', 'Schlechter AZ nach Krampfanfall.', 'de', 'active', true),
  (lkh_clinic_id, 'Peter Kofler', 'Peter', 'Kofler', 'M', '1956-02-28', '3192280256', 'Neuro II', 'bei_pflege_melden', 'Benötigt Hilfe beim Anziehen & Rollstuhl-Transfer.', 'de', 'active', true),
  (lkh_clinic_id, 'Gertraud Moser', 'Gertraud', 'Moser', 'W', '1968-06-11', '4051110668', 'Neuro II', 'none', 'Armeo-Spring Training verordnet.', 'de', 'active', true),
  (lkh_clinic_id, 'Heinrich Rauch', 'Heinrich', 'Rauch', 'M', '1950-12-01', '5281011250', 'Neuro II', 'none', 'Aphasie & Apraxie. Logopädie 2x täglich.', 'de', 'active', true),
  (lkh_clinic_id, 'Elisabeth Schmid', 'Elisabeth', 'Schmid', 'W', '1985-08-14', '1920140885', 'Neuro II', 'none', 'Guillain-Barré-Syndrom in Remission.', 'de', 'active', true),
  (lkh_clinic_id, 'Werner Wallner', 'Werner', 'Wallner', 'M', '1959-04-03', '2301030459', 'Neuro II', 'bei_pflege_melden', 'Trachealkanüle. Absaugbereitschaft nötig.', 'de', 'active', true),
  (lkh_clinic_id, 'Christa Gruber', 'Christa', 'Gruber', 'W', '1972-11-20', '3910201172', 'Neuro II', 'none', 'Gleichgewichtstraining an C-Mill.', 'de', 'active', true),

  -- Neuro III (9 Patients)
  (lkh_clinic_id, 'Thomas Aigner', 'Thomas', 'Aigner', 'M', '1978-01-25', '1092250178', 'Neuro III', 'none', 'Z.n. Inkompletter Querschnitt L2.', 'de', 'active', true),
  (lkh_clinic_id, 'Brigitte Wimmer', 'Brigitte', 'Wimmer', 'W', '1960-07-08', '2190080760', 'Neuro III', 'schlechter_az_infektion', 'Fieberhafter Infekt. Nur Betttherapie.', 'de', 'active', true),
  (lkh_clinic_id, 'Gerhard Weber', 'Gerhard', 'Weber', 'M', '1953-09-17', '3810170953', 'Neuro III', 'none', 'Ergotherapie Therapieküche zum ADL-Test.', 'de', 'active', true),
  (lkh_clinic_id, 'Ingrid Wagner', 'Ingrid', 'Wagner', 'W', '1967-03-31', '4120310367', 'Neuro III', 'bei_pflege_melden', 'Orthostatischer Kollaps. Blutdruck vor Stehbett messen!', 'de', 'active', true),
  (lkh_clinic_id, 'Alexander Fuchs', 'Alexander', 'Fuchs', 'M', '1988-06-04', '5091040688', 'Neuro III', 'none', 'Z.n. Schädel hirntrauma. Robotergestütztes Armtraining.', 'de', 'active', true),
  (lkh_clinic_id, 'Hildegard Schneider', 'Hildegard', 'Schneider', 'W', '1948-10-15', '1820151048', 'Neuro III', 'none', 'Kognitive Dysphasie. Ruhige Umgebung erforderlich.', 'de', 'active', true),
  (lkh_clinic_id, 'Walter Schuster', 'Walter', 'Schuster', 'M', '1962-02-10', '2901100262', 'Neuro III', 'both', 'Norovirus Verdacht & Hohes Sturzrisiko!', 'de', 'active', true),
  (lkh_clinic_id, 'Veronika Winkler', 'Veronika', 'Winkler', 'W', '1975-05-22', '3780220575', 'Neuro III', 'none', 'Bädertherapie & Unterwassermassage.', 'de', 'active', true),
  (lkh_clinic_id, 'Martin Pichler', 'Martin', 'Pichler', 'M', '1971-12-04', '4910041271', 'Neuro III', 'none', 'Rehabilitation nach Kleinhirnblutung.', 'de', 'active', true)
  ON CONFLICT DO NOTHING;

END $$;

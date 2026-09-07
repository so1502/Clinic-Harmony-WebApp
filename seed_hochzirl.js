import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ggotnklnmuwxhzcxqurv.supabase.co";
const supabaseAnonKey = "sb_publishable_vuNP6yAqubV7S9dT3X3kfQ_Rp3bv_p9";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log("Signing in as Admin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@example.com",
    password: "Admin123!"
  });
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  console.log("Signed in successfully.");

  const clinicName = 'Ö. LKH Hochzirl – Natters (Neurologie HZ)';

  // 1. Check or Create Clinic
  let { data: existingClinic } = await supabase
    .from("clinics")
    .select("*")
    .eq("name", clinicName)
    .maybeSingle();

  let clinicId;
  if (existingClinic) {
    console.log("Found existing LKH Hochzirl clinic ID:", existingClinic.id);
    clinicId = existingClinic.id;
  } else {
    console.log("Creating LKH Hochzirl clinic...");
    const { data: newClinic, error: clinicErr } = await supabase
      .from("clinics")
      .insert({
        name: clinicName,
        address: 'Hochzirl 1, A-6170 Zirl',
        phone: '+43 50 504-0',
        email: 'neurologie.hochzirl@tirol-kliniken.at',
        country_code: 'AT'
      })
      .select()
      .single();
    if (clinicErr) {
      console.error("Error creating clinic:", clinicErr);
      return;
    }
    clinicId = newClinic.id;
    console.log("Created clinic ID:", clinicId);
  }

  // Update profile to have access or keep system_admin access
  console.log("Ensuring profile clinic access...");
  await supabase.from("profiles").update({ clinic_id: clinicId }).eq("id", authData.user.id);

  // 2. Therapy Types
  console.log("Seeding Therapy Types...");
  const therapyTypesData = [
    { clinic_id: clinicId, name: 'Physiotherapie (PT)', description: 'Physiotherapeutische Behandlung', duration_minutes: 45, color: '#3b82f6' },
    { clinic_id: clinicId, name: 'Logopädie (LP)', description: 'Sprach-, Sprech- und Schlucktherapie', duration_minutes: 45, color: '#eab308' },
    { clinic_id: clinicId, name: 'Ergotherapie (ET)', description: 'Motorisch-funktionelle & neuropsychologische ET', duration_minutes: 45, color: '#22c55e' },
    { clinic_id: clinicId, name: 'Robotik (R)', description: 'Ganzheitliche robotikgestützte Rehabilitation', duration_minutes: 60, color: '#6b7280' },
    { clinic_id: clinicId, name: 'Pflege', description: 'Pflegerische Unterstützung & Frühmobilisation', duration_minutes: 30, color: '#ef4444' },
    { clinic_id: clinicId, name: 'Bädertherapie', description: 'Hydrotherapie & Medizinische Bäder', duration_minutes: 45, color: '#f97316' }
  ];

  for (const tt of therapyTypesData) {
    const { data: existing } = await supabase.from("therapy_types").select("id").eq("clinic_id", clinicId).eq("name", tt.name).maybeSingle();
    if (!existing) {
      await supabase.from("therapy_types").insert(tt);
    }
  }

  // 3. Equipment Catalog
  console.log("Seeding Equipment Catalog...");
  const equipmentNames = [
    'Therapieliege', 'Stehtisch', 'Therapietisch & Sessel', 'Therapieküche',
    'ET-Materialien ADL', 'Gipsraum-Ausstattung', 'Seilzug & Hanteln', 'Lagerungsmaterial',
    'Stehbett & Schlingentisch', 'Gehbarren & Sprossenwand', 'C-Mill', 'hirob',
    'Armeo-Spring', 'Amadeo', 'Lokomat', 'ROBERT', 'Erigo', 'Armeo Power',
    'LP-Therapiematerial', 'ET-Materialien'
  ];

  const equipMap = {};
  for (const eqName of equipmentNames) {
    let { data: existing } = await supabase.from("equipment").select("id").eq("clinic_id", clinicId).eq("name", eqName).maybeSingle();
    if (!existing) {
      const { data: created } = await supabase.from("equipment").insert({ clinic_id: clinicId, name: eqName, status: 'active' }).select().single();
      equipMap[eqName] = created?.id;
    } else {
      equipMap[eqName] = existing.id;
    }
  }

  // 4. Rooms & Room Equipment
  console.log("Seeding Rooms...");
  const roomsData = [
    { name: '4-G0-113 (alle)', capacity: 3, equip: ['Therapieliege', 'Stehtisch'] },
    { name: '4-G0-035 (LP)', capacity: 1, equip: ['Therapietisch & Sessel'] },
    { name: '4-G0-036 (LP)', capacity: 1, equip: ['Therapietisch & Sessel'] },
    { name: '4-G0-037 (LP)', capacity: 1, equip: ['Therapietisch & Sessel', 'Therapieliege'] },
    { name: '4-G0-038 (LP)', capacity: 1, equip: ['Therapietisch & Sessel', 'Therapieliege'] },
    { name: '5-G1-005 (ET)', capacity: 4, equip: ['Therapieliege', 'Therapietisch & Sessel', 'Lagerungsmaterial', 'ET-Materialien'] },
    { name: '5-G1-009 (ET Therapieküche)', capacity: 2, equip: ['Therapieküche'] },
    { name: '5-G1-041 (ET ADL)', capacity: 1, equip: ['Therapieliege', 'ET-Materialien ADL'] },
    { name: '4-G2-010 (ET Gipsraum)', capacity: 1, equip: ['Therapieliege', 'Gipsraum-Ausstattung'] },
    { name: '4-G2-012 (PT)', capacity: 1, equip: ['Therapieliege', 'Seilzug & Hanteln'] },
    { name: '4-G2-013 (PT)', capacity: 3, equip: ['Therapieliege', 'Lagerungsmaterial'] },
    { name: '5-G2-003 (PT)', capacity: 2, equip: ['Therapieliege', 'Lagerungsmaterial'] },
    { name: '5-G2-005 (PT)', capacity: 2, equip: ['Therapieliege', 'Stehbett & Schlingentisch'] },
    { name: '5-G2-007 (PT)', capacity: 3, equip: ['Therapieliege', 'Gehbarren & Sprossenwand', 'Lagerungsmaterial'] },
    { name: '5-G2-009 (R)', capacity: 4, equip: ['C-Mill', 'hirob', 'Armeo-Spring', 'Amadeo', 'Therapieliege'] },
    { name: '5-G2-024 (R Lokomat/ROBERT)', capacity: 4, equip: ['Lokomat', 'ROBERT', 'Erigo', 'Armeo Power'] },
    { name: '5-G2-033 (LP)', capacity: 1, equip: ['Therapietisch & Sessel', 'Therapieliege', 'Lagerungsmaterial', 'LP-Therapiematerial'] },
    { name: '5-G2-031 (LP)', capacity: 1, equip: ['Therapietisch & Sessel'] }
  ];

  for (const r of roomsData) {
    let { data: room } = await supabase.from("rooms").select("id").eq("clinic_id", clinicId).eq("name", r.name).maybeSingle();
    if (!room) {
      const { data: createdRoom } = await supabase.from("rooms").insert({ clinic_id: clinicId, name: r.name, capacity: r.capacity }).select().single();
      room = createdRoom;
    }
    if (room) {
      for (const eqName of r.equip) {
        const eqId = equipMap[eqName];
        if (eqId) {
          await supabase.from("room_equipment").insert({ room_id: room.id, equipment_id: eqId }).select().maybeSingle();
        }
      }
    }
  }

  // 5. Therapists (15 Qualified Therapists)
  console.log("Seeding Therapists...");
  const therapistsData = [
    { clinic_id: clinicId, specialization: 'Physiotherapie (PT)', color: '#3b82f6', status: 'active', bio: 'PT Markus Huber - Schwerpunkte Neuro-Reha & Bobath' },
    { clinic_id: clinicId, specialization: 'Physiotherapie (PT)', color: '#3b82f6', status: 'active', bio: 'PT Sabine Hofer - Spezialistin für Gangschulung' },
    { clinic_id: clinicId, specialization: 'Physiotherapie (PT)', color: '#3b82f6', status: 'active', bio: 'PT Thomas Gruber - Schwerpunkte Manuelle Therapie' },
    { clinic_id: clinicId, specialization: 'Physiotherapie (PT)', color: '#3b82f6', status: 'active', bio: 'PT Laura Steiner - Schwerpunkte Gleichgewicht & Motorik' },
    { clinic_id: clinicId, specialization: 'Logopädie (LP)', color: '#eab308', status: 'active', bio: 'LP Elisabeth Pichler - Aphasie & Trachealkanülenmanagement' },
    { clinic_id: clinicId, specialization: 'Logopädie (LP)', color: '#eab308', status: 'active', bio: 'LP Michael Rauch - Dysphagietherapie & FEES' },
    { clinic_id: clinicId, specialization: 'Logopädie (LP)', color: '#eab308', status: 'active', bio: 'LP Anna Koller - Dysarthrie & Sprechapraxie' },
    { clinic_id: clinicId, specialization: 'Ergotherapie (ET)', color: '#22c55e', status: 'active', bio: 'ET Maria Schmid - Handfunktion & ADL-Training' },
    { clinic_id: clinicId, specialization: 'Ergotherapie (ET)', color: '#22c55e', status: 'active', bio: 'ET Christian Moser - Neuropsychologie & Kognition' },
    { clinic_id: clinicId, specialization: 'Ergotherapie (ET)', color: '#22c55e', status: 'active', bio: 'ET Julia Wallner - Hilfsmittelberatung & Schienenbau' },
    { clinic_id: clinicId, specialization: 'Robotik (R)', color: '#6b7280', status: 'active', bio: 'R-Therapeut Stefan Berger - Lokomat & C-Mill Spezialist' },
    { clinic_id: clinicId, specialization: 'Robotik (R)', color: '#6b7280', status: 'active', bio: 'R-Therapeutin Katharina Mayr - Armeo Power & Erigo' },
    { clinic_id: clinicId, specialization: 'Pflege', color: '#ef4444', status: 'active', bio: 'Pflegekraft David Egger - Aktivierend-therapeutische Pflege' },
    { clinic_id: clinicId, specialization: 'Pflege', color: '#ef4444', status: 'active', bio: 'Pflegekraft Birgit Plattner - Frühmobilisation & Bobath-Pflege' },
    { clinic_id: clinicId, specialization: 'Bädertherapie', color: '#f97316', status: 'active', bio: 'Bädertherapeut Florian Lindner - Hydro- & Balneotherapie' }
  ];

  for (const th of therapistsData) {
    const { data: existing } = await supabase.from("therapists").select("id").eq("clinic_id", clinicId).eq("bio", th.bio).maybeSingle();
    if (!existing) {
      await supabase.from("therapists").insert(th);
    }
  }

  // 6. Seed 25 Patients
  console.log("Seeding 25 Patients...");
  const patientsData = [
    // Neuro I (8)
    { clinic_id: clinicId, full_name: 'Karl Pichler', first_name: 'Karl', last_name: 'Pichler', gender: 'M', date_of_birth: '1958-04-12', ssn_svn: '1042120458', station: 'Neuro I', medical_alert: 'schlechter_az_infektion', notes: 'Isolationszimmer wegen MRSA. Frühestens ab 11:00 Frühstück im Bett.' },
    { clinic_id: clinicId, full_name: 'Johanna Hofer', first_name: 'Johanna', last_name: 'Hofer', gender: 'W', date_of_birth: '1965-09-23', ssn_svn: '2153230965', station: 'Neuro I', medical_alert: 'bei_pflege_melden', notes: 'Transfer nur mit 2 Pflegekräften. Bei Pflege melden!' },
    { clinic_id: clinicId, full_name: 'Franz Steiner', first_name: 'Franz', last_name: 'Steiner', gender: 'M', date_of_birth: '1952-11-05', ssn_svn: '3021051152', station: 'Neuro I', medical_alert: 'none', notes: 'Z.n. Insult re. Hemiparese links. Motivation hoch.' },
    { clinic_id: clinicId, full_name: 'Helga Bauer', first_name: 'Helga', last_name: 'Bauer', gender: 'W', date_of_birth: '1970-03-18', ssn_svn: '4192180370', station: 'Neuro I', medical_alert: 'none', notes: 'Dysphagie Grad II. Schluckkost Stufe 2.' },
    { clinic_id: clinicId, full_name: 'Stefan Egger', first_name: 'Stefan', last_name: 'Egger', gender: 'M', date_of_birth: '1982-07-30', ssn_svn: '5120300782', station: 'Neuro I', medical_alert: 'bei_pflege_melden', notes: 'Z.n. SHT Grad III. Rollstuhlpflichtig.' },
    { clinic_id: clinicId, full_name: 'Monika Koller', first_name: 'Monika', last_name: 'Koller', gender: 'W', date_of_birth: '1961-01-14', ssn_svn: '1402140161', station: 'Neuro I', medical_alert: 'none', notes: 'Multiple Sklerose (EDSS 4.5). Ermüdbar ab 14 Uhr.' },
    { clinic_id: clinicId, full_name: 'Anton Plattner', first_name: 'Anton', last_name: 'Plattner', gender: 'M', date_of_birth: '1949-08-27', ssn_svn: '2891270849', station: 'Neuro I', medical_alert: 'both', notes: 'Infektionsgefahr (VRE) & Sturzrisiko hoch! Bei Pflege melden!' },
    { clinic_id: clinicId, full_name: 'Renate Lindner', first_name: 'Renate', last_name: 'Lindner', gender: 'W', date_of_birth: '1955-12-09', ssn_svn: '3410091255', station: 'Neuro I', medical_alert: 'none', notes: 'Parkinson-Syndrom. Wirkungstief vor 10:00 Uhr.' },

    // Neuro II (8)
    { clinic_id: clinicId, full_name: 'Josef Mair', first_name: 'Josef', last_name: 'Mair', gender: 'M', date_of_birth: '1963-05-19', ssn_svn: '1182190563', station: 'Neuro II', medical_alert: 'none', notes: 'Z.n. SAB. Lokomat-Training bevorzugt.' },
    { clinic_id: clinicId, full_name: 'Maria Haider', first_name: 'Maria', last_name: 'Haider', gender: 'W', date_of_birth: '1974-10-02', ssn_svn: '2411021074', station: 'Neuro II', medical_alert: 'schlechter_az_infektion', notes: 'Schlechter AZ nach Krampfanfall.' },
    { clinic_id: clinicId, full_name: 'Peter Kofler', first_name: 'Peter', last_name: 'Kofler', gender: 'M', date_of_birth: '1956-02-28', ssn_svn: '3192280256', station: 'Neuro II', medical_alert: 'bei_pflege_melden', notes: 'Benötigt Hilfe beim Anziehen & Rollstuhl-Transfer.' },
    { clinic_id: clinicId, full_name: 'Gertraud Moser', first_name: 'Gertraud', last_name: 'Moser', gender: 'W', date_of_birth: '1968-06-11', ssn_svn: '4051110668', station: 'Neuro II', medical_alert: 'none', notes: 'Armeo-Spring Training verordnet.' },
    { clinic_id: clinicId, full_name: 'Heinrich Rauch', first_name: 'Heinrich', last_name: 'Rauch', gender: 'M', date_of_birth: '1950-12-01', ssn_svn: '5281011250', station: 'Neuro II', medical_alert: 'none', notes: 'Aphasie & Apraxie. Logopädie 2x täglich.' },
    { clinic_id: clinicId, full_name: 'Elisabeth Schmid', first_name: 'Elisabeth', last_name: 'Schmid', gender: 'W', date_of_birth: '1985-08-14', ssn_svn: '1920140885', station: 'Neuro II', medical_alert: 'none', notes: 'Guillain-Barré-Syndrom in Remission.' },
    { clinic_id: clinicId, full_name: 'Werner Wallner', first_name: 'Werner', last_name: 'Wallner', gender: 'M', date_of_birth: '1959-04-03', ssn_svn: '2301030459', station: 'Neuro II', medical_alert: 'bei_pflege_melden', notes: 'Trachealkanüle. Absaugbereitschaft nötig.' },
    { clinic_id: clinicId, full_name: 'Christa Gruber', first_name: 'Christa', last_name: 'Gruber', gender: 'W', date_of_birth: '1972-11-20', ssn_svn: '3910201172', station: 'Neuro II', medical_alert: 'none', notes: 'Gleichgewichtstraining an C-Mill.' },

    // Neuro III (9)
    { clinic_id: clinicId, full_name: 'Thomas Aigner', first_name: 'Thomas', last_name: 'Aigner', gender: 'M', date_of_birth: '1978-01-25', ssn_svn: '1092250178', station: 'Neuro III', medical_alert: 'none', notes: 'Z.n. Inkompletter Querschnitt L2.' },
    { clinic_id: clinicId, full_name: 'Brigitte Wimmer', first_name: 'Brigitte', last_name: 'Wimmer', gender: 'W', date_of_birth: '1960-07-08', ssn_svn: '2190080760', station: 'Neuro III', medical_alert: 'schlechter_az_infektion', notes: 'Fieberhafter Infekt. Nur Betttherapie.' },
    { clinic_id: clinicId, full_name: 'Gerhard Weber', first_name: 'Gerhard', last_name: 'Weber', gender: 'M', date_of_birth: '1953-09-17', ssn_svn: '3810170953', station: 'Neuro III', medical_alert: 'none', notes: 'Ergotherapie Therapieküche zum ADL-Test.' },
    { clinic_id: clinicId, full_name: 'Ingrid Wagner', first_name: 'Ingrid', last_name: 'Wagner', gender: 'W', date_of_birth: '1967-03-31', ssn_svn: '4120310367', station: 'Neuro III', medical_alert: 'bei_pflege_melden', notes: 'Orthostatischer Kollaps. Blutdruck vor Stehbett messen!' },
    { clinic_id: clinicId, full_name: 'Alexander Fuchs', first_name: 'Alexander', last_name: 'Fuchs', gender: 'M', date_of_birth: '1988-06-04', ssn_svn: '5091040688', station: 'Neuro III', medical_alert: 'none', notes: 'Z.n. Schädelhirntrauma. Robotergestütztes Armtraining.' },
    { clinic_id: clinicId, full_name: 'Hildegard Schneider', first_name: 'Hildegard', last_name: 'Schneider', gender: 'W', date_of_birth: '1948-10-15', ssn_svn: '1820151048', station: 'Neuro III', medical_alert: 'none', notes: 'Kognitive Dysphasie. Ruhige Umgebung erforderlich.' },
    { clinic_id: clinicId, full_name: 'Walter Schuster', first_name: 'Walter', last_name: 'Schuster', gender: 'M', date_of_birth: '1962-02-10', ssn_svn: '2901100262', station: 'Neuro III', medical_alert: 'both', notes: 'Norovirus Verdacht & Hohes Sturzrisiko!' },
    { clinic_id: clinicId, full_name: 'Veronika Winkler', first_name: 'Veronika', last_name: 'Winkler', gender: 'W', date_of_birth: '1975-05-22', ssn_svn: '3780220575', station: 'Neuro III', medical_alert: 'none', notes: 'Bädertherapie & Unterwassermassage.' },
    { clinic_id: clinicId, full_name: 'Martin Pichler', first_name: 'Martin', last_name: 'Pichler', gender: 'M', date_of_birth: '1971-12-04', ssn_svn: '4910041271', station: 'Neuro III', medical_alert: 'none', notes: 'Rehabilitation nach Kleinhirnblutung.' }
  ];

  for (const p of patientsData) {
    const { data: existing } = await supabase.from("patients").select("id").eq("clinic_id", clinicId).eq("full_name", p.full_name).maybeSingle();
    if (!existing) {
      await supabase.from("patients").insert({ ...p, status: 'active', is_active: true });
    } else {
      await supabase.from("patients").update({ station: p.station, medical_alert: p.medical_alert, notes: p.notes }).eq("id", existing.id);
    }
  }

  console.log("Seeding complete! LKH Hochzirl is fully configured.");
}

seed().catch(console.error);

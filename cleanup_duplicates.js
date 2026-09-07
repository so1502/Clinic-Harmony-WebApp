import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ggotnklnmuwxhzcxqurv.supabase.co";
const supabaseAnonKey = "sb_publishable_vuNP6yAqubV7S9dT3X3kfQ_Rp3bv_p9";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanupDuplicates() {
  console.log("Signing in as System Admin...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin@example.com",
    password: "Admin123!"
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  console.log("Checking clinics...");
  const { data: clinics } = await supabase
    .from("clinics")
    .select("id, name, created_at")
    .ilike("name", "%LKH Hochzirl%")
    .order("created_at", { ascending: true });

  if (!clinics || clinics.length === 0) {
    console.log("No LKH Hochzirl clinics found.");
    return;
  }

  console.log(`Found ${clinics.length} clinic(s) for LKH Hochzirl.`);
  const targetClinicId = clinics[0].id;
  console.log("Primary Target Clinic ID:", targetClinicId);

  // If duplicate clinics exist, reassign everything to targetClinicId and delete extra clinics
  if (clinics.length > 1) {
    for (let i = 1; i < clinics.length; i++) {
      const extraId = clinics[i].id;
      console.log(`Consolidating extra clinic ID ${extraId} into ${targetClinicId}...`);
      await supabase.from("profiles").update({ clinic_id: targetClinicId }).eq("clinic_id", extraId);
      await supabase.from("rooms").update({ clinic_id: targetClinicId }).eq("clinic_id", extraId);
      await supabase.from("equipment").update({ clinic_id: targetClinicId }).eq("clinic_id", extraId);
      await supabase.from("therapists").update({ clinic_id: targetClinicId }).eq("clinic_id", extraId);
      await supabase.from("patients").update({ clinic_id: targetClinicId }).eq("clinic_id", extraId);
      await supabase.from("therapy_types").update({ clinic_id: targetClinicId }).eq("clinic_id", extraId);
      await supabase.from("appointments").update({ clinic_id: targetClinicId }).eq("clinic_id", extraId);

      await supabase.from("clinics").delete().eq("id", extraId);
    }
  }

  // 1. Cleanup Duplicate Therapy Types
  console.log("Deduplicating Therapy Types...");
  const { data: therapyTypes } = await supabase.from("therapy_types").select("*").eq("clinic_id", targetClinicId);
  const ttMap = new Map();
  if (therapyTypes) {
    for (const tt of therapyTypes) {
      if (!ttMap.has(tt.name)) {
        ttMap.set(tt.name, tt.id);
      } else {
        const keeperId = ttMap.get(tt.name);
        console.log(`Removing duplicate Therapy Type "${tt.name}" (${tt.id}) -> keeper ${keeperId}`);
        await supabase.from("appointments").update({ therapy_type_id: keeperId }).eq("therapy_type_id", tt.id);
        await supabase.from("therapy_type_equipment").delete().eq("therapy_type_id", tt.id);
        await supabase.from("therapy_types").delete().eq("id", tt.id);
      }
    }
  }

  // 2. Cleanup Duplicate Equipment
  console.log("Deduplicating Equipment...");
  const { data: equipmentList } = await supabase.from("equipment").select("*").eq("clinic_id", targetClinicId);
  const eqMap = new Map();
  if (equipmentList) {
    for (const eq of equipmentList) {
      if (!eqMap.has(eq.name)) {
        eqMap.set(eq.name, eq.id);
      } else {
        const keeperId = eqMap.get(eq.name);
        console.log(`Removing duplicate Equipment "${eq.name}" (${eq.id}) -> keeper ${keeperId}`);
        await supabase.from("room_equipment").delete().eq("equipment_id", eq.id);
        await supabase.from("therapy_type_equipment").delete().eq("equipment_id", eq.id);
        await supabase.from("equipment").delete().eq("id", eq.id);
      }
    }
  }

  // 3. Cleanup Duplicate Rooms
  console.log("Deduplicating Rooms...");
  const { data: roomsList } = await supabase.from("rooms").select("*").eq("clinic_id", targetClinicId);
  const roomMap = new Map();
  if (roomsList) {
    for (const r of roomsList) {
      if (!roomMap.has(r.name)) {
        roomMap.set(r.name, r.id);
      } else {
        const keeperId = roomMap.get(r.name);
        console.log(`Removing duplicate Room "${r.name}" (${r.id}) -> keeper ${keeperId}`);
        await supabase.from("appointments").update({ room_id: keeperId }).eq("room_id", r.id);
        await supabase.from("room_equipment").delete().eq("room_id", r.id);
        await supabase.from("rooms").delete().eq("id", r.id);
      }
    }
  }

  // 4. Cleanup Duplicate Therapists
  console.log("Deduplicating Therapists...");
  const { data: therapistsList } = await supabase.from("therapists").select("*").eq("clinic_id", targetClinicId);
  const thMap = new Map();
  if (therapistsList) {
    for (const th of therapistsList) {
      const key = th.user_id || th.bio || th.specialization;
      if (!thMap.has(key)) {
        thMap.set(key, th.id);
      } else {
        const keeperId = thMap.get(key);
        console.log(`Removing duplicate Therapist (${th.id}) -> keeper ${keeperId}`);
        await supabase.from("appointments").update({ therapist_id: keeperId }).eq("therapist_id", th.id);
        await supabase.from("therapists").delete().eq("id", th.id);
      }
    }
  }

  // 5. Cleanup Duplicate Patients
  console.log("Deduplicating Patients...");
  const { data: patientsList } = await supabase.from("patients").select("*").eq("clinic_id", targetClinicId);
  const patMap = new Map();
  if (patientsList) {
    for (const p of patientsList) {
      if (!patMap.has(p.full_name)) {
        patMap.set(p.full_name, p.id);
      } else {
        const keeperId = patMap.get(p.full_name);
        console.log(`Removing duplicate Patient "${p.full_name}" (${p.id}) -> keeper ${keeperId}`);
        await supabase.from("appointments").update({ patient_id: keeperId }).eq("patient_id", p.id);
        await supabase.from("patients").delete().eq("id", p.id);
      }
    }
  }

  // Summary counts
  const { count: finalRooms } = await supabase.from("rooms").select("*", { count: "exact", head: true }).eq("clinic_id", targetClinicId);
  const { count: finalEq } = await supabase.from("equipment").select("*", { count: "exact", head: true }).eq("clinic_id", targetClinicId);
  const { count: finalTT } = await supabase.from("therapy_types").select("*", { count: "exact", head: true }).eq("clinic_id", targetClinicId);
  const { count: finalTh } = await supabase.from("therapists").select("*", { count: "exact", head: true }).eq("clinic_id", targetClinicId);
  const { count: finalPat } = await supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", targetClinicId);

  console.log("\n=== FINAL CLEANUP SUMMARY FOR LKH HOCHZIRL ===");
  console.log(`Therapy Types: ${finalTT}`);
  console.log(`Rooms:         ${finalRooms}`);
  console.log(`Equipment:     ${finalEq}`);
  console.log(`Therapists:    ${finalTh}`);
  console.log(`Patients:      ${finalPat}`);
  console.log("===============================================\n");
}

cleanupDuplicates().catch(console.error);

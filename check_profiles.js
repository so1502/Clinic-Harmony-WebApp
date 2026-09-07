import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ggotnklnmuwxhzcxqurv.supabase.co";
const supabaseAnonKey = "sb_publishable_vuNP6yAqubV7S9dT3X3kfQ_Rp3bv_p9";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProfiles() {
  await supabase.auth.signInWithPassword({
    email: "admin@example.com",
    password: "Admin123!"
  });

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id")
    .ilike("name", "%LKH Hochzirl%")
    .single();

  console.log("LKH Hochzirl Clinic ID:", clinic.id);

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, clinic_id")
    .ilike("email", "%hochzirl%");

  console.log("Found profiles:", profiles);
  console.log("Query error:", error);

  // Perform direct update
  if (profiles) {
    for (const p of profiles) {
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ clinic_id: clinic.id, full_name: p.full_name || p.email.split("@")[0] })
        .eq("id", p.id);
      console.log(`Updated ${p.email} (id: ${p.id}):`, upErr || "SUCCESS");
    }
  }
}

checkProfiles().catch(console.error);

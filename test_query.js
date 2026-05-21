import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ggotnklnmuwxhzcxqurv.supabase.co";
const supabaseAnonKey = "sb_publishable_vuNP6yAqubV7S9dT3X3kfQ_Rp3bv_p9";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Signing in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "clinic.admin@example.com",
    password: "ClinicAdmin123!"
  });
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  console.log("Signed in successfully.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  const clinicId = profile.clinic_id;

  console.log("Cleaning up appointments on 2026-06-15...");
  const { error: delErr } = await supabase
    .from("appointments")
    .delete()
    .eq("clinic_id", clinicId)
    .gte("start_time", "2026-06-15T00:00:00+00:00")
    .lte("start_time", "2026-06-15T23:59:59+00:00");

  if (delErr) {
    console.error("Cleanup failed:", delErr);
  } else {
    console.log("Cleanup successful.");
  }
}

run();

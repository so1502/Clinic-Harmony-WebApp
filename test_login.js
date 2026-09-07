import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ggotnklnmuwxhzcxqurv.supabase.co";
const supabaseAnonKey = "sb_publishable_vuNP6yAqubV7S9dT3X3kfQ_Rp3bv_p9";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAdminLogin() {
  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: "admin.hochzirl@tirol-kliniken.at",
    password: "Hochzirl123!"
  });

  if (error) {
    console.error("Login failed:", error);
    return;
  }

  console.log("Logged in successfully as LKH Hochzirl Clinic Admin!");
  console.log("User ID:", auth.user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, clinics(name)")
    .eq("id", auth.user.id)
    .single();

  console.log("Profile details:", profile);

  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("full_name, email, user_roles(role)")
    .eq("clinic_id", profile.clinic_id);

  console.log(`Found ${teamMembers?.length || 0} team members in LKH Hochzirl:`);
  teamMembers?.forEach(m => console.log(` - ${m.full_name} (${m.email})`));
}

testAdminLogin().catch(console.error);

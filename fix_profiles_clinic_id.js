import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ggotnklnmuwxhzcxqurv.supabase.co";
const supabaseAnonKey = "sb_publishable_vuNP6yAqubV7S9dT3X3kfQ_Rp3bv_p9";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Signing in as System Admin...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin@example.com",
    password: "Admin123!"
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id")
    .ilike("name", "%LKH Hochzirl%")
    .single();

  const clinicId = clinic.id;
  console.log("LKH Hochzirl Clinic ID:", clinicId);

  // Sign in as each user once to update their own profile (since RLS allows users to update own profile)
  const users = [
    { email: "admin.hochzirl@tirol-kliniken.at", pass: "Hochzirl123!", name: "Dr. Andreas Mayr (Klinikleitung)" },
    { email: "pt.huber@lkh-hochzirl.at", pass: "Therapist123!", name: "PT Markus Huber" },
    { email: "pt.hofer@lkh-hochzirl.at", pass: "Therapist123!", name: "PT Sabine Hofer" },
    { email: "pt.gruber@lkh-hochzirl.at", pass: "Therapist123!", name: "PT Thomas Gruber" },
    { email: "pt.steiner@lkh-hochzirl.at", pass: "Therapist123!", name: "PT Laura Steiner" },
    { email: "lp.pichler@lkh-hochzirl.at", pass: "Therapist123!", name: "LP Elisabeth Pichler" },
    { email: "lp.rauch@lkh-hochzirl.at", pass: "Therapist123!", name: "LP Michael Rauch" },
    { email: "lp.koller@lkh-hochzirl.at", pass: "Therapist123!", name: "LP Anna Koller" },
    { email: "et.schmid@lkh-hochzirl.at", pass: "Therapist123!", name: "ET Maria Schmid" },
    { email: "et.moser@lkh-hochzirl.at", pass: "Therapist123!", name: "ET Christian Moser" },
    { email: "et.wallner@lkh-hochzirl.at", pass: "Therapist123!", name: "ET Julia Wallner" },
    { email: "r.berger@lkh-hochzirl.at", pass: "Therapist123!", name: "R Stefan Berger" },
    { email: "r.mayr@lkh-hochzirl.at", pass: "Therapist123!", name: "R Katharina Mayr" },
    { email: "pflege.egger@lkh-hochzirl.at", pass: "Therapist123!", name: "Pflege David Egger" },
    { email: "pflege.plattner@lkh-hochzirl.at", pass: "Therapist123!", name: "Pflege Birgit Plattner" },
    { email: "baeder.lindner@lkh-hochzirl.at", pass: "Therapist123!", name: "Bäder Florian Lindner" }
  ];

  for (const u of users) {
    const { data: userAuth, error: loginErr } = await supabase.auth.signInWithPassword({
      email: u.email,
      password: u.pass
    });

    if (loginErr || !userAuth?.user) {
      console.error(`Login error for ${u.email}:`, loginErr);
      continue;
    }

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ clinic_id: clinicId, full_name: u.name })
      .eq("id", userAuth.user.id);

    if (profileErr) {
      console.error(`Profile error for ${u.email}:`, profileErr);
    } else {
      console.log(`Successfully assigned ${u.email} to LKH Hochzirl clinic!`);
    }
  }

  console.log("All LKH Hochzirl profiles successfully linked to clinic!");
}

run().catch(console.error);

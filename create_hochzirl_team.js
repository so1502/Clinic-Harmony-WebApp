import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ggotnklnmuwxhzcxqurv.supabase.co";
const supabaseAnonKey = "sb_publishable_vuNP6yAqubV7S9dT3X3kfQ_Rp3bv_p9";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupHochzirlAdminAndTeam() {
  console.log("Signing in as System Admin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@example.com",
    password: "Admin123!"
  });

  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  console.log("Signed in successfully as System Admin.");

  // Get LKH Hochzirl clinic ID
  const { data: clinic, error: clinicErr } = await supabase
    .from("clinics")
    .select("id")
    .ilike("name", "%LKH Hochzirl%")
    .single();

  if (clinicErr || !clinic) {
    console.error("Could not find LKH Hochzirl clinic:", clinicErr);
    return;
  }

  const clinicId = clinic.id;
  console.log("LKH Hochzirl Clinic ID:", clinicId);

  // 1. Create Dedicated LKH Hochzirl Clinic Admin User
  const adminEmail = "admin.hochzirl@tirol-kliniken.at";
  const adminPassword = "Hochzirl123!";

  console.log(`Checking/Creating Auth User for ${adminEmail}...`);
  let { data: adminAuth, error: signUpErr } = await supabase.auth.signUp({
    email: adminEmail,
    password: adminPassword,
    options: {
      data: {
        full_name: "Dr. Andreas Mayr"
      }
    }
  });

  let adminUserId = adminAuth?.user?.id;

  if (signUpErr || !adminUserId) {
    const { data: adminSignIn } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });
    adminUserId = adminSignIn?.user?.id;
    await supabase.auth.signInWithPassword({
      email: "admin@example.com",
      password: "Admin123!"
    });
  }

  if (adminUserId) {
    console.log("Setting up Profile and Role for Clinic Admin ID:", adminUserId);
    await supabase.from("profiles").upsert({
      id: adminUserId,
      email: adminEmail,
      full_name: "Dr. Andreas Mayr (Klinikleitung)",
      clinic_id: clinicId
    });

    await supabase.from("user_roles").upsert({
      user_id: adminUserId,
      role: "clinic_admin"
    }, { onConflict: "user_id,role" });
  }

  // 2. List of 15 Team Therapists to create in Auth, Profiles, UserRoles, and Therapists
  const teamList = [
    { name: "PT Markus Huber", email: "pt.huber@lkh-hochzirl.at", spec: "Physiotherapie (PT)", color: "#3b82f6", bio: "PT Markus Huber - Schwerpunkte Neuro-Reha & Bobath" },
    { name: "PT Sabine Hofer", email: "pt.hofer@lkh-hochzirl.at", spec: "Physiotherapie (PT)", color: "#3b82f6", bio: "PT Sabine Hofer - Spezialistin für Gangschulung" },
    { name: "PT Thomas Gruber", email: "pt.gruber@lkh-hochzirl.at", spec: "Physiotherapie (PT)", color: "#3b82f6", bio: "PT Thomas Gruber - Schwerpunkte Manuelle Therapie" },
    { name: "PT Laura Steiner", email: "pt.steiner@lkh-hochzirl.at", spec: "Physiotherapie (PT)", color: "#3b82f6", bio: "PT Laura Steiner - Schwerpunkte Gleichgewicht & Motorik" },
    { name: "LP Elisabeth Pichler", email: "lp.pichler@lkh-hochzirl.at", spec: "Logopädie (LP)", color: "#eab308", bio: "LP Elisabeth Pichler - Aphasie & Trachealkanülenmanagement" },
    { name: "LP Michael Rauch", email: "lp.rauch@lkh-hochzirl.at", spec: "Logopädie (LP)", color: "#eab308", bio: "LP Michael Rauch - Dysphagietherapie & FEES" },
    { name: "LP Anna Koller", email: "lp.koller@lkh-hochzirl.at", spec: "Logopädie (LP)", color: "#eab308", bio: "LP Anna Koller - Dysarthrie & Sprechapraxie" },
    { name: "ET Maria Schmid", email: "et.schmid@lkh-hochzirl.at", spec: "Ergotherapie (ET)", color: "#22c55e", bio: "ET Maria Schmid - Handfunktion & ADL-Training" },
    { name: "ET Christian Moser", email: "et.moser@lkh-hochzirl.at", spec: "Ergotherapie (ET)", color: "#22c55e", bio: "ET Christian Moser - Neuropsychologie & Kognition" },
    { name: "ET Julia Wallner", email: "et.wallner@lkh-hochzirl.at", spec: "Ergotherapie (ET)", color: "#22c55e", bio: "ET Julia Wallner - Hilfsmittelberatung & Schienenbau" },
    { name: "R Stefan Berger", email: "r.berger@lkh-hochzirl.at", spec: "Robotik (R)", color: "#6b7280", bio: "R-Therapeut Stefan Berger - Lokomat & C-Mill Spezialist" },
    { name: "R Katharina Mayr", email: "r.mayr@lkh-hochzirl.at", spec: "Robotik (R)", color: "#6b7280", bio: "R-Therapeutin Katharina Mayr - Armeo Power & Erigo" },
    { name: "Pflege David Egger", email: "pflege.egger@lkh-hochzirl.at", spec: "Pflege", color: "#ef4444", bio: "Pflegekraft David Egger - Aktivierend-therapeutische Pflege" },
    { name: "Pflege Birgit Plattner", email: "pflege.plattner@lkh-hochzirl.at", spec: "Pflege", color: "#ef4444", bio: "Pflegekraft Birgit Plattner - Frühmobilisation & Bobath-Pflege" },
    { name: "Bäder Florian Lindner", email: "baeder.lindner@lkh-hochzirl.at", spec: "Bädertherapie", color: "#f97316", bio: "Bädertherapeut Florian Lindner - Hydro- & Balneotherapie" }
  ];

  console.log(`Creating ${teamList.length} Team Members...`);

  for (const item of teamList) {
    let thUserId;
    const password = "Therapist123!";

    const { data: thAuth, error: thSignUpErr } = await supabase.auth.signUp({
      email: item.email,
      password: password,
      options: { data: { full_name: item.name } }
    });

    thUserId = thAuth?.user?.id;
    if (thSignUpErr || !thUserId) {
      const { data: thSignIn } = await supabase.auth.signInWithPassword({
        email: item.email,
        password: password
      });
      thUserId = thSignIn?.user?.id;
      await supabase.auth.signInWithPassword({
        email: "admin@example.com",
        password: "Admin123!"
      });
    }

    if (thUserId) {
      // 1. Profile
      await supabase.from("profiles").upsert({
        id: thUserId,
        email: item.email,
        full_name: item.name,
        clinic_id: clinicId
      });

      // 2. User Role
      await supabase.from("user_roles").upsert({
        user_id: thUserId,
        role: "therapist"
      }, { onConflict: "user_id,role" });

      // 3. Therapist entry
      const { data: existingTh } = await supabase
        .from("therapists")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("user_id", thUserId)
        .maybeSingle();

      if (!existingTh) {
        await supabase.from("therapists").insert({
          user_id: thUserId,
          clinic_id: clinicId,
          specialization: item.spec,
          color: item.color,
          bio: item.bio,
          status: "active"
        });
      }
    }
  }

  console.log("All 15 Team Members and Clinic Admin successfully created!");
}

setupHochzirlAdminAndTeam().catch(console.error);

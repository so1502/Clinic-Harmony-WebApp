import { chromium } from 'playwright';

async function run() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER LOG] [${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER ERROR] ${err.stack}`);
  });

  try {
    console.log("Navigating to http://localhost:5173/ ...");
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

    // Click "Anmelden" link
    await page.click('text=Anmelden');
    await page.waitForTimeout(500);

    // Enter credentials
    await page.fill('input[type="email"]', 'clinic.admin@example.com');
    await page.fill('input[type="password"]', 'ClinicAdmin123!');
    await page.click('button[type="submit"]');
    
    // Wait for URL to change to dashboard or home
    await page.waitForURL('**/dashboard**', { timeout: 5000 });
    console.log("Logged in successfully.");

    await page.waitForTimeout(1000);
    await page.click('a[href="/dashboard/calendar"]');
    await page.waitForTimeout(2000);

    // Let's create an appointment!
    // Open Dialog
    await page.click('text=Neuer Termin');
    await page.waitForTimeout(1000);

    // Get patients and therapists options
    await page.click('button:has-text("Patient auswählen")');
    await page.waitForTimeout(500);
    const patientOptions = await page.locator('[role="option"]:visible').allInnerTexts();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await page.click('button:has-text("Therapeut auswählen")');
    await page.waitForTimeout(500);
    const therapistOptions = await page.locator('[role="option"]:visible').allInnerTexts();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await page.click('text=Abbrechen');
    await page.waitForTimeout(500);

    const testDate = '2026-06-15';
    const testStart = '10:00';
    const testEnd = '11:00';

    const p1 = patientOptions[0];
    const p2 = patientOptions[1];
    const p3 = patientOptions[2] || patientOptions[0];
    
    const t1 = therapistOptions[0];
    const t2 = therapistOptions[1] || therapistOptions[0];
    const t3 = therapistOptions[2] || therapistOptions[0];

    const rName = "P1001";

    // 1st book
    console.log(`\nBooking 1st: Patient=${p1}, Therapist=${t1}, Room=${rName}`);
    await page.click('text=Neuer Termin');
    await page.waitForTimeout(500);

    await page.click('button:has-text("Patient auswählen")');
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:visible').filter({ hasText: p1 }).click();
    await page.waitForTimeout(300);

    await page.click('button:has-text("Therapeut auswählen")');
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:visible').filter({ hasText: t1 }).click();
    await page.waitForTimeout(300);

    await page.fill('input[type="date"]', testDate);
    await page.fill('input[type="time"] >> nth=0', testStart);
    await page.fill('input[type="time"] >> nth=1', testEnd);
    await page.waitForTimeout(1000);

    // Log all button texts in form
    const formButtons = await page.locator('form button').allInnerTexts();
    console.log("Form buttons found:", formButtons);

    // Click P1001 in suggested directly
    console.log("Clicking P1001 in suggested list...");
    await page.locator('form').locator(`button:has-text("${rName}")`).first().click({ force: true });
    await page.waitForTimeout(500);

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log("1st book saved.");

    // 2nd book
    console.log(`\nBooking 2nd: Patient=${p2}, Therapist=${t2}, Room=${rName}`);
    await page.click('text=Neuer Termin');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'C:/Users/osoys/Documents/GitHub/Clinic-Harmony-WebApp/after_click_neuer_termin.png' });
    console.log("Is Dialog open after clicking Neuer Termin?", await page.locator('[role="dialog"]').first().isVisible());

    await page.click('button:has-text("Patient auswählen")');
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:visible').filter({ hasText: p2 }).click();
    await page.waitForTimeout(300);

    await page.click('button:has-text("Therapeut auswählen")');
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:visible').filter({ hasText: t2 }).click();
    await page.waitForTimeout(300);

    await page.fill('input[type="date"]', testDate);
    await page.fill('input[type="time"] >> nth=0', testStart);
    await page.fill('input[type="time"] >> nth=1', testEnd);
    await page.waitForTimeout(1500);

    // Open "Alle Räume anzeigen"
    console.log("Opening all rooms dialog...");
    await page.click('button:has-text("Alle Räume")');
    await page.waitForTimeout(1000);

    // Take screenshot of dialog
    console.log("Taking screenshot of subdialog...");
    await page.screenshot({ path: 'C:/Users/osoys/Documents/GitHub/Clinic-Harmony-WebApp/subdialog.png' });

    // Print all buttons in the sub-dialog
    const dialogButtons = await page.locator('div[role="dialog"]').allInnerTexts();
    console.log("Dialog contents:", dialogButtons);

    // Let's find room button inside the sub-dialog specifically
    const subDialog = page.locator('div[role="dialog"]').last();
    const roomBtn = subDialog.locator(`button:has-text("${rName}")`).first();
    console.log("Does room button exist in sub-dialog?", await roomBtn.count() > 0);
    if (await roomBtn.count() > 0) {
      console.log("Room button text:", await roomBtn.innerText());
      await roomBtn.click({ force: true });
      await page.waitForTimeout(500);
    }

    // Submit
    console.log("Submitting 2nd form...");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log("Is EventDialog visible after 2nd submit?", await page.locator('form').isVisible());
    let toastMsg = await page.locator('[data-sonner-toast]').allInnerTexts();
    console.log(`Toast messages visible after 2nd submit:`, toastMsg);

    // 3rd: Attempt Patient double-booking
    console.log(`\nBooking 3rd (Expect Patient Conflict): Patient=${p1} (already booked), Therapist=${t3}, Room=P1002`);
    await page.click('text=Neuer Termin');
    await page.waitForTimeout(1000);

    await page.click('button:has-text("Patient auswählen")');
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:visible').filter({ hasText: p1 }).click();
    await page.waitForTimeout(300);

    await page.click('button:has-text("Therapeut auswählen")');
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:visible').filter({ hasText: t3 }).click();
    await page.waitForTimeout(300);

    await page.fill('input[type="date"]', testDate);
    await page.fill('input[type="time"] >> nth=0', testStart);
    await page.fill('input[type="time"] >> nth=1', testEnd);
    await page.waitForTimeout(1000);

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log("Is EventDialog visible after 3rd submit?", await page.locator('form').isVisible());
    toastMsg = await page.locator('[data-sonner-toast]').allInnerTexts();
    console.log(`Toast messages visible after 3rd submit:`, toastMsg);

    // Cancel 3rd booking dialog
    await page.click('text=Abbrechen');
    await page.waitForTimeout(1000);

    // 4th: Attempt Therapist double-booking
    console.log(`\nBooking 4th (Expect Therapist Conflict): Patient=${p3}, Therapist=${t1} (already booked), Room=P1002`);
    await page.click('text=Neuer Termin');
    await page.waitForTimeout(1000);

    await page.click('button:has-text("Patient auswählen")');
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:visible').filter({ hasText: p3 }).click();
    await page.waitForTimeout(300);

    await page.click('button:has-text("Therapeut auswählen")');
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:visible').filter({ hasText: t1 }).click();
    await page.waitForTimeout(300);

    await page.fill('input[type="date"]', testDate);
    await page.fill('input[type="time"] >> nth=0', testStart);
    await page.fill('input[type="time"] >> nth=1', testEnd);
    await page.waitForTimeout(1000);

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log("Is EventDialog visible after 4th submit?", await page.locator('form').isVisible());
    toastMsg = await page.locator('[data-sonner-toast]').allInnerTexts();
    console.log(`Toast messages visible after 4th submit:`, toastMsg);

    // Cancel 4th booking dialog
    await page.click('text=Abbrechen');
    await page.waitForTimeout(1000);

    // 5th: Attempt Room over-capacity booking
    console.log(`\nBooking 5th (Expect Room over-capacity conflict): Patient=${p3}, Therapist=${t3}, Room=${rName} (capacity 2, already has 2)`);
    await page.click('text=Neuer Termin');
    await page.waitForTimeout(1000);

    await page.click('button:has-text("Patient auswählen")');
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:visible').filter({ hasText: p3 }).click();
    await page.waitForTimeout(300);

    await page.click('button:has-text("Therapeut auswählen")');
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:visible').filter({ hasText: t3 }).click();
    await page.waitForTimeout(300);

    await page.fill('input[type="date"]', testDate);
    await page.fill('input[type="time"] >> nth=0', testStart);
    await page.fill('input[type="time"] >> nth=1', testEnd);
    await page.waitForTimeout(1000);

    // Let's open "Alle Räume" dialog to try to click P1001 (which is red)
    await page.click('button:has-text("Alle Räume")');
    await page.waitForTimeout(1000);
    const subDialog5 = page.locator('div[role="dialog"]').last();
    const roomBtn5 = subDialog5.locator(`button:has-text("${rName}")`).first();
    console.log("Is room button present in subdialog?", await roomBtn5.count() > 0);
    if (await roomBtn5.count() > 0) {
      console.log("Room button text:", await roomBtn5.innerText());
      // Click P1001 (should show error toast because it is red)
      await roomBtn5.click({ force: true });
      await page.waitForTimeout(1000);
      toastMsg = await page.locator('[data-sonner-toast]').allInnerTexts();
      console.log(`Toast messages visible after clicking red room:`, toastMsg);
    }

    // Cancel 5th booking dialog
    const cancelBtn = page.locator('div[role="dialog"]').last().locator('button:has-text("Abbrechen")').first();
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
    await page.click('text=Abbrechen');
    await page.waitForTimeout(1000);

  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    await browser.close();
  }
}

run();

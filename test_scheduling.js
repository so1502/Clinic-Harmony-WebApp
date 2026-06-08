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

    console.log("Current URL:", page.url());
    
    // Click "Anmelden" link
    console.log("Clicking 'Anmelden' link...");
    await page.click('text=Anmelden');
    await page.waitForTimeout(1000);
    console.log("Current URL after clicking Anmelden:", page.url());

    // Enter credentials
    console.log("Entering email and password...");
    await page.fill('input[type="email"]', 'clinic.admin@example.com');
    await page.fill('input[type="password"]', 'ClinicAdmin123!');
    
    // Click submit button
    console.log("Clicking login submit button...");
    await page.click('button[type="submit"]');
    
    // Wait for URL to change to dashboard or home
    await page.waitForURL('**/dashboard**', { timeout: 5000 });
    console.log("Successfully logged in! Current URL:", page.url());

    // Wait a bit for queries to load
    await page.waitForTimeout(2000);

    // Let's navigate to calendar by clicking the Calendar sidebar link
    console.log("Navigating to Calendar...");
    // Find calendar link in dashboard sidebar. German translation might say "Kalender"
    await page.click('a[href="/dashboard/calendar"]');
    await page.waitForTimeout(2000);
    console.log("Current URL is Calendar:", page.url());

    // Let's create an appointment!
    // Click "Neuer Termin" (New Event button)
    console.log("Clicking 'Neuer Termin' button...");
    await page.click('text=Neuer Termin');
    await page.waitForTimeout(1000);

    // Check if dialog is visible
    console.log("Checking if Dialog is open...");
    const dialogTitle = page.locator('h2');
    console.log("Dialog Header Text:", await dialogTitle.first().innerText());

    // Fill in the form:
    // Select patient: since patient dropdown is custom Select, we need to click it and select option
    console.log("Selecting Patient...");
    await page.click('button:has-text("Patient auswählen")');
    await page.waitForTimeout(500);
    // Find the first option under patient list and click it
    await page.click('role=option >> nth=0');
    
    console.log("Selecting Therapist...");
    await page.click('button:has-text("Therapeut auswählen")');
    await page.waitForTimeout(500);
    await page.click('role=option >> nth=0');

    // Let's set the date and time
    console.log("Setting date and time...");
    await page.fill('input[type="date"]', '2026-06-15');
    await page.fill('input[type="time"] >> nth=0', '10:00'); // start_time
    await page.fill('input[type="time"] >> nth=1', '11:00'); // end_time

    // Wait for rooms to load
    await page.waitForTimeout(1500);

    // Let's log room cards and check their capacity / status displays
    const roomButtons = await page.locator('button:has(span:has-text("Kapazität:"))').all();
    console.log(`Found ${roomButtons.length} suggested room buttons.`);
    for (let btn of roomButtons) {
      console.log("Room Button Text:", await btn.innerText());
    }

    // Select the first room card (e.g. U1003 or P1001)
    if (roomButtons.length > 0) {
      console.log("Clicking the first room button...");
      await roomButtons[0].click();
      await page.waitForTimeout(500);
    }

    // Save the appointment
    console.log("Clicking Save button...");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    console.log("Checking if appointment saved (dialog closed)...");
    const isDialogOpen = await page.locator('role=dialog').isVisible();
    console.log("Is Dialog still open?", isDialogOpen);

    // If dialog is still open, let's print any validation errors
    if (isDialogOpen) {
      const errorText = await page.locator('.text-red-500').allInnerTexts();
      console.log("Validation errors visible on page:", errorText);
    }

  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    await browser.close();
  }
}

run();

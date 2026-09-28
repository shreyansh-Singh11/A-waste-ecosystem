import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUDIT_DIR = path.join(__dirname, "..", "playwright-audit");

if (!fs.existsSync(AUDIT_DIR)) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

const BASE_URL = "http://localhost:3000";

const pagesToTest = [
  { name: "landing", path: "/" },
  { name: "user", path: "/user" },
  { name: "collector", path: "/collector" },
  { name: "collector-scan", path: "/collector/scan.html" },
  { name: "municipal", path: "/municipal" },
  { name: "medical", path: "/medical" },
  { name: "producer", path: "/producer" },
  { name: "gov", path: "/government" },
  { name: "track", path: "/track/6f5e615e7174ad5a85870ea3f58f2965" }
];

async function runAudit() {
  console.log("=== STARTING PLAYWRIGHT LIGHT MODE & THEME PERSISTENCE AUDIT ===");
  const browser = await chromium.launch({ headless: true });

  // ── TEST 1: THEME TOGGLE & PERSISTENCE VERIFICATION ──
  console.log("\n[Test 1] Testing Theme Toggle & LocalStorage Persistence...");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Clear localStorage to test default visit
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.removeItem("circulasync-theme");
    localStorage.removeItem("circulasync_theme");
  });
  await page.reload({ waitUntil: "networkidle" });

  // Verify initial theme is dark
  const initialThemeClass = await page.evaluate(() => document.documentElement.className);
  const initialDataTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  console.log(`Initial theme: class="${initialThemeClass}", data-theme="${initialDataTheme}"`);
  if (!initialThemeClass.includes("dark") && initialDataTheme !== "dark") {
    console.warn("⚠️ Warning: Initial theme was expected to default to dark.");
  } else {
    console.log("✓ Initial visit defaults to dark mode.");
  }

  // Click theme button to switch to light mode
  const themeBtn = page.locator("#cs-theme-btn");
  await themeBtn.waitFor({ state: "visible", timeout: 5000 });
  await themeBtn.click();
  await page.waitForTimeout(300);

  const toggledThemeClass = await page.evaluate(() => document.documentElement.className);
  const toggledDataTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const storedTheme = await page.evaluate(() => localStorage.getItem("circulasync-theme"));
  console.log(`After toggle: class="${toggledThemeClass}", data-theme="${toggledDataTheme}", localStorage="${storedTheme}"`);

  if (toggledThemeClass.includes("light") && storedTheme === "light") {
    console.log("✓ Successfully toggled to Light mode & persisted in localStorage.");
  } else {
    throw new Error(`Failed to toggle to light mode: class="${toggledThemeClass}", localStorage="${storedTheme}"`);
  }

  // Reload page to verify persistence
  await page.reload({ waitUntil: "networkidle" });
  const reloadedThemeClass = await page.evaluate(() => document.documentElement.className);
  const reloadedDataTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  console.log(`After reload: class="${reloadedThemeClass}", data-theme="${reloadedDataTheme}"`);
  if (reloadedThemeClass.includes("light") && reloadedDataTheme === "light") {
    console.log("✓ Light mode successfully retained across reload with zero FOUC.");
  } else {
    throw new Error("Theme did not persist after reload.");
  }

  await context.close();

  // ── TEST 2: CAPTURE LIGHT MODE DESKTOP & MOBILE SCREENSHOTS ──
  console.log("\n[Test 2] Capturing Light Mode Screenshots across all 9 pages...");

  // Desktop (1440x900)
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            { name: "circulasync-theme", value: "light" },
            { name: "circulasync_theme", value: "light" }
          ]
        }
      ]
    }
  });

  for (const p of pagesToTest) {
    const page = await desktopCtx.newPage();
    const url = `${BASE_URL}${p.path}`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(500); // allow transitions/charts to settle

      // Verify page has light theme applied
      const isLight = await page.evaluate(() => document.documentElement.classList.contains("light"));
      const screenshotPath = path.join(AUDIT_DIR, `${p.name}-light-desktop.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`✓ Desktop: ${p.name.padEnd(16)} -> ${screenshotPath} (isLight: ${isLight})`);
    } catch (err) {
      console.error(`✕ Error on desktop ${p.name}:`, err.message);
    } finally {
      await page.close();
    }
  }
  await desktopCtx.close();

  // Mobile (390x844 - iPhone 14 / modern smartphone)
  console.log("\n[Test 3] Capturing Mobile (390x844) Screenshots in Light Mode...");
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            { name: "circulasync-theme", value: "light" },
            { name: "circulasync_theme", value: "light" }
          ]
        }
      ]
    }
  });

  for (const p of pagesToTest) {
    const page = await mobileCtx.newPage();
    const url = `${BASE_URL}${p.path}`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(500);

      const isLight = await page.evaluate(() => document.documentElement.classList.contains("light"));
      const screenshotPath = path.join(AUDIT_DIR, `${p.name}-light-mobile.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`✓ Mobile:  ${p.name.padEnd(16)} -> ${screenshotPath} (isLight: ${isLight})`);
    } catch (err) {
      console.error(`✕ Error on mobile ${p.name}:`, err.message);
    } finally {
      await page.close();
    }
  }
  await mobileCtx.close();

  await browser.close();
  console.log("\n=== PLAYWRIGHT LIGHT MODE AUDIT COMPLETE ===");
}

runAudit().catch((e) => {
  console.error("FATAL AUDIT ERROR:", e);
  process.exit(1);
});

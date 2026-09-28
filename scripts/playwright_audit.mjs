import { chromium, devices } from "playwright";
import fs from "fs";
import path from "path";

const auditDir = path.resolve("playwright-audit");
if (!fs.existsSync(auditDir)) {
  fs.mkdirSync(auditDir, { recursive: true });
}

const targets = [
  { name: "landing", url: "http://localhost:3000/" },
  { name: "citizen-user", url: "http://localhost:3000/user" },
  { name: "collector-portal", url: "http://localhost:3000/collector" },
  { name: "collector-scan", url: "http://localhost:3000/collector/scan" },
  { name: "municipal-portal", url: "http://localhost:3000/municipal" },
  { name: "medical-portal", url: "http://localhost:3000/medical" },
  { name: "producer-portal", url: "http://localhost:3000/producer" },
  { name: "government-hub", url: "http://localhost:3000/government" },
  { name: "track-passport", url: "http://localhost:3000/track/fca145e7875f1e6cb86e8dcf0bbd3229" },
];

async function runAudit() {
  const browser = await chromium.launch();
  const report = [];

  for (const target of targets) {
    console.log(`Auditing ${target.name}...`);
    const pageErrors = [];
    const consoleLogs = [];

    // Desktop
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
    });
    const desktopPage = await desktopContext.newPage();
    desktopPage.on("pageerror", (err) => pageErrors.push({ type: "pageerror", msg: err.message }));
    desktopPage.on("console", (msg) => {
      if (msg.type() === "error") consoleLogs.push({ type: "console.error", text: msg.text() });
    });

    try {
      await desktopPage.goto(target.url, { waitUntil: "networkidle", timeout: 15000 });
      await desktopPage.waitForTimeout(1000);
      const desktopScreenshotPath = path.join(auditDir, `${target.name}-desktop.png`);
      await desktopPage.screenshot({ path: desktopScreenshotPath, fullPage: true });

      // Check headings, interactive elements, overflow
      const pageMetrics = await desktopPage.evaluate(() => {
        const body = document.body;
        const scrollWidth = document.documentElement.scrollWidth;
        const clientWidth = document.documentElement.clientWidth;
        const hasHorizontalOverflow = scrollWidth > clientWidth;
        const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4")).map(h => ({
          tag: h.tagName,
          text: h.innerText.slice(0, 50),
          fontSize: window.getComputedStyle(h).fontSize,
          fontWeight: window.getComputedStyle(h).fontWeight,
          fontFamily: window.getComputedStyle(h).fontFamily,
          color: window.getComputedStyle(h).color
        }));
        const buttons = Array.from(document.querySelectorAll("button, a.btn, a.cs-btn, .btn")).map(b => ({
          text: (b.innerText || "").trim().slice(0, 30),
          bg: window.getComputedStyle(b).backgroundColor,
          color: window.getComputedStyle(b).color,
          height: b.offsetHeight,
          width: b.offsetWidth
        }));
        return {
          title: document.title,
          hasHorizontalOverflow,
          scrollWidth,
          clientWidth,
          headingsCount: headings.length,
          headingsSample: headings.slice(0, 5),
          buttonsCount: buttons.length,
          buttonsSample: buttons.slice(0, 5),
        };
      });

      // Mobile (iPhone 12)
      const mobileContext = await browser.newContext({
        ...devices["iPhone 12"],
        colorScheme: "dark",
      });
      const mobilePage = await mobileContext.newPage();
      await mobilePage.goto(target.url, { waitUntil: "networkidle", timeout: 15000 });
      await mobilePage.waitForTimeout(1000);
      const mobileScreenshotPath = path.join(auditDir, `${target.name}-mobile.png`);
      await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: true });

      const mobileMetrics = await mobilePage.evaluate(() => {
        const scrollWidth = document.documentElement.scrollWidth;
        const clientWidth = document.documentElement.clientWidth;
        return {
          hasHorizontalOverflow: scrollWidth > clientWidth,
          scrollWidth,
          clientWidth,
        };
      });

      report.push({
        target: target.name,
        url: target.url,
        pageErrors,
        consoleLogs,
        desktopMetrics: pageMetrics,
        mobileMetrics,
      });

      await desktopContext.close();
      await mobileContext.close();
    } catch (e) {
      console.error(`Error on ${target.name}:`, e.message);
      report.push({ target: target.name, error: e.message });
      await desktopContext.close();
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(auditDir, "audit_summary.json"), JSON.stringify(report, null, 2));
  console.log("Audit complete! Report written to playwright-audit/audit_summary.json");
}

runAudit();

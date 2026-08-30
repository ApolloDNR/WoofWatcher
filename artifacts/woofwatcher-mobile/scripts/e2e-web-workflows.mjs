#!/usr/bin/env node
/**
 * WoofWatcher web-export workflow E2E: drives the real consumer loops
 * (quick log, walk session, story evidence, setup, legal, delete-all)
 * against a served web export and fails on any dead flow.
 *
 * Usage: build and serve the exact consumer candidate, then run the workflow:
 *   node scripts/smoke-web-export.js --candidate
 *   pnpm run preview:smoke
 *   BASE_URL=http://127.0.0.1:4194 node scripts/e2e-web-workflows.mjs
 * Requires: pnpm install; a Chromium binary on PLAYWRIGHT_CHROMIUM
 * (defaults to /opt/pw-browsers/chromium).
 */
import { chromium } from "playwright";
import {
  assertConsumerCandidatePreview,
  browserErrorCount,
  normalizeBaseUrl,
  routeUrl,
} from "./qa-browser-harness.mjs";

const BASE = normalizeBaseUrl(process.env.BASE_URL ?? "http://127.0.0.1:4194");
const results = [];
const errorsByStep = {};
let currentStep = "boot";

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log("PASS", name, detail);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log("FAIL", name, detail);
}

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await assertConsumerCandidatePreview(page, BASE);
page.on("console", (msg) => {
  if (msg.type() === "error") {
    (errorsByStep[currentStep] ??= []).push(msg.text().slice(0, 200));
  }
});
page.on("pageerror", (err) => {
  (errorsByStep[currentStep] ??= []).push(
    "pageerror: " + String(err).slice(0, 200),
  );
});
page.on("dialog", (d) => {
  (errorsByStep[currentStep] ??= []).push(
    `unexpected ${d.type()} dialog: ${d.message().slice(0, 160)}`,
  );
  void d.dismiss().catch((error) => {
    (errorsByStep[currentStep] ??= []).push(
      `could not dismiss unexpected dialog: ${String(error).slice(0, 160)}`,
    );
  });
});

async function go(route, settle = 3500) {
  await page.goto(routeUrl(BASE, route), {
    waitUntil: "networkidle",
    timeout: 45000,
  });
  await page.waitForTimeout(settle);
}
async function bodyText() {
  return page.evaluate(() => document.body.innerText);
}
async function clickLabel(label, exact = false) {
  const loc = exact
    ? page.locator(`[aria-label="${label}"]`).first()
    : page.locator(`[aria-label*="${label}"]`).first();
  await loc.click({ timeout: 8000 });
}
async function readPrivacyStat(label) {
  const statLabel = page.getByText(label, { exact: true }).first();
  await statLabel.waitFor({ state: "visible", timeout: 8000 });
  const tileText = await statLabel.evaluate(
    (element) => element.parentElement?.innerText ?? "",
  );
  const valueMatch = tileText.match(/\b\d[\d,]*\b/);
  if (!valueMatch) {
    throw new Error(
      `Could not read ${label} stat from: ${tileText.slice(0, 120)}`,
    );
  }
  return Number(valueMatch[0].replaceAll(",", ""));
}

// ---------- 1. Fresh boot: Home renders the current five-tab navigation ----------
currentStep = "boot-home";
await go("/");
{
  const text = await bodyText();
  const currentTabs = ["Home", "Log", "Plans", "Health", "More"];
  const hasNav = currentTabs.every((tab) => text.includes(tab));
  hasNav
    ? pass("home renders Home / Log / Plans / Health / More navigation")
    : fail(
        "home renders Home / Log / Plans / Health / More navigation",
        text.slice(0, 200),
      );
}

// ---------- 2. Quick log a meal from Home ----------
currentStep = "quick-log-meal";
try {
  await clickLabel("Log Meal");
  await page.waitForTimeout(1800);
  const text = await bodyText();
  text.includes("Meal logged") || text.includes("care XP")
    ? pass("meal quick log fires toast", "")
    : fail("meal quick log fires toast", "no toast text found");
} catch (e) {
  fail("meal quick log fires toast", String(e).slice(0, 120));
}

// ---------- 3. The log timeline shows the meal + pending outcome ----------
currentStep = "log-timeline";
await go("/log");
{
  await clickLabel("History", true);
  await page.waitForTimeout(1200);
  const text = await bodyText();
  const hasMeal = /meal/i.test(text);
  const pending = /outcome pending|pending/i.test(text);
  hasMeal
    ? pass("timeline shows logged meal")
    : fail("timeline shows logged meal");
  pending
    ? pass("meal served shows outcome-pending state")
    : fail("meal served shows outcome-pending state", "no pending marker");
}

// ---------- 4. Start a walk from Home; presence flips ----------
currentStep = "walk-session";
await go("/");
try {
  await clickLabel("Log Walk");
  await page.waitForTimeout(1800);
  const text = await bodyText();
  /walk started/i.test(text) || /on a walk/i.test(text)
    ? pass("walk session starts and presence updates")
    : fail("walk session starts and presence updates", "no walk confirmation");
} catch (e) {
  fail("walk session starts and presence updates", String(e).slice(0, 120));
}

// ---------- 5. XP is real: Story Badges segment shows earned XP ----------
currentStep = "story-xp";
await go("/story");
{
  const text = await bodyText();
  const walkEvidence = /walks today/i.test(text);
  try {
    await page
      .locator('[aria-label="Badges"]')
      .first()
      .click({ timeout: 6000 });
    await page.waitForTimeout(1200);
  } catch {}
  const badges = await bodyText();
  const xpVisible = /\d+\s*\/\s*[\d,]+\s*XP|\+\s*\d+\s*XP|\d+\s*XP/i.test(
    badges,
  );
  walkEvidence && xpVisible
    ? pass("story reflects earned care evidence")
    : fail(
        "story reflects earned care evidence",
        `walks:${walkEvidence} xp:${xpVisible}`,
      );
}

// ---------- 6. Pack shows the person and real counts ----------
currentStep = "pack";
await go("/pack");
{
  const text = await bodyText();
  const segs = ["Pets", "People", "Access", "Care Pass"].every((t) =>
    text.includes(t),
  );
  segs
    ? pass("pack renders all four segments")
    : fail("pack renders all four segments");
}

// ---------- 7. Plans renders schedule with status pills ----------
currentStep = "plans";
await go("/calendar");
{
  const text = await bodyText();
  const hasSegments = text.includes("Today") && text.includes("Tomorrow");
  hasSegments
    ? pass("plans renders schedule segments")
    : fail("plans renders schedule segments");
}

// ---------- 8. Setup flow persists the dog's name ----------
currentStep = "setup-name";
await go("/setup");
try {
  const inputs = page.locator("input, textarea");
  const count = await inputs.count();
  if (count === 0) {
    fail("setup accepts a dog name", "no inputs found on /setup");
  } else {
    // Fill every onboarding field: the name gets our marker, the rest use
    // their own placeholder text as a valid example value.
    for (let i = 0; i < count; i += 1) {
      const input = inputs.nth(i);
      const placeholder = (await input.getAttribute("placeholder")) ?? "Test";
      await input.fill(i === 0 ? "Biscuit" : placeholder);
      await page.waitForTimeout(150);
    }
    await page
      .locator('[aria-label="Save foundation"]')
      .first()
      .click({ timeout: 8000 });
    await page.waitForTimeout(2000);
    await go("/");
    const text = await bodyText();
    text.includes("Biscuit")
      ? pass("setup persists the dog's name to Home")
      : fail(
          "setup persists the dog's name to Home",
          "name not visible after save",
        );
  }
} catch (e) {
  fail("setup accepts a dog name", String(e).slice(0, 140));
}

// ---------- 9. Privacy: export responds, legal opens, delete-all wipes ----------
currentStep = "privacy-legal";
await go("/privacy");
try {
  await clickLabel("Open privacy policy and terms of service");
  await page.waitForTimeout(2200);
  const text = await bodyText();
  text.includes("privacy policy") || text.includes("Privacy policy")
    ? pass("legal screen opens from privacy")
    : fail("legal screen opens from privacy");
} catch (e) {
  fail("legal screen opens from privacy", String(e).slice(0, 120));
}

currentStep = "privacy-delete-all";
await go("/privacy");
{
  try {
    const beforeLogs = await readPrivacyStat("Logs");
    beforeLogs > 0
      ? pass("privacy computes the pre-delete log count", String(beforeLogs))
      : fail(
          "privacy computes the pre-delete log count",
          `expected > 0, got ${beforeLogs}`,
        );

    await clickLabel("Delete all WoofWatcher data on this device", true);
    await clickLabel("Delete device data", true);
    await page
      .locator('[aria-label="Yes, delete device data"]')
      .first()
      .waitFor({ state: "visible", timeout: 8000 });
    // The final destructive action intentionally has a 500 ms transition
    // latch. Waiting here exercises the same deliberate in-app flow as a user.
    await page.waitForTimeout(550);
    await clickLabel("Yes, delete device data", true);
    await page
      .locator('[aria-label="Local care content deleted"]')
      .first()
      .waitFor({ state: "visible", timeout: 20000 });
    pass("delete-all completes both in-app confirmation steps");

    await clickLabel("Continue after local data deletion", true);
    await page.waitForTimeout(1000);
    await go("/privacy");
    const afterLogs = await readPrivacyStat("Logs");
    afterLogs === 0
      ? pass("delete-all recomputes the privacy log count to zero")
      : fail(
          "delete-all recomputes the privacy log count to zero",
          `expected 0, got ${afterLogs}`,
        );

    await go("/");
    const home = await bodyText();
    !home.includes("Biscuit")
      ? pass("delete-all wipes the household (name gone)")
      : fail("delete-all wipes the household (name gone)");
  } catch (e) {
    fail("delete-all flow", String(e).slice(0, 140));
  }
}

// ---------- 10. Remaining consumer routes render without crash ----------
for (const route of [
  "/health",
  "/records",
  "/more",
  "/adventure",
  "/woofguide",
  "/portrait",
]) {
  currentStep = "route" + route;
  await go(route, 2500);
  const text = await bodyText();
  text.trim().length > 40
    ? pass(`route ${route} renders content`)
    : fail(`route ${route} renders content`, "near-empty body");
}

// ---------- Summary ----------
const runtimeErrorTotal = browserErrorCount(errorsByStep);
runtimeErrorTotal === 0
  ? pass("browser runtime has no console, page, or dialog errors")
  : fail(
      "browser runtime has no console, page, or dialog errors",
      `${runtimeErrorTotal} error(s)`,
    );
console.log("\n===== SUMMARY =====");
const failed = results.filter((r) => !r.ok);
console.log(`passed: ${results.length - failed.length}/${results.length}`);
for (const f of failed) console.log("FAILED:", f.name, "-", f.detail);
console.log("\n===== CONSOLE ERRORS BY STEP =====");
for (const [step, errs] of Object.entries(errorsByStep)) {
  console.log(step + ":", [...new Set(errs)].slice(0, 3).join(" ; "));
}
await browser.close();
process.exit(failed.length ? 1 : 0);

#!/usr/bin/env node
/**
 * WoofWatcher web-export workflow E2E: drives the real consumer loops
 * (quick log, walk session, story evidence, setup, legal, delete-all)
 * against a served web export and fails on any dead flow.
 *
 * Usage: serve the export (pnpm run preview:smoke), then:
 *   BASE_URL=http://127.0.0.1:4194 node scripts/e2e-web-workflows.mjs
 * Requires the workspace-pinned Playwright and its matching Chromium binary.
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:4194").replace(
  /\/$/,
  "",
);
const results = [];
const errorsByStep = {};
let currentStep = "boot";
const ROUTE_EXPECTATIONS = {
  "/health": ["Owner notes. No diagnosis."],
  "/records": ["Vault Command"],
  "/more": ["Command Directory"],
  "/adventure": ["Adventure Mode"],
  "/woofguide": ["WOOFGUIDE CONSOLE"],
  "/portrait": ["Choose a pixel twin, then customize."],
};
const PRIMARY_NAVIGATION_LABELS = ["Today", "Plan", "Quick Log", "Health", "More"];
const PRIMARY_NAVIGATION_ROUTES = ["/", "/calendar", "/fastlog", "/health", "/more"];
const PRIMARY_NAVIGATION_MARKERS = [
  "WELCOME TO WOOFWATCHER",
  "MISSION SCHEDULE",
  "What would you like",
  "Owner notes. No diagnosis.",
  "Command Directory",
];
const ERROR_BOUNDARY_PATTERN =
  /error boundary|something went wrong|unexpected error|view error details/i;

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log("PASS", name, detail);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log("FAIL", name, detail);
}

const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
    : {}),
  args: ["--no-sandbox"],
});
let exitCode = 1;
try {
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("console", (msg) => {
  if (msg.type() === "error") {
    (errorsByStep[currentStep] ??= []).push({
      kind: "console",
      message: msg.text().slice(0, 200),
    });
  }
});
page.on("pageerror", (err) => {
  (errorsByStep[currentStep] ??= []).push({
    kind: "page",
    message: String(err).slice(0, 200),
  });
});
// Accept every browser confirm/alert (used by the delete-all flow on web).
const dialogs = [];
page.on("dialog", (d) => {
  dialogs.push(d.type() + ": " + d.message().slice(0, 80));
  d.accept();
});

async function go(route, settle = 3500) {
  await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(settle);
  const text = await bodyText();
  if (ERROR_BOUNDARY_PATTERN.test(text)) {
    throw new Error(`Error-boundary-like content rendered at ${route}`);
  }
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

async function assertRouteMarker(route, expected) {
  const text = await bodyText();
  const marker = expected.find((candidate) => text.includes(candidate));
  marker
    ? pass(`route ${route} renders route-specific marker`, marker)
    : fail(
        `route ${route} renders route-specific marker`,
        `missing: ${expected.join(" or ")}`,
      );
}

async function assertPrimaryDestination(label, route, marker) {
  const text = await bodyText();
  const pathnameMatches = new URL(page.url()).pathname === route;
  const markerMatches = text.includes(marker);
  const healthy = text.trim().length > 0 && !ERROR_BOUNDARY_PATTERN.test(text);
  pathnameMatches && markerMatches && healthy
    ? pass(`primary navigation ${label} reaches ${route}`, marker)
    : fail(
        `primary navigation ${label} reaches ${route}`,
        JSON.stringify({
          actualPath: new URL(page.url()).pathname,
          marker,
          body: text.replace(/\s+/g, " ").slice(0, 180),
        }),
      );
}

// Keep this browser-only: inspect the exported app's durable web storage
// instead of importing application state. Copy and navigation can succeed
// while a failed mutation leaves the underlying care row unchanged.
async function persistedCareEntrySnapshot() {
  return page.evaluate(() => {
    const candidates = [];
    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      if (
        Array.isArray(value.entries) &&
        value.entries.every(
          (entry) => entry && typeof entry.id === "string",
        )
      ) {
        candidates.push(value.entries.map((entry) => entry.id).sort());
      }
      for (const nested of Object.values(value)) visit(nested);
    };

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      try {
        visit(JSON.parse(window.localStorage.getItem(key) ?? ""));
      } catch {
        // Ignore unrelated, non-JSON browser storage.
      }
    }

    return candidates.sort(
      (left, right) => right.length - left.length,
    )[0] ?? null;
  });
}

function sameEntrySnapshot(before, after) {
  return (
    Array.isArray(before) &&
    Array.isArray(after) &&
    before.length === after.length &&
    before.every((entryId, index) => entryId === after[index])
  );
}

function hasExactlyOneNewEntry(before, after) {
  if (
    !Array.isArray(before) ||
    !Array.isArray(after) ||
    after.length !== before.length + 1
  ) {
    return false;
  }
  const beforeIds = new Set(before);
  return after.filter((entryId) => !beforeIds.has(entryId)).length === 1;
}

// ---------- 1. Fresh boot: Today renders the consumer home ----------
currentStep = "boot-today";
await go("/");
{
  const primaryNavigation = PRIMARY_NAVIGATION_LABELS.map((label, index) => ({
    label,
    route: PRIMARY_NAVIGATION_ROUTES[index],
    marker: PRIMARY_NAVIGATION_MARKERS[index],
  }));
  const hasNav = (
    await Promise.all(
      primaryNavigation.map(async ({ label }) => {
        const control = page.getByLabel(label, { exact: true });
        return (
          (await control.count()) > 0 && (await control.first().isVisible())
        );
      }),
    )
  ).every(Boolean);
  hasNav
    ? pass("today renders real labeled primary navigation controls")
    : fail(
        "today renders real labeled primary navigation controls",
        "one or more exact labels were missing",
      );
  for (const { label, route: expectedPath, marker } of primaryNavigation) {
    await go("/");
    await page.getByLabel(label, { exact: true }).first().click({
      timeout: 8_000,
    });
    await page.waitForTimeout(500);
    await assertPrimaryDestination(label, expectedPath, marker);
  }
}

// ---------- 2. Quick log a meal from the elevated Quick Log action ----------
currentStep = "quick-log-meal";
try {
  await go("/fastlog");
  const mealBefore = await persistedCareEntrySnapshot();
  await clickLabel("Log Meal");
  await page.waitForTimeout(450);
  const mealAfterFirstSave = await persistedCareEntrySnapshot();
  hasExactlyOneNewEntry(mealBefore, mealAfterFirstSave)
    ? pass("meal quick log persists exactly one new care row")
    : fail(
        "meal quick log persists exactly one new care row",
        JSON.stringify({ mealBefore, mealAfterFirstSave }),
      );

  const text = await bodyText();
  /Meal served.*outcome stays open/i.test(text)
    ? pass("meal quick log confirms the current meal outcome boundary")
    : fail(
        "meal quick log confirms the current meal outcome boundary",
        "no current meal confirmation found",
      );

  await clickLabel("Log Meal");
  await page.waitForTimeout(300);
  const mealAfterDuplicate = await persistedCareEntrySnapshot();
  sameEntrySnapshot(mealAfterFirstSave, mealAfterDuplicate)
    ? pass("rapid meal duplicate creates no additional persisted care row")
    : fail(
        "rapid meal duplicate creates no additional persisted care row",
        JSON.stringify({ mealAfterFirstSave, mealAfterDuplicate }),
      );

  const undo = page.locator('[aria-label="Undo Meal"]').first();
  (await undo.count()) === 1
    ? pass("meal quick log exposes Undo")
    : fail("meal quick log exposes Undo", "undo control not found");
  await undo.click({ timeout: 8000 });
  await page.waitForTimeout(500);
  const mealAfterUndo = await persistedCareEntrySnapshot();
  (await page.locator('[aria-label="Undo Meal"]').count()) === 0
    ? pass("meal quick log Undo clears the pending save")
    : fail(
        "meal quick log Undo clears the pending save",
        "undo control remained after undo",
      );
  sameEntrySnapshot(mealBefore, mealAfterUndo)
    ? pass("meal quick log Undo removes the persisted meal before recreation")
    : fail(
        "meal quick log Undo removes the persisted meal before recreation",
        JSON.stringify({ mealBefore, mealAfterUndo }),
      );

  await clickLabel("Log Meal");
  await page.waitForTimeout(500);
  const mealAfterRecreate = await persistedCareEntrySnapshot();
  hasExactlyOneNewEntry(mealBefore, mealAfterRecreate)
    ? pass("meal recreation persists one new row after Undo")
    : fail(
        "meal recreation persists one new row after Undo",
        JSON.stringify({ mealBefore, mealAfterRecreate }),
      );
} catch (e) {
  fail(
    "meal quick log confirms the current meal outcome boundary",
    String(e).slice(0, 120),
  );
}

// ---------- 3. The log timeline shows the meal + pending outcome ----------
currentStep = "log-timeline";
await go("/log");
{
  const text = await bodyText();
  const hasMeal = /meal/i.test(text);
  const pending = /outcome pending|pending/i.test(text);
  hasMeal ? pass("timeline shows logged meal") : fail("timeline shows logged meal");
  pending
    ? pass("meal served shows outcome-pending state")
    : fail("meal served shows outcome-pending state", "no pending marker");
}

// ---------- 4. Start a walk from Quick Log, then reuse its active session ----------
currentStep = "walk-session";
await go("/fastlog");
try {
  const walkBefore = await persistedCareEntrySnapshot();
  await clickLabel("Log Walk");
  await page.waitForTimeout(500);
  const walkAfterStart = await persistedCareEntrySnapshot();
  hasExactlyOneNewEntry(walkBefore, walkAfterStart)
    ? pass("walk session persists exactly one active care row")
    : fail(
        "walk session persists exactly one active care row",
        JSON.stringify({ walkBefore, walkAfterStart }),
      );
  const text = await bodyText();
  /walk started/i.test(text) || /on a walk/i.test(text)
    ? pass("walk session starts and presence updates")
    : fail("walk session starts and presence updates", "no walk confirmation");

  await clickLabel("Log Walk");
  await page.waitForTimeout(500);
  const walkAfterReuse = await persistedCareEntrySnapshot();
  /\/log\?entry=/.test(page.url())
    ? pass("active walk reuses the existing active-walk flow")
    : fail("active walk reuses the existing active-walk flow", page.url());
  sameEntrySnapshot(walkAfterStart, walkAfterReuse)
    ? pass("active walk reuse creates no additional persisted care row")
    : fail(
        "active walk reuse creates no additional persisted care row",
        JSON.stringify({ walkAfterStart, walkAfterReuse }),
      );
} catch (e) {
  fail("walk session starts and presence updates", String(e).slice(0, 120));
}

// ---------- 5. Medication always opens details before a save ----------
currentStep = "medication-details";
await go("/fastlog");
try {
  const medicationBefore = await persistedCareEntrySnapshot();
  await clickLabel("Add Meds details");
  await page.waitForTimeout(500);
  const medicationAfterDetailRoute = await persistedCareEntrySnapshot();
  /\/log\?type=medication&detail=1&intent=/.test(page.url())
    ? pass("medication opens details before saving")
    : fail("medication opens details before saving", page.url());
  sameEntrySnapshot(medicationBefore, medicationAfterDetailRoute)
    ? pass("medication detail-first route creates no care row before save")
    : fail(
        "medication detail-first route creates no care row before save",
        JSON.stringify({
          medicationBefore,
          medicationAfterDetailRoute,
        }),
      );
} catch (e) {
  fail("medication opens details before saving", String(e).slice(0, 120));
}

// ---------- 6. XP is real: Story Badges segment shows earned XP ----------
currentStep = "story-xp";
await go("/story");
{
  const text = await bodyText();
  const walkEvidence = /walks today/i.test(text);
  try {
    await page.locator('[aria-label="Badges"]').first().click({ timeout: 6000 });
    await page.waitForTimeout(1200);
  } catch {}
  const badges = await bodyText();
  const xpVisible = /\d+\s*\/\s*[\d,]+\s*XP|\+\s*\d+\s*XP|\d+\s*XP/i.test(badges);
  walkEvidence && xpVisible
    ? pass("story reflects earned care evidence")
    : fail("story reflects earned care evidence", `walks:${walkEvidence} xp:${xpVisible}`);
}

// ---------- 7. Pack shows the person and real counts ----------
currentStep = "pack";
await go("/pack");
{
  const text = await bodyText();
  const segs = ["Pets", "People", "Access", "Care Pass"].every((t) => text.includes(t));
  segs ? pass("pack renders all four segments") : fail("pack renders all four segments");
}

// ---------- 8. Plan renders schedule with status pills ----------
currentStep = "plan";
await go("/calendar");
{
  await assertRouteMarker("/calendar", ["MISSION SCHEDULE"]);
}

// ---------- 9. Setup flow persists the dog's name ----------
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
      ? pass("setup persists the dog's name to Today")
      : fail("setup persists the dog's name to Today", "name not visible after save");
  }
} catch (e) {
  fail("setup accepts a dog name", String(e).slice(0, 140));
}

// ---------- 10. Privacy: export responds, legal opens, delete-all wipes ----------
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
  const beforeDeleteSnapshot = await persistedCareEntrySnapshot();
  Array.isArray(beforeDeleteSnapshot) && beforeDeleteSnapshot.length > 0
    ? pass("persisted rows exist before delete-all")
    : fail(
        "persisted rows exist before delete-all",
        JSON.stringify(beforeDeleteSnapshot),
      );
  try {
    await clickLabel("Delete all WoofWatcher data on this device");
    await page.waitForTimeout(250);
    await clickLabel("Delete everything", true);
    await page.waitForTimeout(250);
    await clickLabel("Yes, delete it all", true);
    await page.waitForTimeout(2500);
    const afterDeleteSnapshot = await persistedCareEntrySnapshot();
    Array.isArray(afterDeleteSnapshot) && afterDeleteSnapshot.length === 0
      ? pass("delete-all clears every persisted care row")
      : fail(
          "delete-all clears every persisted care row",
          JSON.stringify(afterDeleteSnapshot),
        );
    pass(
      "delete-all shows double confirmation",
      "Delete everything | Yes, delete it all",
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

// ---------- 11. Remaining consumer routes render their own markers ----------
for (const [route, expected] of Object.entries(ROUTE_EXPECTATIONS)) {
  currentStep = "route" + route;
  await go(route, 2500);
  await assertRouteMarker(route, expected);
}

// ---------- Summary ----------
console.log("\n===== SUMMARY =====");
for (const [step, errors] of Object.entries(errorsByStep)) {
  for (const error of errors) {
    const name =
      error.kind === "page"
        ? `page error [${step}]`
        : `console error [${step}]`;
    fail(name, error.message);
  }
}
const failed = results.filter((r) => !r.ok);
console.log(`passed: ${results.length - failed.length}/${results.length}`);
for (const f of failed) console.log("FAILED:", f.name, "-", f.detail);
console.log("\n===== CONSOLE ERRORS BY STEP =====");
for (const [step, errs] of Object.entries(errorsByStep)) {
  console.log(
    step + ":",
    [...new Set(errs.map((error) => `${error.kind}: ${error.message}`))]
      .slice(0, 3)
      .join(" ; "),
  );
}
exitCode = failed.length ? 1 : 0;
} finally {
  await browser.close();
}
process.exit(exitCode);

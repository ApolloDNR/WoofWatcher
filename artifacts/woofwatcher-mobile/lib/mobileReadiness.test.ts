import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const APP_DIR = join(process.cwd(), "artifacts", "woofwatcher-mobile", "app");

function readAppFile(path: string): string {
  return readFileSync(join(APP_DIR, path), "utf8");
}

function listAppFiles(dir = APP_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listAppFiles(full);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [full] : [];
  });
}

function routeExists(route: string): boolean {
  if (!route.startsWith("/")) return true;
  if (route === "/(tabs)") return existsSync(join(APP_DIR, "(tabs)", "index.tsx"));
  if (route === "/(auth)") return existsSync(join(APP_DIR, "(auth)", "_layout.tsx"));

  const clean = route.replace(/^\//, "");
  const direct = join(APP_DIR, `${clean}.tsx`);
  const grouped = join(APP_DIR, clean, "_layout.tsx");
  const tab = join(APP_DIR, "(tabs)", `${clean}.tsx`);
  const auth = join(APP_DIR, "(auth)", `${clean.replace("(auth)/", "")}.tsx`);
  return [direct, grouped, tab, auth].some((candidate) => existsSync(candidate));
}

test("registers the critical mobile routes and tabs", () => {
  const rootLayout = readAppFile("_layout.tsx");
  const tabLayout = readAppFile(join("(tabs)", "_layout.tsx"));

  for (const route of ["portrait", "setup", "woofguide", "premium", "privacy"]) {
    assert.match(rootLayout, new RegExp(`name="${route}"`), `${route} stack screen should be registered`);
    assert.ok(existsSync(join(APP_DIR, `${route}.tsx`)), `${route} route file should exist`);
  }

  for (const tab of ["Today", "Log", "Calendar", "Records", "More"]) {
    assert.match(tabLayout, new RegExp(`title: "${tab}"`), `${tab} tab should be visible`);
  }
});

test("keeps string router links pointed at existing route files", () => {
  const missing: string[] = [];
  const routePattern = /router\.(?:push|replace)\("([^"]+)"\)/g;

  for (const file of listAppFiles()) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(routePattern)) {
      const route = match[1];
      if (route && !routeExists(route)) {
        missing.push(`${relative(process.cwd(), file)} -> ${route}`);
      }
    }
  }

  assert.deepEqual(missing, []);
});

test("keeps launch-blocking safety copy on premium, privacy, and WoofGuide surfaces", () => {
  const premium = readAppFile("premium.tsx");
  const privacy = readAppFile("privacy.tsx");
  const privacyModel = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "privacySafety.ts"),
    "utf8",
  );
  const woofGuide = readAppFile("woofguide.tsx");
  const privacySurface = `${privacy}\n${privacyModel}`;

  assert.match(premium, /Payments stay disabled|payments/i);
  assert.match(privacy, /Export care data/);
  assert.match(privacy, /Deletion request/);
  assert.match(privacySurface, /AI disclosure/);
  assert.match(privacySurface, /document storage/i);
  assert.match(woofGuide, /Owner review required/);
});

test("keeps Expo web export smoke wired into CI", () => {
  const rootPackage = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  const mobilePackage = JSON.parse(
    readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "package.json"), "utf8"),
  );
  const smokeScript = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "scripts", "smoke-web-export.js"),
    "utf8",
  );
  const mobileGitignore = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", ".gitignore"),
    "utf8",
  );

  assert.equal(mobilePackage.scripts["smoke:web"], "node scripts/smoke-web-export.js");
  assert.match(rootPackage.scripts["build:ci"], /woofwatcher-mobile run smoke:web/);
  assert.match(smokeScript, /expo", "export"/);
  assert.match(smokeScript, /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  assert.match(mobileGitignore, /\.expo-smoke\//);
});

test("keeps critical mobile actions accessible to screen readers", () => {
  const privacy = readAppFile("privacy.tsx");
  const premium = readAppFile("premium.tsx");
  const woofGuide = readAppFile("woofguide.tsx");
  const more = readAppFile(join("(tabs)", "more.tsx"));

  assert.match(privacy, /accessibilityLabel="Close Privacy and Safety"/);
  assert.match(privacy, /accessibilityLabel="Export WoofWatcher care data"/);
  assert.match(privacy, /accessibilityLabel="Prepare account deletion request"/);
  assert.match(premium, /accessibilityLabel="Open premium launch checklist"/);
  assert.match(premium, /accessibilityLabel="Back to care"/);
  assert.match(woofGuide, /accessibilityLabel=\{`Ask WoofGuide: \$\{q\}`\}/);
  assert.match(woofGuide, /accessibilityLabel=\{`Review WoofGuide action: \$\{action\.label\}/);
  assert.match(woofGuide, /accessibilityLabel="Close owner review"/);
  assert.match(woofGuide, /accessibilityLabel="Send WoofGuide message"/);
  assert.match(more, /accessibilityLabel="Edit dog profile"/);
  assert.match(more, /accessibilityLabel="Open WoofWatcher Plus"/);
  assert.match(more, /accessibilityLabel=\{`\$\{l\.label\}\. \$\{l\.sub\}`\}/);
  assert.match(more, /accessibilityLabel="Sign out of WoofWatcher"/);
});

test("shows premium entitlement policy before checkout is enabled", () => {
  const premium = readAppFile("premium.tsx");

  assert.match(premium, /preview\.entitlements/);
  assert.match(premium, /Launch entitlements/);
  assert.match(premium, /Current plan: Free/);
  assert.match(premium, /Locked until upgrade/);
});

test("keeps Expo app identity release-grade", () => {
  const appConfig = JSON.parse(
    readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "app.json"), "utf8"),
  );
  const expo = appConfig.expo;

  assert.equal(expo.name, "WoofWatcher");
  assert.equal(expo.slug, "woofwatcher");
  assert.equal(expo.scheme, "woofwatcher");
  assert.equal(expo.ios.bundleIdentifier, "com.pegasusdreamscapes.woofwatcher");
  assert.equal(expo.android.package, "com.pegasusdreamscapes.woofwatcher");
  assert.doesNotMatch(JSON.stringify(expo), /replit/i);
});

test("wires Home to the avatar motion state model", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));

  assert.match(home, /deriveAvatarMotion/);
  assert.match(home, /avatarMotion\.avatarMood/);
  assert.match(home, /avatarMotion\.route/);
  assert.match(home, /avatarMotion\.line/);
});

test("keeps Records report history wired for printable Care Pass artifacts", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /getCarePassArtifactPrintView/);
  assert.match(records, /sharePrintableReportArtifact/);
  assert.match(records, /Print-ready/);
  assert.match(records, /accessibilityLabel=\{`Resend \$\{artifact\.title\}`\}/);
  assert.match(records, /accessibilityLabel=\{`Share printable report source for \$\{artifact\.title\}`\}/);
});

test("keeps Records dog ID wired for printable credential sharing", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /getPetCredentialPrintView/);
  assert.match(records, /sharePrintableCredential/);
  assert.match(records, /accessibilityLabel="Share dog ID card"/);
  assert.match(records, /accessibilityLabel="Share printable dog ID source"/);
});

test("keeps Records wired to medication adherence status", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /deriveMedicationAdherence/);
  assert.match(records, /medicationAdherence/);
  assert.match(records, /Medication Plan/);
  assert.match(records, /medicationAdherence\.adherencePercent/);
});

test("keeps Log composer wired to medication routine defaults", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(log, /deriveMedicationAdherence/);
  assert.match(log, /medicationDose/);
  assert.match(log, /medicationOutcome/);
  assert.match(log, /Medication routine/);
  assert.match(log, /Shared medication logs update the Medication Plan/);
});

test("keeps Records wired to medication follow-up reminders", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /deriveMedicationFollowUps/);
  assert.match(records, /medicationFollowUps/);
  assert.match(records, /Medication Follow-ups/);
  assert.match(records, /notificationRule/);
});

test("keeps Records wired to medication history", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /deriveMedicationHistory/);
  assert.match(records, /medicationHistory/);
  assert.match(records, /Medication History/);
  assert.match(records, /statusLabel/);
});

test("keeps hydration visible from Home quick log to Records", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(home, /type: "water"/);
  assert.match(home, /label: "Water"/);
  assert.match(records, /deriveWaterHydration/);
  assert.match(records, /waterHydration/);
  assert.match(records, /Hydration/);
  assert.match(records, /Bowl refills/);
});

test("keeps walk activity insights visible in Records", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /deriveWalkActivity/);
  assert.match(records, /walkActivity/);
  assert.match(records, /Walk Activity/);
  assert.match(records, /dog interactions/);
});

test("keeps potty health visible from Log composer to Records", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(log, /type: "potty"/);
  assert.match(log, /label: "Condition"/);
  assert.match(log, /soft/);
  assert.match(log, /stoolColor/);
  assert.match(log, /pottyContext/);
  assert.match(log, /red-black/);
  assert.match(log, /straining/);
  assert.match(records, /derivePottyHealth/);
  assert.match(records, /pottyHealth/);
  assert.match(records, /pottyHealth\.stoolColors/);
  assert.match(records, /pottyHealth\.contexts/);
  assert.match(records, /Potty Health/);
  assert.match(records, /stool detail/);
});

test("keeps the durable sync outbox visible in care context and Log", () => {
  const careContext = readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "context", "CareContext.tsx"), "utf8");
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(careContext, /deriveCareSyncOutbox/);
  assert.match(careContext, /syncOutbox/);
  assert.match(log, /syncOutbox\.message/);
  assert.match(log, /Retry sync/);
  assert.match(log, /syncOutbox\.retryable/);
});

test("keeps household sync health visible from More", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));

  assert.match(more, /deriveCareSyncDashboard/);
  assert.match(more, /syncDashboard/);
  assert.match(more, /Sync Health/);
  assert.match(more, /syncDashboard\.metrics/);
  assert.match(more, /accessibilityLabel="Refresh household sync"/);
});

test("keeps care document refresh conflict-safe in CareContext", () => {
  const careContext = readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "context", "CareContext.tsx"), "utf8");

  assert.match(careContext, /reconcileCareDocFromServer/);
  assert.match(careContext, /shouldPushLocal/);
  assert.match(careContext, /putCareState\(\{\s*version: plan\.version/);
});

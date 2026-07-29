import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import { describeQuickLogDetailSheet } from "./quickLogEntry.ts";

const APP_DIR = join(process.cwd(), "artifacts", "woofwatcher-mobile", "app");
const MOBILE_LIB_DIR = join(
  process.cwd(),
  "artifacts",
  "woofwatcher-mobile",
  "lib",
);

function readAppFile(path: string): string {
  return readFileSync(join(APP_DIR, path), "utf8");
}

function readMobileLibFile(path: string): string {
  return readFileSync(join(MOBILE_LIB_DIR, path), "utf8");
}

function getStyleBlock(source: string, styleName: string): string {
  const marker = `  ${styleName}: {`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${styleName} style should exist`);

  const remaining = source.slice(start + marker.length);
  const nextStyle = remaining.search(/\n  [A-Za-z0-9_]+: \{/);
  return nextStyle === -1 ? remaining : remaining.slice(0, nextStyle);
}

function assertStyleUsesSharedTouchTarget(
  source: string,
  styleName: string,
): void {
  const block = getStyleBlock(source, styleName);
  assert.match(
    block,
    /minHeight:\s*MIN_MOBILE_TOUCH_TARGET/,
    `${styleName} should use the shared mobile touch target`,
  );
  assert.doesNotMatch(
    block,
    /minHeight:\s*(?:3\d|4[0-7])\b/,
    `${styleName} should not keep a route-local undersized height`,
  );
}

function assertStyleReferencesSharedTouchTarget(
  source: string,
  styleName: string,
): void {
  const block = getStyleBlock(source, styleName);
  assert.match(
    block,
    /MIN_MOBILE_TOUCH_TARGET/,
    `${styleName} should reference the shared mobile touch target`,
  );
  assert.doesNotMatch(
    block,
    /\b(?:minHeight|height):\s*(?:3\d|4[0-7])\b/,
    `${styleName} should not keep a route-local undersized height`,
  );
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
  if (route === "/(tabs)")
    return existsSync(join(APP_DIR, "(tabs)", "index.tsx"));
  if (route === "/(auth)")
    return existsSync(join(APP_DIR, "(auth)", "_layout.tsx"));

  const clean = route.replace(/^\//, "");
  const direct = join(APP_DIR, `${clean}.tsx`);
  const grouped = join(APP_DIR, clean, "_layout.tsx");
  const tab = join(APP_DIR, "(tabs)", `${clean}.tsx`);
  const auth = join(APP_DIR, "(auth)", `${clean.replace("(auth)/", "")}.tsx`);
  return [direct, grouped, tab, auth].some((candidate) =>
    existsSync(candidate),
  );
}

function readPngSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);
  assert.equal(
    buffer.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    `${path} should be a PNG`,
  );
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("registers the critical mobile routes and tabs", () => {
  const rootLayout = readAppFile("_layout.tsx");
  const tabLayout = readAppFile(join("(tabs)", "_layout.tsx"));

  for (const route of [
    "portrait",
    "setup",
    "woofguide",
    "premium",
    "privacy",
    "adventure",
    "care-twin-qa",
  ]) {
    assert.match(
      rootLayout,
      new RegExp(`name="${route}"`),
      `${route} stack screen should be registered`,
    );
    assert.ok(
      existsSync(join(APP_DIR, `${route}.tsx`)),
      `${route} route file should exist`,
    );
  }

  for (const tab of ["Log", "Plan", "Today", "Pack", "Story"]) {
    assert.match(
      tabLayout,
      new RegExp(`title: "${tab}"`),
      `${tab} tab should be visible`,
    );
  }
  for (const tabRoute of ["index", "log", "calendar", "pack", "story"]) {
    assert.match(
      tabLayout,
      new RegExp(`name="${tabRoute}"`),
      `${tabRoute} tab screen should be registered`,
    );
    assert.ok(
      existsSync(join(APP_DIR, "(tabs)", `${tabRoute}.tsx`)),
      `${tabRoute} tab route file should exist`,
    );
  }
  for (const hiddenRoute of ["records", "health", "more"]) {
    assert.match(
      tabLayout,
      new RegExp(`name="${hiddenRoute}"`),
      `${hiddenRoute} route should stay registered for Today/Pack links and deep links`,
    );
    assert.ok(
      existsSync(join(APP_DIR, "(tabs)", `${hiddenRoute}.tsx`)),
      `${hiddenRoute} route file should exist`,
    );
  }
  const hiddenTabCount = tabLayout.match(/href: null/g)?.length ?? 0;
  assert.ok(
    hiddenTabCount >= 3,
    "health, more, and records should be hidden from the bottom tab bar with href: null",
  );
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
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "privacySafety.ts",
    ),
    "utf8",
  );
  const woofGuide = readAppFile("woofguide.tsx");
  const privacySurface = `${privacy}\n${privacyModel}`;

  assert.match(premium, /Payments stay disabled|payments/i);
  assert.match(privacy, /Export care data/);
  assert.match(privacy, /Deletion request/);
  assert.match(privacySurface, /AI disclosure/);
  assert.match(privacySurface, /document storage/i);
  assert.match(privacy, /deriveSupportRunbookPlan/);
  assert.match(privacy, /deriveLaunchProviderSetup/);
  assert.match(privacy, /buildSupportRunbookShareText/);
  assert.match(privacy, /state\.launchSupportProfile/);
  assert.match(
    privacy,
    /const launchProviderSetupPlan = useMemo\(\s*\(\) => deriveLaunchProviderSetup\(state\.launchProviderProfile\),\s*\[state\.launchProviderProfile\],\s*\)/,
  );
  assert.match(privacy, /storageProviderConfigured:\s*Boolean\(state\.launchProviderProfile\.storageProviderConfigured\)/);
  assert.match(privacy, /storageProviderEvidence:\s*state\.launchProviderProfile\.storageProviderEvidence/);
  assert.match(privacy, /aiProviderEvidence:\s*state\.launchProviderProfile\.aiProviderEvidence/);
  assert.match(privacy, /paymentsProviderEvidence:\s*state\.launchProviderProfile\.paymentsProviderEvidence/);
  assert.match(privacy, /accountDeletionEvidence:\s*state\.launchProviderProfile\.accountDeletionEvidence/);
  assert.doesNotMatch(privacy, /storageProviderConfigured:\s*false/);
  assert.match(
    privacy,
    /const launchProfileProviderApproved =\s*state\.launchSupportProfile\.providerStatus === "provider-approved" && supportPlan\.launchReady/,
  );
  assert.match(privacy, /updateCareDoc/);
  assert.match(privacy, /const requestedSupportPlan = deriveSupportRunbookPlan\(launchDraft\)/);
  assert.match(
    privacy,
    /const savedProviderStatus =\s*providerStatus === "provider-approved" && !requestedSupportPlan\.launchReady\s*\?\s*"owner-reviewed"\s*:\s*providerStatus/,
  );
  assert.match(privacy, /providerStatus: savedProviderStatus/);
  assert.match(privacy, /Support runbook/);
  assert.match(privacy, /openSupportLegalProofMission/);
  assert.match(privacy, /support-legal-readiness-proof/);
  assert.match(privacy, /supportPlan\.launchBlockers/);
  assert.match(privacyModel, /launchSupportProfile/);
  assert.match(privacyModel, /clampLaunchSupportProfileForExport/);
  assert.match(privacyModel, /clampLaunchProviderProfileForExport/);
  assert.match(privacyModel, /deriveAttachmentManifest/);
  assert.match(privacy, /bundle\.counts\.localAttachments/);
  assert.match(privacy, /Attachment queue/);
  assert.match(privacy, /bundle\.storage\.attachmentReviewRows/);
  assert.match(woofGuide, /Owner review required/);
});

test("keeps Expo web export smoke wired into CI", () => {
  const rootPackage = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  );
  const mobilePackage = JSON.parse(
    readFileSync(
      join(process.cwd(), "artifacts", "woofwatcher-mobile", "package.json"),
      "utf8",
    ),
  );
  const mobileAppJson = JSON.parse(
    readFileSync(
      join(process.cwd(), "artifacts", "woofwatcher-mobile", "app.json"),
      "utf8",
    ),
  );
  const smokeScript = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "scripts",
      "smoke-web-export.js",
    ),
    "utf8",
  );
  const mobileGitignore = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", ".gitignore"),
    "utf8",
  );

  assert.equal(
    mobilePackage.scripts["smoke:web"],
    "node scripts/smoke-web-export.js",
  );
  assert.deepEqual(mobileAppJson.expo.platforms, ["ios", "android", "web"]);
  assert.equal(mobileAppJson.expo.web.bundler, "metro");
  assert.match(
    rootPackage.scripts["build:ci"],
    /woofwatcher-mobile run smoke:web/,
  );
  assert.match(smokeScript, /expo", "export"/);
  assert.match(smokeScript, /const outputDirName = "\.expo-smoke"/);
  assert.match(smokeScript, /"--output-dir", outputDirName/);
  assert.match(smokeScript, /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  assert.match(mobileGitignore, /\.expo-smoke\//);
});

test("keeps exported mobile runtime route smoke wired into CI", () => {
  const rootPackage = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  );
  const mobilePackage = JSON.parse(
    readFileSync(
      join(process.cwd(), "artifacts", "woofwatcher-mobile", "package.json"),
      "utf8",
    ),
  );
  const runtimeSmokePath = join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "scripts",
    "smoke-runtime-preview.js",
  );

  assert.equal(
    mobilePackage.scripts["smoke:runtime"],
    "node scripts/smoke-runtime-preview.js",
  );
  assert.match(
    rootPackage.scripts["build:ci"],
    /woofwatcher-mobile run smoke:web && pnpm --filter @workspace\/woofwatcher-mobile run smoke:runtime && pnpm --filter @workspace\/woofwatcher-mobile run proof:live-preview/,
  );
  assert.equal(existsSync(runtimeSmokePath), true);

  const runtimeSmokeSource = readFileSync(runtimeSmokePath, "utf8");
  assert.match(runtimeSmokeSource, /MOBILE_RUNTIME_SMOKE_ROUTES/);
  assert.match(runtimeSmokeSource, /Missing \.expo-smoke\/index\.html/);
  assert.match(runtimeSmokeSource, /WoofWatcher mobile runtime smoke passed/);
  assert.match(runtimeSmokeSource, /server\.close/);
  assert.match(runtimeSmokeSource, /127\.0\.0\.1/);

  const routeList = spawnSync(process.execPath, [runtimeSmokePath, "--list-routes"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(routeList.status, 0);
  const routes = JSON.parse(routeList.stdout) as string[];
  assert.deepEqual(routes, [
    "/",
    "/sign-in",
    "/setup",
    "/log",
    "/calendar",
    "/health",
    "/records",
    "/more",
    "/care-twin-qa",
    "/woofguide",
    "/premium",
    "/privacy",
    "/portrait",
  ]);
});

test("keeps a static beta preview server wired for Apollo review", () => {
  const rootPackage = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  );
  const mobilePackage = JSON.parse(
    readFileSync(
      join(process.cwd(), "artifacts", "woofwatcher-mobile", "package.json"),
      "utf8",
    ),
  );
  const serveSmokePreview = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "scripts",
      "serve-smoke-preview.js",
    ),
    "utf8",
  );
  const doctorSource = readFileSync(
    join(process.cwd(), "scripts", "mobile-beta-doctor.mjs"),
    "utf8",
  );

  assert.equal(
    rootPackage.scripts["preview:mobile-beta"],
    "pnpm --filter @workspace/woofwatcher-mobile run preview:smoke",
  );
  assert.equal(
    mobilePackage.scripts["preview:smoke"],
    "node scripts/serve-smoke-preview.js 4194",
  );
  assert.equal(
    mobilePackage.scripts["preview:web"],
    "node scripts/serve-smoke-preview.js 4194",
  );
  assert.equal(
    mobilePackage.scripts["proof:live-preview"],
    "node scripts/live-preview-handoff-proof.js --json",
  );
  const livePreviewProof = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "scripts",
      "live-preview-handoff-proof.js",
    ),
    "utf8",
  );
  assert.match(
    serveSmokePreview,
    /const root = path\.resolve\(projectRoot, "\.expo-smoke"\)/,
  );
  assert.match(serveSmokePreview, /process\.argv\[2\] \|\| 4194/);
  assert.match(serveSmokePreview, /Missing \.expo-smoke\/index\.html/);
  assert.match(serveSmokePreview, /Keep this terminal open/);
  assert.match(serveSmokePreview, /127\.0\.0\.1/);
  assert.match(livePreviewProof, /LIVE_PREVIEW_HANDOFF_ROUTES/);
  assert.match(livePreviewProof, /records-local-file-handoff/);
  assert.match(livePreviewProof, /report-binary-export-proof/);
  assert.match(livePreviewProof, /care-entry-provider-sync-proof/);
  assert.match(livePreviewProof, /woofguide-ai-provider-proof/);
  assert.match(livePreviewProof, /push-notifications-proof/);
  assert.match(livePreviewProof, /payments-provider-proof/);
  assert.match(livePreviewProof, /store-accounts-proof/);
  assert.match(livePreviewProof, /account-deletion-proof/);
  assert.match(livePreviewProof, /support-legal-readiness-proof/);
  assert.match(livePreviewProof, /route-visual-consistency/);
  assert.match(livePreviewProof, /web preview only/);
  assert.match(livePreviewProof, /does not replace native iOS\/Android proof/);
  assert.match(doctorSource, /proof:live-preview/);
  assert.match(doctorSource, /preview:smoke/);
  assert.match(doctorSource, /http:\/\/127\.0\.0\.1:4194\//);
  assert.match(doctorSource, /care-entry-provider-sync-proof/);
  assert.match(doctorSource, /woofguide-ai-provider-proof/);
  assert.match(doctorSource, /push-notifications-proof/);
  assert.match(doctorSource, /payments-provider-proof/);
  assert.match(doctorSource, /store-accounts-proof/);
  assert.match(doctorSource, /account-deletion-proof/);
  assert.match(doctorSource, /support-legal-readiness-proof/);
});

test("keeps local Clerk placeholders from blanking the web preview", () => {
  const auth = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "auth.ts"),
    "utf8",
  );

  assert.match(auth, /isPlaceholderPublishableKey/);
  assert.match(auth, /placeholder/);
  assert.match(auth, /local_smoke/);
  assert.match(auth, /!isPlaceholderPublishableKey/);
  assert.match(
    auth,
    /useWoofAuth = isClerkConfigured \? useClerkAuth : useLocalAuth/,
  );
});

test("keeps the web preview frame inside compact mobile screenshots", () => {
  const layout = readAppFile("_layout.tsx");
  const backdropBlock = getStyleBlock(layout, "webBackdrop");
  const frameBlock = getStyleBlock(layout, "webFrame");
  const fullBleedBlock = getStyleBlock(layout, "webFullBleed");

  assert.match(backdropBlock, /paddingHorizontal:\s*0/);
  assert.match(backdropBlock, /paddingVertical:\s*18/);
  assert.match(backdropBlock, /alignSelf:\s*"flex-start"/);
  assert.match(backdropBlock, /overflow:\s*"hidden"/);
  assert.doesNotMatch(
    backdropBlock,
    /padding:\s*18/,
    "horizontal backdrop padding makes a 390px capture crop the phone frame",
  );
  assert.match(layout, /useWindowDimensions/);
  assert.match(layout, /visualViewport/);
  assert.match(layout, /node\.style\.width = "100vw"/);
  assert.match(layout, /node\.style\.maxWidth = "100vw"/);
  assert.match(layout, /webDocument\.body\.style\.margin = "0"/);
  assert.match(layout, /const viewportWidth = webViewport\?\.width \?\? width/);
  assert.match(layout, /const shouldAnchorCompactPreview = viewportWidth <= 520/);
  // Per Apollo's 2026-07 storybook boards, phone-sized viewports render the
  // app edge-to-edge on parchment - no navy letterbox, no rounded shell. The
  // framed presentation only survives on desktop-sized windows.
  assert.match(layout, /if \(shouldAnchorCompactPreview\) \{/);
  assert.doesNotMatch(
    fullBleedBlock,
    /backgroundColor/,
    "the compact shell background must follow the active palette",
  );
  assert.match(layout, /const colors = useColors\(\)/);
  assert.match(
    layout,
    /styles\.webFullBleed,\s*\{\s*backgroundColor:\s*colors\.background/,
  );
  assert.match(
    layout,
    /styles\.webFrame,\s*\{\s*backgroundColor:\s*colors\.background/,
  );
  assert.match(
    layout,
    /styles\.webBackdrop,\s*\{[\s\S]*backgroundColor:\s*colors\.shellNavy/,
  );
  assert.match(
    layout,
    /name="fastlog"[\s\S]*contentStyle:\s*\{\s*backgroundColor:\s*colors\.background\s*\}/,
  );
  assert.doesNotMatch(fullBleedBlock, /borderRadius/);
  assert.doesNotMatch(fullBleedBlock, /padding/);
  assert.match(layout, /const frameWidth = Math\.min\(viewportWidth,\s*390\)/);
  assert.match(layout, /const frameHeight = Math\.min\(viewportHeight,\s*932\)/);
  assert.match(layout, /width: frameWidth/);
  assert.match(layout, /maxHeight: frameHeight/);
  assert.match(frameBlock, /minWidth:\s*0/);
});

test("keeps auth entry styled as the truthful CareTwin gateway", () => {
  const authUi = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "auth-ui.tsx",
    ),
    "utf8",
  );
  const signIn = readAppFile(join("(auth)", "sign-in.tsx"));
  const signUp = readAppFile(join("(auth)", "sign-up.tsx"));

  assert.match(authUi, /PIXEL_ROOM_SOURCE/);
  assert.match(authUi, /PIXEL_DOG_SOURCE/);
  assert.match(authUi, /pixelImageStyle/);
  assert.match(authUi, /WoofWatcher CareTwin account gateway/);
  assert.match(authUi, /CARETWIN ACCOUNT GATEWAY/);
  assert.match(authUi, /Real care\. Pixel heart\./);
  assert.match(authUi, /Provider account/);
  assert.match(authUi, /Local-first care/);
  assert.match(authUi, /CareTwin ready/);
  assert.match(authUi, /isClerkConfigured \? "Account ready" : "Local preview"/);
  assert.match(authUi, /openAuthSetupProofMission/);
  assert.match(authUi, /\/care-twin-qa\?qaSurface=auth-setup-onboarding-proof/);
  assert.match(authUi, /Open setup proof/);
  assert.match(authUi, /accessibilityLabel="Open auth and setup proof mission"/);
  assert.match(authUi, /accessibilityRole="button"/);
  assert.match(authUi, /buildAuthSetupProofManifest/);
  assert.match(authUi, /useCare/);
  assert.match(authUi, /state\.launchProviderProfile\.authSetupProofEvidence/);
  assert.match(authUi, /const authSetupProofManifest = buildAuthSetupProofManifest\(state\.launchProviderProfile\.authSetupProofEvidence \?\? undefined\)/);
  assert.match(authUi, /Auth\/Setup proof manifest/);
  assert.match(authUi, /authSetupProofManifest\.rows\.map/);
  assert.match(authUi, /authSetupProofManifest\.blockers\.map/);
  assert.match(authUi, /Native proof blocked/);
  assert.match(authUi, /accessibilityLabel=\{label\}/);
  assert.match(signIn, /account layer ready for shared sync/);
  assert.match(signUp, /Care data stays local-first until production sync providers are configured/);
});

test("keeps selected Quick Log launcher tiles readable in dark mode", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(
    log,
    /backgroundColor:\s*active\s*\?\s*colors\.card\s*:\s*colors\.background/,
  );
  assert.doesNotMatch(
    log,
    /backgroundColor:\s*active\s*\?\s*colors\.ivory\s*:\s*colors\.background/,
    "scheme-independent ivory makes the dark foreground label disappear",
  );
});

test("keeps the fixed-light Quick Care status and HUD bounded in dark mode", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(
    log,
    /s\.logCommandChip,\s*\{\s*backgroundColor:\s*colors\.ivory\s*\+\s*"F2",\s*borderColor:\s*colors\.brandNavy\s*\+\s*"33"\s*\}/,
    "the fixed-light Quick Care status chip needs a constant dark boundary",
  );
  assert.match(
    log,
    /selectedLauncherRequiresDetail\s*\?\s*colors\.amber\s*:\s*colors\.brandNavy/,
    "the fixed-light Ready status needs constant dark ink",
  );
  assert.match(
    log,
    /s\.logCommandDock,\s*\{\s*backgroundColor:\s*colors\.ivory\s*\+\s*"F3",\s*borderColor:\s*colors\.brandNavy\s*\+\s*"33"\s*\}/,
    "the fixed-light Quick Care HUD dock needs a constant dark boundary",
  );
  assert.match(
    log,
    /s\.logCommandHudCell,\s*\{\s*backgroundColor:\s*colors\.cream,\s*borderColor:\s*colors\.brandNavy\s*\+\s*"22"\s*\}/,
    "the fixed-light Quick Care HUD cells need constant dark boundaries",
  );
  assert.doesNotMatch(
    log,
    /s\.logCommand(?:Chip|Dock|HudCell),\s*\{[^}]*borderColor:\s*colors\.border/,
    "adaptive borders become too faint on the fixed-light Quick Care controls",
  );
});

test("keeps the fixed-light Records credential dock bounded in dark mode", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(
    records,
    /s\.recordsCredentialDock,\s*\{\s*backgroundColor:\s*colors\.ivory\s*\+\s*"F4",\s*borderColor:\s*colors\.brandNavy\s*\+\s*"33"\s*\}/,
    "the fixed-light Records credential dock needs a constant dark boundary",
  );
  assert.match(
    records,
    /s\.recordsCredentialHudCell,\s*\{\s*backgroundColor:\s*colors\.cream,\s*borderColor:\s*colors\.brandNavy\s*\+\s*"22"\s*\}/,
    "the fixed-light Records credential HUD cells need constant dark boundaries",
  );
  assert.doesNotMatch(
    records,
    /s\.recordsCredential(?:Dock|HudCell),\s*\{[^}]*borderColor:\s*colors\.border/,
    "adaptive borders become too faint on the fixed-light Records credential console",
  );
});

test("keeps selected Avatar Studio mood labels readable in dark mode", () => {
  const avatarStudio = readAppFile("portrait.tsx");

  assert.match(
    avatarStudio,
    /color:\s*active\s*\?\s*colors\.brandNavy\s*:\s*colors\.mutedForeground/,
    "selected mood labels sit on scheme-independent translucent aura colors and need constant dark ink",
  );
  assert.doesNotMatch(
    avatarStudio,
    /color:\s*active\s*\?\s*colors\.foreground\s*:\s*colors\.mutedForeground/,
    "adaptive foreground becomes near-white and loses contrast on the light mood aura",
  );
});

test("keeps fixed-light Avatar Studio template badges readable in dark mode", () => {
  const avatarStudio = readAppFile("portrait.tsx");

  assert.match(
    avatarStudio,
    /borderColor:\s*liveSprite\s*\?\s*colors\.primary\s*:\s*colors\.brandNavy\s*\+\s*"22"/,
    "the fixed-light inactive template badge needs a constant dark boundary",
  );
  assert.match(
    avatarStudio,
    /color:\s*liveSprite\s*\?\s*colors\.primaryForeground\s*:\s*colors\.brandNavy/,
    "the fixed-light inactive template badge needs constant dark ink",
  );
  assert.doesNotMatch(
    avatarStudio,
    /borderColor:\s*liveSprite\s*\?\s*colors\.primary\s*:\s*colors\.border/,
    "the adaptive border token becomes too faint around the fixed-light inactive badge",
  );
  assert.doesNotMatch(
    avatarStudio,
    /color:\s*liveSprite\s*\?\s*colors\.primaryForeground\s*:\s*colors\.mutedForeground/,
    "dark muted foreground becomes pale against the scheme-independent ivory badge",
  );
});

test("keeps the selected Avatar Studio template art bounded in dark mode", () => {
  const avatarStudio = readAppFile("portrait.tsx");

  assert.match(
    avatarStudio,
    /backgroundColor:\s*active\s*\?\s*colors\.ivory\s*:\s*tone\s*\+\s*"12",\s*borderColor:\s*active\s*\?\s*colors\.brandNavy\s*\+\s*"22"\s*:\s*colors\.border/,
    "the fixed-light selected template artwork needs a constant dark boundary",
  );
  assert.doesNotMatch(
    avatarStudio,
    /backgroundColor:\s*active\s*\?\s*colors\.ivory\s*:\s*tone\s*\+\s*"12",\s*borderColor:\s*active\s*\?\s*tone\s*:\s*colors\.border/,
    "a variable template tone can become too faint around the selected ivory artwork",
  );
});

test("keeps the fixed-light Avatar Studio photo reference readable in dark mode", () => {
  const avatarStudio = readAppFile("portrait.tsx");

  assert.match(
    avatarStudio,
    /s\.sourceProofCard,[\s\S]*?backgroundColor:\s*"rgba\(255,249,239,0\.94\)",\s*borderColor:\s*colors\.brandNavy\s*\+\s*"33"/,
    "the fixed-light photo reference card needs a constant dark boundary",
  );
  assert.match(
    avatarStudio,
    /s\.sourceProofKicker,\s*\{\s*color:\s*colors\.brandNavy/,
    "the fixed-light photo reference kicker needs constant dark ink",
  );
  assert.doesNotMatch(
    avatarStudio,
    /s\.sourceProofCard,[\s\S]*?backgroundColor:\s*"rgba\(255,249,239,0\.94\)",\s*borderColor:\s*colors\.border/,
    "the adaptive border becomes too faint around the scheme-independent photo reference",
  );
  assert.doesNotMatch(
    avatarStudio,
    /s\.sourceProofKicker,\s*\{\s*color:\s*colors\.sage/,
    "adaptive sage becomes too pale against the fixed-light photo reference card",
  );
});

test("keeps fixed-light Avatar Studio production action icons readable in dark mode", () => {
  const avatarStudio = readAppFile("portrait.tsx");

  assert.match(
    avatarStudio,
    /s\.productionActionIcon,\s*\{\s*backgroundColor:\s*colors\.ivory,\s*borderColor:\s*colors\.brandNavy\s*\+\s*"22",?\s*\}[\s\S]*?size=\{18\}\s*color=\{colors\.brandNavy\}/,
    "the fixed-light production action icon needs constant dark ink and a constant dark boundary",
  );
  assert.match(
    avatarStudio,
    /productionActionIcon:\s*\{[\s\S]*?borderWidth:\s*1,[\s\S]*?\}/,
    "the production action icon boundary needs a visible one-pixel width",
  );
  assert.doesNotMatch(
    avatarStudio,
    /s\.productionActionIcon,\s*\{\s*backgroundColor:\s*colors\.ivory(?:,\s*borderColor:\s*colors\.border)?\s*\}/,
    "an absent or adaptive border becomes too faint around the scheme-independent ivory action tile",
  );
});

test("keeps fixed-light Avatar Studio emote icons bounded in dark mode", () => {
  const avatarStudio = readAppFile("portrait.tsx");

  assert.match(
    avatarStudio,
    /s\.emoteIcon,\s*\{\s*backgroundColor:\s*colors\.ivory,\s*borderColor:\s*colors\.brandNavy\s*\+\s*"22",?\s*\}/,
    "the fixed-light emote icon needs a constant dark boundary",
  );
  assert.doesNotMatch(
    avatarStudio,
    /s\.emoteIcon,\s*\{\s*backgroundColor:\s*colors\.ivory,\s*borderColor:\s*colors\.border\s*\}/,
    "the adaptive border becomes too faint around the fixed-light emote icon",
  );
});

test("keeps the fixed-light Avatar Studio speech bubble readable in dark mode", () => {
  const avatarStudio = readAppFile("portrait.tsx");

  assert.match(
    avatarStudio,
    /backgroundColor:\s*colors\.ivory,\s*borderColor:\s*colors\.brandNavy/,
    "the fixed-light template speech bubble needs a constant dark boundary",
  );
  assert.match(
    avatarStudio,
    /s\.templateSpeechText,\s*\{\s*color:\s*colors\.brandNavy/,
    "the fixed-light template speech bubble needs constant dark ink",
  );
  assert.doesNotMatch(
    avatarStudio,
    /s\.templateSpeechText,\s*\{\s*color:\s*colors\.forest/,
    "dark forest becomes too light against the scheme-independent ivory bubble",
  );
});

test("keeps the fixed-light Home Avatar Studio launcher visible in dark mode", () => {
  const home = readAppFile("(tabs)/index.tsx");

  assert.match(
    home,
    /s\.heroStudioChip,[\s\S]*?backgroundColor:\s*pressed\s*\?\s*colors\.ivory\s*:\s*"rgba\(251,246,231,0\.94\)"[\s\S]*?borderColor:\s*colors\.brandNavy/,
    "the fixed-light Home Avatar Studio launcher needs a constant dark boundary",
  );
  assert.match(
    home,
    /name="color-wand-outline"\s+size=\{17\}\s+color=\{colors\.brandNavy\}/,
    "the fixed-light Home Avatar Studio launcher needs a constant dark icon",
  );
  assert.doesNotMatch(
    home,
    /name="color-wand-outline"\s+size=\{17\}\s+color=\{colors\.forest\}/,
    "dark forest becomes too light against the scheme-independent launcher",
  );
});

test("keeps the fixed-light living care-twin location chip bounded in dark mode", () => {
  const room = readAppFile("../components/LivingPhoenixRoom.tsx");

  assert.match(
    room,
    /styles\.zoneChip,\s*\{\s*backgroundColor:\s*"rgba\(255,249,239,0\.93\)",\s*borderColor:\s*colors\.brandNavy\s*\+\s*"33",?\s*\}/,
    "the fixed-light care-twin location chip needs a constant dark boundary",
  );
  assert.doesNotMatch(
    room,
    /styles\.zoneChip,[\s\S]*?borderColor:\s*theme\.accent/,
    "a pale mood accent can disappear around the fixed-light location chip",
  );
});

test("keeps fixed-light Quick Care and Records HUD labels readable in dark mode", () => {
  const quickCare = readAppFile("(tabs)/log.tsx");
  const records = readAppFile("(tabs)/records.tsx");

  assert.match(
    quickCare,
    /s\.logCommandHudLabel,\s*\{\s*color:\s*colors\.brandNavy/,
    "the fixed-light Quick Care HUD needs constant dark label ink",
  );
  assert.match(
    records,
    /s\.recordsCredentialHudLabel,\s*\{\s*color:\s*colors\.brandNavy/,
    "the fixed-light Records HUD needs constant dark label ink",
  );
  assert.match(
    records,
    /s\.recordsCredentialIdLabel,\s*\{\s*color:\s*colors\.brandNavy/,
    "the fixed-light Records Dog ID label needs constant dark ink",
  );
  assert.match(
    records,
    /<PetPortrait\s+size=\{38\}\s+ringColor=\{colors\.brandNavy\s*\+\s*"55"\}\s*\/>/,
    "the fixed-light Records Dog ID portrait needs a constant dark ring",
  );
  assert.doesNotMatch(
    quickCare,
    /s\.logCommandHudLabel,\s*\{\s*color:\s*colors\.sage/,
    "adaptive sage becomes too light against the scheme-independent cream HUD cell",
  );
  assert.doesNotMatch(
    records,
    /s\.recordsCredentialHudLabel,\s*\{\s*color:\s*colors\.sage/,
    "adaptive sage becomes too light against the scheme-independent cream HUD cell",
  );
  assert.doesNotMatch(
    records,
    /s\.recordsCredentialIdLabel,\s*\{\s*color:\s*colors\.sage/,
    "adaptive sage becomes too light against the scheme-independent ivory Dog ID plate",
  );
  assert.doesNotMatch(
    records,
    /<PetPortrait\s+size=\{38\}\s+ringColor=\{recordsVaultTone/,
    "adaptive readiness tones become unreliable around the scheme-independent ivory Dog ID portrait",
  );
});

test("keeps the fixed-light More profile edit control visible in dark mode", () => {
  const more = readAppFile("(tabs)/more.tsx");

  assert.match(
    more,
    /s\.profileEditBtn,\s*\{\s*backgroundColor:\s*colors\.ivory,\s*borderColor:\s*colors\.brandNavy\s*\+\s*"22"\s*\}/,
    "the fixed-light More profile edit control needs a constant dark boundary",
  );
  assert.match(
    more,
    /name="pencil"\s+size=\{14\}\s+color=\{colors\.brandNavy\}/,
    "the fixed-light More profile edit control needs a constant dark icon",
  );
  assert.doesNotMatch(
    more,
    /name="pencil"\s+size=\{14\}\s+color=\{colors\.forest\}/,
    "adaptive forest becomes pale and loses contrast on the fixed-light edit control",
  );
  assert.doesNotMatch(
    more,
    /s\.profileEditBtn,\s*\{\s*backgroundColor:\s*colors\.ivory\s*\}/,
    "an unbounded ivory control can disappear against light profile artwork",
  );
});

test("keeps fixed-light Auth gateway panels bounded in dark mode", () => {
  const authUi = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "auth-ui.tsx",
    ),
    "utf8",
  );

  assert.match(
    authUi,
    /styles\.stageHud,\s*\{\s*backgroundColor:\s*colors\.ivory,\s*borderColor:\s*colors\.brandNavy\s*\+\s*"22"\s*\}/,
    "the fixed-light Auth stage HUD needs a constant dark boundary",
  );
  assert.match(
    authUi,
    /styles\.proofManifest,\s*\{\s*backgroundColor:\s*colors\.ivory,\s*borderColor:\s*colors\.brandNavy\s*\+\s*"22"\s*\}/,
    "the fixed-light Auth proof manifest needs a constant dark boundary",
  );
  assert.match(
    authUi,
    /styles\.proofManifestCell,\s*\{\s*borderColor:\s*colors\.brandNavy\s*\+\s*"22"\s*\}/,
    "the fixed-light Auth proof manifest cells need constant dark boundaries",
  );
  assert.doesNotMatch(
    authUi,
    /backgroundColor:\s*colors\.ivory,\s*borderColor:\s*colors\.border/,
    "the adaptive dark border becomes too faint on fixed-light Auth panels",
  );
  assert.match(
    authUi,
    /styles\.stageDot,\s*\{\s*backgroundColor:\s*colors\.brandNavy\s*\}/,
    "the fixed-light Auth stage HUD status dot needs constant dark ink",
  );
  assert.match(
    authUi,
    /color:\s*row\.status\s*===\s*"ready"\s*\?\s*colors\.brandNavy\s*:\s*BUBBLE_INK/,
    "the fixed-light Auth proof manifest needs constant dark status ink",
  );
  assert.doesNotMatch(
    authUi,
    /styles\.stageDot,\s*\{\s*backgroundColor:\s*colors\.sage\s*\}/,
    "adaptive sage becomes too light against the scheme-independent ivory Auth HUD",
  );
  assert.doesNotMatch(
    authUi,
    /color:\s*row\.status\s*===\s*"ready"\s*\?\s*colors\.sage\s*:\s*BUBBLE_INK/,
    "adaptive sage becomes too light against the scheme-independent ivory Auth proof manifest",
  );
});

test("keeps critical mobile actions accessible to screen readers", () => {
  const privacy = readAppFile("privacy.tsx");
  const premium = readAppFile("premium.tsx");
  const woofGuide = readAppFile("woofguide.tsx");
  const more = readAppFile(join("(tabs)", "more.tsx"));

  assert.match(privacy, /accessibilityLabel="Close Privacy and Safety"/);
  assert.match(privacy, /accessibilityLabel="Export WoofWatcher care data"/);
  assert.match(
    privacy,
    /accessibilityLabel="Prepare account deletion request"/,
  );
  assert.match(
    privacy,
    /accessibilityLabel="Share WoofWatcher support runbook"/,
  );
  assert.match(
    privacy,
    /accessibilityLabel="Open support legal readiness proof mission"/,
  );
  assert.match(
    privacy,
    /accessibilityLabel="Edit WoofWatcher launch support profile"/,
  );
  assert.match(premium, /accessibilityLabel="Open premium launch checklist"/);
  assert.match(premium, /accessibilityLabel="Back to care"/);
  assert.match(woofGuide, /accessibilityLabel=\{`Ask WoofGuide: \$\{q\}`\}/);
  assert.match(
    woofGuide,
    /accessibilityLabel=\{`Review WoofGuide action: \$\{action\.label\}/,
  );
  assert.match(woofGuide, /accessibilityLabel="Close owner review"/);
  assert.match(woofGuide, /accessibilityLabel="Send WoofGuide message"/);
  assert.match(more, /accessibilityLabel="Edit dog profile"/);
  assert.match(more, /accessibilityLabel="Open WoofWatcher Plus"/);
  assert.match(more, /accessibilityLabel=\{`\$\{l\.label\}\. \$\{l\.sub\}`\}/);
  assert.match(more, /accessibilityLabel="Sign out of WoofWatcher"/);
});

test("keeps tabbed mobile routes clear of the floating paw nav", () => {
  const mobileLayout = readMobileLibFile("mobileLayout.ts");
  const tabs = readAppFile(join("(tabs)", "_layout.tsx"));
  const tabbedRoutes = [
    "index",
    "log",
    "calendar",
    "health",
    "more",
    "records",
  ];

  assert.match(mobileLayout, /getFloatingTabChromeMetrics/);
  assert.match(mobileLayout, /getTabbedRouteBottomPadding/);
  assert.match(mobileLayout, /getStandaloneRouteBottomPadding/);
  assert.match(mobileLayout, /getDockedComposerBottomPadding/);
  assert.match(mobileLayout, /getRouteTopPadding/);
  assert.match(mobileLayout, /getKeyboardAvoidingVerticalOffset/);
  assert.match(mobileLayout, /getModalSheetBottomPadding/);
  assert.match(mobileLayout, /MIN_MOBILE_TOUCH_TARGET/);
  assert.match(mobileLayout, /MOBILE_INLINE_HIT_SLOP/);
  assert.match(tabs, /getFloatingTabChromeMetrics/);
  assert.match(tabs, /centerFabBottom/);
  assert.match(tabs, /tabBarHeight/);

  for (const route of tabbedRoutes) {
    const source = readAppFile(join("(tabs)", `${route}.tsx`));
    assert.match(
      source,
      /getTabbedRouteBottomPadding/,
      `${route} should use shared tab bottom padding`,
    );
    assert.match(
      source,
      /getRouteTopPadding/,
      `${route} should use shared top safe-area padding`,
    );
    assert.doesNotMatch(
      source,
      /paddingBottom:\s*(?:128|130|142)\b/,
      `${route} should not hard-code floating tab clearance`,
    );
    assert.doesNotMatch(
      source,
      /paddingTop:\s*(?:topInset\s*\+|\(Platform\.OS === "web"[^,\n]*\+\s*\d+|insets\.top\s*\+\s*\d+)/,
      `${route} should not hard-code route top safe-area padding`,
    );
  }
});

test("keeps standalone mobile routes on shared safe-area helpers", () => {
  const standaloneRoutes = [
    "adventure",
    "portrait",
    "care-twin-qa",
    "premium",
    "privacy",
    "setup",
  ];
  const authUi = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "auth-ui.tsx",
    ),
    "utf8",
  );
  const woofGuide = readAppFile("woofguide.tsx");

  for (const route of standaloneRoutes) {
    const source = readAppFile(`${route}.tsx`);
    assert.match(
      source,
      /getStandaloneRouteBottomPadding/,
      `${route} should use shared standalone route bottom padding`,
    );
    assert.match(
      source,
      /getRouteTopPadding/,
      `${route} should use shared top safe-area padding`,
    );
    assert.doesNotMatch(
      source,
      /paddingBottom:\s*(?:72|insets\.bottom\s*\+\s*(?:18|32|38|40|44))\b/,
      `${route} should not hard-code standalone bottom clearance`,
    );
    assert.doesNotMatch(
      source,
      /paddingTop:\s*(?:topInset\s*\+|\(Platform\.OS === "web"[^,\n]*\+\s*\d+|insets\.top\s*\+\s*\d+)/,
      `${route} should not hard-code route top safe-area padding`,
    );
  }

  assert.match(authUi, /getStandaloneRouteBottomPadding/);
  assert.match(authUi, /getRouteTopPadding/);
  assert.doesNotMatch(authUi, /paddingBottom:\s*insets\.bottom\s*\+\s*32/);
  assert.doesNotMatch(authUi, /paddingTop:\s*insets\.top\s*\+\s*48/);
  assert.match(woofGuide, /getDockedComposerBottomPadding/);
  assert.match(woofGuide, /getKeyboardAvoidingVerticalOffset/);
  assert.match(woofGuide, /getModalSheetBottomPadding/);
  assert.doesNotMatch(woofGuide, /bottomInset\s*=\s*Platform\.OS/);
  assert.doesNotMatch(woofGuide, /paddingBottom:\s*bottomInset\s*\+\s*12/);
});

test("keeps mobile interaction contracts centralized for route chrome, modals, and inline controls", () => {
  const boardPrimitives = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "board",
      "BoardPrimitives.tsx",
    ),
    "utf8",
  );
  const errorFallback = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "ErrorFallback.tsx",
    ),
    "utf8",
  );
  const routeSources = [
    ...listAppFiles(),
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "auth-ui.tsx",
    ),
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "ErrorFallback.tsx",
    ),
  ];

  assert.match(boardPrimitives, /MIN_MOBILE_TOUCH_TARGET/);
  assert.match(errorFallback, /getModalSheetBottomPadding/);

  for (const file of routeSources) {
    const source = readFileSync(file, "utf8");
    const label = relative(process.cwd(), file);

    assert.doesNotMatch(
      source,
      /paddingTop:\s*(?:topInset\s*\+|\(Platform\.OS === "web"[^,\n]*\+\s*\d+|insets\.top\s*\+\s*\d+)/,
      `${label} should use shared top safe-area padding helpers`,
    );
    assert.doesNotMatch(
      source,
      /paddingBottom:\s*insets\.bottom\s*\+\s*(?:16|18|20|32|38|40|44)/,
      `${label} should use shared modal/bottom safe-area padding helpers`,
    );
    assert.doesNotMatch(
      source,
      /hitSlop=\{(?:8|10)\}/,
      `${label} should use shared inline hit slop constants`,
    );
  }
});

test("registers the care twin native QA route for device review", () => {
  const rootLayout = readAppFile("_layout.tsx");
  const more = readAppFile(join("(tabs)", "more.tsx"));
  const qaRoute = readAppFile("care-twin-qa.tsx");
  const qaSession = readMobileLibFile("mobileQaSession.ts");
  const releaseQa = readMobileLibFile("mobileReleaseQa.ts");
  const qaEvidence = readMobileLibFile("mobileLaunchQaEvidence.ts");
  const careTwinReport = readMobileLibFile("careTwinQaReport.ts");
  const boardPrimitives = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "board",
      "BoardPrimitives.tsx",
    ),
    "utf8",
  );

  assert.match(rootLayout, /name="care-twin-qa"/);
  assert.match(
    qaRoute,
    /import \{ BoardCard, BoardPill, BoardRouteHeader, BoardSectionHeader \}/,
  );
  assert.doesNotMatch(qaRoute, /<BoardSectionHeader[\s\S]*?\saction=/);
  assert.match(
    more,
    /buildCareTwinQaFocusRoute\(nativeQaPrimaryMissionTarget\)/,
  );
  assert.match(more, /isOwnerOpsBuild/);
  assert.match(qaRoute, /listCareTwinRuntimeQaScenarios/);
  assert.match(qaRoute, /evaluateCareTwinRuntimeQaScenario/);
  assert.match(qaRoute, /deriveCareTwinChoreography/);
  assert.match(qaRoute, /motionRecipeForSpriteAction/);
  assert.match(qaRoute, /LivingPhoenixRoom/);
  assert.match(qaRoute, /nativeQaPrompt/);
  assert.match(
    qaRoute,
    /testID=\{`care-twin-qa-stage-\$\{result\.scenario\.id\}`\}/,
  );
  assert.match(qaRoute, /Mobile release cockpit\./);
  assert.match(qaRoute, /qaStatusById/);
  assert.match(qaRoute, /qaNotes/);
  assert.match(qaRoute, /shareTextPayload/);
  assert.match(qaRoute, /buildCareTwinQaShareText/);
  assert.match(qaRoute, /listMobileReleaseQaSurfaces/);
  assert.match(qaRoute, /buildMobileReleaseQaShareText/);
  assert.match(qaRoute, /buildMobileLaunchQaCapturePlan/);
  assert.match(qaRoute, /buildStoreSubmissionScreenshotQaSurfaces/);
  assert.match(qaRoute, /buildStoreSubmissionPacket/);
  assert.match(qaRoute, /buildStoreSubmissionPacketShareText/);
  assert.match(qaRoute, /buildReleasePacket/);
  assert.match(qaRoute, /deriveLaunchReadiness/);
  assert.match(qaRoute, /deriveAttachmentManifest/);
  assert.match(qaRoute, /deriveSupportRunbookPlan/);
  assert.match(
    qaRoute,
    /const attachmentManifest = useMemo\(\s*\(\) =>\s*deriveAttachmentManifest\(/,
  );
  assert.match(
    qaRoute,
    /storageProviderConfigured:\s*launchProviderSetupPlan\.providerInput\.storageProviderConfigured/,
  );
  assert.match(
    qaRoute,
    /storageProviderEvidence:\s*launchProviderSetupPlan\.providerInput\.storageProviderEvidence/,
  );
  assert.match(
    qaRoute,
    /const launchSupportPlan = useMemo\(\s*\(\) => deriveSupportRunbookPlan\(state\.launchSupportProfile\),\s*\[state\.launchSupportProfile\],\s*\)/,
  );
  assert.match(qaRoute, /storageQueue:\s*attachmentManifest\.launchQueue/);
  assert.match(qaRoute, /authProviderProofReady:\s*Boolean\(launchProviderSetupPlan\.providerInput\.authProviderProofReady\)/);
  assert.match(qaRoute, /storageProviderProofReady:\s*Boolean\(launchProviderSetupPlan\.providerInput\.storageProviderProofReady\)/);
  assert.match(qaRoute, /storeAccountsProofReady:\s*Boolean\(launchProviderSetupPlan\.providerInput\.storeAccountsProofReady\)/);
  assert.match(qaRoute, /privacyLegalApproved,\s*privacyLegalOwnerReviewed/);
  assert.match(qaRoute, /supportRunbookApproved,\s*supportRunbookOwnerReviewed/);
  assert.doesNotMatch(qaRoute, /provider:\s*\{[\s\S]*storageProviderConfigured:\s*false/);
  assert.doesNotMatch(qaRoute, /provider:\s*\{[\s\S]*privacyLegalApproved:\s*false/);
  assert.doesNotMatch(qaRoute, /provider:\s*\{[\s\S]*supportRunbookApproved:\s*false/);
  assert.match(qaRoute, /storeSubmissionPacket\.screenshotChecklist/);
  assert.match(qaRoute, /Store Screenshot QA/);
  assert.match(
    qaRoute,
    /BoardSectionHeader\s+title="Launch Workflow QA"[\s\S]*<BoardPill\s+label=\{releaseScreenshotEvidenceComplete \? "platform proof complete" : releaseMissingEvidenceLabel\}/,
  );
  assert.match(
    qaRoute,
    /BoardSectionHeader\s+title="Store Screenshot QA"[\s\S]*<BoardPill\s+label=\{storeSubmissionPacket\.verdictLabel\}/,
  );
  assert.match(qaRoute, /Store route check/);
  assert.match(qaRoute, /surface\.routeChecklist\?\.length/);
  assert.match(qaRoute, /Open store screenshot route item:/);
  assert.match(
    qaRoute,
    /BoardSectionHeader\s+title="Device Review Matrix"[\s\S]*<BoardPill\s+label=\{`\$\{scenarios\.length\} scenes`\}/,
  );
  assert.match(qaRoute, /Share store packet/);
  assert.match(qaRoute, /AsyncStorage/);
  assert.match(qaRoute, /MOBILE_QA_SESSION_STORAGE_KEY/);
  assert.match(qaRoute, /parseMobileQaSessionSnapshot/);
  assert.match(qaRoute, /buildMobileQaSessionSnapshot/);
  assert.match(qaRoute, /buildMobileQaSessionProofManifest/);
  assert.match(qaRoute, /buildMobileQaSessionProofManifestShareText/);
  assert.match(qaRoute, /qaProofManifest\.proofId/);
  assert.match(qaRoute, /Proof manifest:/);
  assert.match(qaRoute, /store approval and provider proof stay separate/);
  assert.match(qaRoute, /Saved locally/);
  assert.match(qaRoute, /Motion recipe/);
  assert.match(qaRoute, /choreography\.qaSummary/);
  assert.match(qaRoute, /choreography\.tapReaction\.action/);
  assert.match(qaRoute, /motionRecipe\.qaHint/);
  assert.match(qaRoute, /careTwinQaReviewStatusLabel/);
  assert.match(qaRoute, /careTwinQaMissingNativeProof/);
  assert.match(qaRoute, /scenarioPassPendingProof/);
  assert.match(qaRoute, /Pass pending native proof/);
  assert.match(qaRoute, /Motion proof/);
  assert.match(qaRoute, /Stage framing proof/);
  assert.match(qaRoute, /result\.stageFraming/);
  assert.match(qaRoute, /stageFraming\.cropRule/);
  assert.match(qaRoute, /stageFraming\.hudClearanceRule/);
  assert.match(qaRoute, /stageFraming\.singleAvatarRule/);
  assert.match(qaRoute, /stageFraming\.phoneQaHint/);
  assert.match(qaRoute, /ImagePicker\.launchImageLibraryAsync/);
  assert.match(qaRoute, /buildQaScreenshotEvidence/);
  assert.match(qaRoute, /qaScreenshotPlatformForRuntime/);
  assert.match(qaRoute, /selectedEvidencePlatform/);
  assert.match(qaRoute, /Tag screenshot evidence/);
  assert.match(qaRoute, /Tag QA screenshots as \$\{option\.label\}/);
  assert.match(qaRoute, /targetPlatform: selectedEvidencePlatform/);
  assert.match(
    qaRoute,
    /New attachments are tagged as \{targetPlatformLabel\}/,
  );
  assert.match(
    qaRoute,
    /qaScreenshotEvidencePlatformLabel\(item\.targetPlatform\)/,
  );
  assert.match(qaRoute, /qaEvidenceById/);
  assert.match(qaRoute, /surfaceEvidenceById/);
  assert.match(qaRoute, /Attach screenshot/);
  assert.match(qaRoute, /Screenshot evidence/);
  assert.match(qaRoute, /Clear attached QA screenshots/);
  assert.match(qaRoute, /releaseSummary\.attachedIosScreenshots/);
  assert.match(qaRoute, /releaseSummary\.attachedAndroidScreenshots/);
  assert.match(qaRoute, /formatMobileReleaseQaPlatformEvidence/);
  assert.match(qaRoute, /formatMobileReleaseQaMissingEvidence/);
  assert.match(qaRoute, /mobileReleaseQaReviewStatusLabel/);
  assert.match(qaRoute, /mobileReleaseQaMissingEvidenceForSurface/);
  assert.match(qaRoute, /surfacePassPendingProof/);
  assert.match(qaRoute, /Pass pending release proof/);
  assert.match(qaRoute, /mobileReleaseQaScreenshotEvidenceComplete/);
  assert.match(qaRoute, /Native proof open/);
  assert.match(qaRoute, /Platform proof:/);
  assert.match(qaRoute, /48-hour beta run/);
  assert.match(qaRoute, /nextBetaMission/);
  assert.match(qaRoute, /betaCapturePlan\.primaryMission/);
  assert.match(qaRoute, /nextBetaTarget/);
  assert.match(qaRoute, /nextBetaSurface/);
  assert.match(qaRoute, /Primary device mission/);
  assert.match(qaRoute, /nextBetaMission\.doneCondition/);
  assert.match(qaRoute, /Owner route loop/);
  assert.match(qaRoute, /nextBetaTarget\.routeChecklist/);
  assert.match(qaRoute, /openRouteLoopCheck/);
  assert.match(qaRoute, /Open owner route loop item:/);
  assert.match(qaRoute, /Native route targets/);
  assert.match(qaRoute, /Open focused route target:/);
  assert.match(qaRoute, /routeCheck\.expected/);
  assert.match(qaRoute, /mobileReleaseQaRouteProofLabel/);
  assert.match(releaseQa, /buildRouteVisualProofManifest/);
  assert.match(releaseQa, /Route visual proof manifest/);
  assert.match(releaseQa, /Native proof blocked/);
  assert.match(releaseQa, /Web preview route proof can catch shell regressions/);
  assert.match(qaRoute, /buildAuthSetupProofManifest/);
  assert.match(qaRoute, /authSetupProofManifest/);
  assert.match(qaRoute, /Auth\/Setup proof manifest/);
  assert.match(qaRoute, /authSetupProofManifest\.rows\.map/);
  assert.match(qaRoute, /authSetupProofManifest\.blockers\.map/);
  assert.match(qaRoute, /Auth and Setup native proof must stay blocked/);
  assert.match(qaRoute, /buildRecordsLocalFileHandoffProofManifest/);
  assert.match(qaRoute, /recordsLocalFileHandoffProofManifest/);
  assert.match(qaRoute, /Records local file handoff proof manifest/);
  assert.match(qaRoute, /recordsLocalFileHandoffProofManifest\.items\.map/);
  assert.match(qaRoute, /recordsLocalFileHandoffProofManifest\.blockers\.map/);
  assert.match(qaRoute, /Native file proof allowed/);
  assert.match(qaRoute, /Records local files must stay device-verified/);
  assert.match(qaRoute, /buildReportBinaryExportProofManifest/);
  assert.match(qaRoute, /reportBinaryExportProofManifest/);
  assert.match(qaRoute, /Report binary export proof manifest/);
  assert.match(qaRoute, /reportBinaryExportProofManifest\.rows\.map/);
  assert.match(qaRoute, /reportBinaryExportProofManifest\.blockers\.map/);
  assert.match(qaRoute, /Generated artifacts allowed/);
  assert.match(qaRoute, /Generated PDF\/PNG readiness must stay blocked/);
  assert.match(qaRoute, /buildRouteVisualProofManifest/);
  assert.match(qaRoute, /routeVisualProofManifest/);
  assert.match(qaRoute, /Route visual proof manifest/);
  assert.match(qaRoute, /routeVisualProofManifest\.rows\.map/);
  assert.match(qaRoute, /routeVisualProofManifest\.blockers\.map/);
  assert.match(qaRoute, /routeVisualProofManifest\.webPreviewBoundary/);
  assert.match(qaRoute, /deriveCareEntryProviderSyncProof/);
  assert.match(qaRoute, /careEntryProviderSyncProofManifest/);
  assert.match(qaRoute, /Care-entry provider sync proof manifest/);
  assert.match(qaRoute, /careEntryProviderSyncProofManifest\.items\.map/);
  assert.match(qaRoute, /careEntryProviderSyncProofManifest\.blockers\.map/);
  assert.match(qaRoute, /Incremental sync allowed/);
  assert.match(qaRoute, /Mobile must remain on full-refresh care-entry refresh/);
  assert.match(qaRoute, /buildAiProviderProofManifest/);
  assert.match(qaRoute, /woofGuideAiProviderProofManifest/);
  assert.match(qaRoute, /WoofGuide AI provider proof manifest/);
  assert.match(qaRoute, /woofGuideAiProviderProofManifest\.items\.map/);
  assert.match(qaRoute, /woofGuideAiProviderProofManifest\.blockers\.map/);
  assert.match(qaRoute, /Live AI allowed/);
  assert.match(qaRoute, /WoofGuide must stay deterministic and owner-reviewed/);
  assert.match(qaRoute, /buildPushNotificationsProofManifest/);
  assert.match(qaRoute, /pushNotificationsProofManifest/);
  assert.match(qaRoute, /Push notifications proof manifest/);
  assert.match(qaRoute, /pushNotificationsProofManifest\.items\.map/);
  assert.match(qaRoute, /pushNotificationsProofManifest\.blockers\.map/);
  assert.match(qaRoute, /Reminder delivery allowed/);
  assert.match(qaRoute, /Reminder Center must stay local/);
  assert.match(qaRoute, /buildPaymentsProviderProofManifest/);
  assert.match(
    qaRoute,
    /buildPaymentsProviderProofManifest\(state\.launchProviderProfile\.paymentsProviderEvidence \?\? undefined\)/,
  );
  assert.match(qaRoute, /paymentsProviderProofManifest/);
  assert.match(qaRoute, /Payments provider proof manifest/);
  assert.match(qaRoute, /paymentsProviderProofManifest\.rows\.map/);
  assert.match(qaRoute, /paymentsProviderProofManifest\.blockers\.map/);
  assert.match(qaRoute, /Checkout allowed/);
  assert.match(qaRoute, /Paid checkout must stay blocked/);
  assert.match(qaRoute, /buildStoreAccountsProofManifest/);
  assert.match(qaRoute, /storeAccountsProofManifest/);
  assert.match(qaRoute, /Store accounts proof manifest/);
  assert.match(qaRoute, /storeAccountsProofManifest\.items\.map/);
  assert.match(qaRoute, /storeAccountsProofManifest\.blockers\.map/);
  assert.match(qaRoute, /App submission allowed/);
  assert.match(qaRoute, /Store submission must stay blocked/);
  assert.match(qaRoute, /buildAccountDeletionProofManifest/);
  assert.match(qaRoute, /accountDeletionProofManifest/);
  assert.match(qaRoute, /Account deletion proof manifest/);
  assert.match(qaRoute, /accountDeletionProofManifest\.items\.map/);
  assert.match(qaRoute, /accountDeletionProofManifest\.blockers\.map/);
  assert.match(qaRoute, /Destructive deletion allowed/);
  assert.match(qaRoute, /Destructive account deletion must stay blocked/);
  assert.match(qaRoute, /buildSupportLegalReadinessProofManifest/);
  assert.match(
    qaRoute,
    /buildSupportLegalReadinessProofManifest\(state\.launchSupportProfile\.supportLegalReadinessEvidence\)/,
  );
  assert.match(qaRoute, /supportLegalReadinessProofManifest/);
  assert.match(qaRoute, /Support legal readiness proof manifest/);
  assert.match(qaRoute, /supportLegalReadinessProofManifest\.items\.map/);
  assert.match(qaRoute, /supportLegalReadinessProofManifest\.blockers\.map/);
  assert.match(qaRoute, /Public launch allowed/);
  assert.match(qaRoute, /Public launch must stay blocked/);
  assert.match(qaRoute, /Mission note/);
  assert.match(qaRoute, /Mission note for \$\{nextBetaTarget\.title\}/);
  assert.match(qaRoute, /surfaceNotes\[nextBetaTarget\.surfaceId\]/);
  assert.match(qaRoute, /setSurfaceNotes/);
  assert.match(
    qaRoute,
    /nextBetaTargetMissingEvidence\.some\(\(item\) => item\.includes\("QA note"\)\)/,
  );
  assert.match(qaRoute, /nextBetaTargetMissingEvidence/);
  assert.match(qaRoute, /nextBetaTargetPassPendingProof/);
  assert.match(qaRoute, /Pass pending proof/);
  assert.match(qaRoute, /This mission is marked Pass, but it stays open/);
  assert.match(qaRoute, /nextBetaTargetMissingEvidence\.slice\(0, 2\)/);
  assert.match(qaRoute, /Before capture/);
  assert.match(qaRoute, /Pass when/);
  assert.match(qaRoute, /Needs tune if/);
  assert.match(qaRoute, /nextBetaTarget\.route/);
  assert.match(qaRoute, /nextBetaTarget\.evidenceAttached/);
  assert.match(qaRoute, /mobileReleaseQaStatusLabel\(nextBetaTarget\.status\)/);
  assert.match(qaRoute, /nextBetaTarget\.setupSteps\.slice\(0, 2\)/);
  assert.match(qaRoute, /nextBetaTarget\.acceptanceCriteria\.slice\(0, 2\)/);
  assert.match(qaRoute, /nextBetaTarget\.failureEscalation/);
  assert.match(qaRoute, /Attach proof for next beta mission:/);
  assert.match(qaRoute, /attachSurfaceScreenshot\(nextBetaSurface\)/);
  assert.match(qaRoute, /Tagged as \{selectedEvidencePlatformLabel\}/);
  assert.match(qaRoute, /Mark next beta mission pass:/);
  assert.match(qaRoute, /markSurface\(nextBetaTarget\.surfaceId, "pass"\)/);
  assert.match(qaRoute, /Mark next beta mission needs tune:/);
  assert.match(
    qaRoute,
    /markSurface\(nextBetaTarget\.surfaceId, "needs-review"\)/,
  );
  assert.match(qaRoute, /minHeight: MIN_MOBILE_TOUCH_TARGET/);
  for (const styleName of [
    "betaRunPlatformOption",
    "betaRunPrimary",
    "betaRunSecondary",
    "betaRunRouteLoopRow",
    "storeRouteLoopRow",
    "shareButton",
    "attachButton",
    "clearEvidenceButton",
    "openSurfaceButton",
    "reviewButton",
  ]) {
    assertStyleUsesSharedTouchTarget(qaRoute, styleName);
  }
  assert.match(qaRoute, /Open Next Surface/);
  assert.match(qaRoute, /buildQaReturnRoute/);
  assert.match(qaRoute, /buildMobileLaunchQaReturnRoute/);
  assert.match(qaEvidence, /buildMobileLaunchQaReturnRoute/);
  assert.match(qaEvidence, /qaReturn=care-twin-qa/);
  assert.match(qaEvidence, /qaSurface=\$\{encodeURIComponent\(surfaceId\)\}/);
  assert.match(qaEvidence, /qaTitle=\$\{encodeURIComponent\(title\)\}/);
  assert.match(
    qaRoute,
    /accessibilityLabel=\{[\s\S]*Open next beta QA surface:/,
  );
  assert.match(boardPrimitives, /useLocalSearchParams/);
  assert.match(boardPrimitives, /qaReturn === "care-twin-qa"/);
  assert.match(boardPrimitives, /Return to QA Cockpit/);
  assert.match(boardPrimitives, /Capture done\? Attach proof/);
  assert.match(boardPrimitives, /function buildQaReturnToCockpitRoute/);
  assert.match(
    boardPrimitives,
    /qaSurface \? `\/care-twin-qa\?qaSurface=\$\{encodeURIComponent\(qaSurface\)\}` : "\/care-twin-qa"/,
  );
  assert.match(
    boardPrimitives,
    /router\.push\(buildQaReturnToCockpitRoute\(qaSurface\) as never\)/,
  );
  assert.match(boardPrimitives, /qaReturnBanner/);
  assert.doesNotMatch(
    qaRoute,
    /releaseSummary\.missingScreenshots === 0 \? colors\.sage : colors\.amber/,
  );
  assert.match(qaSession, /careTwinEvidenceById/);
  assert.match(qaSession, /surfaceEvidenceById/);
  assert.match(qaSession, /cleanQaScreenshotEvidence/);
  assert.match(qaSession, /screenshotEvidence/);
  assert.match(qaSession, /MobileQaSessionProofManifest/);
  assert.match(qaSession, /proofFingerprint/);
  assert.match(qaSession, /buildMobileQaSessionProofManifestShareText/);
  assert.match(qaSession, /does not prove App Store or Play Store approval/);
  assert.match(releaseQa, /attachedScreenshots/);
  assert.match(releaseQa, /requiredIosScreenshots/);
  assert.match(releaseQa, /attachedIosScreenshots/);
  assert.match(releaseQa, /missingAndroidScreenshots/);
  assert.match(releaseQa, /mobileReleaseQaScreenshotEvidenceComplete/);
  assert.match(
    releaseQa,
    /route: "\/log\?type=incident&detail=1&intent=incident-composer"/,
  );
  assert.doesNotMatch(releaseQa, /route: "\/log\?type=incident",/);
  assert.match(releaseQa, /formatMobileReleaseQaPlatformEvidence/);
  assert.match(releaseQa, /formatMobileReleaseQaMissingEvidence/);
  assert.match(
    releaseQa,
    /Platform evidence: \$\{formatMobileReleaseQaPlatformEvidence\(summary\)\}/,
  );
  assert.match(releaseQa, /Evidence gap:/);
  assert.match(releaseQa, /missingScreenshots/);
  assert.match(careTwinReport, /Attached screenshots/);
  assert.match(careTwinReport, /attachedIosScreenshots/);
  assert.match(careTwinReport, /attachedAndroidScreenshots/);
  assert.match(qaRoute, /Launch Workflow QA/);
  assert.match(qaRoute, /Open QA surface/);
  assert.match(qaRoute, /surfaceStatusById/);
  assert.match(qaRoute, /Pass/);
  assert.match(qaRoute, /Needs tune/);
});

test("shows premium entitlement policy before checkout is enabled", () => {
  const premium = readAppFile("premium.tsx");

  assert.match(premium, /preview\.entitlements/);
  assert.match(premium, /Launch entitlements/);
  assert.match(premium, /Current plan: Free/);
  assert.match(premium, /Locked until upgrade/);
  assert.match(premium, /buildPaymentsProviderProofManifest/);
  assert.match(premium, /const paymentsProofManifest = buildPaymentsProviderProofManifest/);
  assert.match(
    premium,
    /buildPaymentsProviderProofManifest\(\s*state\.launchProviderProfile\.paymentsProviderEvidence \?\? undefined,\s*\)/,
  );
  assert.match(premium, /Payments proof manifest/);
  assert.match(premium, /Payments proof/);
  assert.match(premium, /paymentsProofManifest\.rows\.map/);
  assert.match(premium, /paymentsProofManifest\.blockers\.map/);
  assert.match(premium, /Checkout disabled/);
});

test("keeps Expo app identity release-grade", () => {
  const appConfig = JSON.parse(
    readFileSync(
      join(process.cwd(), "artifacts", "woofwatcher-mobile", "app.json"),
      "utf8",
    ),
  );
  const expo = appConfig.expo;

  assert.equal(expo.name, "WoofWatcher");
  assert.equal(expo.slug, "woofwatcher");
  assert.equal(expo.scheme, "woofwatcher");
  assert.equal(expo.userInterfaceStyle, "automatic");
  assert.equal(expo.ios.bundleIdentifier, "com.pegasusdreamscapes.woofwatcher");
  assert.equal(expo.android.package, "com.pegasusdreamscapes.woofwatcher");
  assert.doesNotMatch(JSON.stringify(expo), /replit/i);
});

test("keeps EAS build profiles ready for iOS and Android release paths", () => {
  const easPath = join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "eas.json",
  );

  assert.ok(existsSync(easPath), "mobile EAS config should exist");

  const eas = JSON.parse(readFileSync(easPath, "utf8"));

  assert.equal(eas.cli.appVersionSource, "remote");
  assert.equal(eas.build.development.developmentClient, true);
  assert.equal(eas.build.development.distribution, "internal");
  assert.equal(eas.build.preview.distribution, "internal");
  assert.equal(eas.build.production.autoIncrement, true);
  assert.equal(eas.build.production.android.buildType, "app-bundle");
  assert.ok(eas.submit.production, "production submit profile should exist");
});

test("documents the mobile-first iOS, Android, and web release handoff path", () => {
  const runbookPath = join(
    process.cwd(),
    "docs",
    "release",
    "MOBILE_RELEASE_RUNBOOK.md",
  );

  assert.ok(existsSync(runbookPath), "mobile release runbook should exist");

  const runbook = readFileSync(runbookPath, "utf8");

  assert.match(runbook, /iOS/);
  assert.match(runbook, /Android/);
  assert.match(runbook, /EAS/);
  assert.match(runbook, /TestFlight/);
  assert.match(runbook, /Google Play/);
  assert.match(runbook, /Fable/);
  assert.match(runbook, /web dashboard|PWA/i);
});

test("wires Home to the Phoenix status model", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));

  assert.match(home, /derivePhoenixStatus/);
  assert.match(home, /status\.mood/);
  assert.match(home, /status\.energy/);
  assert.match(home, /status\.counts/);
});

test("wires Home to the living Phoenix room and avatar motion model", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const room = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "LivingPhoenixRoom.tsx",
    ),
    "utf8",
  );
  const lifeEngine = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "avatarLifeEngine.ts",
    ),
    "utf8",
  );
  const spritePlayer = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "SpriteSheetPlayer.tsx",
    ),
    "utf8",
  );
  const choreography = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "careTwinChoreography.ts",
    ),
    "utf8",
  );
  const careTwinAssets = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "careTwinAssets.ts",
    ),
    "utf8",
  );
  const reactionPolicy = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "careTwinReactionPolicy.ts",
    ),
    "utf8",
  );
  const avatarRoomRuntime = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "avatarRoomRuntime.ts",
    ),
    "utf8",
  );

  assert.match(home, /LivingPhoenixRoom/);
  assert.match(home, /avatarConfig=\{avatarConfig\}/);
  assert.match(home, /deriveAvatarMotion/);
  assert.match(home, /avatarMotion\.speech/);
  // Reactions are earned live, never replayed from storage: Home passes its
  // session floor so a reload does not re-play a pre-reload log's reaction.
  assert.match(home, /const reactionSessionFloor = useRef\(now\)/);
  assert.match(home, /reactionsSince: reactionSessionFloor\.current/);
  assert.match(home, /setRoomReaction/);
  assert.match(home, /describeCareTwinReactionForLog/);
  // Quick logs acknowledge through the room's own speech bubble plus one
  // actionable toast above the tab bar; the dark reaction card is reserved
  // for level-ups and room taps so feedback never triple-stacks.
  assert.match(home, /showRoomSpeech\(reactionPlan\.label\)/);
  assert.match(home, /roomSpeechOverride/);
  assert.match(home, /roomTapChoreography/);
  assert.match(home, /tapReaction\.action/);
  assert.match(
    home,
    /deriveCareTwinChoreography\(deriveCareTwinScene\(avatarMotion\)\)/,
  );
  assert.match(home, /avatarMotion\.line/);
  assert.match(home, /\$\{petName\} Room/);
  assert.match(home, /heroStudioButton/);
  assert.match(home, /const openAvatarStudio/);
  assert.match(home, /onPress=\{openAvatarStudio\}/);
  assert.match(home, /onLongPress=\{openAvatarStudio\}/);
  assert.match(home, /Long press to open Avatar Studio/);
  assert.doesNotMatch(home, /avatarIdentityBar/);
  assert.match(room, /roomLiveTitle/);
  assert.match(room, /roomLiveDetail/);
  assert.match(room, /PHOENIX TWIN/);
  assert.match(room, /avatarRoomRuntime\?\.activeSlots\.length/);
  assert.match(room, /liveSubText/);
  assert.match(room, /reactionProgress/);
  assert.match(room, /energyBlocks/);
  assert.match(room, /statusReadouts\?\.slice\(0, 4\)/);
  assert.match(room, /Phoenix room/);
  assert.match(room, /deriveCareTwinScene/);
  assert.match(room, /plan\.tapVerb/);
  assert.match(room, /plan\.recommendedActionLabel/);
  assert.match(room, /plan\.scenePhase/);
  assert.match(room, /SpriteSheetPlayer/);
  assert.match(room, /deriveAvatarRoomRuntime/);
  assert.match(room, /avatarConfig\?: PetAvatarConfig/);
  assert.match(room, /onLongPress\?: \(\) => void/);
  assert.match(room, /accessibilityHint\?: string/);
  assert.match(room, /avatarRoomRuntime\?\.spriteTrack/);
  assert.match(room, /care-twin-template-sprite-player/);
  assert.match(room, /care-twin-avatar-underlay-\$\{layer\.id\}/);
  assert.match(room, /care-twin-avatar-overlay-\$\{layer\.id\}/);
  assert.match(room, /deriveCareTwinChoreography/);
  assert.match(room, /choreography\.ambient/);
  assert.match(room, /choreography\.reactionDurationMs/);
  assert.match(room, /getCareTwinLayerReadiness/);
  assert.match(room, /layeredStageReady/);
  assert.match(room, /care-twin-layered-sprite-rig/);
  assert.match(room, /PHOENIX_FALLBACK_AVATARS/);
  assert.match(room, /useFallbackAvatarLayer/);
  assert.match(room, /care-twin-fallback-avatar-rig/);
  assert.match(room, /roomLayer\?\.source \?\? sceneSource/);
  assert.match(room, /ROOM_ZONES/);
  assert.match(room, /STATE_SCENES/);
  assert.match(room, /sceneMotionStyle/);
  assert.match(room, /dogFocusGlow/);
  assert.match(room, /speechBubble/);
  assert.match(room, /zoneX/);
  assert.match(room, /walkCycle/);
  assert.match(room, /activeZoneStyle/);
  assert.match(room, /actionBurst/);
  assert.match(lifeEngine, /AvatarRoomZone/);
  assert.match(lifeEngine, /deriveAvatarLifePlan/);
  assert.match(lifeEngine, /deriveCareTwinScene/);
  assert.match(lifeEngine, /CARE_TWIN_SPRITE_MANIFEST/);
  assert.match(lifeEngine, /CareTwinSpriteAction/);
  assert.match(lifeEngine, /anchor: "bottom-center"/);
  assert.match(lifeEngine, /slotSize: 256/);
  assert.match(lifeEngine, /spriteAction: "walk-loop"/);
  assert.match(lifeEngine, /spriteAction: "health-watch"/);
  assert.match(lifeEngine, /zone: "bowl"/);
  assert.match(lifeEngine, /animation: "walk"/);
  assert.match(spritePlayer, /export function SpriteSheetPlayer/);
  assert.match(spritePlayer, /frameProgress/);
  assert.match(spritePlayer, /withRepeat/);
  assert.match(spritePlayer, /overflow: "hidden"/);
  assert.match(choreography, /deriveCareTwinChoreography/);
  assert.match(choreography, /scenePhase === "rest"/);
  assert.match(choreography, /return "ear-perk"/);
  assert.match(choreography, /return "comfort-loop"/);
  assert.match(choreography, /return "bark-loop"/);
  assert.match(
    reactionPolicy,
    /export function describeCareTwinReactionForLog/,
  );
  assert.match(
    reactionPolicy,
    /Outcome stays open so the household can update what Phoenix actually ate/,
  );
  assert.match(
    reactionPolicy,
    /Bathroom attempt logged without pretending pee or poop happened/,
  );
  assert.match(
    reactionPolicy,
    /Activity progress updates without spawning a second avatar/,
  );
  assert.match(
    reactionPolicy,
    /Health Watch records the pattern calmly for owner or vet review/,
  );
  assert.match(reactionPolicy, /spriteAction: "health-watch"/);
  assert.doesNotMatch(reactionPolicy, /spawn a second dog/);
  assert.match(avatarRoomRuntime, /deriveAvatarRoomRuntime/);
  assert.match(avatarRoomRuntime, /template-idle-walk-pack/);
  assert.match(avatarRoomRuntime, /phoenix-action-pack/);
  assert.match(avatarRoomRuntime, /deriveAvatarPreviewAccessories/);
  assert.match(avatarRoomRuntime, /getAvatarTemplateAccessorySource/);
  assert.match(avatarRoomRuntime, /underlayLayers/);
  assert.match(avatarRoomRuntime, /overlayLayers/);
  assert.match(careTwinAssets, /CARE_TWIN_SPRITE_ASSETS/);
  assert.match(careTwinAssets, /CARE_TWIN_DOGLESS_ROOM_ASSETS/);
  assert.match(careTwinAssets, /dogless-room-layer/);
  assert.match(careTwinAssets, /listCareTwinSpriteSlots/);
  assert.match(careTwinAssets, /storybook-idle-tail-wag-strip\.png/);
  assert.match(careTwinAssets, /storybook-walk-loop-strip\.png/);
  assert.match(careTwinAssets, /storybook-ear-perk-strip\.png/);
  assert.match(careTwinAssets, /storybook-bark-reaction-strip\.png/);
  assert.match(careTwinAssets, /storybook-eat-loop-strip\.png/);
  assert.match(careTwinAssets, /storybook-drink-loop-strip\.png/);
  assert.match(careTwinAssets, /storybook-sleep-loop-strip\.png/);
  assert.match(careTwinAssets, /storybook-comfort-loop-strip\.png/);
  assert.match(careTwinAssets, /storybook-health-watch-strip\.png/);
  assert.match(careTwinAssets, /storybook-celebrate-hop-strip\.png/);
  assert.doesNotMatch(room, /PhoenixSpriteRig/);
  assert.doesNotMatch(room, /SPRITE LOOP/);
  assert.doesNotMatch(room, /deriveAvatarSpritePlan/);
  assert.doesNotMatch(room, /phoenix\/cutout/);
  assert.doesNotMatch(room, /speechWrap/);
});

test("keeps Home organized around real care-RPG missions, not decorative cards", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const missionDeck = readMobileLibFile("homeMissionDeck.ts");
  const firstScreenLayout = readMobileLibFile("homeFirstScreenLayout.ts");
  const missionLayout = readMobileLibFile("homeMissionLayout.ts");
  const releaseQa = readMobileLibFile("mobileReleaseQa.ts");

  assert.match(home, /buildHomeMissionDeck/);
  assert.match(home, /getHomeFirstScreenLayout/);
  assert.match(home, /homeFirstScreenLayout\.heroAspectRatio/);
  assert.match(home, /homeFirstScreenLayout\.presencePanelMinHeight/);
  assert.match(home, /getHomeMissionDeckLayout/);
  assert.match(home, /useWindowDimensions/);
  assert.match(home, /missionLayout\.qaLabel/);
  assert.match(home, /missionLayout\.detailLines/);
  assert.match(home, /homeMissions/);
  assert.match(home, /Today's Missions/);
  assert.match(home, /Care RPG/);
  assert.match(home, /router\.push\(mission\.route as never\)/);
  assert.match(home, /homeLogEntryRoute/);
  assert.match(home, /nextUpRoute = nextPrimary\?\.route/);
  assert.match(home, /\/log\?entry=/);
  assert.match(home, /\/calendar/);
  assert.match(home, /\/adventure/);
  assert.match(home, /\/health/);

  assert.match(missionDeck, /care-today/);
  assert.match(missionDeck, /\/records/);
  assert.match(missionDeck, /Open loop/);
  assert.match(missionDeck, /Start quest/);
  assert.match(missionDeck, /Care Pass/);
  assert.match(
    missionDeck,
    /No mission in this deck should pretend to be live cloud sync/,
  );
  assert.doesNotMatch(missionDeck, /\|\s*"\/log\?type=meal"/);

  assert.match(firstScreenLayout, /mockup-accurate/);
  assert.match(firstScreenLayout, /firstMissionPeekPx/);
  assert.match(firstScreenLayout, /heroAspectRatio/);
  assert.match(firstScreenLayout, /presencePanelOverlap/);

  assert.match(missionLayout, /compact/);
  assert.match(missionLayout, /estimatedDeckHeight/);
  assert.match(missionLayout, /Small-phone/);

  assert.match(releaseQa, /home-mission-deck/);
  assert.match(releaseQa, /compact Home mission deck/);
  assert.match(releaseQa, /pending meal routes to Meal Log/);
  assert.match(releaseQa, /floating paw nav/);
});

test("keeps Home immediate care actions ahead of the richer mission deck", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));

  const immediateActionIndex = home.indexOf("<View style={s.homeSplit}>");
  const missionDeckIndex = home.search(
    /<BoardCard\s+tone="navy"\s+style=\{\[s\.missionDeck/,
  );

  assert.notEqual(
    immediateActionIndex,
    -1,
    "Home should render the Next Up and Quick Log split",
  );
  assert.notEqual(missionDeckIndex, -1, "Home should render the mission deck");
  assert.ok(
    immediateActionIndex < missionDeckIndex,
    "Next Up and Quick Log should stay above the richer RPG mission deck",
  );
  assert.doesNotMatch(
    home,
    /BoardSectionHeader title="Next Up" action=\{`1 of \$\{nextCount\}`\}/,
  );
  assert.match(
    home,
    /BoardSectionHeader\s+title="Next Up"[\s\S]*accessibilityLabel=\{`Open Plan\. 1 of \$\{nextCount\} next up\.`\}/,
  );
  assert.match(home, /s\.nextPrimaryRow/);
  assert.match(home, /Snooze/);
  assert.match(home, /Reassign/);
  assert.match(home, /Quick Log/);
  assert.match(home, /s\.quickSectionHeader/);
  // Mock-board Quick Log card: four core lanes plus a real More tile that
  // opens the fast-log sheet (Water, Note, and the rest live there).
  assert.match(home, /HOME_QUICK_LOG\.slice\(0,\s*4\)\.map/);
  assert.match(home, /More quick log options/);
  assert.match(home, /router\.push\("\/fastlog" as never\)/);
  assert.match(home, /Today's Missions/);
});

test("keeps Home first-screen status grouped as a care status board", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const careStatusIndex = home.indexOf("<BoardCard style={s.careStatusCard}>");
  const todayCommandIndex = home.indexOf("Today Command");

  assert.notEqual(careStatusIndex, -1, "Home should group status tiles in a board");
  assert.notEqual(todayCommandIndex, -1, "Home should render the Today Command");
  assert.ok(
    todayCommandIndex < careStatusIndex,
    "Today Command should lead into the Care Status board per the storybook mockup",
  );
  assert.match(home, /const careStatusTone = openAloneSession/);
  assert.match(home, /const careStatusLabel = openAloneSession/);
  assert.match(
    home,
    /<BoardCard style=\{s\.careStatusCard\}>[\s\S]*BoardSectionHeader\s+title="Care Status"/,
  );
  assert.match(
    home,
    /<BoardPill label=\{careStatusLabel\} tone=\{careStatusTone\}/,
  );
  // Per the 2026-07 mock boards there is exactly ONE meters surface (Care
  // Sense). Care Status keeps only what that card doesn't show: the Bond
  // meter and the diet-profile door.
  assert.match(home, /label="Bond"/);
  assert.match(home, /title="Diet profile"/);
  assert.doesNotMatch(
    home,
    /label:\s*"Happiness"/,
    "the duplicate Happiness/Energy/Hunger tile grid should stay folded into Care Sense",
  );
});

test("keeps Home room animation alive without duplicate first-screen HUD chrome", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const room = readAppFile(join("..", "components", "LivingPhoenixRoom.tsx"));

  assert.match(home, /<LivingPhoenixRoom[\s\S]*chromeDensity="compact"/);
  assert.match(room, /chromeDensity\?: "full" \| "compact"/);
  assert.match(room, /const compactChrome = chromeDensity === "compact"/);
  assert.match(
    room,
    /\{!isStudio && !compactChrome \? \([\s\S]*styles\.roomStatsPanel/,
  );
  assert.match(
    room,
    /\{!isStudio && !compactChrome \? \([\s\S]*styles\.statusPatch/,
  );
  assert.match(
    room,
    /\{!isStudio && !compactChrome \? \([\s\S]*styles\.roomDock/,
  );
  assert.match(
    room,
    /\{!isStudio && !compactChrome \? \([\s\S]*styles\.nextChip/,
  );
  assert.match(room, /function getCompactSpriteZone/);
  assert.match(room, /left: "42%"/);
  assert.match(room, /top: "28%"/);
  assert.match(room, /width: 150/);
  assert.match(room, /height: 150/);
  assert.match(
    room,
    /const stageSpriteAction: CareTwinSpriteAction =\s*compactChrome && !transparentScene \? "tail-wag" : activeSpriteAction/,
  );
  assert.match(room, /function getImmersiveSpriteZone/);
  assert.match(
    room,
    /const activeSpriteZone = transparentScene[\s\S]*\?\s*getImmersiveSpriteZone\(spriteZone\)[\s\S]*compactChrome[\s\S]*\?\s*getCompactSpriteZone\(spriteZone\)[\s\S]*:\s*spriteZone/,
  );
  assert.match(room, /left: activeSpriteZone\.left/);
  assert.match(room, /width: activeSpriteZone\.width/);
  assert.match(
    room,
    /const shouldUseAvatarRuntime =\s*Boolean\(avatarConfig\) && \(!compactChrome \|\| transparentScene\)/,
  );
  assert.match(
    room,
    /shouldUseAvatarRuntime && avatarConfig[\s\S]*\?\s*deriveAvatarRoomRuntime/,
  );
  assert.match(
    room,
    /const layeredStageReady =\s*\(!compactChrome \|\| transparentScene\) &&[\s\S]*layerReadiness\.roomReady/,
  );
  assert.match(
    room,
    /const useFallbackAvatarLayer = roomStageReady && !layeredStageReady/,
  );
  // The immersive roam contract: the twin walks the floor band between
  // waypoints, mirrors for rightward travel, and pauses for reactions.
  assert.match(room, /deriveCareTwinRoamPlan/);
  assert.match(room, /function RoamingTwinRig/);
  assert.match(room, /testID="care-twin-roaming-rig"/);
  assert.match(room, /testID="care-twin-roaming-sprite-player"/);
  assert.match(room, /roamFlipMirrored/);
  assert.match(room, /overrideAction \?\? \(moving \? "walk-loop" : dwellAction\)/);
  // One-way care-event lifecycle: a fresh care log plays its event loop for
  // one short window and settles to the idle track (no eat/idle flip-flop),
  // and it never replays from a scene derived out of stored history.
  assert.match(room, /const CARE_EVENT_WINDOW_MS = 8000/);
  assert.match(room, /function settledCareEventPlan/);
  assert.match(room, /const careEventSignatureRef = useRef\(careEventSignature\)/);
  assert.match(room, /if \(careEventActive\) return;/);
  // Stage-rig pose swaps ride the same settle trough as the roaming rig:
  // dip out, swap at the bottom, ease back — never a single-frame hard cut.
  assert.match(room, /const POSE_SETTLE_OUT_MS = 70/);
  assert.match(room, /const POSE_SETTLE_IN_MS = 110/);
  assert.match(room, /displayedStagePose/);
  assert.match(room, /styles\.poseSettleFade, stagePoseFadeStyle/);
  assert.match(
    room,
    /plan\.scenePhase === "idle" \|\| plan\.scenePhase === "routine"/,
  );
  assert.match(room, /testID="care-twin-fallback-avatar-rig"/);
  assert.match(room, /compactChrome \? styles\.speechBubbleCompact : null/);
  assert.match(room, /compactChrome \? styles\.speechTextCompact : null/);
});

test("keeps Home Quick Log header action as a real route target", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const homeMissionDeck = readMobileLibFile("homeMissionDeck.ts");
  const primitives = readAppFile(
    join("..", "components", "board", "BoardPrimitives.tsx"),
  );

  assert.match(
    home,
    /Quick Log[\s\S]*accessibilityLabel="Open full Quick Log"[\s\S]*onPress=\{\(\) => router\.push\("\/log"\)\}/,
  );
  assert.match(home, /s\.quickSectionTitle/);
  assert.match(home, /s\.homeQuickCircle/);
  assert.match(primitives, /onLongPress\?: \(\) => void/);
  assert.match(
    primitives,
    /delayLongPress=\{onLongPress \? \(delayLongPress \?\? 350\) : undefined\}/,
  );
  assert.match(home, /const openQuickDetails = \(item: QuickItem\) =>/);
  assert.match(
    home,
    /router\.push\(\s*`\/log\?type=\$\{item\.type\}&detail=1&intent=\$\{Date\.now\(\)\}` as never,?\s*\)/,
  );
  assert.match(home, /onLongPress=\{\(\) => openQuickDetails\(item\)\}/);
  assert.match(
    home,
    /accessibilityHint=\{\s*item\.forceDetail\s*\?\s*"Opens details before saving\."\s*:\s*"Long press opens details before saving\."\s*\}/,
  );
  assert.match(
    log,
    /useLocalSearchParams<\{\s*type\?: string \| string\[\];\s*detail\?: string \| string\[\];\s*intent\?: string \| string\[\];\s*entry\?: string \| string\[\];\s*walk\?: string \| string\[\];\s*\}>/,
  );
  assert.match(log, /const routeWantsDetailSheet =/);
  assert.match(log, /const routeDetailIntentKey =/);
  assert.match(log, /findLauncherActionForType\(routeSelectedType\)/);
  // Detail-intent routes land directly in the pre-focused composer instead of
  // auto-opening the policy explainer sheet.
  assert.match(log, /setTimeout\(\(\) => scrollToComposer\(\), 350\)/);
  assert.doesNotMatch(log, /setLauncherDetailAction\(routeDetailAction\)/);
  assert.match(log, /const routeEntryParam =/);
  assert.match(log, /setDetailEntryId\(routeEntryParam\)/);
  assert.match(homeMissionDeck, /`\/log\?entry=\$\{string\}`/);
  assert.match(home, /type HomeNextUpRoute =/);
  assert.match(home, /function homeLogEntryRoute\(entryId: string\)/);
  assert.match(
    home,
    /function homeLogDetailRoute\(\s*type: CareEventType,\s*intent: number,\s*\)/,
  );
  assert.match(
    home,
    /route:\s*openWalkSession\.id\s*\?\s*homeLogEntryRoute\(openWalkSession\.id\)\s*:\s*homeLogDetailRoute\("walk", now\)/,
  );
  assert.match(
    home,
    /route:\s*openAloneSession\.id\s*\?\s*homeLogEntryRoute\(openAloneSession\.id\)\s*:\s*homeLogDetailRoute\("alone", now\)/,
  );
  assert.match(
    home,
    /route:\s*pendingMeal\.id\s*\?\s*homeLogEntryRoute\(pendingMeal\.id\)\s*:\s*homeLogDetailRoute\("meal", now\)/,
  );
  assert.match(home, /const openActiveWalkFromHomeQuickLog = \(\) =>/);
  assert.match(
    home,
    /const activeWalkRoute = openWalkSession\.id\s*\?\s*homeLogEntryRoute\(openWalkSession\.id\)\s*:\s*homeLogDetailRoute\("walk", Date\.now\(\)\)/,
  );
  assert.match(home, /router\.push\(activeWalkRoute as never\)/);
  assert.match(home, /openActiveWalkFromHomeQuickLog\(\)/);
  assert.match(home, /route: homeLogDetailRoute\("walk", now\)/);
  assert.match(
    home,
    /const nextUpRoute =\s*nextPrimary\?\.route \?\? "\/calendar"/,
  );
  assert.match(home, /route: nextUpRoute/);
  assert.match(home, /router\.push\(nextPrimary\.route as never\)/);
  assert.match(
    home,
    /if \(policy\.tapBehavior === "detail-required"\) \{\s*router\.push\(homeLogDetailRoute\(policy\.type, Date\.now\(\)\) as never\);\s*return;\s*\}/,
  );
  assert.doesNotMatch(
    home,
    /router\.push\(`\/log\?type=\$\{item\.type\}` as never\)/,
  );
  assert.match(home, /const \[quickFeedback, setQuickFeedback\]/);
  assert.match(home, /deleteEntry\(quickFeedback\.id\)/);
  assert.match(home, /const entryId = quickFeedback\.id/);
  assert.match(home, /router\.push\(`\/log\?entry=\$\{entryId\}` as never\)/);
  assert.match(home, /Undo/);
  assert.match(home, /Add details/);
  assert.doesNotMatch(
    home,
    /showToast\("Walk already active"\);\s*router\.push\("\/log\?type=walk" as never\)/,
  );
  assertStyleUsesSharedTouchTarget(home, "quickHeaderAction");
});

test("keeps Home owner-preview section actions as real route targets", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const more = readAppFile(join("(tabs)", "more.tsx"));

  assert.match(
    home,
    /BoardSectionHeader\s+title="Recent activity"\s+accessory=\{\s*<HomeHeaderAction/,
  );
  assert.match(home, /accessibilityLabel="View all recent care activity"/);
  assert.match(home, /route="\/log"/);
  assert.match(home, /id: entry\.id/);
  assert.match(home, /key=\{entry\.id\}/);
  assert.match(
    home,
    /accessibilityLabel=\{`Open recent care log: \$\{entry\.title\}`\}/,
  );
  assert.match(
    home,
    /router\.push\(\s*`\/log\?entry=\$\{encodeURIComponent\(entry\.id\)\}` as never,?\s*\)/,
  );
  // Home header + Care Sense route to the standalone board screens from
  // Apollo's mockups: the dog identity chip opens the Profile, the bell opens
  // Reminders, and Care Sense links to Trends. Every target is a real route.
  assert.match(
    home,
    /accessibilityLabel=\{`\$\{petName\}\. \$\{careStatusLabel\}\. Open profile`\}[\s\S]*router\.push\("\/profile" as never\)/,
  );
  assert.match(
    home,
    /accessibilityLabel="Open reminders"[\s\S]*router\.push\("\/reminders" as never\)/,
  );
  assert.match(
    home,
    /accessibilityLabel="Open Trends and Insights"[\s\S]*router\.push\("\/trends" as never\)/,
  );
  assert.match(
    home,
    /type StatusTileTarget = "mood" \| "health" \| "diet" \| "bond"/,
  );
  assert.match(home, /const openStatusTile = \(target: StatusTileTarget\) =>/);
  assert.match(
    home,
    /router\.push\(\s*`\/log\?type=mood&detail=1&intent=\$\{Date\.now\(\)\}` as never,?\s*\)/,
  );
  assert.match(home, /router\.push\("\/health\?tab=health" as never\)/);
  assert.match(home, /router\.push\("\/more\?section=diet" as never\)/);
  assert.match(
    home,
    /router\.push\(\s*`\/log\?type=play&detail=1&intent=\$\{Date\.now\(\)\}` as never,?\s*\)/,
  );
  // Care Status is now the slim mock-board card: Bond meter + diet door,
  // both still wired through openStatusTile's real route targets.
  assert.match(home, /onPress=\{\(\) => openStatusTile\("bond"\)\}/);
  assert.match(home, /onPress=\{\(\) => openStatusTile\("diet"\)\}/);
  assert.match(
    more,
    /useLocalSearchParams<\{\s*section\?: string \| string\[\];\s*\}>/,
  );
  assert.match(
    more,
    /const sectionParam = Array\.isArray\(routeParams\.section\) \? routeParams\.section\[0\] : routeParams\.section/,
  );
  assert.match(more, /if \(sectionParam === "diet"\) setDietOpen\(true\)/);
  assert.match(more, /const householdFocus = sectionParam === "household"/);
  assert.match(more, /title="Household focus"/);
  assert.match(more, /Presence route/);
  assertStyleUsesSharedTouchTarget(home, "homeHeaderAction");
});

test("keeps Phoenix Home owner-preview actions on shared mobile touch targets", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));

  for (const styleName of [
    "headerButton",
    "heroStudioButton",
    "presencePanel",
    "adventureInline",
    "todayMetric",
  ]) {
    assertStyleUsesSharedTouchTarget(home, styleName);
  }
});

test("keeps Home presence panel routed to exact household care state", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));

  assert.match(
    home,
    /type HomePresenceRoute =[\s\S]*`\/log\?entry=\$\{string\}`[\s\S]*`\/log\?type=\$\{string\}&detail=1&intent=\$\{number\}`/,
  );
  assert.match(
    home,
    /const presenceRoute: HomePresenceRoute = openAloneSession/,
  );
  assert.match(
    home,
    /openAloneSession\.id\s*\?\s*homeLogEntryRoute\(openAloneSession\.id\)\s*:\s*homeLogDetailRoute\("alone", now\)/,
  );
  assert.match(
    home,
    /openWalkSession\.id\s*\?\s*homeLogEntryRoute\(openWalkSession\.id\)\s*:\s*homeLogDetailRoute\("walk", now\)/,
  );
  // The calm-state presence card opens the Alone Time flow (a real presence
  // control) instead of dropping the owner in More with nothing to act on.
  assert.match(home, /: homeLogDetailRoute\("alone", now\);/);
  assert.doesNotMatch(home, /"\/more\?section=household"/);
  assert.match(home, /const openPresencePanel = \(\) =>/);
  assert.match(home, /router\.push\(presenceRoute as never\)/);
  assert.match(home, /accessibilityHint=\{presenceActionHint\}/);
  assert.match(home, /onPress=\{openPresencePanel\}/);
  assert.doesNotMatch(
    home,
    /router\.push\(openAloneSession \? "\/log\?type=alone" : openWalkSession \? "\/log\?type=walk" : "\/more"\)/,
  );
});

test("keeps Home today summary metrics route-backed instead of decorative", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));

  assert.match(
    home,
    /type TodayMetricTarget = "activity" \| "meals" \| "potty";/,
  );
  assert.match(
    home,
    /const openTodayMetric = \(target: TodayMetricTarget\) =>/,
  );
  assert.match(
    home,
    /router\.push\(\s*`\/log\?type=\$\{todayMetricRouteType\[target\]\}&detail=1&intent=\$\{Date\.now\(\)\}` as never,?\s*\)/,
  );
  assert.match(home, /accessibilityLabel="Open today activity logs"/);
  assert.match(home, /onPress=\{\(\) => openTodayMetric\("activity"\)\}/);
  assert.match(home, /accessibilityLabel="Open today meal logs"/);
  assert.match(home, /onPress=\{\(\) => openTodayMetric\("meals"\)\}/);
  assert.match(home, /accessibilityLabel="Open today potty logs"/);
  assert.match(home, /onPress=\{\(\) => openTodayMetric\("potty"\)\}/);
});

// The bottom "Phoenix status" meters card was removed as a duplicate of the
// Care Status tiles, so its route-backed-meters test was retired alongside it.

test("keeps Home watch cards deep-linked to exact care workflows", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const health = readAppFile(join("(tabs)", "health.tsx"));

  assert.match(home, /type HomeWatchTarget = "health" \| "bile" \| "alone";/);
  assert.match(
    home,
    /const openHomeWatchCard = \(target: HomeWatchTarget\) =>/,
  );
  assert.match(home, /router\.push\("\/health\?tab=bile" as never\)/);
  assert.match(
    home,
    /router\.push\(\s*`\/log\?type=alone&detail=1&intent=\$\{Date\.now\(\)\}` as never,?\s*\)/,
  );
  assert.match(home, /hitSlop=\{MOBILE_INLINE_HIT_SLOP\}/);
  assert.match(home, /accessibilityHint=\{w\.hint\}/);
  assert.match(home, /onPress=\{\(\) => openHomeWatchCard\(w\.target\)\}/);
  assert.match(home, /target: "bile" as HomeWatchTarget/);
  assert.match(home, /target: "alone" as HomeWatchTarget/);
  assert.match(
    health,
    /useLocalSearchParams<\{\s*tab\?: string \| string\[\];?\s*\}>/,
  );
  assert.match(
    health,
    /const requestedTab: HealthTab = tabParam === "bile" \? "bile" : "health";/,
  );
  assert.match(health, /useEffect\(\(\) => \{\s*setActiveTab\(requestedTab\);/);
});

test("keeps Home mission health rows tab-specific", () => {
  const homeMissionDeck = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "homeMissionDeck.ts",
    ),
    "utf8",
  );

  assert.match(homeMissionDeck, /"\/health\?tab=bile"/);
  assert.match(homeMissionDeck, /"\/health\?tab=health"/);
  assert.match(
    homeMissionDeck,
    /route: input\.health\.needsReview \? "\/health\?tab=bile" : "\/health\?tab=health"/,
  );
});

test("keeps care intelligence wired across Home, Log, More, and the shared domain layer", () => {
  const domain = readFileSync(
    join(process.cwd(), "lib", "care-domain", "src", "care-intelligence.ts"),
    "utf8",
  );
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const more = readAppFile(join("(tabs)", "more.tsx"));

  assert.match(domain, /deriveCareIntelligence/);
  assert.match(domain, /confidenceScore/);
  assert.match(domain, /pendingOutcomeCount/);
  assert.match(domain, /routineProgress/);
  assert.match(home, /deriveCareIntelligence/);
  assert.match(home, /careIntelligence\.score/);
  assert.match(home, /Care IQ/);
  // Zero-log honesty, in lockstep with the domain: an empty day derives a
  // real 0 (never sync filler) and Home frames it as "--" with the
  // first-log promise instead of a fabricated percentage.
  assert.match(domain, /visibleToday\.length === 0 \? 0 :/);
  assert.match(home, /careIntelligence\.visibleLogCount === 0\s*\?\s*"-- Care IQ"/);
  assert.match(home, /Starts with your first log/);
  assert.match(log, /deriveCareIntelligence/);
  assert.match(log, /Care IQ/);
  assert.match(log, /careIntelligence\.status/);
  // /log tells the same zero-state story as Home: the console HUD and the
  // composer trust rail both read "--" with the first-log promise instead of
  // a fabricated "0%". (Care IQ lives once, in the console HUD - the support
  // rail no longer repeats it, so the zero-state is pinned via the HUD value
  // and the composer rail's "-- Care IQ".)
  assert.match(
    log,
    /careIntelligence\.visibleLogCount === 0 \? "--" : `\$\{careIntelligence\.score\}%`/,
  );
  assert.match(log, /"-- Care IQ"/);
  assert.match(more, /deriveCareIntelligence/);
  assert.match(more, /Care Intelligence/);
  assert.match(more, /careIntelligence\.metrics/);
  assert.match(more, /careIntelligence\.nextAction/);
  assert.match(domain, /targetEntryId\?: string/);
  assert.match(domain, /targetRoutineId\?: string/);
  assert.match(more, /const openCareIntelligenceNextAction = \(\) =>/);
  assert.match(more, /careIntelligence\.nextAction\.targetEntryId/);
  assert.match(
    more,
    /router\.push\(\s*`\/log\?entry=\$\{encodeURIComponent\(careIntelligence\.nextAction\.targetEntryId\)\}` as never,?\s*\)/,
  );
  assert.match(more, /onPress=\{openCareIntelligenceNextAction\}/);
  assert.match(home, /const openHomeCareIntelligenceNextAction = \(\) =>/);
  assert.match(home, /careIntelligence\.nextAction\.targetEntryId/);
  assert.match(
    home,
    /router\.push\(\s*`\/log\?entry=\$\{encodeURIComponent\(careIntelligence\.nextAction\.targetEntryId\)\}` as never,?\s*\)/,
  );
  assert.match(
    home,
    /accessibilityLabel=\{`Home Care Intelligence next action: \$\{careIntelligence\.nextAction\.label\}`\}/,
  );
  assert.match(home, /onPress=\{openHomeCareIntelligenceNextAction\}/);
  assertStyleUsesSharedTouchTarget(home, "questNextAction");
});

test("keeps Health Watch and the Quick Care Console honest at zero data and at night", () => {
  const health = readAppFile(join("(tabs)", "health.tsx"));
  const log = readAppFile(join("(tabs)", "log.tsx"));

  // A fresh profile must never read "94 / Stable right now / You're on a
  // roll": with no entries in the scoring window the score is "--" and the
  // copy makes the first-log promise (non-diagnostic, no fabricated result).
  assert.match(health, /const hasHealthSignalData = state\.entries\.some/);
  assert.match(health, /const scoreDisplay = hasHealthSignalData \? String\(score\) : "--";/);
  assert.match(health, /\{scoreDisplay\}/);
  assert.match(health, /Health Watch starts with your first log\./);
  // The signal rows ("Active daily", "Eating well") are observations, so
  // they also fall back to the first-log promise before any log exists.
  assert.match(health, /displayHealthRows\.slice\(0, 4\)/);

  // The decorative "Under 5 sec" speed pill is removed at every width, not
  // just under 360px.
  assert.doesNotMatch(log, /Under 5 sec/);

  // The Quick Care Console day banner follows Home's clock rule (dark theme
  // or lamplit hours) with a navy tint instead of staying frozen in daylight.
  assert.match(log, /const logCommandStageIsNight =/);
  assert.match(log, /homeImmersiveRoomIsNight\(new Date\(now\)\.getHours\(\)\)/);
  assert.match(log, /logCommandStageIsNight \? \{ backgroundColor: "rgba\(9,17,32,0\.35\)" \} : null/);
});

test("web notices and confirms use the themed dialog host, not raw window.alert chrome", () => {
  const dialogLib = readMobileLibFile("confirmDialog.ts");
  const host = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "components", "WebDialogHost.tsx"),
    "utf8",
  );
  const layout = readAppFile("_layout.tsx");

  // notifyDialog and confirmThroughSteps route web requests through the
  // registered host; window.alert/confirm survive only as a no-host fallback
  // so nothing silently no-ops in tests or very early calls.
  assert.match(dialogLib, /registerWebDialogPresenter/);
  assert.match(dialogLib, /if \(webDialogPresenter\)/);
  assert.match(dialogLib, /cancelLabel: null/);
  assert.match(dialogLib, /onConfirm: \(\) => confirmThroughSteps\(rest, onConfirmed\)/);

  // The host is themed (board card + palette tokens), accessible, and queued
  // so chained confirm steps are never lost.
  assert.match(host, /registerWebDialogPresenter\(/);
  assert.match(host, /useColors\(\)/);
  assert.match(host, /accessibilityRole="alert"/);
  assert.match(host, /setQueue\(\(current\) => \[\.\.\.current, request\]\)/);
  assert.match(host, /current\.cancelLabel != null/);

  // Mounted once inside the web frame so dialogs overlay the app shell.
  assert.match(layout, /<WebDialogHost \/>/);
});

test("renders Today Command on Home as a real care workflow control", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));

  assert.match(home, /deriveTodayCommand/);
  assert.match(home, /const todayCommand = useMemo/);
  assert.match(home, /Today Command/);
  assert.match(
    home,
    /accessibilityLabel=\{`Today Command\. \$\{petName\} is \$\{homeMoodWord\}\. \$\{glanceLine\}`\}/,
  );
  assert.match(
    home,
    /accessibilityHint="Opens the exact care workflow behind today's recommended action\."/,
  );
  assert.match(
    home,
    /router\.push\(todayCommand\.primaryAction\.route as never\)/,
  );
  // The heart line must tell the same story as the room animation: when the
  // motion scheduler has the twin asleep or winding down, the upbeat mood
  // words defer to a rest word instead of "excited" over a sleeping dog.
  assert.match(home, /const homeMoodWord =/);
  assert.match(home, /avatarMotion\.state === "sleeping"[\s\S]*?"snoozing"/);
  assert.match(home, /avatarMotion\.state === "tired"[\s\S]*?"resting"/);
  assert.match(home, /HOME_MOOD_WORD\[status\.mood\]/);
  assert.match(home, /const glanceLine = useMemo/);
  // The Today Command surface now lives as the Care Sense headline row, per
  // the 2026-07 mock boards: four honest pip meters under one glance line.
  assertStyleUsesSharedTouchTarget(home, "careSenseHeadlineRow");
  assert.match(home, /Care Sense/);
  assert.match(home, /careSenseHeadline/);
  for (const meter of ["meterMood", "meterEnergy", "meterHunger", "meterAlone"]) {
    assert.match(
      home,
      new RegExp(`colors\\.${meter}`),
      `Care Sense should tone the ${meter} meter from the shared palette`,
    );
  }
  // Meters stay honest: mood maps the derived word, hunger reads real meal
  // counts, alone time only fills while an away session is actually open.
  assert.match(home, /careSenseMoodRatio/);
  assert.match(home, /status\.counts\.meals\.done/);
  assert.match(home, /openAloneSession\s*\?\s*Math\.min\(1, openAloneMinutes \/ 240\)\s*:\s*0/);
});

test("keeps Health tab wired to non-diagnostic Health Watch and Bile Watch", () => {
  const health = readAppFile(join("(tabs)", "health.tsx"));

  for (const styleName of [
    "tabPill",
    "heroActionPrimary",
    "heroActionSecondary",
    "reviewPacketShare",
    "healthHeaderAction",
    "healthSignalRow",
  ]) {
    assertStyleUsesSharedTouchTarget(health, styleName);
  }

  assert.match(health, /deriveHealthWatch/);
  assert.match(health, /deriveHealthReviewPacket/);
  assert.match(health, /Health Watch/);
  assert.match(health, /Bile Watch/);
  assert.match(health, /Health score/);
  assert.match(health, /Health Snapshot/);
  assert.match(health, /Pattern Board/);
  assert.match(health, /Review packet/);
  assert.match(health, /Owner notes\. No diagnosis\./);
  assert.match(health, /healthReviewPacket\.languagePill/);
  assert.match(health, /healthReviewPacket\.prompts/);
  assert.match(health, /healthReviewPacket\.vetShareChecklist/);
  assert.match(health, /healthReviewPacket\.boundary/);
  assert.match(health, /buildHealthReviewPacketShareText/);
  assert.match(health, /Share health review/);
  assert.match(
    health,
    /shareTextPayload\(\{[\s\S]*message:\s*buildHealthReviewPacketShareText\(healthReviewPacket/,
  );
  assert.match(health, /action\.route\.startsWith\("\/log\?"\)/);
  assert.match(health, /router\.push\(action\.route as never\)/);
  assert.doesNotMatch(
    health,
    /router\.push\(\{ pathname: "\/log", params: action\.params \?\? \{\} \}\)/,
  );
  assert.match(health, /Draft vet questions/);
  assert.match(health, /CARE STATUS/);
  assert.match(health, /ImageBackground/);
  assert.match(health, /HEALTH_WATCH_STAGE_ROOM/);
  assert.match(health, /CARE_TWIN_ROOM_VARIANT_ASSETS\.healthWatch/);
  assert.match(health, /SpriteSheetPlayer/);
  assert.match(health, /getCareTwinSpriteAsset\("health-watch"\)/);
  assert.match(health, /CARE_TWIN_SPRITE_MANIFEST\["health-watch"\]/);
  assert.match(health, /pixelImageStyle/);
  assert.match(health, /healthHeroPanel/);
  assert.match(health, /healthScoreToken/);
  assert.match(health, /healthSignalCopy/);
  assert.match(health, /healthSignalTitleLine/);
  assert.match(health, /healthSignalList/);
  assert.match(health, /statusScoreTrack/);
  assert.match(health, /healthRhythmBars/);
  assert.match(health, /healthActionRow/);
  assert.match(health, /Log health note/);
  assert.match(health, /7-day bile log/);
  assert.match(health, /function HealthHeaderAction/);
  assert.match(health, /hitSlop=\{MOBILE_INLINE_HIT_SLOP\}/);
  assert.match(health, /accessibilityLabel="Show Health 7-day rhythm"/);
  assert.match(
    health,
    /scrollRef\.current\?\.scrollTo\(\{ y: 0, animated: true \}\)/,
  );
  assert.match(health, /accessibilityLabel="Open health owner notes"/);
  assert.match(health, /openHealthStatusRoute/);
  assert.match(health, /statusActionLabel/);
  assert.match(health, /healthSignalActionPill/);
  assert.doesNotMatch(health, /heroSignalRail/);
  assert.doesNotMatch(health, /healthCommandDeck/);
  assert.doesNotMatch(health, /healthCommandActions/);
  assert.doesNotMatch(health, /metricGridTop/);
  assert.doesNotMatch(health, /StatusMeter/);
  assert.match(
    health,
    /router\.push\(`\/log\?type=\$\{type\}&detail=1&intent=\$\{Date\.now\(\)\}` as never\)/,
  );
  assert.match(
    health,
    /accessibilityLabel=\{`\$\{row\.label\}\. \$\{row\.status\}\. \$\{row\.detail\}\. \$\{row\.actionLabel\}`\}/,
  );
  assert.match(health, /aria-selected=\{active\}/);
  assert.match(health, /Not veterinary advice/);
});

test("keeps Health Watch as one flagship pixel room with one status panel", () => {
  const health = readAppFile(join("(tabs)", "health.tsx"));
  const stageIndex = health.indexOf("<BoardCard style={s.heroCard}>");
  const reviewIndex = health.indexOf("<BoardCard style={s.sectionCard}>");

  assert.notEqual(stageIndex, -1, "Health pixel room should be the flagship first card");
  assert.notEqual(reviewIndex, -1, "Health review packet should stay below the flagship room");
  assert.ok(
    stageIndex < reviewIndex,
    "Health pixel room should come before lower review cards",
  );
  assert.doesNotMatch(
    health,
    /primaryHealthCard|healthScoreTokenCompact|statusScoreTrackCompact|healthStageHud|heroSignalRail|healthCommandDeck/,
    "Health Watch should not keep duplicate compact snapshot, stage HUD, signal rail, or detached command deck layers",
  );
  assert.match(health, /Health Snapshot/);
  assert.match(health, /healthStatusTitle/);
  assert.match(health, /healthHeroPanel/);
  // Health Watch stage uses "cover": the backing art is a purpose-composed
  // wide band, so cover keeps it undistorted at any card size (no squash).
  assert.match(health, /resizeMode="cover"[\s\S]*style=\{s\.healthStage\}/);
  assert.match(health, /width=\{104\}/);
  assert.match(health, /height=\{104\}/);
  assert.match(
    getStyleBlock(health, "healthStage"),
    /minHeight:\s*16[0-9]/,
    "Health pixel room should stay expressive but leave first-screen space for useful health rows",
  );
});

test("locks the mobile pixel UI foundation to Apollo's reference boards", () => {
  const colors = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "constants",
      "colors.ts",
    ),
    "utf8",
  );
  const primitivesPath = join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "components",
    "board",
    "BoardPrimitives.tsx",
  );
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const tabs = readAppFile(join("(tabs)", "_layout.tsx"));

  assert.match(colors, /#081424/);
  assert.match(colors, /#0D182A/);
  // 2026-07 storybook boards: lighter parchment surfaces, deeper forest
  // primary, and the Care Sense meter tones sampled straight from the art.
  assert.match(colors, /#F7F1E1/);
  assert.match(colors, /#FDF9EE/);
  assert.match(colors, /#33582F/);
  assert.match(colors, /meterHunger/);
  assert.match(colors, /meterAlone/);
  assert.match(colors, /#A8CBE8/);
  assert.match(colors, /pixelUi/);
  assert.ok(existsSync(primitivesPath), "board primitives should exist");

  const primitives = readFileSync(primitivesPath, "utf8");
  assert.match(primitives, /borderBottomWidth:\s*2/);
  assert.match(primitives, /numberOfLines=\{1\}/);
  assert.match(primitives, /minHeight:\s*28/);
  assert.match(primitives, /borderBottomColor:\s*colors\.border/);
  assert.doesNotMatch(primitives, /sectionTitle:\s*\{[\s\S]*letterSpacing:\s*0\.6/);
  for (const exportedName of [
    "BoardCard",
    "BoardSectionHeader",
    "StatusMeter",
    "QuickActionTile",
    "PixelSpeechBubble",
    "CareRow",
  ]) {
    assert.match(primitives, new RegExp(`export function ${exportedName}`));
  }

  assert.match(home, /BoardCard/);
  assert.match(home, /StatusMeter/);
  assert.match(home, /QuickActionTile/);
  assert.match(home, /LivingPhoenixRoom/);
  assert.match(tabs, /colors\.brandNavy/);
  // Mock boards show plain icons+labels in the floating bar - the active
  // state is the forest tint alone, no pill wash behind the item.
  assert.doesNotMatch(tabs, /tabBarActiveBackgroundColor/);
  assert.match(tabs, /tabBarActiveTintColor:\s*colors\.forest/);
  // The paw FAB pops with the shared game-feel bounce on every press.
  assert.match(tabs, /useBounce/);
});

test("extends the mobile pixel board system across core v1.5 routes", () => {
  const primitives = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "components",
      "board",
      "BoardPrimitives.tsx",
    ),
    "utf8",
  );
  const coreRoutes: Record<string, string> = {
    log: readAppFile(join("(tabs)", "log.tsx")),
    plans: readAppFile(join("(tabs)", "calendar.tsx")),
    health: readAppFile(join("(tabs)", "health.tsx")),
    more: readAppFile(join("(tabs)", "more.tsx")),
    records: readAppFile(join("(tabs)", "records.tsx")),
    woofguide: readAppFile("woofguide.tsx"),
    avatarStudio: readAppFile("portrait.tsx"),
  };

  for (const exportedName of [
    "BoardRouteHeader",
    "BoardPill",
    "BoardMetricTile",
  ]) {
    assert.match(primitives, new RegExp(`export function ${exportedName}`));
  }
  assert.match(
    primitives,
    /centered && styles\.routeSubtitleCentered/,
    "centered board route headers should center subtitles with their titles",
  );
  assert.match(
    getStyleBlock(primitives, "routeSubtitleCentered"),
    /textAlign:\s*"center"/,
    "centered board route subtitles should not drift left on compact route tops",
  );

  for (const [route, source] of Object.entries(coreRoutes)) {
    assert.match(
      source,
      /@\/components\/board\/BoardPrimitives/,
      `${route} should import board primitives`,
    );
    if (route === "woofguide") {
      assert.match(
        source,
        /guideIntroRow/,
        "woofguide should keep its compact owner-reviewed intro row instead of a hero-scale route header",
      );
    } else {
      assert.match(
        source,
        /BoardRouteHeader/,
        `${route} should use the shared route header`,
      );
    }
    assert.match(
      source,
      /BoardCard|BoardSectionHeader|CareRow|StatusMeter|BoardMetricTile/,
      `${route} should use a board primitive beyond route chrome`,
    );
  }
});

test("keeps Quick Log, Plans, and Records on shared board card anatomy", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const plans = readAppFile(join("(tabs)", "calendar.tsx"));
  const records = readAppFile(join("(tabs)", "records.tsx"));

  for (const [route, source] of Object.entries({ log, plans, records })) {
    assert.match(
      source,
      /BoardCard/,
      `${route} should use shared BoardCard sections`,
    );
  }

  assert.match(
    plans,
    /import \{ BoardCard, BoardPill, BoardRouteHeader, BoardSectionHeader \}/,
  );
  assert.doesNotMatch(plans, /<BoardSectionHeader[\s\S]*?\saction=/);
  assert.match(log, /<BoardCard[\s\S]*style=\{s\.composerHero/);
  assert.match(
    log,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Choose care type"/,
  );
  assert.match(
    plans,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Upcoming Events"/,
  );
  assert.match(
    plans,
    /BoardSectionHeader\s+title="Upcoming Events"[\s\S]*<BoardPill\s+label=\{upcoming\.length \? `\$\{upcoming\.length\} days` : "Add one"\}/,
  );
  assert.match(records, /<BoardCard[\s\S]*WOOFWATCHER DOG ID/);
});

test("keeps web route previews visible before native entry animation starts", () => {
  const routeSources: Record<string, string> = {
    home: readAppFile(join("(tabs)", "index.tsx")),
    log: readAppFile(join("(tabs)", "log.tsx")),
    plans: readAppFile(join("(tabs)", "calendar.tsx")),
    records: readAppFile(join("(tabs)", "records.tsx")),
    more: readAppFile(join("(tabs)", "more.tsx")),
    premium: readAppFile("premium.tsx"),
  };

  for (const [route, source] of Object.entries(routeSources)) {
    assert.match(
      source,
      /const isWebRoutePreview = \(Platform\.OS as string\) === "web"/,
      `${route} should define a typed web-preview guard`,
    );
    assert.match(
      source,
      /new Animated\.Value\(isWebRoutePreview \? 1 : 0\)/,
      `${route} should render visible immediately in web previews`,
    );
    assert.match(
      source,
      /if \(isWebRoutePreview\) return;/,
      `${route} should skip native-style entrance animation on web`,
    );
  }

  for (const [route, source] of Object.entries({
    log: routeSources.log,
    plans: routeSources.plans,
    records: routeSources.records,
    more: routeSources.more,
    premium: routeSources.premium,
  })) {
    assert.match(
      source,
      /new Animated\.Value\(isWebRoutePreview \? 0 : (?:16|18)\)/,
      `${route} should keep web slide offset at rest for deterministic captures`,
    );
  }
});

test("keeps the floating route gutter consistent across web and native", () => {
  const routeSources: Record<string, string> = {
    log: readAppFile(join("(tabs)", "log.tsx")),
    plans: readAppFile(join("(tabs)", "calendar.tsx")),
    records: readAppFile(join("(tabs)", "records.tsx")),
    more: readAppFile(join("(tabs)", "more.tsx")),
  };

  for (const [route, source] of Object.entries(routeSources)) {
    assert.match(
      source,
      /const H_PAD = 16;/,
      `${route} should keep the floating 16pt route gutter on web and native`,
    );
    assert.match(
      source,
      /contentContainerStyle=\{\{ paddingTop: topPadding, paddingBottom: bottomPadding, paddingHorizontal: H_PAD \}\}/,
      `${route} should route ScrollView padding through H_PAD`,
    );
  }

  const home = readAppFile(join("(tabs)", "index.tsx"));
  const health = readAppFile(join("(tabs)", "health.tsx"));
  assert.match(home, /const routeHorizontalPadding = 16;/);
  assert.match(health, /const routeHorizontalPadding = 16;/);
  assert.match(home, /paddingHorizontal: routeHorizontalPadding/);
  assert.match(health, /paddingHorizontal: routeHorizontalPadding/);
});

test("keeps compact mobile proof and mission cards from clipping", () => {
  const qaRoute = readAppFile("care-twin-qa.tsx");
  const plans = readAppFile(join("(tabs)", "calendar.tsx"));
  const health = readAppFile(join("(tabs)", "health.tsx"));

  assert.match(
    getStyleBlock(qaRoute, "betaRunMissionHeader"),
    /flexWrap:\s*"wrap"/,
    "QA mission headers should wrap long target names and status badges",
  );
  assert.match(
    qaRoute,
    /style=\{\[s\.betaRunMissionTitle[\s\S]*numberOfLines=\{2\}/,
    "focused QA target titles should have a second line before truncating",
  );
  assert.match(
    getStyleBlock(qaRoute, "betaRunStepText"),
    /minWidth:\s*0/,
    "QA proof copy should shrink inside its card instead of overflowing",
  );
  assert.match(
    getStyleBlock(qaRoute, "badge"),
    /maxWidth:\s*"100%"/,
    "QA badges should stay inside compact card headers",
  );
  assert.match(
    getStyleBlock(plans, "planMissionAction"),
    /width:\s*66[\s\S]*flexShrink:\s*0/,
    "Plan action chips should keep a compact fixed width on phones",
  );
  assert.match(
    getStyleBlock(readAppFile(join("(tabs)", "log.tsx")), "logCommandStageCard"),
    /width:\s*"100%"[\s\S]*maxWidth:\s*"100%"/,
    "Quick Log pixel stage should stay bounded to the phone viewport",
  );
  assert.match(
    getStyleBlock(readAppFile(join("(tabs)", "records.tsx")), "recordsCredentialStageCard"),
    /width:\s*"100%"[\s\S]*maxWidth:\s*"100%"/,
    "Records pixel stage should stay bounded to the phone viewport",
  );
  assert.match(
    getStyleBlock(readAppFile(join("(tabs)", "more.tsx")), "moreCommandStageCard"),
    /width:\s*"100%"[\s\S]*maxWidth:\s*"100%"/,
    "More pixel stage should stay bounded to the phone viewport",
  );
  assert.match(
    getStyleBlock(health, "healthActionRow"),
    /flexDirection:\s*"row"[\s\S]*gap:\s*8/,
    "Health action row should stay compact and predictable on phones",
  );
  assert.match(
    getStyleBlock(health, "healthStageSprite"),
    /width:\s*104[\s\S]*height:\s*104/,
    "Health care-twin sprite should stay compact enough to avoid crowding the status panel",
  );
});

test("keeps Quick Log composer card boundaries separate from search controls", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const composerBlock = log.slice(
    log.indexOf("{/* Composer card */}"),
    log.indexOf("{/* Today at a glance */}"),
  );
  const searchBlock = log.slice(
    log.indexOf("{/* Search and filters */}"),
    log.indexOf("{/* Timeline */}"),
  );

  assert.match(composerBlock, /<BoardCard[\s\S]*<\/BoardCard>/);
  assert.match(composerBlock, /style=\{s\.composerHero/);
  assert.match(
    composerBlock,
    /BoardSectionHeader[\s\S]*title="Choose care type"/,
  );
  assert.doesNotMatch(composerBlock, /title="Find care logs"/);
  assert.match(
    searchBlock,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Find care logs"[\s\S]*<\/BoardCard>/,
  );
  assert.doesNotMatch(searchBlock, /title="Choose care type"/);
});

test("keeps Quick Log polished for exact tap selection and mobile scanability", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(log, /actionLabel="Open Health Watch"/);
  assert.match(log, /router\.push\("\/health\?tab=health" as never\)/);
  assert.match(log, /launcherActionKey/);
  assert.match(log, /selectedLauncherKey === launcherActionKey\(action\)/);
  assert.match(log, /aria-selected=\{active\}/);
  assert.match(log, /width: "31\.5%"/);
  assert.match(log, /composerTrustRail/);
  assert.match(log, /Care IQ/);
  assert.match(log, /moodTone/);
  assert.match(log, /flexBasis: "47\.5%"/);
  assert.match(log, /buildQuickLogEntry/);
  assert.match(log, /describeQuickLogDetailSheet/);
  assert.match(log, /describeQuickLogLauncherAction/);
  assert.match(log, /getQuickLogPolicy/);
  assert.doesNotMatch(
    log,
    /BoardSectionHeader title="Choose care type" action="Fast tap"/,
  );
  assert.match(
    log,
    /BoardSectionHeader\s+title="Choose care type"[\s\S]*<BoardPill\s+label="Fast tap"/,
  );
  assert.match(log, /handleQuickLauncherAction/);
  assert.match(log, /launcherDetailAction/);
  assert.match(log, /launcherDetailPresentation/);
  assert.match(log, /launcherDoctrineRail/);
  assert.match(log, /Tap/);
  assert.match(log, /Hold/);
  assert.match(log, /Edit later/);
  assert.match(log, /launcherDetailModeRail/);
  assert.match(log, /launcherDetailPresentation\.interactionRail/);
  assert.match(log, /launcherDetailEditLater/);
  assert.match(log, /launcherDetailPresentation\.editLaterCopy/);
  assert.match(log, /openLauncherDetailSheet/);
  assert.match(log, /openQuickLogGuide/);
  assert.match(log, /focusFullComposerForLauncherAction/);
  // "Tap saves. Hold opens details." is literal now: hold lands straight in
  // the pre-focused composer, and the policy explainer lives behind the "?".
  assert.match(
    log,
    /onLongPress=\{\(\) => focusFullComposerForLauncherAction\(action\)\}/,
  );
  assert.doesNotMatch(
    log,
    /onLongPress=\{\(\) => openLauncherDetailSheet\(action\)\}/,
  );
  assert.match(log, /QUICK LOG FLOW/);
  const mealDetailSheet = describeQuickLogDetailSheet("meal", "Meal");
  const medicationDetailSheet = describeQuickLogDetailSheet(
    "medication",
    "Meds",
  );
  assert.equal(mealDetailSheet.primaryActionLabel, "Quick log now");
  assert.equal(mealDetailSheet.secondaryActionLabel, "Open full details");
  assert.equal(mealDetailSheet.canQuickLog, true);
  assert.equal(medicationDetailSheet.primaryActionLabel, "Open full details");
  assert.equal(medicationDetailSheet.canQuickLog, false);
  assert.match(log, /launcherPresentation\.accessibilityLabel/);
  assert.match(log, /launcherPresentation\.feedbackHint/);
  assert.match(log, /launcherPresentation\.modeLabel/);
  assert.match(log, /launcherTileMode/);
  assert.match(log, /\{ label: "Potty", type: "potty"/);
  assert.doesNotMatch(log, /\{ label: "Pee", type: "potty"/);
  assert.doesNotMatch(log, /\{ label: "Poo", type: "potty"/);
  assert.match(log, /Undo/);
  assert.match(log, /Add details/);
  assert.match(log, /DETAIL_WORKFLOW_RAIL/);
  assert.match(log, /detailCommandRail/);
  assert.match(log, /detailCommandCard/);
  assert.match(log, /Record controls/);
  assert.match(log, /accessibilityLabel="Share care handoff"/);
  assert.match(log, /accessibilityLabel="Add sticky note to care log"/);
  assert.match(log, /accessibilityLabel="Edit care log"/);
  assert.match(log, /accessibilityLabel="Delete care log"/);
  for (const styleName of [
    "outboxButton",
    "launcherTab",
    "quickFeedbackButton",
    "returnOutcomeButton",
    "walkFinishButton",
    "trustProofAttachButton",
    "trustActionButton",
    "mealOutcomeButton",
    "pottyOptionButton",
    "pottySaveButton",
    "detailPrimaryBtn",
    "detailIconBtn",
    "launcherDetailPrimary",
    "launcherDetailSecondary",
  ]) {
    assertStyleUsesSharedTouchTarget(log, styleName);
  }
});

test("keeps Quick Log aligned to the mobile design-system recovery recipe", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const gridIndex = log.indexOf("<View style={s.launcherGrid}>");
  const doctrineIndex = log.indexOf("<View style={s.launcherDoctrineRail}>");
  const supportRailIndex = log.indexOf("<View style={s.quickLogSupportRail}>");
  const composerIndex = log.indexOf("{/* Composer card */}");

  assert.match(log, /quickLogActionConsole/);
  assert.match(log, /quickLogActionConsoleHeader/);
  assert.match(log, /quickLogSupportRail/);
  assert.match(log, /quickLogDetailDock/);
  assert.match(log, /logCommandStage:[\s\S]*width: "100%"[\s\S]*minHeight: 82/);
  assert.match(log, /resizeMode="cover"[\s\S]*testID="quick-log-command-pixel-stage"/);
  assert.match(log, /logCommandBubble:[\s\S]*maxWidth: "68%"/);
  assert.match(
    log,
    /logCommandSpeech,\s*\{\s*color:\s*colors\.brandNavy/,
    "the fixed-light Quick Care Console bubble must keep dark ink in dark mode",
  );
  assert.doesNotMatch(
    log,
    /logCommandSpeech,\s*\{\s*color:\s*colors\.foreground/,
    "adaptive foreground becomes near-white and loses contrast on the fixed-light bubble",
  );
  // Sprite moved out of the Ready/Details chip's column (heart-emote collision).
  assert.match(log, /logCommandSprite:[\s\S]*right: 96/);
  assert.match(log, /logCommandDock/);
  assert.doesNotMatch(log, /logCommandMission/);
  assert.doesNotMatch(log, />\s*Selected\s*</);
  assert.match(log, /Tap saves\. Hold opens details\./);
  assert.match(
    getStyleBlock(log, "logCommandDock"),
    /flexDirection:\s*"row"/,
    "Quick Log command dock should be one compact row so the action grid stays visible",
  );
  assert.doesNotMatch(
    getStyleBlock(log, "logCommandHud"),
    /marginTop:\s*104/,
    "Quick Log HUD should live in the dock instead of floating over the scene",
  );
  assert.ok(
    gridIndex > 0 && doctrineIndex > gridIndex,
    "Quick Log should show the action grid before the teaching rail",
  );
  assert.ok(
    supportRailIndex > 0 && supportRailIndex < composerIndex,
    "Quick Log should keep support metrics between the action console and detail dock",
  );
});

test("keeps mood logging structured for energy, context, and household visibility", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const moodConfig = log.slice(
    log.indexOf('type: "mood"'),
    log.indexOf('type: "alone"'),
  );
  const buildEntryBlock = log.slice(
    log.indexOf("const buildEntry = useCallback"),
    log.indexOf("const handleLog = useCallback"),
  );

  assert.match(moodConfig, /key: "energyLevel"/);
  assert.match(moodConfig, /id: "steady"/);
  assert.match(moodConfig, /id: "low"/);
  assert.match(moodConfig, /id: "high"/);
  assert.match(moodConfig, /Sticky note: energy, trigger, appetite/);
  assert.match(log, /const \[moodContext, setMoodContext\] = useState\(""\)/);
  assert.match(log, /selectedType === "mood"[\s\S]*Care context/);
  assert.match(log, /value=\{moodContext\}/);
  assert.match(log, /onChangeText=\{setMoodContext\}/);
  assert.match(log, /Shared mood logs update Mood Trend/);
  assert.match(
    buildEntryBlock,
    /config\.type === "mood"[\s\S]*details\.householdVisible = householdVisible/,
  );
  assert.match(buildEntryBlock, /details\.moodContext = context/);
});

test("keeps Quick Log search and timeline on shared board card anatomy", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(
    log,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Today at a glance"/,
  );
  assert.match(
    log,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Find care logs"/,
  );
  assert.doesNotMatch(
    log,
    /BoardSectionHeader title="Today at a glance" action=\{\`\$\{todaySnapshot\.total\} logged`\}/,
  );
  assert.match(
    log,
    /BoardSectionHeader\s+title="Today at a glance"[\s\S]*<BoardPill\s+label=\{\`\$\{todaySnapshot\.total\} logged`\}/,
  );
  assert.doesNotMatch(
    log,
    /BoardSectionHeader title="Find care logs" action=\{logSearch\.hasActiveFilters \? "Filtered" : undefined\}/,
  );
  assert.match(
    log,
    /BoardSectionHeader\s+title="Find care logs"[\s\S]*<BoardPill\s+label="Filtered"/,
  );
  assert.match(
    log,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title=\{g\.label\}/,
  );
  assert.match(
    log,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="No matching logs"/,
  );
  assert.doesNotMatch(log, /searchCard:/);
  assert.doesNotMatch(log, /snapshotBar:/);
  assert.doesNotMatch(log, /dayCard:/);
});

test("keeps WoofGuide prompts and actions on shared board card anatomy", () => {
  const guide = readAppFile("woofguide.tsx");

  assert.match(guide, /<BoardCard(?: enter=\{\d+\})? style=\{s\.guideIntroCard\}/);
  assert.match(
    guide,
    /<BoardCard style=\{s\.quickQuestionBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Quick questions"/,
  );
  assert.match(
    guide,
    /<BoardCard(?: enter=\{\d+\})? style=\{s\.actionBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Suggested actions"/,
  );
  assert.match(
    guide,
    /import \{ BoardCard, BoardPill, BoardSectionHeader \}/,
  );
  assert.match(guide, /guideIntroRow/);
  assert.match(guide, /guideIntroTitle/);
  assert.match(guide, /Owner-reviewed guidance/);
  assert.doesNotMatch(guide, /<BoardSectionHeader[\s\S]*?\saction=/);
  assert.match(
    guide,
    /BoardSectionHeader\s+title="Quick questions"[\s\S]*<BoardPill\s+label="Tap to ask"/,
  );
  assert.match(
    guide,
    /BoardSectionHeader\s+title="Suggested actions"[\s\S]*<BoardPill\s+label="Owner reviewed"/,
  );
  assert.match(guide, /Owner review required/);
  assert.doesNotMatch(guide, /quickRow:/);
  assert.doesNotMatch(guide, /actionArea:/);
  assert.doesNotMatch(guide, /actionCard:/);
  assert.doesNotMatch(guide, /quickChip: \{[^\n]*shadowOpacity/);
  assert.doesNotMatch(guide, /actionRow: \{[^\n]*shadowOpacity/);
});

test("keeps WoofGuide rooted in a live pixel guidance stage", () => {
  const guide = readAppFile("woofguide.tsx");

  assert.match(guide, /inverted=\{messages\.length > 0\}/);
  assert.match(guide, /ImageBackground/);
  assert.match(guide, /WOOFGUIDE_STAGE_ROOM/);
  // Stage art is the purpose-composed evening-study scene, not a crop of the
  // night room variant.
  assert.match(guide, /woofguide-stage\.png/);
  assert.match(guide, /SpriteSheetPlayer/);
  assert.match(guide, /testID="woofguide-pixel-guidance-stage"/);
  // Stage height dropped 294 -> 260 when the HUD moved into the dock below
  // the painting (the scene no longer hosts overlaid chrome).
  assert.match(guide, /guideStage:\s*\{[\s\S]*minHeight:\s*260/);
  // The dock pattern itself is load-bearing: HUD + boundary/action row sit
  // BELOW the art so the dog keeps its floor contact.
  assert.match(guide, /guideDock/);
  assert.match(guide, /getCareTwinSpriteAsset\("idle-breathe"\)/);
  assert.match(guide, /CARE_TWIN_SPRITE_MANIFEST\["idle-breathe"\]/);
  assert.match(guide, /pixelImageStyle/);
  assert.match(guide, /WoofGuide Console/);
  assert.match(guide, /Owner review/);
  assert.match(guide, /Not veterinary advice/);
});

test("keeps WoofGuide prompt, send, and owner-review actions on shared mobile touch targets", () => {
  const guide = readAppFile("woofguide.tsx");

  for (const styleName of [
    "quickChip",
    "actionRow",
    "sendBtn",
    "reviewCancel",
    "reviewApply",
    "gateLinkRow",
    "gateComposerLink",
  ]) {
    assertStyleReferencesSharedTouchTarget(guide, styleName);
  }
});

test("keeps the WoofGuide assistant honestly gated until a provider is configured", () => {
  const guide = readAppFile("woofguide.tsx");
  const guideActions = readMobileLibFile("woofGuideActions.ts");

  // The screen must derive availability from the shared provider gate
  // (structured AI provider proof + care-helper domain), never assume it.
  assert.match(guide, /resolveWoofGuideAssistantGate/);
  assert.match(guide, /buildAiProviderProofManifest\(\{\}\)\.liveAiAllowed/);
  assert.match(guide, /if \(!ASSISTANT_GATE\.enabled\) return;/);

  // The gated state must be honest and must not fake a transient outage.
  assert.doesNotMatch(
    guide,
    /unavailable right now[\s\S]{0,120}try again in a moment/,
    "WoofGuide must not claim a transient outage when no assistant provider exists",
  );
  assert.match(guideActions, /isn't enabled in this build/);
  assert.match(guideActions, /Nothing you type here is sent anywhere/);
  assert.match(guideActions, /nothing typed here would be sent/);

  // Ask affordances stay behind the gate; the gated state offers working
  // destinations instead of dead chat inputs.
  assert.match(guide, /ASSISTANT_GATE\.enabled \? \(/);
  assert.match(guide, /WOOFGUIDE_ASSISTANT_FALLBACK_LINKS\.map/);
  assert.match(guideActions, /route: "\/health"/);
  assert.match(guideActions, /route: "\/records"/);
  assert.match(guideActions, /route: "\/",/);
  assert.match(guide, /accessibilityLabel="Open Health Watch from guidance console"/);
  assert.match(guide, /accessibilityLabel="Open Health Watch instead of the disabled assistant"/);

  // Health Watch's "Draft vet questions" funnel must land on the existing
  // deterministic owner-reviewed vet-note draft, not an unanswerable chat.
  assert.match(guide, /promptParam !== "health-review"/);
  assert.match(guide, /deriveWoofGuideVetNoteAction\(state\)/);
});

test("keeps Premium value, plan, and entitlement surfaces on shared board anatomy", () => {
  const premium = readAppFile("premium.tsx");

  assert.match(premium, /@\/components\/board\/BoardPrimitives/);
  assert.match(
    premium,
    /<BoardCard(?: enter=\{\d+\})? style=\{s\.premiumBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Why upgrade"/,
  );
  assert.match(
    premium,
    /import \{ BoardCard, BoardPill, BoardSectionHeader \}/,
  );
  assert.doesNotMatch(premium, /<BoardSectionHeader[\s\S]*?\saction=/);
  assert.match(
    premium,
    /BoardSectionHeader\s+title="Why upgrade"[\s\S]*<BoardPill\s+label=\{`\$\{preview\.valueSignals\.length\} signals`\}/,
  );
  assert.match(
    premium,
    /BoardSectionHeader\s+title="Plans"[\s\S]*<BoardPill\s+label="Checkout gated"/,
  );
  assert.match(
    premium,
    /<BoardCard(?: enter=\{\d+\})? style=\{s\.entitlementCard\}[\s\S]*BoardSectionHeader[\s\S]*title="Launch entitlements"/,
  );
  assert.match(
    premium,
    /<BoardCard(?: enter=\{\d+\})? style=\{s\.paymentsProofCard\}[\s\S]*BoardSectionHeader[\s\S]*title="Payments proof"/,
  );
  assert.match(
    premium,
    /BoardSectionHeader\s+title="Launch entitlements"[\s\S]*<BoardPill\s+label="Current: Free"/,
  );
  assert.match(premium, /function PlanCard[\s\S]*<BoardCard/);
  assert.match(premium, /Premium launch checklist/);
  assert.doesNotMatch(premium, /sectionHeader:/);
  assert.doesNotMatch(premium, /sectionTitle:/);
  assert.doesNotMatch(premium, /signalCard:/);
});

test("keeps Premium rooted in a launch-safe pixel value stage", () => {
  const premium = readAppFile("premium.tsx");

  assert.match(premium, /ImageBackground/);
  assert.match(premium, /PREMIUM_VALUE_STAGE_ROOM/);
  assert.match(premium, /phoenix-room-day-pixellab-400x300\.png/);
  assert.match(premium, /resizeMode="stretch"[\s\S]*testID="premium-value-pixel-stage"/);
  assert.match(premium, /SpriteSheetPlayer/);
  assert.match(premium, /getCareTwinSpriteAsset\("celebrate-hop"\)/);
  assert.match(premium, /CARE_TWIN_SPRITE_MANIFEST\["celebrate-hop"\]/);
  assert.match(premium, /pixelImageStyle/);
  assert.match(premium, /Plus Value Console/);
  assert.match(premium, /Checkout gated/);
  assert.match(premium, /Launch checklist/);
});

test("keeps Privacy export and launch safety surfaces on shared board anatomy", () => {
  const privacy = readAppFile("privacy.tsx");

  assert.match(privacy, /@\/components\/board\/BoardPrimitives/);
  assert.match(
    privacy,
    /import \{ BoardCard, BoardPill, BoardSectionHeader \}/,
  );
  assert.doesNotMatch(privacy, /<BoardSectionHeader[\s\S]*?\saction=/);
  assert.match(
    privacy,
    /<BoardCard(?: enter=\{\d+\})? style=\{s\.privacyBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Export summary"/,
  );
  assert.match(
    privacy,
    /BoardSectionHeader\s+title="Export summary"[\s\S]*<BoardPill\s+label="Local bundle"/,
  );
  assert.match(
    privacy,
    /BoardSectionHeader\s+title="Attachment queue"[\s\S]*<BoardPill\s+label=\{`\$\{bundle\.storage\.attachmentQueue\.total\} files`\}/,
  );
  assert.match(
    privacy,
    /<BoardCard(?: enter=\{\d+\})? style=\{s\.privacyBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Support runbook"/,
  );
  assert.match(
    privacy,
    /BoardSectionHeader\s+title="Support runbook"[\s\S]*<BoardPill\s+label="Launch gate"/,
  );
  assert.match(
    privacy,
    /<BoardCard(?: enter=\{\d+\})? style=\{s\.privacyBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Launch safety gates"/,
  );
  assert.match(
    privacy,
    /BoardSectionHeader\s+title="Launch safety gates"[\s\S]*<BoardPill\s+label=\{`\$\{sections\.length\} gates`\}/,
  );
  assert.match(privacy, /<BoardCard(?: enter=\{\d+\})? style=\{\[s\.noticeBoard/);
  assert.match(privacy, /Export care data/);
  assert.match(privacy, /Deletion request/);
  assert.match(privacy, /Before public launch/);
  assert.doesNotMatch(privacy, /sectionHeader:/);
  assert.doesNotMatch(privacy, /sectionTitle:/);
  assert.doesNotMatch(privacy, /statCard:/);
});

test("keeps Avatar Studio preview and mood states on shared board anatomy", () => {
  const avatarStudio = readAppFile("portrait.tsx");
  const avatarModel = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "avatarStudio.ts",
    ),
    "utf8",
  );
  const avatarTemplateAssets = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "avatarTemplateAssets.ts",
    ),
    "utf8",
  );
  const avatarTemplateSpriteAssets = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "avatarTemplateSpriteAssets.ts",
    ),
    "utf8",
  );
  const avatarPreviewModel = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "avatarPreviewModel.ts",
    ),
    "utf8",
  );
  const avatarContext = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "context",
      "AvatarContext.tsx",
    ),
    "utf8",
  );
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const more = readAppFile(join("(tabs)", "more.tsx"));
  const templateIds = [
    "shepherd",
    "retriever",
    "husky",
    "bully",
    "doodle",
    "terrier",
    "hound",
    "dachshund",
    "spaniel",
    "toy",
    "slender",
    "mixed",
  ];
  const shepherdAccessoryIds = [
    "forest-bandana",
    "navy-collar",
    "birthday-hat",
    "sleepy-mask",
    "training-vest",
    "cozy-bed",
    "heart-sparkles",
  ];
  const shepherdEmoteIds = [
    "happy",
    "calm",
    "excited",
    "bored",
    "hungry",
    "anxious",
    "sleepy",
    "proud",
    "home_alone",
    "not_feeling_well",
  ];
  const templateEmotePacks = {
    retriever: [
      "happy",
      "calm",
      "excited",
      "bored",
      "hungry",
      "anxious",
      "sleepy",
      "proud",
      "home-alone",
      "not-feeling-well",
    ],
    husky: [
      "happy",
      "calm",
      "excited",
      "bored",
      "hungry",
      "anxious",
      "sleepy",
      "proud",
      "home-alone",
      "not-feeling-well",
    ],
    bully: [
      "happy",
      "calm",
      "excited",
      "bored",
      "hungry",
      "anxious",
      "sleepy",
      "proud",
      "home-alone",
      "not-feeling-well",
    ],
  };

  assert.match(
    avatarStudio,
    /<BoardCard\s+padded=\{false\}\s+style=\{\[s\.canvasCard/,
  );
  assert.match(
    avatarStudio,
    /<BoardCard\s+padded=\{false\}\s+style=\{s\.heroPreview\}/,
  );
  assert.match(
    avatarStudio,
    /<BoardCard style=\{s\.avatarBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Suggested starting traits"/,
  );
  assert.match(
    avatarStudio,
    /<BoardCard style=\{s\.avatarBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Mood set"/,
  );
  assert.doesNotMatch(avatarStudio, /<BoardSectionHeader[\s\S]*?\saction=/);
  assert.match(
    avatarStudio,
    /BoardSectionHeader\s+title="Suggested starting traits"[\s\S]*<BoardPill\s+label="Owner review"/,
  );
  assert.match(
    avatarStudio,
    /BoardSectionHeader\s+title="Bring your dog in"[\s\S]*<BoardPill\s+label=\{hasConfiguredAvatar \? "Configured" : "Start"\}/,
  );
  assert.match(
    avatarStudio,
    /BoardSectionHeader\s+title="Choose base template"[\s\S]*<BoardPill\s+label=\{`\$\{liveTemplateCount\}\/\$\{AVATAR_TEMPLATES\.length\} live`\}/,
  );
  assert.match(
    avatarStudio,
    /BoardSectionHeader\s+title="Coat colors"[\s\S]*<BoardPill\s+label="Editable"/,
  );
  assert.match(
    avatarStudio,
    /BoardSectionHeader\s+title="Face markings"[\s\S]*<BoardPill\s+label=\{faceMarkingLabel\}/,
  );
  assert.match(
    avatarStudio,
    /BoardSectionHeader\s+title="Accessories"[\s\S]*<BoardPill\s+label="Fit map"/,
  );
  assert.match(
    avatarStudio,
    /BoardSectionHeader\s+title="Mood set"[\s\S]*<BoardPill\s+label=\{\s*draft\.emotePackId === "phoenix-shepherd"\s*\?\s*"Phoenix pack"\s*:\s*"Starter"\s*\}/,
  );
  assert.match(avatarStudio, /<BoardCard style=\{s\.tipBoard\} tone="soft"/);
  assert.match(
    avatarStudio,
    /Choose a pixel twin, then customize\./,
  );
  assert.match(avatarStudio, /AVATAR_SCAN_WORKFLOW_STEPS/);
  assert.match(avatarStudio, /scanPipelineGrid/);
  assert.match(avatarStudio, /scanPipelineCard/);
  assert.match(avatarStudio, /Photo reference/);
  assert.match(avatarStudio, /Template match/);
  assert.match(avatarStudio, /Pixel twin/);
  assert.match(avatarStudio, /Owner approval/);
  assert.match(avatarStudio, /PixelLab-backed template catalog/);
  assert.match(avatarStudio, /Not a photo filter/);
  assert.match(avatarStudio, /Choose base template/);
  assert.match(avatarStudio, /Accessories/);
  assert.match(avatarStudio, /Save Avatar/);
  assert.match(avatarStudio, /AVATAR_EMOTE_STATES/);
  assert.match(avatarStudio, /PIXEL_ROOM_SOURCE/);
  assert.match(avatarStudio, /LivingPhoenixRoom/);
  assert.match(avatarStudio, /deriveAvatarMotion/);
  assert.match(avatarStudio, /derivePhoenixStatus/);
  assert.match(
    avatarStudio,
    /getAvatarTemplateBaseSource\(draft\.templateId\)/,
  );
  assert.match(avatarStudio, /getAvatarTemplateDisplaySource\(template\.id\)/);
  assert.match(avatarStudio, /templateHeroDogWrap/);
  assert.match(avatarStudio, /s\.templateArtWrap/);
  assert.match(avatarStudio, /phoenix-room-day-option-b\.png/);
  assert.match(avatarStudio, /phoenix-main-head-v2-crisp\.png/);
  assert.match(avatarStudio, /selectedTemplateStillSource/);
  assert.match(avatarStudio, /PHOTO REFERENCE/);
  assert.match(
    avatarStudio,
    /Building a pixel twin, not using the photo as the avatar/,
  );
  assert.doesNotMatch(avatarStudio, /assets\/board\/hero\.png/);
  assert.doesNotMatch(avatarStudio, /getAvatarSource\("happy"\)/);
  assert.match(avatarTemplateAssets, /AVATAR_TEMPLATE_PREVIEW_ASSETS/);
  assert.match(avatarTemplateAssets, /AVATAR_TEMPLATE_BASE_ASSETS/);
  assert.match(avatarTemplateAssets, /AVATAR_TEMPLATE_ACCESSORY_ASSETS/);
  assert.match(avatarTemplateAssets, /AVATAR_TEMPLATE_EMOTE_ASSETS/);
  assert.match(avatarTemplateAssets, /pixellab-template-preview/);
  assert.match(avatarTemplateAssets, /pixellab-template-base/);
  assert.match(avatarTemplateAssets, /pixellab-template-accessory/);
  assert.match(avatarTemplateAssets, /pixellab-template-emote/);
  assert.match(avatarStudio, /deriveAvatarPreviewAccessories/);
  assert.match(avatarStudio, /deriveAvatarPreviewMood/);
  assert.match(avatarStudio, /deriveAvatarPreviewMotion/);
  assert.match(avatarStudio, /previewEmote/);
  assert.match(avatarPreviewModel, /AvatarStudioMotionPreviewState/);
  assert.match(avatarPreviewModel, /listAvatarStudioMotionPreviewStates/);
  assert.match(avatarPreviewModel, /getAvatarStudioMotionPreviewState/);
  assert.match(avatarPreviewModel, /health-watch/);
  assert.match(avatarPreviewModel, /drink-loop/);
  assert.match(avatarStudio, /SpriteSheetPlayer/);
  assert.match(avatarStudio, /CARE_TWIN_SPRITE_MANIFEST/);
  assert.match(avatarStudio, /getCareTwinSpriteAsset/);
  assert.match(avatarStudio, /getAvatarTemplateSpritePreview/);
  assert.match(avatarStudio, /avatar-studio-live-sprite-preview/);
  assert.match(avatarStudio, /avatar-studio-pixel-sprite-viewport/);
  assert.match(avatarStudio, /Live PixelLab sprite rig\./);
  assert.doesNotMatch(
    avatarStudio,
    /templateHeroDogGhost:\s*\{\s*opacity:\s*0/,
  );
  assert.match(avatarStudio, /templatePixelFloor/);
  assert.match(avatarStudio, /savedScrim:[\s\S]*height: "24%"/);
  assert.match(avatarStudio, /savedName:\s*\{ color: "#FFF9EF", fontSize: 17\.5/);
  assert.match(avatarStudio, /<Text numberOfLines=\{1\} style=\{\[s\.savedSub/);
  assert.match(avatarPreviewModel, /Animated Phoenix pack/);
  assert.match(avatarPreviewModel, /Live template sprite pack/);
  assert.match(avatarPreviewModel, /Starter still preview/);
  assert.match(avatarTemplateSpriteAssets, /AVATAR_TEMPLATE_SPRITE_ASSETS/);
  assert.match(avatarTemplateSpriteAssets, /hasAvatarTemplateSpritePack/);
  assert.match(avatarStudio, /liveTemplateCount/);
  assert.match(avatarStudio, /templateLiveBadge/);
  assert.match(avatarStudio, /Sprite rig in production/);
  assert.match(
    avatarTemplateAssets,
    /assets\/avatar\/templates\/shepherd\/preview-crisp\.png/,
  );
  assert.match(
    avatarTemplateAssets,
    /assets\/avatar\/templates\/shepherd\/base-crisp\.png/,
  );
  assert.match(avatarTemplateSpriteAssets, /bully:[\s\S]*idle-tail-wag/);
  assert.match(avatarTemplateSpriteAssets, /bully:[\s\S]*walk-loop/);
  assert.match(avatarTemplateSpriteAssets, /dachshund:[\s\S]*idle-tail-wag/);
  assert.match(avatarTemplateSpriteAssets, /dachshund:[\s\S]*walk-loop/);
  assert.match(avatarTemplateSpriteAssets, /doodle:[\s\S]*idle-tail-wag/);
  assert.match(avatarTemplateSpriteAssets, /doodle:[\s\S]*walk-loop/);
  assert.match(avatarTemplateSpriteAssets, /hound:[\s\S]*idle-tail-wag/);
  assert.match(avatarTemplateSpriteAssets, /hound:[\s\S]*walk-loop/);
  assert.match(avatarTemplateSpriteAssets, /husky:[\s\S]*idle-tail-wag/);
  assert.match(avatarTemplateSpriteAssets, /husky:[\s\S]*walk-loop/);
  assert.match(avatarTemplateSpriteAssets, /mixed:[\s\S]*idle-tail-wag/);
  assert.match(avatarTemplateSpriteAssets, /mixed:[\s\S]*walk-loop/);
  assert.match(avatarTemplateSpriteAssets, /retriever:[\s\S]*idle-tail-wag/);
  assert.match(avatarTemplateSpriteAssets, /retriever:[\s\S]*walk-loop/);
  assert.match(avatarTemplateSpriteAssets, /slender:[\s\S]*idle-tail-wag/);
  assert.match(avatarTemplateSpriteAssets, /slender:[\s\S]*walk-loop/);
  assert.match(avatarTemplateSpriteAssets, /spaniel:[\s\S]*idle-tail-wag/);
  assert.match(avatarTemplateSpriteAssets, /spaniel:[\s\S]*walk-loop/);
  assert.match(avatarTemplateSpriteAssets, /terrier:[\s\S]*idle-tail-wag/);
  assert.match(avatarTemplateSpriteAssets, /terrier:[\s\S]*walk-loop/);
  assert.match(avatarTemplateSpriteAssets, /toy:[\s\S]*idle-tail-wag/);
  assert.match(avatarTemplateSpriteAssets, /toy:[\s\S]*walk-loop/);
  assert.match(avatarTemplateSpriteAssets, /getAvatarTemplateSpritePreview/);
  assert.match(
    avatarTemplateSpriteAssets,
    /case "hungry":[\s\S]*case "anxious":[\s\S]*case "sleepy":[\s\S]*case "home_alone":[\s\S]*case "not_feeling_well":[\s\S]*return "idle-tail-wag"/,
  );
  for (const templateId of [
    "bully",
    "dachshund",
    "doodle",
    "hound",
    "husky",
    "mixed",
    "retriever",
    "slender",
    "spaniel",
    "terrier",
    "toy",
  ]) {
    for (const fileName of ["idle-tail-wag-strip.png", "walk-loop-strip.png"]) {
      assert.match(
        avatarTemplateSpriteAssets,
        new RegExp(`assets/avatar/templates/${templateId}/sprites/${fileName}`),
      );
      const size = readPngSize(
        join(
          process.cwd(),
          "artifacts",
          "woofwatcher-mobile",
          "assets",
          "avatar",
          "templates",
          templateId,
          "sprites",
          fileName,
        ),
      );
      assert.deepEqual(
        size,
        { width: 2048, height: 256 },
        `${fileName} should be an 8-frame 256px-slot ${templateId} sprite strip`,
      );
    }
  }
  assert.match(
    avatarStudio,
    /getAvatarTemplateAccessorySource\(draft\.templateId, layer\.id\)/,
  );
  assert.match(
    avatarStudio,
    /getAvatarTemplateEmoteSource\(\s*draft\.templateId,\s*previewEmote,\s*\)/,
  );
  assert.match(
    avatarStudio,
    /summarizeAvatarAccessoryFits\(draft\.templateId\)/,
  );
  assert.match(
    avatarStudio,
    /deriveAvatarAccessoryFit\(draft\.templateId, item\)/,
  );
  assert.match(avatarStudio, /Template overlay readiness/);
  assert.match(avatarStudio, /accessoryFitPanel/);
  assert.match(avatarStudio, /fit\.label/);
  assert.match(avatarStudio, /fit\.placementHint/);
  assert.match(avatarPreviewModel, /fitStatus/);
  assert.match(
    avatarPreviewModel,
    /deriveAvatarAccessoryFit\(config\.templateId, item\)/,
  );
  assert.match(avatarStudio, /templateBandana/);
  assert.match(avatarStudio, /templateVest/);
  assert.match(avatarStudio, /templateAccessoryLayer/);
  assert.match(avatarStudio, /Preview \$\{emoteLabel\(emote\)\} mood/);
  for (const [fileName, expected] of [
    ["phoenix-main-avatar-v2-crisp.png", { width: 680, height: 680 }],
    ["phoenix-main-head-v2-crisp.png", { width: 1024, height: 1024 }],
  ] as const) {
    const size = readPngSize(
      join(
        process.cwd(),
        "artifacts",
        "woofwatcher-mobile",
        "assets",
        "avatar",
        "phoenix",
        "approved",
        fileName,
      ),
    );
    assert.deepEqual(
      size,
      expected,
      `${fileName} should be a nearest-neighbor crisp Phoenix asset`,
    );
  }
  for (const [fileName, expected] of [
    ["option-b-seated.png", { width: 170, height: 170 }],
    ["option-b-standing.png", { width: 170, height: 170 }],
    ["option-b-sleep-source.png", { width: 170, height: 170 }],
  ] as const) {
    const size = readPngSize(
      join(
        process.cwd(),
        "artifacts",
        "woofwatcher-mobile",
        "assets",
        "avatar",
        "phoenix",
        "candidates",
        fileName,
      ),
    );
    assert.deepEqual(
      size,
      expected,
      `${fileName} should stay archived as a PixelLab Option B source candidate`,
    );
  }
  for (const [fileName, expected] of [
    ["option-b-idle-tail-wag-strip.png", { width: 2048, height: 256 }],
    ["option-b-ear-perk-strip.png", { width: 1536, height: 256 }],
    ["option-b-bark-reaction-strip.png", { width: 1536, height: 256 }],
    ["option-b-walk-loop-strip.png", { width: 2048, height: 256 }],
    ["option-b-eat-loop-strip.png", { width: 2048, height: 256 }],
    ["option-b-drink-loop-strip.png", { width: 2048, height: 256 }],
    ["option-b-sleep-loop-strip.png", { width: 2048, height: 256 }],
    ["option-b-comfort-loop-strip.png", { width: 2048, height: 256 }],
    ["option-b-health-watch-strip.png", { width: 2048, height: 256 }],
    ["option-b-celebrate-hop-strip.png", { width: 2048, height: 256 }],
  ] as const) {
    const size = readPngSize(
      join(
        process.cwd(),
        "artifacts",
        "woofwatcher-mobile",
        "assets",
        "avatar",
        "phoenix",
        "candidates",
        fileName,
      ),
    );
    assert.deepEqual(
      size,
      expected,
      `${fileName} should stay archived as an 8-frame Option B animation proof`,
    );
  }
  for (const [fileName, expected] of [
    ["storybook-idle-tail-wag-strip.png", { width: 2048, height: 256 }],
    ["storybook-ear-perk-strip.png", { width: 1536, height: 256 }],
    ["storybook-bark-reaction-strip.png", { width: 1536, height: 256 }],
    ["storybook-walk-loop-strip.png", { width: 2048, height: 256 }],
    ["storybook-eat-loop-strip.png", { width: 2048, height: 256 }],
    ["storybook-drink-loop-strip.png", { width: 2048, height: 256 }],
    ["storybook-sleep-loop-strip.png", { width: 2048, height: 256 }],
    ["storybook-comfort-loop-strip.png", { width: 2048, height: 256 }],
    ["storybook-health-watch-strip.png", { width: 2048, height: 256 }],
    ["storybook-celebrate-hop-strip.png", { width: 2048, height: 256 }],
    ["storybook-still-sit.png", { width: 256, height: 256 }],
    ["storybook-still-sleep.png", { width: 256, height: 256 }],
  ] as const) {
    const size = readPngSize(
      join(
        process.cwd(),
        "artifacts",
        "woofwatcher-mobile",
        "assets",
        "avatar",
        "phoenix",
        "storybook",
        fileName,
      ),
    );
    assert.deepEqual(
      size,
      expected,
      `${fileName} should be the live storybook German Shepherd animation strip`,
    );
  }
  for (const [fileName, expected] of [
    ["preview-crisp.png", { width: 340, height: 340 }],
    ["base-crisp.png", { width: 680, height: 680 }],
  ] as const) {
    const size = readPngSize(
      join(
        process.cwd(),
        "artifacts",
        "woofwatcher-mobile",
        "assets",
        "avatar",
        "templates",
        "shepherd",
        fileName,
      ),
    );
    assert.deepEqual(
      size,
      expected,
      `${fileName} should be a nearest-neighbor crisp shepherd asset`,
    );
  }
  for (const templateId of templateIds) {
    const registryPreviewPath =
      templateId === "shepherd" ? "preview-crisp" : "preview";
    assert.match(
      avatarTemplateAssets,
      new RegExp(
        `${templateId}:[\\s\\S]*assets/avatar/templates/${templateId}/${registryPreviewPath}\\.png`,
      ),
    );
    const size = readPngSize(
      join(
        process.cwd(),
        "artifacts",
        "woofwatcher-mobile",
        "assets",
        "avatar",
        "templates",
        templateId,
        "preview.png",
      ),
    );
    assert.deepEqual(
      size,
      { width: 85, height: 85 },
      `${templateId} preview should be a PixelLab 85x85 thumbnail`,
    );
  }
  for (const templateId of templateIds) {
    const registryBasePath = templateId === "shepherd" ? "base-crisp" : "base";
    assert.match(
      avatarTemplateAssets,
      new RegExp(
        `${templateId}:[\\s\\S]*assets/avatar/templates/${templateId}/${registryBasePath}\\.png`,
      ),
    );
    const size = readPngSize(
      join(
        process.cwd(),
        "artifacts",
        "woofwatcher-mobile",
        "assets",
        "avatar",
        "templates",
        templateId,
        "base.png",
      ),
    );
    assert.deepEqual(
      size,
      { width: 170, height: 170 },
      `${templateId} base should be a PixelLab 170x170 character base`,
    );
  }
  for (const accessoryId of shepherdAccessoryIds) {
    assert.match(
      avatarTemplateAssets,
      new RegExp(
        `"${accessoryId}":[\\s\\S]*assets/avatar/templates/shepherd/accessories/${accessoryId}\\.png`,
      ),
    );
    const size = readPngSize(
      join(
        process.cwd(),
        "artifacts",
        "woofwatcher-mobile",
        "assets",
        "avatar",
        "templates",
        "shepherd",
        "accessories",
        `${accessoryId}.png`,
      ),
    );
    assert.deepEqual(
      size,
      { width: 170, height: 170 },
      `${accessoryId} overlay should be a 170x170 transparent PNG`,
    );
  }
  for (const emoteId of shepherdEmoteIds) {
    assert.match(
      avatarTemplateAssets,
      new RegExp(
        `${emoteId}:[\\s\\S]*assets/avatar/templates/shepherd/emotes/${emoteId}\\.png`,
      ),
    );
    const size = readPngSize(
      join(
        process.cwd(),
        "artifacts",
        "woofwatcher-mobile",
        "assets",
        "avatar",
        "templates",
        "shepherd",
        "emotes",
        `${emoteId}.png`,
      ),
    );
    assert.deepEqual(
      size,
      { width: 170, height: 170 },
      `${emoteId} emote should be a 170x170 transparent PNG`,
    );
  }
  for (const [templateId, emoteIds] of Object.entries(templateEmotePacks)) {
    for (const emoteId of emoteIds) {
      assert.match(
        avatarTemplateAssets,
        new RegExp(
          `assets/avatar/templates/${templateId}/emotes/${emoteId}\\.png`,
        ),
      );
      const size = readPngSize(
        join(
          process.cwd(),
          "artifacts",
          "woofwatcher-mobile",
          "assets",
          "avatar",
          "templates",
          templateId,
          "emotes",
          `${emoteId}.png`,
        ),
      );
      assert.deepEqual(
        size,
        { width: 170, height: 170 },
        `${templateId} ${emoteId} emote should be a 170x170 transparent PNG`,
      );
    }
  }
  assert.match(avatarModel, /PetAvatarConfig/);
  assert.match(avatarModel, /AVATAR_TEMPLATES/);
  assert.match(avatarModel, /buildTemplateScanSuggestion/);
  assert.doesNotMatch(avatarModel, /buildMockScanSuggestion/);
  assert.match(avatarModel, /AVATAR_SCAN_WORKFLOW_STEPS/);
  assert.match(avatarModel, /You always approve the match/);
  assert.doesNotMatch(avatarModel, /perfectly scan/i);
  assert.match(avatarContext, /AVATAR_CONFIG_KEY/);
  assert.match(avatarContext, /saveAvatarConfig/);
  assert.match(avatarContext, /hasConfiguredAvatar/);
  assert.match(avatarContext, /storybook\/storybook-still-sit\.png/);
  assert.match(avatarContext, /storybook\/storybook-still-sleep\.png/);
  assert.doesNotMatch(avatarContext, /assets\/phoenix\/phoenix-happy\.png/);
  assert.match(home, /avatarTemplate\.label/);
  assert.match(home, /Open Avatar Studio/);
  assert.match(more, /Avatar Studio/);
  assert.doesNotMatch(more, /Portrait Studio/);
  assert.doesNotMatch(avatarStudio, /backBtn:/);
  assert.doesNotMatch(avatarStudio, /headerTitle:/);
  assert.doesNotMatch(avatarStudio, /Scan assist mock/);
  assert.doesNotMatch(avatarStudio, /True AI scanning plugs in later/);
  assert.match(avatarStudio, /PixelLab template match/);
  assert.match(avatarStudio, /Provider scanning can plug in later/);
  assert.match(avatarStudio, /buildAvatarSpriteProductionQaSummary/);
  assert.match(avatarStudio, /buildAvatarSpriteProductionTemplateReview/);
  assert.match(avatarStudio, /Sprite production review/);
  assert.match(avatarStudio, /Game-feel checks/);
  assert.match(avatarStudio, /productionTemplateReview\.nativeProofStatus/);
  assert.match(avatarStudio, /Open sprite QA cockpit/);
  assert.match(avatarStudio, /pathname: "\/care-twin-qa"/);
  assert.match(avatarStudio, /qaSurface: "avatar-sprite-production-review"/);
  assert.doesNotMatch(
    avatarStudio,
    /CARE TWIN STUDIO|templateConsoleBar|pixelFrameOverlay|templateLiveChip/,
    "Avatar Studio hero should keep one dog, one room, and one bottom truth label instead of stacked HUD overlays",
  );
  assert.match(avatarStudio, /Live PixelLab sprite rig\./);
  assert.doesNotMatch(
    avatarStudio,
    /heroPreview: \{[^\n]*(shadowOpacity|elevation)/,
  );
  assert.doesNotMatch(
    avatarStudio,
    /canvasCard: \{[^\n]*(shadowOpacity|elevation)/,
  );
});

test("keeps Avatar Studio creator actions on shared mobile touch targets", () => {
  const avatarStudio = readAppFile("portrait.tsx");

  assert.match(avatarStudio, /MOBILE_INLINE_HIT_SLOP/);
  assert.match(avatarStudio, /const selectStudioTab = \(tab: StudioTab\) =>/);
  assert.match(
    avatarStudio,
    /const setCoatColor = \(swatch: string, primary: boolean\) =>/,
  );
  assert.match(
    avatarStudio,
    /const setFaceMarking = \(marking: AvatarFaceMarkingId\) =>/,
  );
  assert.match(
    avatarStudio,
    /const previewMoodState = \(emote: AvatarEmoteState\) =>/,
  );
  assert.match(
    avatarStudio,
    /accessibilityLabel=\{`Set \$\{marking\.label\} face marking`\}/,
  );
  assert.match(
    avatarStudio,
    /accessibilityHint="Double tap to apply this marking to the pixel twin\."/,
  );
  assert.match(avatarStudio, /accessibilityLabel="Reset Avatar Studio draft"/);
  assert.match(avatarStudio, /accessibilityLabel="Save Avatar Studio draft"/);
  assert.match(
    avatarStudio,
    /accessibilityHint="Saves the current pixel twin configuration locally\."/,
  );
  assert.match(
    avatarStudio,
    /onPress=\{\(\) => setCoatColor\(swatch, primary\)\}/,
  );
  assert.match(
    avatarStudio,
    /onPress=\{\(\) => setFaceMarking\(marking\.id\)\}/,
  );
  assert.match(avatarStudio, /onPress=\{\(\) => previewMoodState\(emote\)\}/);

  for (const styleName of [
    "tab",
    "secondaryBtn",
    "primaryBtn",
    "swatch",
    "optionPill",
    "moodChip",
    "productionQaButton",
  ]) {
    assertStyleUsesSharedTouchTarget(avatarStudio, styleName);
  }

  for (const styleName of ["templateTile", "accessoryTile"]) {
    assertStyleReferencesSharedTouchTarget(avatarStudio, styleName);
  }
});

test("documents PixelLab as the secure Phoenix asset production path", () => {
  const packageJson = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "package.json"),
    "utf8",
  );
  const pixelLab = readFileSync(
    join(process.cwd(), "docs", "design", "PIXELLAB_ASSET_PRODUCTION.md"),
    "utf8",
  );
  const phaseOne = readFileSync(
    join(
      process.cwd(),
      "docs",
      "design",
      "pixellab",
      "PHASE_1_PHOENIX_IDENTITY_PROMPT.md",
    ),
    "utf8",
  );
  const verifier = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "scripts",
      "verify-pixellab-assets.js",
    ),
    "utf8",
  );
  const blockers = readFileSync(
    join(process.cwd(), "docs", "BLOCKERS_FOR_APOLLO.md"),
    "utf8",
  );

  assert.match(packageJson, /verify:pixellab-assets/);
  assert.match(pixelLab, /PixelLab is the WoofWatcher production asset path/);
  assert.match(pixelLab, /Never commit that config file/);
  assert.match(pixelLab, /Do not call PixelLab from the mobile client/);
  assert.match(
    phaseOne,
    /Create no more than four Phoenix main-avatar identity candidates/,
  );
  assert.match(phaseOne, /transparent background/);
  assert.match(verifier, /PixelLab asset check complete/);
  assert.match(verifier, /readUInt32BE\(16\)/);
  assert.match(verifier, /templateAccessories/);
  assert.match(verifier, /templateEmotes/);
  assert.match(blockers, /PixelLab secret hygiene/);
  assert.match(
    blockers,
    /Phoenix v2 seed\/state pack, full registered sprite manifest, active Option B dogless day room, PixelLab final-candidate night\/bedtime\/health-watch\/home-alone rooms, the full current Option B hard-pixel Phoenix runtime candidate family/,
  );
  assert.match(
    blockers,
    /12 Avatar Studio template preview thumbnails, the full 12-template base still pack, the first shepherd accessory overlay PNG pack, the first shepherd 10-state emote still pack, and the Retriever, Husky\/Spitz, and Bully 10-state template emote packs now exist locally/,
  );
  assert.doesNotMatch(pixelLab, /Bearer [0-9a-f-]{20,}/i);
});

test("keeps Setup onboarding on shared board anatomy", () => {
  const setup = readAppFile("setup.tsx");

  assert.match(setup, /@\/components\/board\/BoardPrimitives/);
  assert.match(
    setup,
    /import \{ BoardCard, BoardPill, BoardRouteHeader, BoardSectionHeader \}/,
  );
  assert.doesNotMatch(setup, /<BoardSectionHeader[\s\S]*?\saction=/);
  assert.match(setup, /<BoardRouteHeader[\s\S]*title="Set up WoofWatcher"/);
  assert.match(
    setup,
    /<BoardCard style=\{s\.progressCard\}[\s\S]*BoardSectionHeader[\s\S]*title="Setup progress"/,
  );
  assert.match(
    setup,
    /BoardSectionHeader\s+title="Setup progress"[\s\S]*<BoardPill\s+label=\{`\$\{onboarding\.completedCount\}\/\$\{onboarding\.totalCount\} ready`\}/,
  );
  assert.match(
    setup,
    /BoardSectionHeader\s+title="After save"[\s\S]*<BoardPill\s+label="Review"/,
  );
  assert.match(setup, /function Section[\s\S]*<BoardCard style=\{s\.section\}/);
  assert.match(setup, /Dog profile/);
  assert.match(setup, /Diet baseline/);
  assert.match(setup, /Starter routine/);
  assert.match(setup, /Household path/);
  assert.match(setup, /Household caregiver/);
  assert.match(setup, /Create household/);
  assert.match(setup, /Join by invite/);
  assert.match(setup, /Local preview/);
  assert.match(setup, /buildSetupWizardConfirmation/);
  assert.match(setup, /Care foundation saved/);
  assert.match(setup, /Add invite code/);
  assert.match(setup, /openAuthSetupProofMission/);
  assert.match(setup, /\/care-twin-qa\?qaSurface=auth-setup-onboarding-proof/);
  assert.match(setup, /Open setup proof/);
  assert.match(setup, /accessibilityLabel="Open auth and setup proof mission"/);
  assert.match(setup, /buildAuthSetupProofManifest/);
  assert.match(setup, /state\.launchProviderProfile\.authSetupProofEvidence/);
  assert.match(setup, /const authSetupProofManifest = buildAuthSetupProofManifest\(state\.launchProviderProfile\.authSetupProofEvidence \?\? undefined\)/);
  assert.match(setup, /Auth\/Setup proof manifest/);
  assert.match(setup, /authSetupProofManifest\.rows\.map/);
  assert.match(setup, /authSetupProofManifest\.blockers\.map/);
  assert.match(setup, /Native proof blocked/);
  assert.doesNotMatch(setup, /header:/);
  assert.doesNotMatch(
    setup,
    /progressCard: \{[^\n]*(borderRadius|borderWidth|padding)/,
  );
  assert.doesNotMatch(setup, /backgroundColor: colors\.card/);
});

test("does not keep hidden legacy headers behind board route headers", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));
  const avatarStudio = readAppFile("portrait.tsx");

  assert.doesNotMatch(more, /display: "none"/);
  assert.doesNotMatch(avatarStudio, /display: "none"/);
  assert.equal((more.match(/<BoardRouteHeader/g) ?? []).length, 1);
  assert.equal((avatarStudio.match(/<BoardRouteHeader/g) ?? []).length, 1);
});

test("keeps Records report history wired for printable Care Pass artifacts", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));
  const careTwinQaRoute = readAppFile("care-twin-qa.tsx");

  assert.match(records, /getCarePassArtifactPrintView/);
  assert.match(records, /describeCarePassArtifactExport/);
  assert.match(records, /buildReportBinaryExportProofManifest/);
  assert.match(records, /deriveLaunchProviderSetup/);
  assert.match(careTwinQaRoute, /useCare/);
  assert.match(careTwinQaRoute, /deriveLaunchProviderSetup/);
  assert.match(
    careTwinQaRoute,
    /const launchProviderSetupPlan = useMemo\(\s*\(\) => deriveLaunchProviderSetup\(state\.launchProviderProfile\),\s*\[state\.launchProviderProfile\],\s*\)/,
  );
  assert.match(
    careTwinQaRoute,
    /storageProviderConfigured: launchProviderSetupPlan\.providerInput\.storageProviderConfigured/,
  );
  assert.match(
    careTwinQaRoute,
    /providerStorageEvidence:\s*savedProof\.providerStorageEvidence/,
  );
  assert.match(
    careTwinQaRoute,
    /launchProviderSetupPlan\.providerInput\.storageProviderEvidence\s*\?\s*\[launchProviderSetupPlan\.providerInput\.storageProviderEvidence\]\s*:\s*\[\]/,
  );
  assert.match(records, /import \* as FileSystem from "expo-file-system\/legacy"/);
  assert.match(records, /buildReportArtifactExportFilePlan/);
  assert.match(records, /buildReportArtifactShareContent/);
  assert.match(records, /buildCarePassPdfArtifactSource/);
  assert.match(records, /buildGeneratedBinaryArtifactFilePlan/);
  assert.match(records, /buildGeneratedBinaryArtifactShareContent/);
  assert.match(records, /FileSystem\.makeDirectoryAsync/);
  assert.match(records, /FileSystem\.writeAsStringAsync/);
  assert.match(records, /FileSystem\.EncodingType\.Base64/);
  assert.match(records, /FileSystem\.getContentUriAsync/);
  assert.match(records, /const storage = exportView\.storage/);
  assert.doesNotMatch(
    records,
    /storageProviderConfigured: Boolean\(state\.launchProviderProfile\?\.storageProviderConfigured\)/,
  );
  assert.match(
    records,
    /storageProviderConfigured: launchProviderSetupPlan\.providerInput\.storageProviderConfigured/,
  );
  assert.match(records, /storageProviderEvidence: launchProviderSetupPlan\.providerInput\.storageProviderEvidence/);
  assert.match(
    records,
    /providerStorageEvidence:\s*launchProviderSetupPlan\.providerInput\.storageProviderEvidence\s*\?\s*\[launchProviderSetupPlan\.providerInput\.storageProviderEvidence\]\s*:\s*\[\]/,
  );
  assert.match(records, /exportView\.formatLabel/);
  assert.match(records, /local file - PDF pending/);
  assert.match(records, /exportView\.pdfDetail/);
  assert.match(records, /Export manifest/);
  assert.match(records, /exportView\.manifestRows\.map/);
  assert.match(records, /Binary proof manifest/);
  assert.match(records, /const binaryProofManifest = buildReportBinaryExportProofManifest/);
  assert.match(records, /carePassHtmlFileName: exportView\.fileName/);
  assert.match(records, /dogIdSvgFileName: credentialImageView\.fileName/);
  assert.match(records, /generatedCarePassPdf:/);
  assert.match(records, /generatedDogIdPng:/);
  assert.match(records, /storageProviderConfigured: launchProviderSetupPlan\.providerInput\.storageProviderConfigured/);
  assert.match(records, /binaryProofManifest\.rows\.map/);
  assert.match(records, /binaryProofManifest\.blockers\.map/);
  assert.match(records, /artifactManifestGrid/);
  assert.match(records, /artifactManifestCell/);
  assert.match(records, /sharePrintableReportArtifact/);
  assert.match(records, /shareGeneratedCarePassPdfArtifact/);
  assert.match(records, /shareGeneratedBinaryArtifactFile/);
  assert.match(records, /openReportBinaryExportProofMission/);
  assert.match(records, /report-binary-export-proof/);
  assert.match(records, /Print-ready/);
  assert.match(records, /storage\.label/);
  assert.match(records, /storage\.detail/);
  assert.match(
    records,
    /accessibilityLabel=\{`Resend \$\{artifact\.title\}`\}/,
  );
  assert.match(
    records,
    /accessibilityLabel=\{`Share local printable report source file for \$\{artifact\.title\}`\}/,
  );
  assert.match(
    records,
    /accessibilityLabel=\{`Share generated Care Pass PDF for \$\{artifact\.title\}`\}/,
  );
  assert.match(
    records,
    /accessibilityLabel=\{`Open report binary export proof mission for \$\{artifact\.title\}`\}/,
  );
});

test("keeps Records dog ID wired for printable credential sharing", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /getPetCredentialPrintView/);
  assert.match(records, /getPetCredentialImageView/);
  assert.match(records, /buildDogIdPngArtifactSource/);
  assert.match(records, /sharePrintableCredential/);
  assert.match(records, /shareCredentialImageSource/);
  assert.match(records, /shareCredentialPngArtifact/);
  assert.match(records, /directoryName: "WoofWatcherCredentials"/);
  assert.match(records, /printableLabel: "Dog ID credential source"/);
  assert.match(records, /printableLabel: "Dog ID SVG image source"/);
  assert.match(records, /FileSystem\.writeAsStringAsync/);
  assert.match(records, /FileSystem\.EncodingType\.Base64/);
  assert.match(records, /accessibilityLabel="Share dog ID card"/);
  assert.match(records, /accessibilityLabel="Share local printable Dog ID source file"/);
  assert.match(records, /accessibilityLabel="Share local SVG Dog ID image source"/);
  assert.match(records, /accessibilityLabel="Share generated Dog ID PNG"/);
});

test("keeps Records organized around a vault command hierarchy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /interface RecordsCommandItem/);
  assert.match(records, /const recordsCommandItems: RecordsCommandItem\[\] = \[/);
  assert.match(records, /Vault Command/);
  assert.match(records, /Dog ID/);
  assert.match(records, /Record vault/);
  assert.match(records, /Care Pass/);
  assert.match(records, /Reports/);
  assert.match(records, /Records file handoff/);
  assert.match(records, /records-local-file-handoff/);
  assert.match(records, /openRecordsFileProofMission/);
  assert.match(records, /onPress: shareCredential/);
  assert.match(records, /onPress: \(\) => openRecordForm\("document"\)/);
  assert.match(records, /onPress: \(\) => openCarePassPreview\("vet"\)/);
  assert.match(records, /onPress: shareReport/);
  assert.match(records, /onPress: openRecordsFileProofMission/);
  assert.match(records, /style=\{s\.recordsCommandCard\}/);
  assert.match(records, /s\.recordsCommandRow/);
  assert.match(records, /accessibilityLabel=\{`\$\{item\.label\}\. \$\{item\.detail\}\. \$\{item\.actionLabel\}`\}/);
  // Vault readiness has exactly one source: filed-section coverage feeds
  // both the stage HUD and the Vault Command pill from the same variable,
  // and the Dog ID row is worded as "N of 7 ID fields" so it can never read
  // as a second, contradicting vault percent (the retired blended 65/35
  // score showed "Vault 5%" beside "14% ready").
  assert.match(
    records,
    /ID fields ready for sitter, vet, and emergency handoff/,
  );
  assert.doesNotMatch(records, /credentialReadinessPercent/);
  assert.doesNotMatch(records, /\* 0\.65 \+/);
});

test("keeps Records Care Pass and reports on shared board card anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Care Pass"/,
  );
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Report History"/,
  );
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Progress Report"/,
  );
});

test("keeps Records and Care Pass actions on shared mobile touch targets", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  for (const styleName of [
    "shareInline",
    "medSearchClear",
    "medFilterPill",
    "carePassRow",
    "artifactIconButton",
    "segPill",
    "deleteRecordBtn",
    "emptyAddBtn",
    "recordTypePill",
    "attachmentBtn",
    "sheetCancel",
    "sheetSave",
  ]) {
    assertStyleUsesSharedTouchTarget(records, styleName);
  }
});

test("keeps Records vault, diet, and cabinet on shared board card anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Record Vault"/,
  );
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Diet on File"/,
  );
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Records Cabinet"/,
  );
});

test("keeps Records trend sections on shared board card anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Care Trends"/,
  );
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Weight Trend"/,
  );
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Mood Trend"/,
  );
  assert.match(records, /deriveMoodTrend/);
  assert.match(records, /moodStats\.averageScore/);
  assert.match(records, /moodStats\.energy\.low/);
  assert.match(records, /moodStats\.latest\.context/);
  assert.match(records, /Mood steady|Worth watching/);
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Hydration"/,
  );
  // Zero-data trend sections consolidate into one tappable Baselines
  // Checklist row each (icon, label, real zero status, Log tap-through)
  // instead of a corridor of near-identical all-zero cards; each full card
  // renders only once its section has real logs in its own window.
  assert.match(records, /Baselines Checklist/);
  assert.match(records, /const baselineChecklist: BaselineChecklistRow\[\]/);
  assert.match(records, /onPress=\{\(\) => openBaselineLog\(row\.type\)\}/);
  assert.match(
    records,
    /router\.push\(`\/log\?type=\$\{type\}&detail=1&intent=\$\{Date\.now\(\)\}` as never\)/,
  );
  assert.match(records, /\{weightTrend\.totalWeighIns > 0 \|\| current > 0 \? \(/);
  assert.match(records, /\{moodStats\.total > 0 \? \(/);
  assert.match(records, /\{waterHydration\.total > 0 \? \(/);
  assert.match(records, /\{walkActivity\.total > 0 \? \(/);
  assert.match(records, /\{trainingProgress\.totalSessions > 0 \? \(/);
  assert.match(records, /\{aloneTime\.totalSessions > 0 \? \(/);
  assert.match(records, /\{groomingCare\.totalSessions > 0 \? \(/);
  assert.match(records, /\{pottyHealth\.total > 0 \? \(/);
});

test("keeps Records section status labels as badges instead of passive actions", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(
    records,
    /import \{ BoardCard, BoardPill, BoardRouteHeader, BoardSectionHeader \}/,
  );
  assert.doesNotMatch(records, /<BoardSectionHeader[\s\S]*?\saction=/);
  assert.match(
    records,
    /BoardSectionHeader\s+title="Care Trends"[\s\S]*<BoardPill\s+label="7 days"/,
  );
  assert.match(
    records,
    /BoardSectionHeader[\s\S]*title="Weight Trend"[\s\S]*<BoardPill\s+label=\{remaining > 0 \?/,
  );
  assert.match(
    records,
    /BoardSectionHeader\s+title="Mood Trend"[\s\S]*<BoardPill\s+label=\{moodStats\.total > 0 \?/,
  );
  assert.match(
    records,
    /BoardSectionHeader\s+title="Hydration"[\s\S]*<BoardPill\s+label=\{waterHydration\.total \?/,
  );
  assert.match(
    records,
    /BoardSectionHeader\s+title="Care Pass"[\s\S]*<BoardPill\s+label="Preview"/,
  );
  assert.match(
    records,
    /BoardSectionHeader\s+title="Records Cabinet"[\s\S]*<BoardPill\s+label=\{`\$\{recordVault\.total\} saved`\}/,
  );
});

test("keeps Records dog ID heading on shared board section anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  // The heading stays short and static ("ID Card") so the four inline share
  // actions never clip it; the resolved pet name renders on the card itself.
  assert.match(
    records,
    /<BoardSectionHeader[\s\S]*title="ID Card"/,
  );
  assert.match(
    records,
    /<BoardCard tone="navy" padded=\{false\} style=\{s\.idCard\}/,
  );
});

test("keeps Records activity and potty sections on shared board card anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Walk Activity"/,
  );
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Training Progress"/,
  );
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Potty Health"/,
  );
});

test("keeps Records watch, grooming, and medication sections on shared board card anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Alone Time"/,
  );
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Grooming Care"/,
  );
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Incident Watch"/,
  );
  assert.match(
    records,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Medication Plan"/,
  );
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

test("keeps Records medication history searchable and filterable", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /medicationSearch/);
  assert.match(records, /medicationOutcomeFilter/);
  assert.match(records, /Search meds, dose, caregiver/);
  assert.match(records, /outcome: medicationOutcomeFilter/);
  assert.match(records, /medicationHistory\.summary/);
  assert.match(records, /medicationHistory\.emptyMessage/);
});

test("keeps hydration visible from Home quick log to Records", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(home, /type: "water"/);
  assert.match(home, /label: "Water"/);
  assert.match(home, /buildQuickLogEntry/);
  assert.match(home, /getQuickLogPolicy/);
  assert.match(home, /label: "Potty"/);
  assert.doesNotMatch(home, /\{ key: "pee"/);
  assert.match(records, /deriveWaterHydration/);
  assert.match(records, /waterHydration/);
  assert.match(records, /Hydration/);
  assert.match(records, /Bowl refills/);
});

test("keeps walk activity insights visible in Records", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const home = readAppFile(join("(tabs)", "index.tsx"));

  assert.match(records, /deriveWalkActivity/);
  assert.match(records, /deriveWalkRouteTemplates/);
  assert.match(records, /walkActivity/);
  assert.match(records, /walkRouteTemplates/);
  assert.match(records, /Walk Activity/);
  assert.match(records, /Saved Routes/);
  assert.match(records, /suggestedUse/);
  assert.match(records, /dog interactions/);
  assert.match(log, /walkRouteName/);
  assert.match(log, /walkSocialOutcome/);
  assert.match(log, /routeName/);
  assert.match(log, /dogInteractions/);
  assert.match(log, /buildWalkSessionStartEntry/);
  assert.match(log, /buildWalkSessionFinishPatch/);
  assert.match(log, /findOpenWalkSession/);
  assert.match(log, /WALK ACTIVE/);
  assert.match(log, /Finish walk/);
  assert.match(home, /buildWalkSessionStartEntry/);
  assert.match(home, /findOpenWalkSession/);
  assert.match(home, /Walk active/);
  assert.match(home, /Walk started/);
});

test("keeps weekly care trends visible in Records", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /deriveCareTrends/);
  assert.match(records, /careTrends/);
  assert.match(records, /Care Trends/);
  assert.match(records, /trendSignals/);
  assert.match(records, /walkMinutes/);
  assert.match(records, /mealCompletion/);
  assert.match(records, /mealPendingOutcomes/);
  assert.match(records, /careTrends\.current\.meals\.pending/);
  assert.match(records, /Meal open/);
});

test("keeps training progress visible from Log composer to Records", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(log, /type: "training"/);
  assert.match(log, /trainingOutcome/);
  assert.match(log, /trainingSkill/);
  assert.match(log, /nextPractice/);
  assert.match(records, /deriveTrainingProgress/);
  assert.match(records, /trainingProgress/);
  assert.match(records, /Training Progress/);
  assert.match(records, /focusSkills/);
  assert.match(records, /winCount/);
});

test("keeps alone-time anxiety tracking visible from Log composer to Records", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(log, /type: "alone"/);
  assert.match(log, /aloneOutcome/);
  assert.match(log, /aloneTrigger/);
  assert.match(log, /calmingSupport/);
  assert.match(log, /recoveryMinutes/);
  assert.match(records, /deriveAloneTime/);
  assert.match(records, /aloneTime/);
  assert.match(records, /Alone Time/);
  assert.match(records, /anxiousCount/);
  assert.match(records, /distressedCount/);
});

test("keeps Alone Time as a start and return lifecycle instead of a loose duration log", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const home = readAppFile(join("(tabs)", "index.tsx"));

  assert.match(log, /buildAloneTimeStartEntry/);
  assert.match(log, /buildAloneTimeReturnPatch/);
  assert.match(log, /findOpenAloneTimeSession/);
  assert.match(log, /getAloneTimeReturnOptions/);
  assert.match(log, /handleLeavingHome/);
  assert.match(log, /handleReturnHome/);
  assert.match(log, /I\u2019m Home|I'm Home/);
  assert.match(log, /Return check-in/);
  assert.match(home, /findOpenAloneTimeSession/);
  assert.match(home, /home-alone/);
  assert.match(home, /Home alone/);
});

test("keeps weight trend shared between Records and Care Pass reports", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));
  const carePass = readFileSync(
    join(process.cwd(), "lib", "care-domain", "src", "care-pass.ts"),
    "utf8",
  );

  assert.match(records, /deriveWeightTrend/);
  assert.match(records, /weightTrend/);
  assert.match(records, /Weight Trend/);
  assert.match(carePass, /deriveWeightTrend/);
  assert.match(carePass, /Weight Trend/);
});

test("keeps grooming care visible from Log composer to Records and Care Pass reports", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const records = readAppFile(join("(tabs)", "records.tsx"));
  const carePass = readFileSync(
    join(process.cwd(), "lib", "care-domain", "src", "care-pass.ts"),
    "utf8",
  );

  assert.match(log, /type: "grooming"/);
  assert.match(log, /groomingCondition/);
  assert.match(log, /groomingProducts/);
  assert.match(log, /groomingNextDue/);
  assert.match(log, /Shared grooming logs update Grooming Care and handoffs/);
  assert.match(records, /deriveGroomingCare/);
  assert.match(records, /groomingCare/);
  assert.match(records, /Grooming Care/);
  assert.match(records, /groomingCare\.products/);
  assert.match(carePass, /deriveGroomingCare/);
  assert.match(carePass, /Grooming Care/);
});

test("keeps Incident Watch visible from Log composer to Records and Care Pass reports", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const records = readAppFile(join("(tabs)", "records.tsx"));
  const carePass = readFileSync(
    join(process.cwd(), "lib", "care-domain", "src", "care-pass.ts"),
    "utf8",
  );

  assert.match(log, /type: "incident"/);
  assert.match(log, /incidentType/);
  assert.match(log, /incidentTrigger/);
  assert.match(log, /incidentExposure/);
  assert.match(log, /incidentInjury/);
  assert.match(log, /incidentAction/);
  assert.match(log, /incidentFollowUp/);
  assert.match(
    log,
    /Shared incident logs update Incident Watch, Care Pass, and trainer handoffs/,
  );
  assert.match(records, /deriveIncidentWatch/);
  assert.match(records, /incidentWatch/);
  assert.match(records, /Incident Watch/);
  assert.match(records, /Trend signal/);
  assert.match(records, /Follow-up plan/);
  assert.match(records, /Trainer goals/);
  assert.match(records, /Open Incident Watch follow-up/);
  assert.match(records, /incidentWatch\.latest\?\.id/);
  assert.match(
    records,
    /router\.push\(`\/log\?entry=\$\{encodeURIComponent\(incidentWatch\.latest\.id\)\}` as never\)/,
  );
  assert.match(
    records,
    /router\.push\(`\/log\?type=incident&detail=1&intent=\$\{Date\.now\(\)\}` as never\)/,
  );
  assert.doesNotMatch(records, /params: \{ type: "incident" \}/);
  assert.match(records, /Incident Watch keeps factual household context/);
  assert.match(carePass, /deriveIncidentWatch/);
  assert.match(carePass, /Incident Watch/);
  assert.match(carePass, /Owner follow-ups/);
  assert.match(carePass, /Trainer goal ideas/);
  assert.match(carePass, /does not diagnose behavior or medical issues/);
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
  assert.match(log, /buildPottyLogDetailPatch/);
  assert.match(log, /POTTY_DETAIL_OUTCOMES/);
  assert.match(log, /Clarify potty log/);
  assert.match(log, /Save potty details/);
  assert.match(log, /updatePottyDetailFromDetail/);
  assert.match(records, /derivePottyHealth/);
  assert.match(records, /pottyHealth/);
  assert.match(records, /pottyHealth\.stoolColors/);
  assert.match(records, /pottyHealth\.contexts/);
  assert.match(records, /Potty Health/);
  assert.match(records, /stool detail/);
});

test("keeps the durable sync outbox visible in care context and Log", () => {
  const careContext = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "context",
      "CareContext.tsx",
    ),
    "utf8",
  );
  const careSync = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "lib",
      "careSync.ts",
    ),
    "utf8",
  );
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(careContext, /deriveCareSyncOutbox/);
  assert.match(careContext, /buildCareEntryRefreshPlan/);
  assert.match(careContext, /hasUpdatedAtCursor:\s*false/);
  assert.match(careContext, /hasDeleteTombstones:\s*false/);
  assert.match(careSync, /Full care-entry refresh required/);
  assert.match(careContext, /syncOutbox/);
  assert.match(log, /syncOutbox\.message/);
  assert.match(log, /Retry sync/);
  assert.match(log, /syncOutbox\.retryable/);
});

test("keeps care log audit trails wired into Log edit, sticky note, delete, and detail flows", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(log, /appendCareAuditEvent/);
  assert.match(log, /buildCareLogDeletionAuditEntry/);
  assert.match(log, /getCareAuditTrail/);
  assert.match(log, /detailAuditTrail/);
  assert.match(log, /detailAuditSummary/);
  assert.match(log, /Correction history/);
  assert.match(log, /Latest update/);
  assert.match(log, /correctionChip/);
  assert.match(log, /Audit trail/);
  assert.match(log, /updateMealOutcomeFromDetail/);
  assert.match(log, /Ate all/);
  assert.match(log, /Ate most/);
  assert.match(log, /Refused/);
  assert.match(log, /Still grazing/);
  assert.match(log, /sticky-note-added/);
  assert.match(log, /updated/);
  assert.match(log, /Delete failed/);
});

test("keeps care log trust review wired into Log detail flows", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(log, /ImagePicker/);
  assert.match(log, /buildCareLogPhotoProofAttachmentPatch/);
  assert.match(log, /buildCareLogTrustReviewPatch/);
  assert.match(log, /buildCareLogTrustDefaults/);
  assert.match(log, /getCareLogAttentionChips/);
  assert.match(log, /getCareLogTrustReview/);
  assert.match(log, /detailTrustReview/);
  assert.match(log, /entryAttentionChips/);
  assert.match(log, /handleAttachProof/);
  assert.match(log, /handleTrustReview/);
  assert.match(log, /Trust review/);
  assert.match(log, /Attach proof photo/);
  assert.match(log, /Local-only proof saved/);
  assert.match(log, /Confirm/);
  assert.match(log, /Reject/);
  assert.match(log, /Request photo/);
  assert.match(log, /Mark corrected/);
  assert.match(log, /Proof needed/);
  assert.match(log, /Proof attached/);
  assert.match(log, /Needs review/);
});

test("keeps household sync health visible from More", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));

  assert.match(more, /deriveCareSyncDashboard/);
  assert.match(more, /syncDashboard/);
  assert.match(more, /Sync Health/);
  assert.match(more, /syncDashboard\.metrics/);
  assert.match(more, /openCareEntryProviderSyncProofMission/);
  assert.match(more, /care-entry-provider-sync-proof/);
  assert.match(more, /Open sync proof/);
  assert.match(more, /accessibilityLabel="Open care-entry provider sync proof mission"/);
  assert.match(more, /accessibilityLabel="Refresh household sync"/);
});

test("keeps household responsibility visible in Calendar and More", () => {
  const calendar = readAppFile(join("(tabs)", "calendar.tsx"));
  const more = readAppFile(join("(tabs)", "more.tsx"));

  assert.match(calendar, /deriveHouseholdResponsibility/);
  assert.match(calendar, /householdResponsibility/);
  assert.match(calendar, /Household Responsibility/);
  assert.match(calendar, /responsibility\.nextStep/);
  assert.match(more, /deriveHouseholdResponsibility/);
  assert.match(more, /householdResponsibility/);
  assert.match(more, /Responsibility Center/);
  assert.match(more, /Open routine board/);
});

test("keeps Reminder Center visible in Calendar before push notifications are enabled", () => {
  const calendar = readAppFile(join("(tabs)", "calendar.tsx"));

  assert.match(calendar, /deriveCareReminderCenter/);
  assert.match(calendar, /careReminderCenter/);
  assert.match(calendar, /Reminder Center/);
  assert.match(calendar, /notificationReadiness/);
  assert.match(calendar, /notificationPreferenceSummary/);
  assert.match(calendar, /notificationQuietHours/);
  assert.match(calendar, /notificationOptOut/);
  assert.match(calendar, /buildReminderNotificationPreferencesForCenter/);
  assert.match(calendar, /reminderNotificationPreferences/);
  assert.match(calendar, /saveReminderNotificationPreferences/);
  assert.match(calendar, /Save quiet hours/);
  assert.match(calendar, /Opt out/);
  assert.match(calendar, /Allow future reminders/);
  assert.match(calendar, /openPushNotificationProofMission/);
  assert.match(calendar, /push-notifications-proof/);
  assert.match(calendar, /Open push proof/);
  assert.match(calendar, /accessibilityLabel="Open push notifications proof mission"/);
  assert.match(calendar, /reminderCount/);
});

test("routes Reminder Center rows to concrete care workflows", () => {
  const calendar = readAppFile(join("(tabs)", "calendar.tsx"));
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(calendar, /openReminderAction/);
  assert.match(calendar, /openReminderLogDetailRoute/);
  assert.match(calendar, /openBoardRoutine\(routine\)/);
  assert.match(calendar, /router\.push\("\/records"\)/);
  assert.match(
    calendar,
    /router\.push\(`\/log\?type=\$\{encodeURIComponent\(type\)\}&detail=1&intent=\$\{Date\.now\(\)\}` as never\)/,
  );
  assert.match(calendar, /openReminderLogDetailRoute\("medication"\)/);
  assert.match(calendar, /openReminderLogDetailRoute\("grooming"\)/);
  assert.match(
    calendar,
    /accessibilityLabel=\{`Open reminder action: \$\{item\.label\}`\}/,
  );
  assert.match(log, /useLocalSearchParams/);
  assert.match(log, /routeSelectedType/);
});

test("keeps Plans routine quick logging recoverable and editable", () => {
  const calendar = readAppFile(join("(tabs)", "calendar.tsx"));

  assert.match(
    calendar,
    /\{ state, updateCareDoc, addEntry, deleteEntry \} = useCare\(\)/,
  );
  assert.match(calendar, /const id = addEntry\(\{/);
  assert.match(
    calendar,
    /showRoutineFeedback\(\{ id, title: routine\.label, type \}\)/,
  );
  assert.match(calendar, /deleteEntry\(routineFeedback\.id\)/);
  assert.match(
    calendar,
    /router\.push\(`\/log\?entry=\$\{encodeURIComponent\(entryId\)\}` as never\)/,
  );
  assert.match(
    calendar,
    /accessibilityLabel=\{`Undo \$\{routineFeedback\.title\} routine log`\}/,
  );
  assert.match(
    calendar,
    /accessibilityLabel=\{`Add details to \$\{routineFeedback\.title\} routine log`\}/,
  );
  assert.match(calendar, /routineFeedback\.title\} logged/);
  assert.match(calendar, />\s*Add details\s*</);
});

test("keeps Plans reminder and routine sections on shared board card anatomy", () => {
  const calendar = readAppFile(join("(tabs)", "calendar.tsx"));

  assert.match(
    calendar,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Reminder Center"/,
  );
  assert.match(
    calendar,
    /BoardSectionHeader\s+title="Reminder Center"[\s\S]*<BoardPill\s+label=\{reminderCount === 0 \? "Clear" : `\$\{reminderCount\} active`\}/,
  );
  assert.match(
    calendar,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Daily Routine"/,
  );
  assert.doesNotMatch(calendar, /sectionHeader:/);
  assert.doesNotMatch(calendar, /sectionTitle:/);
  assert.doesNotMatch(calendar, /emptyCard:/);
  assert.doesNotMatch(calendar, /reminderCard:/);
});

test("keeps Plans schedule rooted in a live pixel command stage", () => {
  const calendar = readAppFile(join("(tabs)", "calendar.tsx"));

  assert.match(calendar, /ImageBackground/);
  assert.match(calendar, /PLANS_COMMAND_STAGE_ROOM/);
  assert.match(calendar, /phoenix-room-day-banner\.png/);
  assert.match(calendar, /SpriteSheetPlayer/);
  assert.match(calendar, /getCareTwinSpriteAsset\("idle-breathe"\)/);
  assert.match(calendar, /CARE_TWIN_SPRITE_MANIFEST\["idle-breathe"\]/);
  assert.match(calendar, /pixelImageStyle/);
  assert.match(calendar, /Plans Command Deck/);
});

test("keeps Plans organized around a mission-first mobile hierarchy", () => {
  const calendar = readAppFile(join("(tabs)", "calendar.tsx"));

  assert.match(calendar, /interface PlanMissionRow/);
  assert.match(calendar, /const planMissionRows: PlanMissionRow\[\] = \[\]/);
  assert.match(calendar, /nextScheduleRoutine/);
  assert.match(calendar, /careReminderCenter\.items\[0\]/);
  assert.match(calendar, /responsibility\.nextStep/);
  assert.match(calendar, /Today's Missions/);
  assert.match(calendar, /Mission Schedule/);
  assert.match(calendar, /planMissionBoard/);
  assert.match(calendar, /planMissionAction/);
  assert.match(calendar, /router\.push\("\/more" as never\)/);
  assert.ok(
    calendar.indexOf("Mission Schedule") < calendar.indexOf("Today's Missions"),
    "Plans should put the actionable schedule before secondary mission context",
  );
  assert.match(
    getStyleBlock(calendar, "commandDeckStage"),
    /minHeight:\s*146/,
    "Plans command stage should stay compact enough for schedule-first mobile use",
  );
  assert.match(
    getStyleBlock(calendar, "planMissionRow"),
    /minHeight:\s*58/,
    "Plans mission rows should stay compact after the schedule moves up",
  );
});

test("keeps Records rooted in a live pixel credential stage", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /ImageBackground/);
  assert.match(records, /RECORDS_CREDENTIAL_STAGE_ROOM/);
  assert.match(records, /phoenix-room-day-pixellab-400x300\.png/);
  // The stage is time-aware in lockstep with Home's immersive room: same
  // clock rule, night sibling of the same 4:3 room.
  assert.match(records, /RECORDS_CREDENTIAL_STAGE_ROOM_NIGHT/);
  assert.match(records, /phoenix-room-night\.png/);
  assert.match(records, /homeImmersiveRoomIsNight\(new Date\(now\)\.getHours\(\)\)/);
  assert.match(records, /SpriteSheetPlayer/);
  assert.match(records, /getCareTwinSpriteAsset\("tail-wag"\)/);
  assert.match(records, /CARE_TWIN_SPRITE_MANIFEST\["tail-wag"\]/);
  assert.match(records, /pixelImageStyle/);
  assert.match(
    records,
    /resizeMode="stretch"/,
    "Records should frame the full pixel room instead of cropping into an oversized background detail",
  );
  assert.match(records, /Records Command Vault/);
  assert.match(records, /recordsCredentialDock/);
  assert.match(
    getStyleBlock(records, "recordsCredentialStage"),
    /minHeight:\s*190/,
    "Records stage should stay compact on the first phone viewport",
  );
  assert.doesNotMatch(
    getStyleBlock(records, "recordsCredentialIdPlate"),
    /position:\s*"absolute"/,
    "Dog ID should sit in a dock instead of overlapping the pixel room",
  );
  assert.doesNotMatch(
    getStyleBlock(records, "recordsCredentialHud"),
    /position:\s*"absolute"/,
    "Records HUD should sit in a dock instead of overlapping the pixel room",
  );
  assert.match(
    records,
    /recordsCredentialIdPlate,\s*\{\s*backgroundColor:\s*colors\.ivory,\s*borderColor:\s*colors\.brandNavy\s*\+\s*"22"/,
    "the fixed-light Dog ID plate must keep a visible dark border in dark mode",
  );
});

test("keeps the fixed-light WoofGuide safety boundary visible in dark mode", () => {
  const woofGuide = readAppFile("woofguide.tsx");

  assert.match(woofGuide, /Not veterinary advice/);
  assert.match(woofGuide, /Drafts stay owner-reviewed/);
  assert.match(
    woofGuide,
    /guideBoundaryCard,\s*\{\s*backgroundColor:\s*colors\.ivory\s*\+\s*"E8",\s*borderColor:\s*colors\.brandNavy\s*\+\s*"55"/,
    "the fixed-light WoofGuide safety card must keep a visible dark border in dark mode",
  );
  assert.doesNotMatch(
    woofGuide,
    /guideBoundaryCard,\s*\{\s*backgroundColor:\s*colors\.ivory\s*\+\s*"E8",\s*borderColor:\s*colors\.ivory/,
    "an ivory border disappears against the fixed-light safety card",
  );
});

test("keeps the fixed-light premium plan boundary visible in dark mode", () => {
  const premium = readAppFile("premium.tsx");

  assert.match(
    premium,
    /premiumValuePlanCard,\s*\{\s*backgroundColor:\s*colors\.ivory\s*\+\s*"E8",\s*borderColor:\s*colors\.brandNavy\s*\+\s*"55"/,
    "the fixed-light recommended plan card must keep a visible dark border in dark mode",
  );
  assert.doesNotMatch(
    premium,
    /premiumValuePlanCard,\s*\{\s*backgroundColor:\s*colors\.ivory\s*\+\s*"E8",\s*borderColor:\s*colors\.ivory/,
    "an ivory border disappears against the fixed-light recommended plan card",
  );
});

test("keeps the fixed-light Plans command-room art bounded in dark mode", () => {
  const calendar = readAppFile(join("(tabs)", "calendar.tsx"));

  assert.match(
    calendar,
    /s\.commandDeckScene,\s*\{\s*borderColor:\s*colors\.brandNavy\s*\+\s*"33"\s*\}/,
    "the fixed-light Plans command-room thumbnail needs a constant dark boundary",
  );
  assert.doesNotMatch(
    calendar,
    /s\.commandDeckScene,\s*\{\s*borderColor:\s*colors\.border\s*\}/,
    "the adaptive border becomes too faint around the fixed-light Plans artwork",
  );
});

test("keeps More rooted in a live pixel launch command stage", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));

  assert.match(more, /ImageBackground/);
  assert.match(more, /MORE_COMMAND_STAGE_ROOM/);
  assert.match(more, /CARE_TWIN_ROOM_VARIANT_ASSETS\.night/);
  assert.match(more, /SpriteSheetPlayer/);
  assert.match(more, /getCareTwinSpriteAsset\("idle-breathe"\)/);
  assert.match(more, /CARE_TWIN_SPRITE_MANIFEST\["idle-breathe"\]/);
  assert.match(more, /pixelImageStyle/);
  assert.match(more, /Launch Command Hub/);
});

test("keeps Quick Log rooted in a live pixel composer stage", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(log, /ImageBackground/);
  assert.match(log, /LOG_COMMAND_STAGE_ROOM/);
  assert.match(log, /require\("@\/assets\/avatar\/rooms\/phoenix-room-day-banner\.png"\)/);
  assert.match(log, /SpriteSheetPlayer/);
  assert.match(log, /getCareTwinSpriteAsset\("ear-perk"\)/);
  assert.match(log, /CARE_TWIN_SPRITE_MANIFEST\["ear-perk"\]/);
  assert.match(log, /pixelImageStyle/);
  assert.match(log, /Quick Care Console/);
});

test("keeps Plans owner-preview controls on shared mobile touch targets", () => {
  const calendar = readAppFile(join("(tabs)", "calendar.tsx"));

  for (const styleName of [
    "addBtn",
    "discoverGo",
    "sugAdd",
    "scheduleTab",
    "scheduleStatus",
    "sectionAddBtn",
    "removeBtn",
    "routineDoneBtn",
    "typeChip",
    "ownerQuickChip",
    "saveBtn",
    "deleteBtn",
  ]) {
    assertStyleUsesSharedTouchTarget(calendar, styleName);
  }
});

test("keeps Log search wired across text query and type filters", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(log, /deriveCareLogSearch/);
  assert.match(log, /searchText/);
  assert.match(log, /logSearch/);
  // Short placeholder: the longer caregivers/routes copy ellipsized mid-word
  // ("...routes, med") inside the 393px search field.
  assert.match(log, /Search notes, people, meds/);
  assert.match(log, /logSearch\.summary/);
  assert.match(log, /logSearch\.emptyMessage/);
});

test("keeps household access readiness visible from More", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));

  assert.match(more, /deriveHouseholdAccessPlan/);
  assert.match(more, /householdAccess/);
  assert.match(more, /Household Access/);
  assert.match(more, /localOnlyCaregivers/);
  assert.match(more, /routineOnlyOwners/);
  assert.match(more, /accessibilityLabel="Share household invite"/);
});

test("keeps Access Pass and My Care Today operations visible from More", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));
  const careContext = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "context",
      "CareContext.tsx",
    ),
    "utf8",
  );

  assert.match(careContext, /accessPasses: AccessPass\[\]/);
  assert.match(more, /deriveAccessPassPlan/);
  assert.match(more, /buildAccessPassDraft/);
  assert.match(more, /deriveMyCareToday/);
  assert.match(more, /Access Passes/);
  assert.match(more, /Create Access Pass/);
  assert.match(more, /Share Draft Summary/);
  assert.match(more, /Provider-backed sharing is not live yet/);
  assert.match(more, /My Care Today/);
});

test("keeps Adventure Mode routed to private real-care quests and memories", () => {
  const rootLayout = readAppFile("_layout.tsx");
  const adventure = readAppFile("adventure.tsx");
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const more = readAppFile(join("(tabs)", "more.tsx"));
  const careContext = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "context",
      "CareContext.tsx",
    ),
    "utf8",
  );

  assert.match(rootLayout, /name="adventure"/);
  assert.match(careContext, /adventureMemories: AdventureMemory\[\]/);
  assert.match(home, /deriveAdventureMode/);
  assert.match(home, /adventureMode/);
  assert.match(home, /Adventure Mode/);
  assert.match(home, /router\.push\("\/adventure" as never\)/);
  assert.match(adventure, /deriveAdventureMode/);
  assert.match(adventure, /buildAdventureMemoryDraft/);
  assert.match(adventure, /buildQuickLogEntry/);
  assert.match(adventure, /buildWalkSessionStartEntry/);
  assert.match(adventure, /findOpenWalkSession/);
  assert.match(adventure, /ImageBackground/);
  assert.match(adventure, /ADVENTURE_STAGE_SCENE/);
  assert.match(adventure, /SpriteSheetPlayer/);
  assert.match(adventure, /getCareTwinSpriteAsset\("walk-loop"\)/);
  assert.match(adventure, /CARE_TWIN_SPRITE_MANIFEST\["walk-loop"\]/);
  assert.match(adventure, /pixelImageStyle/);
  assert.match(
    adventure,
    /import \{ BoardCard, BoardPill, BoardSectionHeader \}/,
  );
  assert.doesNotMatch(adventure, /<BoardSectionHeader[\s\S]*?\saction=/);
  assert.match(
    adventure,
    /BoardSectionHeader\s+title="Next quest"[\s\S]*<BoardPill\s+label=\{adventure\.status === "needs-outing" \? "Start simple" : "Ready"\}/,
  );
  assert.match(
    adventure,
    /BoardSectionHeader\s+title="Quest board"[\s\S]*<BoardPill\s+label=\{`\$\{adventure\.quests\.length\} quests`\}/,
  );
  assert.match(
    adventure,
    /BoardSectionHeader\s+title="Care proof"[\s\S]*<BoardPill\s+label=\{`\$\{adventure\.completedProof\.length\} today`\}/,
  );
  assert.match(
    adventure,
    /BoardSectionHeader\s+title="Memory shelf"[\s\S]*<BoardPill\s+label=\{adventure\.memories\.length \? "Private" : "Empty"\}/,
  );
  assert.match(adventure, /Private RPG/);
  assert.match(
    adventure,
    /const availableQuestProofEntryId = findQuestProofEntryId\(availableQuest, state\.entries, now\)/,
  );
  assert.match(adventure, /const primaryQuestActionLabel/);
  assert.match(
    adventure,
    /onPress=\{\(\) => startQuest\(availableQuest, availableQuestProofEntryId\)\}/,
  );
  assert.doesNotMatch(
    adventure,
    /onPress=\{\(\) => saveMemory\(availableQuest\)\}/,
  );
  assert.doesNotMatch(adventure, />Save Memory</);
  assert.match(
    adventure,
    /const actionLabel = quest\.status === "complete" \? "Open proof" : quest\.status === "locked" \? "Locked" : walkInProgress \? "Finish walk" : quest\.actionLabel/,
  );
  assert.doesNotMatch(
    adventure,
    /const actionLabel = quest\.status === "complete" \? "Open proof" : quest\.status === "locked" \? "Locked" : "Start quest"/,
  );
  assert.match(adventure, /Open proof/);
  assert.match(
    adventure,
    /router\.push\(`\/log\?entry=\$\{encodeURIComponent\(questFeedback\.id\)\}` as never\)/,
  );
  assert.match(
    adventure,
    /router\.push\(`\/log\?entry=\$\{encodeURIComponent\(proofEntryId\)\}` as never\)/,
  );
  assert.match(adventure, /const openProofLog = \(entryId: string\) =>/);
  assert.match(adventure, /onPress=\{\(\) => openProofLog\(proof\.entryId\)\}/);
  assert.match(
    adventure,
    /accessibilityLabel=\{`Open Adventure proof log: \$\{proof\.label\}`\}/,
  );
  assert.match(
    adventure,
    /const shareAdventureMemory = \(memory: AdventureMemory\) =>/,
  );
  assert.match(
    adventure,
    /Photos and memories stay private on this device - cloud backup isn't available yet/,
  );
  assert.match(adventure, /onPress=\{\(\) => shareAdventureMemory\(memory\)\}/);
  assert.match(
    adventure,
    /accessibilityLabel=\{`Share Adventure memory: \$\{memory\.title\}`\}/,
  );
  assert.match(
    adventure,
    /accessibilityHint="Shares a private text summary of this saved Adventure memory\."/,
  );
  assert.match(adventure, /deleteEntry\(questFeedback\.id\)/);
  assert.match(adventure, /stay on this device for now - cloud backup isn't available yet/);
  assert.match(more, /Adventure Mode/);
  assert.match(more, /router\.push\("\/adventure"( as never)?\)/);
});

test("keeps Adventure Mode actions on shared mobile touch targets", () => {
  const adventure = readAppFile("adventure.tsx");

  for (const styleName of [
    "primaryBtn",
    "secondaryBtn",
    "questActionButton",
    "questFeedbackButton",
    "proofRow",
    "memoryRow",
  ]) {
    assertStyleUsesSharedTouchTarget(adventure, styleName);
  }
});

test("keeps CareTwin roster readiness visible without fake multi-dog switching", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));
  const careContext = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "context",
      "CareContext.tsx",
    ),
    "utf8",
  );

  assert.match(careContext, /activePetId/);
  assert.match(careContext, /pets: PetProfile\[\]/);
  assert.match(more, /deriveCareTwinRoster/);
  assert.match(more, /buildCareTwinRosterDraft/);
  assert.match(more, /CareTwin Roster/);
  assert.match(more, /Add future dog/);
  assert.match(more, /stays with your current dog on this device/);
  assert.match(more, /Multi-dog switching is coming soon/);
});

test("keeps More organized around a grouped command directory", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));

  assert.match(more, /interface MoreDirectoryItem/);
  assert.match(more, /const moreDirectoryItems: MoreDirectoryItem\[\] = \[/);
  assert.match(more, /Command Directory/);
  assert.match(more, /BoardPill label=\{`\$\{moreDirectoryItems\.length\} hubs`\}/);
  assert.match(more, /Care today/);
  assert.match(more, /Household/);
  assert.match(more, /Records & passes/);
  assert.match(more, /Design QA/);
  assert.match(more, /Launch QA/);
  assert.match(more, /Route polish pass/);
  assert.match(more, /routeVisualConsistencyTarget/);
  assert.match(more, /careIntelligence\.nextAction\.label/);
  assert.match(more, /householdResponsibility\.nextStep/);
  assert.match(more, /router\.push\("\/more\?section=household" as never\)/);
  assert.match(more, /router\.push\("\/records" as never\)/);
  assert.match(
    more,
    /router\.push\(buildCareTwinQaFocusRoute\(routeVisualConsistencyTarget\) as never\)/,
  );
  assert.match(
    more,
    /router\.push\(buildCareTwinQaFocusRoute\(nativeQaPrimaryMissionTarget\) as never\)/,
  );
  assert.match(more, /style=\{s\.moreDirectoryCard\}/);
  assert.match(more, /s\.moreDirectoryRow/);
  assert.match(more, /accessibilityLabel=\{`\$\{item\.eyebrow\}: \$\{item\.label\}\. \$\{item\.detail\}`\}/);
  assert.match(more, /style=\{s\.moreRouteHeader\}/);
  assert.match(more, /\$\{petName\}'s care tools, records, household, and settings\./);
  assert.match(
    getStyleBlock(more, "moreRouteHeader"),
    /paddingHorizontal:\s*20/,
    "More route header should keep readable side padding in web preview and native frames",
  );
  assert.match(
    getStyleBlock(more, "moreCommandStage"),
    /minHeight:\s*294/,
    "More command stage should stay compact enough to reveal navigation below it",
  );
  assert.match(
    getStyleBlock(more, "moreCommandHud"),
    /position:\s*"absolute"[\s\S]*bottom:\s*70/,
    "More stage HUD should be pinned inside the scene instead of adding vertical bulk",
  );
  assert.match(
    getStyleBlock(more, "moreCommandFooter"),
    /position:\s*"absolute"[\s\S]*bottom:\s*10/,
    "More stage footer should stay inside the compact launch scene",
  );
  assert.match(
    getStyleBlock(more, "moreDirectoryRow"),
    /minHeight:\s*76[\s\S]*paddingVertical:\s*9/,
    "More command directory rows should stay dense while preserving tap targets",
  );
});

test("keeps More household, tools, and diet sections on shared board card anatomy", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));
  const launchModel = readMobileLibFile("launchReadiness.ts");
  const providerSetup = readMobileLibFile("launchProviderSetup.ts");
  const providerSyncProof = readMobileLibFile("careEntryProviderSyncProof.ts");
  const careTwinQaRoute = readAppFile("care-twin-qa.tsx");
  const careContext = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "context",
      "CareContext.tsx",
    ),
    "utf8",
  );

  assert.match(
    more,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="CareTwin Roster"/,
  );
  assert.match(
    more,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Care Team"/,
  );
  assert.match(
    more,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Household Access"/,
  );
  assert.match(
    more,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Access Passes"/,
  );
  assert.match(
    more,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="My Care Today"/,
  );
  assert.match(
    more,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Responsibility Center"/,
  );
  assert.match(
    more,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Sync Health"/,
  );
  assert.match(
    more,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Launch Readiness"/,
  );
  assert.match(more, /deriveAttachmentManifest/);
  assert.match(more, /deriveLaunchReadiness/);
  assert.match(more, /deriveSupportRunbookPlan/);
  assert.match(more, /deriveLaunchProviderSetup/);
  assert.match(more, /buildLaunchProviderSetupShareText/);
  assert.match(more, /buildReleasePacket/);
  assert.match(more, /buildReleasePacketShareText/);
  assert.match(more, /buildBetaHandoffPacketShareText/);
  assert.match(more, /buildStoreSubmissionPacket/);
  assert.match(more, /buildStoreSubmissionPacketShareText/);
  assert.match(
    more,
    /storageProviderConfigured:\s*launchProviderSetupPlan\.providerInput\.storageProviderConfigured/,
  );
  assert.match(more, /storageProviderEvidence:\s*launchProviderSetupPlan\.providerInput\.storageProviderEvidence/);
  assert.doesNotMatch(more, /deriveAttachmentManifest\([\s\S]*storageProviderConfigured:\s*false/);
  assert.match(more, /storageQueue: attachmentManifest\.launchQueue/);
  assert.match(more, /supportRunbookOwnerReviewed/);
  assert.match(
    more,
    /const supportRunbookApproved =\s*state\.launchSupportProfile\.providerStatus === "provider-approved" && launchSupportPlan\.supportRunbookApproved/,
  );
  assert.match(
    more,
    /const privacyLegalApproved =\s*state\.launchSupportProfile\.providerStatus === "provider-approved" && launchSupportPlan\.privacyLegalApproved/,
  );
  assert.match(more, /privacyLegalApproved,\s*privacyLegalOwnerReviewed/);
  assert.match(more, /supportRunbookApproved,\s*supportRunbookOwnerReviewed/);
  assert.match(more, /authConfigured:\s*Boolean\(launchProviderSetupPlan\.providerInput\.authConfigured\)/);
  assert.match(more, /authProviderProofReady:\s*Boolean\(launchProviderSetupPlan\.providerInput\.authProviderProofReady\)/);
  assert.match(more, /databaseConfigured:\s*Boolean\(launchProviderSetupPlan\.providerInput\.databaseConfigured\)/);
  assert.match(more, /databaseProviderProofReady:\s*Boolean\(launchProviderSetupPlan\.providerInput\.databaseProviderProofReady\)/);
  assert.match(more, /storageProviderConfigured:\s*Boolean\(launchProviderSetupPlan\.providerInput\.storageProviderConfigured\)/);
  assert.match(more, /storageProviderProofReady:\s*Boolean\(launchProviderSetupPlan\.providerInput\.storageProviderProofReady\)/);
  assert.match(more, /aiProviderProofReady:\s*Boolean\(launchProviderSetupPlan\.providerInput\.aiProviderProofReady\)/);
  assert.match(more, /paymentsProviderProofReady:\s*Boolean\(launchProviderSetupPlan\.providerInput\.paymentsProviderProofReady\)/);
  assert.match(more, /accountDeletionProofReady:\s*Boolean\(launchProviderSetupPlan\.providerInput\.accountDeletionProofReady\)/);
  assert.match(more, /pushNotificationsProofReady:\s*Boolean\(launchProviderSetupPlan\.providerInput\.pushNotificationsProofReady\)/);
  assert.match(more, /storeAccountsProofReady:\s*Boolean\(launchProviderSetupPlan\.providerInput\.storeAccountsProofReady\)/);
  assert.match(more, /privacyLegalProofReady/);
  assert.match(more, /supportRunbookProofReady/);
  assert.doesNotMatch(more, /authProviderProofReady:\s*false/);
  assert.doesNotMatch(more, /databaseProviderProofReady:\s*false/);
  assert.doesNotMatch(more, /storageProviderProofReady:\s*false/);
  assert.doesNotMatch(more, /privacyLegalApproved: false/);
  assert.doesNotMatch(more, /supportRunbookApproved: false/);
  assert.doesNotMatch(more, /me\.data\?\.user\?\.id && household/);
  assert.doesNotMatch(more, /household && syncDashboard\.status !== "attention"/);
  assert.match(more, /launchReadinessPlan\.badgeLabel/);
  assert.match(more, /launchReadinessPlan\.summary/);
  assert.match(more, /launchReadinessPlan\.nextGate/);
  assert.match(more, /Next launch gate/);
  assert.match(more, /openLaunchNextGate/);
  assert.match(more, /launchNextGateIcon/);
  assert.match(more, /accessibilityLabel=\{`Next launch gate:/);
  assert.match(more, /launchReadinessPlan\.nextGate\.ctaLabel/);
  assert.match(more, /launchReleasePacket\.betaShipStatus/);
  assert.match(more, /launchReleasePacket\.betaVerdictLabel/);
  assert.match(more, /launchReleasePacket\.betaSummary/);
  assert.match(
    more,
    /launchReleasePacket\.betaNextActions\.slice\(0, 3\)\.map/,
  );
  assert.match(more, /accessibilityLabel=\{[\s\S]*Open beta device QA cockpit/);
  assert.match(more, /Open QA Cockpit/);
  assert.match(more, /Share Beta Packet/);
  assert.match(more, /Share Beta Handoff/);
  assert.match(more, /launchReleasePacket\.readinessScore/);
  assert.match(more, /launchStoreSubmissionPacket\.verdictLabel/);
  assert.match(more, /Store Submission/);
  assert.match(more, /Provider Launch Setup/);
  assert.match(more, /providerSetupVisibleRows/);
  assert.match(
    more,
    /launchProviderSetupPlan\.rows\.filter\(\(row\) => row\.status !== "ready"\)/,
  );
  assert.match(more, /launchProviderSetupPlan\.nextGate/);
  assert.match(more, /Next provider gate/);
  assert.match(more, /Provider gates ready for owner approval/);
  assert.match(more, /row\.proofRequired/);
  assert.match(more, /row\.proofChecklist/);
  assert.match(more, /row\.proofChecklist\.slice\(0, 3\)\.map/);
  assert.match(more, /row\.proofChecklist\.length > 3/);
  assert.match(more, /More proof steps:/);
  assert.doesNotMatch(more, /Proof step: \{row\.proofChecklist\[0\]\}/);
  assert.match(more, /providerRowQaTarget/);
  assert.match(more, /auth-setup-onboarding-proof/);
  assert.match(more, /care-entry-provider-sync-proof/);
  assert.match(more, /report-binary-export-proof/);
  assert.match(more, /woofguide-ai-provider-proof/);
  assert.match(more, /WoofGuide AI Provider Proof/);
  assert.match(more, /push-notifications-proof/);
  assert.match(more, /payments-provider-proof/);
  assert.match(more, /Payments Provider Proof/);
  assert.match(more, /store-accounts-proof/);
  assert.match(more, /Store Accounts Proof/);
  assert.match(more, /account-deletion-proof/);
  assert.match(more, /Account Deletion Proof/);
  assert.match(more, /Open proof mission/);
  assert.match(more, /buildCareTwinQaFocusRoute\(\{ surfaceId: rowQaTarget\.surfaceId \}\)/);
  assert.match(more, /providerSetupProofChecklist/);
  assert.match(more, /Proof needed/);
  assert.match(more, /row\.status === "blocked" \? row\.nextAction : row\.detail/);
  assert.match(more, /Owner: \{launchProviderSetupPlan\.nextGate\.owner\}/);
  assert.match(
    more,
    /Proof: \{launchProviderSetupPlan\.nextGate\.proofRequired\}/,
  );
  assert.match(more, /Edit Provider Plan/);
  assert.match(more, /Share Provider Plan/);
  assert.match(more, /proofKey: "authProviderProofReady"/);
  assert.match(more, /proofKey: "databaseProviderProofReady"/);
  assert.match(more, /proofKey: "storageProviderProofReady"/);
  assert.match(more, /proofKey: "aiProviderProofReady"/);
  assert.match(more, /proofKey: "paymentsProviderProofReady"/);
  assert.match(more, /proofKey: "pushNotificationsProofReady"/);
  assert.match(more, /proofKey: "storeAccountsProofReady"/);
  assert.match(more, /proofKey: "accountDeletionProofReady"/);
  assert.match(
    more,
    /PROVIDER_SETUP_FIELDS\.every\(\s*\(field\) => normalized\[field\.key\] && normalized\[field\.proofKey\],\s*\)/,
  );
  assert.match(more, /Share Store Packet/);
  assert.match(more, /Share Launch Packet/);
  assert.match(
    more,
    /accessibilityLabel="Edit WoofWatcher provider launch setup"/,
  );
  assert.match(
    more,
    /accessibilityLabel="Share WoofWatcher provider setup plan"/,
  );
  assert.match(more, /accessibilityLabel="Share WoofWatcher release packet"/);
  assert.match(
    more,
    /accessibilityLabel="Share WoofWatcher store submission packet"/,
  );
  assert.match(
    more,
    /shareTextPayload\(\{[\s\S]*message:\s*buildLaunchProviderSetupShareText\(launchProviderSetupPlan/,
  );
  assert.match(
    more,
    /const message = buildBetaHandoffPacketShareText\(launchReleasePacket,\s*nativeQaCapturePlan,\s*\{[\s\S]*providerSetupPlan:\s*launchProviderSetupPlan/,
  );
  assert.match(more, /RECORDED_MOBILE_BETA_CI_PROOF/);
  assert.match(more, /ciProof:\s*RECORDED_MOBILE_BETA_CI_PROOF/);
  assert.match(more, /RECORDED_LIVE_PREVIEW_HANDOFF_PROOF/);
  assert.match(more, /livePreviewProof:\s*RECORDED_LIVE_PREVIEW_HANDOFF_PROOF/);
  assert.match(
    more,
    /shareTextPayload\(\{ message,\s*title:\s*"WoofWatcher 48-Hour Beta Handoff" \}/,
  );
  assert.match(
    more,
    /shareTextPayload\(\{ message: buildReleasePacketShareText\(launchReleasePacket\)/,
  );
  assert.match(
    more,
    /shareTextPayload\(\{ message: buildStoreSubmissionPacketShareText\(launchStoreSubmissionPacket\)/,
  );
  assert.match(careContext, /launchProviderProfile/);
  assert.match(careContext, /supportLegalReadinessEvidence\?:\s*SupportLegalReadinessProofEvidence \| null/);
  assert.match(careContext, /authSetupProofEvidence\?:\s*AuthSetupProofManifestInput \| null/);
  assert.match(careContext, /careEntryProviderSyncEvidence\?:\s*CareEntryProviderSyncProofEvidence \| null/);
  assert.match(careContext, /storageProviderEvidence\?:\s*LaunchStorageProviderEvidence \| null/);
  assert.match(careContext, /recordsLocalFileHandoffEvidence\?:\s*RecordsLocalFileHandoffProofEvidence \| null/);
  assert.match(careContext, /reportBinaryExportProofEvidence\?:\s*ReportBinaryExportProofEvidence \| null/);
  assert.match(careContext, /routeVisualProofEvidence\?:\s*RouteVisualProofManifestInput \| null/);
  assert.match(careContext, /aiProviderEvidence\?:\s*AiProviderProofEvidence \| null/);
  assert.match(careContext, /paymentsProviderEvidence\?:\s*PaymentsProviderProofManifestInput \| null/);
  assert.match(careContext, /pushNotificationsProofEvidence\?:\s*PushNotificationsProofEvidence \| null/);
  assert.match(careContext, /storeAccountsProofEvidence\?:\s*StoreAccountsProofEvidence \| null/);
  assert.match(careContext, /accountDeletionEvidence\?:\s*AccountDeletionProofEvidence \| null/);
  assert.match(careContext, /authProviderProofReady:\s*boolean/);
  assert.match(careContext, /databaseProviderProofReady:\s*boolean/);
  assert.match(careContext, /storageProviderProofReady:\s*boolean/);
  assert.match(careContext, /aiProviderProofReady:\s*boolean/);
  assert.match(careContext, /paymentsProviderProofReady:\s*boolean/);
  assert.match(careContext, /pushNotificationsProofReady:\s*boolean/);
  assert.match(careContext, /storeAccountsProofReady:\s*boolean/);
  assert.match(careContext, /accountDeletionProofReady:\s*boolean/);
  assert.match(
    careContext,
    /supportLegalReadinessEvidence:\s*normalizeSupportLegalReadinessEvidence\(launchSupportProfile\.supportLegalReadinessEvidence\)/,
  );
  assert.match(
    careContext,
    /launchProviderProfile:\s*normalizeLaunchProviderProfile\(merged\.launchProviderProfile\)/,
  );
  assert.match(providerSetup, /storageProviderEvidence\?:\s*LaunchStorageProviderEvidence \| null/);
  assert.match(providerSetup, /RecordsLocalFileHandoffProofEvidence/);
  assert.match(providerSetup, /recordsLocalFileHandoffEvidence\?:\s*RecordsLocalFileHandoffProofEvidence \| null/);
  assert.match(providerSetup, /recordsLocalFileHandoffEvidence:\s*normalizeRecordsLocalFileHandoffEvidence\(\s*source\.recordsLocalFileHandoffEvidence,\s*\)/);
  assert.match(providerSetup, /ReportBinaryExportProofEvidence/);
  assert.match(providerSetup, /reportBinaryExportProofEvidence\?:\s*ReportBinaryExportProofEvidence \| null/);
  assert.match(providerSetup, /reportBinaryExportProofEvidence:\s*normalizeReportBinaryExportProofEvidence\(\s*source\.reportBinaryExportProofEvidence,\s*\)/);
  assert.match(providerSetup, /RouteVisualProofManifestInput/);
  assert.match(providerSetup, /routeVisualProofEvidence\?:\s*RouteVisualProofManifestInput \| null/);
  assert.match(providerSetup, /routeVisualProofEvidence:\s*normalizeRouteVisualProofEvidence\(\s*source\.routeVisualProofEvidence,\s*\)/);
  assert.match(providerSetup, /authSetupProofEvidence\?:\s*AuthSetupProofManifestInput \| null/);
  assert.match(providerSetup, /authSetupProofEvidence:\s*normalizeAuthSetupProofEvidence\(source\.authSetupProofEvidence\)/);
  assert.match(providerSetup, /careEntryProviderSyncEvidence\?:\s*CareEntryProviderSyncProofEvidence \| null/);
  assert.match(providerSetup, /careEntryProviderSyncEvidence:\s*normalizeCareEntryProviderSyncEvidence\(source\.careEntryProviderSyncEvidence\)/);
  assert.match(providerSetup, /storageProviderEvidence:\s*normalizeStorageProviderEvidence\(source\.storageProviderEvidence\)/);
  assert.match(providerSetup, /storageProviderEvidence:\s*profile\.storageProviderEvidence/);
  assert.match(providerSetup, /aiProviderEvidence\?:\s*AiProviderProofEvidence \| null/);
  assert.match(providerSetup, /paymentsProviderEvidence\?:\s*PaymentsProviderProofManifestInput \| null/);
  assert.match(providerSetup, /pushNotificationsProofEvidence\?:\s*PushNotificationsProofEvidence \| null/);
  assert.match(providerSetup, /storeAccountsProofEvidence\?:\s*StoreAccountsProofEvidence \| null/);
  assert.match(providerSetup, /accountDeletionEvidence\?:\s*AccountDeletionProofEvidence \| null/);
  assert.match(providerSetup, /aiProviderEvidence:\s*normalizeAiProviderEvidence\(source\.aiProviderEvidence\)/);
  assert.match(providerSetup, /paymentsProviderEvidence:\s*normalizePaymentsProviderEvidence\(source\.paymentsProviderEvidence\)/);
  assert.match(providerSetup, /pushNotificationsProofEvidence:\s*normalizePushNotificationsProofEvidence\(source\.pushNotificationsProofEvidence\)/);
  assert.match(providerSetup, /storeAccountsProofEvidence:\s*normalizeStoreAccountsProofEvidence\(source\.storeAccountsProofEvidence\)/);
  assert.match(providerSetup, /accountDeletionEvidence:\s*normalizeAccountDeletionEvidence\(source\.accountDeletionEvidence\)/);
  assert.match(
    careTwinQaRoute,
    /buildAuthSetupProofManifest\(state\.launchProviderProfile\.authSetupProofEvidence \?\? undefined\)/,
  );
  assert.doesNotMatch(careTwinQaRoute, /buildAuthSetupProofManifest\(\{\}\)/);
  assert.match(
    careTwinQaRoute,
    /buildRecordsLocalFileHandoffProofManifest\(\s*state\.launchProviderProfile\.recordsLocalFileHandoffEvidence \?\? undefined,\s*\)/,
  );
  assert.doesNotMatch(careTwinQaRoute, /buildRecordsLocalFileHandoffProofManifest\(\{\}\)/);
  assert.match(careTwinQaRoute, /const savedProof = state\.launchProviderProfile\.reportBinaryExportProofEvidence \?\? \{\}/);
  assert.match(careTwinQaRoute, /generatedCarePassPdf:\s*savedProof\.generatedCarePassPdf/);
  assert.match(careTwinQaRoute, /generatedDogIdPng:\s*savedProof\.generatedDogIdPng/);
  assert.match(careTwinQaRoute, /nativeArtifactEvidence:\s*savedProof\.nativeArtifactEvidence/);
  assert.match(careTwinQaRoute, /providerStorageEvidence:\s*savedProof\.providerStorageEvidence/);
  assert.match(careTwinQaRoute, /const savedRouteVisualProof = state\.launchProviderProfile\.routeVisualProofEvidence \?\? \{\}/);
  assert.match(careTwinQaRoute, /evidence:\s*focusedQaEvidence\.length\s*\?\s*focusedQaEvidence\s*:\s*savedRouteVisualProof\.evidence/);
  assert.match(careTwinQaRoute, /note:\s*surfaceNotes\[focusedQaTarget\.target\.surfaceId\]\s*\|\|\s*savedRouteVisualProof\.note/);
  assert.match(
    careTwinQaRoute,
    /deriveCareEntryProviderSyncProof\(state\.launchProviderProfile\.careEntryProviderSyncEvidence\)/,
  );
  assert.doesNotMatch(careTwinQaRoute, /deriveCareEntryProviderSyncProof\(\{\}\)/);
  assert.match(
    careTwinQaRoute,
    /buildAiProviderProofManifest\(state\.launchProviderProfile\.aiProviderEvidence\)/,
  );
  assert.doesNotMatch(careTwinQaRoute, /buildAiProviderProofManifest\(\{\}\)/);
  assert.match(
    careTwinQaRoute,
    /buildPushNotificationsProofManifest\(state\.launchProviderProfile\.pushNotificationsProofEvidence\)/,
  );
  assert.doesNotMatch(careTwinQaRoute, /buildPushNotificationsProofManifest\(\{\}\)/);
  assert.match(
    careTwinQaRoute,
    /buildStoreAccountsProofManifest\(state\.launchProviderProfile\.storeAccountsProofEvidence\)/,
  );
  assert.doesNotMatch(careTwinQaRoute, /buildStoreAccountsProofManifest\(\{\}\)/);
  assert.match(
    careTwinQaRoute,
    /buildAccountDeletionProofManifest\(state\.launchProviderProfile\.accountDeletionEvidence\)/,
  );
  assert.doesNotMatch(careTwinQaRoute, /buildAccountDeletionProofManifest\(\{\}\)/);
  assert.match(providerSetup, /Provider Launch Setup/);
  assert.match(providerSetup, /LaunchProviderSetupRowStatus = "ready" \| "staged" \| "blocked"/);
  assert.match(providerSetup, /nextGate/);
  assert.match(providerSetup, /openCount/);
  assert.match(providerSetup, /Open or Staged/);
  assert.match(providerSetup, /Next Provider Gate/);
  assert.match(providerSetup, /CARE_ENTRY_PROVIDER_SYNC_PROOF_ITEMS/);
  assert.match(providerSetup, /proofChecklist/);
  assert.match(providerSyncProof, /Care-entry provider sync proof packet/);
  assert.match(providerSyncProof, /care_entries\.updated_at/);
  assert.match(providerSyncProof, /care_entry_tombstones/);
  assert.match(providerSyncProof, /\/care-entries\?updatedSince=/);
  assert.match(providerSyncProof, /\/care-entries\/tombstones\?updatedSince=/);
  assert.match(providerSyncProof, /retention\/export\/deletion/);
  assert.match(providerSyncProof, /mobile full-refresh sign-off/);
  assert.match(
    providerSetup,
    /All provider gates are provider-approved for final owner review/,
  );
  assert.match(
    providerSetup,
    /No App Store or Play Store submission is approved by this checklist/,
  );
  assert.match(launchModel, /storageQueue/);
  assert.match(launchModel, /LaunchReadinessNextGateAction/);
  assert.match(launchModel, /deriveNextGate/);
  assert.match(launchModel, /share-beta-handoff/);
  assert.match(launchModel, /open-avatar-studio/);
  assert.match(launchModel, /local file/);
  assert.match(launchModel, /Device proof required/);
  assert.match(launchModel, /Native iOS\/Android QA evidence is not attached/);
  assert.match(launchModel, /Checkout gated/);
  assert.doesNotMatch(more, /Expo\/EAS profiles ready/);
  assert.match(
    more,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Tools & Sharing"/,
  );
  assert.match(
    more,
    /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Diet Profile"/,
  );
  assert.doesNotMatch(more, /sectionHeader:/);
  assert.doesNotMatch(more, /sectionTitle:/);
});

test("feeds saved native QA session proof into More launch readiness", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));
  const careTwinQaRoute = readAppFile("care-twin-qa.tsx");
  const qaEvidence = readMobileLibFile("mobileLaunchQaEvidence.ts");

  assert.match(more, /AsyncStorage/);
  assert.match(more, /MOBILE_QA_SESSION_STORAGE_KEY/);
  assert.match(more, /parseMobileQaSessionSnapshot/);
  assert.match(more, /buildMobileQaSessionProofManifest/);
  assert.match(more, /savedQaProofManifest/);
  assert.match(more, /setSavedQaProofManifest/);
  assert.match(more, /buildMobileLaunchQaCaptureShareText/);
  assert.match(more, /buildMobileLaunchQaFixBriefShareText/);
  assert.match(more, /buildMobileLaunchQaCapturePlan/);
  assert.match(more, /deriveNativeQaSummaryFromMobileQaSession/);
  assert.match(more, /savedNativeQaSummary/);
  assert.match(more, /setSavedNativeQaSummary/);
  assert.match(more, /nativeQaCapturePlan/);
  assert.match(more, /setNativeQaCapturePlan/);
  assert.match(more, /nativeQaPrimaryMission/);
  assert.match(more, /nativeQaPrimaryMissionTarget/);
  assert.match(more, /Native QA Next Captures/);
  assert.match(more, /Primary mission/);
  assert.match(more, /Proof manifest/);
  assert.match(more, /savedQaProofManifest\.proofId/);
  assert.match(more, /savedQaProofManifest\.platformEvidenceLabel/);
  assert.match(more, /accessibilityLabel=\{`Share beta handoff proof manifest/);
  assert.match(more, /onPress=\{shareBetaHandoffPacket\}/);
  assert.match(
    more,
    /accessibilityLabel=\{`Open primary Native QA mission:/,
  );
  assert.match(more, /Share QA Plan/);
  assert.match(more, /nativeQaCapturePlan\.nextTargets/);
  assert.match(more, /nativeQaCaptureNeedsTuneTarget/);
  assert.match(more, /Share Fix Brief/);
  assert.match(more, /Open Needs Tune/);
  assert.match(
    more,
    /accessibilityLabel="Share first Native QA Needs tune fix brief"/,
  );
  assert.match(
    more,
    /accessibilityLabel=\{`Open first Native QA Needs tune target:/,
  );
  assert.match(
    more,
    /router\.push\(buildCareTwinQaFocusRoute\(nativeQaCaptureNeedsTuneTarget\) as never\)/,
  );
  assert.match(more, /mobileLaunchQaCaptureTargetStatusLabel\(target\)/);
  assert.match(more, /Pass pending proof/);
  assert.match(more, /nativeQaCaptureHasProofPending/);
  assert.match(more, /ownerPreviewProofStatus/);
  assert.match(more, /Owner preview proof/);
  assert.match(more, /storeScreenshotProofStatus/);
  assert.match(more, /Store screenshot proof/);
  assert.match(more, /Next store screenshot/);
  assert.match(more, /storeScreenshotProofStatus\.nextTarget/);
  assert.match(more, /buildCareTwinQaFocusRoute/);
  assert.match(more, /qaSurface=\$\{encodeURIComponent\(target\.surfaceId\)\}/);
  assert.match(
    more,
    /buildCareTwinQaFocusRoute\(storeScreenshotProofStatus\.nextTarget\)/,
  );
  assert.match(more, /Finish Proof/);
  assert.match(more, /nativeQaCaptureCockpitAction/);
  assert.match(
    more,
    /shareTextPayload\(\{[\s\S]*message:\s*buildMobileLaunchQaCaptureShareText\(nativeQaCapturePlan/,
  );
  assert.match(
    more,
    /proofManifest:\s*savedQaProofManifest/,
  );
  assert.match(more, /nativeQa:\s*savedNativeQaSummary/);
  assert.doesNotMatch(more, /nativeQa:\s*null/);
  assert.match(more, /router\.push\(buildCareTwinQaFocusRoute/);

  assert.match(careTwinQaRoute, /buildMobileLaunchQaCaptureShareText/);
  assert.match(careTwinQaRoute, /buildMobileLaunchQaFixBriefShareText/);
  assert.match(careTwinQaRoute, /buildMobileLaunchQaFocusedTargetShareText/);
  assert.match(
    careTwinQaRoute,
    /buildMobileLaunchQaCaptureShareText\(betaCapturePlan,\s*reviewedAtIso\)/,
  );
  assert.match(
    careTwinQaRoute,
    /buildMobileLaunchQaFixBriefShareText\(betaCapturePlan,\s*generatedAtIso\)/,
  );
  assert.match(careTwinQaRoute, /const shareFocusedTargetChecklist = async/);
  assert.match(careTwinQaRoute, /const shareFocusedFixBrief = async/);
  assert.match(careTwinQaRoute, /title:\s*"WoofWatcher Focused QA Target"/);
  assert.match(careTwinQaRoute, /title:\s*"WoofWatcher Needs Tune Fix Brief"/);
  assert.match(
    careTwinQaRoute,
    /buildMobileReleaseQaShareText\(releaseQaSurfaces,\s*releaseReviews,\s*reviewedAtIso\)/,
  );
  assert.match(careTwinQaRoute, /useLocalSearchParams/);
  assert.match(careTwinQaRoute, /buildMobileLaunchQaFocusedTarget/);
  assert.match(careTwinQaRoute, /Focused QA Target/);
  assert.match(careTwinQaRoute, /focusedQaTarget\.target\.missingEvidence/);
  assert.match(careTwinQaRoute, /focusedQaEvidence/);
  assert.match(careTwinQaRoute, /title="Focused screenshot proof"/);
  assert.match(
    careTwinQaRoute,
    /label=\{`\$\{focusedQaEvidence\.length\} focused`\}/,
  );
  assert.match(careTwinQaRoute, /evidence=\{focusedQaEvidence\}/);
  assert.match(careTwinQaRoute, /Attach focused QA proof/);
  assert.match(careTwinQaRoute, /label="Game-feel checklist"/);
  assert.match(careTwinQaRoute, /focusedQaTarget\.target\.verificationSteps\.slice\(0,\s*6\)/);
  assert.match(careTwinQaRoute, /focusedQaTarget\.target\.setupSteps\.slice\(0,\s*4\)/);
  assert.match(careTwinQaRoute, /focusedQaTarget\.target\.acceptanceCriteria\.slice\(0,\s*4\)/);
  assert.match(careTwinQaRoute, /Share target checklist/);
  assert.match(
    careTwinQaRoute,
    /accessibilityLabel=\{`Share focused QA target checklist:/,
  );
  assert.match(
    careTwinQaRoute,
    /focusedQaTarget\.target\.status === "needs-review"/,
  );
  assert.match(
    careTwinQaRoute,
    /accessibilityLabel=\{`Share focused Needs tune fix brief:/,
  );
  assert.match(careTwinQaRoute, /Share fix brief/);

  assert.match(qaEvidence, /buildMobileLaunchQaCapturePlan/);
  assert.match(qaEvidence, /buildMobileLaunchQaFocusedTarget/);
  assert.match(qaEvidence, /ownerPreviewProofStatus/);
  assert.match(qaEvidence, /Owner preview proof:/);
  assert.match(qaEvidence, /buildMobileLaunchQaCaptureShareText/);
  assert.match(qaEvidence, /buildMobileLaunchQaFixBriefShareText/);
  assert.match(qaEvidence, /listMobileLaunchQaSurfaces/);
  assert.match(qaEvidence, /buildStoreSubmissionScreenshotQaSurfaces/);
  assert.match(qaEvidence, /summarizeMobileReleaseQaReviews/);
  assert.match(qaEvidence, /LaunchReadinessNativeQaSummary/);
  assert.match(qaEvidence, /hasMobileQaSessionReviewData/);
});

test("keeps More launch and household gateway actions on shared mobile touch targets", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));

  for (const styleName of [
    "profileEditBtn",
    "intelligenceAction",
    "providerSetupButton",
    "nativeQaCaptureShare",
    "nativeQaCaptureFixBrief",
    "nativeQaCaptureNeedsTuneAction",
    "nativeQaCaptureCockpitAction",
    "betaNextActionButton",
    "betaHandoffShareButton",
    "launchShare",
    "passAction",
    "passKind",
    "shareBtn",
    "modalCancel",
    "modalConfirm",
    "providerStatusPill",
    "unitPill",
    "profSaveBtn",
  ]) {
    assertStyleUsesSharedTouchTarget(more, styleName);
  }
});

test("keeps care document refresh conflict-safe in CareContext", () => {
  const careContext = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "context",
      "CareContext.tsx",
    ),
    "utf8",
  );

  assert.match(careContext, /reconcileCareDocFromServer/);
  assert.match(careContext, /shouldPushLocal/);
  assert.match(careContext, /putCareState\(\{\s*version: plan\.version/);
});

test("keeps the root install guard cross-platform for deadline beta exports", () => {
  const rootPackageJson = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as {
    scripts?: Record<string, string>;
  };
  const preinstall = rootPackageJson.scripts?.preinstall ?? "";
  const guardSource = readFileSync(
    join(process.cwd(), "scripts", "enforce-pnpm-install.mjs"),
    "utf8",
  );

  assert.equal(preinstall, "node scripts/enforce-pnpm-install.mjs");
  assert.doesNotMatch(preinstall, /\bsh\b|-c/);
  assert.match(guardSource, /npm_config_user_agent/);
  assert.match(guardSource, /pnpm\//);
  assert.match(guardSource, /package-lock\.json/);
  assert.match(guardSource, /yarn\.lock/);
  assert.doesNotMatch(guardSource, /\bsh\b|-c/);
});

test("keeps a deadline beta doctor command for mobile export handoff", () => {
  const rootPackageJson = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as {
    packageManager?: string;
    scripts?: Record<string, string>;
  };
  const doctorSource = readFileSync(
    join(process.cwd(), "scripts", "mobile-beta-doctor.mjs"),
    "utf8",
  );
  const verifyWorkflow = readFileSync(
    join(process.cwd(), ".github", "workflows", "verify.yml"),
    "utf8",
  );

  assert.equal(rootPackageJson.packageManager, "pnpm@10.24.0");
  assert.match(verifyWorkflow, /version:\s*10\.24\.0/);
  assert.match(verifyWorkflow, /pnpm run doctor:mobile-beta:json/);
  assert.equal(
    rootPackageJson.scripts?.["doctor:mobile-beta"],
    "node scripts/mobile-beta-doctor.mjs",
  );
  assert.match(doctorSource, /WoofWatcher mobile beta doctor/);
  assert.match(doctorSource, /packageManager/);
  assert.match(doctorSource, /10\.24\.0/);
  assert.match(doctorSource, /expectedPnpmVersion/);
  assert.match(doctorSource, /pnpm\.stdout\.trim\(\) === expectedPnpmVersion/);
  assert.match(doctorSource, /Corepack/);
  assert.match(doctorSource, /corepack prepare pnpm@10\.24\.0 --activate/);
  assert.match(doctorSource, /resolvePathCommand/);
  assert.match(doctorSource, /Node 24 runtime/);
  assert.match(doctorSource, /EAS build profiles include iOS and Android/);
  assert.match(doctorSource, /pnpm/);
  assert.match(doctorSource, /expo/);
  assert.match(doctorSource, /smoke:web/);
  assert.match(doctorSource, /smoke:runtime/);
  assert.match(doctorSource, /care-twin-qa/);
  assert.match(doctorSource, /Mission note/);
  assert.match(doctorSource, /GitHub Actions/);
});

test("keeps a native QA tooling doctor for device-proof handoff", () => {
  const rootPackageJson = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as {
    scripts?: Record<string, string>;
  };
  const doctorPath = join(process.cwd(), "scripts", "native-qa-tooling-doctor.mjs");
  const doctorSource = readFileSync(doctorPath, "utf8");
  const blockerSource = readFileSync(
    join(process.cwd(), "docs", "BLOCKERS_FOR_APOLLO.md"),
    "utf8",
  );

  assert.equal(
    rootPackageJson.scripts?.["doctor:native-qa"],
    "node scripts/native-qa-tooling-doctor.mjs",
  );
  assert.equal(
    rootPackageJson.scripts?.["doctor:native-qa:json"],
    "node scripts/native-qa-tooling-doctor.mjs --json",
  );
  assert.match(doctorSource, /WoofWatcher native QA tooling doctor/);
  assert.match(doctorSource, /adb/);
  assert.match(doctorSource, /emulator/);
  assert.match(doctorSource, /java/);
  assert.match(doctorSource, /ANDROID_HOME/);
  assert.match(doctorSource, /ANDROID_SDK_ROOT/);
  assert.match(doctorSource, /JAVA_HOME/);
  assert.match(doctorSource, /route-visual-consistency/);
  assert.match(doctorSource, /records-local-file-handoff/);
  assert.match(doctorSource, /web preview evidence only/);
  assert.match(doctorSource, /does not replace native iOS\/Android proof/);
  assert.match(blockerSource, /pnpm run doctor:native-qa:json/);
  assert.match(blockerSource, /adb/);
  assert.match(blockerSource, /ANDROID_HOME/);

  const result = spawnSync(
    process.execPath,
    ["scripts/native-qa-tooling-doctor.mjs", "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  assert.equal(result.stderr, "");
  const payload = JSON.parse(result.stdout) as {
    name?: string;
    result?: "READY_FOR_NATIVE_QA" | "BLOCKED";
    checks?: Array<{ label?: string; status?: "PASS" | "WARN" | "BLOCKED"; detail?: string }>;
    issues?: string[];
    warnings?: string[];
    nativeProofTargets?: string[];
    truthBoundaries?: string[];
    nextActions?: string[];
  };

  assert.equal(payload.name, "WoofWatcher native QA tooling doctor");
  assert.ok(payload.result === "READY_FOR_NATIVE_QA" || payload.result === "BLOCKED");
  assert.equal(result.status, payload.result === "READY_FOR_NATIVE_QA" ? 0 : 1);
  assert.ok(
    payload.checks?.some((check) => check.label === "Android adb available"),
  );
  assert.ok(
    payload.checks?.some((check) => check.label === "Android emulator available"),
  );
  assert.ok(
    payload.checks?.some((check) => check.label === "Java runtime available"),
  );
  assert.ok(
    payload.checks?.some((check) => check.label === "ANDROID_HOME or ANDROID_SDK_ROOT set"),
  );
  assert.ok(
    payload.checks?.some((check) => check.label === "JAVA_HOME set"),
  );
  assert.ok(
    payload.nativeProofTargets?.includes("/care-twin-qa?qaSurface=records-local-file-handoff"),
  );
  assert.ok(
    payload.nativeProofTargets?.includes("/care-twin-qa?qaSurface=report-binary-export-proof"),
  );
  assert.ok(
    payload.nativeProofTargets?.includes("/care-twin-qa?qaSurface=care-entry-provider-sync-proof"),
  );
  assert.ok(
    payload.nativeProofTargets?.includes("/care-twin-qa?qaSurface=woofguide-ai-provider-proof"),
  );
  assert.ok(
    payload.nativeProofTargets?.includes("/care-twin-qa?qaSurface=payments-provider-proof"),
  );
  assert.ok(
    payload.nativeProofTargets?.includes("/care-twin-qa?qaSurface=auth-setup-onboarding-proof"),
  );
  assert.ok(
    payload.nativeProofTargets?.includes("/care-twin-qa?qaSurface=payments-provider-proof"),
  );
  assert.ok(
    payload.nativeProofTargets?.includes("/care-twin-qa?qaSurface=store-accounts-proof"),
  );
  assert.ok(
    payload.nativeProofTargets?.includes("/care-twin-qa?qaSurface=account-deletion-proof"),
  );
  assert.ok(
    payload.nativeProofTargets?.includes("/care-twin-qa?qaSurface=support-legal-readiness-proof"),
  );
  assert.ok(
    payload.nativeProofTargets?.includes("/care-twin-qa?qaSurface=route-visual-consistency"),
  );
  assert.ok(
    payload.truthBoundaries?.some((boundary) =>
      boundary.includes("web preview evidence only"),
    ),
  );
  assert.ok(
    payload.truthBoundaries?.some((boundary) =>
      boundary.includes("does not replace native iOS/Android proof"),
    ),
  );
  assert.ok(
    payload.nextActions?.some((action) =>
      action.includes("/care-twin-qa?qaSurface=route-visual-consistency"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=route-visual-consistency") &&
        action.includes("route-named evidence"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=report-binary-export-proof") &&
        action.includes("Care Pass PDF") &&
        action.includes("Dog ID PNG"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=care-entry-provider-sync-proof") &&
        action.includes("Supabase") &&
        action.includes("mobile full-refresh"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=woofguide-ai-provider-proof") &&
        action.includes("OpenAI key location") &&
        action.includes("owner-review write gate"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=payments-provider-proof") &&
        action.includes("Plus and Family product ids") &&
        action.includes("paid checkout"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=store-accounts-proof") &&
        action.includes("Apple Developer team id") &&
        action.includes("store submission"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=account-deletion-proof") &&
        action.includes("self-serve deletion route") &&
        action.includes("legal/store approval"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=support-legal-readiness-proof") &&
        action.includes("support inbox") &&
        action.includes("privacy policy") &&
        action.includes("veterinary boundary"),
    ),
  );
});

test("emits machine-readable mobile beta doctor status for Replit and native helpers", () => {
  const rootPackageJson = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    rootPackageJson.scripts?.["doctor:mobile-beta:json"],
    "node scripts/mobile-beta-doctor.mjs --json",
  );

  const result = spawnSync(
    process.execPath,
    ["scripts/mobile-beta-doctor.mjs", "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.stderr, "");

  const payload = JSON.parse(result.stdout) as {
    name?: string;
    result?: string;
    checks?: Array<{ label: string; status: string; detail?: string }>;
    issues?: string[];
    warnings?: string[];
    nextActions?: string[];
    proofCommands?: string[];
    handoffProofSections?: string[];
    truthBoundaries?: string[];
  };

  assert.equal(payload.name, "WoofWatcher mobile beta doctor");
  assert.ok(
    payload.result === "BLOCKED" || payload.result === "READY_FOR_EXPORT",
  );
  assert.equal(result.status, payload.result === "READY_FOR_EXPORT" ? 0 : 1);
  assert.ok(
    payload.checks?.some(
      (check) => check.label === "Node 24 runtime" && check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "EAS build profiles include iOS and Android" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "beta handoff source includes proof sections" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "release smoke checklist is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "owner preview proof wiring is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "care-twin QA route proof flow is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "native QA Needs tune fix brief is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "Care Pass storage proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label ===
          "owner-preview Care Pass storage proof is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label ===
          "records local file handoff proof is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label ===
          "records local file handoff proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label ===
          "report binary export proof packet is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label ===
          "report binary export proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label ===
          "records binary export proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label ===
          "generated binary artifact exports are source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "beta handoff truth boundaries are source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "release QA proof gate is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "avatar sprite production review is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "unsupported bundled pnpm candidate" &&
        check.detail?.includes("pnpm"),
    ),
  );
  if (payload.result === "BLOCKED") {
    assert.ok(
      payload.issues?.some(
        (issue) =>
          issue === "pnpm available" ||
          issue === "pnpm CLI matches pinned version" ||
          issue === "mobile package can resolve expo",
      ),
      "blocked beta doctor should name the missing dependency/export gate",
    );
  }
  const corepackCheck = payload.checks?.find(
    (check) => check.label === "Corepack available for pnpm bootstrap",
  );
  assert.ok(corepackCheck, "mobile beta doctor should report Corepack status");
  if (corepackCheck.status !== "PASS") {
    assert.ok(
      payload.warnings?.includes("Corepack available for pnpm bootstrap"),
      "Corepack should only appear in warnings when the doctor cannot use it",
    );
  }
  assert.deepEqual(payload.proofCommands, [
    "corepack prepare pnpm@10.24.0 --activate",
    "pnpm install",
    "pnpm run doctor:mobile-beta",
    "pnpm run doctor:mobile-beta:json",
    "pnpm --filter @workspace/woofwatcher-mobile run smoke:web",
    "pnpm --filter @workspace/woofwatcher-mobile run smoke:runtime",
    "pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview",
    "pnpm --filter @workspace/woofwatcher-mobile run preview:smoke",
  ]);
  assert.deepEqual(payload.handoffProofSections, [
    "Release smoke checklist",
    "Dependency proof commands",
    "Dependency-complete CI proof",
    "Live preview handoff proof",
    "Recorded live preview proof",
    "Required beta proof after export",
    "Native QA Needs tune fix brief",
    "Provider proof needed",
    "Truth boundaries",
  ]);
  assert.ok(
    payload.nextActions?.some((action) =>
      action.includes(
        "pnpm --filter @workspace/woofwatcher-mobile run smoke:web",
      ),
    ),
  );
  assert.ok(
    payload.nextActions?.some((action) =>
      action.includes(
        "pnpm --filter @workspace/woofwatcher-mobile run smoke:runtime",
      ),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("preview:smoke") && action.includes("127.0.0.1:4194"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("Attach JSON doctor") &&
        action.includes("branch CI proof") &&
        action.includes("preview:smoke URL") &&
        action.includes("without claiming native QA"),
    ),
  );
  assert.ok(
    payload.nextActions?.some((action) => action.includes("/care-twin-qa")),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("Printable HTML local file") && action.includes("generated PDF/native proof still blocked"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("Dog ID") &&
        action.includes("local HTML credential file") &&
        action.includes("SVG image source") &&
        action.includes("generated PNG/PDF readiness still needs native/provider proof"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=auth-setup-onboarding-proof") &&
        action.includes("provider-backed auth") &&
        action.includes("household creation"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=records-local-file-handoff") &&
        action.includes("Android content URI") &&
        action.includes("fallback copy"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=report-binary-export-proof") &&
        action.includes("local Care Pass PDF bytes") &&
        action.includes("local Dog ID PNG bytes"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=care-entry-provider-sync-proof") &&
        action.includes("structured Supabase project") &&
        action.includes("migration/backfill") &&
        action.includes("active-household RLS") &&
        action.includes("MIME") &&
        action.includes("byte size"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=woofguide-ai-provider-proof") &&
        action.includes("OpenAI key location") &&
        action.includes("approved model policy") &&
        action.includes("veterinary safety boundary"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=push-notifications-proof") &&
        action.includes("Expo push project") &&
        action.includes("APNs") &&
        action.includes("Firebase/FCM"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=payments-provider-proof") &&
        action.includes("Plus and Family product ids") &&
        action.includes("iOS App Store") &&
        action.includes("Android Google Play") &&
        action.includes("sandbox receipt JSON proof") &&
        action.includes("checkout-gate proof"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=store-accounts-proof") &&
        action.includes("Apple Developer team id") &&
        action.includes("Google Play package record") &&
        action.includes("store submission"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=account-deletion-proof") &&
        action.includes("self-serve deletion route") &&
        action.includes("data/object deletion receipt") &&
        action.includes("legal/store approval"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=support-legal-readiness-proof") &&
        action.includes("support inbox") &&
        action.includes("privacy policy") &&
        action.includes("Apollo approval"),
    ),
  );
  assert.ok(
    payload.nextActions?.some(
      (action) =>
        action.includes("/care-twin-qa?qaSurface=route-visual-consistency") &&
        action.includes("Log, Plan, Today, Pack, Story, Health, Records, and More") &&
        action.includes("iOS and Android") &&
        action.includes("route-named"),
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label ===
          "report binary export proof target is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label ===
          "care-entry provider sync proof target is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label ===
          "care-entry provider sync proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "push notifications proof target is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "payments provider proof target is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "payments provider proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "payments provider proof target is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "route visual proof target is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "route visual proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "live preview handoff proof is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "live preview handoff verifier is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "auth/setup runtime smoke proof is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "auth/setup native QA target is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "auth provider proof packet is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "auth/setup proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "payments provider proof packet is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "premium payments proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "ai provider proof packet is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "woofguide ai provider proof target is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "woofguide ai provider proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "account deletion proof packet is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "store accounts proof packet is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "store accounts proof target is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "store accounts proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "account deletion proof target is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "account deletion proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "support legal readiness proof target is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "support legal readiness proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "push notifications proof packet is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "push notifications proof manifest is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "reminder center push proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "aggregate launch readiness proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "care document launch proof persistence guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "privacy provider proof evidence propagation is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "auth setup proof evidence propagation is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "payments proof evidence propagation is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "push notification proof evidence propagation is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "store accounts proof evidence propagation is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "records local file proof evidence propagation is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "route visual proof evidence propagation is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "provider launch setup proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "privacy safety AI proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "PWA WoofGuide AI proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "PWA cloud sync proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "PWA hosted nudge proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "privacy safety account deletion proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "privacy safety payments proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "support runbook proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "privacy support status proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "privacy export launch status proof guard is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "recorded CI proof freshness boundary is source-backed" &&
        check.status === "PASS" &&
        check.detail.includes("run 28836909561") &&
        check.detail.includes("commit d21f44e"),
    ),
  );
  assert.ok(
    payload.checks?.some(
      (check) =>
        check.label === "recorded live preview proof attachment is source-backed" &&
        check.status === "PASS",
    ),
  );
  assert.ok(
    payload.truthBoundaries?.some((boundary) =>
      boundary.includes("READY_FOR_EXPORT only"),
    ),
  );
  assert.ok(
    payload.truthBoundaries?.some((boundary) =>
      boundary.includes("does not approve App Store"),
    ),
  );
  assert.ok(
    payload.truthBoundaries?.some((boundary) =>
      boundary.includes("BLOCKED means do not claim"),
    ),
  );
});

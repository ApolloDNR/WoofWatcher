import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const APP_DIR = join(process.cwd(), "artifacts", "woofwatcher-mobile", "app");
const MOBILE_LIB_DIR = join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib");

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

function assertStyleUsesSharedTouchTarget(source: string, styleName: string): void {
  const block = getStyleBlock(source, styleName);
  assert.match(block, /minHeight:\s*MIN_MOBILE_TOUCH_TARGET/, `${styleName} should use the shared mobile touch target`);
  assert.doesNotMatch(block, /minHeight:\s*(?:3\d|4[0-7])\b/, `${styleName} should not keep a route-local undersized height`);
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

function readPngSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path} should be a PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("registers the critical mobile routes and tabs", () => {
  const rootLayout = readAppFile("_layout.tsx");
  const tabLayout = readAppFile(join("(tabs)", "_layout.tsx"));

  for (const route of ["portrait", "setup", "woofguide", "premium", "privacy", "adventure", "care-twin-qa"]) {
    assert.match(rootLayout, new RegExp(`name="${route}"`), `${route} stack screen should be registered`);
    assert.ok(existsSync(join(APP_DIR, `${route}.tsx`)), `${route} route file should exist`);
  }

  for (const tab of ["Home", "Log", "Plans", "Health", "More"]) {
    assert.match(tabLayout, new RegExp(`title: "${tab}"`), `${tab} tab should be visible`);
  }
  assert.match(tabLayout, /name="records"/, "records route should stay registered for More links and deep links");
  assert.match(tabLayout, /href: null/, "records should not appear as a primary bottom tab in v1.5");
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
  assert.match(privacy, /deriveSupportRunbookPlan/);
  assert.match(privacy, /buildSupportRunbookShareText/);
  assert.match(privacy, /state\.launchSupportProfile/);
  assert.match(privacy, /updateCareDoc/);
  assert.match(privacy, /Support runbook/);
  assert.match(privacy, /supportPlan\.launchBlockers/);
  assert.match(privacyModel, /launchSupportProfile/);
  assert.match(privacyModel, /deriveAttachmentManifest/);
  assert.match(privacy, /bundle\.counts\.localAttachments/);
  assert.match(privacy, /Attachment queue/);
  assert.match(privacy, /bundle\.storage\.attachmentReviewRows/);
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
  assert.match(smokeScript, /const outputDirName = "\.expo-smoke"/);
  assert.match(smokeScript, /"--output-dir", outputDirName/);
  assert.match(smokeScript, /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  assert.match(mobileGitignore, /\.expo-smoke\//);
});

test("keeps local Clerk placeholders from blanking the web preview", () => {
  const auth = readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "auth.ts"), "utf8");

  assert.match(auth, /isPlaceholderPublishableKey/);
  assert.match(auth, /placeholder/);
  assert.match(auth, /local_smoke/);
  assert.match(auth, /!isPlaceholderPublishableKey/);
  assert.match(auth, /useWoofAuth = isClerkConfigured \? useClerkAuth : useLocalAuth/);
});

test("keeps critical mobile actions accessible to screen readers", () => {
  const privacy = readAppFile("privacy.tsx");
  const premium = readAppFile("premium.tsx");
  const woofGuide = readAppFile("woofguide.tsx");
  const more = readAppFile(join("(tabs)", "more.tsx"));

  assert.match(privacy, /accessibilityLabel="Close Privacy and Safety"/);
  assert.match(privacy, /accessibilityLabel="Export WoofWatcher care data"/);
  assert.match(privacy, /accessibilityLabel="Prepare account deletion request"/);
  assert.match(privacy, /accessibilityLabel="Share WoofWatcher support runbook"/);
  assert.match(privacy, /accessibilityLabel="Edit WoofWatcher launch support profile"/);
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

test("keeps tabbed mobile routes clear of the floating paw nav", () => {
  const mobileLayout = readMobileLibFile("mobileLayout.ts");
  const tabs = readAppFile(join("(tabs)", "_layout.tsx"));
  const tabbedRoutes = ["index", "log", "calendar", "health", "more", "records"];

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
    assert.match(source, /getTabbedRouteBottomPadding/, `${route} should use shared tab bottom padding`);
    assert.match(source, /getRouteTopPadding/, `${route} should use shared top safe-area padding`);
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
  const standaloneRoutes = ["adventure", "portrait", "care-twin-qa", "premium", "privacy", "setup"];
  const authUi = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "components", "auth-ui.tsx"),
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
    assert.match(source, /getRouteTopPadding/, `${route} should use shared top safe-area padding`);
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
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "components", "board", "BoardPrimitives.tsx"),
    "utf8",
  );
  const errorFallback = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "components", "ErrorFallback.tsx"),
    "utf8",
  );
  const routeSources = [
    ...listAppFiles(),
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "components", "auth-ui.tsx"),
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "components", "ErrorFallback.tsx"),
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
  assert.match(more, /router\.push\("\/care-twin-qa" as never\)/);
  assert.match(more, /__DEV__/);
  assert.match(qaRoute, /listCareTwinRuntimeQaScenarios/);
  assert.match(qaRoute, /evaluateCareTwinRuntimeQaScenario/);
  assert.match(qaRoute, /deriveCareTwinChoreography/);
  assert.match(qaRoute, /LivingPhoenixRoom/);
  assert.match(qaRoute, /nativeQaPrompt/);
  assert.match(qaRoute, /testID=\{`care-twin-qa-stage-\$\{result\.scenario\.id\}`\}/);
  assert.match(qaRoute, /Mobile release cockpit\./);
  assert.match(qaRoute, /qaStatusById/);
  assert.match(qaRoute, /qaNotes/);
  assert.match(qaRoute, /Share\.share/);
  assert.match(qaRoute, /buildCareTwinQaShareText/);
  assert.match(qaRoute, /listMobileReleaseQaSurfaces/);
  assert.match(qaRoute, /buildMobileReleaseQaShareText/);
  assert.match(qaRoute, /buildMobileLaunchQaCapturePlan/);
  assert.match(qaRoute, /buildStoreSubmissionScreenshotQaSurfaces/);
  assert.match(qaRoute, /buildStoreSubmissionPacket/);
  assert.match(qaRoute, /buildStoreSubmissionPacketShareText/);
  assert.match(qaRoute, /buildReleasePacket/);
  assert.match(qaRoute, /deriveLaunchReadiness/);
  assert.match(qaRoute, /storeSubmissionPacket\.screenshotChecklist/);
  assert.match(qaRoute, /Store Screenshot QA/);
  assert.match(qaRoute, /Share store packet/);
  assert.match(qaRoute, /AsyncStorage/);
  assert.match(qaRoute, /MOBILE_QA_SESSION_STORAGE_KEY/);
  assert.match(qaRoute, /parseMobileQaSessionSnapshot/);
  assert.match(qaRoute, /buildMobileQaSessionSnapshot/);
  assert.match(qaRoute, /Saved locally/);
  assert.match(qaRoute, /Motion recipe/);
  assert.match(qaRoute, /choreography\.qaSummary/);
  assert.match(qaRoute, /choreography\.tapReaction\.action/);
  assert.match(qaRoute, /ImagePicker\.launchImageLibraryAsync/);
  assert.match(qaRoute, /buildQaScreenshotEvidence/);
  assert.match(qaRoute, /qaScreenshotPlatformForRuntime/);
  assert.match(qaRoute, /selectedEvidencePlatform/);
  assert.match(qaRoute, /Tag screenshot evidence/);
  assert.match(qaRoute, /Tag QA screenshots as \$\{option\.label\}/);
  assert.match(qaRoute, /targetPlatform: selectedEvidencePlatform/);
  assert.match(qaRoute, /New attachments are tagged as \{targetPlatformLabel\}/);
  assert.match(qaRoute, /qaScreenshotEvidencePlatformLabel\(item\.targetPlatform\)/);
  assert.match(qaRoute, /qaEvidenceById/);
  assert.match(qaRoute, /surfaceEvidenceById/);
  assert.match(qaRoute, /Attach screenshot/);
  assert.match(qaRoute, /Screenshot evidence/);
  assert.match(qaRoute, /Clear attached QA screenshots/);
  assert.match(qaRoute, /releaseSummary\.attachedIosScreenshots/);
  assert.match(qaRoute, /releaseSummary\.attachedAndroidScreenshots/);
  assert.match(qaRoute, /formatMobileReleaseQaPlatformEvidence/);
  assert.match(qaRoute, /formatMobileReleaseQaMissingEvidence/);
  assert.match(qaRoute, /mobileReleaseQaScreenshotEvidenceComplete/);
  assert.match(qaRoute, /Native proof open/);
  assert.match(qaRoute, /Platform proof:/);
  assert.match(qaRoute, /48-hour beta run/);
  assert.match(qaRoute, /nextBetaTarget/);
  assert.match(qaRoute, /nextBetaSurface/);
  assert.match(qaRoute, /Next device mission/);
  assert.match(qaRoute, /Owner route loop/);
  assert.match(qaRoute, /nextBetaTarget\.routeChecklist/);
  assert.match(qaRoute, /routeCheck\.expected/);
  assert.match(qaRoute, /routeCheck\.proof/);
  assert.match(qaRoute, /Mission note/);
  assert.match(qaRoute, /Mission note for \$\{nextBetaTarget\.title\}/);
  assert.match(qaRoute, /surfaceNotes\[nextBetaTarget\.surfaceId\]/);
  assert.match(qaRoute, /setSurfaceNotes/);
  assert.match(qaRoute, /nextBetaTargetMissingEvidence\.some\(\(item\) => item\.includes\("QA note"\)\)/);
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
  assert.match(qaRoute, /markSurface\(nextBetaTarget\.surfaceId, "needs-review"\)/);
  assert.match(qaRoute, /minHeight: MIN_MOBILE_TOUCH_TARGET/);
  for (const styleName of [
    "betaRunPlatformOption",
    "betaRunPrimary",
    "betaRunSecondary",
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
  assert.match(qaRoute, /qaReturn=care-twin-qa/);
  assert.match(qaRoute, /qaSurface=\$\{encodeURIComponent\(surfaceId\)\}/);
  assert.match(qaRoute, /qaTitle=\$\{encodeURIComponent\(target\.title\)\}/);
  assert.match(qaRoute, /accessibilityLabel=\{[\s\S]*Open next beta QA surface:/);
  assert.match(boardPrimitives, /useLocalSearchParams/);
  assert.match(boardPrimitives, /qaReturn === "care-twin-qa"/);
  assert.match(boardPrimitives, /Return to QA Cockpit/);
  assert.match(boardPrimitives, /Capture done\? Attach proof/);
  assert.match(boardPrimitives, /router\.push\("\/care-twin-qa" as never\)/);
  assert.match(boardPrimitives, /qaReturnBanner/);
  assert.doesNotMatch(qaRoute, /releaseSummary\.missingScreenshots === 0 \? colors\.sage : colors\.amber/);
  assert.match(qaSession, /careTwinEvidenceById/);
  assert.match(qaSession, /surfaceEvidenceById/);
  assert.match(qaSession, /cleanQaScreenshotEvidence/);
  assert.match(qaSession, /screenshotEvidence/);
  assert.match(releaseQa, /attachedScreenshots/);
  assert.match(releaseQa, /requiredIosScreenshots/);
  assert.match(releaseQa, /attachedIosScreenshots/);
  assert.match(releaseQa, /missingAndroidScreenshots/);
  assert.match(releaseQa, /mobileReleaseQaScreenshotEvidenceComplete/);
  assert.match(releaseQa, /formatMobileReleaseQaPlatformEvidence/);
  assert.match(releaseQa, /formatMobileReleaseQaMissingEvidence/);
  assert.match(releaseQa, /Platform evidence: \$\{formatMobileReleaseQaPlatformEvidence\(summary\)\}/);
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
});

test("keeps Expo app identity release-grade", () => {
  const appConfig = JSON.parse(
    readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "app.json"), "utf8"),
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
  const easPath = join(process.cwd(), "artifacts", "woofwatcher-mobile", "eas.json");

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
  const runbookPath = join(process.cwd(), "docs", "release", "MOBILE_RELEASE_RUNBOOK.md");

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
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "components", "LivingPhoenixRoom.tsx"),
    "utf8",
  );
  const lifeEngine = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "avatarLifeEngine.ts"),
    "utf8",
  );
  const spritePlayer = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "components", "SpriteSheetPlayer.tsx"),
    "utf8",
  );
  const choreography = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "careTwinChoreography.ts"),
    "utf8",
  );
  const careTwinAssets = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "careTwinAssets.ts"),
    "utf8",
  );

  assert.match(home, /LivingPhoenixRoom/);
  assert.match(home, /deriveAvatarMotion/);
  assert.match(home, /avatarMotion\.speech/);
  assert.match(home, /setRoomReaction/);
  assert.match(home, /roomTapChoreography/);
  assert.match(home, /tapReaction\.action/);
  assert.match(home, /deriveCareTwinChoreography\(deriveCareTwinScene\(avatarMotion\)\)/);
  assert.match(home, /avatarMotion\.line/);
  assert.match(home, /Phoenix Room/);
  assert.match(home, /heroStudioButton/);
  assert.doesNotMatch(home, /avatarIdentityBar/);
  assert.match(room, /<Text style=\{styles\.liveText\}>PHOENIX ROOM<\/Text>/);
  assert.match(room, /reactionProgress/);
  assert.match(room, /energyBlocks/);
  assert.match(room, /statusReadouts\?\.slice\(0, 4\)/);
  assert.match(room, /Phoenix room/);
  assert.match(room, /deriveCareTwinScene/);
  assert.match(room, /plan\.tapVerb/);
  assert.match(room, /plan\.recommendedActionLabel/);
  assert.match(room, /plan\.scenePhase/);
  assert.match(room, /SpriteSheetPlayer/);
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
  assert.match(careTwinAssets, /CARE_TWIN_SPRITE_ASSETS/);
  assert.match(careTwinAssets, /CARE_TWIN_DOGLESS_ROOM_ASSETS/);
  assert.match(careTwinAssets, /dogless-room-layer/);
  assert.match(careTwinAssets, /listCareTwinSpriteSlots/);
  assert.match(careTwinAssets, /option-b-idle-tail-wag-strip\.png/);
  assert.match(careTwinAssets, /option-b-walk-loop-strip\.png/);
  assert.match(careTwinAssets, /option-b-ear-perk-strip\.png/);
  assert.match(careTwinAssets, /option-b-bark-reaction-strip\.png/);
  assert.match(careTwinAssets, /option-b-eat-loop-strip\.png/);
  assert.match(careTwinAssets, /option-b-drink-loop-strip\.png/);
  assert.match(careTwinAssets, /option-b-sleep-loop-strip\.png/);
  assert.match(careTwinAssets, /option-b-comfort-loop-strip\.png/);
  assert.match(careTwinAssets, /option-b-health-watch-strip\.png/);
  assert.match(careTwinAssets, /option-b-celebrate-hop-strip\.png/);
  assert.doesNotMatch(room, /PhoenixSpriteRig/);
  assert.doesNotMatch(room, /SPRITE LOOP/);
  assert.doesNotMatch(room, /deriveAvatarSpritePlan/);
  assert.doesNotMatch(room, /phoenix\/cutout/);
  assert.doesNotMatch(room, /speechWrap/);
});

test("keeps Home organized around real care-RPG missions, not decorative cards", () => {
  const home = readAppFile(join("(tabs)", "index.tsx"));
  const missionDeck = readMobileLibFile("homeMissionDeck.ts");
  const missionLayout = readMobileLibFile("homeMissionLayout.ts");
  const releaseQa = readMobileLibFile("mobileReleaseQa.ts");

  assert.match(home, /buildHomeMissionDeck/);
  assert.match(home, /getHomeMissionDeckLayout/);
  assert.match(home, /useWindowDimensions/);
  assert.match(home, /missionLayout\.qaLabel/);
  assert.match(home, /missionLayout\.detailLines/);
  assert.match(home, /homeMissions/);
  assert.match(home, /Today's Missions/);
  assert.match(home, /Care RPG/);
  assert.match(home, /router\.push\(mission\.route as never\)/);
  assert.match(home, /\/log\?type=meal/);
  assert.match(home, /\/calendar/);
  assert.match(home, /\/adventure/);
  assert.match(home, /\/health/);

  assert.match(missionDeck, /care-today/);
  assert.match(missionDeck, /\/records/);
  assert.match(missionDeck, /Open loop/);
  assert.match(missionDeck, /Start quest/);
  assert.match(missionDeck, /Care Pass/);
  assert.match(missionDeck, /No mission in this deck should pretend to be live cloud sync/);

  assert.match(missionLayout, /compact/);
  assert.match(missionLayout, /estimatedDeckHeight/);
  assert.match(missionLayout, /Small-phone/);

  assert.match(releaseQa, /home-mission-deck/);
  assert.match(releaseQa, /compact Home mission deck/);
  assert.match(releaseQa, /pending meal routes to Meal Log/);
  assert.match(releaseQa, /floating paw nav/);
});

test("keeps care intelligence wired across Home, Log, More, and the shared domain layer", () => {
  const domain = readFileSync(join(process.cwd(), "lib", "care-domain", "src", "care-intelligence.ts"), "utf8");
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
  assert.match(log, /deriveCareIntelligence/);
  assert.match(log, /Care IQ/);
  assert.match(log, /careIntelligence\.status/);
  assert.match(more, /deriveCareIntelligence/);
  assert.match(more, /Care Intelligence/);
  assert.match(more, /careIntelligence\.metrics/);
  assert.match(more, /careIntelligence\.nextAction/);
});

test("keeps Health tab wired to non-diagnostic Health Watch and Bile Watch", () => {
  const health = readAppFile(join("(tabs)", "health.tsx"));

  for (const styleName of ["tabPill", "heroActionPrimary", "heroActionSecondary"]) {
    assertStyleUsesSharedTouchTarget(health, styleName);
  }

  assert.match(health, /deriveHealthWatch/);
  assert.match(health, /Health Watch/);
  assert.match(health, /Bile Watch/);
  assert.match(health, /Health score/);
  assert.match(health, /Health Snapshot/);
  assert.match(health, /Pattern Board/);
  assert.match(health, /Log health note/);
  assert.match(health, /7-day bile log/);
  assert.match(health, /accessibilityState=\{\{ selected: active \}\}/);
  assert.match(health, /Not veterinary advice/);
});

test("locks the mobile pixel UI foundation to Apollo's reference boards", () => {
  const colors = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "constants", "colors.ts"),
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
  assert.match(colors, /#FFF9EF/);
  assert.match(colors, /#A8CBE8/);
  assert.match(colors, /pixelUi/);
  assert.ok(existsSync(primitivesPath), "board primitives should exist");

  const primitives = readFileSync(primitivesPath, "utf8");
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
  assert.match(tabs, /tabBarActiveBackgroundColor/);
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

  for (const exportedName of ["BoardRouteHeader", "BoardPill", "BoardMetricTile"]) {
    assert.match(primitives, new RegExp(`export function ${exportedName}`));
  }

  for (const [route, source] of Object.entries(coreRoutes)) {
    assert.match(source, /@\/components\/board\/BoardPrimitives/, `${route} should import board primitives`);
    assert.match(source, /BoardRouteHeader/, `${route} should use the shared route header`);
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
    assert.match(source, /BoardCard/, `${route} should use shared BoardCard sections`);
  }

  assert.match(log, /<BoardCard[\s\S]*style=\{s\.composerHero/);
  assert.match(log, /<BoardCard[\s\S]*BoardSectionHeader title="Choose care type"/);
  assert.match(plans, /<BoardCard[\s\S]*BoardSectionHeader title="Upcoming Events"/);
  assert.match(records, /<BoardCard[\s\S]*WOOFWATCHER DOG ID/);
});

test("keeps Quick Log composer card boundaries separate from search controls", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const composerBlock = log.slice(log.indexOf("{/* Composer card */}"), log.indexOf("{/* Today at a glance */}"));
  const searchBlock = log.slice(log.indexOf("{/* Search and filters */}"), log.indexOf("{/* Timeline */}"));

  assert.match(composerBlock, /<BoardCard[\s\S]*<\/BoardCard>/);
  assert.match(composerBlock, /style=\{s\.composerHero/);
  assert.match(composerBlock, /BoardSectionHeader title="Choose care type"/);
  assert.doesNotMatch(composerBlock, /title="Find care logs"/);
  assert.match(searchBlock, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Find care logs"[\s\S]*<\/BoardCard>/);
  assert.doesNotMatch(searchBlock, /BoardSectionHeader title="Choose care type"/);
});

test("keeps Quick Log polished for exact tap selection and mobile scanability", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(log, /launcherActionKey/);
  assert.match(log, /selectedLauncherKey === launcherActionKey\(action\)/);
  assert.match(log, /accessibilityState=\{\{ selected: active \}\}/);
  assert.match(log, /width: "31\.5%"/);
  assert.match(log, /composerTrustRail/);
  assert.match(log, /Care IQ/);
  assert.match(log, /moodTone/);
  assert.match(log, /flexBasis: "47\.5%"/);
  assert.match(log, /buildQuickLogEntry/);
  assert.match(log, /getQuickLogPolicy/);
  assert.match(log, /handleQuickLauncherAction/);
  assert.match(log, /openDetailedLauncherAction/);
  assert.match(log, /onLongPress=\{\(\) => openDetailedLauncherAction\(action\)\}/);
  assert.match(log, /\{ label: "Potty", type: "potty"/);
  assert.doesNotMatch(log, /\{ label: "Pee", type: "potty"/);
  assert.doesNotMatch(log, /\{ label: "Poo", type: "potty"/);
  assert.match(log, /Undo/);
  assert.match(log, /Add details/);
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
  ]) {
    assertStyleUsesSharedTouchTarget(log, styleName);
  }
});

test("keeps Quick Log search and timeline on shared board card anatomy", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(log, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Today at a glance"/);
  assert.match(log, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Find care logs"/);
  assert.match(log, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title=\{g\.label\}/);
  assert.match(log, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="No matching logs"/);
  assert.doesNotMatch(log, /searchCard:/);
  assert.doesNotMatch(log, /snapshotBar:/);
  assert.doesNotMatch(log, /dayCard:/);
});

test("keeps WoofGuide prompts and actions on shared board card anatomy", () => {
  const guide = readAppFile("woofguide.tsx");

  assert.match(guide, /<BoardCard style=\{s\.guideIntroCard\}/);
  assert.match(guide, /<BoardCard style=\{s\.quickQuestionBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Quick questions"/);
  assert.match(guide, /<BoardCard style=\{s\.actionBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Suggested actions"/);
  assert.match(guide, /Owner review required/);
  assert.doesNotMatch(guide, /quickRow:/);
  assert.doesNotMatch(guide, /actionArea:/);
  assert.doesNotMatch(guide, /actionCard:/);
  assert.doesNotMatch(guide, /quickChip: \{[^\n]*shadowOpacity/);
  assert.doesNotMatch(guide, /actionRow: \{[^\n]*shadowOpacity/);
});

test("keeps Premium value, plan, and entitlement surfaces on shared board anatomy", () => {
  const premium = readAppFile("premium.tsx");

  assert.match(premium, /@\/components\/board\/BoardPrimitives/);
  assert.match(premium, /<BoardCard style=\{s\.premiumBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Why upgrade"/);
  assert.match(premium, /BoardSectionHeader title="Plans" action="Checkout gated"/);
  assert.match(premium, /<BoardCard style=\{s\.entitlementCard\}[\s\S]*BoardSectionHeader[\s\S]*title="Launch entitlements"/);
  assert.match(premium, /function PlanCard[\s\S]*<BoardCard/);
  assert.match(premium, /Premium launch checklist/);
  assert.doesNotMatch(premium, /sectionHeader:/);
  assert.doesNotMatch(premium, /sectionTitle:/);
  assert.doesNotMatch(premium, /signalCard:/);
});

test("keeps Privacy export and launch safety surfaces on shared board anatomy", () => {
  const privacy = readAppFile("privacy.tsx");

  assert.match(privacy, /@\/components\/board\/BoardPrimitives/);
  assert.match(privacy, /<BoardCard style=\{s\.privacyBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Export summary"/);
  assert.match(privacy, /<BoardCard style=\{s\.privacyBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Support runbook"/);
  assert.match(privacy, /<BoardCard style=\{s\.privacyBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Launch safety gates"/);
  assert.match(privacy, /<BoardCard style=\{\[s\.noticeBoard/);
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
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "avatarStudio.ts"),
    "utf8",
  );
  const avatarTemplateAssets = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "avatarTemplateAssets.ts"),
    "utf8",
  );
  const avatarTemplateSpriteAssets = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "avatarTemplateSpriteAssets.ts"),
    "utf8",
  );
  const avatarPreviewModel = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "lib", "avatarPreviewModel.ts"),
    "utf8",
  );
  const avatarContext = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "context", "AvatarContext.tsx"),
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
    retriever: ["happy", "calm", "excited", "bored", "hungry", "anxious", "sleepy", "proud", "home-alone", "not-feeling-well"],
    husky: ["happy", "calm", "excited", "bored", "hungry", "anxious", "sleepy", "proud", "home-alone", "not-feeling-well"],
    bully: ["happy", "calm", "excited", "bored", "hungry", "anxious", "sleepy", "proud", "home-alone", "not-feeling-well"],
  };

  assert.match(avatarStudio, /<BoardCard padded=\{false\} style=\{\[s\.canvasCard/);
  assert.match(avatarStudio, /<BoardCard padded=\{false\} style=\{s\.heroPreview\}/);
  assert.match(avatarStudio, /<BoardCard style=\{s\.avatarBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Generated mood set"/);
  assert.match(avatarStudio, /<BoardCard style=\{s\.avatarBoard\}[\s\S]*BoardSectionHeader[\s\S]*title="Mood set"/);
  assert.match(avatarStudio, /<BoardCard style=\{s\.tipBoard\} tone="soft"/);
  assert.match(avatarStudio, /Upload photos to help us suggest your dog's pixel care twin/);
  assert.match(avatarStudio, /Choose base template/);
  assert.match(avatarStudio, /Accessories/);
  assert.match(avatarStudio, /Save Avatar/);
  assert.match(avatarStudio, /AVATAR_EMOTE_STATES/);
  assert.match(avatarStudio, /PIXEL_ROOM_SOURCE/);
  assert.match(avatarStudio, /LivingPhoenixRoom/);
  assert.match(avatarStudio, /deriveAvatarMotion/);
  assert.match(avatarStudio, /derivePhoenixStatus/);
  assert.match(avatarStudio, /getAvatarTemplateBaseSource\(draft\.templateId\)/);
  assert.match(avatarStudio, /getAvatarTemplateDisplaySource\(template\.id\)/);
  assert.match(avatarStudio, /templateHeroDogWrap/);
  assert.match(avatarStudio, /s\.templateArtWrap/);
  assert.match(avatarStudio, /phoenix-room-day-option-b\.png/);
  assert.match(avatarStudio, /phoenix-main-head-v2-crisp\.png/);
  assert.match(avatarStudio, /selectedTemplateStillSource/);
  assert.match(avatarStudio, /PHOTO REFERENCE/);
  assert.match(avatarStudio, /Building a pixel twin, not using the photo as the avatar/);
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
  assert.match(avatarStudio, /SpriteSheetPlayer/);
  assert.match(avatarStudio, /CARE_TWIN_SPRITE_MANIFEST/);
  assert.match(avatarStudio, /getCareTwinSpriteAsset/);
  assert.match(avatarStudio, /getAvatarTemplateSpritePreview/);
  assert.match(avatarStudio, /avatar-studio-live-sprite-preview/);
  assert.match(avatarStudio, /templateHeroDogGhost:\s*\{\s*opacity:\s*0/);
  assert.match(avatarStudio, /templatePixelFloor/);
  assert.match(avatarStudio, /templateLiveChip/);
  assert.match(avatarPreviewModel, /Animated Phoenix pack/);
  assert.match(avatarPreviewModel, /Live template sprite pack/);
  assert.match(avatarPreviewModel, /Starter still preview/);
  assert.match(avatarTemplateSpriteAssets, /AVATAR_TEMPLATE_SPRITE_ASSETS/);
  assert.match(avatarTemplateSpriteAssets, /hasAvatarTemplateSpritePack/);
  assert.match(avatarStudio, /liveTemplateCount/);
  assert.match(avatarStudio, /templateLiveBadge/);
  assert.match(avatarStudio, /Sprite rig in production/);
  assert.match(avatarTemplateAssets, /assets\/avatar\/templates\/shepherd\/preview-crisp\.png/);
  assert.match(avatarTemplateAssets, /assets\/avatar\/templates\/shepherd\/base-crisp\.png/);
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
      assert.match(avatarTemplateSpriteAssets, new RegExp(`assets/avatar/templates/${templateId}/sprites/${fileName}`));
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
  assert.match(avatarStudio, /getAvatarTemplateAccessorySource\(draft\.templateId, layer\.id\)/);
  assert.match(avatarStudio, /getAvatarTemplateEmoteSource\(draft\.templateId, previewEmote\)/);
  assert.match(avatarStudio, /templateBandana/);
  assert.match(avatarStudio, /templateVest/);
  assert.match(avatarStudio, /templateAccessoryLayer/);
  assert.match(avatarStudio, /Preview \$\{emoteLabel\(emote\)\} mood/);
  for (const [fileName, expected] of [
    ["phoenix-main-avatar-v2-crisp.png", { width: 680, height: 680 }],
    ["phoenix-main-head-v2-crisp.png", { width: 1024, height: 1024 }],
  ] as const) {
    const size = readPngSize(
      join(process.cwd(), "artifacts", "woofwatcher-mobile", "assets", "avatar", "phoenix", "approved", fileName),
    );
    assert.deepEqual(size, expected, `${fileName} should be a nearest-neighbor crisp Phoenix asset`);
  }
  for (const [fileName, expected] of [
    ["option-b-seated.png", { width: 170, height: 170 }],
    ["option-b-standing.png", { width: 170, height: 170 }],
    ["option-b-sleep-source.png", { width: 170, height: 170 }],
  ] as const) {
    const size = readPngSize(
      join(process.cwd(), "artifacts", "woofwatcher-mobile", "assets", "avatar", "phoenix", "candidates", fileName),
    );
    assert.deepEqual(size, expected, `${fileName} should stay archived as a PixelLab Option B source candidate`);
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
      join(process.cwd(), "artifacts", "woofwatcher-mobile", "assets", "avatar", "phoenix", "candidates", fileName),
    );
    assert.deepEqual(size, expected, `${fileName} should stay archived as an 8-frame Option B animation proof`);
  }
  for (const [fileName, expected] of [
    ["preview-crisp.png", { width: 340, height: 340 }],
    ["base-crisp.png", { width: 680, height: 680 }],
  ] as const) {
    const size = readPngSize(
      join(process.cwd(), "artifacts", "woofwatcher-mobile", "assets", "avatar", "templates", "shepherd", fileName),
    );
    assert.deepEqual(size, expected, `${fileName} should be a nearest-neighbor crisp shepherd asset`);
  }
  for (const templateId of templateIds) {
    const registryPreviewPath = templateId === "shepherd" ? "preview-crisp" : "preview";
    assert.match(
      avatarTemplateAssets,
      new RegExp(`${templateId}:[\\s\\S]*assets/avatar/templates/${templateId}/${registryPreviewPath}\\.png`),
    );
    const size = readPngSize(
      join(process.cwd(), "artifacts", "woofwatcher-mobile", "assets", "avatar", "templates", templateId, "preview.png"),
    );
    assert.deepEqual(size, { width: 85, height: 85 }, `${templateId} preview should be a PixelLab 85x85 thumbnail`);
  }
  for (const templateId of templateIds) {
    const registryBasePath = templateId === "shepherd" ? "base-crisp" : "base";
    assert.match(
      avatarTemplateAssets,
      new RegExp(`${templateId}:[\\s\\S]*assets/avatar/templates/${templateId}/${registryBasePath}\\.png`),
    );
    const size = readPngSize(
      join(process.cwd(), "artifacts", "woofwatcher-mobile", "assets", "avatar", "templates", templateId, "base.png"),
    );
    assert.deepEqual(size, { width: 170, height: 170 }, `${templateId} base should be a PixelLab 170x170 character base`);
  }
  for (const accessoryId of shepherdAccessoryIds) {
    assert.match(
      avatarTemplateAssets,
      new RegExp(`"${accessoryId}":[\\s\\S]*assets/avatar/templates/shepherd/accessories/${accessoryId}\\.png`),
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
    assert.deepEqual(size, { width: 170, height: 170 }, `${accessoryId} overlay should be a 170x170 transparent PNG`);
  }
  for (const emoteId of shepherdEmoteIds) {
    assert.match(
      avatarTemplateAssets,
      new RegExp(`${emoteId}:[\\s\\S]*assets/avatar/templates/shepherd/emotes/${emoteId}\\.png`),
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
    assert.deepEqual(size, { width: 170, height: 170 }, `${emoteId} emote should be a 170x170 transparent PNG`);
  }
  for (const [templateId, emoteIds] of Object.entries(templateEmotePacks)) {
    for (const emoteId of emoteIds) {
      assert.match(
        avatarTemplateAssets,
        new RegExp(`assets/avatar/templates/${templateId}/emotes/${emoteId}\\.png`),
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
      assert.deepEqual(size, { width: 170, height: 170 }, `${templateId} ${emoteId} emote should be a 170x170 transparent PNG`);
    }
  }
  assert.match(avatarModel, /PetAvatarConfig/);
  assert.match(avatarModel, /AVATAR_TEMPLATES/);
  assert.match(avatarModel, /buildMockScanSuggestion/);
  assert.match(avatarModel, /You always approve the match/);
  assert.doesNotMatch(avatarModel, /perfectly scan/i);
  assert.match(avatarContext, /AVATAR_CONFIG_KEY/);
  assert.match(avatarContext, /saveAvatarConfig/);
  assert.match(avatarContext, /hasConfiguredAvatar/);
  assert.match(avatarContext, /phoenix-main-avatar-v2\.png/);
  assert.match(avatarContext, /phoenix-home-alone-anxious-v2\.png/);
  assert.match(avatarContext, /phoenix-sleep-rest-v2\.png/);
  assert.doesNotMatch(avatarContext, /assets\/phoenix\/phoenix-happy\.png/);
  assert.match(home, /avatarTemplate\.label/);
  assert.match(home, /Open Avatar Studio/);
  assert.match(more, /Avatar Studio/);
  assert.doesNotMatch(more, /Portrait Studio/);
  assert.doesNotMatch(avatarStudio, /backBtn:/);
  assert.doesNotMatch(avatarStudio, /headerTitle:/);
  assert.doesNotMatch(avatarStudio, /heroPreview: \{[^\n]*(shadowOpacity|elevation)/);
  assert.doesNotMatch(avatarStudio, /canvasCard: \{[^\n]*(shadowOpacity|elevation)/);
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
    join(process.cwd(), "docs", "design", "pixellab", "PHASE_1_PHOENIX_IDENTITY_PROMPT.md"),
    "utf8",
  );
  const verifier = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "scripts", "verify-pixellab-assets.js"),
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
  assert.match(phaseOne, /Create no more than four Phoenix main-avatar identity candidates/);
  assert.match(phaseOne, /transparent background/);
  assert.match(verifier, /PixelLab asset check complete/);
  assert.match(verifier, /readUInt32BE\(16\)/);
  assert.match(verifier, /templateAccessories/);
  assert.match(verifier, /templateEmotes/);
  assert.match(blockers, /PixelLab secret hygiene/);
  assert.match(blockers, /Phoenix v2 seed\/state pack, full registered sprite manifest, active Option B dogless day room, PixelLab final-candidate night\/bedtime\/health-watch\/home-alone rooms, the full current Option B hard-pixel Phoenix runtime candidate family/);
  assert.match(blockers, /12 Avatar Studio template preview thumbnails, the full 12-template base still pack, the first shepherd accessory overlay PNG pack, the first shepherd 10-state emote still pack, and the Retriever, Husky\/Spitz, and Bully 10-state template emote packs now exist locally/);
  assert.doesNotMatch(pixelLab, /Bearer [0-9a-f-]{20,}/i);
});

test("keeps Setup onboarding on shared board anatomy", () => {
  const setup = readAppFile("setup.tsx");

  assert.match(setup, /@\/components\/board\/BoardPrimitives/);
  assert.match(setup, /<BoardRouteHeader[\s\S]*title="Set up WoofWatcher"/);
  assert.match(setup, /<BoardCard style=\{s\.progressCard\}[\s\S]*BoardSectionHeader[\s\S]*title="Setup progress"/);
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
  assert.doesNotMatch(setup, /header:/);
  assert.doesNotMatch(setup, /progressCard: \{[^\n]*(borderRadius|borderWidth|padding)/);
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

test("keeps Records Care Pass and reports on shared board card anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Care Pass"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Report History"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Progress Report"/);
});

test("keeps Records vault, diet, and cabinet on shared board card anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Record Vault"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Diet on File"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Records Cabinet"/);
});

test("keeps Records trend sections on shared board card anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Care Trends"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Weight Trend"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Mood Trend"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Hydration"/);
});

test("keeps Records dog ID heading on shared board section anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /<BoardSectionHeader[\s\S]*title=\{`\$\{credential\.name\} ID Card`\}/);
  assert.match(records, /<BoardCard tone="navy" padded=\{false\} style=\{s\.idCard\}/);
});

test("keeps Records activity and potty sections on shared board card anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Walk Activity"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Training Progress"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Potty Health"/);
});

test("keeps Records watch, grooming, and medication sections on shared board card anatomy", () => {
  const records = readAppFile(join("(tabs)", "records.tsx"));

  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Alone Time"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Grooming Care"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Incident Watch"/);
  assert.match(records, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Medication Plan"/);
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
  const carePass = readFileSync(join(process.cwd(), "lib", "care-domain", "src", "care-pass.ts"), "utf8");

  assert.match(records, /deriveWeightTrend/);
  assert.match(records, /weightTrend/);
  assert.match(records, /Weight Trend/);
  assert.match(carePass, /deriveWeightTrend/);
  assert.match(carePass, /Weight Trend/);
});

test("keeps grooming care visible from Log composer to Records and Care Pass reports", () => {
  const log = readAppFile(join("(tabs)", "log.tsx"));
  const records = readAppFile(join("(tabs)", "records.tsx"));
  const carePass = readFileSync(join(process.cwd(), "lib", "care-domain", "src", "care-pass.ts"), "utf8");

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
  const carePass = readFileSync(join(process.cwd(), "lib", "care-domain", "src", "care-pass.ts"), "utf8");

  assert.match(log, /type: "incident"/);
  assert.match(log, /incidentType/);
  assert.match(log, /incidentTrigger/);
  assert.match(log, /incidentExposure/);
  assert.match(log, /incidentInjury/);
  assert.match(log, /incidentAction/);
  assert.match(log, /incidentFollowUp/);
  assert.match(log, /Shared incident logs update Incident Watch, Care Pass, and trainer handoffs/);
  assert.match(records, /deriveIncidentWatch/);
  assert.match(records, /incidentWatch/);
  assert.match(records, /Incident Watch/);
  assert.match(records, /Trend signal/);
  assert.match(records, /Follow-up plan/);
  assert.match(records, /Trainer goals/);
  assert.match(records, /Open Incident Watch follow-up/);
  assert.match(records, /params: \{ type: "incident" \}/);
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
  const careContext = readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "context", "CareContext.tsx"), "utf8");
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(careContext, /deriveCareSyncOutbox/);
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
  assert.match(calendar, /reminderCount/);
});

test("routes Reminder Center rows to concrete care workflows", () => {
  const calendar = readAppFile(join("(tabs)", "calendar.tsx"));
  const log = readAppFile(join("(tabs)", "log.tsx"));

  assert.match(calendar, /openReminderAction/);
  assert.match(calendar, /openBoardRoutine\(routine\)/);
  assert.match(calendar, /router\.push\("\/records"\)/);
  assert.match(calendar, /pathname: "\/log"/);
  assert.match(calendar, /type: "grooming"/);
  assert.match(calendar, /accessibilityLabel=\{`Open reminder action: \$\{item\.label\}`\}/);
  assert.match(log, /useLocalSearchParams/);
  assert.match(log, /routeSelectedType/);
});

test("keeps Plans reminder and routine sections on shared board card anatomy", () => {
  const calendar = readAppFile(join("(tabs)", "calendar.tsx"));

  assert.match(calendar, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Reminder Center"/);
  assert.match(calendar, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Daily Routine"/);
  assert.doesNotMatch(calendar, /sectionHeader:/);
  assert.doesNotMatch(calendar, /sectionTitle:/);
  assert.doesNotMatch(calendar, /emptyCard:/);
  assert.doesNotMatch(calendar, /reminderCard:/);
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
  assert.match(log, /Search notes, caregivers, routes, meds/);
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
  const careContext = readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "context", "CareContext.tsx"), "utf8");

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
  const careContext = readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "context", "CareContext.tsx"), "utf8");

  assert.match(rootLayout, /name="adventure"/);
  assert.match(careContext, /adventureMemories: AdventureMemory\[\]/);
  assert.match(home, /deriveAdventureMode/);
  assert.match(home, /adventureMode/);
  assert.match(home, /Adventure Mode/);
  assert.match(home, /router\.push\("\/adventure" as never\)/);
  assert.match(adventure, /deriveAdventureMode/);
  assert.match(adventure, /buildAdventureMemoryDraft/);
  assert.match(adventure, /Private RPG/);
  assert.match(adventure, /Save Memory/);
  assert.match(adventure, /provider-gated/);
  assert.match(more, /Adventure Mode/);
  assert.match(more, /router\.push\("\/adventure"( as never)?\)/);
});

test("keeps CareTwin roster readiness visible without fake multi-dog switching", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));
  const careContext = readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "context", "CareContext.tsx"), "utf8");

  assert.match(careContext, /activePetId/);
  assert.match(careContext, /pets: PetProfile\[\]/);
  assert.match(more, /deriveCareTwinRoster/);
  assert.match(more, /buildCareTwinRosterDraft/);
  assert.match(more, /CareTwin Roster/);
  assert.match(more, /Add future dog/);
  assert.match(more, /provider-backed multi-dog care documents/);
  assert.match(more, /Multi-dog switching is staged/);
});

test("keeps More household, tools, and diet sections on shared board card anatomy", () => {
  const more = readAppFile(join("(tabs)", "more.tsx"));
  const launchModel = readMobileLibFile("launchReadiness.ts");
  const providerSetup = readMobileLibFile("launchProviderSetup.ts");
  const careContext = readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "context", "CareContext.tsx"), "utf8");

  assert.match(more, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="CareTwin Roster"/);
  assert.match(more, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Care Team"/);
  assert.match(more, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Household Access"/);
  assert.match(more, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Access Passes"/);
  assert.match(more, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="My Care Today"/);
  assert.match(more, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Responsibility Center"/);
  assert.match(more, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Sync Health"/);
  assert.match(more, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Launch Readiness"/);
  assert.match(more, /deriveAttachmentManifest/);
  assert.match(more, /deriveLaunchReadiness/);
  assert.match(more, /deriveSupportRunbookPlan/);
  assert.match(more, /deriveLaunchProviderSetup/);
  assert.match(more, /buildLaunchProviderSetupShareText/);
  assert.match(more, /buildReleasePacket/);
  assert.match(more, /buildReleasePacketShareText/);
  assert.match(more, /buildStoreSubmissionPacket/);
  assert.match(more, /buildStoreSubmissionPacketShareText/);
  assert.match(more, /storageQueue: attachmentManifest\.launchQueue/);
  assert.match(more, /supportRunbookOwnerReviewed/);
  assert.match(more, /launchReadinessPlan\.badgeLabel/);
  assert.match(more, /launchReadinessPlan\.summary/);
  assert.match(more, /launchReleasePacket\.betaShipStatus/);
  assert.match(more, /launchReleasePacket\.betaVerdictLabel/);
  assert.match(more, /launchReleasePacket\.betaSummary/);
  assert.match(more, /launchReleasePacket\.betaNextActions\.slice\(0, 3\)\.map/);
  assert.match(more, /accessibilityLabel=\{[\s\S]*Open beta device QA cockpit/);
  assert.match(more, /Open QA Cockpit/);
  assert.match(more, /Share Beta Packet/);
  assert.match(more, /launchReleasePacket\.readinessScore/);
  assert.match(more, /launchStoreSubmissionPacket\.verdictLabel/);
  assert.match(more, /Store Submission/);
  assert.match(more, /Provider Launch Setup/);
  assert.match(more, /Edit Provider Plan/);
  assert.match(more, /Share Provider Plan/);
  assert.match(more, /PROVIDER_SETUP_FIELDS\.every\(\(field\) => normalized\[field\.key\]\)/);
  assert.match(more, /Share Store Packet/);
  assert.match(more, /Share Launch Packet/);
  assert.match(more, /accessibilityLabel="Edit WoofWatcher provider launch setup"/);
  assert.match(more, /accessibilityLabel="Share WoofWatcher provider setup plan"/);
  assert.match(more, /accessibilityLabel="Share WoofWatcher release packet"/);
  assert.match(more, /accessibilityLabel="Share WoofWatcher store submission packet"/);
  assert.match(more, /Share\.share\(\{[\s\S]*message:\s*buildLaunchProviderSetupShareText\(launchProviderSetupPlan/);
  assert.match(more, /Share\.share\(\{ message: buildReleasePacketShareText\(launchReleasePacket\)/);
  assert.match(more, /Share\.share\(\{ message: buildStoreSubmissionPacketShareText\(launchStoreSubmissionPacket\)/);
  assert.match(careContext, /launchProviderProfile/);
  assert.match(providerSetup, /Provider Launch Setup/);
  assert.match(providerSetup, /No App Store or Play Store submission is approved by this checklist/);
  assert.match(launchModel, /storageQueue/);
  assert.match(launchModel, /local file/);
  assert.match(launchModel, /Device proof required/);
  assert.match(launchModel, /Native iOS\/Android QA evidence is not attached/);
  assert.match(launchModel, /Checkout gated/);
  assert.doesNotMatch(more, /Expo\/EAS profiles ready/);
  assert.match(more, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Tools & Sharing"/);
  assert.match(more, /<BoardCard[\s\S]*BoardSectionHeader[\s\S]*title="Diet Profile"/);
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
  assert.match(more, /buildMobileLaunchQaCaptureShareText/);
  assert.match(more, /buildMobileLaunchQaCapturePlan/);
  assert.match(more, /deriveNativeQaSummaryFromMobileQaSession/);
  assert.match(more, /savedNativeQaSummary/);
  assert.match(more, /setSavedNativeQaSummary/);
  assert.match(more, /nativeQaCapturePlan/);
  assert.match(more, /setNativeQaCapturePlan/);
  assert.match(more, /Native QA Next Captures/);
  assert.match(more, /Share QA Plan/);
  assert.match(more, /nativeQaCapturePlan\.nextTargets/);
  assert.match(more, /mobileLaunchQaCaptureTargetStatusLabel\(target\)/);
  assert.match(more, /Pass pending proof/);
  assert.match(more, /nativeQaCaptureHasProofPending/);
  assert.match(more, /Finish Proof/);
  assert.match(more, /nativeQaCaptureCockpitAction/);
  assert.match(more, /Share\.share\(\{[\s\S]*message:\s*buildMobileLaunchQaCaptureShareText\(nativeQaCapturePlan/);
  assert.match(more, /nativeQa:\s*savedNativeQaSummary/);
  assert.doesNotMatch(more, /nativeQa:\s*null/);
  assert.match(more, /router\.push\("\/care-twin-qa" as never\)/);

  assert.match(careTwinQaRoute, /buildMobileLaunchQaCaptureShareText/);
  assert.match(careTwinQaRoute, /buildMobileLaunchQaCaptureShareText\(betaCapturePlan,\s*reviewedAtIso\)/);
  assert.match(careTwinQaRoute, /buildMobileReleaseQaShareText\(releaseQaSurfaces,\s*releaseReviews,\s*reviewedAtIso\)/);

  assert.match(qaEvidence, /buildMobileLaunchQaCapturePlan/);
  assert.match(qaEvidence, /buildMobileLaunchQaCaptureShareText/);
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
    "nativeQaCaptureCockpitAction",
    "betaNextActionButton",
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
  const careContext = readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", "context", "CareContext.tsx"), "utf8");

  assert.match(careContext, /reconcileCareDocFromServer/);
  assert.match(careContext, /shouldPushLocal/);
  assert.match(careContext, /putCareState\(\{\s*version: plan\.version/);
});

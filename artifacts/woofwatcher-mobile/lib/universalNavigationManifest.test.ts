import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";

import { resolveCanonicalDestination } from "./navigationOwnership.ts";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const MOBILE_ROOT = join(ROOT, "artifacts", "woofwatcher-mobile");

const EXPECTED_PRIMARY_TABS = [
  { name: "index", label: "Home", parent: "home", route: "/" },
  { name: "log", label: "Log", parent: "log", route: "/log" },
  { name: "calendar", label: "Plans", parent: "plans", route: "/calendar" },
  { name: "health", label: "Health", parent: "health", route: "/health" },
  { name: "more", label: "More", parent: "more", route: "/more" },
] as const;

const EXPECTED_HEALTH_CHILDREN = [
  { parent: "health", section: "overview", label: "Overview", route: "/health?section=overview" },
  { parent: "health", section: "health-watch", label: "Health Watch", route: "/health?section=health-watch" },
  { parent: "health", section: "bile-watch", label: "Bile Watch", route: "/health?section=bile-watch" },
  { parent: "health", section: "medications", label: "Medications", route: "/health?section=medications" },
  { parent: "health", section: "diet", label: "Diet", route: "/health?section=diet" },
  { parent: "health", section: "trends", label: "Trends", route: "/health?section=trends" },
  { parent: "health", section: "records", label: "Records", route: "/health?section=records" },
  { parent: "health", section: "dog-id", label: "Dog ID", route: "/health?section=dog-id" },
  { parent: "health", section: "care-pass", label: "Care Pass", route: "/health?section=care-pass" },
] as const;

const EXPECTED_MORE_CHILDREN = [
  { parent: "more", section: "dog-profile", label: "Dog Profile", route: "/more?section=dog-profile" },
  { parent: "more", section: "avatar-studio", label: "Avatar Studio", route: "/more?section=avatar-studio" },
  { parent: "more", section: "care-team", label: "Care Team", route: "/more?section=care-team" },
  { parent: "more", section: "care-team-supplies", label: "Care Team & Supplies", route: "/more?section=care-team-supplies" },
  { parent: "more", section: "story-progress", label: "Story & Progress", route: "/more?section=story-progress" },
  { parent: "more", section: "adventure", label: "Adventure", route: "/more?section=adventure" },
  { parent: "more", section: "woofguide", label: "WoofGuide", route: "/more?section=woofguide" },
  { parent: "more", section: "settings", label: "Settings", route: "/more?section=settings" },
  { parent: "more", section: "privacy", label: "Privacy & Data", route: "/more?section=privacy" },
  { parent: "more", section: "legal", label: "Legal", route: "/more?section=legal" },
] as const;

const EXPECTED_REQUIRED_LEGACY_REDIRECTS = [
  { route: "/records", canonicalRoute: "/health?section=records", parent: "health", required: true },
  { route: "/reminders", canonicalRoute: "/calendar", parent: "plans", required: true },
  { route: "/pack", canonicalRoute: "/more?section=care-team-supplies", parent: "more", required: true },
  { route: "/story", canonicalRoute: "/more?section=story-progress", parent: "more", required: true },
  { route: "/profile", canonicalRoute: "/more?section=dog-profile", parent: "more", required: true },
  { route: "/portrait", canonicalRoute: "/more?section=avatar-studio", parent: "more", required: true },
  { route: "/adventure", canonicalRoute: "/more?section=adventure", parent: "more", required: true },
  { route: "/woofguide", canonicalRoute: "/more?section=woofguide", parent: "more", required: true },
  { route: "/privacy", canonicalRoute: "/more?section=privacy", parent: "more", required: true },
  { route: "/legal", canonicalRoute: "/more?section=legal", parent: "more", required: true },
] as const;

const EXPECTED_LIVE_PREVIEW_SUPPLEMENTAL_ROUTES = [
  "/sign-in",
  "/setup",
  "/care-twin-qa?qaSurface=auth-setup-onboarding-proof",
  "/care-twin-qa?qaSurface=records-local-file-handoff",
  "/care-twin-qa?qaSurface=report-binary-export-proof",
  "/care-twin-qa?qaSurface=care-entry-provider-sync-proof",
  "/care-twin-qa?qaSurface=woofguide-ai-provider-proof",
  "/care-twin-qa?qaSurface=push-notifications-proof",
  "/care-twin-qa?qaSurface=payments-provider-proof",
  "/care-twin-qa?qaSurface=store-accounts-proof",
  "/care-twin-qa?qaSurface=account-deletion-proof",
  "/care-twin-qa?qaSurface=support-legal-readiness-proof",
  "/care-twin-qa?qaSurface=route-visual-consistency",
] as const;

const EXPECTED_LEGACY_ALIAS_ROUTES = [
  "/health?tab=health",
  "/health?tab=bile",
  "/more?section=diet",
  "/more?section=care-pass",
  "/more?section=carepass",
  "/more?section=household",
  "/more?section=access",
  "/more?section=career",
] as const;

function routeInput(route: string): {
  pathname: string;
  params: Readonly<Record<string, string>>;
} {
  const url = new URL(route, "https://woofwatcher.test");
  return {
    pathname: url.pathname,
    params: Object.fromEntries(url.searchParams.entries()),
  };
}

function normalizedRoute(route: string): string {
  const input = routeInput(route);
  const query = new URLSearchParams(
    Object.entries(input.params).sort(([left], [right]) => left.localeCompare(right)),
  ).toString();
  return query ? `${input.pathname}?${query}` : input.pathname;
}

function serializedDestination(destination: ReturnType<typeof resolveCanonicalDestination>): string {
  const query = new URLSearchParams(
    Object.entries(destination.params ?? {}).sort(([left], [right]) => left.localeCompare(right)),
  ).toString();
  return query ? `${destination.pathname}?${query}` : destination.pathname;
}

test("publishes one typed universal-navigation QA contract", async () => {
  const model = await import("./universalNavigationManifest.ts");
  const manifest = model.UNIVERSAL_NAVIGATION_MANIFEST;

  assert.deepEqual(manifest.primaryTabs, EXPECTED_PRIMARY_TABS);
  assert.deepEqual(manifest.canonicalChildren.filter((item) => item.parent === "health"), EXPECTED_HEALTH_CHILDREN);
  assert.deepEqual(manifest.canonicalChildren.filter((item) => item.parent === "more"), EXPECTED_MORE_CHILDREN);
  assert.deepEqual(
    manifest.legacyRedirects.filter((item) => item.required),
    EXPECTED_REQUIRED_LEGACY_REDIRECTS,
  );
  assert.deepEqual(
    manifest.legacyRedirects.filter((item) => !item.required),
    [{ route: "/trends", canonicalRoute: "/health?section=trends", parent: "health", required: false }],
  );
  assert.deepEqual(manifest.legacyAliases.map((item) => item.route), EXPECTED_LEGACY_ALIAS_ROUTES);
  assert.deepEqual(manifest.runtimeSupplementalRoutes, ["/sign-in", "/setup", "/care-twin-qa", "/premium"]);
  assert.deepEqual(manifest.livePreviewSupplementalRoutes, EXPECTED_LIVE_PREVIEW_SUPPLEMENTAL_ROUTES);

  const tabModel = await import("./universalTabBar.ts");
  assert.deepEqual(
    tabModel.UNIVERSAL_PRIMARY_TABS,
    manifest.primaryTabs.map(({ name, label, parent }) => ({ name, label, parent })),
    "the visible tab model must be derived from or executable-equal to the QA manifest",
  );
});

test("runtime and live-preview checks consume the same navigation route inventory", () => {
  const runtimeScriptPath = join(MOBILE_ROOT, "scripts", "smoke-runtime-preview.js");
  const livePreviewScriptPath = join(MOBILE_ROOT, "scripts", "live-preview-handoff-proof.js");
  const runtimeSource = readFileSync(runtimeScriptPath, "utf8");
  const livePreviewSource = readFileSync(livePreviewScriptPath, "utf8");

  assert.match(runtimeSource, /universal-navigation-manifest\.js/);
  assert.match(livePreviewSource, /universal-navigation-manifest\.js/);
  assert.doesNotMatch(runtimeSource, /const MOBILE_RUNTIME_SMOKE_ROUTES\s*=\s*\[/);
  assert.doesNotMatch(livePreviewSource, /const LIVE_PREVIEW_HANDOFF_ROUTES\s*=\s*\[/);

  const runtime = require("../scripts/smoke-runtime-preview.js");
  const livePreview = require("../scripts/live-preview-handoff-proof.js");
  assert.strictEqual(
    runtime.UNIVERSAL_NAVIGATION_QA_ROUTES,
    livePreview.UNIVERSAL_NAVIGATION_QA_ROUTES,
    "both checks should use the adapter's one cached route inventory",
  );

  assert.deepEqual(runtime.MOBILE_RUNTIME_SMOKE_ROUTES, [
    ...new Set([
      ...runtime.UNIVERSAL_NAVIGATION_QA_ROUTES,
      ...runtime.UNIVERSAL_NAVIGATION_MANIFEST.runtimeSupplementalRoutes,
    ]),
  ]);
  assert.deepEqual(livePreview.LIVE_PREVIEW_HANDOFF_ROUTES, [
    ...new Set([
      ...livePreview.UNIVERSAL_NAVIGATION_QA_ROUTES,
      ...livePreview.UNIVERSAL_NAVIGATION_MANIFEST.livePreviewSupplementalRoutes,
    ]),
  ]);
  assert.equal(new Set(runtime.MOBILE_RUNTIME_SMOKE_ROUTES).size, runtime.MOBILE_RUNTIME_SMOKE_ROUTES.length);
  assert.equal(new Set(livePreview.LIVE_PREVIEW_HANDOFF_ROUTES).size, livePreview.LIVE_PREVIEW_HANDOFF_ROUTES.length);

  for (const route of runtime.UNIVERSAL_NAVIGATION_QA_ROUTES as readonly string[]) {
    assert.ok(runtime.MOBILE_RUNTIME_SMOKE_ROUTES.includes(route), `runtime: ${route}`);
    assert.ok(livePreview.LIVE_PREVIEW_HANDOFF_ROUTES.includes(route), `live preview: ${route}`);
  }
  for (const { route } of EXPECTED_REQUIRED_LEGACY_REDIRECTS) {
    assert.ok(runtime.UNIVERSAL_NAVIGATION_QA_ROUTES.includes(route), route);
  }

  for (const route of ["/sign-in", "/setup", "/care-twin-qa", "/premium"] as const) {
    assert.equal(runtime.MOBILE_RUNTIME_SMOKE_ROUTES.filter((item: string) => item === route).length, 1, route);
  }
  for (const route of EXPECTED_LIVE_PREVIEW_SUPPLEMENTAL_ROUTES) {
    assert.equal(livePreview.LIVE_PREVIEW_HANDOFF_ROUTES.filter((item: string) => item === route).length, 1, route);
  }
});

test("every manifest redirect and alias matches the hardened canonical resolver", async () => {
  const { UNIVERSAL_NAVIGATION_MANIFEST: manifest } = await import("./universalNavigationManifest.ts");

  for (const item of [...manifest.legacyRedirects, ...manifest.legacyAliases]) {
    const resolved = resolveCanonicalDestination(routeInput(item.route));
    assert.equal(resolved.parent, item.parent, `${item.route} selected parent`);
    assert.equal(resolved.replace, true, `${item.route} must replace`);
    assert.equal(
      serializedDestination(resolved),
      normalizedRoute(item.canonicalRoute),
      `${item.route} canonical destination`,
    );
  }

  for (const child of manifest.canonicalChildren) {
    const resolved = resolveCanonicalDestination(routeInput(child.route));
    assert.equal(resolved.parent, child.parent, `${child.route} selected parent`);
    assert.equal(resolved.replace, false, `${child.route} is already canonical`);
    assert.equal(serializedDestination(resolved), normalizedRoute(child.route), child.route);
  }
});

test("build:ci runs the PixelLab audit before exporting the mobile shell", () => {
  const rootPackage = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  const command = rootPackage.scripts["build:ci"] ?? "";
  const assetAudit = "woofwatcher-mobile run verify:pixellab-assets";
  const exportSmoke = "woofwatcher-mobile run smoke:web";

  assert.ok(command.includes(assetAudit), "build:ci must execute the PixelLab verifier");
  assert.ok(command.includes(exportSmoke), "build:ci must retain Expo export smoke");
  assert.ok(command.indexOf(assetAudit) < command.indexOf(exportSmoke), "asset verification must precede export");
});

test("active navigation instructions use the five-tab contract and reserve rendered proof", () => {
  const qaPlan = readFileSync(join(ROOT, "docs", "QA_TEST_PLAN.md"), "utf8");
  const runbook = readFileSync(join(ROOT, "docs", "release", "MOBILE_RELEASE_RUNBOOK.md"), "utf8");
  const uiNotes = readFileSync(join(ROOT, "docs", "design", "UI_IMPLEMENTATION_NOTES.md"), "utf8");
  const activeDocs = [qaPlan, runbook, uiNotes];

  for (const source of activeDocs) {
    assert.match(source, /Home, Log, Plans, Health, More/);
    assert.match(source, /Care Team & Supplies/);
    assert.match(source, /Story & Progress/);
    assert.match(source, /48.{0,12}(?:px|point)|48.{0,12}touch target/is);
  }

  assert.match(qaPlan, /Static HTTP.{0,80}shell availability/is);
  assert.match(qaPlan, /selected parent.{0,120}Back.{0,120}history/is);
  assert.match(qaPlan, /VoiceOver.{0,120}TalkBack/is);
  for (const { route } of EXPECTED_REQUIRED_LEGACY_REDIRECTS) {
    assert.ok(qaPlan.includes(`\`${route}\``), `QA plan must name ${route}`);
  }

  assert.doesNotMatch(runbook, /Bottom tab target sizes: at least 44px equivalent/);
  assert.doesNotMatch(runbook, /Verify first-run[^\n]*Plan, Story, Pack/);
  assert.match(runbook, /physical.{0,80}VoiceOver.{0,120}TalkBack/is);
  assert.match(uiNotes, /legacy URL/i);
  assert.match(uiNotes, /selected state.{0,80}shape.{0,80}color/is);
});

test("active setup copy names the canonical five-tab shell", () => {
  const setup = readFileSync(join(MOBILE_ROOT, "app", "setup.tsx"), "utf8");

  assert.doesNotMatch(setup, /gives Today, Log, Reports, Records/);
  assert.doesNotMatch(setup, /Continue to Today/);
  assert.match(setup, /gives Home, Log, Plans, Health, and More/);
  assert.match(setup, /Continue to Home/);
});

test("active Home accessibility and help copy names canonical destinations", () => {
  const home = readFileSync(
    join(MOBILE_ROOT, "app", "(tabs)", "index.tsx"),
    "utf8",
  );
  const homeRoutinePlan = readFileSync(
    join(MOBILE_ROOT, "lib", "homeRoutinePlan.ts"),
    "utf8",
  );

  for (const retiredPattern of [
    /Open the Pack/,
    /Loading Today/,
    /Today, Log, and Records/,
    /\bin Plan(?!s)\b/,
    /\bPlan tab\b/,
    /\b(?:Open|Review|Opens) Plan(?!s)\b/,
    /Open Story\./,
  ]) {
    assert.doesNotMatch(home, retiredPattern);
  }
  assert.doesNotMatch(homeRoutinePlan, /correction in Plan(?!s)\./);
  assert.match(home, /Open Care Team & Supplies/);
  assert.match(home, /Loading Home/);
  assert.match(home, /Home, Log, and Health/);
  assert.match(home, /Open Plans\./);
  assert.match(home, /Review Plans\./);
  assert.match(home, /Opens Plans to correct saved routine times/);
  assert.match(home, /Plans tab/);
  assert.match(home, /Open Story & Progress\./);
});

test("the visible More supplies row matches its canonical manifest child", async () => {
  const { MORE_DIRECTORY_GROUPS } = await import("./moreDirectory.ts");
  const { UNIVERSAL_NAVIGATION_MANIFEST: manifest } = await import(
    "./universalNavigationManifest.ts"
  );

  const suppliesChild = manifest.canonicalChildren.find(
    (item) => item.parent === "more" && item.section === "care-team-supplies",
  );
  const suppliesDirectoryItem = MORE_DIRECTORY_GROUPS.flatMap(
    (group) => group.items,
  ).find((item) => item.destination.section === "care-team-supplies");
  assert.equal(suppliesDirectoryItem?.label, suppliesChild?.label);
  assert.equal(
    suppliesDirectoryItem?.detail,
    "Household supply inventory and travel checklists.",
  );
});

test("active release-boundary and Adventure copy names real shell owners", () => {
  const ownerBoundary = readFileSync(
    join(MOBILE_ROOT, "components", "board", "OwnerOpsBoundary.tsx"),
    "utf8",
  );
  const adventure = readFileSync(
    join(MOBILE_ROOT, "components", "more", "AdventureScreen.tsx"),
    "utf8",
  );

  assert.doesNotMatch(ownerBoundary, /Today, Log,\s*Plan, Pack, and Story/);
  assert.doesNotMatch(ownerBoundary, /Back to Today/);
  assert.doesNotMatch(ownerBoundary, /router\.canGoBack\(\)|router\.back\(\)/);
  assert.match(ownerBoundary, /Home, Log,\s*Plans, Health, and More/);
  assert.match(ownerBoundary, /Back to Home/);
  assert.match(ownerBoundary, /replaceWithCanonicalHome\(router\)/);

  assert.doesNotMatch(adventure, /lives on Pack and More/);
  assert.doesNotMatch(adventure, /Pack, More, and Story/);
  assert.match(adventure, /appears in More and Story & Progress/);
});

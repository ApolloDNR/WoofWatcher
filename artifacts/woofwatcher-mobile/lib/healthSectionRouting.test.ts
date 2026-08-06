import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");
const HEALTH_ROUTE_PATH = join(MOBILE_ROOT, "app", "(tabs)", "health.tsx");
const RECORDS_ROUTE_PATH = join(MOBILE_ROOT, "app", "(tabs)", "records.tsx");
const TRENDS_ROUTE_PATH = join(MOBILE_ROOT, "app", "trends.tsx");
const MORE_ROUTE_PATH = join(MOBILE_ROOT, "app", "(tabs)", "more.tsx");
const RECORDS_SCREEN_PATH = join(MOBILE_ROOT, "components", "health", "RecordsScreen.tsx");
const HEALTH_ROUTER_PATH = join(MOBILE_ROOT, "components", "health", "HealthSectionRouter.tsx");

async function readRoutingModule() {
  return import("./healthSectionRouting.ts");
}

test("maps every canonical Health section to one closed substantive owner", async () => {
  const { HEALTH_SECTION_TARGETS } = await readRoutingModule();
  assert.deepEqual(HEALTH_SECTION_TARGETS, {
    overview: { kind: "core", section: "overview" },
    "health-watch": { kind: "core", section: "health-watch" },
    "bile-watch": { kind: "core", section: "bile-watch" },
    medications: { kind: "core", section: "medications" },
    diet: { kind: "diet" },
    trends: { kind: "trends" },
    records: { kind: "records", section: "records" },
    "dog-id": { kind: "records", section: "dog-id" },
    "care-pass": { kind: "records", section: "care-pass" },
  });
  assert.doesNotMatch(JSON.stringify(HEALTH_SECTION_TARGETS), /\/records|\/trends/);
});

test("resolves canonical Records identifiers after navigation validation", async () => {
  const { resolveHealthSectionRoute } = await readRoutingModule();
  assert.deepEqual(
    resolveHealthSectionRoute({
      section: "records",
      entry: ["entry_1", "ignored"],
      report: "report:weekly",
    }),
    {
      destination: {
        parent: "health",
        pathname: "/health",
        params: {
          section: "records",
          entry: "entry_1",
          report: "report:weekly",
        },
        replace: false,
      },
      section: "records",
      target: { kind: "records", section: "records" },
      entryId: "entry_1",
      reportId: "report:weekly",
    },
  );
});

test("drops Records identifiers from every non-Records target", async () => {
  const { resolveHealthSectionRoute } = await readRoutingModule();
  for (const section of [
    "overview",
    "health-watch",
    "bile-watch",
    "medications",
    "diet",
    "trends",
    "dog-id",
    "care-pass",
  ] as const) {
    const resolved = resolveHealthSectionRoute({
      section,
      entry: "entry_1",
      report: "report_1",
    });
    assert.equal(resolved.section, section);
    assert.equal(resolved.entryId, undefined, section);
    assert.equal(resolved.reportId, undefined, section);
    assert.equal(resolved.destination.params?.entry, undefined, section);
    assert.equal(resolved.destination.params?.report, undefined, section);
  }
});

test("converges legacy and invalid Health input without reflecting raw values", async () => {
  const { resolveHealthSectionRoute } = await readRoutingModule();
  assert.deepEqual(resolveHealthSectionRoute({ tab: "bile" }), {
    destination: {
      parent: "health",
      pathname: "/health",
      params: { section: "bile-watch" },
      replace: true,
    },
    section: "bile-watch",
    target: { kind: "core", section: "bile-watch" },
  });

  assert.deepEqual(
    resolveHealthSectionRoute({
      section: "unknown",
      entry: "entry_1",
      report: "report_1",
    }),
    {
      destination: { parent: "health", pathname: "/health", replace: true },
      section: "overview",
      target: { kind: "core", section: "overview" },
    },
  );
});

test("gives the canonical Health route one wrapper and one substantive owner router", () => {
  assert.ok(existsSync(HEALTH_ROUTER_PATH), "HealthSectionRouter must exist");
  const route = readFileSync(HEALTH_ROUTE_PATH, "utf8");
  const router = readFileSync(HEALTH_ROUTER_PATH, "utf8");

  assert.match(route, /export default function HealthScreen\(\)/);
  assert.match(route, /function HealthCoreScreen\(\{/);
  assert.match(route, /resolveHealthSectionRoute\(params\)/);
  assert.match(route, /<Redirect href=\{redirectHref\}/);
  assert.match(route, /<HealthSectionRouter/);
  assert.match(route, /renderCoreSection=\{\(coreSection\) =>/);
  assert.match(route, /section === "bile-watch" \? "bile" : "health"/);
  assert.match(
    route,
    /const selectHealthTab = \(tab: "health" \| "bile"\)[\s\S]{0,320}pathname: "\/health"[\s\S]{0,160}"bile-watch"[\s\S]{0,80}"health-watch"/,
  );
  assert.match(route, /registerSectionAnchor\("medications"\)/);
  assert.match(route, /Opens Health Trends\./);
  assert.doesNotMatch(route, /Opens the weight trend in Records\./);

  assert.match(router, /import RecordsScreen from "@\/components\/health\/RecordsScreen"/);
  assert.match(router, /import TrendsScreen from "@\/components\/health\/TrendsScreen"/);
  assert.match(router, /import DietScreen from "@\/components\/health\/DietScreen"/);
  assert.match(router, /target\.kind === "core"/);
  assert.match(router, /target\.kind === "records"/);
  assert.match(router, /target\.kind === "trends"/);
  assert.match(router, /<DietScreen openDetails/);
  assert.doesNotMatch(router, /from "@\/app\/\(tabs\)\/health"/);
});

test("keeps legacy Records and Trends as replace-only compatibility routes", () => {
  for (const [label, path, pathname] of [
    ["Records", RECORDS_ROUTE_PATH, "/records"],
    ["Trends", TRENDS_ROUTE_PATH, "/trends"],
  ] as const) {
    const route = readFileSync(path, "utf8");
    assert.match(route, /useLocalSearchParams/);
    assert.match(route, /resolveCanonicalDestination/);
    assert.match(route, new RegExp(`pathname: "${pathname}"`));
    assert.match(route, /<Redirect href=\{redirectHref\}/);
    assert.doesNotMatch(route, /<RecordsScreen|<TrendsScreen|<Stack\.Screen/);
    assert.doesNotMatch(route, /deriveCareTrends|Records Command Vault/);
    assert.ok(route.length < 1_400, `${label} compatibility route must stay focused`);
  }
});

test("adds inert Records section props and stable owner anchors without thinning features", () => {
  const records = readFileSync(RECORDS_SCREEN_PATH, "utf8");
  assert.match(records, /export interface RecordsScreenProps/);
  assert.match(records, /section: RecordsHealthSection/);
  assert.match(records, /entryId\?: string/);
  assert.match(records, /reportId\?: string/);
  assert.match(records, /onBack: \(\) => void/);
  assert.match(records, /ref=\{scrollRef\}/);
  for (const section of ["records", "dog-id", "care-pass"] as const) {
    assert.match(records, new RegExp(`registerSectionAnchor\\("${section}"\\)`));
  }
  assert.match(
    records,
    /registerSectionAnchor\("dog-id"\)[\s\S]{0,160}Dog ID card/,
  );
  assert.match(records, /topPadding \+ anchorY - 8/);
  assert.match(records, /onBack=\{onBack\}/);
  assert.match(
    records,
    /title="Diet on File"[\s\S]{0,320}pathname: "\/health"[\s\S]{0,100}section: "diet"/,
  );
  assert.match(records, /Records Command Vault/);
  assert.match(records, /WOOFWATCHER DOG ID/);
  assert.match(records, /title="Care Pass"/);
  assert.match(records, /persistPickedMedia/);
  assert.equal((records.match(/\bupdateCareDoc\(/g) ?? []).length, 3);
});

test("removes More's Health-owned Diet and Care Pass duplicates", () => {
  assert.ok(existsSync(HEALTH_ROUTER_PATH), "HealthSectionRouter must exist");
  const more = readFileSync(MORE_ROUTE_PATH, "utf8");
  const router = readFileSync(HEALTH_ROUTER_PATH, "utf8");

  assert.match(more, /function MoreScreenContent\(\{/);
  assert.match(more, /resolveCanonicalDestination/);
  assert.match(more, /executeMoreDirectoryDestination/);
  assert.match(more, /<Redirect href=\{redirectHref\}/);
  assert.doesNotMatch(more, /import DietScreen|<DietScreen\b/);
  assert.doesNotMatch(more, /const generateCarePass =/);
  assert.match(more, /section: "records"/);
  assert.match(more, /section: "care-pass"/);
  assert.match(router, /<DietScreen openDetails/);
});

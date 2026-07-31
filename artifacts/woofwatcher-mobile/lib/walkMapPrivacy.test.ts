import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");
const RUNTIME_ROOTS = ["app", "components", "context", "hooks", "lib"] as const;

function runtimeSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return runtimeSourceFiles(path);
    if (
      !/\.(?:ts|tsx)$/.test(entry.name) ||
      /\.test\.(?:ts|tsx)$/.test(entry.name)
    ) {
      return [];
    }
    return [path];
  });
}

test("recorded-route runtime has no remote map or location-derived request path", () => {
  const forbiddenRemoteMapBoundary =
    /(?:tile\.openstreetmap\.org|overpass-api\.de|nominatim\.openstreetmap\.org|api\.mapbox\.com|maps\.googleapis\.com|maptiler\.com|hereapi\.com|basemaps\.cartocdn\.com)/i;

  for (const root of RUNTIME_ROOTS) {
    for (const file of runtimeSourceFiles(join(MOBILE_ROOT, root))) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(
        source,
        forbiddenRemoteMapBoundary,
        `${file} must not send route-derived coordinates to a remote map service`,
      );
    }
  }

  const trailMap = readFileSync(
    join(MOBILE_ROOT, "components", "TrailMap.tsx"),
    "utf8",
  );
  assert.doesNotMatch(
    trailMap,
    /\bfetch\s*\(/,
    "TrailMap must remain network-free",
  );
  assert.doesNotMatch(
    trailMap,
    /source\s*=\s*\{\{\s*uri:/,
    "TrailMap must not create a remote image URI from route coordinates",
  );
  assert.doesNotMatch(
    trailMap,
    /\b(?:loadStorybookMapData|computeTrailTiles|MapView|UrlTile)\b/,
    "TrailMap must use only the bundled vector canvas",
  );
});

test("the private route canvas keeps the recorded shape and endpoint markers", () => {
  const trailMap = readFileSync(
    join(MOBILE_ROOT, "components", "TrailMap.tsx"),
    "utf8",
  );

  assert.match(trailMap, /\bprojectRoutePoint\b/);
  assert.match(trailMap, /<Polyline\b/);
  assert.match(trailMap, /projected\.start/);
  assert.match(trailMap, /projected\.end/);
  assert.match(trailMap, /Device-only route/);
});

test("care-entry create and update payloads pass through the GPS privacy boundary", () => {
  const careContext = readFileSync(
    join(MOBILE_ROOT, "context", "CareContext.tsx"),
    "utf8",
  );

  assert.match(
    careContext,
    /function toCreateInput[\s\S]*?sanitizeCareEntryDetailsForSync\(e\.details\)[\s\S]*?return \{/,
  );
  assert.match(
    careContext,
    /function toUpdateInput[\s\S]*?sanitizeCareEntryDetailsForSync\(e\.details\)[\s\S]*?return \{/,
  );
});

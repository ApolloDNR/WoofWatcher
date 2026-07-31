import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const MOBILE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
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

function namedFunctionSource(source: string, name: string): string {
  const declarationStart = source.indexOf(`function ${name}(`);
  assert.notEqual(declarationStart, -1, `expected function ${name} to exist`);
  const bodyStart = source.indexOf("{", declarationStart);
  assert.notEqual(bodyStart, -1, `expected function ${name} to have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(declarationStart, index + 1);
    }
  }
  assert.fail(`expected function ${name} to have a closing brace`);
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
  assert.match(
    trailMap,
    /<View\s+aria-hidden\s+pointerEvents="none"[\s\S]*?s\.compass/,
    "the decorative compass must stay out of the accessibility tree",
  );
});

test("care-entry create and update payloads pass through the GPS privacy boundary", () => {
  const careContext = readFileSync(
    join(MOBILE_ROOT, "context", "CareContext.tsx"),
    "utf8",
  );

  const createInput = namedFunctionSource(careContext, "toCreateInput");
  const updateInput = namedFunctionSource(careContext, "toUpdateInput");

  assert.match(createInput, /sanitizeCareEntryDetailsForSync\(e\.details\)/);
  assert.match(updateInput, /sanitizeCareEntryDetailsForSync\(e\.details\)/);
});

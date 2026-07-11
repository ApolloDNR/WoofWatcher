import assert from "node:assert/strict";
import { test } from "node:test";

import {
  OVERPASS_ENDPOINT,
  STORYBOOK_CACHE_INDEX_KEY,
  STORYBOOK_CACHE_MAX_ENTRIES,
  STORYBOOK_CACHE_PREFIX,
  STORYBOOK_CACHE_TTL_MS,
  STORYBOOK_MIN_SPAN_DEG,
  buildOverpassQuery,
  encodeOverpassForm,
  loadStorybookMapData,
  padWalkBbox,
  parseOverpassResponse,
  storybookDetailZoom,
  storybookMapCacheKey,
  type StorybookBBox,
  type StorybookStorage,
} from "./storybookMapData.ts";
import { simplifyGeoPath, type WalkRoutePoint } from "./walkRoute.ts";

const SF = { lat: 37.7749, lon: -122.4194 };
const BBOX: StorybookBBox = {
  south: 37.77,
  west: -122.43,
  north: 37.78,
  east: -122.41,
};

function route(...points: [number, number][]): WalkRoutePoint[] {
  return points.map(([lat, lon], index) => ({ lat, lon, t: index * 60_000 }));
}

/** A small but complete Overpass response covering every feature family. */
const FIXTURE = {
  version: 0.6,
  generator: "Overpass API",
  elements: [
    {
      type: "way",
      id: 1,
      tags: { highway: "primary", name: "Grand Ave" },
      geometry: [
        { lat: 37.771, lon: -122.429 },
        { lat: 37.7715, lon: -122.425 },
        { lat: 37.772, lon: -122.421 },
      ],
    },
    {
      type: "way",
      id: 2,
      tags: { highway: "residential" },
      geometry: [
        { lat: 37.773, lon: -122.428 },
        { lat: 37.774, lon: -122.428 },
      ],
    },
    {
      type: "way",
      id: 3,
      tags: { highway: "service" },
      geometry: [
        { lat: 37.7731, lon: -122.4285 },
        { lat: 37.7736, lon: -122.4286 },
      ],
    },
    {
      type: "way",
      id: 4,
      tags: { highway: "footway" },
      geometry: [
        { lat: 37.775, lon: -122.427 },
        { lat: 37.7755, lon: -122.426 },
      ],
    },
    {
      type: "way",
      id: 5,
      tags: { waterway: "stream" },
      geometry: [
        { lat: 37.776, lon: -122.43 },
        { lat: 37.777, lon: -122.428 },
      ],
    },
    {
      type: "way",
      id: 6,
      tags: { natural: "water", name: "Storybook Pond" },
      geometry: [
        { lat: 37.7772, lon: -122.4125 },
        { lat: 37.7776, lon: -122.4121 },
        { lat: 37.7772, lon: -122.4117 },
        { lat: 37.7768, lon: -122.4121 },
        { lat: 37.7772, lon: -122.4125 },
      ],
    },
    {
      type: "way",
      id: 7,
      tags: { leisure: "dog_park" },
      geometry: [
        { lat: 37.7712, lon: -122.4145 },
        { lat: 37.7718, lon: -122.4145 },
        { lat: 37.7718, lon: -122.4135 },
        { lat: 37.7712, lon: -122.4135 },
        { lat: 37.7712, lon: -122.4145 },
      ],
    },
    {
      type: "way",
      id: 8,
      tags: { landuse: "forest" },
      geometry: [
        { lat: 37.7785, lon: -122.4295 },
        { lat: 37.7795, lon: -122.4295 },
        { lat: 37.7795, lon: -122.4275 },
        { lat: 37.7785, lon: -122.4275 },
        { lat: 37.7785, lon: -122.4295 },
      ],
    },
    {
      type: "way",
      id: 9,
      tags: { building: "yes" },
      geometry: [
        { lat: 37.7741, lon: -122.4181 },
        { lat: 37.7744, lon: -122.4181 },
        { lat: 37.7744, lon: -122.4177 },
        { lat: 37.7741, lon: -122.4177 },
        { lat: 37.7741, lon: -122.4181 },
      ],
    },
    // Unclosed green way: skipped (a park outline must be a ring).
    {
      type: "way",
      id: 10,
      tags: { leisure: "park" },
      geometry: [
        { lat: 37.772, lon: -122.412 },
        { lat: 37.773, lon: -122.412 },
      ],
    },
    // Unclosed building: skipped.
    {
      type: "way",
      id: 11,
      tags: { building: "yes" },
      geometry: [
        { lat: 37.771, lon: -122.411 },
        { lat: 37.7712, lon: -122.411 },
      ],
    },
    // Nodes and malformed geometry are ignored, never fatal.
    { type: "node", id: 12, lat: 37.775, lon: -122.42, tags: { amenity: "bench" } },
    { type: "way", id: 13, tags: { highway: "residential" }, geometry: "broken" },
    {
      type: "way",
      id: 14,
      tags: { highway: "residential" },
      geometry: [{ lat: "37.77", lon: -122.42 }, { lat: 37.771, lon: -122.42 }],
    },
    // Highway values outside the storybook set are skipped.
    {
      type: "way",
      id: 15,
      tags: { highway: "proposed" },
      geometry: [
        { lat: 37.7745, lon: -122.4255 },
        { lat: 37.7746, lon: -122.4256 },
      ],
    },
  ],
};

test("parseOverpassResponse sorts fixture ways into typed storybook layers", () => {
  const data = parseOverpassResponse(FIXTURE, BBOX);
  assert.ok(data);
  assert.deepEqual(data.bbox, BBOX);

  assert.equal(data.roads.length, 4);
  assert.deepEqual(
    data.roads.map((road) => road.class),
    ["major", "minor", "minor", "footpath"],
  );
  // Road polylines keep their real coordinates.
  assert.deepEqual(data.roads[1].points, [
    { lat: 37.773, lon: -122.428 },
    { lat: 37.774, lon: -122.428 },
  ]);

  assert.equal(data.waterLines.length, 1);
  assert.equal(data.waterPolys.length, 1);
  // The ring's duplicated closing point is dropped; winding may normalize,
  // so assert membership rather than order.
  assert.equal(data.waterPolys[0].length, 4);
  assert.ok(
    data.waterPolys[0].some((p) => p.lat === 37.7772 && p.lon === -122.4125),
  );

  // dog_park + forest land, but not the unclosed park way.
  assert.equal(data.greenPolys.length, 2);
  assert.equal(data.buildingPolys.length, 1);
  assert.equal(data.buildingPolys[0].length, 4);
});

test("parseOverpassResponse normalizes ring winding so nested greens never punch holes", () => {
  // Same square park drawn twice: once counterclockwise, once clockwise.
  const ccw = [
    { lat: 37.771, lon: -122.4145 },
    { lat: 37.771, lon: -122.4135 },
    { lat: 37.7718, lon: -122.4135 },
    { lat: 37.7718, lon: -122.4145 },
    { lat: 37.771, lon: -122.4145 },
  ];
  const cw = [...ccw].reverse();
  const data = parseOverpassResponse(
    {
      elements: [
        { type: "way", id: 1, tags: { leisure: "park" }, geometry: ccw },
        { type: "way", id: 2, tags: { leisure: "garden" }, geometry: cw },
      ],
    },
    BBOX,
  );
  assert.ok(data);
  assert.equal(data.greenPolys.length, 2);
  const signedArea = (ring: { lat: number; lon: number }[]) => {
    let area = 0;
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      area += a.lon * b.lat - b.lon * a.lat;
    }
    return area / 2;
  };
  for (const ring of data.greenPolys) {
    assert.ok(signedArea(ring) > 0, "every ring must share the same winding");
  }
});

test("parseOverpassResponse rejects malformed responses outright", () => {
  assert.equal(parseOverpassResponse(null, BBOX), null);
  assert.equal(parseOverpassResponse("<html>rate limited</html>", BBOX), null);
  assert.equal(parseOverpassResponse({ remark: "timeout" }, BBOX), null);
  const empty = parseOverpassResponse({ elements: [] }, BBOX);
  assert.ok(empty);
  assert.equal(empty.roads.length, 0);
});

test("parseOverpassResponse simplifies dense collinear geometry", () => {
  // A 60-point perfectly straight residential road collapses to its ends.
  const geometry = [];
  for (let i = 0; i < 60; i += 1) {
    geometry.push({ lat: 37.77 + i * 0.0001, lon: -122.42 });
  }
  const data = parseOverpassResponse(
    { elements: [{ type: "way", id: 1, tags: { highway: "residential" }, geometry }] },
    BBOX,
  );
  assert.ok(data);
  assert.equal(data.roads.length, 1);
  assert.ok(
    data.roads[0].points.length <= 3,
    `straight road should collapse, got ${data.roads[0].points.length}`,
  );
  assert.deepEqual(data.roads[0].points[0], geometry[0]);
  assert.deepEqual(
    data.roads[0].points[data.roads[0].points.length - 1],
    geometry[geometry.length - 1],
  );
});

test("simplifyGeoPath keeps corners, drops collinear noise, tolerates junk", () => {
  const corner = { lat: 37.772, lon: -122.42 };
  const path = [
    { lat: 37.77, lon: -122.42 },
    { lat: 37.771, lon: -122.42 },
    corner,
    { lat: 37.772, lon: -122.419 },
    { lat: 37.772, lon: -122.418 },
  ];
  const simplified = simplifyGeoPath(path, 2.5);
  assert.ok(simplified.some((p) => p.lat === corner.lat && p.lon === corner.lon));
  assert.ok(simplified.length < path.length);
  // Invalid vertices are filtered instead of poisoning the math.
  assert.deepEqual(simplifyGeoPath([{ lat: NaN, lon: 0 }, { lat: 91, lon: 0 }], 2), []);
});

test("padWalkBbox pads ~20% per side and enforces a minimum span", () => {
  // A 0.01 x 0.02 degree box grows by exactly 20% of its span per side.
  const bbox = padWalkBbox([
    { lat: 37.77, lon: -122.43 },
    { lat: 37.78, lon: -122.41 },
  ]);
  assert.ok(bbox);
  assert.ok(Math.abs(bbox.south - (37.77 - 0.002)) < 1e-9);
  assert.ok(Math.abs(bbox.north - (37.78 + 0.002)) < 1e-9);
  assert.ok(Math.abs(bbox.west - (-122.43 - 0.004)) < 1e-9);
  assert.ok(Math.abs(bbox.east - (-122.41 + 0.004)) < 1e-9);

  // A tiny loop still gets a neighborhood-sized world.
  const tiny = padWalkBbox([
    { lat: SF.lat, lon: SF.lon },
    { lat: SF.lat + 0.0001, lon: SF.lon + 0.0001 },
  ]);
  assert.ok(tiny);
  assert.ok(tiny.north - tiny.south >= STORYBOOK_MIN_SPAN_DEG - 1e-12);
  assert.ok(tiny.east - tiny.west >= STORYBOOK_MIN_SPAN_DEG - 1e-12);
  // Centered on the route.
  assert.ok(Math.abs((tiny.north + tiny.south) / 2 - (SF.lat + 0.00005)) < 1e-9);

  // Junk points are ignored; all-junk input is null.
  assert.equal(padWalkBbox([{ lat: NaN, lon: 200 }]), null);
  assert.equal(padWalkBbox([]), null);
});

test("storybookMapCacheKey is stable under float noise and distinct per area/zoom", () => {
  const a = storybookMapCacheKey(BBOX, 16);
  const b = storybookMapCacheKey(
    {
      south: BBOX.south + 0.00001,
      west: BBOX.west - 0.00002,
      north: BBOX.north + 0.00001,
      east: BBOX.east,
    },
    16,
  );
  assert.equal(a, b, "sub-rounding jitter must hit the same cache entry");
  assert.ok(a.startsWith(STORYBOOK_CACHE_PREFIX));
  assert.notEqual(a, storybookMapCacheKey(BBOX, 15), "zoom is part of the key");
  assert.notEqual(
    a,
    storybookMapCacheKey({ ...BBOX, north: BBOX.north + 0.01 }, 16),
    "different areas get different entries",
  );
});

test("storybookDetailZoom is deterministic and clamped to the trail zoom range", () => {
  const tiny = route([SF.lat, SF.lon], [SF.lat + 0.0003, SF.lon + 0.0003]);
  const long = route([SF.lat, SF.lon], [SF.lat + 0.05, SF.lon + 0.05]);
  assert.equal(storybookDetailZoom(tiny), 17);
  assert.equal(storybookDetailZoom(long), 14);
  assert.equal(storybookDetailZoom(tiny), storybookDetailZoom(tiny));
});

test("buildOverpassQuery targets the bbox with ways-only geometry output", () => {
  const query = buildOverpassQuery(BBOX);
  assert.match(query, /\[out:json\]\[timeout:\d+\];/);
  assert.ok(query.includes("37.77000,-122.43000,37.78000,-122.41000"));
  for (const clause of ["highway", "waterway", "natural", "leisure", "landuse", "building"]) {
    assert.ok(query.includes(`way["${clause}"`), `query must request ${clause} ways`);
  }
  assert.ok(query.trimEnd().endsWith("out geom 4000;"));
  assert.ok(!query.includes("relation"), "ways only — no relation assembly");
});

test("encodeOverpassForm strictly escapes sub-delims the live API 406s on", () => {
  const body = encodeOverpassForm(buildOverpassQuery(BBOX));
  assert.ok(body.startsWith("data="));
  // encodeURIComponent leaves !'()*~ bare; overpass-api.de's Apache rejects
  // bodies containing them (verified live), so the encoder must escape all.
  assert.doesNotMatch(body.slice(5), /[!'()*~]/);
  // Escaping must stay lossless.
  assert.equal(decodeURIComponent(body.slice(5)), buildOverpassQuery(BBOX));
});

/* ------------------------------------------------------------------ */
/* Loader + cache behavior (in-memory storage, stub fetch, no network) */
/* ------------------------------------------------------------------ */

function memoryStorage(): StorybookStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
    removeItem: async (key) => {
      map.delete(key);
    },
  };
}

function fetchStub(payload: unknown, init?: { ok?: boolean }) {
  const calls: { url: string; body: string }[] = [];
  const fn = (async (url: unknown, options?: { body?: unknown }) => {
    calls.push({ url: String(url), body: String(options?.body ?? "") });
    return {
      ok: init?.ok ?? true,
      status: init?.ok === false ? 429 : 200,
      json: async () => payload,
    };
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const WALK = route(
  [37.7749, -122.4194],
  [37.7756, -122.4188],
  [37.7762, -122.418],
);

test("loadStorybookMapData fetches once, caches, then serves the cache", async () => {
  const storage = memoryStorage();
  const { fn, calls } = fetchStub(FIXTURE);
  const now = 1_750_000_000_000;

  const first = await loadStorybookMapData(WALK, { storage, fetchFn: fn, now });
  assert.ok(first);
  assert.equal(first.roads.length, 4);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, OVERPASS_ENDPOINT);
  assert.ok(calls[0].body.startsWith("data="), "Overpass POST body is form-encoded");

  // Second load: same walk, no network.
  const second = await loadStorybookMapData(WALK, { storage, fetchFn: fn, now: now + 1000 });
  assert.ok(second);
  assert.equal(second.greenPolys.length, first.greenPolys.length);
  assert.equal(calls.length, 1, "cache hit must not refetch");

  // The index tracks the entry.
  const index = JSON.parse(storage.map.get(STORYBOOK_CACHE_INDEX_KEY) ?? "[]");
  assert.equal(index.length, 1);
});

test("loadStorybookMapData returns null on failure — caller falls back to real tiles", async () => {
  const storage = memoryStorage();
  const rejecting = (async () => {
    throw new Error("offline");
  }) as unknown as typeof fetch;
  assert.equal(await loadStorybookMapData(WALK, { storage, fetchFn: rejecting }), null);

  const { fn: rateLimited } = fetchStub(FIXTURE, { ok: false });
  assert.equal(await loadStorybookMapData(WALK, { storage, fetchFn: rateLimited }), null);

  const { fn: garbage } = fetchStub({ remark: "runtime error" });
  assert.equal(await loadStorybookMapData(WALK, { storage, fetchFn: garbage }), null);

  // No cache entries were written for failures.
  assert.equal(storage.map.size, 0);

  // Routes too short to map are refused without touching the network.
  const { fn: counted, calls } = fetchStub(FIXTURE);
  assert.equal(await loadStorybookMapData([], { storage, fetchFn: counted }), null);
  assert.equal(calls.length, 0);
});

test("expired cache entries refetch, but a stale world survives a failed refresh", async () => {
  const storage = memoryStorage();
  const { fn, calls } = fetchStub(FIXTURE);
  const now = 1_750_000_000_000;
  const first = await loadStorybookMapData(WALK, { storage, fetchFn: fn, now });
  assert.ok(first);

  // Past the TTL the loader refetches.
  const later = now + STORYBOOK_CACHE_TTL_MS + 60_000;
  const refreshed = await loadStorybookMapData(WALK, { storage, fetchFn: fn, now: later });
  assert.ok(refreshed);
  assert.equal(calls.length, 2, "expired entry must refetch");

  // Expired entry + offline: the stale real data still renders.
  const rejecting = (async () => {
    throw new Error("offline");
  }) as unknown as typeof fetch;
  const muchLater = later + STORYBOOK_CACHE_TTL_MS + 60_000;
  const staleServed = await loadStorybookMapData(WALK, {
    storage,
    fetchFn: rejecting,
    now: muchLater,
  });
  assert.ok(staleServed, "stale cached geometry beats no map");
  assert.equal(staleServed.roads.length, 4);
});

test("cache holds at most STORYBOOK_CACHE_MAX_ENTRIES worlds, evicting the oldest", async () => {
  const storage = memoryStorage();
  const now = 1_750_000_000_000;
  const total = STORYBOOK_CACHE_MAX_ENTRIES + 5;
  for (let i = 0; i < total; i += 1) {
    const walk = route(
      [37.7 + i * 0.02, -122.4194],
      [37.7 + i * 0.02 + 0.001, -122.418],
    );
    const { fn } = fetchStub(FIXTURE);
    const loaded = await loadStorybookMapData(walk, { storage, fetchFn: fn, now: now + i });
    assert.ok(loaded);
  }
  const index: { key: string; at: number }[] = JSON.parse(
    storage.map.get(STORYBOOK_CACHE_INDEX_KEY) ?? "[]",
  );
  assert.equal(index.length, STORYBOOK_CACHE_MAX_ENTRIES);
  // Storage holds exactly the index entries plus the index itself.
  assert.equal(storage.map.size, STORYBOOK_CACHE_MAX_ENTRIES + 1);
  // The newest entries won; the oldest five were evicted.
  const oldest = Math.min(...index.map((entry) => entry.at));
  assert.equal(oldest, now + 5);
});

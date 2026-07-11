/**
 * Storybook map data: real neighborhood geometry for the drawn trail map.
 *
 * Instead of raster tile photos, the storybook trail map fetches vector
 * geometry (roads, water, parks, buildings) around a recorded walk from the
 * free Overpass API (OpenStreetMap data) and lets TrailMap draw the world in
 * the app's own game-world palette. Honest and local-first:
 *
 * - Parsed geometry caches on-device via AsyncStorage (TTL 30 days, at most
 *   20 areas) so a walk's world downloads once and then renders offline.
 * - Any fetch/parse failure returns null and the caller falls back to the
 *   real raster tiles — never a fake or empty map.
 * - No keys, no paid APIs. Requests carry a descriptive User-Agent per the
 *   Overpass usage policy. Map data © OpenStreetMap contributors.
 *
 * Everything below the fetch boundary is pure and unit-tested with fixture
 * JSON — tests never touch the network (fetch and storage are injectable).
 */

import { fitRouteViewport, simplifyGeoPath, type WalkRoutePoint } from "./walkRoute.ts";

export interface GeoPoint {
  lat: number;
  lon: number;
}

/** south/west/north/east in degrees — the Overpass bbox order. */
export interface StorybookBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export type StorybookRoadClass = "major" | "minor" | "footpath";

export interface StorybookRoad {
  class: StorybookRoadClass;
  points: GeoPoint[];
}

export interface StorybookMapData {
  bbox: StorybookBBox;
  roads: StorybookRoad[];
  /** Streams/rivers/canals drawn as lines. */
  waterLines: GeoPoint[][];
  /** Lakes/ponds/riverbanks drawn as filled shapes (closing point removed). */
  waterPolys: GeoPoint[][];
  /** Parks, gardens, dog parks, grass, woods (closing point removed). */
  greenPolys: GeoPoint[][];
  /** Building footprints (closing point removed). */
  buildingPolys: GeoPoint[][];
}

export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
/** Descriptive UA per the Overpass usage policy (no keys, no tracking). */
export const OVERPASS_USER_AGENT =
  "WoofWatcher/1.0 (storybook walk map; local-first dog care app; Expo)";
export const STORYBOOK_FETCH_TIMEOUT_MS = 15_000;
export const STORYBOOK_BBOX_PAD_RATIO = 0.2;
/** Tiny loops still fetch a readable slice of neighborhood (~360 m). */
export const STORYBOOK_MIN_SPAN_DEG = 0.0033;
export const STORYBOOK_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const STORYBOOK_CACHE_MAX_ENTRIES = 20;
export const STORYBOOK_CACHE_PREFIX = "woofwatcher.storybookmap.v1.";
export const STORYBOOK_CACHE_INDEX_KEY = `${STORYBOOK_CACHE_PREFIX}index`;

/** Geometry simplification tolerance — visual fidelity at zooms 14-17. */
const SIMPLIFY_TOLERANCE_M = 2.5;
const MAX_POINTS_PER_FEATURE = 120;
/** Per-layer feature caps keep parse, cache, and SVG render bounded. */
const MAX_ROADS = 400;
const MAX_WATER_LINES = 120;
const MAX_WATER_POLYS = 80;
const MAX_GREEN_POLYS = 160;
const MAX_BUILDING_POLYS = 600;

const ROAD_CLASS_BY_HIGHWAY: Record<string, StorybookRoadClass> = {
  motorway: "major",
  trunk: "major",
  primary: "major",
  secondary: "major",
  tertiary: "minor",
  residential: "minor",
  service: "minor",
  footway: "footpath",
  path: "footpath",
  cycleway: "footpath",
  pedestrian: "footpath",
};

const GREEN_LEISURE = new Set(["park", "garden", "dog_park"]);
const GREEN_LANDUSE = new Set(["grass", "recreation_ground", "forest"]);

/* ------------------------------------------------------------------ */
/* BBox + cache key (pure, unit-tested)                                */
/* ------------------------------------------------------------------ */

/**
 * The route's bounding box padded ~20% per side so the drawn world extends
 * past the trail, expanded to a minimum span so short loops still get a
 * neighborhood. Returns null when no valid points exist.
 */
export function padWalkBbox(
  points: readonly GeoPoint[],
  padRatio: number = STORYBOOK_BBOX_PAD_RATIO,
  minSpanDeg: number = STORYBOOK_MIN_SPAN_DEG,
): StorybookBBox | null {
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.lat) || Math.abs(point.lat) > 90) continue;
    if (!Number.isFinite(point.lon) || Math.abs(point.lon) > 180) continue;
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
    west = Math.min(west, point.lon);
    east = Math.max(east, point.lon);
  }
  if (!Number.isFinite(south) || !Number.isFinite(west)) return null;
  const latPad = Math.max((north - south) * padRatio, 0);
  const lonPad = Math.max((east - west) * padRatio, 0);
  south -= latPad;
  north += latPad;
  west -= lonPad;
  east += lonPad;
  if (north - south < minSpanDeg) {
    const grow = (minSpanDeg - (north - south)) / 2;
    south -= grow;
    north += grow;
  }
  if (east - west < minSpanDeg) {
    const grow = (minSpanDeg - (east - west)) / 2;
    west -= grow;
    east += grow;
  }
  return {
    south: Math.max(-85, south),
    north: Math.min(85, north),
    west: Math.max(-180, west),
    east: Math.min(180, east),
  };
}

/**
 * Deterministic zoom bucket for a route's storybook world: the same
 * fit logic the map view uses, evaluated at a fixed reference size so the
 * cache key never depends on which screen renders the map.
 */
export function storybookDetailZoom(route: readonly WalkRoutePoint[]): number {
  return fitRouteViewport(route, 512, 512)?.zoom ?? 15;
}

/**
 * Cache key: rounded bbox + zoom. Rounding to 4 decimals (~11 m) keeps the
 * key stable across float noise while distinct walks land in distinct
 * entries.
 */
export function storybookMapCacheKey(bbox: StorybookBBox, zoom: number): string {
  const r = (value: number) => value.toFixed(4);
  return `${STORYBOOK_CACHE_PREFIX}z${Math.round(zoom)}.${r(bbox.south)}.${r(bbox.west)}.${r(bbox.north)}.${r(bbox.east)}`;
}

/* ------------------------------------------------------------------ */
/* Overpass query + response parsing (pure, unit-tested)               */
/* ------------------------------------------------------------------ */

/** The Overpass QL query for a bbox: ways only, geometry inlined. */
export function buildOverpassQuery(bbox: StorybookBBox): string {
  const b = `${bbox.south.toFixed(5)},${bbox.west.toFixed(5)},${bbox.north.toFixed(5)},${bbox.east.toFixed(5)}`;
  return [
    "[out:json][timeout:20];",
    "(",
    `way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|footway|path|cycleway|pedestrian)$"](${b});`,
    `way["waterway"](${b});`,
    `way["natural"~"^(water|wood)$"](${b});`,
    `way["leisure"~"^(park|garden|dog_park)$"](${b});`,
    `way["landuse"~"^(grass|recreation_ground|forest)$"](${b});`,
    `way["building"](${b});`,
    ");",
    "out geom 4000;",
  ].join("\n");
}

/**
 * Strict form-encoding for the Overpass POST body. Apache at
 * overpass-api.de rejects (406) bodies where encodeURIComponent's bare
 * sub-delims — notably the query's parentheses — survive, so escape every
 * character encodeURIComponent leaves loose. Verified against the live API.
 */
export function encodeOverpassForm(query: string): string {
  return `data=${encodeURIComponent(query).replace(
    /[!'()*~]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )}`;
}

interface OverpassWay {
  type?: unknown;
  tags?: Record<string, unknown>;
  geometry?: unknown;
}

function parseWayGeometry(value: unknown): GeoPoint[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const points: GeoPoint[] = [];
  for (const raw of value) {
    if (raw == null || typeof raw !== "object") return null;
    const candidate = raw as { lat?: unknown; lon?: unknown };
    if (typeof candidate.lat !== "number" || typeof candidate.lon !== "number") return null;
    if (!Number.isFinite(candidate.lat) || Math.abs(candidate.lat) > 90) return null;
    if (!Number.isFinite(candidate.lon) || Math.abs(candidate.lon) > 180) return null;
    points.push({ lat: candidate.lat, lon: candidate.lon });
  }
  return points;
}

function isClosedRing(points: readonly GeoPoint[]): boolean {
  if (points.length < 4) return false;
  const first = points[0];
  const last = points[points.length - 1];
  return first.lat === last.lat && first.lon === last.lon;
}

/** Shoelace signed area in degrees^2 — only the sign (winding) matters. */
function ringSignedArea(points: readonly GeoPoint[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.lon * b.lat - b.lon * a.lat;
  }
  return area / 2;
}

/**
 * Force counterclockwise winding. OSM ways wind arbitrarily; a layer's
 * rings all render as one nonzero-fill SVG path, so uniform winding keeps
 * nested same-layer features (a garden inside a park) from punching holes.
 */
function normalizeRingWinding(points: GeoPoint[]): GeoPoint[] {
  return ringSignedArea(points) < 0 ? points.reverse() : points;
}

/** Simplify + hard-cap one feature's vertex count (endpoints kept). */
function condense(points: GeoPoint[]): GeoPoint[] {
  let condensed = simplifyGeoPath(points, SIMPLIFY_TOLERANCE_M);
  if (condensed.length > MAX_POINTS_PER_FEATURE) {
    const sampled: GeoPoint[] = [];
    const step = (condensed.length - 1) / (MAX_POINTS_PER_FEATURE - 1);
    for (let i = 0; i < MAX_POINTS_PER_FEATURE; i += 1) {
      sampled.push(condensed[Math.round(i * step)]);
    }
    condensed = sampled;
  }
  return condensed;
}

function tagValue(tags: Record<string, unknown> | undefined, key: string): string | null {
  const value = tags?.[key];
  return typeof value === "string" ? value : null;
}

/**
 * Parse an Overpass JSON response into typed storybook features. Unknown or
 * malformed elements are skipped; a response without an `elements` array is
 * rejected outright (null) so callers fall back to the real map.
 */
export function parseOverpassResponse(
  json: unknown,
  bbox: StorybookBBox,
): StorybookMapData | null {
  if (json == null || typeof json !== "object") return null;
  const elements = (json as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return null;

  const data: StorybookMapData = {
    bbox,
    roads: [],
    waterLines: [],
    waterPolys: [],
    greenPolys: [],
    buildingPolys: [],
  };

  for (const raw of elements) {
    if (raw == null || typeof raw !== "object") continue;
    const way = raw as OverpassWay;
    if (way.type !== "way") continue;
    const geometry = parseWayGeometry(way.geometry);
    if (!geometry) continue;
    const tags = way.tags;
    const closed = isClosedRing(geometry);
    // Rings drop their duplicated closing point; the renderer closes paths.
    const ring = () => normalizeRingWinding(condense(geometry.slice(0, -1)));

    const highway = tagValue(tags, "highway");
    const roadClass = highway ? ROAD_CLASS_BY_HIGHWAY[highway] : undefined;
    if (roadClass) {
      if (data.roads.length < MAX_ROADS) {
        const points = condense(geometry);
        if (points.length >= 2) data.roads.push({ class: roadClass, points });
      }
      continue;
    }

    const waterway = tagValue(tags, "waterway");
    const natural = tagValue(tags, "natural");
    if (waterway === "riverbank" || waterway === "dock" || natural === "water") {
      if (closed) {
        if (data.waterPolys.length < MAX_WATER_POLYS) {
          const points = ring();
          if (points.length >= 3) data.waterPolys.push(points);
        }
      } else if (data.waterLines.length < MAX_WATER_LINES) {
        const points = condense(geometry);
        if (points.length >= 2) data.waterLines.push(points);
      }
      continue;
    }
    if (waterway) {
      if (data.waterLines.length < MAX_WATER_LINES) {
        const points = condense(geometry);
        if (points.length >= 2) data.waterLines.push(points);
      }
      continue;
    }

    const leisure = tagValue(tags, "leisure");
    const landuse = tagValue(tags, "landuse");
    const isGreen =
      (leisure != null && GREEN_LEISURE.has(leisure)) ||
      (landuse != null && GREEN_LANDUSE.has(landuse)) ||
      natural === "wood";
    if (isGreen) {
      if (closed && data.greenPolys.length < MAX_GREEN_POLYS) {
        const points = ring();
        if (points.length >= 3) data.greenPolys.push(points);
      }
      continue;
    }

    if (tagValue(tags, "building")) {
      if (closed && data.buildingPolys.length < MAX_BUILDING_POLYS) {
        const points = ring();
        if (points.length >= 3) data.buildingPolys.push(points);
      }
    }
  }

  return data;
}

/* ------------------------------------------------------------------ */
/* On-device cache (storage injectable; AsyncStorage by default)       */
/* ------------------------------------------------------------------ */

/** Minimal key-value surface — AsyncStorage satisfies it directly. */
export interface StorybookStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface CacheEnvelope {
  v: 1;
  at: number;
  data: StorybookMapData;
}

interface CacheIndexEntry {
  key: string;
  at: number;
}

function isPointList(value: unknown): value is GeoPoint[] {
  return (
    Array.isArray(value) &&
    value.every(
      (point) =>
        point != null &&
        typeof point === "object" &&
        typeof (point as GeoPoint).lat === "number" &&
        typeof (point as GeoPoint).lon === "number",
    )
  );
}

function parseCacheEnvelope(rawValue: string | null): CacheEnvelope | null {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue) as CacheEnvelope;
    if (parsed == null || typeof parsed !== "object" || parsed.v !== 1) return null;
    if (typeof parsed.at !== "number" || !Number.isFinite(parsed.at)) return null;
    const data = parsed.data;
    if (data == null || typeof data !== "object") return null;
    if (
      !Array.isArray(data.roads) ||
      !data.roads.every((road) => road != null && isPointList(road.points)) ||
      !Array.isArray(data.waterLines) ||
      !data.waterLines.every(isPointList) ||
      !Array.isArray(data.waterPolys) ||
      !data.waterPolys.every(isPointList) ||
      !Array.isArray(data.greenPolys) ||
      !data.greenPolys.every(isPointList) ||
      !Array.isArray(data.buildingPolys) ||
      !data.buildingPolys.every(isPointList)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function readCacheIndex(storage: StorybookStorage): Promise<CacheIndexEntry[]> {
  try {
    const raw = await storage.getItem(STORYBOOK_CACHE_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is CacheIndexEntry =>
        entry != null &&
        typeof entry === "object" &&
        typeof entry.key === "string" &&
        typeof entry.at === "number",
    );
  } catch {
    return [];
  }
}

/**
 * Persist a fetched world and prune the cache: entries past the TTL or
 * beyond the newest STORYBOOK_CACHE_MAX_ENTRIES are removed so cached map
 * geometry stays a bounded slice of device storage.
 */
async function writeCacheEntry(
  storage: StorybookStorage,
  key: string,
  data: StorybookMapData,
  now: number,
): Promise<void> {
  const envelope: CacheEnvelope = { v: 1, at: now, data };
  await storage.setItem(key, JSON.stringify(envelope));
  const index = (await readCacheIndex(storage)).filter((entry) => entry.key !== key);
  index.push({ key, at: now });
  index.sort((a, b) => b.at - a.at);
  const keep: CacheIndexEntry[] = [];
  const drop: CacheIndexEntry[] = [];
  for (const entry of index) {
    const expired = now - entry.at > STORYBOOK_CACHE_TTL_MS;
    if (!expired && keep.length < STORYBOOK_CACHE_MAX_ENTRIES) keep.push(entry);
    else drop.push(entry);
  }
  for (const entry of drop) {
    try {
      await storage.removeItem(entry.key);
    } catch {
      // A failed removal only wastes space; never break the fresh write.
    }
  }
  await storage.setItem(STORYBOOK_CACHE_INDEX_KEY, JSON.stringify(keep));
}

/* --- Default storage: AsyncStorage, lazily imported so plain Node (tests,
       static export) never touches the native module. --- */

let defaultStoragePromise: Promise<StorybookStorage | null> | null = null;

function getDefaultStorage(): Promise<StorybookStorage | null> {
  if (!defaultStoragePromise) {
    defaultStoragePromise = import("@react-native-async-storage/async-storage")
      .then((module) => (module.default ?? null) as StorybookStorage | null)
      .catch(() => null);
  }
  return defaultStoragePromise;
}

/* ------------------------------------------------------------------ */
/* Loader (cache-first, honest failure)                                */
/* ------------------------------------------------------------------ */

export interface LoadStorybookMapOptions {
  /** Injectable for tests; `null` disables caching entirely. */
  storage?: StorybookStorage | null;
  /** Injectable for tests; defaults to global fetch. Never called by tests. */
  fetchFn?: typeof fetch;
  now?: number;
  timeoutMs?: number;
  endpoint?: string;
}

/**
 * Load the storybook world for a recorded walk: cache first, then one
 * Overpass fetch. Returns null on any failure (offline, HTTP error, bad
 * JSON) so the caller can fall back to the real raster tiles. A stale
 * cached world is still returned when a refresh fetch fails — old real
 * data beats no map.
 */
export async function loadStorybookMapData(
  route: readonly WalkRoutePoint[],
  options?: LoadStorybookMapOptions,
): Promise<StorybookMapData | null> {
  const bbox = padWalkBbox(route);
  if (!bbox || route.length < 2) return null;
  const zoom = storybookDetailZoom(route);
  const key = storybookMapCacheKey(bbox, zoom);
  const now = options?.now ?? Date.now();

  const storage =
    options && "storage" in options ? (options.storage ?? null) : await getDefaultStorage();

  let stale: StorybookMapData | null = null;
  if (storage) {
    try {
      const envelope = parseCacheEnvelope(await storage.getItem(key));
      if (envelope) {
        if (now - envelope.at <= STORYBOOK_CACHE_TTL_MS) return envelope.data;
        stale = envelope.data;
      }
    } catch {
      // Unreadable cache is the same as no cache.
    }
  }

  const fetchFn =
    options?.fetchFn ??
    (typeof fetch === "function" ? (fetch as typeof globalThis.fetch) : null);
  if (!fetchFn) return stale;

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutMs = options?.timeoutMs ?? STORYBOOK_FETCH_TIMEOUT_MS;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchFn(options?.endpoint ?? OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Browsers ignore a scripted User-Agent; native fetch sends it.
        "User-Agent": OVERPASS_USER_AGENT,
      },
      body: encodeOverpassForm(buildOverpassQuery(bbox)),
      signal: controller?.signal,
    });
    if (!response.ok) return stale;
    const data = parseOverpassResponse(await response.json(), bbox);
    if (!data) return stale;
    if (storage) {
      try {
        await writeCacheEntry(storage, key, data, now);
      } catch {
        // Cache write failure must never lose a fetched map.
      }
    }
    return data;
  } catch {
    return stale;
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

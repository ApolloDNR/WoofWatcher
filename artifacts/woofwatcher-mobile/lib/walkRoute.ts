/**
 * Walk route capture and trail-map math.
 *
 * WoofWatcher's real trail map records where a walk actually went. The
 * recorder is platform-safe and permission-honest:
 *
 * - Web: `navigator.geolocation.watchPosition`, feature-detected at call time
 *   (never touched at module top level, so SSR/static export stay safe).
 * - Native (iOS/Android): `expo-location` loaded lazily; the OS permission
 *   prompt appears when a walk starts. If the module or permission is
 *   missing, the recorder is a graceful no-op and the walk works as before.
 * - Anything else (Node tests, unknown runtimes): "unavailable", no-op.
 *
 * Captured points are throttled (>=15 m moved OR >=20 s elapsed), simplified
 * with Douglas-Peucker to <=200 points, and stored inside the walk entry's
 * `details.route` (plus `details.routeDistanceM`). Local-first: the route
 * lives in the care log like every other care detail and is never sent to
 * any mapping or analytics service.
 */

export interface WalkRoutePoint {
  lat: number;
  lon: number;
  /** Epoch milliseconds when the fix was captured. */
  t: number;
}

export interface WalkRouteCaptureResult {
  points: WalkRoutePoint[];
  /** Total walked distance in meters, measured over the raw (pre-simplify) trace. */
  distanceM: number;
}

export type WalkRouteCaptureStatus =
  | "idle"
  | "starting"
  | "recording"
  | "paused"
  | "denied"
  | "unavailable";

export interface WalkRouteCaptureSnapshot {
  status: WalkRouteCaptureStatus;
  sessionKey: string | null;
  pointCount: number;
}

export const WALK_ROUTE_MIN_POINT_METERS = 15;
export const WALK_ROUTE_MIN_POINT_MS = 20_000;
export const WALK_ROUTE_MAX_POINTS = 200;
/** Routes that never travel this far are noise (GPS jitter while standing). */
export const WALK_ROUTE_MIN_DISTANCE_M = 10;

const EARTH_RADIUS_M = 6371008.8;
const DEG_TO_RAD = Math.PI / 180;
/** Approximate meters per degree of latitude, used for planar simplification. */
const METERS_PER_DEGREE = 111_320;

/* ------------------------------------------------------------------ */
/* Route math (pure, unit-tested)                                      */
/* ------------------------------------------------------------------ */

export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(a.lat * DEG_TO_RAD) *
      Math.cos(b.lat * DEG_TO_RAD) *
      sinLon *
      sinLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isValidPoint(point: WalkRoutePoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Math.abs(point.lat) <= 90 &&
    Number.isFinite(point.lon) &&
    Math.abs(point.lon) <= 180 &&
    Number.isFinite(point.t)
  );
}

/**
 * Capture throttle: accept a new fix when it is valid, not older than the
 * last kept fix, and either >=15 m away or >=20 s later than the last one.
 */
export function shouldAppendRoutePoint(
  last: WalkRoutePoint | null | undefined,
  next: WalkRoutePoint,
): boolean {
  if (!isValidPoint(next)) return false;
  if (!last) return true;
  if (next.t < last.t) return false;
  if (next.t - last.t >= WALK_ROUTE_MIN_POINT_MS) return true;
  return haversineMeters(last, next) >= WALK_ROUTE_MIN_POINT_METERS;
}

export function routeDistanceMeters(points: readonly WalkRoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

/** Any valid lat/lon vertex used by route simplification. */
interface GeoVertex {
  lat: number;
  lon: number;
}

/** Perpendicular distance (meters, planar approximation) from a point to a segment. */
function pointToSegmentMeters(
  point: GeoVertex,
  start: GeoVertex,
  end: GeoVertex,
  lonScale: number,
): number {
  const px = point.lon * lonScale;
  const py = point.lat * METERS_PER_DEGREE;
  const ax = start.lon * lonScale;
  const ay = start.lat * METERS_PER_DEGREE;
  const bx = end.lon * lonScale;
  const by = end.lat * METERS_PER_DEGREE;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const raw = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  const along = Math.max(0, Math.min(1, raw));
  return Math.hypot(px - (ax + along * dx), py - (ay + along * dy));
}

function douglasPeucker<T extends GeoVertex>(
  points: readonly T[],
  toleranceM: number,
  lonScale: number,
): T[] {
  if (points.length <= 2) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [startIndex, endIndex] = stack.pop()!;
    let maxDistance = -1;
    let maxIndex = -1;
    for (let i = startIndex + 1; i < endIndex; i += 1) {
      const distance = pointToSegmentMeters(
        points[i],
        points[startIndex],
        points[endIndex],
        lonScale,
      );
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    if (maxIndex > 0 && maxDistance > toleranceM) {
      keep[maxIndex] = true;
      stack.push([startIndex, maxIndex], [maxIndex, endIndex]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

/**
 * Simplify a route to at most `maxPoints` while preserving its shape:
 * Douglas-Peucker with an escalating tolerance, then a uniform-sample
 * safety net for pathological traces. Endpoints are always kept.
 */
export function simplifyRoute(
  points: readonly WalkRoutePoint[],
  maxPoints: number = WALK_ROUTE_MAX_POINTS,
): WalkRoutePoint[] {
  const clean = points.filter(isValidPoint);
  if (clean.length <= 2 || clean.length <= maxPoints) {
    // Still collapse straight-line redundancy on short traces.
    if (clean.length > 2) {
      const midLat =
        clean.reduce((sum, point) => sum + point.lat, 0) / clean.length;
      const lonScale = METERS_PER_DEGREE * Math.cos(midLat * DEG_TO_RAD);
      return douglasPeucker(clean, 2, lonScale);
    }
    return [...clean];
  }
  const midLat =
    clean.reduce((sum, point) => sum + point.lat, 0) / clean.length;
  const lonScale = METERS_PER_DEGREE * Math.cos(midLat * DEG_TO_RAD);
  let tolerance = 2;
  let simplified = douglasPeucker(clean, tolerance, lonScale);
  for (let round = 0; simplified.length > maxPoints && round < 24; round += 1) {
    tolerance *= 1.6;
    simplified = douglasPeucker(clean, tolerance, lonScale);
  }
  if (simplified.length > maxPoints) {
    // Safety net: uniform sample that always keeps both endpoints.
    const sampled: WalkRoutePoint[] = [];
    const step = (simplified.length - 1) / (maxPoints - 1);
    for (let i = 0; i < maxPoints; i += 1) {
      sampled.push(simplified[Math.round(i * step)]);
    }
    simplified = sampled;
  }
  return simplified;
}

/**
 * Safely read a recorded route back out of a care entry's details. Returns
 * null unless the value is a plausible route (>=2 valid points).
 */
export function parseWalkRoute(value: unknown): WalkRoutePoint[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const points: WalkRoutePoint[] = [];
  for (const raw of value) {
    if (raw == null || typeof raw !== "object") return null;
    const candidate = raw as { lat?: unknown; lon?: unknown; t?: unknown };
    const point: WalkRoutePoint = {
      lat: typeof candidate.lat === "number" ? candidate.lat : NaN,
      lon: typeof candidate.lon === "number" ? candidate.lon : NaN,
      t: typeof candidate.t === "number" ? candidate.t : NaN,
    };
    if (!isValidPoint(point)) return null;
    points.push(point);
  }
  return points.length >= 2 ? points : null;
}

/** "0.4 mi", "1.2 mi", or feet for very short recorded loops. */
export function formatRouteDistanceMiles(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters === 0) return "0 ft";
  const miles = meters / 1609.344;
  if (miles < 0.1)
    return `${Math.max(10, Math.round((meters * 3.28084) / 10) * 10)} ft`;
  return `${miles.toFixed(1)} mi`;
}

/* ------------------------------------------------------------------ */
/* Local Web Mercator projection for the private TrailMap canvas       */
/* ------------------------------------------------------------------ */

export const TRAIL_MIN_ZOOM = 14;
export const TRAIL_MAX_ZOOM = 17;
const MERCATOR_MAX_LAT = 85.05112878;
const TRAIL_WORLD_SCALE = 256;

export function lonToWorldX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * TRAIL_WORLD_SCALE * 2 ** zoom;
}

export function latToWorldY(lat: number, zoom: number): number {
  const clamped = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat));
  const rad = clamped * DEG_TO_RAD;
  const normalized =
    (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return normalized * TRAIL_WORLD_SCALE * 2 ** zoom;
}

export interface TrailViewport {
  zoom: number;
  /** World-pixel coordinates (at `zoom`) of the view center. */
  centerX: number;
  centerY: number;
  /**
   * Additional fit applied when even the minimum zoom cannot contain the
   * complete route. This preserves the configured walk-map zoom range while
   * ensuring long recorded routes are never clipped by the local canvas.
   */
  fitScale: number;
}

/**
 * Pick the largest zoom in [14, 17] whose projected route bbox (plus
 * padding) fits inside width x height, centered on the route.
 */
export function fitRouteViewport(
  route: readonly WalkRoutePoint[],
  width: number,
  height: number,
  options?: { minZoom?: number; maxZoom?: number; paddingPx?: number },
): TrailViewport | null {
  if (!route.length || !(width > 0) || !(height > 0)) return null;
  const minZoom = options?.minZoom ?? TRAIL_MIN_ZOOM;
  const maxZoom = options?.maxZoom ?? TRAIL_MAX_ZOOM;
  const padding = options?.paddingPx ?? 28;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const point of route) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);
  }
  const availableWidth = Math.max(24, width - padding * 2);
  const availableHeight = Math.max(24, height - padding * 2);
  let zoom = minZoom;
  for (let candidate = maxZoom; candidate >= minZoom; candidate -= 1) {
    const spanX =
      lonToWorldX(maxLon, candidate) - lonToWorldX(minLon, candidate);
    const spanY =
      latToWorldY(minLat, candidate) - latToWorldY(maxLat, candidate);
    if (spanX <= availableWidth && spanY <= availableHeight) {
      zoom = candidate;
      break;
    }
  }
  const spanX = lonToWorldX(maxLon, zoom) - lonToWorldX(minLon, zoom);
  const spanY = latToWorldY(minLat, zoom) - latToWorldY(maxLat, zoom);
  const fitScale = Math.min(
    1,
    spanX > 0 ? availableWidth / spanX : 1,
    spanY > 0 ? availableHeight / spanY : 1,
  );
  return {
    zoom,
    centerX: (lonToWorldX(minLon, zoom) + lonToWorldX(maxLon, zoom)) / 2,
    centerY: (latToWorldY(minLat, zoom) + latToWorldY(maxLat, zoom)) / 2,
    fitScale,
  };
}

/** Project a route point into view-local pixels for the SVG overlay. */
export function projectRoutePoint(
  point: WalkRoutePoint,
  viewport: TrailViewport,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x:
      (lonToWorldX(point.lon, viewport.zoom) - viewport.centerX) *
        viewport.fitScale +
      width / 2,
    y:
      (latToWorldY(point.lat, viewport.zoom) - viewport.centerY) *
        viewport.fitScale +
      height / 2,
  };
}

/* ------------------------------------------------------------------ */
/* Platform-safe recorder (singleton)                                  */
/* ------------------------------------------------------------------ */

export type WalkRouteStopWatch = () => void;

export interface WalkRouteWatchStartControl {
  /** Synchronously revoked when this exact capture generation is cancelled. */
  readonly signal: AbortSignal;
  /** Exact Care/reset authority plus capture-generation check. */
  readonly isCurrent: () => boolean;
}

export interface WalkRouteWatchAdapter {
  start(
    onPoint: (point: WalkRoutePoint) => void,
    onDenied: () => void,
    control: WalkRouteWatchStartControl,
  ): Promise<WalkRouteStopWatch | null>;
}

interface CaptureState {
  status: WalkRouteCaptureStatus;
  sessionKey: string | null;
  points: WalkRoutePoint[];
  generation: number;
  stopWatch: WalkRouteStopWatch | null;
  startController: AbortController | null;
}

const capture: CaptureState = {
  status: "idle",
  sessionKey: null,
  points: [],
  generation: 0,
  stopWatch: null,
  startController: null,
};

const listeners = new Set<() => void>();
const pendingCaptureStarts = new Set<Promise<void>>();
// Once watchPositionAsync is invoked, native capture may already be live even
// before Expo returns its removal handle. Aborting releases UI admission, but
// reset must remain truthfully retryable until that late liability either
// rejects or yields a subscription that is physically stopped.
const pendingNativeWatchLiabilities = new Set<object>();
const retainedStopHandles = new Set<WalkRouteStopWatch>();
let snapshot: WalkRouteCaptureSnapshot = {
  status: "idle",
  sessionKey: null,
  pointCount: 0,
};

function publish(): void {
  snapshot = {
    status: capture.status,
    sessionKey: capture.sessionKey,
    pointCount: capture.points.length,
  };
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A broken listener must never break capture.
    }
  });
}

export function subscribeWalkRouteCapture(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWalkRouteCaptureSnapshot(): WalkRouteCaptureSnapshot {
  return snapshot;
}

function setStatus(status: WalkRouteCaptureStatus): void {
  capture.status = status;
  publish();
}

function attemptStopWatch(stop: WalkRouteStopWatch): void {
  retainedStopHandles.add(stop);
  stop();
  retainedStopHandles.delete(stop);
}

function stopActiveWatch(reportFailure = false): void {
  const stop = capture.stopWatch;
  capture.stopWatch = null;
  if (stop) {
    try {
      attemptStopWatch(stop);
    } catch (error) {
      if (reportFailure) throw error;
      // Best-effort cancellation outside destructive reset cannot block UI.
    }
  }
}

function abortPendingWatchStart(): void {
  const controller = capture.startController;
  capture.startController = null;
  controller?.abort();
}

function resetCapture(): void {
  abortPendingWatchStart();
  stopActiveWatch();
  capture.generation += 1;
  capture.sessionKey = null;
  capture.points = [];
  setStatus("idle");
}

/**
 * Best-effort retry for native stop handles whose first teardown threw.
 *
 * Identity changes cannot leave a previous household's location subscription
 * live merely because a platform adapter failed once. Permanent failures stay
 * retained so the destructive reset owner can still report them truthfully.
 */
export function retryRetainedWalkRouteStopHandles(): void {
  for (const stop of [...retainedStopHandles]) {
    try {
      attemptStopWatch(stop);
    } catch {
      // Keep the handle retained for the next identity cancellation or for the
      // reset owner's fail-closed prepare barrier.
    }
  }
}

/* --- Web: navigator.geolocation, feature-detected at call time --- */

interface WebGeoPosition {
  coords: { latitude: number; longitude: number };
  timestamp?: number;
}

interface WebGeolocation {
  watchPosition: (
    onSuccess: (position: WebGeoPosition) => void,
    onError?: (error: { code?: number }) => void,
    options?: {
      enableHighAccuracy?: boolean;
      maximumAge?: number;
      timeout?: number;
    },
  ) => number;
  clearWatch: (watchId: number) => void;
}

function getWebGeolocation(): WebGeolocation | null {
  const nav = (globalThis as { navigator?: { geolocation?: unknown } })
    .navigator;
  const geo = nav?.geolocation as WebGeolocation | undefined;
  if (
    geo &&
    typeof geo.watchPosition === "function" &&
    typeof geo.clearWatch === "function"
  ) {
    return geo;
  }
  return null;
}

function isReactNativeRuntime(): boolean {
  const nav = (globalThis as { navigator?: { product?: string } }).navigator;
  return nav?.product === "ReactNative";
}

function startWebWatch(
  onPoint: (point: WalkRoutePoint) => void,
  onDenied: () => void,
): WalkRouteStopWatch | null {
  const geolocation = getWebGeolocation();
  if (!geolocation) return null;
  try {
    const watchId = geolocation.watchPosition(
      (position) => {
        onPoint({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          t:
            typeof position.timestamp === "number"
              ? position.timestamp
              : Date.now(),
        });
      },
      (error) => {
        // 1 = PERMISSION_DENIED. Other codes (unavailable/timeout) are
        // transient for a watch; keep listening.
        if (error?.code === 1) onDenied();
      },
      { enableHighAccuracy: true, maximumAge: 3_000, timeout: 60_000 },
    );
    return () => geolocation.clearWatch(watchId);
  } catch {
    return null;
  }
}

/* --- Native: expo-location, loaded lazily so absence degrades to no-op --- */

export interface WalkRouteNativeLocationModule {
  readonly Accuracy: { readonly Balanced: unknown };
  requestForegroundPermissionsAsync(): Promise<{ granted: boolean }>;
  watchPositionAsync(
    options: {
      accuracy: unknown;
      timeInterval: number;
      distanceInterval: number;
    },
    onPosition: (position: {
      coords: { latitude: number; longitude: number };
      timestamp?: number;
    }) => void,
  ): Promise<{ remove(): void }>;
}

type CurrentStartupStage<T> =
  | { readonly status: "current"; readonly value: T }
  | { readonly status: "revoked" };

function startupControlIsCurrent(
  control: WalkRouteWatchStartControl,
): boolean {
  return (
    !control.signal.aborted &&
    control.isCurrent() &&
    !control.signal.aborted
  );
}

/**
 * Release logical admission as soon as this exact generation is aborted,
 * even when a platform import/permission promise never answers. The original
 * promise keeps a rejection handler but cannot progress to another native
 * side effect after revocation.
 */
function awaitCurrentStartupStage<T>(
  operation: Promise<T>,
  control: WalkRouteWatchStartControl,
  onRevokedValue?: (value: T) => void,
  onOperationSettled?: () => void,
): Promise<CurrentStartupStage<T>> {
  const disposeRevokedValue = (value: T) => {
    try {
      onRevokedValue?.(value);
    } catch {
      // Native stop failures retain their handle through attemptStopWatch;
      // logical revocation must still settle immediately.
    }
  };
  const settleUnderlyingOperation = () => {
    try {
      onOperationSettled?.();
    } catch {
      // Ownership callbacks are bookkeeping-only and must not mask the
      // platform result. The reset-side liability remains fail closed.
    }
  };
  if (!startupControlIsCurrent(control)) {
    void operation.then(
      (value) => {
        disposeRevokedValue(value);
        settleUnderlyingOperation();
      },
      settleUnderlyingOperation,
    );
    return Promise.resolve({ status: "revoked" });
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result: CurrentStartupStage<T>) => {
      if (settled) return;
      settled = true;
      control.signal.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const onAbort = () => finish({ status: "revoked" });
    control.signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        if (settled) {
          disposeRevokedValue(value);
          settleUnderlyingOperation();
          return;
        }
        if (startupControlIsCurrent(control)) {
          settleUnderlyingOperation();
          finish({ status: "current", value });
          return;
        }
        disposeRevokedValue(value);
        settleUnderlyingOperation();
        finish({ status: "revoked" });
      },
      (error) => {
        settleUnderlyingOperation();
        if (settled) return;
        control.signal.removeEventListener("abort", onAbort);
        settled = true;
        if (!startupControlIsCurrent(control)) {
          resolve({ status: "revoked" });
          return;
        }
        reject(error);
      },
    );
  });
}

export async function startNativeWalkRouteWatchWithLoader(
  loadLocation: () => Promise<WalkRouteNativeLocationModule>,
  control: WalkRouteWatchStartControl,
  onPoint: (point: WalkRoutePoint) => void,
  onDenied: () => void,
): Promise<WalkRouteStopWatch | null> {
  try {
    if (!startupControlIsCurrent(control)) return null;
    const loaded = await awaitCurrentStartupStage(
      Promise.resolve(loadLocation()),
      control,
    );
    if (loaded.status === "revoked") return null;
    const Location = loaded.value;
    if (!startupControlIsCurrent(control)) return null;
    const permissionResult = await awaitCurrentStartupStage(
      Promise.resolve(Location.requestForegroundPermissionsAsync()),
      control,
    );
    if (permissionResult.status === "revoked") return null;
    const permission = permissionResult.value;
    if (!startupControlIsCurrent(control)) return null;
    if (!permission.granted) {
      onDenied();
      return null;
    }
    // This final exact-authority check is intentionally adjacent to the OS
    // side effect: neither a late module nor permission result may start a
    // location subscription for a revoked Care/reset generation.
    if (!startupControlIsCurrent(control)) return null;
    const stopSubscription = (subscription: { remove(): void }) => {
      try {
        attemptStopWatch(() => subscription.remove());
      } catch {
        // cancelWalkRouteCapture may have already performed its ordinary
        // retained-handle retry before this late handle existed. Retry once
        // now so a fail-once A teardown closes without touching B's watch;
        // permanent failures remain retained for the reset owner.
        retryRetainedWalkRouteStopHandles();
      }
    };
    const nativeWatchLiability = Object.freeze({});
    pendingNativeWatchLiabilities.add(nativeWatchLiability);
    let watchOperation: Promise<{ remove(): void }>;
    try {
      watchOperation = Promise.resolve(
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5_000,
            distanceInterval: 5,
          },
          (position) => {
            onPoint({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              t:
                typeof position.timestamp === "number"
                  ? position.timestamp
                  : Date.now(),
            });
          },
        ),
      );
    } catch (error) {
      pendingNativeWatchLiabilities.delete(nativeWatchLiability);
      throw error;
    }
    const subscriptionResult = await awaitCurrentStartupStage(
      watchOperation,
      control,
      stopSubscription,
      () => {
        pendingNativeWatchLiabilities.delete(nativeWatchLiability);
      },
    );
    if (subscriptionResult.status === "revoked") return null;
    const subscription = subscriptionResult.value;
    const stopWatch = () => subscription.remove();
    if (!startupControlIsCurrent(control)) {
      stopSubscription(subscription);
      return null;
    }
    return stopWatch;
  } catch {
    // expo-location missing or the platform refused the watch: no-op.
    return null;
  }
}

async function startNativeWatch(
  control: WalkRouteWatchStartControl,
  onPoint: (point: WalkRoutePoint) => void,
  onDenied: () => void,
): Promise<WalkRouteStopWatch | null> {
  if (!isReactNativeRuntime() || !startupControlIsCurrent(control)) {
    return null;
  }
  return startNativeWalkRouteWatchWithLoader(
    () =>
      import("expo-location") as unknown as Promise<WalkRouteNativeLocationModule>,
    control,
    onPoint,
    onDenied,
  );
}

const defaultWalkRouteWatchAdapter: WalkRouteWatchAdapter = Object.freeze({
  async start(
    onPoint: (point: WalkRoutePoint) => void,
    onDenied: () => void,
    control: WalkRouteWatchStartControl,
  ) {
    if (!startupControlIsCurrent(control)) return null;
    const webStop = startWebWatch(onPoint, onDenied);
    if (webStop) {
      if (startupControlIsCurrent(control)) return webStop;
      attemptStopWatch(webStop);
      return null;
    }
    return startNativeWatch(control, onPoint, onDenied);
  },
});

/**
 * Start capturing a route for the given walk session key (its
 * walkStartedAt ISO string). Idempotent for the same key; a new key
 * discards the previous capture. Resolves once the platform watch is
 * established (or determined to be denied/unavailable).
 */
async function establishWalkRouteCapture(
  sessionKey: string,
  adapter: WalkRouteWatchAdapter,
  isCurrent: () => boolean,
): Promise<void> {
  if (!sessionKey || !isCurrent()) return;
  if (
    capture.sessionKey === sessionKey &&
    (capture.status === "recording" || capture.status === "starting")
  ) {
    return;
  }
  const preservedPoints =
    capture.sessionKey === sessionKey && capture.status === "paused"
      ? [...capture.points]
      : [];
  abortPendingWatchStart();
  stopActiveWatch();
  capture.generation += 1;
  const generation = capture.generation;
  const startController = new AbortController();
  capture.startController = startController;
  const startControl = Object.freeze({
    signal: startController.signal,
    isCurrent: () =>
      !startController.signal.aborted &&
      capture.generation === generation &&
      isCurrent(),
  });
  capture.sessionKey = sessionKey;
  capture.points = preservedPoints;
  setStatus("starting");

  const onPoint = (point: WalkRoutePoint) => {
    if (!isCurrent() || capture.generation !== generation) return;
    const last = capture.points[capture.points.length - 1] ?? null;
    if (!shouldAppendRoutePoint(last, point)) return;
    capture.points.push(point);
    if (capture.status !== "recording") capture.status = "recording";
    publish();
  };
  const onDenied = () => {
    if (!isCurrent() || capture.generation !== generation) return;
    stopActiveWatch();
    setStatus("denied");
  };

  let stopWatch: WalkRouteStopWatch | null;
  try {
    stopWatch = await adapter.start(onPoint, onDenied, startControl);
  } finally {
    if (capture.startController === startController) {
      capture.startController = null;
    }
  }
  if (!isCurrent() || capture.generation !== generation) {
    if (stopWatch) attemptStopWatch(stopWatch);
    return;
  }
  if (stopWatch) {
    capture.stopWatch = stopWatch;
    publish();
    return;
  }
  if (capture.status !== "denied") setStatus("unavailable");
}

export function startWalkRouteCaptureWithAdapter(
  sessionKey: string,
  adapter: WalkRouteWatchAdapter,
  isCurrent: () => boolean,
): Promise<void> {
  const operation = establishWalkRouteCapture(sessionKey, adapter, isCurrent);
  pendingCaptureStarts.add(operation);
  void operation.then(
    () => pendingCaptureStarts.delete(operation),
    () => pendingCaptureStarts.delete(operation),
  );
  return operation;
}

export function startWalkRouteCapture(
  sessionKey: string,
  isCurrent: () => boolean,
): Promise<void> {
  return startWalkRouteCaptureWithAdapter(
    sessionKey,
    defaultWalkRouteWatchAdapter,
    isCurrent,
  );
}

/**
 * Stop capturing and return the simplified route, or null when nothing
 * meaningful was recorded (denied, unsupported, or the dog never moved).
 * Passing a session key ignores the call when it doesn't match the
 * active capture.
 */
export function finishWalkRouteCapture(
  sessionKey?: string | null,
): WalkRouteCaptureResult | null {
  if (
    sessionKey != null &&
    capture.sessionKey != null &&
    sessionKey !== capture.sessionKey
  ) {
    return null;
  }
  const raw = capture.points;
  resetCapture();
  if (raw.length < 2) return null;
  const distanceM = Math.round(routeDistanceMeters(raw));
  if (distanceM < WALK_ROUTE_MIN_DISTANCE_M) return null;
  const points = simplifyRoute(raw).map((point) => ({
    lat: Math.round(point.lat * 1e6) / 1e6,
    lon: Math.round(point.lon * 1e6) / 1e6,
    t: Math.round(point.t),
  }));
  if (points.length < 2) return null;
  return { points, distanceM };
}

/** Discard any in-flight capture without persisting anything. */
export function cancelWalkRouteCapture(): void {
  resetCapture();
  retryRetainedWalkRouteStopHandles();
}

/**
 * Reset-owner barrier: revoke callbacks, stop the live watch, and drain starts.
 * Captured points remain staged until commit. If another owner cannot prepare,
 * the bridge can resume this paused session without losing the route.
 */
export async function cancelAndDrainWalkRouteCapture(): Promise<void> {
  abortPendingWatchStart();
  const activeStop = capture.stopWatch;
  capture.stopWatch = null;
  capture.generation += 1;
  setStatus(capture.sessionKey ? "paused" : "idle");

  const failures: unknown[] = [];
  const attempted = new Set<WalkRouteStopWatch>();
  const attempt = (stop: WalkRouteStopWatch) => {
    attempted.add(stop);
    try {
      attemptStopWatch(stop);
    } catch (error) {
      failures.push(error);
    }
  };

  if (activeStop) attempt(activeStop);
  for (const stop of [...retainedStopHandles]) {
    if (!attempted.has(stop)) attempt(stop);
  }

  while (pendingCaptureStarts.size > 0) {
    const startResults = await Promise.allSettled([...pendingCaptureStarts]);
    for (const result of startResults) {
      if (result.status === "rejected") failures.push(result.reason);
    }
  }
  if (pendingNativeWatchLiabilities.size > 0) {
    failures.push(
      new Error(
        "A native walk subscription is still being established. Retry after it finishes stopping.",
      ),
    );
  }
  if (retainedStopHandles.size > 0 && failures.length === 0) {
    failures.push(new Error("A walk capture subscription remains active."));
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      "Walk capture could not be fully stopped.",
    );
  }
}

export const walkRouteLocalDataResetParticipant = Object.freeze({
  prepare: cancelAndDrainWalkRouteCapture,
  async commit() {
    resetCapture();
  },
});

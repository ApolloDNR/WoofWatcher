import assert from "node:assert/strict";
import { test } from "node:test";

import { createLocalDataResetRuntime } from "./localDataResetRuntime.ts";
import * as walkRouteModule from "./walkRoute.ts";

import {
  WALK_ROUTE_MAX_POINTS,
  cancelWalkRouteCapture,
  finishWalkRouteCapture,
  fitRouteViewport,
  formatRouteDistanceMiles,
  getWalkRouteCaptureSnapshot,
  haversineMeters,
  latToWorldY,
  lonToWorldX,
  parseWalkRoute,
  projectRoutePoint,
  routeDistanceMeters,
  shouldAppendRoutePoint,
  simplifyRoute,
  startWalkRouteCapture,
  subscribeWalkRouteCapture,
  type WalkRoutePoint,
} from "./walkRoute.ts";

const SF = { lat: 37.7749, lon: -122.4194 };

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function point(lat: number, lon: number, t: number): WalkRoutePoint {
  return { lat, lon, t };
}

/** Meters of latitude converted to degrees (1 deg lat ~ 111.13 km). */
function latDegrees(meters: number): number {
  return meters / 111_132;
}

function attachResetPeers(
  runtime: ReturnType<typeof createLocalDataResetRuntime>,
  walkParticipant: { prepare(): Promise<void>; commit(): Promise<void> },
) {
  for (const id of [
    "avatar",
    "care",
    "device-preferences",
    "files",
    "query-cache",
    "web-runtime",
  ] as const) {
    runtime.attachRequiredParticipant(id, {
      prepare: async () => {},
      commit: async () => {},
    });
  }
  runtime.attachRequiredParticipant("walk-capture", walkParticipant);
}

test("walk reset tears down live capture and ignores a queued late callback", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  let onPoint:
    | ((position: {
        coords: { latitude: number; longitude: number };
        timestamp: number;
      }) => void)
    | null = null;
  let clearedWatchId: number | null = null;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: {
        watchPosition(callback: typeof onPoint) {
          onPoint = callback;
          return 41;
        },
        clearWatch(watchId: number) {
          clearedWatchId = watchId;
        },
      },
    },
  });

  try {
    await startWalkRouteCapture("live-reset-walk");
    const participant = (
      walkRouteModule as typeof walkRouteModule & {
        walkRouteLocalDataResetParticipant?: {
          prepare(): Promise<void>;
          commit(): Promise<void>;
        };
      }
    ).walkRouteLocalDataResetParticipant;
    assert.ok(participant, "walk capture must expose its required reset owner");

    const runtime = createLocalDataResetRuntime({
      async getItem() {
        return null;
      },
      async setItem() {},
      async removeItem() {},
    });
    attachResetPeers(runtime, participant);

    assert.equal((await runtime.operations.runReset()).status, "complete");
    assert.equal(clearedWatchId, 41);
    assert.equal(getWalkRouteCaptureSnapshot().status, "idle");
    onPoint?.({
      coords: { latitude: SF.lat, longitude: SF.lon },
      timestamp: 100,
    });
    assert.equal(getWalkRouteCaptureSnapshot().pointCount, 0);
  } finally {
    cancelWalkRouteCapture();
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  }
});

test("walk reset owner reports a native watch teardown failure", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  let stopCalls = 0;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: {
        watchPosition() {
          return 42;
        },
        clearWatch() {
          stopCalls += 1;
          if (stopCalls === 1) {
            throw new Error("native watch removal failed");
          }
        },
      },
    },
  });

  try {
    await startWalkRouteCapture("teardown-failure-walk");
    await assert.rejects(
      walkRouteModule.walkRouteLocalDataResetParticipant.prepare(),
      /fully stopped/,
    );
    assert.equal(stopCalls, 1);
    await assert.doesNotReject(
      walkRouteModule.walkRouteLocalDataResetParticipant.prepare(),
    );
    assert.equal(stopCalls, 2);
    assert.equal(getWalkRouteCaptureSnapshot().status, "idle");
  } finally {
    cancelWalkRouteCapture();
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  }
});

test("a deferred watch whose late stop fails remains retryable across reconstructed root reset", async () => {
  const setup = deferred<() => void>();
  let onPoint: ((point: WalkRoutePoint) => void) | null = null;
  let stopCalls = 0;
  let physicallyStopped = false;
  const startWithAdapter = (
    walkRouteModule as typeof walkRouteModule & {
      startWalkRouteCaptureWithAdapter?: (
        sessionKey: string,
        adapter: {
          start(
            point: (value: WalkRoutePoint) => void,
            denied: () => void,
          ): Promise<(() => void) | null>;
        },
      ) => Promise<void>;
    }
  ).startWalkRouteCaptureWithAdapter;
  assert.ok(startWithAdapter, "walk capture must expose its platform adapter boundary");

  const start = startWithAdapter("deferred-native-reset", {
    async start(point) {
      onPoint = point;
      return setup.promise;
    },
  });
  const firstRuntime = createLocalDataResetRuntime({
    async getItem() { return null; },
    async setItem() {},
    async removeItem() {},
  });
  attachResetPeers(
    firstRuntime,
    walkRouteModule.walkRouteLocalDataResetParticipant,
  );
  const firstReset = firstRuntime.operations.runReset();
  setup.resolve(() => {
    stopCalls += 1;
    if (stopCalls === 1) throw new Error("late native removal failed");
    physicallyStopped = true;
  });

  await assert.rejects(start, /late native removal failed/);
  const firstResult = await firstReset;
  assert.equal(firstResult.status, "partial-failure");
  assert.deepEqual(firstResult.failedParticipantIds, ["walk-capture"]);
  assert.equal(stopCalls, 1);
  assert.equal(physicallyStopped, false);
  onPoint?.(point(SF.lat, SF.lon, 100));
  assert.equal(getWalkRouteCaptureSnapshot().pointCount, 0);
  assert.equal(finishWalkRouteCapture("deferred-native-reset"), null);

  const reconstructed = createLocalDataResetRuntime({
    async getItem() { return null; },
    async setItem() {},
    async removeItem() {},
  });
  attachResetPeers(
    reconstructed,
    walkRouteModule.walkRouteLocalDataResetParticipant,
  );
  assert.equal((await reconstructed.operations.runReset()).status, "complete");
  assert.equal(stopCalls, 2);
  assert.equal(physicallyStopped, true);
  onPoint?.(point(SF.lat + 0.01, SF.lon, 200));
  assert.equal(getWalkRouteCaptureSnapshot().pointCount, 0);
  assert.equal(finishWalkRouteCapture("deferred-native-reset"), null);
});

test("haversineMeters matches known real-world distances", () => {
  // 0.01 degrees of latitude is ~1111.9 m anywhere on Earth.
  const north = { lat: SF.lat + 0.01, lon: SF.lon };
  const d = haversineMeters(SF, north);
  assert.ok(Math.abs(d - 1112) < 6, `expected ~1112m, got ${d}`);

  // 0.01 degrees of longitude at SF latitude is ~879 m (cos 37.77 ~ 0.7906).
  const east = { lat: SF.lat, lon: SF.lon + 0.01 };
  const dEast = haversineMeters(SF, east);
  assert.ok(Math.abs(dEast - 879) < 6, `expected ~879m, got ${dEast}`);

  assert.equal(haversineMeters(SF, SF), 0);
});

test("shouldAppendRoutePoint throttles by >=15m OR >=20s", () => {
  const start = point(SF.lat, SF.lon, 1_000_000);

  // First fix always lands.
  assert.equal(shouldAppendRoutePoint(null, start), true);

  // 5m and 5s later: rejected (neither threshold met).
  const near = point(SF.lat + latDegrees(5), SF.lon, start.t + 5_000);
  assert.equal(shouldAppendRoutePoint(start, near), false);

  // 20m moved after only 2s: accepted (distance threshold).
  const moved = point(SF.lat + latDegrees(20), SF.lon, start.t + 2_000);
  assert.equal(shouldAppendRoutePoint(start, moved), true);

  // 3m moved but 20s elapsed: accepted (time threshold).
  const waited = point(SF.lat + latDegrees(3), SF.lon, start.t + 20_000);
  assert.equal(shouldAppendRoutePoint(start, waited), true);

  // Fixes that predate the last kept point are rejected.
  const backwards = point(SF.lat + latDegrees(100), SF.lon, start.t - 1);
  assert.equal(shouldAppendRoutePoint(start, backwards), false);

  // Invalid coordinates never land.
  assert.equal(shouldAppendRoutePoint(null, point(91, 0, 1)), false);
  assert.equal(shouldAppendRoutePoint(null, point(0, 181, 1)), false);
  assert.equal(shouldAppendRoutePoint(null, point(NaN, 0, 1)), false);
  assert.equal(shouldAppendRoutePoint(null, point(0, 0, NaN)), false);
});

test("routeDistanceMeters sums consecutive segments", () => {
  const a = point(SF.lat, SF.lon, 0);
  const b = point(SF.lat + latDegrees(100), SF.lon, 60_000);
  const c = point(SF.lat + latDegrees(100), SF.lon + 0.001, 120_000);
  const total = routeDistanceMeters([a, b, c]);
  const expected = haversineMeters(a, b) + haversineMeters(b, c);
  assert.ok(Math.abs(total - expected) < 1e-9);
  assert.ok(Math.abs(total - 188) < 4, `expected ~188m, got ${total}`);
  assert.equal(routeDistanceMeters([a]), 0);
  assert.equal(routeDistanceMeters([]), 0);
});

test("simplifyRoute collapses collinear points but keeps real corners", () => {
  // Straight 300m line sampled every 15m: collapses to its endpoints.
  const line: WalkRoutePoint[] = [];
  for (let i = 0; i <= 20; i += 1) {
    line.push(point(SF.lat + latDegrees(i * 15), SF.lon, i * 20_000));
  }
  const simplifiedLine = simplifyRoute(line);
  assert.equal(simplifiedLine[0], line[0]);
  assert.equal(
    simplifiedLine[simplifiedLine.length - 1],
    line[line.length - 1],
  );
  assert.ok(
    simplifiedLine.length <= 3,
    `straight line should collapse, got ${simplifiedLine.length} points`,
  );

  // An L-shape must keep the corner: 200m north, then 200m east.
  const corner = point(SF.lat + latDegrees(200), SF.lon, 200_000);
  const lShape = [
    point(SF.lat, SF.lon, 0),
    point(SF.lat + latDegrees(100), SF.lon, 100_000),
    corner,
    point(SF.lat + latDegrees(200), SF.lon + 0.001, 300_000),
    point(SF.lat + latDegrees(200), SF.lon + 0.002, 400_000),
  ];
  const simplifiedL = simplifyRoute(lShape);
  assert.ok(
    simplifiedL.some((p) => p.lat === corner.lat && p.lon === corner.lon),
    "corner point must survive simplification",
  );
});

test("simplifyRoute caps long zigzag walks at 200 points, endpoints intact", () => {
  // A 1000-point zigzag (every point is a genuine corner, worst case for DP).
  const zigzag: WalkRoutePoint[] = [];
  for (let i = 0; i < 1000; i += 1) {
    zigzag.push(
      point(
        SF.lat + latDegrees(i * 20),
        SF.lon + (i % 2 === 0 ? 0 : 0.0004),
        i * 20_000,
      ),
    );
  }
  const simplified = simplifyRoute(zigzag);
  assert.ok(
    simplified.length <= WALK_ROUTE_MAX_POINTS,
    `expected <=${WALK_ROUTE_MAX_POINTS}, got ${simplified.length}`,
  );
  assert.ok(simplified.length >= 2);
  assert.deepEqual(simplified[0], zigzag[0]);
  assert.deepEqual(
    simplified[simplified.length - 1],
    zigzag[zigzag.length - 1],
  );

  // Short routes pass through untouched apart from collinear cleanup.
  const short = [
    point(SF.lat, SF.lon, 0),
    point(SF.lat + 0.001, SF.lon + 0.001, 60_000),
  ];
  assert.deepEqual(simplifyRoute(short), short);
});

test("parseWalkRoute accepts only plausible stored routes", () => {
  const good = [
    { lat: 37.7749, lon: -122.4194, t: 1_700_000_000_000 },
    { lat: 37.7759, lon: -122.4184, t: 1_700_000_060_000 },
  ];
  assert.deepEqual(parseWalkRoute(good), good);

  assert.equal(parseWalkRoute(undefined), null);
  assert.equal(parseWalkRoute("route"), null);
  assert.equal(parseWalkRoute([]), null);
  assert.equal(parseWalkRoute([good[0]]), null, "single point is not a route");
  assert.equal(parseWalkRoute([good[0], { lat: 99, lon: 0, t: 1 }]), null);
  assert.equal(parseWalkRoute([good[0], { lat: "37", lon: -122, t: 1 }]), null);
});

test("formatRouteDistanceMiles renders walkable distances honestly", () => {
  assert.equal(formatRouteDistanceMiles(0), "0 ft");
  assert.equal(formatRouteDistanceMiles(1609.344), "1.0 mi");
  assert.equal(formatRouteDistanceMiles(644), "0.4 mi");
  assert.equal(formatRouteDistanceMiles(60), "200 ft");
  assert.equal(formatRouteDistanceMiles(17_000), "10.6 mi");
  assert.equal(formatRouteDistanceMiles(NaN), "");
  assert.equal(formatRouteDistanceMiles(-5), "");
});

test("fitRouteViewport clamps zoom to 14-17 and centers on the route", () => {
  // A tiny ~30m route zooms all the way in.
  const tiny = [
    point(SF.lat, SF.lon, 0),
    point(SF.lat + latDegrees(30), SF.lon, 60_000),
  ];
  const tinyViewport = fitRouteViewport(tiny, 358, 286);
  assert.ok(tinyViewport);
  assert.equal(tinyViewport.zoom, 17);

  // A ~5km route cannot fit above the minimum zoom.
  const long = [
    point(SF.lat, SF.lon, 0),
    point(SF.lat + latDegrees(5000), SF.lon, 3_600_000),
  ];
  const longViewport = fitRouteViewport(long, 358, 286);
  assert.ok(longViewport);
  assert.equal(longViewport.zoom, 14);
  const longProjected = long.map((routePoint) =>
    projectRoutePoint(routePoint, longViewport, 358, 286),
  );
  for (const routePoint of longProjected) {
    assert.ok(
      routePoint.x >= 28 && routePoint.x <= 358 - 28,
      `expected x=${routePoint.x} inside the padded viewport`,
    );
    assert.ok(
      routePoint.y >= 28 && routePoint.y <= 286 - 28,
      `expected y=${routePoint.y} inside the padded viewport`,
    );
  }

  // Center is the bbox midpoint in world pixels.
  const mid = {
    lat: (tiny[0].lat + tiny[1].lat) / 2,
    lon: tiny[0].lon,
  };
  assert.ok(Math.abs(tinyViewport.centerX - lonToWorldX(mid.lon, 17)) < 0.51);
  assert.ok(Math.abs(tinyViewport.centerY - latToWorldY(mid.lat, 17)) < 0.51);

  assert.equal(fitRouteViewport([], 358, 286), null);
  assert.equal(fitRouteViewport(tiny, 0, 0), null);
});

test("private route projection keeps the GPS shape inside the local canvas", () => {
  const route = [
    point(SF.lat, SF.lon, 0),
    point(SF.lat + latDegrees(180), SF.lon + 0.001, 300_000),
    point(SF.lat + latDegrees(400), SF.lon + 0.004, 600_000),
  ];
  const width = 358;
  const height = 286;
  const viewport = fitRouteViewport(route, width, height);
  assert.ok(viewport);

  const projected = route.map((point) =>
    projectRoutePoint(point, viewport, width, height),
  );
  for (const point of projected) {
    assert.ok(point.x >= 28 && point.x <= width - 28);
    assert.ok(point.y >= 28 && point.y <= height - 28);
  }

  // The canvas preserves travel direction and each real corner instead of
  // replacing the route with a generic decorative line.
  assert.ok(projected[0].x < projected[1].x);
  assert.ok(projected[1].x < projected[2].x);
  assert.ok(projected[0].y > projected[1].y);
  assert.ok(projected[1].y > projected[2].y);
  assert.notDeepEqual(projected[0], projected[projected.length - 1]);
});

test("recorder degrades to a no-op outside web/native runtimes", async () => {
  // Plain Node has no geolocation and is not React Native: the recorder
  // must report "unavailable" and hand back nothing, without throwing.
  const seen: string[] = [];
  const unsubscribe = subscribeWalkRouteCapture(() => {
    seen.push(getWalkRouteCaptureSnapshot().status);
  });
  try {
    await startWalkRouteCapture("2026-07-10T17:00:00.000Z");
    assert.equal(getWalkRouteCaptureSnapshot().status, "unavailable");
    assert.equal(getWalkRouteCaptureSnapshot().pointCount, 0);
    assert.ok(seen.includes("starting"));
    assert.ok(seen.includes("unavailable"));

    // Finishing an empty capture returns null and resets to idle.
    assert.equal(finishWalkRouteCapture("2026-07-10T17:00:00.000Z"), null);
    assert.equal(getWalkRouteCaptureSnapshot().status, "idle");

    // Finishing with a mismatched key never steals another session.
    await startWalkRouteCapture("session-a");
    assert.equal(finishWalkRouteCapture("session-b"), null);
    assert.equal(getWalkRouteCaptureSnapshot().sessionKey, "session-a");
  } finally {
    unsubscribe();
    cancelWalkRouteCapture();
  }
  assert.equal(getWalkRouteCaptureSnapshot().status, "idle");
});

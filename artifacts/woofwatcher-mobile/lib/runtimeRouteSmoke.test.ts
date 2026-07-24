import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const runtimeSmoke = require("../scripts/smoke-runtime-preview.js") as {
  ROUTE_CONTENT_EXPECTATIONS: Record<string, readonly string[]>;
  ACCESSIBILITY_LAYOUT_PROOF_SCALES?: readonly number[];
  ACCESSIBILITY_LAYOUT_PROOF_SURFACES?: ReadonlyArray<{
    id: string;
    route: string;
    marker: string;
    kind: string;
  }>;
  validateAccessibilityLayoutSnapshot?: (
    snapshot: {
      pathname: string;
      searchScale: string;
      marker: {
        fontScale: number;
        stackStatusRows: boolean;
        quickActionColumns: number;
        controlMinHeight: number;
      };
      targetCount: number;
      targetMinHeight: number;
      insideRouteBounds: boolean;
      actualColumns?: number;
      actionNested?: boolean;
      contentFlexDirection?: string;
      rowFlexDirection?: string;
      actionWidthRatio?: number;
    },
    surface: {
      id: string;
      route: string;
      marker: string;
      kind: string;
    },
    scale: number,
  ) => string[];
  isRectContainedByRoute?: (
    rect: {
      width: number;
      height: number;
      left: number;
      right: number;
      top: number;
      bottom: number;
    },
    routeRect: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    },
    tolerance?: number,
  ) => boolean;
  waitForStableRouteContent?: (
    client: {
      send: (
        method: string,
        params?: Record<string, unknown>,
      ) => Promise<{ result?: { value?: unknown } }>;
    },
    route: string,
    expected: readonly string[],
    options?: {
      timeoutMs?: number;
      pollMs?: number;
      settleMs?: number;
      now?: () => number;
      delayFn?: (milliseconds: number) => Promise<void>;
    },
  ) => Promise<{
    stable: boolean;
    pathname: string;
    body: string;
  }>;
  createSmokeSourceFingerprint?: (projectRoot: string) => string;
  validateSmokeSourceProvenance?: (
    provenance: unknown,
    currentFingerprint: string,
  ) => void;
  terminateBrowser?: (
    browser: EventEmitter & {
      exitCode: number | null;
      kill: (signal: NodeJS.Signals) => boolean;
    },
    options?: {
      timeoutMs?: number;
    },
  ) => Promise<void>;
};

function createSnapshotClient(
  snapshots: ReadonlyArray<{ pathname: string; body: string }>,
) {
  let index = 0;
  return {
    async send(method: string) {
      assert.equal(method, "Runtime.evaluate");
      const snapshot = snapshots[Math.min(index, snapshots.length - 1)];
      index += 1;
      return { result: { value: snapshot } };
    },
    readCount() {
      return index;
    },
  };
}

test("rejects route content that redirects during the settle window", async () => {
  assert.equal(
    typeof runtimeSmoke.waitForStableRouteContent,
    "function",
    "runtime smoke must expose the stable pathname-and-content proof",
  );
  if (!runtimeSmoke.waitForStableRouteContent) return;

  let now = 0;
  const client = createSnapshotClient([
    { pathname: "/privacy", body: "Your data, your rules" },
    { pathname: "/more", body: "Privacy & Safety" },
    { pathname: "/more", body: "Privacy & Safety" },
  ]);
  const result = await runtimeSmoke.waitForStableRouteContent(
    client,
    "/privacy",
    ["Your data, your rules"],
    {
      timeoutMs: 3,
      pollMs: 1,
      settleMs: 1,
      now: () => now,
      delayFn: async (milliseconds) => {
        now += Math.max(milliseconds, 1);
      },
    },
  );

  assert.equal(result.stable, false);
  assert.equal(result.pathname, "/more");
  assert.equal(result.body, "Privacy & Safety");
  assert.ok(client.readCount() >= 2, "the current document must be re-read");
});

test("accepts only a marker that remains current at the requested path", async () => {
  assert.equal(typeof runtimeSmoke.waitForStableRouteContent, "function");
  if (!runtimeSmoke.waitForStableRouteContent) return;

  let now = 0;
  const client = createSnapshotClient([
    { pathname: "/privacy", body: "Your data, your rules" },
    { pathname: "/privacy", body: "Your data, your rules" },
  ]);
  const result = await runtimeSmoke.waitForStableRouteContent(
    client,
    "/privacy",
    ["Your data, your rules"],
    {
      timeoutMs: 3,
      pollMs: 1,
      settleMs: 1,
      now: () => now,
      delayFn: async (milliseconds) => {
        now += Math.max(milliseconds, 1);
      },
    },
  );

  assert.deepEqual(result, {
    stable: true,
    pathname: "/privacy",
    body: "Your data, your rules",
  });
  assert.equal(client.readCount(), 2);
});

test("uses route-unique deterministic content markers", () => {
  assert.deepEqual(runtimeSmoke.ROUTE_CONTENT_EXPECTATIONS["/"], [
    "WELCOME TO WOOFWATCHER",
  ]);
  assert.deepEqual(runtimeSmoke.ROUTE_CONTENT_EXPECTATIONS["/sign-in"], [
    "Accounts are not connected in this preview build.",
  ]);
  assert.deepEqual(runtimeSmoke.ROUTE_CONTENT_EXPECTATIONS["/log"], [
    "Log History",
  ]);
  assert.deepEqual(runtimeSmoke.ROUTE_CONTENT_EXPECTATIONS["/calendar"], [
    "MISSION SCHEDULE",
  ]);
  assert.deepEqual(runtimeSmoke.ROUTE_CONTENT_EXPECTATIONS["/privacy"], [
    "Your data, your rules",
  ]);
  assert.deepEqual(runtimeSmoke.ROUTE_CONTENT_EXPECTATIONS["/portrait"], [
    "Choose a pixel twin, then customize.",
  ]);
  assert.deepEqual(runtimeSmoke.ROUTE_CONTENT_EXPECTATIONS["/fastlog"], [
    "What would you like",
  ]);

  const deterministicRoutes = [
    "/",
    "/sign-in",
    "/setup",
    "/fastlog",
    "/log",
    "/calendar",
    "/health",
    "/records",
    "/more",
    "/woofguide",
    "/privacy",
    "/portrait",
  ];
  const markers = deterministicRoutes.map((route) => {
    const expected = runtimeSmoke.ROUTE_CONTENT_EXPECTATIONS[route];
    assert.equal(
      expected?.length,
      1,
      `${route} must have exactly one deterministic route marker`,
    );
    return expected[0];
  });
  assert.equal(
    new Set(markers).size,
    markers.length,
    "deterministic route markers must not overlap each other",
  );
});

test("defines and validates the 15-case font-scale layout proof matrix", () => {
  assert.deepEqual(runtimeSmoke.ACCESSIBILITY_LAYOUT_PROOF_SCALES, [
    1,
    1.4,
    2,
  ]);
  assert.deepEqual(
    runtimeSmoke.ACCESSIBILITY_LAYOUT_PROOF_SURFACES?.map(
      ({ id, route, marker, kind }) => ({ id, route, marker, kind }),
    ),
    [
      {
        id: "today",
        route: "/",
        marker: "qa-layout-today",
        kind: "quick-grid",
      },
      {
        id: "plan",
        route: "/calendar",
        marker: "qa-layout-plan",
        kind: "plan-mission",
      },
      {
        id: "fast-log",
        route: "/fastlog",
        marker: "qa-layout-fast-log",
        kind: "quick-grid",
      },
      {
        id: "health",
        route: "/health",
        marker: "qa-layout-health",
        kind: "health-summary",
      },
      {
        id: "more",
        route: "/more",
        marker: "qa-layout-more",
        kind: "more-directory",
      },
    ],
  );
  assert.equal(
    typeof runtimeSmoke.validateAccessibilityLayoutSnapshot,
    "function",
  );
  if (
    !runtimeSmoke.ACCESSIBILITY_LAYOUT_PROOF_SURFACES ||
    !runtimeSmoke.validateAccessibilityLayoutSnapshot
  ) {
    return;
  }

  for (const surface of runtimeSmoke.ACCESSIBILITY_LAYOUT_PROOF_SURFACES) {
    for (const scale of [1, 1.4, 2]) {
      const reflows = scale >= 1.4;
      const expectedControlMinHeight =
        scale === 1 ? 48 : scale === 1.4 ? 54 : 64;
      const validSnapshot = {
        pathname: surface.route,
        searchScale: String(scale),
        marker: {
          fontScale: scale,
          stackStatusRows: reflows,
          quickActionColumns: reflows ? 2 : 3,
          controlMinHeight: expectedControlMinHeight,
        },
        targetCount: 1,
        targetMinHeight: expectedControlMinHeight,
        insideRouteBounds: true,
        actualColumns: reflows ? 2 : 3,
        actionNested: reflows,
        contentFlexDirection: reflows ? "column" : "row",
        rowFlexDirection: reflows ? "column" : "row",
        actionWidthRatio: reflows ? 1 : 0.3,
      };
      assert.deepEqual(
        runtimeSmoke.validateAccessibilityLayoutSnapshot(
          validSnapshot,
          surface,
          scale,
        ),
        [],
        `${surface.id} must accept its ${scale} layout branch`,
      );

      const wrongBranch = {
        ...validSnapshot,
        marker: {
          ...validSnapshot.marker,
          stackStatusRows: !reflows,
        },
      };
      assert.ok(
        runtimeSmoke.validateAccessibilityLayoutSnapshot(
          wrongBranch,
          surface,
          scale,
        ).length > 0,
        `${surface.id} must reject a marker from the wrong ${scale} branch`,
      );
    }
  }

  const runner = readFileSync(
    new URL("../scripts/smoke-runtime-preview.js", import.meta.url),
    "utf8",
  );
  assert.match(runner, /qaFontScale/);
  assert.match(runner, /Page\.captureScreenshot/);
  assert.match(runner, /a11y-layout-proof/);
  assert.match(runner, /15 case\(s\)/);
});

test("route containment rejects overflow and zero-size controls on every edge", () => {
  assert.equal(
    typeof runtimeSmoke.isRectContainedByRoute,
    "function",
    "runtime smoke must expose its executable four-edge containment predicate",
  );
  if (!runtimeSmoke.isRectContainedByRoute) return;

  const routeRect = { left: 10, right: 110, top: 20, bottom: 220 };
  const contained = {
    width: 80,
    height: 40,
    left: 20,
    right: 100,
    top: 30,
    bottom: 70,
  };

  assert.equal(runtimeSmoke.isRectContainedByRoute(contained, routeRect), true);
  assert.equal(
    runtimeSmoke.isRectContainedByRoute(
      { ...contained, left: 8 },
      routeRect,
    ),
    false,
  );
  assert.equal(
    runtimeSmoke.isRectContainedByRoute(
      { ...contained, right: 112 },
      routeRect,
    ),
    false,
  );
  assert.equal(
    runtimeSmoke.isRectContainedByRoute(
      { ...contained, top: 18 },
      routeRect,
    ),
    false,
  );
  assert.equal(
    runtimeSmoke.isRectContainedByRoute(
      { ...contained, bottom: 222 },
      routeRect,
    ),
    false,
  );
  assert.equal(
    runtimeSmoke.isRectContainedByRoute(
      { ...contained, width: 0 },
      routeRect,
    ),
    false,
  );
  assert.equal(
    runtimeSmoke.isRectContainedByRoute(
      { ...contained, height: 0 },
      routeRect,
    ),
    false,
  );
});

test("binds a runtime route proof to the current exported source", () => {
  assert.equal(
    typeof runtimeSmoke.createSmokeSourceFingerprint,
    "function",
    "runtime smoke must expose the same source fingerprint used by smoke:web",
  );
  assert.equal(
    typeof runtimeSmoke.validateSmokeSourceProvenance,
    "function",
    "runtime smoke must reject a missing or stale export before opening Chromium",
  );
  if (
    !runtimeSmoke.createSmokeSourceFingerprint ||
    !runtimeSmoke.validateSmokeSourceProvenance
  ) {
    return;
  }

  const fixtureRoot = mkdtempSync(join(tmpdir(), "woofwatcher-smoke-source-"));
  try {
    mkdirSync(join(fixtureRoot, "app"), { recursive: true });
    writeFileSync(join(fixtureRoot, "app", "route.tsx"), "export default 'v1';\n");
    writeFileSync(join(fixtureRoot, ".tsbuildinfo"), "generated-cache-v1\n");
    const initialFingerprint =
      runtimeSmoke.createSmokeSourceFingerprint(fixtureRoot);

    runtimeSmoke.validateSmokeSourceProvenance(
      {
        schemaVersion: 1,
        sourceFingerprint: initialFingerprint,
      },
      initialFingerprint,
    );

    writeFileSync(join(fixtureRoot, ".tsbuildinfo"), "generated-cache-v2\n");
    assert.equal(
      runtimeSmoke.createSmokeSourceFingerprint(fixtureRoot),
      initialFingerprint,
      "generated compiler caches must not make a current export look stale",
    );

    writeFileSync(join(fixtureRoot, "app", "route.tsx"), "export default 'v2';\n");
    const changedFingerprint =
      runtimeSmoke.createSmokeSourceFingerprint(fixtureRoot);
    assert.notEqual(changedFingerprint, initialFingerprint);
    assert.throws(
      () =>
        runtimeSmoke.validateSmokeSourceProvenance(
          {
            schemaVersion: 1,
            sourceFingerprint: initialFingerprint,
          },
          changedFingerprint,
        ),
      /stale.*smoke:web/i,
    );

    assert.throws(
      () =>
        runtimeSmoke.validateSmokeSourceProvenance(
          null,
          changedFingerprint,
        ),
      /missing.*smoke:web/i,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("waits for Chromium to exit before cleaning its profile", async () => {
  assert.equal(
    typeof runtimeSmoke.terminateBrowser,
    "function",
    "runtime smoke must await Chromium exit after SIGTERM",
  );
  if (!runtimeSmoke.terminateBrowser) return;

  class FakeBrowser extends EventEmitter {
    exitCode: number | null = null;
    signals: NodeJS.Signals[] = [];

    kill(signal: NodeJS.Signals) {
      this.signals.push(signal);
      queueMicrotask(() => {
        this.emit("exit", 0, signal);
      });
      return true;
    }
  }

  const browser = new FakeBrowser();
  await runtimeSmoke.terminateBrowser(browser, { timeoutMs: 100 });

  assert.deepEqual(browser.signals, ["SIGTERM"]);
});

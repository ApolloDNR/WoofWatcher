import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  QA_EXECUTABLE_CONSUMER_ROUTES,
  QA_OWNER_ONLY_ROUTE_PREFIXES,
  QA_SCREENSHOT_ROUTES,
  QA_STANDALONE_CONSUMER_ROUTES,
  assertConsumerCandidatePreview,
  browserErrorCount,
  normalizeBaseUrl,
  screenshotSweepFailed,
} from "../../../artifacts/woofwatcher-mobile/scripts/qa-browser-harness.mjs";
import navigationManifestModule from "../../../artifacts/woofwatcher-mobile/scripts/universal-navigation-manifest.js";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const readRepoFile = (relativePath) =>
  readFileSync(`${ROOT}/${relativePath}`, "utf8");

const { UNIVERSAL_NAVIGATION_MANIFEST, UNIVERSAL_NAVIGATION_QA_ROUTES } =
  navigationManifestModule;

test("screenshot sweeps cover every executable consumer navigation route", () => {
  const routeSet = new Set(QA_EXECUTABLE_CONSUMER_ROUTES);
  const screenshotRouteSet = new Set(
    QA_SCREENSHOT_ROUTES.map(({ route }) => route),
  );

  for (const route of UNIVERSAL_NAVIGATION_QA_ROUTES) {
    assert.ok(routeSet.has(route), `missing manifest QA route ${route}`);
  }
  assert.deepEqual(QA_OWNER_ONLY_ROUTE_PREFIXES, [
    "/sign-in",
    "/sign-up",
    "/care-twin-qa",
    "/premium",
  ]);
  for (const route of UNIVERSAL_NAVIGATION_MANIFEST.runtimeSupplementalRoutes) {
    if (
      QA_OWNER_ONLY_ROUTE_PREFIXES.some(
        (prefix) => route === prefix || route.startsWith(`${prefix}?`),
      )
    ) {
      assert.equal(
        routeSet.has(route),
        false,
        `owner-only route leaked: ${route}`,
      );
      continue;
    }
    assert.ok(routeSet.has(route), `missing consumer runtime route ${route}`);
  }
  for (const route of ["/fastlog", "/calendar-month"]) {
    assert.ok(QA_STANDALONE_CONSUMER_ROUTES.includes(route));
    assert.ok(
      routeSet.has(route),
      `missing standalone consumer route ${route}`,
    );
  }

  assert.deepEqual(screenshotRouteSet, routeSet);
  assert.equal(
    new Set(QA_SCREENSHOT_ROUTES.map(({ name }) => name)).size,
    QA_SCREENSHOT_ROUTES.length,
  );
  for (const { name, settle } of QA_SCREENSHOT_ROUTES) {
    assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*?(?:--[a-z0-9-]+)*$/);
    assert.ok(settle >= 3000);
  }
});

test("browser harness normalizes BASE_URL and treats misses/runtime errors as failures", () => {
  assert.equal(
    normalizeBaseUrl("http://127.0.0.1:4194/"),
    "http://127.0.0.1:4194",
  );
  assert.equal(
    normalizeBaseUrl("https://preview.example.test/base///"),
    "https://preview.example.test/base",
  );
  assert.throws(() => normalizeBaseUrl("file:///tmp/export"), /http or https/);

  assert.equal(browserErrorCount({}), 0);
  assert.equal(browserErrorCount({ home: ["boom", "boom"] }), 1);
  assert.equal(screenshotSweepFailed({ errors: {}, misses: [] }), false);
  assert.equal(
    screenshotSweepFailed({ errors: {}, misses: [{ route: "/log" }] }),
    true,
  );
  assert.equal(
    screenshotSweepFailed({ errors: { home: ["console: boom"] }, misses: [] }),
    true,
  );
});

test("screenshot QA rejects previews without exact consumer candidate identity", async () => {
  const identity = {
    kind: "woofwatcher-web-candidate",
    sourceCommit: "abc123",
    sourceTree: "tree123",
    buildProfile: "production",
    ownerOpsVisible: false,
  };
  const acceptedPage = {
    request: {
      async get() {
        return {
          ok: () => true,
          status: () => 200,
          json: async () => identity,
        };
      },
    },
  };
  assert.deepEqual(
    await assertConsumerCandidatePreview(acceptedPage, "http://127.0.0.1:4194"),
    identity,
  );

  const rejectedPage = {
    request: {
      async get() {
        return {
          ok: () => true,
          status: () => 200,
          json: async () => ({ ...identity, ownerOpsVisible: true }),
        };
      },
    },
  };
  await assert.rejects(
    assertConsumerCandidatePreview(rejectedPage, "http://127.0.0.1:4194"),
    /not a production consumer candidate/,
  );
});

test("package metadata pins Playwright and exposes root and mobile QA commands", () => {
  const rootPackage = JSON.parse(readRepoFile("package.json"));
  const mobilePackage = JSON.parse(
    readRepoFile("artifacts/woofwatcher-mobile/package.json"),
  );
  const commands = [
    "qa:web:workflows",
    "qa:web:screenshots",
    "qa:web:screenshots:dark",
    "qa:web:screenshots:populated",
  ];

  assert.equal(mobilePackage.devDependencies.playwright, "1.62.1");
  for (const command of commands) {
    assert.equal(typeof mobilePackage.scripts[command], "string");
    assert.equal(typeof rootPackage.scripts[command], "string");
  }

  const lock = readRepoFile("pnpm-lock.yaml");
  assert.match(
    lock,
    /playwright:\n\s+specifier: 1\.62\.1\n\s+version: 1\.62\.1/,
  );
  assert.match(lock, /playwright@1\.62\.1:/);
  assert.match(lock, /playwright-core@1\.62\.1:/);
});

test("workflow E2E follows the current navigation and in-app deletion contract", () => {
  const source = readRepoFile(
    "artifacts/woofwatcher-mobile/scripts/e2e-web-workflows.mjs",
  );

  assert.match(source, /process\.env\.BASE_URL/);
  assert.match(source, /smoke-web-export\.js --candidate/);
  assert.match(source, /await assertConsumerCandidatePreview\(page, BASE\)/);
  assert.match(source, /\["Home", "Log", "Plans", "Health", "More"\]/);
  assert.match(source, /clickLabel\("History", true\)/);
  assert.match(source, /clickLabel\("Delete device data", true\)/);
  assert.match(source, /clickLabel\("Yes, delete device data", true\)/);
  assert.match(source, /Local care content deleted/);
  assert.match(source, /Continue after local data deletion/);
  assert.match(source, /beforeLogs > 0/);
  assert.match(source, /afterLogs === 0/);
  assert.match(source, /browserErrorCount\(errorsByStep\)/);
  assert.doesNotMatch(source, /\.accept\(\)/);
});

test("all screenshot entrypoints propagate misses and browser errors", () => {
  for (const filename of [
    "qa-screenshots.mjs",
    "qa-screenshots-dark.mjs",
    "qa-seed-populated.mjs",
  ]) {
    const source = readRepoFile(
      `artifacts/woofwatcher-mobile/scripts/${filename}`,
    );
    assert.match(source, /misses\.push/);
    assert.match(source, /diagnostics\.record/);
    assert.match(source, /screenshotSweepFailed/);
    assert.match(source, /process\.exitCode = 1/);
    assert.match(source, /await assertConsumerCandidatePreview\(page, BASE\)/);
    assert.match(
      source,
      /smoke-web-export\.js --candidate/,
      `${filename} must build the exact consumer candidate before capture`,
    );
  }

  for (const filename of ["qa-screenshots.mjs", "qa-screenshots-dark.mjs"]) {
    const source = readRepoFile(
      `artifacts/woofwatcher-mobile/scripts/${filename}`,
    );
    assert.match(source, /QA_SCREENSHOT_ROUTES/);
  }
});

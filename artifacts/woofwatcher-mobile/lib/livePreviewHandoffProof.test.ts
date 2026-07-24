import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);

const {
  LIVE_PREVIEW_HANDOFF_ROUTES,
  buildLivePreviewHandoffProof,
  collectLivePreviewHandoffProof,
  formatLivePreviewHandoffProofText,
} = require("../scripts/live-preview-handoff-proof.js");
const {
  createSmokeSourceFingerprint,
  createSmokeSourceProvenance,
} = require("../scripts/smoke-source-provenance.js");

function createPreviewFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), "woofwatcher-live-preview-"));
  const exportRoot = join(projectRoot, ".expo-smoke");
  mkdirSync(join(projectRoot, "app"), { recursive: true });
  mkdirSync(exportRoot, { recursive: true });
  writeFileSync(
    join(projectRoot, "app", "index.tsx"),
    "export default function Home() { return null; }\n",
  );
  writeFileSync(
    join(exportRoot, "index.html"),
    '<!doctype html><script src="/_expo/static/js/web/entry-test.js"></script>',
  );
  return { projectRoot, exportRoot };
}

function writeCurrentProvenance(projectRoot: string, exportRoot: string) {
  writeFileSync(
    join(exportRoot, "smoke-source-provenance.json"),
    `${JSON.stringify(
      createSmokeSourceProvenance(createSmokeSourceFingerprint(projectRoot)),
      null,
      2,
    )}\n`,
  );
}

test("builds preview-only handoff proof from served route results", () => {
  const routeResults = LIVE_PREVIEW_HANDOFF_ROUTES.map((route: string) => ({
    route,
    statusCode: 200,
    contentType: "text/html; charset=utf-8",
    includesExpoEntry: true,
  }));

  const proof = buildLivePreviewHandoffProof({
    baseUrl: "http://127.0.0.1:4194/",
    commit: "89857dc",
    exportIndexMtimeIso: "2026-07-03T11:40:00.000Z",
    generatedAtIso: "2026-07-03T12:00:00.000Z",
    routeResults,
    sourceProvenance: {
      status: "PASS",
      algorithm: "sha256",
      sourceFingerprint: "abc123",
      detail: "Current mobile/shared export inputs match the saved smoke export fingerprint.",
    },
  });
  const text = formatLivePreviewHandoffProofText(proof);

  assert.equal(proof.title, "WoofWatcher Live Preview Handoff Proof");
  assert.equal(proof.result, "PASS");
  assert.equal(proof.baseUrl, "http://127.0.0.1:4194/");
  assert.equal(proof.commit, "89857dc");
  assert.equal(proof.sourceProvenance.status, "PASS");
  assert.ok(proof.routeChecks.every((check: { status: string }) => check.status === "PASS"));
  assert.deepEqual(
    proof.routes,
    [
      "/",
      "/sign-in",
      "/setup",
      "/fastlog",
      "/log",
      "/calendar",
      "/health",
      "/records",
      "/more",
      "/privacy",
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
    ],
  );
  assert.ok(
    proof.truthBoundaries.some((boundary: string) =>
      boundary.includes("web preview only") && boundary.includes("does not replace native iOS/Android proof"),
    ),
  );
  assert.ok(
    proof.truthBoundaries.some((boundary: string) =>
      boundary.includes("SHA-256 fingerprint") &&
      boundary.includes("current mobile/shared export inputs") &&
      boundary.includes("does not prove a clean Git commit or CI run"),
    ),
  );
  assert.match(text, /WoofWatcher Live Preview Handoff Proof/);
  assert.match(text, /Result: PASS/);
  assert.match(text, /http:\/\/127\.0\.0\.1:4194\//);
  assert.match(text, /\/sign-in/);
  assert.match(text, /\/setup/);
  assert.match(text, /\/fastlog/);
  assert.match(text, /\/privacy/);
  assert.match(text, /auth-setup-onboarding-proof/);
  assert.match(text, /route-visual-consistency/);
  assert.match(text, /care-entry-provider-sync-proof/);
  assert.match(text, /woofguide-ai-provider-proof/);
  assert.match(text, /push-notifications-proof/);
  assert.match(text, /payments-provider-proof/);
  assert.match(text, /store-accounts-proof/);
  assert.match(text, /account-deletion-proof/);
  assert.match(text, /support-legal-readiness-proof/);
  assert.match(text, /web preview only/);
  assert.match(text, /does not replace native iOS\/Android proof/);
  assert.match(text, /Source provenance: PASS/);
  assert.match(text, /SHA-256 fingerprint/);
});

test("blocks live preview handoff proof when any route misses the Expo web shell", () => {
  const routeResults = LIVE_PREVIEW_HANDOFF_ROUTES.map((route: string) => ({
    route,
    statusCode: route === "/records" ? 500 : 200,
    contentType: route === "/records" ? "text/plain" : "text/html; charset=utf-8",
    includesExpoEntry: route !== "/records",
  }));

  const proof = buildLivePreviewHandoffProof({
    baseUrl: "http://127.0.0.1:4194/",
    commit: "89857dc",
    exportIndexMtimeIso: "2026-07-03T11:40:00.000Z",
    generatedAtIso: "2026-07-03T12:00:00.000Z",
    routeResults,
    sourceProvenance: {
      status: "PASS",
      algorithm: "sha256",
      sourceFingerprint: "abc123",
      detail: "Current mobile/shared export inputs match the saved smoke export fingerprint.",
    },
  });

  assert.equal(proof.result, "BLOCKED");
  assert.ok(
    proof.routeChecks.some(
      (check: { route: string; status: string; detail: string }) =>
        check.route === "/records" &&
        check.status === "BLOCKED" &&
        check.detail.includes("500"),
    ),
  );
  assert.ok(
    proof.nextActions.some((action: string) =>
      action.includes("Attach this JSON") && action.includes("without claiming native QA"),
    ),
  );
});

test("blocks standalone live preview proof when source provenance is missing", async () => {
  const fixture = createPreviewFixture();
  try {
    const proof = await collectLivePreviewHandoffProof({
      projectRoot: fixture.projectRoot,
      exportRoot: fixture.exportRoot,
      commit: "missing-proof",
    });

    assert.equal(proof.result, "BLOCKED");
    assert.equal(proof.sourceProvenance.status, "BLOCKED");
    assert.match(proof.sourceProvenance.detail, /missing.*smoke:web/i);
    assert.ok(
      proof.routeChecks.some(
        (check: { route: string; status: string }) =>
          check.route === "smoke-source-provenance.json" &&
          check.status === "BLOCKED",
      ),
    );
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("blocks standalone live preview proof when source provenance is stale", async () => {
  const fixture = createPreviewFixture();
  try {
    writeCurrentProvenance(fixture.projectRoot, fixture.exportRoot);
    writeFileSync(
      join(fixture.projectRoot, "app", "index.tsx"),
      "export default function Home() { return 'changed'; }\n",
    );

    const proof = await collectLivePreviewHandoffProof({
      projectRoot: fixture.projectRoot,
      exportRoot: fixture.exportRoot,
      commit: "stale-proof",
    });

    assert.equal(proof.result, "BLOCKED");
    assert.equal(proof.sourceProvenance.status, "BLOCKED");
    assert.match(proof.sourceProvenance.detail, /stale.*smoke:web/i);
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("passes standalone live preview proof only when source provenance matches", async () => {
  const fixture = createPreviewFixture();
  try {
    writeCurrentProvenance(fixture.projectRoot, fixture.exportRoot);

    const proof = await collectLivePreviewHandoffProof({
      projectRoot: fixture.projectRoot,
      exportRoot: fixture.exportRoot,
      commit: "current-proof",
    });

    assert.equal(proof.result, "PASS");
    assert.equal(proof.sourceProvenance.status, "PASS");
    assert.equal(proof.sourceProvenance.algorithm, "sha256");
    assert.equal(
      proof.sourceProvenance.sourceFingerprint,
      createSmokeSourceFingerprint(fixture.projectRoot),
    );
    assert.equal(
      proof.routeChecks.filter(
        (check: { status: string }) => check.status === "PASS",
      ).length,
      LIVE_PREVIEW_HANDOFF_ROUTES.length,
    );
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const {
  LIVE_PREVIEW_HANDOFF_ROUTES,
  buildLivePreviewHandoffProof,
  formatLivePreviewHandoffProofText,
} = require("../scripts/live-preview-handoff-proof.js");

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
  });
  const text = formatLivePreviewHandoffProofText(proof);

  assert.equal(proof.title, "WoofWatcher Live Preview Handoff Proof");
  assert.equal(proof.result, "PASS");
  assert.equal(proof.baseUrl, "http://127.0.0.1:4194/");
  assert.equal(proof.commit, "89857dc");
  assert.ok(proof.routeChecks.every((check: { status: string }) => check.status === "PASS"));
  assert.deepEqual(
    proof.routes,
    [
      "/",
      "/sign-in",
      "/setup",
      "/log",
      "/calendar",
      "/health",
      "/records",
      "/more",
      "/care-twin-qa?qaSurface=records-local-file-handoff",
      "/care-twin-qa?qaSurface=report-binary-export-proof",
      "/care-twin-qa?qaSurface=care-entry-provider-sync-proof",
      "/care-twin-qa?qaSurface=route-visual-consistency",
    ],
  );
  assert.ok(
    proof.truthBoundaries.some((boundary: string) =>
      boundary.includes("web preview only") && boundary.includes("does not replace native iOS/Android proof"),
    ),
  );
  assert.match(text, /WoofWatcher Live Preview Handoff Proof/);
  assert.match(text, /Result: PASS/);
  assert.match(text, /http:\/\/127\.0\.0\.1:4194\//);
  assert.match(text, /\/sign-in/);
  assert.match(text, /\/setup/);
  assert.match(text, /route-visual-consistency/);
  assert.match(text, /care-entry-provider-sync-proof/);
  assert.match(text, /web preview only/);
  assert.match(text, /does not replace native iOS\/Android proof/);
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

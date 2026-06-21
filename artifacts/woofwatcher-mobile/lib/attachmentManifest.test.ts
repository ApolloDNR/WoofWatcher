import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveAttachmentManifest,
  formatAttachmentManifestSummary,
  type AttachmentManifestInput,
} from "./attachmentManifest.ts";

const mixedLocalState: AttachmentManifestInput = {
  entries: [
    {
      id: "med_1",
      title: "Heartgard",
      type: "medication",
      occurredAt: "2026-06-20T18:30:00.000Z",
      caregiver: "Apollo",
      details: {
        photoProofAttachmentUri: "file:///proof/heartgard.jpg",
        photoProofAttachmentName: "heartgard-proof.jpg",
        photoProofStorageStatus: "local-only",
      },
    },
  ],
  records: [
    {
      id: "rabies",
      type: "vaccine",
      title: "Rabies Certificate",
      attachmentUri: "file:///records/rabies.pdf",
      attachmentName: "rabies.pdf",
    },
  ],
  adventureMemories: [
    {
      id: "memory_1",
      title: "Wildflower Trail",
      petName: "Phoenix",
      questId: "wildflower",
      note: "Great walk.",
      createdAt: "2026-06-20T19:00:00.000Z",
      humans: ["Emma"],
      xp: 18,
      storageStatus: "local-draft",
      mediaStatus: "local-photo",
      photoUri: "file:///memories/wildflower.jpg",
    },
  ],
  reportArtifacts: [
    {
      id: "care_pass_vet_2026",
      kind: "care_pass",
      audience: "vet",
      title: "Vet Care Pass",
      createdAt: "2026-06-20T20:00:00.000Z",
      summary: "Health handoff",
      sectionTitles: ["Health", "Diet"],
      message: "Vet handoff",
      printFileName: "vet-care-pass.html",
      printHtml: "<!doctype html><html><body>Vet</body></html>",
    },
  ],
  qaScreenshotEvidence: [
    {
      uri: "file:///qa/ios-home.png",
      fileName: "ios-home.png",
      source: "library",
      targetPlatform: "ios",
      capturedAtIso: "2026-06-20T21:00:00.000Z",
    },
  ],
};

test("builds one local attachment queue across proof, records, memories, reports, and QA evidence", () => {
  const manifest = deriveAttachmentManifest(mixedLocalState, { storageProviderConfigured: false });

  assert.equal(manifest.total, 5);
  assert.equal(manifest.localOnly, 5);
  assert.equal(manifest.providerSaved, 0);
  assert.equal(manifest.uploadReady, 0);
  assert.equal(manifest.status, "provider-required");
  assert.deepEqual(manifest.countsByKind, {
    "adventure-memory": 1,
    "care-log-proof": 1,
    "qa-screenshot": 1,
    "record-document": 1,
    "report-artifact": 1,
  });
  assert.deepEqual(
    manifest.items.map((item) => item.label),
    ["Heartgard", "Rabies Certificate", "Wildflower Trail", "Vet Care Pass", "ios-home.png"],
  );
  assert.match(manifest.launchQueue.detail, /care-log proof, record document, adventure memory, report artifact, qa screenshot/i);
  assert.equal(formatAttachmentManifestSummary(manifest), "5 local files waiting for approved storage rules.");
});

test("marks local attachments upload-ready once storage provider rules exist", () => {
  const manifest = deriveAttachmentManifest(mixedLocalState, { storageProviderConfigured: true });

  assert.equal(manifest.total, 5);
  assert.equal(manifest.localOnly, 0);
  assert.equal(manifest.uploadReady, 5);
  assert.equal(manifest.status, "upload-ready");
  assert.equal(manifest.launchQueue.total, 5);
  assert.equal(manifest.launchQueue.uploadReady, 5);
  assert.match(formatAttachmentManifestSummary(manifest), /ready for provider upload/i);
});

test("does not invent storage work when there are no local attachments", () => {
  const manifest = deriveAttachmentManifest({}, { storageProviderConfigured: false });

  assert.equal(manifest.total, 0);
  assert.equal(manifest.status, "empty");
  assert.equal(manifest.launchQueue.total, 0);
  assert.equal(formatAttachmentManifestSummary(manifest), "No local files are waiting for storage.");
});

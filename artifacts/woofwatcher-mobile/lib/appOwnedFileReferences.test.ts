import assert from "node:assert/strict";
import { test } from "node:test";

import {
  relocateCareAppOwnedFileReferences,
  verifyAvatarFileReferences,
  type FileAvailability,
} from "./appOwnedFileReferences.ts";

test("relocates only the three current-schema Care URI fields without mutating input", () => {
  const unchangedRecord = { id: "r0", title: "No file" };
  const changedRecord = {
    id: "r1",
    attachmentUri: "old://record.pdf",
    title: "Rabies",
  };
  const memory = { id: "m1", photoUri: "old://memory.jpg", caption: "Park" };
  const doc = {
    dog: { name: "Phoenix" },
    records: [unchangedRecord, changedRecord],
    adventureMemories: [memory],
    unrelatedUri: "old://must-not-change",
  };
  const unchangedEntry = { id: "e0", details: { note: "No proof" } };
  const changedEntry = {
    id: "e1",
    details: {
      note: "Medication",
      photoProofAttachmentUri: "old://proof.png",
      otherUri: "old://must-not-change",
    },
  };
  const entries = [unchangedEntry, changedEntry];
  const before = JSON.stringify({ doc, entries });

  const result = relocateCareAppOwnedFileReferences({
    doc,
    entries,
    resolveUri: (uri) => uri.replace("old://", "new://"),
  });

  assert.equal(result.changed, true);
  assert.notEqual(result.doc, doc);
  assert.notEqual(result.entries, entries);
  assert.equal(result.doc.dog, doc.dog);
  assert.notEqual(result.doc.records, doc.records);
  assert.equal(result.doc.records[0], unchangedRecord);
  assert.notEqual(result.doc.records[1], changedRecord);
  assert.equal(result.doc.records[1]?.attachmentUri, "new://record.pdf");
  assert.notEqual(result.doc.adventureMemories, doc.adventureMemories);
  assert.notEqual(result.doc.adventureMemories[0], memory);
  assert.equal(result.doc.adventureMemories[0]?.photoUri, "new://memory.jpg");
  assert.equal(result.doc.unrelatedUri, "old://must-not-change");
  assert.equal(result.entries[0], unchangedEntry);
  assert.notEqual(result.entries[1], changedEntry);
  assert.notEqual(result.entries[1]?.details, changedEntry.details);
  assert.equal(
    result.entries[1]?.details.photoProofAttachmentUri,
    "new://proof.png",
  );
  assert.equal(result.entries[1]?.details.otherUri, "old://must-not-change");
  assert.equal(JSON.stringify({ doc, entries }), before);
});

test("returns exact original identities when no supported URI changes", () => {
  const doc = {
    records: [{ id: "r", attachmentUri: "current://record.pdf" }],
    adventureMemories: [{ id: "m", photoUri: "current://memory.jpg" }],
  };
  const entries = [
    {
      id: "e",
      details: { photoProofAttachmentUri: "current://proof.jpg" },
    },
  ];

  const result = relocateCareAppOwnedFileReferences({
    doc,
    entries,
    resolveUri: (uri) => uri,
  });

  assert.deepEqual(result, { doc, entries, changed: false });
  assert.equal(result.doc, doc);
  assert.equal(result.entries, entries);
});

test("ignores optional, malformed, and unrelated Care fields", () => {
  const doc = {
    records: [
      { attachmentUri: null },
      { attachmentUri: 42 },
      null,
      "not-an-object",
    ],
    adventureMemories: undefined,
  };
  const entries = [
    { details: null },
    { details: { photoProofAttachmentUri: false } },
    null,
  ];
  let resolutions = 0;

  const result = relocateCareAppOwnedFileReferences({
    doc,
    entries,
    resolveUri: (uri) => {
      resolutions += 1;
      return `changed:${uri}`;
    },
  });

  assert.equal(result.changed, false);
  assert.equal(result.doc, doc);
  assert.equal(result.entries, entries);
  assert.equal(resolutions, 0);
});

test("avatar verification resolves before inspect and preserves exists or unknown values", async () => {
  const inspected: string[] = [];
  const availability = new Map<string, FileAvailability>([
    ["current://happy.png", "exists"],
    ["current://calm.png", "unknown"],
  ]);
  const set = {
    happy: "old://happy.png",
    calm: "old://calm.png",
  };

  const result = await verifyAvatarFileReferences({
    set,
    resolveUri: (uri) => uri.replace("old://", "current://"),
    async inspect(uri) {
      inspected.push(uri);
      return availability.get(uri) ?? "missing";
    },
  });

  assert.deepEqual(inspected, ["current://happy.png", "current://calm.png"]);
  assert.deepEqual(result, {
    set: {
      happy: "current://happy.png",
      calm: "current://calm.png",
    },
    changed: true,
  });
  assert.notEqual(result.set, set);
  assert.deepEqual(set, {
    happy: "old://happy.png",
    calm: "old://calm.png",
  });
});

test("avatar verification prunes only missing moods and retains inspection failures as unknown", async () => {
  const set = {
    happy: "file://happy.png",
    calm: "file://calm.png",
    anxious: "file://anxious.png",
  };

  const result = await verifyAvatarFileReferences({
    set,
    resolveUri: (uri) => uri,
    async inspect(uri) {
      if (uri.includes("happy")) return "exists";
      if (uri.includes("calm")) return "missing";
      return "unknown";
    },
  });

  assert.deepEqual(result, {
    set: {
      happy: "file://happy.png",
      anxious: "file://anxious.png",
    },
    changed: true,
  });
  assert.deepEqual(set, {
    happy: "file://happy.png",
    calm: "file://calm.png",
    anxious: "file://anxious.png",
  });
});

test("avatar verification returns exact identity when every resolved value is retained unchanged", async () => {
  const set = { happy: "file://happy.png", calm: "file://calm.png" };
  const result = await verifyAvatarFileReferences({
    set,
    resolveUri: (uri) => uri,
    inspect: async () => "exists",
  });

  assert.equal(result.changed, false);
  assert.equal(result.set, set);
});

import assert from "node:assert/strict";
import test from "node:test";

import { mergeCareDocThreeWay } from "./careDocConflictMerge.ts";

test("merges independent local and remote changes recursively", () => {
  const result = mergeCareDocThreeWay({
    base: {
      updatedAt: "2026-01-01T00:00:00.000Z",
      profile: { name: "Phoenix", breed: "Shepherd" },
      preferences: { reminders: false },
    },
    local: {
      updatedAt: "2026-01-02T00:00:00.000Z",
      profile: { name: "River", breed: "Shepherd" },
      preferences: { reminders: false },
    },
    remote: {
      updatedAt: "2026-01-03T00:00:00.000Z",
      profile: { name: "Phoenix", breed: "Collie" },
      preferences: { reminders: true },
    },
    updatedAt: "2026-01-04T00:00:00.000Z",
  });

  assert.deepEqual(result, {
    status: "merged",
    doc: {
      preferences: { reminders: true },
      profile: { breed: "Collie", name: "River" },
      updatedAt: "2026-01-04T00:00:00.000Z",
    },
    conflictPaths: [],
  });
});

test("coalesces structurally equal concurrent changes", () => {
  const result = mergeCareDocThreeWay({
    base: {
      updatedAt: "base",
      profile: { name: "Phoenix" },
      routines: [{ id: "breakfast", time: "08:00" }],
    },
    local: {
      updatedAt: "local",
      profile: { name: "River" },
      routines: [{ id: "breakfast", time: "07:30" }],
    },
    remote: {
      updatedAt: "remote",
      profile: { name: "River" },
      routines: [{ id: "breakfast", time: "07:30" }],
    },
    updatedAt: "merged",
  });

  assert.equal(result.status, "merged");
  if (result.status !== "merged") assert.fail("expected a clean merge");
  assert.deepEqual(result.doc, {
    profile: { name: "River" },
    routines: [{ id: "breakfast", time: "07:30" }],
    updatedAt: "merged",
  });
  assert.deepEqual(result.conflictPaths, []);
});

test("treats arrays and scalars as atomic and reports every conflict", () => {
  const result = mergeCareDocThreeWay({
    base: {
      updatedAt: "base",
      profile: { name: "Phoenix" },
      routines: ["breakfast"],
    },
    local: {
      updatedAt: "local",
      profile: { name: "River" },
      routines: ["breakfast", "walk"],
    },
    remote: {
      updatedAt: "remote",
      profile: { name: "Scout" },
      routines: ["breakfast", "medication"],
    },
    updatedAt: "merged",
  });

  assert.deepEqual(result, {
    status: "conflict",
    conflictPaths: ["/profile/name", "/routines"],
  });
});

test("preserves additions and deletions made on only one side", () => {
  const result = mergeCareDocThreeWay({
    base: {
      updatedAt: "base",
      profile: { name: "Phoenix", nickname: "P" },
      obsolete: true,
    },
    local: {
      updatedAt: "local",
      profile: { name: "Phoenix" },
    },
    remote: {
      updatedAt: "remote",
      profile: {
        name: "Phoenix",
        nickname: "P",
        microchip: "chip-123",
      },
      obsolete: true,
    },
    updatedAt: "merged",
  });

  assert.equal(result.status, "merged");
  if (result.status !== "merged") assert.fail("expected a clean merge");
  assert.deepEqual(result.doc, {
    profile: { name: "Phoenix", microchip: "chip-123" },
    updatedAt: "merged",
  });
  assert.equal(Object.hasOwn(result.doc, "obsolete"), false);
  assert.equal(Object.hasOwn(result.doc.profile, "nickname"), false);
});

test("reports delete-versus-edit conflicts without returning an uploadable doc", () => {
  const result = mergeCareDocThreeWay({
    base: {
      updatedAt: "base",
      profile: { name: "Phoenix", nickname: "P" },
    },
    local: {
      updatedAt: "local",
      profile: { name: "Phoenix" },
    },
    remote: {
      updatedAt: "remote",
      profile: { name: "Phoenix", nickname: "Nix" },
    },
    updatedAt: "merged",
  });

  assert.deepEqual(result, {
    status: "conflict",
    conflictPaths: ["/profile/nickname"],
  });
  assert.equal("doc" in result, false);
});

test("ignores only the root updatedAt and emits escaped JSON Pointer paths", () => {
  const result = mergeCareDocThreeWay({
    base: {
      updatedAt: "base-root",
      "care/plans": { "~note": "base", updatedAt: "base-nested" },
    },
    local: {
      updatedAt: "local-root",
      "care/plans": { "~note": "local", updatedAt: "local-nested" },
    },
    remote: {
      updatedAt: "remote-root",
      "care/plans": { "~note": "remote", updatedAt: "remote-nested" },
    },
    updatedAt: "recomputed-root",
  });

  assert.deepEqual(result, {
    status: "conflict",
    conflictPaths: ["/care~1plans/updatedAt", "/care~1plans/~0note"],
  });
});

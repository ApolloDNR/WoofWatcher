import assert from "node:assert/strict";
import test from "node:test";

import {
  partitionCareEntriesForSignedInUser,
  stampSignedInPrivateCareEntryCreator,
} from "./careEntryOwnerPrivacy.ts";

type TestEntry = {
  id: string;
  caregiverUserId?: string;
  syncStatus?: "local" | "pending" | "synced" | "failed";
  details?: Record<string, unknown>;
};

test("signed-in cache hydration keeps shared and exact-owner private rows only", () => {
  const entries: TestEntry[] = [
    { id: "legacy-shared", details: {} },
    {
      id: "explicit-shared",
      caregiverUserId: "user-b",
      details: { householdVisible: true },
    },
    {
      id: "a-private",
      caregiverUserId: "user-a",
      details: { householdVisible: false },
    },
    {
      id: "b-private-synced",
      caregiverUserId: "user-b",
      syncStatus: "synced",
      details: { householdVisible: false },
    },
    {
      id: "b-private-pending",
      caregiverUserId: "user-b",
      syncStatus: "pending",
      details: { householdVisible: false },
    },
    {
      id: "unknown-private",
      syncStatus: "failed",
      details: { householdVisible: false },
    },
    {
      id: "malformed-a-private",
      caregiverUserId: "user-a",
      syncStatus: "failed",
      details: { householdVisible: "true" },
    },
    {
      id: "malformed-b-private",
      caregiverUserId: "user-b",
      syncStatus: "local",
      details: { householdVisible: null },
    },
  ];

  const result = partitionCareEntriesForSignedInUser(entries, "user-a");
  assert.deepEqual(
    result.retained.map((entry) => entry.id),
    ["legacy-shared", "explicit-shared", "a-private", "malformed-a-private"],
  );
  assert.deepEqual(
    result.quarantined.map((entry) => entry.id),
    [
      "b-private-synced",
      "b-private-pending",
      "unknown-private",
      "malformed-b-private",
    ],
  );
});

test("identity A to B cannot carry A-private cache rows, regardless of retry state", () => {
  const rows: TestEntry[] = ["synced", "pending", "failed", "local"].map(
    (syncStatus, index) => ({
      id: `a-private-${index}`,
      caregiverUserId: "user-a",
      syncStatus: syncStatus as TestEntry["syncStatus"],
      details: { householdVisible: false },
    }),
  );

  const result = partitionCareEntriesForSignedInUser(rows, "user-b");
  assert.deepEqual(result.retained, []);
  assert.deepEqual(result.quarantined, rows);
});

test("signed-in local private rows are stamped to the exact current user", () => {
  const stamped = stampSignedInPrivateCareEntryCreator(
    {
      id: "temp-private",
      caregiverUserId: "spoofed-user",
      details: { householdVisible: false },
    },
    "user-a",
  );
  assert.equal(stamped.caregiverUserId, "user-a");

  const malformedPrivate = stampSignedInPrivateCareEntryCreator(
    {
      id: "temp-malformed",
      details: { householdVisible: "false" },
    },
    "user-a",
  );
  assert.equal(malformedPrivate.caregiverUserId, "user-a");

  const shared = { id: "temp-shared", details: {} };
  assert.strictEqual(
    stampSignedInPrivateCareEntryCreator(shared, "user-a"),
    shared,
  );
});

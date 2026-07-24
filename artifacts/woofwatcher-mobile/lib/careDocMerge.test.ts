import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeCareDocThreeWay } from "./careDocMerge.ts";

function doc(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    activePetId: "pet-1",
    profile: { name: "Phoenix" },
    pets: [],
    caregivers: [],
    householdSetup: {},
    launchSupportProfile: {},
    launchProviderProfile: {},
    reminderNotificationPreferences: {},
    dietProfile: { primaryFood: "Base food", normalPortion: "1 cup" },
    routines: [{ id: "routine-1", label: "Breakfast", time: "07:00" }],
    goals: [],
    records: [],
    accessPasses: [],
    adventureMemories: [],
    reportArtifacts: [],
    calendarEvents: [],
    ...overrides,
  };
}

test("preserves a server diet edit and a disjoint local routine edit", () => {
  const base = doc();
  const server = doc({
    updatedAt: "2026-07-02T08:00:00.000Z",
    dietProfile: { primaryFood: "Server food", normalPortion: "1 cup" },
  });
  const local = doc({
    updatedAt: "2026-07-02T09:00:00.000Z",
    routines: [{ id: "routine-1", label: "Early breakfast", time: "07:00" }],
  });

  const result = mergeCareDocThreeWay({ base, server, local });

  assert.equal(result.doc.dietProfile.primaryFood, "Server food");
  assert.equal(result.doc.routines[0].label, "Early breakfast");
  assert.deepEqual(result.conflicts, []);
});

test("stable-id arrays keep additions, distinct ids, and disjoint same-record fields", () => {
  const stableArrays = [
    "routines",
    "records",
    "calendarEvents",
    "reportArtifacts",
    "accessPasses",
    "adventureMemories",
    "pets",
    "goals",
  ] as const;

  for (const field of stableArrays) {
    const base = doc({
      [field]: [
        {
          id: "shared",
          serverField: "base",
          localField: "base",
        },
      ],
    });
    const server = doc({
      [field]: [
        {
          id: "shared",
          serverField: "server",
          localField: "base",
        },
        { id: "server-only", value: "server addition" },
      ],
    });
    const local = doc({
      [field]: [
        {
          id: "shared",
          serverField: "base",
          localField: "local",
        },
        { id: "local-only", value: "local addition" },
      ],
    });

    const result = mergeCareDocThreeWay({ base, server, local });
    const rows = result.doc[field] as Array<Record<string, unknown>>;

    assert.deepEqual(
      rows.map((row) => row.id),
      ["shared", "local-only", "server-only"],
      `${field} should keep local order followed by server-only ids`,
    );
    assert.deepEqual(
      rows[0],
      {
        id: "shared",
        serverField: "server",
        localField: "local",
      },
      `${field} should merge disjoint fields on one stable id`,
    );
    assert.deepEqual(result.conflicts, [], `${field} should merge without conflicts`);
  }
});

test("goals explicitly merge by stable id", () => {
  const base = doc({
    goals: [{ id: "goal-1", title: "Recall", status: "planned" }],
  });
  const server = doc({
    goals: [
      { id: "goal-1", title: "Recall", status: "active" },
      { id: "goal-server", title: "Settle", status: "planned" },
    ],
  });
  const local = doc({
    goals: [
      { id: "goal-1", title: "Reliable recall", status: "planned" },
      { id: "goal-local", title: "Loose lead", status: "planned" },
    ],
  });

  const result = mergeCareDocThreeWay({ base, server, local });

  assert.deepEqual(result.doc.goals, [
    { id: "goal-1", title: "Reliable recall", status: "active" },
    { id: "goal-local", title: "Loose lead", status: "planned" },
    { id: "goal-server", title: "Settle", status: "planned" },
  ]);
  assert.deepEqual(result.conflicts, []);
});

test("same-field edits retain local and record a stable conflict path", () => {
  const base = doc({
    records: [{ id: "record-1", title: "Rabies certificate", note: "Base" }],
  });
  const server = doc({
    records: [{ id: "record-1", title: "Rabies certificate", note: "Server note" }],
  });
  const local = doc({
    records: [{ id: "record-1", title: "Rabies certificate", note: "Local note" }],
  });

  const result = mergeCareDocThreeWay({ base, server, local });

  assert.equal(result.doc.records[0].note, "Local note");
  assert.deepEqual(result.conflicts, [
    {
      path: 'records[id="record-1"].note',
      base: { present: true, value: "Base" },
      server: { present: true, value: "Server note" },
      local: { present: true, value: "Local note" },
      resolution: "local",
    },
  ]);
});

test("deletion versus unchanged deletes while deletion versus edit conflicts", () => {
  const base = doc({
    records: [
      { id: "server-deletes", title: "A", note: "base" },
      { id: "local-deletes", title: "B", note: "base" },
      { id: "server-delete-local-edit", title: "C", note: "base" },
      { id: "local-delete-server-edit", title: "D", note: "base" },
    ],
  });
  const server = doc({
    records: [
      { id: "local-deletes", title: "B", note: "base" },
      { id: "local-delete-server-edit", title: "D", note: "server edit" },
    ],
  });
  const local = doc({
    records: [
      { id: "server-deletes", title: "A", note: "base" },
      { id: "server-delete-local-edit", title: "C", note: "local edit" },
    ],
  });

  const result = mergeCareDocThreeWay({ base, server, local });

  assert.deepEqual(
    result.doc.records.map((record: { id: string }) => record.id),
    ["server-delete-local-edit"],
  );
  assert.deepEqual(result.conflicts, [
    {
      path: 'records[id="server-delete-local-edit"]',
      base: {
        present: true,
        value: { id: "server-delete-local-edit", title: "C", note: "base" },
      },
      server: { present: false },
      local: {
        present: true,
        value: { id: "server-delete-local-edit", title: "C", note: "local edit" },
      },
      resolution: "local",
    },
    {
      path: 'records[id="local-delete-server-edit"]',
      base: {
        present: true,
        value: { id: "local-delete-server-edit", title: "D", note: "base" },
      },
      server: {
        present: true,
        value: { id: "local-delete-server-edit", title: "D", note: "server edit" },
      },
      local: { present: false },
      resolution: "local",
    },
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.conflicts)),
    result.conflicts,
    "deletion conflicts must retain all three operands through scoped-cache JSON",
  );
});

test("non-id arrays are atomic and root updatedAt never creates a conflict", () => {
  const base = doc({
    caregivers: [{ name: "Apollo", role: "owner" }],
  });
  const server = doc({
    updatedAt: "2026-07-02T08:00:00.000Z",
    caregivers: [
      { name: "Apollo", role: "owner" },
      { name: "Sam", role: "adult" },
    ],
  });
  const local = doc({
    updatedAt: "2026-07-02T09:00:00.000Z",
    caregivers: [{ name: "Apollo", role: "admin" }],
  });

  const result = mergeCareDocThreeWay({ base, server, local });

  assert.deepEqual(result.doc.caregivers, [{ name: "Apollo", role: "admin" }]);
  assert.equal(result.doc.updatedAt, "2026-07-02T09:00:00.000Z");
  assert.deepEqual(result.conflicts, [
    {
      path: "caregivers",
      base: {
        present: true,
        value: [{ name: "Apollo", role: "owner" }],
      },
      server: {
        present: true,
        value: [
          { name: "Apollo", role: "owner" },
          { name: "Sam", role: "adult" },
        ],
      },
      local: {
        present: true,
        value: [{ name: "Apollo", role: "admin" }],
      },
      resolution: "local",
    },
  ]);
});

test("blank or duplicate stable ids fall back atomically with an explicit diagnostic", () => {
  for (const localRecords of [
    [
      { id: "", note: "blank local id" },
      { id: "safe", note: "local" },
    ],
    [
      { id: "duplicate", note: "first" },
      { id: "duplicate", note: "second" },
    ],
  ]) {
    const base = doc({
      records: [{ id: "safe", note: "base" }],
    });
    const server = doc({
      records: [
        { id: "safe", note: "server" },
        { id: "server-only", note: "must stay represented" },
      ],
    });
    const local = doc({ records: localRecords });

    const result = mergeCareDocThreeWay({ base, server, local });

    assert.deepEqual(result.doc.records, localRecords);
    assert.deepEqual(result.conflicts, [
      {
        path: "records",
        base: {
          present: true,
          value: [{ id: "safe", note: "base" }],
        },
        server: {
          present: true,
          value: [
            { id: "safe", note: "server" },
            { id: "server-only", note: "must stay represented" },
          ],
        },
        local: { present: true, value: localRecords },
        resolution: "local",
        reason: "invalid-stable-ids",
      },
    ]);
  }
});

test("root createdAt preserves the base or earliest present legacy timestamp", () => {
  const withBase = mergeCareDocThreeWay({
    base: doc({ createdAt: "2026-07-02T00:00:00.000Z" }),
    server: doc({ createdAt: "2026-07-03T00:00:00.000Z" }),
    local: doc({ createdAt: "2026-07-01T00:00:00.000Z" }),
  });
  assert.equal(withBase.doc.createdAt, "2026-07-02T00:00:00.000Z");
  assert.equal(
    withBase.conflicts.some((conflict) => conflict.path === "createdAt"),
    false,
  );

  const { createdAt: _baseCreatedAt, ...legacyBase } = doc();
  const withoutBaseTimestamp = mergeCareDocThreeWay({
    base: legacyBase,
    server: doc({ createdAt: "2026-07-03T00:00:00.000Z" }),
    local: doc({ createdAt: "2026-07-01T00:00:00.000Z" }),
  });
  assert.equal(
    withoutBaseTimestamp.doc.createdAt,
    "2026-07-01T00:00:00.000Z",
  );
  assert.equal(
    withoutBaseTimestamp.conflicts.some(
      (conflict) => conflict.path === "createdAt",
    ),
    false,
  );
});

test("stable-id conflict paths escape punctuation in ids without using array indexes", () => {
  const base = doc({
    records: [{ id: 'record.1]"private', note: "base" }],
  });
  const server = doc({
    records: [{ id: 'record.1]"private', note: "server" }],
  });
  const local = doc({
    records: [{ id: 'record.1]"private', note: "local" }],
  });

  const result = mergeCareDocThreeWay({ base, server, local });

  assert.equal(
    result.conflicts[0]?.path,
    'records[id="record.1]\\"private"].note',
  );
});

test("missing and own undefined are deleted while null remains a JSON-safe value", () => {
  const noConflict = mergeCareDocThreeWay({
    base: doc({ profile: { name: "Phoenix" } }),
    server: doc({ profile: { name: "Phoenix", nickname: undefined } }),
    local: doc({ profile: { name: "Phoenix", nickname: null } }),
  });
  assert.deepEqual(noConflict.doc.profile, {
    name: "Phoenix",
    nickname: null,
  });
  assert.deepEqual(noConflict.conflicts, []);

  const conflict = mergeCareDocThreeWay({
    base: doc({ profile: { name: "Phoenix", nickname: null } }),
    server: doc({ profile: { name: "Phoenix", nickname: undefined } }),
    local: doc({ profile: { name: "Phoenix", nickname: "Phee" } }),
  });
  assert.deepEqual(conflict.conflicts, [
    {
      path: "profile.nickname",
      base: { present: true, value: null },
      server: { present: false },
      local: { present: true, value: "Phee" },
      resolution: "local",
    },
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(conflict.conflicts)),
    conflict.conflicts,
  );
});

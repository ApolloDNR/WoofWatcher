import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HouseholdMembershipActivationError,
  activateRetainedHousehold,
  listSwitchableHouseholdMemberships,
  type HouseholdMembershipActivationTransaction,
  type HouseholdMembershipRecord,
  type HouseholdMembershipSwitchStore,
} from "../src/lib/household-membership-activation.ts";

const USER_A = "user_a";
const USER_B = "user_b";
const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const HOUSEHOLD_C = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-08-28T12:00:00.000Z");

function exactMe(householdId: string) {
  return {
    authorityObservedAt: NOW.toISOString(),
    user: { id: USER_A, email: null, displayName: "Apollo" },
    household: {
      id: householdId,
      name:
        householdId === HOUSEHOLD_A
          ? "Phoenix Pack"
          : householdId === HOUSEHOLD_B
            ? "Trail Pack"
            : "Lake Pack",
      inviteCode: "",
    },
    members: [
      {
        id: `member-${householdId}`,
        userId: USER_A,
        role: "owner",
        displayName: "Apollo",
        email: null,
        isSelf: true,
        accessPassExpiresAt: null,
        accessPassExpired: false,
      },
    ],
  };
}

function membership(
  householdId: string,
  overrides: Partial<HouseholdMembershipRecord> = {},
): HouseholdMembershipRecord {
  return {
    id: `member-${householdId}`,
    userId: USER_A,
    householdId,
    householdName:
      householdId === HOUSEHOLD_A
        ? "Phoenix Pack"
        : householdId === HOUSEHOLD_B
          ? "Trail Pack"
          : "Lake Pack",
    role: "owner",
    accessPassExpiresAt: null,
    createdAt:
      householdId === HOUSEHOLD_A
        ? "2026-08-01T08:00:00.000Z"
        : householdId === HOUSEHOLD_B
          ? "2026-08-02T08:00:00.000Z"
          : "2026-08-03T08:00:00.000Z",
    ...overrides,
  };
}

interface StoreState {
  activeHouseholdId: string | null;
  memberships: HouseholdMembershipRecord[];
}

function cloneState(state: StoreState): StoreState {
  return {
    activeHouseholdId: state.activeHouseholdId,
    memberships: state.memberships.map((row) => ({ ...row })),
  };
}

class InMemorySwitchStore implements HouseholdMembershipSwitchStore {
  state: StoreState;
  private queue: Promise<void> = Promise.resolve();
  transactionCalls = 0;
  listCalls = 0;
  targetLockCalls = 0;
  updateCalls = 0;
  ensureCareStateCalls = 0;
  snapshotCalls = 0;
  failEnsureCareState = false;
  failSnapshot = false;
  snapshotGate: Promise<void> | null = null;
  onSnapshot: (() => void) | null = null;
  events: string[] = [];
  nextUpdateFailure: "source-changed" | "target-invalid" | "conflict" | null =
    null;
  householdLockSetCurrent = true;

  constructor(state: StoreState) {
    this.state = cloneState(state);
  }

  async transaction<T>(
    work: (transaction: HouseholdMembershipActivationTransaction) => Promise<T>,
  ): Promise<T> {
    this.transactionCalls += 1;
    const previous = this.queue;
    let release = () => {};
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const draft = cloneState(this.state);
    try {
      const result = await work({
        lockHouseholds: async (householdIds) => {
          this.events.push(`lock-households:${householdIds.join(",")}`);
        },
        lockUserHouseholds: async (userId, householdIds = []) => {
          this.events.push(
            `lock-user-households:${userId}:${householdIds.join(",")}`,
          );
          return householdIds;
        },
        getCurrentTime: async () => {
          this.events.push("clock");
          return new Date(NOW);
        },
        lockUser: async (userId) => {
          this.events.push("lock-user");
          return userId === USER_A
            ? {
                id: USER_A,
                activeHouseholdId: draft.activeHouseholdId,
              }
            : null;
        },
        confirmUserHouseholdsLocked: async () => {
          this.events.push("confirm-user-households");
          return this.householdLockSetCurrent;
        },
        listMemberships: async () => {
          this.events.push("list-memberships");
          this.listCalls += 1;
          return draft.memberships;
        },
        lockTargetMembership: async (userId, householdId) => {
          this.events.push("lock-target");
          this.targetLockCalls += 1;
          return (
            draft.memberships.find(
              (row) => row.userId === userId && row.householdId === householdId,
            ) ?? null
          );
        },
        compareAndSetActiveHousehold: async (input) => {
          this.events.push("cas");
          this.updateCalls += 1;
          if (this.nextUpdateFailure) {
            const reason = this.nextUpdateFailure;
            this.nextUpdateFailure = null;
            return { updated: false as const, reason };
          }
          const target = draft.memberships.find(
            (row) =>
              row.id === input.membershipId &&
              row.userId === input.userId &&
              row.householdId === input.targetHouseholdId,
          );
          if (!target || target.revokedAt) {
            return {
              updated: false as const,
              reason: "target-invalid" as const,
            };
          }
          if (draft.activeHouseholdId !== input.expectedSourceHouseholdId) {
            return {
              updated: false as const,
              reason: "source-changed" as const,
            };
          }
          draft.activeHouseholdId = input.targetHouseholdId;
          return { updated: true as const };
        },
        ensureCareState: async () => {
          this.events.push("ensure-care-state");
          this.ensureCareStateCalls += 1;
          if (this.failEnsureCareState) {
            throw new Error("care-state insert failed");
          }
        },
        buildExactMeSnapshot: async (userId, householdId) => {
          this.events.push("snapshot");
          this.snapshotCalls += 1;
          this.onSnapshot?.();
          if (this.snapshotGate) await this.snapshotGate;
          if (this.failSnapshot) {
            throw new Error("exact snapshot failed");
          }
          assert.equal(userId, USER_A);
          assert.equal(draft.activeHouseholdId, householdId);
          return exactMe(householdId);
        },
      });
      this.state = draft;
      return result;
    } finally {
      release();
    }
  }
}

function storeWith(
  memberships: HouseholdMembershipRecord[],
  activeHouseholdId = HOUSEHOLD_A,
): InMemorySwitchStore {
  return new InMemorySwitchStore({ activeHouseholdId, memberships });
}

async function expectStatus(
  promise: Promise<unknown>,
  status: 400 | 403 | 409 | 412 | 428,
): Promise<HouseholdMembershipActivationError> {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof HouseholdMembershipActivationError);
    assert.equal(error.status, status);
    return true;
  });
  try {
    await promise;
  } catch (error) {
    return error as HouseholdMembershipActivationError;
  }
  throw new Error("Expected household membership operation to reject.");
}

test("membership listing exposes only this user's strict, currently valid authority and no secrets", async () => {
  const store = storeWith([
    membership(HOUSEHOLD_A, {
      role: "adult",
      invitationCode: "MUST-NOT-LEAK",
      invitedEmail: "private@example.com",
      auditSecret: "audit-secret",
    } as Partial<HouseholdMembershipRecord>),
    membership(HOUSEHOLD_B, {
      userId: USER_B,
      role: "owner",
      invitationCode: "FOREIGN",
    } as Partial<HouseholdMembershipRecord>),
    membership(HOUSEHOLD_C, {
      role: "sitter",
      accessPassExpiresAt: "2026-08-29T12:00:00.000Z",
    }),
  ]);

  const result = await listSwitchableHouseholdMemberships({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_A,
    now: NOW,
  });

  assert.deepEqual(result, {
    activeHouseholdId: HOUSEHOLD_A,
    memberships: [
      {
        householdId: HOUSEHOLD_A,
        householdName: "Phoenix Pack",
        role: "adult",
        accessPassExpiresAt: null,
      },
      {
        householdId: HOUSEHOLD_C,
        householdName: "Lake Pack",
        role: "sitter",
        accessPassExpiresAt: "2026-08-29T12:00:00.000Z",
      },
    ],
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /invite|email|user_a|member-|audit/i,
  );
  assert.deepEqual(Object.keys(result.memberships[0]).sort(), [
    "accessPassExpiresAt",
    "householdId",
    "householdName",
    "role",
  ]);
});

test("listing aborts before membership reads when the post-user-lock household set grew", async () => {
  const store = storeWith([membership(HOUSEHOLD_A)]);
  store.householdLockSetCurrent = false;

  await expectStatus(
    listSwitchableHouseholdMemberships({
      store,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      now: NOW,
    }),
    409,
  );

  assert.equal(store.listCalls, 0);
  assert.deepEqual(store.events.slice(0, 3), [
    `lock-user-households:${USER_A}:${HOUSEHOLD_A}`,
    "lock-user",
    "confirm-user-households",
  ]);
});

test("listing excludes revoked, expired-helper, blank-role, unknown-role, and corrupt helper memberships", async () => {
  const store = storeWith([
    membership(HOUSEHOLD_A),
    membership(HOUSEHOLD_B, {
      role: "trainer",
      accessPassExpiresAt: NOW,
    }),
    membership(HOUSEHOLD_C, { role: "" }),
    membership("44444444-4444-4444-8444-444444444444", {
      role: "super-admin",
    }),
    membership("55555555-5555-4555-8555-555555555555", {
      role: "walker",
      accessPassExpiresAt: "not-a-date",
    }),
    membership("66666666-6666-4666-8666-666666666666", {
      role: "adult",
      revokedAt: "2026-08-20T00:00:00.000Z",
    }),
    membership("77777777-7777-4777-8777-777777777777", {
      role: "owner",
      accessPassExpiresAt: "corrupt-provider-date",
    }),
  ]);

  const result = await listSwitchableHouseholdMemberships({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_A,
    now: NOW,
  });

  assert.deepEqual(
    result.memberships.map((row) => row.householdId),
    [HOUSEHOLD_A],
  );
});

test("all exact product roles remain switchable, while helper expiry is enforced", async () => {
  const roles = [
    "owner",
    "adult",
    "teen",
    "kid",
    "sitter",
    "trainer",
    "walker",
    "vet viewer",
  ] as const;
  const rows = roles.map((role, index) =>
    membership(`00000000-0000-4000-8000-0000000000${index + 10}`, {
      role,
      householdName: role,
      accessPassExpiresAt:
        role === "sitter" ||
        role === "trainer" ||
        role === "walker" ||
        role === "vet viewer"
          ? "2026-08-29T00:00:00.000Z"
          : null,
    }),
  );
  const store = storeWith(rows, rows[0].householdId);

  const result = await listSwitchableHouseholdMemberships({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: rows[0].householdId,
    now: NOW,
  });

  assert.deepEqual(
    new Set(result.memberships.map((row) => row.role)),
    new Set(roles),
  );
});

test("every supported legacy role activates through the shipping authority path as its canonical role", async () => {
  const aliases = [
    ["admin", "owner"],
    ["adult admin", "owner"],
    ["owner", "owner"],
    ["adult", "adult"],
    ["member", "adult"],
    ["primary caregiver", "adult"],
    ["teen", "teen"],
    ["kid", "kid"],
    ["child", "kid"],
    ["minor", "kid"],
    ["sitter", "sitter"],
    ["helper", "sitter"],
    ["temporary helper", "sitter"],
    ["trainer", "trainer"],
    ["walker", "walker"],
    ["viewer", "vet viewer"],
    ["vet", "vet viewer"],
    ["vet viewer", "vet viewer"],
    ["veterinary viewer", "vet viewer"],
    ["read-only", "vet viewer"],
    ["readonly", "vet viewer"],
  ] as const;

  for (const [role, canonicalRole] of aliases) {
    const isHelper = ["sitter", "trainer", "walker", "vet viewer"].includes(
      canonicalRole,
    );
    const store = storeWith([
      membership(HOUSEHOLD_A),
      membership(HOUSEHOLD_B, {
        role,
        accessPassExpiresAt: isHelper
          ? "2026-08-29T12:00:00.000Z"
          : null,
      }),
    ]);

    const result = await activateRetainedHousehold({
      store,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
      now: NOW,
    });

    assert.equal(result.householdId, HOUSEHOLD_B, role);
    assert.equal(store.state.activeHouseholdId, HOUSEHOLD_B, role);
    assert.equal(store.updateCalls, 1, role);
  }
});

test("expired legacy helper aliases and unknown roles fail closed before activation writes", async () => {
  for (const role of [
    "sitter",
    "helper",
    "temporary helper",
    "trainer",
    "walker",
    "viewer",
    "vet",
    "vet viewer",
    "veterinary viewer",
    "read-only",
    "readonly",
    "former owner",
  ]) {
    const store = storeWith([
      membership(HOUSEHOLD_A),
      membership(HOUSEHOLD_B, {
        role,
        accessPassExpiresAt: role === "former owner" ? null : NOW,
      }),
    ]);

    await expectStatus(
      activateRetainedHousehold({
        store,
        userId: USER_A,
        expectedSourceHouseholdId: HOUSEHOLD_A,
        targetHouseholdId: HOUSEHOLD_B,
        now: NOW,
      }),
      403,
    );
    assert.equal(store.updateCalls, 0, role);
  }
});

test("listing sorts the exact active membership first, then deterministically by creation and id", async () => {
  const store = storeWith(
    [
      membership(HOUSEHOLD_C, {
        id: "member-c",
        createdAt: "2026-08-02T00:00:00.000Z",
      }),
      membership(HOUSEHOLD_A, {
        id: "member-z",
        createdAt: "2026-08-01T00:00:00.000Z",
      }),
      membership(HOUSEHOLD_B, {
        id: "member-b",
        createdAt: "2026-08-02T00:00:00.000Z",
      }),
    ],
    HOUSEHOLD_C,
  );

  const result = await listSwitchableHouseholdMemberships({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_C,
    now: NOW,
  });

  assert.deepEqual(
    result.memberships.map((row) => row.householdId),
    [HOUSEHOLD_C, HOUSEHOLD_A, HOUSEHOLD_B],
  );
});

test("the DB clock is captured only after membership locks and before authority validation", async () => {
  const store = storeWith([membership(HOUSEHOLD_A), membership(HOUSEHOLD_B)]);

  await listSwitchableHouseholdMemberships({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_A,
  });
  assert.deepEqual(store.events.slice(0, 4), [
    `lock-user-households:${USER_A}:${HOUSEHOLD_A}`,
    "lock-user",
    "confirm-user-households",
    "list-memberships",
  ]);

  store.events = [];
  await activateRetainedHousehold({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_A,
    targetHouseholdId: HOUSEHOLD_B,
  });
  assert.deepEqual(store.events.slice(0, 4), [
    `lock-households:${HOUSEHOLD_A},${HOUSEHOLD_B}`,
    "lock-user",
    "lock-target",
    "clock",
  ]);
});

test("an expired current helper can still list and escape to a valid retained household", async () => {
  const expiredCurrent = membership(HOUSEHOLD_B, {
    role: "sitter",
    accessPassExpiresAt: "2026-08-28T11:59:59.999Z",
  });
  const store = storeWith(
    [membership(HOUSEHOLD_A), expiredCurrent],
    HOUSEHOLD_B,
  );

  const listed = await listSwitchableHouseholdMemberships({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_B,
    now: NOW,
  });
  assert.equal(listed.activeHouseholdId, HOUSEHOLD_B);
  assert.deepEqual(
    listed.memberships.map((row) => row.householdId),
    [HOUSEHOLD_A],
  );

  const activated = await activateRetainedHousehold({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_B,
    targetHouseholdId: HOUSEHOLD_A,
    now: NOW,
  });
  assert.deepEqual(activated, {
    householdId: HOUSEHOLD_A,
    me: exactMe(HOUSEHOLD_A),
  });
  assert.equal(store.state.activeHouseholdId, HOUSEHOLD_A);
});

test("missing or blank expected source fails before opening a transaction", async () => {
  for (const expectedSourceHouseholdId of [null, "", "  "] as const) {
    const store = storeWith([membership(HOUSEHOLD_A)]);
    await expectStatus(
      listSwitchableHouseholdMemberships({
        store,
        userId: USER_A,
        expectedSourceHouseholdId,
        now: NOW,
      }),
      428,
    );
    assert.equal(store.transactionCalls, 0);
  }
});

test("a byte-different source returns 412 without membership lookup or writes", async () => {
  const store = storeWith([membership(HOUSEHOLD_A), membership(HOUSEHOLD_B)]);

  await expectStatus(
    activateRetainedHousehold({
      store,
      userId: USER_A,
      expectedSourceHouseholdId: `${HOUSEHOLD_A} `,
      targetHouseholdId: HOUSEHOLD_B,
      now: NOW,
    }),
    412,
  );
  assert.equal(store.targetLockCalls, 0);
  assert.equal(store.updateCalls, 0);
});

test("malformed target returns 400 before a transaction", async () => {
  const store = storeWith([membership(HOUSEHOLD_A)]);
  await expectStatus(
    activateRetainedHousehold({
      store,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: " ",
      now: NOW,
    }),
    400,
  );
  assert.equal(store.transactionCalls, 0);
});

test("missing, revoked, expired, and unknown-role targets fail closed with one non-enumerating 403", async () => {
  const targetCases: Array<HouseholdMembershipRecord | null> = [
    null,
    membership(HOUSEHOLD_B, { revokedAt: NOW }),
    membership(HOUSEHOLD_B, {
      role: "vet viewer",
      accessPassExpiresAt: NOW,
    }),
    membership(HOUSEHOLD_B, { role: "administrator" }),
    membership(HOUSEHOLD_B, {
      role: "owner",
      accessPassExpiresAt: "corrupt-provider-date",
    }),
  ];
  const messages = new Set<string>();

  for (const target of targetCases) {
    const store = storeWith([
      membership(HOUSEHOLD_A),
      ...(target ? [target] : []),
    ]);
    const error = await expectStatus(
      activateRetainedHousehold({
        store,
        userId: USER_A,
        expectedSourceHouseholdId: HOUSEHOLD_A,
        targetHouseholdId: HOUSEHOLD_B,
        now: NOW,
      }),
      403,
    );
    messages.add(error.message);
    assert.equal(store.updateCalls, 0);
  }

  assert.equal(messages.size, 1);
});

test("a forged target lock result is a 409 authority conflict", async () => {
  const store = storeWith([
    membership(HOUSEHOLD_A),
    membership(HOUSEHOLD_B, { userId: USER_B }),
  ]);
  store.state.memberships.push(membership(HOUSEHOLD_B));
  const original = store.transaction.bind(store);
  store.transaction = (work) =>
    original(async (transaction) =>
      work({
        ...transaction,
        lockTargetMembership: async () =>
          membership(HOUSEHOLD_B, { userId: USER_B }),
      }),
    );

  await expectStatus(
    activateRetainedHousehold({
      store,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
      now: NOW,
    }),
    409,
  );
  assert.equal(store.updateCalls, 0);
});

test("same-target activation is idempotent only while the exact membership remains valid", async () => {
  const valid = storeWith([membership(HOUSEHOLD_A)]);
  assert.deepEqual(
    await activateRetainedHousehold({
      store: valid,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_A,
      now: NOW,
    }),
    { householdId: HOUSEHOLD_A, me: exactMe(HOUSEHOLD_A) },
  );
  assert.equal(valid.updateCalls, 1);

  const expired = storeWith([
    membership(HOUSEHOLD_A, {
      role: "walker",
      accessPassExpiresAt: NOW,
    }),
  ]);
  await expectStatus(
    activateRetainedHousehold({
      store: expired,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_A,
      now: NOW,
    }),
    403,
  );
});

test("concurrent A-to-B and A-to-C switches have exactly one source-CAS winner", async () => {
  const store = storeWith([
    membership(HOUSEHOLD_A),
    membership(HOUSEHOLD_B),
    membership(HOUSEHOLD_C),
  ]);

  const settlements = await Promise.allSettled([
    activateRetainedHousehold({
      store,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
      now: NOW,
    }),
    activateRetainedHousehold({
      store,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_C,
      now: NOW,
    }),
  ]);

  assert.equal(
    settlements.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejection = settlements.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  assert.ok(rejection);
  assert.ok(rejection.reason instanceof HouseholdMembershipActivationError);
  assert.equal(rejection.reason.status, 412);
  assert.equal(store.updateCalls, 1);
});

test("an old-source retry cannot reactivate a target after later household movement", async () => {
  const store = storeWith([
    membership(HOUSEHOLD_A),
    membership(HOUSEHOLD_B),
    membership(HOUSEHOLD_C),
  ]);

  await activateRetainedHousehold({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_A,
    targetHouseholdId: HOUSEHOLD_B,
    now: NOW,
  });
  await activateRetainedHousehold({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_B,
    targetHouseholdId: HOUSEHOLD_C,
    now: NOW,
  });

  await expectStatus(
    activateRetainedHousehold({
      store,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
      now: NOW,
    }),
    412,
  );
  assert.equal(store.state.activeHouseholdId, HOUSEHOLD_C);
});

test("a lost-response replay with old source A returns 412 while B remains current and makes no write", async () => {
  const store = storeWith([membership(HOUSEHOLD_A), membership(HOUSEHOLD_B)]);
  await activateRetainedHousehold({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_A,
    targetHouseholdId: HOUSEHOLD_B,
    now: NOW,
  });
  const writesAfterCommit = store.updateCalls;

  await expectStatus(
    activateRetainedHousehold({
      store,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
      now: NOW,
    }),
    412,
  );
  assert.equal(store.state.activeHouseholdId, HOUSEHOLD_B);
  assert.equal(store.updateCalls, writesAfterCommit);
});

test("a care-state insert failure rolls the pointer update back with the surrounding transaction", async () => {
  const store = storeWith([membership(HOUSEHOLD_A), membership(HOUSEHOLD_B)]);
  store.failEnsureCareState = true;

  await assert.rejects(
    activateRetainedHousehold({
      store,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
      now: NOW,
    }),
    /care-state insert failed/,
  );
  assert.equal(store.updateCalls, 1);
  assert.equal(store.state.activeHouseholdId, HOUSEHOLD_A);
});

test("an exact-Me failure after Care-state ensure rolls the pointer update back", async () => {
  const store = storeWith([membership(HOUSEHOLD_A), membership(HOUSEHOLD_B)]);
  store.failSnapshot = true;

  await assert.rejects(
    activateRetainedHousehold({
      store,
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
      now: NOW,
    }),
    /exact snapshot failed/,
  );

  assert.equal(store.updateCalls, 1);
  assert.equal(store.ensureCareStateCalls, 1);
  assert.equal(store.snapshotCalls, 1);
  assert.equal(store.state.activeHouseholdId, HOUSEHOLD_A);
  assert.ok(
    store.events.indexOf("cas") < store.events.indexOf("ensure-care-state") &&
      store.events.indexOf("ensure-care-state") <
        store.events.indexOf("snapshot"),
  );
});

test("the user lock remains held through exact Me so concurrent activation cannot mix commit and response", async () => {
  const store = storeWith([
    membership(HOUSEHOLD_A),
    membership(HOUSEHOLD_B),
    membership(HOUSEHOLD_C),
  ]);
  let announceSnapshot = () => {};
  const snapshotStarted = new Promise<void>((resolve) => {
    announceSnapshot = resolve;
  });
  let releaseSnapshot = () => {};
  store.snapshotGate = new Promise<void>((resolve) => {
    releaseSnapshot = resolve;
  });
  store.onSnapshot = announceSnapshot;

  const first = activateRetainedHousehold({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_A,
    targetHouseholdId: HOUSEHOLD_B,
    now: NOW,
  });
  await snapshotStarted;

  const second = activateRetainedHousehold({
    store,
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_B,
    targetHouseholdId: HOUSEHOLD_C,
    now: NOW,
  });
  await Promise.resolve();
  assert.equal(store.updateCalls, 1);
  assert.equal(store.state.activeHouseholdId, HOUSEHOLD_A);

  releaseSnapshot();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.deepEqual(firstResult, {
    householdId: HOUSEHOLD_B,
    me: exactMe(HOUSEHOLD_B),
  });
  assert.deepEqual(secondResult, {
    householdId: HOUSEHOLD_C,
    me: exactMe(HOUSEHOLD_C),
  });
  assert.equal(store.state.activeHouseholdId, HOUSEHOLD_C);
});

test("atomic commit failures preserve truthful source, target, and conflict statuses", async () => {
  for (const [reason, status] of [
    ["source-changed", 412],
    ["target-invalid", 403],
    ["conflict", 409],
  ] as const) {
    const store = storeWith([membership(HOUSEHOLD_A), membership(HOUSEHOLD_B)]);
    store.nextUpdateFailure = reason;
    await expectStatus(
      activateRetainedHousehold({
        store,
        userId: USER_A,
        expectedSourceHouseholdId: HOUSEHOLD_A,
        targetHouseholdId: HOUSEHOLD_B,
        now: NOW,
      }),
      status,
    );
    assert.equal(store.state.activeHouseholdId, HOUSEHOLD_A);
  }
});

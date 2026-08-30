import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HouseholdAuthoritySnapshotError,
  buildExactHouseholdSnapshot,
  type HouseholdSnapshotStore,
} from "../src/lib/household-me-snapshot.ts";

const USER_A = "user_a";
const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const AUTHORITY_NOW = new Date("2026-08-28T12:00:00.000Z");

type State = {
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    activeHouseholdId: string | null;
  };
  household: { id: string; name: string } | null;
  members: Array<{
    id: string;
    userId: string;
    householdId: string;
    role: string;
    displayName: string | null;
    email: string | null;
    accessPassExpiresAt: string | null;
    createdAt: string;
  }>;
  confirmActive: boolean;
};

function storeFor(
  state: State,
  options: { onClockRead?: () => void } = {},
): HouseholdSnapshotStore {
  return {
    async transaction(work) {
      return work({
        async lockHouseholds() {},
        async getCurrentTime() {
          options.onClockRead?.();
          return new Date(AUTHORITY_NOW);
        },
        async lockUser() {
          return { ...state.user };
        },
        async lockHousehold() {
          return state.household ? { ...state.household } : null;
        },
        async lockMembers() {
          return state.members.map((member) => ({ ...member }));
        },
        async confirmActiveHousehold() {
          return state.confirmActive;
        },
      });
    },
  };
}

test("Exact Me takes the household serializer before any user, household, or member row lock", async () => {
  const events: string[] = [];
  const state = validState();
  await buildExactHouseholdSnapshot({
    userId: USER_A,
    expectedHouseholdId: HOUSEHOLD_A,
    store: {
      async transaction(work) {
        return work({
          async lockHouseholds(ids) {
            events.push(`serialize:${ids.join(",")}`);
          },
          async lockUser() {
            events.push("user");
            return state.user;
          },
          async lockHousehold() {
            events.push("household");
            return state.household;
          },
          async lockMembers() {
            events.push("members");
            return state.members;
          },
          async getCurrentTime() {
            events.push("clock");
            return AUTHORITY_NOW;
          },
          async confirmActiveHousehold() {
            return true;
          },
        });
      },
    },
  });
  assert.deepEqual(events.slice(0, 4), [
    `serialize:${HOUSEHOLD_A}`,
    "user",
    "household",
    "members",
  ]);
});

function validState(): State {
  return {
    user: {
      id: USER_A,
      email: "apollo@example.com",
      displayName: "Apollo",
      activeHouseholdId: HOUSEHOLD_A,
    },
    household: { id: HOUSEHOLD_A, name: "Phoenix Pack" },
    members: [
      {
        id: "member-a",
        userId: USER_A,
        householdId: HOUSEHOLD_A,
        role: "owner",
        displayName: "Apollo",
        email: "apollo@example.com",
        accessPassExpiresAt: null,
        createdAt: "2026-08-28T08:00:00.000Z",
      },
    ],
    confirmActive: true,
  };
}

test("exact Me snapshot includes one self member and never exposes the legacy household credential", async () => {
  let clockReads = 0;
  const snapshot = await buildExactHouseholdSnapshot({
    store: storeFor(validState(), {
      onClockRead() {
        clockReads += 1;
      },
    }),
    userId: USER_A,
    expectedHouseholdId: HOUSEHOLD_A,
  });

  assert.equal(snapshot.household.id, HOUSEHOLD_A);
  assert.equal(snapshot.household.inviteCode, "");
  assert.equal(
    snapshot.authorityObservedAt,
    AUTHORITY_NOW.toISOString(),
    "Exact Me must expose the same provider clock instant used for Access Pass expiry",
  );
  assert.equal(clockReads, 1, "Exact Me must read provider authority time once");
  assert.deepEqual(
    snapshot.members.map((member) => member.isSelf),
    [true],
  );
});

test("exact Me rejects an expired authenticated helper without returning household data", async () => {
  const state = validState();
  state.members[0]!.role = "sitter";
  state.members[0]!.accessPassExpiresAt =
    "2026-08-28T12:00:00.000Z";

  await assert.rejects(
    buildExactHouseholdSnapshot({
      store: storeFor(state),
      userId: USER_A,
      expectedHouseholdId: HOUSEHOLD_A,
    }),
    (error: unknown) =>
      error instanceof HouseholdAuthoritySnapshotError &&
      error.status === 403 &&
      /expired/i.test(error.message),
  );
});

test("exact Me rejects unknown self and roster roles instead of converting them to adult", async () => {
  for (const placement of ["self", "other"] as const) {
    const state = validState();
    if (placement === "self") {
      state.members[0]!.role = "former owner";
    } else {
      state.members.push({
        id: "member-b",
        userId: "user_b",
        householdId: HOUSEHOLD_A,
        role: "former owner",
        displayName: "Unknown",
        email: "unknown@example.com",
        accessPassExpiresAt: null,
        createdAt: "2026-08-28T09:00:00.000Z",
      });
    }

    await assert.rejects(
      buildExactHouseholdSnapshot({
        store: storeFor(state),
        userId: USER_A,
        expectedHouseholdId: HOUSEHOLD_A,
      }),
      (error: unknown) =>
        error instanceof HouseholdAuthoritySnapshotError &&
        error.status === 409 &&
        /role|authority/i.test(error.message),
      placement,
    );
  }
});

test("exact Me keeps expired non-self helpers visible for owner cleanup", async () => {
  const state = validState();
  state.members.push({
    id: "member-b",
    userId: "user_b",
    householdId: HOUSEHOLD_A,
    role: "trainer",
    displayName: "Helper",
    email: "helper@example.com",
    accessPassExpiresAt: "2026-08-28T11:59:59.999Z",
    createdAt: "2026-08-28T09:00:00.000Z",
  });

  const snapshot = await buildExactHouseholdSnapshot({
    store: storeFor(state),
    userId: USER_A,
    expectedHouseholdId: HOUSEHOLD_A,
  });

  assert.deepEqual(
    snapshot.members.map(({ role, accessPassExpired }) => ({
      role,
      accessPassExpired,
    })),
    [
      { role: "owner", accessPassExpired: false },
      { role: "trainer", accessPassExpired: true },
    ],
  );
});

test("exact Me canonicalizes only explicit legacy role aliases", async () => {
  const state = validState();
  state.members[0]!.role = "adult admin";

  const snapshot = await buildExactHouseholdSnapshot({
    store: storeFor(state),
    userId: USER_A,
    expectedHouseholdId: HOUSEHOLD_A,
  });

  assert.equal(snapshot.members[0]?.role, "owner");
});

for (const scenario of [
  {
    name: "the active pointer already names B while A was requested",
    mutate(state: State) {
      state.user.activeHouseholdId = HOUSEHOLD_B;
    },
  },
  {
    name: "the caller membership was revoked before member locking",
    mutate(state: State) {
      state.members = [];
    },
  },
  {
    name: "the active authority changes before the final confirmation",
    mutate(state: State) {
      state.confirmActive = false;
    },
  },
  {
    name: "a row from household C contaminates the locked member set",
    mutate(state: State) {
      state.members.push({
        ...state.members[0]!,
        id: "member-c",
        householdId: "33333333-3333-4333-8333-333333333333",
      });
    },
  },
] as const) {
  test(`Me snapshot fails with a rediscovery conflict when ${scenario.name}`, async () => {
    const state = validState();
    scenario.mutate(state);

    await assert.rejects(
      buildExactHouseholdSnapshot({
        store: storeFor(state),
        userId: USER_A,
        expectedHouseholdId: HOUSEHOLD_A,
      }),
      (error: unknown) =>
        error instanceof HouseholdAuthoritySnapshotError &&
        error.status === 409 &&
        /refresh household identity/i.test(error.message),
    );
  });
}

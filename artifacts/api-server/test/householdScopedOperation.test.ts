import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HOUSEHOLD_SCOPED_ACCESS_ERROR,
  HouseholdScopedOperationError,
  runHouseholdScopedOperation,
  type HouseholdScopedOperationMembership,
  type HouseholdScopedOperationStore,
  type HouseholdScopedOperationUser,
} from "../src/lib/household-scoped-operation.ts";

const USER_ID = "user_scope";
const HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-28T12:00:00.000Z");

function createStore(input: {
  events: string[];
  user?: HouseholdScopedOperationUser | null;
  membership?: HouseholdScopedOperationMembership | null;
  now?: Date;
  database?: unknown;
}): HouseholdScopedOperationStore {
  return {
    async transaction(work) {
      input.events.push("transaction:begin");
      try {
        const result = await work({
          database: input.database ?? "scoped-database",
          async lockHouseholdMutation(householdId) {
            input.events.push(`household-mutation:${householdId}`);
          },
          async lockUser(userId) {
            input.events.push(`user:${userId}`);
            return input.user === undefined
              ? {
                  id: USER_ID,
                  activeHouseholdId: HOUSEHOLD_ID,
                  displayName: "User name",
                }
              : input.user;
          },
          async lockMembership(userId, householdId) {
            input.events.push(`membership:${userId}:${householdId}`);
            return input.membership === undefined
              ? {
                  id: "membership_scope",
                  userId: USER_ID,
                  householdId: HOUSEHOLD_ID,
                  role: "member",
                  displayName: "Household name",
                  accessPassExpiresAt: null,
                }
              : input.membership;
          },
          async getCurrentTime() {
            input.events.push("clock");
            return input.now ?? NOW;
          },
        });
        input.events.push("transaction:commit");
        return result;
      } catch (error) {
        input.events.push("transaction:rollback");
        throw error;
      }
    },
  };
}

test("a scoped Care operation locks exact identity and membership, uses DB time, and keeps work inside the transaction", async () => {
  const events: string[] = [];
  const database = { name: "same transaction" };

  const result = await runHouseholdScopedOperation({
    store: createStore({ events, database }),
    userId: USER_ID,
    expectedHouseholdId: HOUSEHOLD_ID,
    async operation(scope) {
      events.push("care:work");
      assert.equal(scope.database, database);
      assert.equal(scope.householdId, HOUSEHOLD_ID);
      assert.equal(scope.role, "adult");
      assert.equal(scope.authorizationRole, "adult");
      assert.equal(scope.caregiverName, "Household name");
      assert.equal(scope.now, NOW);
      return "complete";
    },
  });

  assert.equal(result, "complete");
  assert.deepEqual(events, [
    "transaction:begin",
    `user:${USER_ID}`,
    `membership:${USER_ID}:${HOUSEHOLD_ID}`,
    "clock",
    "care:work",
    "transaction:commit",
  ]);
});

test("a household-management operation takes its transaction advisory lock before actor row authority", async () => {
  const events: string[] = [];

  await runHouseholdScopedOperation({
    store: createStore({ events }),
    userId: USER_ID,
    expectedHouseholdId: HOUSEHOLD_ID,
    serializeHouseholdMutation: true,
    async operation() {
      events.push("management:work");
    },
  });

  assert.deepEqual(events, [
    "transaction:begin",
    `household-mutation:${HOUSEHOLD_ID}`,
    `user:${USER_ID}`,
    `membership:${USER_ID}:${HOUSEHOLD_ID}`,
    "clock",
    "management:work",
    "transaction:commit",
  ]);
});

test("a stale expected-household pointer fails before membership, clock, or Care access", async () => {
  const events: string[] = [];

  await assert.rejects(
    runHouseholdScopedOperation({
      store: createStore({
        events,
        user: {
          id: USER_ID,
          activeHouseholdId: "99999999-9999-4999-8999-999999999999",
          displayName: null,
        },
      }),
      userId: USER_ID,
      expectedHouseholdId: HOUSEHOLD_ID,
      async operation() {
        events.push("care:forbidden");
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof HouseholdScopedOperationError);
      assert.equal(error.status, 412);
      return true;
    },
  );

  assert.deepEqual(events, [
    "transaction:begin",
    `user:${USER_ID}`,
    "transaction:rollback",
  ]);
});

test("missing, expired, and invalid memberships fail closed without Care access", async () => {
  const deniedMemberships = [
    null,
    {
      id: "membership_scope",
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
      role: "sitter",
      displayName: null,
      accessPassExpiresAt: NOW,
    },
    {
      id: "membership_scope",
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
      role: "former owner",
      displayName: null,
      accessPassExpiresAt: null,
    },
  ] satisfies Array<HouseholdScopedOperationMembership | null>;

  for (const membership of deniedMemberships) {
    const events: string[] = [];
    await assert.rejects(
      runHouseholdScopedOperation({
        store: createStore({ events, membership }),
        userId: USER_ID,
        expectedHouseholdId: HOUSEHOLD_ID,
        async operation() {
          events.push("care:forbidden");
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof HouseholdScopedOperationError);
        assert.equal(error.status, 403);
        assert.equal(error.message, HOUSEHOLD_SCOPED_ACCESS_ERROR);
        return true;
      },
    );
    assert.equal(events.includes("care:forbidden"), false);
    assert.equal(events.at(-1), "transaction:rollback");
  }
});

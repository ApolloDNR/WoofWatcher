import assert from "node:assert/strict";
import { test } from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { runHouseholdScopedOperation } from "../src/lib/household-scoped-operation.ts";
import { createDrizzleHouseholdScopedOperationStore } from "../src/lib/household-scoped-operation-store.ts";

const USER_ID = "user_scope";
const HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-28T12:00:00.000Z");

interface CapturedQuery {
  readonly text: string;
  readonly params: readonly unknown[];
  readonly rowMode: string | undefined;
}

type QueryRows = readonly unknown[];

class ScriptedNodePostgresClient {
  readonly queries: CapturedQuery[] = [];
  private readonly resolveRows: (query: CapturedQuery) => QueryRows;

  constructor(resolveRows: (query: CapturedQuery) => QueryRows) {
    this.resolveRows = resolveRows;
  }

  async query(
    config:
      | string
      | {
          text: string;
          values?: readonly unknown[];
          rowMode?: string;
        },
    values: readonly unknown[] = [],
  ): Promise<{ rows: QueryRows; rowCount: number }> {
    const query = Object.freeze({
      text: typeof config === "string" ? config : config.text,
      params:
        values.length > 0
          ? [...values]
          : typeof config === "string"
            ? []
            : [...(config.values ?? [])],
      rowMode: typeof config === "string" ? undefined : config.rowMode,
    });
    this.queries.push(query);
    const rows = this.resolveRows(query);
    return { rows, rowCount: rows.length };
  }
}

function normalizedSql(query: CapturedQuery): string {
  return query.text.replace(/\s+/g, " ").trim();
}

function queryIndex(
  client: ScriptedNodePostgresClient,
  pattern: RegExp,
): number {
  return client.queries.findIndex((query) =>
    pattern.test(normalizedSql(query)),
  );
}

test("the scoped Drizzle adapter locks user then exact membership with share locks and exposes the same transaction", async () => {
  const events: string[] = [];
  const usersTable = {
    id: "users.id",
    activeHouseholdId: "users.activeHouseholdId",
    displayName: "users.displayName",
  };
  const householdMembersTable = {
    id: "members.id",
    userId: "members.userId",
    householdId: "members.householdId",
    role: "members.role",
    displayName: "members.displayName",
    accessPassExpiresAt: "members.accessPassExpiresAt",
  };
  let executeCalls = 0;
  const transaction = {
    select() {
      return {
        from(table: unknown) {
          const label = table === usersTable ? "user" : "membership";
          return {
            where() {
              return {
                async for(lock: string) {
                  events.push(`${label}:for-${lock}`);
                  return label === "user"
                    ? [
                        {
                          id: USER_ID,
                          activeHouseholdId: HOUSEHOLD_ID,
                          displayName: "User name",
                        },
                      ]
                    : [
                        {
                          id: "membership_scope",
                          userId: USER_ID,
                          householdId: HOUSEHOLD_ID,
                          role: "owner",
                          displayName: "Member name",
                          accessPassExpiresAt: null,
                        },
                      ];
                },
              };
            },
          };
        },
      };
    },
    async execute() {
      executeCalls += 1;
      if (executeCalls === 1) {
        events.push("household-mutation:lock");
        return { rows: [] };
      }
      events.push("clock:execute");
      return { rows: [{ now: NOW }] };
    },
  };
  const database = {
    async transaction(work: (tx: unknown) => Promise<unknown>) {
      events.push("transaction:begin");
      const result = await work(transaction);
      events.push("transaction:commit");
      return result;
    },
  };
  const store = createDrizzleHouseholdScopedOperationStore({
    database,
    tables: { usersTable, householdMembersTable },
  });

  await store.transaction(async (scope) => {
    assert.equal(scope.database, transaction);
    await scope.lockHouseholdMutation(HOUSEHOLD_ID);
    assert.equal((await scope.lockUser(USER_ID))?.id, USER_ID);
    assert.equal(
      (await scope.lockMembership(USER_ID, HOUSEHOLD_ID))?.householdId,
      HOUSEHOLD_ID,
    );
    assert.equal(
      (await scope.getCurrentTime()).toISOString(),
      NOW.toISOString(),
    );
    events.push("care:work");
  });

  assert.deepEqual(events, [
    "transaction:begin",
    "household-mutation:lock",
    "user:for-share",
    "membership:for-share",
    "clock:execute",
    "care:work",
    "transaction:commit",
  ]);
});

test("the real Drizzle scoped runner holds both exact share locks through Care work and commit", async () => {
  const usersTable = pgTable("users", {
    id: text("id").primaryKey(),
    activeHouseholdId: uuid("active_household_id"),
    displayName: text("display_name"),
  });
  const householdMembersTable = pgTable("household_members", {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull(),
    householdId: uuid("household_id").notNull(),
    role: text("role").notNull(),
    displayName: text("display_name"),
    accessPassExpiresAt: timestamp("access_pass_expires_at", {
      withTimezone: true,
    }),
  });
  const client = new ScriptedNodePostgresClient((query) => {
    const sql = normalizedSql(query);
    if (sql === "begin" || sql === "commit" || sql === "rollback") return [];
    if (/^select pg_advisory_xact_lock\(hashtextextended\(/.test(sql)) {
      return query.rowMode === "array" ? [[null]] : [{}];
    }
    if (/from "users"/.test(sql)) {
      return [[USER_ID, HOUSEHOLD_ID, "User name"]];
    }
    if (/from "household_members"/.test(sql)) {
      return [
        [
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          USER_ID,
          HOUSEHOLD_ID,
          "owner",
          "Member name",
          null,
        ],
      ];
    }
    if (/^select clock_timestamp\(\)/.test(sql)) {
      return query.rowMode === "array" ? [[NOW]] : [{ now: NOW }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const database = drizzle({ client: client as never });
  const store = createDrizzleHouseholdScopedOperationStore({
    database,
    tables: { usersTable, householdMembersTable },
  });
  let operationTransaction: unknown;

  const result = await runHouseholdScopedOperation({
    store,
    userId: USER_ID,
    expectedHouseholdId: HOUSEHOLD_ID,
    serializeHouseholdMutation: true,
    async operation(scope) {
      operationTransaction = scope.database;
      return {
        role: scope.role,
        caregiverName: scope.caregiverName,
      };
    },
  });

  assert.deepEqual(result, { role: "owner", caregiverName: "Member name" });
  assert.ok(
    operationTransaction,
    "Care work must receive the Drizzle transaction",
  );
  const beginAt = queryIndex(client, /^begin$/);
  const householdMutationLockAt = queryIndex(
    client,
    /^select pg_advisory_xact_lock\(hashtextextended\(/,
  );
  const userLockAt = queryIndex(client, /from "users".*for share$/);
  const membershipLockAt = queryIndex(
    client,
    /from "household_members".*for share$/,
  );
  const clockAt = queryIndex(client, /^select clock_timestamp\(\)/);
  const commitAt = queryIndex(client, /^commit$/);
  assert.ok(
    beginAt < householdMutationLockAt &&
      householdMutationLockAt < userLockAt &&
      userLockAt < membershipLockAt &&
      membershipLockAt < clockAt &&
      clockAt < commitAt,
  );
  assert.deepEqual(client.queries[householdMutationLockAt]?.params, [
    HOUSEHOLD_ID,
  ]);
  assert.deepEqual(client.queries[userLockAt]?.params, [USER_ID]);
  assert.deepEqual(client.queries[membershipLockAt]?.params, [
    USER_ID,
    HOUSEHOLD_ID,
  ]);
  assert.equal(queryIndex(client, /^rollback$/), -1);
});

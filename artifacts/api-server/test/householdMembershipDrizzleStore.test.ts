import assert from "node:assert/strict";
import { test } from "node:test";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  HouseholdMembershipActivationError,
  activateRetainedHousehold,
  listSwitchableHouseholdMemberships,
} from "../src/lib/household-membership-activation.ts";
import { HouseholdAuthoritySnapshotError } from "../src/lib/household-me-snapshot.ts";
import { createDrizzleHouseholdMembershipStore } from "../src/lib/household-membership-drizzle-store.ts";

const USER_A = "user_a";
const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const MEMBER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEMBER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date("2026-08-28T12:00:00.000Z");
const ME = {
  authorityObservedAt: NOW.toISOString(),
  user: { id: USER_A, email: null, displayName: "Apollo" },
  household: { id: HOUSEHOLD_B, name: "Trail Pack", inviteCode: "" },
  members: [
    {
      id: MEMBER_B,
      userId: USER_A,
      role: "adult",
      displayName: "Apollo",
      email: null,
      isSelf: true,
      accessPassExpiresAt: null,
      accessPassExpired: false,
    },
  ],
};

const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  activeHouseholdId: uuid("active_household_id"),
});
const householdsTable = pgTable("households", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
});
const householdMembersTable = pgTable("household_members", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull(),
  householdId: uuid("household_id").notNull(),
  role: text("role").notNull(),
  accessPassExpiresAt: timestamp("access_pass_expires_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
const careStateTable = pgTable("care_state", {
  householdId: uuid("household_id").primaryKey(),
  doc: jsonb("doc").notNull(),
  version: integer("version").notNull(),
  updatedBy: text("updated_by").notNull(),
});

interface CapturedQuery {
  readonly text: string;
  readonly params: readonly unknown[];
  readonly rowMode: string | undefined;
}

type QueryRows = readonly unknown[];

/**
 * The node-postgres driver only requires this query contract. Drizzle still
 * builds and executes its real SQL, maps returned rows, and owns
 * BEGIN/COMMIT/ROLLBACK; this client merely supplies deterministic provider
 * responses without introducing a database emulator dependency.
 */
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

function createStore(
  client: ScriptedNodePostgresClient,
  buildExactMeSnapshot = async (
    transaction: any,
    userId: string,
    householdId: string,
  ) => {
    assert.equal(userId, USER_A);
    assert.equal(householdId, HOUSEHOLD_B);
    await transaction.execute(sql`select 'exact-me-snapshot' as "marker"`);
    return ME;
  },
): ReturnType<typeof createDrizzleHouseholdMembershipStore> {
  const database = drizzle({ client: client as never });
  return createDrizzleHouseholdMembershipStore({
    database,
    tables: {
      usersTable,
      householdMembersTable,
      householdsTable,
      careStateTable,
    },
    buildExactMeSnapshot,
  });
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

function membershipRow(input: {
  id: string;
  householdId: string;
  householdName: string;
  role?: string;
  createdAt: Date;
}): readonly unknown[] {
  return [
    input.id,
    USER_A,
    input.householdId,
    input.householdName,
    input.role ?? "owner",
    null,
    input.createdAt,
  ];
}

function clockRows(query: CapturedQuery): QueryRows {
  return query.rowMode === "array" ? [[NOW]] : [{ now: NOW }];
}

function advisoryRows(query: CapturedQuery): QueryRows {
  return query.rowMode === "array" ? [[null]] : [{}];
}

test("the real Drizzle store lists under one transaction, locks exact rows, and uses the DB clock", async () => {
  const client = new ScriptedNodePostgresClient((query) => {
    const sql = normalizedSql(query);
    if (sql === "begin" || sql === "commit" || sql === "rollback") return [];
    if (/^select "household_id" from "household_members"/.test(sql)) {
      return [[HOUSEHOLD_A], [HOUSEHOLD_B]];
    }
    if (/^select pg_advisory_xact_lock\(hashtextextended\(/.test(sql)) {
      return advisoryRows(query);
    }
    if (/from "users"/.test(sql)) return [[USER_A, HOUSEHOLD_A]];
    if (/from "household_members"/.test(sql) && /for share$/.test(sql)) {
      return [
        membershipRow({
          id: MEMBER_B,
          householdId: HOUSEHOLD_B,
          householdName: "Trail Pack",
          role: "adult",
          createdAt: new Date("2026-08-02T08:00:00.000Z"),
        }),
        membershipRow({
          id: MEMBER_A,
          householdId: HOUSEHOLD_A,
          householdName: "Phoenix Pack",
          createdAt: new Date("2026-08-01T08:00:00.000Z"),
        }),
      ];
    }
    if (/^select clock_timestamp\(\)/.test(sql)) return clockRows(query);
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const result = await listSwitchableHouseholdMemberships({
    store: createStore(client),
    userId: USER_A,
    expectedSourceHouseholdId: HOUSEHOLD_A,
  });

  assert.deepEqual(result, {
    activeHouseholdId: HOUSEHOLD_A,
    memberships: [
      {
        householdId: HOUSEHOLD_A,
        householdName: "Phoenix Pack",
        role: "owner",
        accessPassExpiresAt: null,
      },
      {
        householdId: HOUSEHOLD_B,
        householdName: "Trail Pack",
        role: "adult",
        accessPassExpiresAt: null,
      },
    ],
  });

  const beginAt = queryIndex(client, /^begin$/);
  const householdDiscoveryIndexes = client.queries
    .map((query, index) =>
      /^select "household_id" from "household_members"/.test(
        normalizedSql(query),
      )
        ? index
        : -1,
    )
    .filter((index) => index >= 0);
  const advisoryAt = queryIndex(
    client,
    /^select pg_advisory_xact_lock\(hashtextextended\(/,
  );
  const userLockAt = queryIndex(client, /from "users".*for update$/);
  const membershipLockAt = queryIndex(
    client,
    /from "household_members".*for share$/,
  );
  const clockAt = queryIndex(client, /^select clock_timestamp\(\)/);
  const commitAt = queryIndex(client, /^commit$/);
  assert.ok(
    beginAt < householdDiscoveryIndexes[0]! &&
      householdDiscoveryIndexes[0]! < advisoryAt &&
      advisoryAt < userLockAt &&
      userLockAt < householdDiscoveryIndexes[1]! &&
      householdDiscoveryIndexes[1]! < membershipLockAt &&
      userLockAt < membershipLockAt &&
      membershipLockAt < clockAt &&
      clockAt < commitAt,
  );
  assert.equal(householdDiscoveryIndexes.length, 2);
  assert.deepEqual(client.queries[userLockAt]?.params, [USER_A]);
  assert.deepEqual(client.queries[membershipLockAt]?.params, [USER_A]);
  assert.equal(queryIndex(client, /^rollback$/), -1);
});

test("the real Drizzle activation locks, CASes, creates Care state, then commits", async () => {
  const client = new ScriptedNodePostgresClient((query) => {
    const sql = normalizedSql(query);
    if (sql === "begin" || sql === "commit" || sql === "rollback") return [];
    if (/^select pg_advisory_xact_lock\(hashtextextended\(/.test(sql)) {
      return advisoryRows(query);
    }
    if (/from "users"/.test(sql)) return [[USER_A, HOUSEHOLD_A]];
    if (/from "household_members"/.test(sql) && /for update$/.test(sql)) {
      return [
        membershipRow({
          id: MEMBER_B,
          householdId: HOUSEHOLD_B,
          householdName: "Trail Pack",
          role: "adult",
          createdAt: new Date("2026-08-02T08:00:00.000Z"),
        }),
      ];
    }
    if (/^select clock_timestamp\(\)/.test(sql)) return clockRows(query);
    if (/^update "users"/.test(sql)) return [[USER_A]];
    if (/^insert into "care_state"/.test(sql)) return [];
    if (/^select 'exact-me-snapshot'/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  assert.deepEqual(
    await activateRetainedHousehold({
      store: createStore(client),
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
    }),
    { householdId: HOUSEHOLD_B, me: ME },
  );

  const beginAt = queryIndex(client, /^begin$/);
  const userLockAt = queryIndex(client, /from "users".*for update$/);
  const targetLockAt = queryIndex(
    client,
    /from "household_members".*for update$/,
  );
  const clockAt = queryIndex(client, /^select clock_timestamp\(\)/);
  const casAt = queryIndex(client, /^update "users"/);
  const careAt = queryIndex(client, /^insert into "care_state"/);
  const snapshotAt = queryIndex(client, /^select 'exact-me-snapshot'/);
  const commitAt = queryIndex(client, /^commit$/);
  assert.ok(
    beginAt < userLockAt &&
      userLockAt < targetLockAt &&
      targetLockAt < clockAt &&
      clockAt < casAt &&
      casAt < careAt &&
      careAt < snapshotAt &&
      snapshotAt < commitAt,
  );
  assert.deepEqual(client.queries[targetLockAt]?.params, [USER_A, HOUSEHOLD_B]);
  assert.deepEqual(client.queries[casAt]?.params, [
    HOUSEHOLD_B,
    USER_A,
    HOUSEHOLD_A,
    MEMBER_B,
    USER_A,
    HOUSEHOLD_B,
  ]);
  assert.match(normalizedSql(client.queries[casAt]!), /exists \(/);
  assert.match(
    normalizedSql(client.queries[casAt]!),
    /"access_pass_expires_at" > clock_timestamp\(\)/,
  );
  assert.equal(queryIndex(client, /^rollback$/), -1);
});

test("a zero-row real Drizzle CAS fails closed, rolls back, and never creates Care state", async () => {
  const client = new ScriptedNodePostgresClient((query) => {
    const sql = normalizedSql(query);
    if (sql === "begin" || sql === "rollback") return [];
    if (/^select pg_advisory_xact_lock\(hashtextextended\(/.test(sql)) {
      return advisoryRows(query);
    }
    if (/from "users"/.test(sql)) return [[USER_A, HOUSEHOLD_A]];
    if (/from "household_members"/.test(sql) && /for update$/.test(sql)) {
      return [
        membershipRow({
          id: MEMBER_B,
          householdId: HOUSEHOLD_B,
          householdName: "Trail Pack",
          createdAt: new Date("2026-08-02T08:00:00.000Z"),
        }),
      ];
    }
    if (/^select clock_timestamp\(\)/.test(sql)) return clockRows(query);
    if (/^update "users"/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await assert.rejects(
    activateRetainedHousehold({
      store: createStore(client),
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
      now: NOW,
    }),
    (error) => {
      assert.ok(error instanceof HouseholdMembershipActivationError);
      assert.equal(error.status, 403);
      return true;
    },
  );

  const casAt = queryIndex(client, /^update "users"/);
  const rollbackAt = queryIndex(client, /^rollback$/);
  assert.ok(casAt >= 0 && casAt < rollbackAt);
  assert.equal(queryIndex(client, /^insert into "care_state"/), -1);
  assert.equal(queryIndex(client, /^commit$/), -1);
});

test("a Care-state failure after the real Drizzle CAS rolls back instead of reporting activation", async () => {
  const client = new ScriptedNodePostgresClient((query) => {
    const sql = normalizedSql(query);
    if (sql === "begin" || sql === "rollback") return [];
    if (/^select pg_advisory_xact_lock\(hashtextextended\(/.test(sql)) {
      return advisoryRows(query);
    }
    if (/from "users"/.test(sql)) return [[USER_A, HOUSEHOLD_A]];
    if (/from "household_members"/.test(sql) && /for update$/.test(sql)) {
      return [
        membershipRow({
          id: MEMBER_B,
          householdId: HOUSEHOLD_B,
          householdName: "Trail Pack",
          createdAt: new Date("2026-08-02T08:00:00.000Z"),
        }),
      ];
    }
    if (/^select clock_timestamp\(\)/.test(sql)) return clockRows(query);
    if (/^update "users"/.test(sql)) return [[USER_A]];
    if (/^insert into "care_state"/.test(sql)) {
      throw new Error("care-state insert failed");
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await assert.rejects(
    activateRetainedHousehold({
      store: createStore(client),
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
      now: NOW,
    }),
    (error) => {
      const cause = Reflect.get(error as object, "cause");
      assert.match(String(cause ?? error), /care-state insert failed/);
      return true;
    },
  );

  const casAt = queryIndex(client, /^update "users"/);
  const careAt = queryIndex(client, /^insert into "care_state"/);
  const rollbackAt = queryIndex(client, /^rollback$/);
  assert.ok(casAt >= 0 && casAt < careAt && careAt < rollbackAt);
  assert.equal(queryIndex(client, /^commit$/), -1);
});

test("an Exact Me failure after the real Drizzle CAS and Care ensure rolls the transaction back", async () => {
  const client = new ScriptedNodePostgresClient((query) => {
    const sql = normalizedSql(query);
    if (sql === "begin" || sql === "rollback") return [];
    if (/^select pg_advisory_xact_lock\(hashtextextended\(/.test(sql)) {
      return advisoryRows(query);
    }
    if (/from "users"/.test(sql)) return [[USER_A, HOUSEHOLD_A]];
    if (/from "household_members"/.test(sql) && /for update$/.test(sql)) {
      return [
        membershipRow({
          id: MEMBER_B,
          householdId: HOUSEHOLD_B,
          householdName: "Trail Pack",
          role: "adult",
          createdAt: new Date("2026-08-02T08:00:00.000Z"),
        }),
      ];
    }
    if (/^select clock_timestamp\(\)/.test(sql)) return clockRows(query);
    if (/^update "users"/.test(sql)) return [[USER_A]];
    if (/^insert into "care_state"/.test(sql)) return [];
    if (/^select 'exact-me-snapshot'/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await assert.rejects(
    activateRetainedHousehold({
      store: createStore(client, async (transaction) => {
        await transaction.execute(sql`select 'exact-me-snapshot' as "marker"`);
        throw new HouseholdAuthoritySnapshotError("snapshot conflict");
      }),
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
      now: NOW,
    }),
    (error) => {
      assert.ok(error instanceof HouseholdAuthoritySnapshotError);
      assert.equal(error.status, 409);
      return true;
    },
  );

  const casAt = queryIndex(client, /^update "users"/);
  const careAt = queryIndex(client, /^insert into "care_state"/);
  const snapshotAt = queryIndex(client, /^select 'exact-me-snapshot'/);
  const rollbackAt = queryIndex(client, /^rollback$/);
  assert.ok(
    casAt >= 0 &&
      casAt < careAt &&
      careAt < snapshotAt &&
      snapshotAt < rollbackAt,
  );
  assert.equal(queryIndex(client, /^commit$/), -1);
});

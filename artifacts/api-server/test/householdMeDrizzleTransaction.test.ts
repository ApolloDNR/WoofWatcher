import assert from "node:assert/strict";
import { test } from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { buildExactHouseholdSnapshotInDrizzleTransaction } from "../src/lib/household-snapshot-drizzle-transaction.ts";

const USER_ID = "user_snapshot";
const HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-08-28T12:00:00.000Z");

const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
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
  displayName: text("display_name"),
  accessPassExpiresAt: timestamp("access_pass_expires_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

interface CapturedQuery {
  readonly text: string;
  readonly params: readonly unknown[];
  readonly rowMode: string | undefined;
}

class ScriptedNodePostgresClient {
  readonly queries: CapturedQuery[] = [];

  async query(
    config:
      | string
      | { text: string; values?: readonly unknown[]; rowMode?: string },
    values: readonly unknown[] = [],
  ): Promise<{ rows: readonly unknown[]; rowCount: number }> {
    const query = {
      text: typeof config === "string" ? config : config.text,
      params:
        values.length > 0
          ? [...values]
          : typeof config === "string"
            ? []
            : [...(config.values ?? [])],
      rowMode: typeof config === "string" ? undefined : config.rowMode,
    };
    this.queries.push(query);
    const sql = query.text.replace(/\s+/g, " ").trim();
    let rows: readonly unknown[];
    if (sql === "begin" || sql === "commit" || sql === "rollback") {
      rows = [];
    } else if (/^select pg_advisory_xact_lock\(hashtextextended\(/.test(sql)) {
      rows = query.rowMode === "array" ? [[null]] : [{}];
    } else if (/from "users".*for update$/.test(sql)) {
      rows = [[USER_ID, "apollo@example.com", "Apollo", HOUSEHOLD_ID]];
    } else if (/from "households".*for share$/.test(sql)) {
      rows = [[HOUSEHOLD_ID, "Phoenix Pack"]];
    } else if (/from "household_members".*for share$/.test(sql)) {
      rows = [
        [
          MEMBER_ID,
          USER_ID,
          HOUSEHOLD_ID,
          "owner",
          "Apollo",
          "Apollo",
          "apollo@example.com",
          null,
          new Date("2026-08-01T08:00:00.000Z"),
        ],
      ];
    } else if (/^select clock_timestamp\(\)/.test(sql)) {
      rows = query.rowMode === "array" ? [[NOW]] : [{ now: NOW }];
    } else if (/^select "id" from "users"/.test(sql)) {
      rows = [[USER_ID]];
    } else {
      throw new Error(`Unexpected SQL: ${sql}`);
    }
    return { rows, rowCount: rows.length };
  }
}

test("the Exact Me adapter executes the database clock on its existing Drizzle transaction", async () => {
  const client = new ScriptedNodePostgresClient();
  const database = drizzle({ client: client as never });

  const snapshot = await database.transaction((transaction) =>
    buildExactHouseholdSnapshotInDrizzleTransaction({
      transaction,
      tables: { usersTable, householdsTable, householdMembersTable },
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
    }),
  );

  assert.equal(snapshot.household.id, HOUSEHOLD_ID);
  assert.equal(snapshot.members[0]?.role, "owner");
  assert.equal(snapshot.authorityObservedAt, NOW.toISOString());
  const statements = client.queries.map((query) =>
    query.text.replace(/\s+/g, " ").trim(),
  );
  const clockAt = statements.findIndex((sql) =>
    /^select clock_timestamp\(\)/.test(sql),
  );
  assert.ok(clockAt >= 0, "the Exact Me adapter must execute database time");
  assert.equal(
    statements.filter((sql) => /^select clock_timestamp\(\)/.test(sql)).length,
    1,
    "expiry authority and returned authorityObservedAt must share one DB clock read",
  );
  assert.ok(clockAt < statements.indexOf("commit"));
  assert.equal(statements.includes("rollback"), false);
});

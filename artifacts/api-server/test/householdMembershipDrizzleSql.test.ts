import assert from "node:assert/strict";
import { test } from "node:test";

import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { buildActiveHouseholdCasQuery } from "../src/lib/household-membership-drizzle-store.ts";

const USER_A = "user_a";
const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const MEMBER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  activeHouseholdId: uuid("active_household_id"),
});
const householdMembersTable = pgTable("household_members", {
  id: uuid("id").primaryKey(),
  userId: text("user_id").notNull(),
  householdId: uuid("household_id").notNull(),
  role: text("role").notNull(),
  accessPassExpiresAt: timestamp("access_pass_expires_at", {
    withTimezone: true,
  }),
});
const householdsTable = pgTable("households", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
});
const careStateTable = pgTable("care_state", {
  householdId: uuid("household_id").primaryKey(),
});

test("the shipping Drizzle CAS compiles exact source and target authority into one update", () => {
  const database = drizzle.mock();
  const query = buildActiveHouseholdCasQuery({
    transaction: database,
    tables: {
      usersTable,
      householdMembersTable,
      householdsTable,
      careStateTable,
    },
    activation: {
      userId: USER_A,
      expectedSourceHouseholdId: HOUSEHOLD_A,
      targetHouseholdId: HOUSEHOLD_B,
      membershipId: MEMBER_B,
    },
  });

  const compiled = query.toSQL();
  const normalizedSql = compiled.sql.replace(/\s+/g, " ").trim();
  assert.match(normalizedSql, /^update "users" set "active_household_id" = \$1 where/);
  assert.match(normalizedSql, /"users"\."id" = \$2/);
  assert.match(normalizedSql, /"users"\."active_household_id" = \$3/);
  assert.match(normalizedSql, /exists \( select 1 from "household_members"/);
  assert.match(normalizedSql, /"household_members"\."id" = \$4/);
  assert.match(normalizedSql, /"household_members"\."user_id" = \$5/);
  assert.match(normalizedSql, /"household_members"\."household_id" = \$6/);
  assert.match(
    normalizedSql,
    /lower\(btrim\(regexp_replace\("household_members"\."role", '\[\[:space:\]\]\+', ' ', 'g'\)\)\)/,
  );
  for (const role of [
    "admin",
    "adult admin",
    "owner",
    "adult",
    "member",
    "primary caregiver",
    "teen",
    "kid",
    "child",
    "minor",
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
  ]) {
    assert.match(normalizedSql, new RegExp(`'${role}'`), role);
  }
  assert.match(
    normalizedSql,
    /"household_members"\."access_pass_expires_at" > clock_timestamp\(\)/,
  );
  assert.match(normalizedSql, /returning "id"$/);
  assert.deepEqual(compiled.params, [
    HOUSEHOLD_B,
    USER_A,
    HOUSEHOLD_A,
    MEMBER_B,
    USER_A,
    HOUSEHOLD_B,
  ]);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");
}

test("Drizzle push preserves the private-care constraints and idempotency index from migration 0005", () => {
  const schema = read("lib/db/src/schema/careEntries.ts");
  const migration = read(
    "supabase/migrations/0005_private_care_entry_isolation.sql",
  );

  for (const name of [
    "care_entries_visibility_details_match",
    "care_entries_private_creator_required",
    "care_entries_household_creator_client_key_uidx",
  ]) {
    assert.match(migration, new RegExp(`\\b${name}\\b`));
    assert.match(
      schema,
      new RegExp(`[\"']${name}[\"']`),
      `Drizzle push must preserve ${name}`,
    );
  }
  assert.match(schema, /jsonb_typeof/);
  assert.match(schema, /details[\s\S]*->>[\s\S]*clientKey/);
  assert.match(schema, /caregiverUserId[\s\S]*is not null/);
});

test("Drizzle push preserves the canonical household-role check from migration 0006", () => {
  const schema = read("lib/db/src/schema/householdMembers.ts");
  const migration = read(
    "supabase/migrations/0006_household_role_canonicalization.sql",
  );
  const name = "household_members_role_canonical_check";

  assert.match(migration, new RegExp(`\\b${name}\\b`));
  assert.match(schema, new RegExp(`[\"']${name}[\"']`));
  for (const role of [
    "owner",
    "adult",
    "teen",
    "kid",
    "sitter",
    "trainer",
    "walker",
    "vet viewer",
  ]) {
    assert.match(schema, new RegExp(`[\"']${role}[\"']`));
  }
});

test("Drizzle push preserves the active-household index from migration 0004", () => {
  const schema = read("lib/db/src/schema/users.ts");
  const migration = read(
    "supabase/migrations/0004_users_active_household.sql",
  );
  const name = "users_active_household_id_idx";

  assert.match(migration, new RegExp(`\\b${name}\\b`));
  assert.match(schema, new RegExp(`[\"']${name}[\"']`));
  assert.match(schema, /\.on\(t\.activeHouseholdId\)/);
});

test("Drizzle push preserves creator-scoped deleted client keys from migration 0007", () => {
  const schema = read("lib/db/src/schema/careEntries.ts");
  const migration = read(
    "supabase/migrations/0007_care_entry_create_revocation.sql",
  );
  const name =
    "care_entry_tombstones_household_creator_client_key_uidx";

  assert.match(migration, /add column if not exists client_key text/);
  assert.match(schema, /clientKey:\s*text\(["']client_key["']\)/);
  assert.match(migration, new RegExp(`\\b${name}\\b`));
  assert.match(schema, new RegExp(`["']${name}["']`));
  assert.match(
    schema,
    /\.on\(t\.householdId, t\.caregiverUserId, t\.clientKey\)/,
  );
  assert.match(schema, /where\(sql`\$\{t\.clientKey\} is not null`\)/);
  assert.match(
    migration,
    /entry_id[\s\S]*synthetic UUID[\s\S]*authoritative identity is client_key/,
  );
  assert.match(
    schema,
    /creator-private tombstone receives a random UUID[\s\S]*clientKey is[\s\S]*authoritative revocation identity/,
  );
});

test("the database runbook requires every ordered release migration", () => {
  const runbook = read("docs/handoff/DATABASE_SETUP.md");

  assert.doesNotMatch(runbook, /two equivalent options/i);
  assert.match(runbook, /canonical migration/i);
  for (const migration of [
    "0001",
    "0002",
    "0003",
    "0004",
    "0005",
    "0006",
    "0007",
  ]) {
    assert.match(
      runbook,
      new RegExp(`supabase/migrations/${migration}[^\\s\"']*\\.sql`),
      `the setup path must apply migration ${migration}`,
    );
  }
  assert.match(runbook, /Drizzle push[\s\S]*does not[\s\S]*backfill/i);
});

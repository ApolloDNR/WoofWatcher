import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const schemaPath = new URL(
  "../../../lib/db/src/schema/careEntries.ts",
  import.meta.url,
);
const migrationPath = new URL(
  "../../../supabase/migrations/0005_private_care_entry_isolation.sql",
  import.meta.url,
);

test("care-entry schema persists visibility and creator metadata on live rows and tombstones", async () => {
  const source = await readFile(schemaPath, "utf8");

  assert.match(source, /householdVisible:\s*boolean\("household_visible"\)/);
  assert.match(
    source,
    /careEntryTombstonesTable[\s\S]*caregiverUserId:\s*text\("caregiver_user_id"\)/,
  );
  assert.match(
    source,
    /careEntryTombstonesTable[\s\S]*householdVisible:\s*boolean\("household_visible"\)/,
  );
});

test("privacy migration backfills explicit visibility, fails legacy tombstones closed, and creator-scopes idempotency", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(
    sql,
    /alter table public\.care_entries[\s\S]*household_visible/i,
  );
  assert.match(
    sql,
    /jsonb_set\([\s\S]*'\{householdVisible\}'[\s\S]*'false'::jsonb/i,
  );
  assert.match(
    sql,
    /where\s+coalesce\(details, '\{\}'::jsonb\)\s*\?\s*'householdVisible'[\s\S]*jsonb_typeof\(details\s*->\s*'householdVisible'\)\s*<>\s*'boolean'/i,
  );
  assert.match(
    sql,
    /case[\s\S]*when not \(coalesce\(details, '\{\}'::jsonb\) \? 'householdVisible'\)[\s\S]*then true[\s\S]*when jsonb_typeof\(details -> 'householdVisible'\) = 'boolean'[\s\S]*else false/i,
  );
  assert.match(
    sql,
    /alter table public\.care_entry_tombstones[\s\S]*caregiver_user_id[\s\S]*household_visible/i,
  );
  assert.match(
    sql,
    /update public\.care_entry_tombstones[\s\S]*household_visible\s*=\s*false/i,
  );
  assert.match(
    sql,
    /drop index if exists public\.care_entries_household_client_key_uidx/i,
  );
  assert.match(
    sql,
    /create unique index[\s\S]*household_id[\s\S]*caregiver_user_id[\s\S]*details\s*->>\s*'clientKey'/i,
  );
  assert.match(sql, /enable row level security/i);
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete|all)/i);
});

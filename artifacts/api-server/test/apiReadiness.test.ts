import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const apiDir = join(root, "artifacts", "api-server", "src");

function readApiFile(path: string): string {
  return readFileSync(join(apiDir, path), "utf8");
}

test("keeps authenticated API routes household scoped", () => {
  const routesIndex = readApiFile(join("routes", "index.ts"));
  const household = readApiFile(join("routes", "household.ts"));
  const careState = readApiFile(join("routes", "care-state.ts"));
  const careEntries = readApiFile(join("routes", "care-entries.ts"));
  const auth = readApiFile(join("lib", "auth.ts"));

  assert.match(auth, /getAuth\(req\)/);
  assert.match(auth, /res\.status\(401\)\.json\(\{ error: "Unauthorized" \}\)/);
  assert.match(routesIndex, /router\.use\(householdRouter\)/);
  assert.match(routesIndex, /router\.use\(careStateRouter\)/);
  assert.match(routesIndex, /router\.use\(careEntriesRouter\)/);

  for (const [name, source] of Object.entries({ household, careState, careEntries })) {
    assert.match(source, /requireAuth/, `${name} should require Clerk auth`);
    assert.match(source, /getUserId\(req\)/, `${name} should read the authenticated user id`);
  }

  assert.match(careState, /getActiveHouseholdId\(userId\)/);
  assert.match(careState, /eq\(careStateTable\.householdId, householdId\)/);
  assert.match(careEntries, /getActiveHouseholdId\(userId\)/);
  assert.match(careEntries, /eq\(careEntriesTable\.householdId, householdId\)/);
  assert.match(household, /ensureUserAndHousehold\(userId\)/);
});

test("keeps household member profile updates scoped to the active household", () => {
  const household = readApiFile(join("routes", "household.ts"));

  assert.match(household, /UpdateMeBody\.safeParse\(req\.body\)/);
  assert.match(household, /const \{ householdId \} = await ensureUserAndHousehold\(userId\)/);
  assert.match(household, /\.update\(householdMembersTable\)/);
  assert.match(
    household,
    /and\([\s\S]*eq\(householdMembersTable\.userId, userId\),[\s\S]*eq\(householdMembersTable\.householdId, householdId\)/,
  );
});

test("keeps care-state writes optimistic and conflict recoverable", () => {
  const careState = readApiFile(join("routes", "care-state.ts"));
  const mobileContext = readFileSync(
    join(root, "artifacts", "woofwatcher-mobile", "context", "CareContext.tsx"),
    "utf8",
  );

  assert.match(careState, /PutCareStateBody\.safeParse\(req\.body\)/);
  assert.match(careState, /current\.version !== parsed\.data\.version/);
  assert.match(careState, /res\.status\(409\)\.json/);
  assert.match(careState, /version: current\.version/);
  assert.match(careState, /doc: current\.doc/);
  assert.match(careState, /version: current\.version \+ 1/);
  assert.match(careState, /updatedBy: userId/);
  assert.match(
    careState,
    /and\([\s\S]*eq\(careStateTable\.householdId, householdId\),[\s\S]*eq\(careStateTable\.version, current\.version\)/,
  );
  assert.match(careState, /refreshed/);

  assert.match(mobileContext, /reconcileCareDocFromServer/);
  assert.match(mobileContext, /putCareState\(\{\s*version: plan\.version/);
});

test("keeps care-entry routes append-safe and household isolated", () => {
  const careEntries = readApiFile(join("routes", "care-entries.ts"));

  assert.match(careEntries, /CreateCareEntryBody\.safeParse\(req\.body\)/);
  assert.match(careEntries, /normalizeCareEventType\(parsed\.data\.type, parsed\.data\.details\)/);
  assert.match(careEntries, /caregiverUserId: userId/);
  assert.match(careEntries, /getCaregiverName\(householdId, userId\)/);
  assert.match(careEntries, /ListCareEntriesResponseItem\.parse\(entry\)/);

  assert.match(careEntries, /UpdateCareEntryParams\.safeParse\(req\.params\)/);
  assert.match(careEntries, /UpdateCareEntryBody\.safeParse\(req\.body\)/);
  assert.match(careEntries, /and\([\s\S]*eq\(careEntriesTable\.id, params\.data\.id\),[\s\S]*eq\(careEntriesTable\.householdId, householdId\)/);
  assert.match(careEntries, /DeleteCareEntryParams\.safeParse\(req\.params\)/);
  assert.match(careEntries, /res\.status\(404\)\.json\(\{ error: "Entry not found" \}\)/);
  assert.match(careEntries, /res\.sendStatus\(204\)/);
});

test("keeps care-entry deletes retained as household audit notes", () => {
  const careEntries = readApiFile(join("routes", "care-entries.ts"));
  const mobileContext = readFileSync(
    join(root, "artifacts", "woofwatcher-mobile", "context", "CareContext.tsx"),
    "utf8",
  );
  const mobileLog = readFileSync(
    join(root, "artifacts", "woofwatcher-mobile", "app", "(tabs)", "log.tsx"),
    "utf8",
  );

  assert.match(careEntries, /buildCareLogDeletionAuditEntry/);
  assert.match(careEntries, /deletedEntryTitle/);
  assert.match(careEntries, /auditSubjectId/);
  assert.match(careEntries, /deletedEntrySnapshot/);
  assert.match(careEntries, /\.insert\(careEntriesTable\)[\s\S]*type: auditEntry\.type/);
  assert.match(careEntries, /title: auditEntry\.title/);
  assert.match(careEntries, /caregiverUserId: userId/);

  assert.match(mobileContext, /auditHandledByServer/);
  assert.match(mobileContext, /return \{ ok: true, auditHandledByServer: true \}/);
  assert.match(mobileLog, /!deleted\.auditHandledByServer/);
});

test("keeps care-entry list limit query documented across server, OpenAPI, and generated clients", () => {
  const careEntries = readApiFile(join("routes", "care-entries.ts"));
  const openapi = readFileSync(join(root, "lib", "api-spec", "openapi.yaml"), "utf8");
  const zodApi = readFileSync(join(root, "lib", "api-zod", "src", "generated", "api.ts"), "utf8");
  const zodParams = readFileSync(
    join(root, "lib", "api-zod", "src", "generated", "types", "listCareEntriesParams.ts"),
    "utf8",
  );
  const reactSchemas = readFileSync(
    join(root, "lib", "api-client-react", "src", "generated", "api.schemas.ts"),
    "utf8",
  );

  assert.match(careEntries, /req\.query\.limit/);
  assert.match(careEntries, /Math\.min\(500, Math\.max\(1/);
  assert.match(careEntries, /\.limit\(limit\)/);
  assert.match(openapi, /name: limit[\s\S]*minimum: 1[\s\S]*maximum: 500/);
  assert.match(zodApi, /"limit": zod\.number\(\)\.min\(1\)\.max\(500\)\.optional\(\)/);
  assert.match(zodParams, /limit\?: number/);
  assert.match(reactSchemas, /limit\?: number/);
});

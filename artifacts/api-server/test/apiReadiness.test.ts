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

test("keeps household rename restricted to owner or admin members", () => {
  const householdRoute = readApiFile(join("routes", "household.ts"));
  const householdLib = readApiFile(join("lib", "household.ts"));

  assert.match(householdLib, /requireActiveHouseholdRole/);
  assert.match(householdLib, /allowedRoles: readonly string\[\]/);
  assert.match(householdLib, /eq\(householdMembersTable\.userId, userId\)/);
  assert.match(householdLib, /eq\(householdMembersTable\.householdId, householdId\)/);
  assert.match(householdLib, /allowedRoles\.includes\(membership\.role\.toLowerCase\(\)\)/);

  assert.match(householdRoute, /UpdateHouseholdBody\.safeParse\(req\.body\)/);
  assert.match(householdRoute, /requireActiveHouseholdRole\(userId, \["owner", "admin"\]\)/);
  assert.match(householdRoute, /res\.status\(403\)\.json\(\{ error: "Only household owners can rename this pack" \}\)/);
  assert.match(householdRoute, /\.update\(householdsTable\)/);
});

test("keeps household invite codes visible only to owner or admin members", () => {
  const householdLib = readApiFile(join("lib", "household.ts"));

  assert.match(householdLib, /const selfMember = memberRows\.find\(\(m\) => m\.userId === userId\)/);
  assert.match(householdLib, /const canShareInvite = \["owner", "admin"\]\.includes\(selfMember\?\.role\?\.toLowerCase\(\) \?\? ""\)/);
  assert.match(householdLib, /inviteCode: canShareInvite \? household\.inviteCode : ""/);
});

test("keeps invite joins from creating a throwaway default household first", () => {
  const householdRoute = readApiFile(join("routes", "household.ts"));
  const householdLib = readApiFile(join("lib", "household.ts"));

  assert.match(householdLib, /export async function ensureUser\(/);
  assert.match(householdLib, /export async function ensureCareState\(/);
  assert.match(householdRoute, /JoinHouseholdBody\.safeParse\(req\.body\)/);
  assert.match(householdRoute, /const user = await ensureUser\(userId\)/);
  assert.match(householdRoute, /await ensureCareState\(household\.id, userId\)/);
  assert.match(householdRoute, /role: "member"/);
  assert.doesNotMatch(
    householdRoute,
    /router\.post\("\/household\/join"[\s\S]*ensureUserAndHousehold\(userId\)/,
  );
});

test("keeps joined households active for later care sync routes", () => {
  const householdRoute = readApiFile(join("routes", "household.ts"));
  const householdLib = readApiFile(join("lib", "household.ts"));
  const usersSchema = readFileSync(join(root, "lib", "db", "src", "schema", "users.ts"), "utf8");

  assert.match(usersSchema, /activeHouseholdId: uuid\("active_household_id"\)/);
  assert.match(
    householdLib,
    /memberships\.find\([\s\S]*membership\.householdId === user\.activeHouseholdId/,
  );
  assert.match(
    householdRoute,
    /\.update\(usersTable\)[\s\S]*activeHouseholdId: household\.id[\s\S]*eq\(usersTable\.id, userId\)/,
  );
});

test("keeps active household switching membership scoped", () => {
  const householdRoute = readApiFile(join("routes", "household.ts"));
  const openapi = readFileSync(join(root, "lib", "api-spec", "openapi.yaml"), "utf8");
  const zodApi = readFileSync(join(root, "lib", "api-zod", "src", "generated", "api.ts"), "utf8");
  const reactClient = readFileSync(join(root, "lib", "api-client-react", "src", "generated", "api.ts"), "utf8");
  const reactSchemas = readFileSync(
    join(root, "lib", "api-client-react", "src", "generated", "api.schemas.ts"),
    "utf8",
  );

  assert.match(householdRoute, /SetActiveHouseholdBody\.safeParse\(req\.body\)/);
  assert.match(householdRoute, /router\.patch\("\/me\/active-household"/);
  assert.match(householdRoute, /eq\(householdMembersTable\.userId, userId\)/);
  assert.match(householdRoute, /eq\(householdMembersTable\.householdId, parsed\.data\.householdId\)/);
  assert.match(householdRoute, /res\.status\(404\)\.json\(\{ error: "Household membership not found" \}\)/);
  assert.match(householdRoute, /await ensureCareState\(parsed\.data\.householdId, userId\)/);
  assert.match(
    householdRoute,
    /\.update\(usersTable\)[\s\S]*activeHouseholdId: parsed\.data\.householdId[\s\S]*eq\(usersTable\.id, userId\)/,
  );
  assert.match(householdRoute, /buildMe\(userId, parsed\.data\.householdId\)/);

  assert.match(openapi, /\/me\/active-household:/);
  assert.match(openapi, /households:[\s\S]*items:[\s\S]*#\/components\/schemas\/Household/);
  assert.match(openapi, /SetActiveHousehold/);
  assert.match(openapi, /householdId:/);
  assert.match(zodApi, /"households": zod\.array\(zod\.object/);
  assert.match(zodApi, /export const SetActiveHouseholdBody/);
  assert.match(zodApi, /householdId": zod\.string\(\)\.min\(1\)/);
  assert.match(reactClient, /getSetActiveHouseholdUrl/);
  assert.match(reactClient, /setActiveHousehold/);
  assert.match(reactSchemas, /households: Household\[\]/);
  assert.match(reactSchemas, /export interface SetActiveHouseholdBody/);
  assert.match(reactSchemas, /householdId: string/);
});

test("keeps household audit review owner scoped and client documented", () => {
  const householdRoute = readApiFile(join("routes", "household.ts"));
  const schemaIndex = readFileSync(join(root, "lib", "db", "src", "schema", "index.ts"), "utf8");
  const auditSchema = readFileSync(
    join(root, "lib", "db", "src", "schema", "householdAuditEvents.ts"),
    "utf8",
  );
  const openapi = readFileSync(join(root, "lib", "api-spec", "openapi.yaml"), "utf8");
  const zodApi = readFileSync(join(root, "lib", "api-zod", "src", "generated", "api.ts"), "utf8");
  const reactClient = readFileSync(join(root, "lib", "api-client-react", "src", "generated", "api.ts"), "utf8");
  const reactSchemas = readFileSync(
    join(root, "lib", "api-client-react", "src", "generated", "api.schemas.ts"),
    "utf8",
  );

  assert.match(schemaIndex, /export \* from "\.\/householdAuditEvents"/);
  assert.match(auditSchema, /pgTable\("household_audit_events"/);
  assert.match(auditSchema, /householdId: uuid\("household_id"\)/);
  assert.match(auditSchema, /actorUserId: text\("actor_user_id"\)/);
  assert.match(auditSchema, /lifecycleState: text\("lifecycle_state"\)/);
  assert.match(auditSchema, /details: jsonb\("details"\)/);

  assert.match(householdRoute, /ListHouseholdAuditEventsQueryParams\.safeParse\(req\.query\)/);
  assert.match(householdRoute, /router\.get\("\/household\/audit-events"/);
  assert.match(householdRoute, /requireActiveHouseholdRole\(userId, \["owner", "admin"\]\)/);
  assert.match(householdRoute, /res\.status\(403\)\.json\(\{ error: "Only household owners can review audit events" \}\)/);
  assert.match(householdRoute, /Math\.min\(200, Math\.max\(1/);
  assert.match(householdRoute, /eq\(householdAuditEventsTable\.householdId, householdId\)/);
  assert.match(householdRoute, /eq\(householdAuditEventsTable\.action, parsed\.data\.action\)/);
  assert.match(householdRoute, /eq\(householdAuditEventsTable\.lifecycleState, parsed\.data\.lifecycleState\)/);
  assert.match(householdRoute, /desc\(householdAuditEventsTable\.createdAt\)/);

  assert.match(openapi, /\/household\/audit-events:/);
  assert.match(openapi, /operationId: listHouseholdAuditEvents/);
  assert.match(openapi, /name: lifecycleState[\s\S]*schema:[\s\S]*type: string/);
  assert.match(openapi, /maximum: 200/);
  assert.match(openapi, /#\/components\/schemas\/HouseholdAuditEvent/);
  assert.match(zodApi, /export const ListHouseholdAuditEventsQueryParams/);
  assert.match(zodApi, /"limit": zod\.coerce\.number\(\)\.min\(1\)\.max\(200\)\.optional\(\)/);
  assert.match(zodApi, /export const ListHouseholdAuditEventsResponse/);
  assert.match(reactClient, /getListHouseholdAuditEventsUrl/);
  assert.match(reactClient, /useListHouseholdAuditEvents/);
  assert.match(reactSchemas, /export interface HouseholdAuditEvent/);
  assert.match(reactSchemas, /export type ListHouseholdAuditEventsParams/);
});

test("keeps household member role updates owner scoped and audited", () => {
  const householdRoute = readApiFile(join("routes", "household.ts"));
  const openapi = readFileSync(join(root, "lib", "api-spec", "openapi.yaml"), "utf8");
  const zodApi = readFileSync(join(root, "lib", "api-zod", "src", "generated", "api.ts"), "utf8");
  const reactClient = readFileSync(join(root, "lib", "api-client-react", "src", "generated", "api.ts"), "utf8");
  const reactSchemas = readFileSync(
    join(root, "lib", "api-client-react", "src", "generated", "api.schemas.ts"),
    "utf8",
  );

  assert.match(householdRoute, /UpdateHouseholdMemberParams\.safeParse\(req\.params\)/);
  assert.match(householdRoute, /UpdateHouseholdMemberBody\.safeParse\(req\.body\)/);
  assert.match(householdRoute, /router\.patch\("\/household\/members\/:memberId"/);
  assert.match(householdRoute, /requireActiveHouseholdRole\(userId, \["owner", "admin"\]\)/);
  assert.match(householdRoute, /res\.status\(403\)\.json\(\{ error: "Only household owners can update member roles" \}\)/);
  assert.match(
    householdRoute,
    /eq\(householdMembersTable\.id, params\.data\.memberId\)[\s\S]*eq\(householdMembersTable\.householdId, householdId\)/,
  );
  assert.match(householdRoute, /res\.status\(404\)\.json\(\{ error: "Household member not found" \}\)/);
  assert.match(householdRoute, /res\.status\(400\)\.json\(\{ error: "Owners cannot be demoted from the pack" \}\)/);
  assert.match(householdRoute, /\.update\(householdMembersTable\)[\s\S]*role: parsed\.data\.role/);
  assert.match(householdRoute, /action: "household\.member_role_changed"/);
  assert.match(householdRoute, /previousRole: member\.role/);
  assert.match(householdRoute, /newRole: parsed\.data\.role/);
  assert.match(householdRoute, /targetId: member\.id/);

  assert.match(openapi, /\/household\/members\/\{memberId\}:/);
  assert.match(openapi, /operationId: updateHouseholdMember/);
  assert.match(openapi, /HouseholdMemberUpdate/);
  assert.match(openapi, /enum: \[admin, member, sitter, trainer, vet_viewer\]/);
  assert.match(zodApi, /export const UpdateHouseholdMemberParams/);
  assert.match(zodApi, /export const UpdateHouseholdMemberBody/);
  assert.match(zodApi, /zod\.enum\(\["admin", "member", "sitter", "trainer", "vet_viewer"\]\)/);
  assert.match(reactClient, /getUpdateHouseholdMemberUrl/);
  assert.match(reactClient, /updateHouseholdMember/);
  assert.match(reactSchemas, /export interface UpdateHouseholdMemberBody/);
  assert.match(reactSchemas, /role: 'admin' \| 'member' \| 'sitter' \| 'trainer' \| 'vet_viewer'/);
});

test("keeps sensitive household actions writing durable audit events", () => {
  const householdRoute = readApiFile(join("routes", "household.ts"));
  const householdLib = readApiFile(join("lib", "household.ts"));

  assert.match(householdLib, /export async function logHouseholdAuditEvent/);
  assert.match(householdLib, /householdAuditEventsTable/);
  assert.match(householdLib, /\.insert\(householdAuditEventsTable\)/);
  assert.match(householdLib, /action: "household\.created"/);

  assert.match(householdRoute, /logHouseholdAuditEvent/);
  assert.match(householdRoute, /action: "household\.renamed"/);
  assert.match(householdRoute, /targetType: "household"/);
  assert.match(householdRoute, /targetId: householdId/);
  assert.match(householdRoute, /newName: parsed\.data\.name/);

  assert.match(householdRoute, /action: "household\.active_changed"/);
  assert.match(householdRoute, /targetId: parsed\.data\.householdId/);
  assert.match(householdRoute, /selectedHouseholdId: parsed\.data\.householdId/);

  assert.match(householdRoute, /action: "household\.member_joined"/);
  assert.match(householdRoute, /targetType: "member"/);
  assert.match(householdRoute, /targetId: userId/);
  assert.match(householdRoute, /membershipCreated: !inThisHousehold/);
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

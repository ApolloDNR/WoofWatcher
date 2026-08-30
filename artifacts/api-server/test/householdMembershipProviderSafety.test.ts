import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");
}

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function operation(source: string, operationId: string): string {
  const start = `      operationId: ${operationId}`;
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing OpenAPI ${operationId}`);
  const nextPath = source.indexOf("\n  /", startIndex);
  return source.slice(startIndex, nextPath === -1 ? undefined : nextPath);
}

test("the shipping provider adapter uses one DB clock and exact locked authority boundaries", () => {
  const source = read(
    "artifacts/api-server/src/lib/household-membership-drizzle-store.ts",
  );
  const casBlock = section(
    source,
    "export function buildActiveHouseholdCasQuery",
    "/**\n * Builds the shipping transaction adapter",
  );
  const listBlock = section(
    source,
    "async listMemberships(userId)",
    "async lockTargetMembership",
  );
  const targetBlock = section(
    source,
    "async lockTargetMembership(userId, householdId)",
    "async compareAndSetActiveHousehold",
  );
  const commitBlock = section(
    source,
    "async compareAndSetActiveHousehold(activation)",
    "async ensureCareState",
  );
  const snapshotBlock = section(
    source,
    "async buildExactMeSnapshot(userId, householdId)",
    "return work(adapter)",
  );

  assert.match(source, /getCurrentTime[\s\S]*clock_timestamp\(\)/);
  assert.match(listBlock, /eq\(householdMembersTable\.userId, userId\)/);
  assert.match(listBlock, /\.for\("share"\)/);
  assert.match(targetBlock, /eq\(householdMembersTable\.userId, userId\)/);
  assert.match(
    targetBlock,
    /eq\(householdMembersTable\.householdId, householdId\)/,
  );
  assert.match(targetBlock, /\.for\("update"\)/);

  for (const exactAuthority of [
    /householdMembersTable\.id[^\n]+activation\.membershipId/,
    /householdMembersTable\.userId[^\n]+activation\.userId/,
    /householdMembersTable\.householdId[^\n]+activation\.targetHouseholdId/,
    /usersTable\.activeHouseholdId[\s\S]*activation\.expectedSourceHouseholdId/,
  ]) {
    assert.match(casBlock, exactAuthority);
  }
  assert.match(
    casBlock,
    /lower\(btrim\(regexp_replace\(\$\{householdMembersTable\.role\}/,
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
    assert.match(casBlock, new RegExp(`'${role}'`), role);
  }
  assert.match(casBlock, /accessPassExpiresAt[^\n]+> clock_timestamp\(\)/);
  assert.match(casBlock, /\.returning\(\{ id: usersTable\.id \}\)/);
  assert.match(commitBlock, /buildActiveHouseholdCasQuery/);
  assert.match(
    source,
    /const \{ buildMeInTransaction \} = await import\("\.\/household\.ts"\);[\s\S]{0,160}return buildMeInTransaction\(transaction, userId, householdId\);/,
    "The production default must reuse the existing transaction through buildMeInTransaction",
  );
  assert.match(
    snapshotBlock,
    /exactMeBuilder\(transaction, userId, householdId\)/,
  );
});

test("the production router is mounted and keeps capability parsing ahead of list/body work", () => {
  const indexSource = read("artifacts/api-server/src/routes/index.ts");
  const routerSource = read(
    "artifacts/api-server/src/routes/household-membership-router.ts",
  );
  assert.match(indexSource, /router\.use\(householdMembershipRouter\)/);

  const listBlock = section(routerSource, "router.get(", "router.post(");
  const activationBlock = section(
    routerSource,
    "router.post(",
    "return router;",
  );
  assert.ok(
    listBlock.indexOf("parseExpectedHouseholdCapability(req, res)") <
      listBlock.indexOf("dependencies.listMemberships"),
  );
  assert.ok(
    activationBlock.indexOf("parseExpectedHouseholdCapability(req, res)") <
      activationBlock.indexOf("ActivateHouseholdBody.safeParse"),
  );
  assert.ok(
    activationBlock.indexOf("ActivateHouseholdBody.safeParse") <
      activationBlock.indexOf("dependencies.activateMembership"),
  );
  assert.doesNotMatch(
    activationBlock,
    /dependencies\.buildMe/,
    "Activation must return the Exact Me captured by its mutation transaction, not open a second snapshot transaction",
  );

  const compositionSource = read(
    "artifacts/api-server/src/routes/household-memberships.ts",
  );
  assert.doesNotMatch(
    compositionSource,
    /\bbuildMe\b/,
    "The production activation router must not expose a post-commit Me builder",
  );
});

test("OpenAPI and generated clients expose only the exact retained-household contract", () => {
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodPublicIndex = read("lib/api-zod/src/index.ts");

  const listOperation = operation(openapi, "listMyHouseholdMemberships");
  const activateOperation = operation(openapi, "activateHousehold");
  for (const block of [listOperation, activateOperation]) {
    assert.match(block, /ExpectedHouseholdId/);
    assert.match(block, /"409":/);
    assert.match(block, /"412":/);
    assert.match(block, /"428":/);
  }
  assert.match(activateOperation, /"400":/);
  assert.match(activateOperation, /"403":/);

  const safeSchema = section(
    openapi,
    "    MyHouseholdMembership:",
    "    MyHouseholdMembershipList:",
  );
  assert.doesNotMatch(safeSchema, /invite|email|userId|memberId|audit/i);
  assert.match(safeSchema, /required:[\s\S]*accessPassExpiresAt/);

  assert.match(
    reactClient,
    /listMyHouseholdMemberships = async \(\s*headers: ListMyHouseholdMembershipsHeaders,\s*options\?: RequestInit,\s*\)/,
  );
  assert.match(
    reactClient,
    /activateHousehold = async \(\s*householdActivationInput: HouseholdActivationInput,\s*headers: ActivateHouseholdHeaders,\s*options\?: RequestInit,\s*\)/,
  );
  assert.match(
    reactClient,
    /useListMyHouseholdMembershipsQueryOptions[\s\S]*?buildHouseholdQueryKey\(\s*\{ headers \},\s*\{ url: `\/api\/household\/memberships`/,
    "the generated default membership-list key must be partitioned by exact household identity",
  );
  assert.match(reactSchemas, /interface MyHouseholdMembershipList/);
  assert.match(reactSchemas, /accessPassExpiresAt: string \| null/);
  const membershipListResponse = section(
    zodApi,
    "export const ListMyHouseholdMemberships200Response =",
    "export const ListMyHouseholdMemberships401Response =",
  );
  assert.match(
    membershipListResponse,
    /export const ListMyHouseholdMemberships200Response = zod\.object\(/,
    "the shipping membership-list success validator must be the exact generated 200 response",
  );
  assert.match(
    membershipListResponse,
    /activeHouseholdId:\s*zod\.string\(\)\.uuid\(\)[\s\S]*memberships:\s*zod\.array\(\s*zod\.object\(/,
    "the shipping membership-list 200 validator must require the active household and membership collection",
  );
  assert.match(
    membershipListResponse,
    /householdId:\s*zod\.string\(\)\.uuid\(\),\s*householdName:\s*zod\.string\(\)\.min\(1\)/,
    "the shipping membership-list 200 validator must constrain retained household identity and name",
  );
  assert.match(
    membershipListResponse,
    /role:\s*zod\s*\.enum\(\s*\[\s*"owner",\s*"adult",\s*"teen",\s*"kid",\s*"sitter",\s*"trainer",\s*"walker",\s*"vet viewer",?\s*\]\s*\)/,
    "the shipping membership-list 200 validator must use the exact canonical role set",
  );
  assert.match(
    membershipListResponse,
    /accessPassExpiresAt:\s*zod\.coerce\s*\.date\(\)\s*\.nullable\(\)/,
    "the shipping membership-list 200 validator must preserve nullable Access Pass expiry",
  );
  assert.match(
    zodPublicIndex,
    /ListMyHouseholdMemberships200Response as ListMyHouseholdMembershipsResponse/,
    "the server compatibility name must resolve to the exact membership-list 200 validator",
  );
  assert.match(zodApi, /export const ActivateHouseholdBody/);
  assert.match(zodApi, /export const ActivateHousehold200Response/);
  assert.match(
    zodPublicIndex,
    /ActivateHousehold200Response as ActivateHouseholdResponse/,
  );
  for (const [generatedName, compatibilityName, maxConstant] of [
    ["GetMe200Response", "GetMeResponse", "getMe200ResponseHouseholdInviteCodeMax"],
    ["UpdateMe200Response", "UpdateMeResponse", "updateMe200ResponseHouseholdInviteCodeMax"],
    ["UpdateHousehold200Response", "UpdateHouseholdResponse", "updateHousehold200ResponseHouseholdInviteCodeMax"],
  ] as const) {
    assert.match(
      zodApi,
      new RegExp(`export const ${maxConstant} = 0;`),
      `${generatedName} must emit the exact generated zero-length invitation constant`,
    );
    assert.match(
      section(
        zodApi,
        `export const ${generatedName} =`,
        "\n\nexport const",
      ),
      new RegExp(
        `inviteCode:\\s*zod\\s*\\.string\\(\\)\\s*\\.max\\(${maxConstant}\\)`,
      ),
      `${generatedName} must reject any legacy permanent invitation credential through its generated zero-length constant`,
    );
    assert.match(
      zodPublicIndex,
      new RegExp(`\\b${generatedName} as ${compatibilityName}\\b`),
      `${compatibilityName} must resolve to the exact generated success validator`,
    );
  }
});

test("the generated Zod type barrel never exports missing files", () => {
  const directory = join(root, "lib/api-zod/src/generated/types");
  const indexSource = read("lib/api-zod/src/generated/types/index.ts");
  const generatedExports = [
    ...indexSource.matchAll(/from ["']\.\/(.+)["']/g),
  ].map((match) => match[1]);
  assert.ok(
    generatedExports.length > 0,
    "the generated type barrel guard must inspect at least one export",
  );
  const missing = generatedExports
    .filter((name) => !existsSync(join(directory, `${name}.ts`)));
  assert.deepEqual(missing, []);
});

test("provider migration canonicalizes every supported legacy role and repairs unsafe active pointers", () => {
  const migration = read(
    "supabase/migrations/0006_household_role_canonicalization.sql",
  );
  const schema = read("lib/db/src/schema/householdMembers.ts");
  for (const [legacy, canonical] of [
    ["admin", "owner"],
    ["adult admin", "owner"],
    ["member", "adult"],
    ["primary caregiver", "adult"],
    ["child", "kid"],
    ["minor", "kid"],
    ["helper", "sitter"],
    ["temporary helper", "sitter"],
    ["viewer", "vet viewer"],
    ["vet", "vet viewer"],
    ["veterinary viewer", "vet viewer"],
    ["read-only", "vet viewer"],
    ["readonly", "vet viewer"],
  ] as const) {
    assert.match(migration, new RegExp(`when '${legacy}' then '${canonical}'`));
  }
  assert.match(migration, /alter column role set default 'adult'/);
  assert.match(
    migration,
    /check \(role in \('owner', 'adult', 'teen', 'kid', 'sitter', 'trainer', 'walker', 'vet viewer'\)\)/,
  );
  assert.match(
    migration,
    /active_household_id[\s\S]*access_pass_expires_at > statement_timestamp\(\)/,
  );
  assert.match(migration, /distinct on \(member\.user_id\)/);
  assert.match(schema, /role: text\("role"\)\.notNull\(\)\.default\("adult"\)/);
  assert.doesNotMatch(schema, /\.default\("member"\)/);
});

test("provider role migration replaces a weaker same-name constraint with the exact canonical check", () => {
  const migration = read(
    "supabase/migrations/0006_household_role_canonicalization.sql",
  );
  const constraintName = "household_members_role_canonical_check";
  const providerFixture = new Map([[constraintName, "check (true)"]]);
  const dropAt = migration.indexOf(
    `drop constraint if exists ${constraintName}`,
  );
  const addAt = migration.indexOf(`add constraint ${constraintName}`);
  assert.ok(dropAt >= 0 && dropAt < addAt);

  providerFixture.delete(constraintName);
  const replacement = migration
    .slice(addAt, migration.indexOf("not valid", addAt))
    .replace(/\s+/g, " ")
    .trim();
  providerFixture.set(constraintName, replacement);

  assert.equal(
    providerFixture.get(constraintName),
    "add constraint household_members_role_canonical_check check (role in ('owner', 'adult', 'teen', 'kid', 'sitter', 'trainer', 'walker', 'vet viewer'))",
  );
  assert.notEqual(providerFixture.get(constraintName), "check (true)");
});

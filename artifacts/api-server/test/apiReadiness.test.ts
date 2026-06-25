import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function section(source: string, start: string, end: string): string {
  const normalized = source.replace(/\r\n/g, "\n");
  const startIndex = normalized.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start.trim()}`);
  const endIndex = normalized.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end.trim()}`);
  return normalized.slice(startIndex, endIndex);
}

test("OpenAPI and generated clients cover WoofGuide events and Avatar Studio API routes", () => {
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSchemas = read("lib/api-client-react/src/generated/api.schemas.ts");
  const zodSchemas = read("lib/api-zod/src/generated/api.ts");
  const zodTypesIndex = read("lib/api-zod/src/generated/types/index.ts");

  for (const route of ["/woofguide-events", "/avatar-stylize", "/avatar-emotions"]) {
    assert.match(openapi, new RegExp(`^  ${route}:`, "m"), `${route} is missing from OpenAPI`);
  }

  for (const operation of [
    "getWoofguideEventsStatus",
    "createWoofguideEvents",
    "stylizeAvatar",
    "createAvatarEmotions",
  ]) {
    assert.match(reactClient, new RegExp(`\\b${operation}\\b`), `${operation} is missing from the React API client`);
  }

  for (const schema of [
    "WoofguideEventsStatus",
    "WoofguideEventsInput",
    "WoofguideEventsResponse",
    "AvatarStylizeInput",
    "AvatarStylizeResponse",
    "AvatarEmotionsInput",
    "AvatarEmotionsResponse",
  ]) {
    assert.match(reactSchemas, new RegExp(`\\b${schema}\\b`), `${schema} is missing from generated API types`);
    assert.match(zodTypesIndex, new RegExp(schema[0].toLowerCase() + schema.slice(1)), `${schema} is missing from generated Zod type exports`);
  }

  for (const validator of [
    "GetWoofguideEventsStatusResponse",
    "CreateWoofguideEventsBody",
    "CreateWoofguideEventsResponse",
    "StylizeAvatarBody",
    "StylizeAvatarResponse",
    "CreateAvatarEmotionsBody",
    "CreateAvatarEmotionsResponse",
  ]) {
    assert.match(zodSchemas, new RegExp(`\\b${validator}\\b`), `${validator} is missing from generated Zod schemas`);
  }
});

test("root focused tests include API readiness so backend contracts do not drift silently", () => {
  const packageJson = read("package.json");

  assert.match(
    packageJson,
    /artifacts\/api-server\/test\/\*\.test\.ts/,
    "package.json test:focused must run API readiness tests",
  );
});

test("care entries list limit query stays documented and typed", () => {
  const route = read("artifacts/api-server/src/routes/care-entries.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactSchemas = read("lib/api-client-react/src/generated/api.schemas.ts");
  const zodSchemas = read("lib/api-zod/src/generated/api.ts");
  const zodTypes = read("lib/api-zod/src/generated/types/listCareEntriesParams.ts");

  assert.match(route, /req\.query\.limit/, "care-entries route should still read the limit query");
  assert.match(openapi, /name:\s+limit/, "OpenAPI must document the care-entries limit query");
  assert.match(reactSchemas, /limit\?:\s*number/, "React API client must type the care-entries limit query");
  assert.match(zodTypes, /limit\?:\s*number/, "Zod generated param types must type the care-entries limit query");
  assert.match(zodSchemas, /"limit":\s*zod\.number\(\)/, "Zod generated validator must validate the care-entries limit query");
});

test("care state write errors stay documented and typed", () => {
  const route = read("artifacts/api-server/src/routes/care-state.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const putCareStateBlock = openapi.match(/    put:\r?\n[\s\S]*?  \/care-entries:/)?.[0] ?? "";

  assert.match(route, /res\.status\(400\)/, "care-state PUT should still return validation errors");
  assert.match(route, /res\.status\(404\)/, "care-state PUT should still return missing document errors");
  assert.match(route, /res\.status\(409\)/, "care-state PUT should still return optimistic conflict envelopes");
  assert.match(putCareStateBlock, /"400":/, "OpenAPI must document invalid care-state payload errors");
  assert.match(putCareStateBlock, /"404":/, "OpenAPI must document missing care-state document errors");
  assert.match(putCareStateBlock, /"409":/, "OpenAPI must document stale care-state write conflicts");
  assert.match(
    reactClient,
    /getPutCareStateMutationOptions = <TError = ErrorType<ApiError \| CareStateEnvelope>/,
    "React API mutation must type care-state write errors as ApiError or conflict envelope",
  );
  assert.match(
    reactClient,
    /PutCareStateMutationError = ErrorType<ApiError \| CareStateEnvelope>/,
    "React API mutation error alias must preserve validation/not-found and conflict response shapes",
  );
});

test("care entry write errors stay documented and typed", () => {
  const route = read("artifacts/api-server/src/routes/care-entries.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const createBlock = section(
    openapi,
    "    post:\n      operationId: createCareEntry",
    "  /care-entries/{id}:",
  );
  const updateBlock = section(
    openapi,
    "    patch:\n      operationId: updateCareEntry",
    "    delete:\n      operationId: deleteCareEntry",
  );
  const deleteBlock = section(
    openapi,
    "    delete:\n      operationId: deleteCareEntry",
    "\ncomponents:",
  );

  assert.match(route, /CreateCareEntryBody\.safeParse/, "care-entry create should still validate request bodies");
  assert.match(route, /UpdateCareEntryParams\.safeParse/, "care-entry update should still validate route params");
  assert.match(route, /UpdateCareEntryBody\.safeParse/, "care-entry update should still validate request bodies");
  assert.match(route, /DeleteCareEntryParams\.safeParse/, "care-entry delete should still validate route params");
  assert.match(createBlock, /"400":/, "OpenAPI must document invalid create-care-entry payload errors");
  assert.match(updateBlock, /"400":/, "OpenAPI must document invalid update-care-entry payload or param errors");
  assert.match(updateBlock, /"404":/, "OpenAPI must keep documenting update-care-entry not-found errors");
  assert.match(deleteBlock, /"400":/, "OpenAPI must document invalid delete-care-entry param errors");
  assert.match(deleteBlock, /"404":/, "OpenAPI must keep documenting delete-care-entry not-found errors");
  assert.match(
    reactClient,
    /getCreateCareEntryMutationOptions = <TError = ErrorType<ApiError>/,
    "React API create mutation must type validation errors as ApiError",
  );
  assert.match(
    reactClient,
    /CreateCareEntryMutationError = ErrorType<ApiError>/,
    "React API create mutation error alias must expose validation error bodies",
  );
  assert.match(
    reactClient,
    /UpdateCareEntryMutationError = ErrorType<ApiError>/,
    "React API update mutation error alias must preserve invalid and not-found error bodies",
  );
  assert.match(
    reactClient,
    /DeleteCareEntryMutationError = ErrorType<ApiError>/,
    "React API delete mutation error alias must preserve invalid and not-found error bodies",
  );
});

test("household provisioning and auth errors stay documented and typed", () => {
  const route = read("artifacts/api-server/src/routes/household.ts");
  const auth = read("artifacts/api-server/src/lib/auth.ts");
  const household = read("artifacts/api-server/src/lib/household.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const getMeBlock = section(
    openapi,
    "    get:\n      operationId: getMe",
    "    patch:\n      operationId: updateMe",
  );
  const updateMeBlock = section(
    openapi,
    "    patch:\n      operationId: updateMe",
    "  /household:",
  );
  const updateHouseholdBlock = section(
    openapi,
    "    patch:\n      operationId: updateHousehold",
    "  /household/join:",
  );
  const joinHouseholdBlock = section(
    openapi,
    "    post:\n      operationId: joinHousehold",
    "  /care-state:",
  );

  assert.match(auth, /res\.status\(401\)\.json\(\{ error: "Unauthorized" \}\)/, "requireAuth should return ApiError-shaped 401 bodies");
  assert.match(household, /default household \+ membership \+ care state/, "household provisioning should keep first-login care-state bootstrap documented");
  assert.match(route, /router\.get\("\/me", requireAuth/, "getMe must stay authenticated");
  assert.match(route, /router\.patch\("\/me", requireAuth/, "updateMe must stay authenticated");
  assert.match(route, /router\.patch\("\/household", requireAuth/, "updateHousehold must stay authenticated");
  assert.match(route, /router\.post\("\/household\/join", requireAuth/, "joinHousehold must stay authenticated");
  assert.match(route, /UpdateMeBody\.safeParse/, "updateMe should still validate profile payloads");
  assert.match(route, /UpdateHouseholdBody\.safeParse/, "updateHousehold should still validate household payloads");
  assert.match(route, /JoinHouseholdBody\.safeParse/, "joinHousehold should still validate invite payloads");
  assert.match(route, /Invite code not found/, "joinHousehold must keep the owner-readable missing-invite error");
  assert.match(getMeBlock, /"401":/, "OpenAPI must document unauthenticated getMe errors");
  assert.match(updateMeBlock, /"400":/, "OpenAPI must document invalid profile update payload errors");
  assert.match(updateMeBlock, /"401":/, "OpenAPI must document unauthenticated profile update errors");
  assert.match(updateHouseholdBlock, /"400":/, "OpenAPI must document invalid household update payload errors");
  assert.match(updateHouseholdBlock, /"401":/, "OpenAPI must document unauthenticated household update errors");
  assert.match(joinHouseholdBlock, /"400":/, "OpenAPI must document invalid invite payload errors");
  assert.match(joinHouseholdBlock, /"401":/, "OpenAPI must document unauthenticated join errors");
  assert.match(joinHouseholdBlock, /"404":/, "OpenAPI must keep documenting missing invite errors");
  assert.match(
    reactClient,
    /getGetMeQueryOptions = <TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<ApiError>>/,
    "React API getMe query must type auth errors as ApiError",
  );
  assert.match(
    reactClient,
    /GetMeQueryError = ErrorType<ApiError>/,
    "React API getMe query error alias must expose auth error bodies",
  );
  assert.match(
    reactClient,
    /getUpdateMeMutationOptions = <TError = ErrorType<ApiError>/,
    "React API updateMe mutation must type validation/auth errors as ApiError",
  );
  assert.match(
    reactClient,
    /UpdateMeMutationError = ErrorType<ApiError>/,
    "React API updateMe mutation error alias must expose validation/auth error bodies",
  );
  assert.match(
    reactClient,
    /getUpdateHouseholdMutationOptions = <TError = ErrorType<ApiError>/,
    "React API updateHousehold mutation must type validation/auth errors as ApiError",
  );
  assert.match(
    reactClient,
    /UpdateHouseholdMutationError = ErrorType<ApiError>/,
    "React API updateHousehold mutation error alias must expose validation/auth error bodies",
  );
  assert.match(
    reactClient,
    /JoinHouseholdMutationError = ErrorType<ApiError>/,
    "React API joinHousehold mutation error alias must preserve invalid/auth/not-found error bodies",
  );
});

test("WoofGuide provider actions keep auth, rate-limit, and local-fallback contracts typed", () => {
  const careHelperRoute = read("artifacts/api-server/src/routes/care-helper.ts");
  const woofguideEventsRoute = read("artifacts/api-server/src/routes/woofguide-events.ts");
  const woofguideEvents = read("artifacts/api-server/src/woofguide-events.js");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const careHelperPostBlock = section(
    openapi,
    "    post:\n      operationId: askCareHelper",
    "  /woofguide-events:",
  );
  const woofguideEventsGetBlock = section(
    openapi,
    "    get:\n      operationId: getWoofguideEventsStatus",
    "    post:\n      operationId: createWoofguideEvents",
  );
  const woofguideEventsPostBlock = section(
    openapi,
    "    post:\n      operationId: createWoofguideEvents",
    "  /avatar-stylize:",
  );

  assert.match(careHelperRoute, /router\.post\("\/care-helper", requireAuth/, "care-helper questions must stay authenticated");
  assert.match(careHelperRoute, /makeRateLimiter\(\{ maxPerWindow: 12, globalMaxPerWindow: 120 \}\)/, "care-helper provider calls must keep their rate limiter");
  assert.match(careHelperRoute, /if \(ai && rateLimited\(ip\)\)/, "care-helper should rate-limit provider calls without blocking local fallback");
  assert.match(careHelperRoute, /mode:\s*"local"/, "care-helper must keep the local fallback mode truthful");
  assert.match(careHelperRoute, /AI assistant isn't available/, "care-helper local fallback should not imply live AI");

  assert.match(woofguideEventsRoute, /router\.get\("\/woofguide-events", requireAuth/, "WoofGuide events status must stay authenticated");
  assert.match(woofguideEventsRoute, /router\.post\("\/woofguide-events", requireAuth/, "WoofGuide event creation must stay authenticated");
  assert.match(woofguideEventsRoute, /makeRateLimiter\(\{ maxPerWindow: 8, globalMaxPerWindow: 60 \}\)/, "WoofGuide event creation must keep its rate limiter");
  assert.match(woofguideEvents, /No key configured: always return curated local events/, "WoofGuide events must keep the no-key local curation boundary");
  assert.match(woofguideEvents, /mode:\s*"local"/, "WoofGuide events must keep local mode when provider calls are unavailable");

  assert.match(careHelperPostBlock, /"401":/, "OpenAPI must document unauthenticated care-helper question errors");
  assert.match(careHelperPostBlock, /"429":/, "OpenAPI must document care-helper provider rate-limit errors");
  assert.doesNotMatch(careHelperPostBlock, /"501":/, "OpenAPI must not claim local fallback is an unconfigured-provider failure");
  assert.match(woofguideEventsGetBlock, /"401":/, "OpenAPI must document unauthenticated WoofGuide events status errors");
  assert.match(woofguideEventsPostBlock, /"401":/, "OpenAPI must document unauthenticated WoofGuide event creation errors");
  assert.match(woofguideEventsPostBlock, /"429":/, "OpenAPI must document WoofGuide event creation rate-limit errors");

  assert.match(
    reactClient,
    /getAskCareHelperMutationOptions = <TError = ErrorType<ApiError \| CareHelperError>/,
    "React API care-helper mutation must type auth/rate-limit errors separately from provider failures",
  );
  assert.match(
    reactClient,
    /AskCareHelperMutationError = ErrorType<ApiError \| CareHelperError>/,
    "React API care-helper mutation error alias must expose auth, rate-limit, and provider error bodies",
  );
  assert.match(
    reactClient,
    /getGetWoofguideEventsStatusQueryOptions = <TData = Awaited<ReturnType<typeof getWoofguideEventsStatus>>, TError = ErrorType<ApiError>>/,
    "React API WoofGuide events status query must type auth errors as ApiError",
  );
  assert.match(
    reactClient,
    /GetWoofguideEventsStatusQueryError = ErrorType<ApiError>/,
    "React API WoofGuide events status error alias must expose auth error bodies",
  );
  assert.match(
    reactClient,
    /CreateWoofguideEventsMutationError = ErrorType<ApiError>/,
    "React API WoofGuide events creation must keep auth/rate-limit/provider errors typed as ApiError",
  );
});

test("care state and care entry routes keep household scoping documented and typed", () => {
  const careStateRoute = read("artifacts/api-server/src/routes/care-state.ts");
  const careEntriesRoute = read("artifacts/api-server/src/routes/care-entries.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const getCareStateBlock = section(
    openapi,
    "    get:\n      operationId: getCareState",
    "    put:\n      operationId: putCareState",
  );
  const putCareStateBlock = section(
    openapi,
    "    put:\n      operationId: putCareState",
    "  /care-entries:",
  );
  const listCareEntriesBlock = section(
    openapi,
    "    get:\n      operationId: listCareEntries",
    "    post:\n      operationId: createCareEntry",
  );
  const createCareEntryBlock = section(
    openapi,
    "    post:\n      operationId: createCareEntry",
    "  /care-entries/{id}:",
  );
  const updateCareEntryBlock = section(
    openapi,
    "    patch:\n      operationId: updateCareEntry",
    "    delete:\n      operationId: deleteCareEntry",
  );
  const deleteCareEntryBlock = section(
    openapi,
    "    delete:\n      operationId: deleteCareEntry",
    "\ncomponents:",
  );

  assert.match(careStateRoute, /router\.get\("\/care-state", requireAuth/, "care-state reads must stay authenticated");
  assert.match(careStateRoute, /router\.put\("\/care-state", requireAuth/, "care-state writes must stay authenticated");
  assert.match(careStateRoute, /const householdId = await getActiveHouseholdId\(userId\)/, "care-state should resolve the active household from the authenticated user");
  assert.match(careStateRoute, /where\(eq\(careStateTable\.householdId, householdId\)\)/, "care-state reads and writes must stay scoped to the active household");

  for (const route of [
    /router\.get\("\/care-entries", requireAuth/,
    /router\.post\("\/care-entries", requireAuth/,
    /router\.patch\("\/care-entries\/:id", requireAuth/,
    /router\.delete\(\s*"\x2Fcare-entries\/:id",\s*requireAuth/,
  ]) {
    assert.match(careEntriesRoute, route, "care-entry list/create/update/delete routes must stay authenticated");
  }
  assert.match(careEntriesRoute, /eq\(careEntriesTable\.householdId, householdId\)/, "care-entry queries and mutations must stay household-scoped");
  assert.match(careEntriesRoute, /householdId,\s*\n\s*petId:/, "care-entry creates must write the authenticated household id");
  assert.match(careEntriesRoute, /caregiverUserId:\s*userId/, "care-entry creates must preserve the authenticated caregiver id");

  assert.match(getCareStateBlock, /"401":/, "OpenAPI must document unauthenticated care-state reads");
  assert.match(getCareStateBlock, /"404":/, "OpenAPI must document missing active-household care-state reads");
  assert.match(putCareStateBlock, /"401":/, "OpenAPI must document unauthenticated care-state writes");
  assert.match(listCareEntriesBlock, /"401":/, "OpenAPI must document unauthenticated care-entry list reads");
  assert.match(createCareEntryBlock, /"401":/, "OpenAPI must document unauthenticated care-entry creates");
  assert.match(updateCareEntryBlock, /"401":/, "OpenAPI must document unauthenticated care-entry updates");
  assert.match(deleteCareEntryBlock, /"401":/, "OpenAPI must document unauthenticated care-entry deletes");

  assert.match(
    reactClient,
    /getGetCareStateQueryOptions = <TData = Awaited<ReturnType<typeof getCareState>>, TError = ErrorType<ApiError>>/,
    "React API care-state query must type auth and not-found errors as ApiError",
  );
  assert.match(
    reactClient,
    /GetCareStateQueryError = ErrorType<ApiError>/,
    "React API care-state query error alias must expose auth and not-found error bodies",
  );
  assert.match(
    reactClient,
    /getListCareEntriesQueryOptions = <TData = Awaited<ReturnType<typeof listCareEntries>>, TError = ErrorType<ApiError>>/,
    "React API care-entry list query must type auth errors as ApiError",
  );
  assert.match(
    reactClient,
    /ListCareEntriesQueryError = ErrorType<ApiError>/,
    "React API care-entry list query error alias must expose auth error bodies",
  );
});

test("care entry writes keep role-aware trust and read-only boundaries", () => {
  const careEntriesRoute = read("artifacts/api-server/src/routes/care-entries.ts");
  const householdLib = read("artifacts/api-server/src/lib/household.ts");
  const rolePolicy = read("artifacts/api-server/src/lib/care-entry-authorization.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const createCareEntryBlock = section(
    openapi,
    "    post:\n      operationId: createCareEntry",
    "  /care-entries/{id}:",
  );
  const updateCareEntryBlock = section(
    openapi,
    "    patch:\n      operationId: updateCareEntry",
    "    delete:\n      operationId: deleteCareEntry",
  );
  const deleteCareEntryBlock = section(
    openapi,
    "    delete:\n      operationId: deleteCareEntry",
    "\ncomponents:",
  );

  assert.match(
    householdLib,
    /export async function getHouseholdMemberAuthz/,
    "household auth should expose the authenticated member role for write policy checks",
  );
  assert.match(
    careEntriesRoute,
    /getHouseholdMemberAuthz\(householdId, userId\)/,
    "care-entry writes should resolve the authenticated member before applying write policy",
  );
  assert.match(
    careEntriesRoute,
    /applyCareEntryWritePolicy\(/,
    "care-entry create/update routes should pass details through the role-aware trust policy",
  );
  assert.match(
    careEntriesRoute,
    /assertCareEntryWriteAllowed\(/,
    "care-entry delete routes should still enforce read-only helper boundaries",
  );
  assert.match(
    careEntriesRoute,
    /res\.status\(403\)\.json\(\{ error: policy\.reason \}\)/,
    "care-entry writes should return ApiError-shaped 403 bodies when a role is not allowed",
  );

  assert.match(rolePolicy, /read-only/i, "role policy should define read-only helper boundaries");
  assert.match(rolePolicy, /vet viewer/i, "role policy should name vet viewer as read-only");
  assert.match(rolePolicy, /kid-log/, "role policy should keep kid logs pending adult confirmation");
  assert.match(rolePolicy, /helper-log/, "role policy should keep sitter and trainer logs pending adult confirmation");
  assert.match(rolePolicy, /safety-critical/, "role policy should keep medication and serious health logs adult-reviewable");
  assert.match(rolePolicy, /photoProofPolicy:\s*"medication-proof"/, "medication writes should keep proof policy metadata");
  assert.match(rolePolicy, /trustState:\s*"pending-confirmation"/, "restricted or serious logs should not be silently confirmed");

  assert.match(createCareEntryBlock, /"403":/, "OpenAPI must document forbidden care-entry creates for read-only roles");
  assert.match(updateCareEntryBlock, /"403":/, "OpenAPI must document forbidden care-entry updates for read-only roles");
  assert.match(deleteCareEntryBlock, /"403":/, "OpenAPI must document forbidden care-entry deletes for read-only roles");
  assert.match(
    reactClient,
    /CreateCareEntryMutationError = ErrorType<ApiError>/,
    "React API create mutation must keep role-policy errors typed as ApiError",
  );
  assert.match(
    reactClient,
    /UpdateCareEntryMutationError = ErrorType<ApiError>/,
    "React API update mutation must keep role-policy errors typed as ApiError",
  );
  assert.match(
    reactClient,
    /DeleteCareEntryMutationError = ErrorType<ApiError>/,
    "React API delete mutation must keep role-policy errors typed as ApiError",
  );
});

test("household member role mutations keep owner-only and revocation contracts", () => {
  const householdRoute = read("artifacts/api-server/src/routes/household.ts");
  const householdPolicy = read("artifacts/api-server/src/lib/household-authorization.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const reactSchemas = read("lib/api-client-react/src/generated/api.schemas.ts");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const memberBlock = section(
    openapi,
    "  /household/members/{id}:",
    "  /care-state:",
  );

  assert.match(
    householdRoute,
    /router\.patch\("\/household\/members\/:id", requireAuth/,
    "household member role updates should be authenticated",
  );
  assert.match(
    householdRoute,
    /router\.delete\(\s*"\/household\/members\/:id",\s*requireAuth/,
    "household member revocation should be authenticated",
  );
  assert.match(
    householdRoute,
    /UpdateHouseholdMemberParams\.safeParse/,
    "role updates should validate member ids",
  );
  assert.match(
    householdRoute,
    /UpdateHouseholdMemberBody\.safeParse/,
    "role updates should validate role payloads",
  );
  assert.match(
    householdRoute,
    /role === undefined && parsed\.data\.displayName === undefined/,
    "role updates should reject empty member patches instead of issuing no-op writes",
  );
  assert.match(
    householdRoute,
    /RevokeHouseholdMemberParams\.safeParse/,
    "revocation should validate member ids",
  );
  assert.match(
    householdRoute,
    /getHouseholdMemberAuthz\(householdId, userId\)/,
    "member mutations should resolve the authenticated actor role",
  );
  assert.match(
    householdRoute,
    /assertHouseholdMemberMutationAllowed\(/,
    "member mutations should use the owner/admin authorization policy",
  );
  assert.match(
    householdRoute,
    /eq\(householdMembersTable\.householdId, householdId\)/,
    "member mutations must stay scoped to the active household",
  );
  assert.match(
    householdRoute,
    /res\.status\(403\)\.json\(\{ error: policy\.reason \}\)/,
    "member mutations should return ApiError-shaped 403 bodies",
  );

  assert.match(householdPolicy, /owner\/admin/i, "role policy should name owner/admin-only authority");
  assert.match(householdPolicy, /Access Pass/i, "role policy should stay aligned with future Access Pass scopes");
  assert.match(householdPolicy, /helper revocation/i, "role policy should explicitly cover helper revocation");
  assert.match(householdPolicy, /vet viewer/i, "role policy should keep vet viewer as a managed read-only role");
  assert.match(householdPolicy, /targetIsSelf/, "role policy should prevent self-revocation or self-demotion");

  assert.match(memberBlock, /operationId: updateHouseholdMember/, "OpenAPI must document household member role updates");
  assert.match(memberBlock, /operationId: revokeHouseholdMember/, "OpenAPI must document household member revocation");
  assert.match(openapi, /HouseholdMemberUpdate:[\s\S]*enum: \[owner, adult, teen, kid, sitter, trainer, walker, vet viewer\]/, "OpenAPI must keep household role updates on canonical roles");
  for (const status of ['"400"', '"401"', '"403"', '"404"']) {
    assert.match(memberBlock, new RegExp(`${status}:`), `OpenAPI must document member mutation ${status} responses`);
  }
  assert.match(zodApi, /export const UpdateHouseholdMemberParams/, "Zod must export update-member params");
  assert.match(zodApi, /export const UpdateHouseholdMemberBody/, "Zod must export update-member body");
  assert.match(zodApi, /zod\.enum\(\["owner", "adult", "teen", "kid", "sitter", "trainer", "walker", "vet viewer"\]\)/, "Zod must reject unknown household roles");
  assert.match(zodApi, /export const RevokeHouseholdMemberParams/, "Zod must export revoke-member params");
  assert.match(reactSchemas, /role\?: HouseholdMemberRole/, "React schemas must expose typed household member roles");
  assert.match(
    reactClient,
    /UpdateHouseholdMemberMutationError = ErrorType<ApiError>/,
    "React API update-member mutation must expose ApiError",
  );
  assert.match(
    reactClient,
    /RevokeHouseholdMemberMutationError = ErrorType<ApiError>/,
    "React API revoke-member mutation must expose ApiError",
  );
});

test("household invitations and Access Pass mutations emit typed audit contracts", () => {
  const householdRoute = read("artifacts/api-server/src/routes/household.ts");
  const accessPassPolicy = read("artifacts/api-server/src/lib/household-access-pass.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const reactSchemas = read("lib/api-client-react/src/generated/api.schemas.ts");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const joinHouseholdBlock = section(
    openapi,
    "    post:\n      operationId: joinHousehold",
    "  /household/members/{id}:",
  );
  const activateBlock = section(
    openapi,
    "  /household/access-passes/activate:",
    "  /household/access-passes/revoke:",
  );
  const revokeBlock = section(
    openapi,
    "  /household/access-passes/revoke:",
    "  /care-state:",
  );

  assert.match(
    householdRoute,
    /JoinHouseholdResponse\.parse/,
    "invite acceptance should return the typed join payload with audit metadata",
  );
  assert.match(
    householdRoute,
    /buildHouseholdAuditEvent\(\{[\s\S]*action:\s*"invitation-accepted"/,
    "invite acceptance should emit a household audit event",
  );
  assert.match(
    householdRoute,
    /role:\s*nextMemberRole/,
    "invite acceptance should store the approved invitation role instead of legacy member",
  );
  assert.match(
    householdRoute,
    /router\.post\("\/household\/access-passes\/activate", requireAuth/,
    "Access Pass activation should be an authenticated route",
  );
  assert.match(
    householdRoute,
    /router\.post\("\/household\/access-passes\/revoke", requireAuth/,
    "Access Pass revocation should be an authenticated route",
  );
  assert.match(
    householdRoute,
    /AccessPassActivationBody\.safeParse/,
    "Access Pass activation should validate payloads",
  );
  assert.match(
    householdRoute,
    /AccessPassRevocationBody\.safeParse/,
    "Access Pass revocation should validate payloads",
  );
  assert.match(
    householdRoute,
    /assertAccessPassMutationAllowed\(/,
    "Access Pass routes should use owner/admin authorization policy",
  );
  assert.match(
    householdRoute,
    /normalizeAccessPassRole\(/,
    "Access Pass activation should normalize helper roles",
  );
  assert.match(
    householdRoute,
    /eq\(householdMembersTable\.householdId, householdId\)/,
    "Access Pass mutations must stay scoped to the active household",
  );
  assert.match(
    householdRoute,
    /res\.status\(403\)\.json\(\{ error: policy\.reason \}\)/,
    "Access Pass denials should use ApiError-shaped bodies",
  );
  assert.match(
    householdRoute,
    /buildHouseholdAuditEvent\(\{[\s\S]*action:\s*"access-pass-activated"/,
    "Access Pass activation should emit an audit event",
  );
  assert.match(
    householdRoute,
    /buildHouseholdAuditEvent\(\{[\s\S]*action:\s*"access-pass-revoked"/,
    "Access Pass revocation should emit an audit event",
  );

  assert.match(accessPassPolicy, /owner\/admin/i, "Access Pass policy should keep owner/admin-only authority explicit");
  assert.match(accessPassPolicy, /helper audit/i, "Access Pass policy should describe helper audit trail readiness");
  assert.match(accessPassPolicy, /invitation-accepted/, "audit helper should support invitation acceptance events");
  assert.match(accessPassPolicy, /access-pass-activated/, "audit helper should support activation events");
  assert.match(accessPassPolicy, /access-pass-revoked/, "audit helper should support revocation events");
  assert.match(accessPassPolicy, /vet viewer/i, "Access Pass policy should keep vet viewer as a read-only helper role");
  assert.match(accessPassPolicy, /expiresAt/, "Access Pass activation should carry optional expiration metadata for future enforcement");

  assert.match(joinHouseholdBlock, /HouseholdJoinResponse/, "OpenAPI join should return a typed audit-aware response");
  assert.match(joinHouseholdBlock, /HouseholdAuditEvent/, "OpenAPI join should document the invitation audit event");
  assert.match(activateBlock, /operationId: activateHouseholdAccessPass/, "OpenAPI must document Access Pass activation");
  assert.match(revokeBlock, /operationId: revokeHouseholdAccessPass/, "OpenAPI must document Access Pass revocation");
  for (const block of [activateBlock, revokeBlock]) {
    for (const status of ['"400"', '"401"', '"403"', '"404"']) {
      assert.match(block, new RegExp(`${status}:`), `OpenAPI must document Access Pass ${status} responses`);
    }
  }
  assert.match(openapi, /HouseholdAccessPassMutationResponse:/, "OpenAPI must document Access Pass mutation responses");
  assert.match(openapi, /HouseholdAuditEvent:/, "OpenAPI must document household audit events");

  for (const schema of [
    "HouseholdAuditEvent",
    "HouseholdJoinResponse",
    "AccessPassActivationBody",
    "AccessPassRevocationBody",
    "HouseholdAccessPassMutationResponse",
  ]) {
    assert.match(zodApi, new RegExp(`export const ${schema}`), `${schema} should be exported from Zod API schemas`);
  }
  assert.match(
    zodApi,
    /zod\.enum\(\["sitter", "trainer", "walker", "vet viewer"\]\)/,
    "Zod must constrain Access Pass activation to helper-compatible roles",
  );
  for (const typeName of [
    "HouseholdAuditEvent",
    "HouseholdJoinResponse",
    "AccessPassActivationInput",
    "AccessPassRevocationInput",
    "HouseholdAccessPassMutationResponse",
  ]) {
    assert.match(reactSchemas, new RegExp(`\\b${typeName}\\b`), `${typeName} should be exposed to React clients`);
  }
  assert.match(reactClient, /activateHouseholdAccessPass/, "React client must expose Access Pass activation");
  assert.match(reactClient, /revokeHouseholdAccessPass/, "React client must expose Access Pass revocation");
  assert.match(
    reactClient,
    /ActivateHouseholdAccessPassMutationError = ErrorType<ApiError>/,
    "React activation mutation must expose ApiError bodies",
  );
  assert.match(
    reactClient,
    /RevokeHouseholdAccessPassMutationError = ErrorType<ApiError>/,
    "React revocation mutation must expose ApiError bodies",
  );
});

test("household invite and Access Pass audit storage has provider-ready lifecycle contracts", () => {
  const householdRoute = read("artifacts/api-server/src/routes/household.ts");
  const accessPassPolicy = read("artifacts/api-server/src/lib/household-access-pass.ts");
  const auditSchema = read("lib/db/src/schema/householdAuditEvents.ts");
  const schemaIndex = read("lib/db/src/schema/index.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const reactSchemas = read("lib/api-client-react/src/generated/api.schemas.ts");

  assert.match(auditSchema, /pgTable\("household_audit_events"/, "database schema must define durable household audit events");
  assert.match(auditSchema, /lifecycleState:\s*text\("lifecycle_state"\)/, "audit rows must store invite/access-pass lifecycle state");
  assert.match(auditSchema, /expiresAt:\s*timestamp\("expires_at"/, "audit rows must store Access Pass expiration metadata");
  assert.match(auditSchema, /metadata:\s*jsonb\("metadata"\)/, "audit rows must preserve provider/export metadata");
  assert.match(schemaIndex, /export \* from "\.\/householdAuditEvents"/, "database schema index must export household audit events");

  assert.match(
    accessPassPolicy,
    /assertAccessPassExpiryAllowed/,
    "Access Pass helper policy must reject expired helper windows before activation",
  );
  assert.match(
    accessPassPolicy,
    /buildHouseholdAuditInsert/,
    "Access Pass helper policy must map audit events into provider-durable insert records",
  );
  assert.match(
    accessPassPolicy,
    /provider-durable/,
    "audit events should no longer be response-only once the durable schema exists",
  );
  assert.match(
    accessPassPolicy,
    /access-pass-expired/,
    "Access Pass lifecycle states must include expired access windows",
  );

  assert.match(
    householdRoute,
    /householdAuditEventsTable/,
    "household routes must import the durable household audit table",
  );
  assert.match(
    householdRoute,
    /db\.insert\(householdAuditEventsTable\)\.values\(buildHouseholdAuditInsert\(auditEvent\)\)/,
    "household mutations must persist audit events before returning them",
  );
  assert.match(
    householdRoute,
    /assertAccessPassExpiryAllowed\(parsed\.data\.expiresAt/,
    "Access Pass activation must enforce future expiration windows",
  );

  assert.match(openapi, /lifecycleState:/, "OpenAPI must expose household audit lifecycle state");
  assert.match(openapi, /provider-durable/, "OpenAPI must expose durable audit storage status");
  assert.match(openapi, /access-pass-expired/, "OpenAPI must expose expired Access Pass lifecycle state");
  assert.match(
    zodApi,
    /"lifecycleState": zod\.enum\(\["invite-created", "invite-accepted", "invite-revoked", "member-updated", "member-revoked", "access-pass-active", "access-pass-revoked", "access-pass-expired"\]\)/,
    "Zod must validate household audit lifecycle states",
  );
  assert.match(
    zodApi,
    /"storage": zod\.enum\(\["provider-durable"\]\)/,
    "Zod must no longer allow response-only audit storage for provider-ready household mutations",
  );
  assert.match(
    reactSchemas,
    /export type HouseholdAuditLifecycleState = "invite-created" \| "invite-accepted" \| "invite-revoked" \| "member-updated" \| "member-revoked" \| "access-pass-active" \| "access-pass-revoked" \| "access-pass-expired"/,
    "React schemas must expose typed household audit lifecycle states",
  );
});

test("household audit review API stays owner-scoped and typed", () => {
  const householdRoute = read("artifacts/api-server/src/routes/household.ts");
  const accessPassPolicy = read("artifacts/api-server/src/lib/household-access-pass.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const reactSchemas = read("lib/api-client-react/src/generated/api.schemas.ts");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const auditListBlock = section(
    openapi,
    "  /household/audit-events:",
    "  /care-state:",
  );

  assert.match(
    accessPassPolicy,
    /normalizeHouseholdAuditListQuery/,
    "audit review should share a query normalizer for route and generated-contract parity",
  );
  assert.match(
    householdRoute,
    /router\.get\("\/household\/audit-events", requireAuth/,
    "audit review should be an authenticated owner/admin route",
  );
  assert.match(
    householdRoute,
    /ListHouseholdAuditEventsQueryParams\.safeParse\(req\.query\)/,
    "audit review should validate query filters before querying durable audit rows",
  );
  assert.match(
    householdRoute,
    /getHouseholdMemberAuthz\(householdId, userId\)/,
    "audit review should resolve the authenticated member before exposing audit rows",
  );
  assert.match(
    householdRoute,
    /actor\?\.role !== "owner"/,
    "audit review should stay owner/admin-only until finer-grained admin roles are approved",
  );
  assert.match(
    householdRoute,
    /eq\(householdAuditEventsTable\.householdId, householdId\)/,
    "audit review must stay scoped to the active household",
  );
  assert.match(
    householdRoute,
    /desc\(householdAuditEventsTable\.createdAt\)/,
    "audit review should return newest durable audit rows first",
  );
  assert.match(
    householdRoute,
    /ListHouseholdAuditEventsResponse\.parse/,
    "audit review should return a typed generated response",
  );

  assert.match(auditListBlock, /operationId: listHouseholdAuditEvents/, "OpenAPI must document audit review");
  for (const status of ['"400"', '"401"', '"403"']) {
    assert.match(auditListBlock, new RegExp(`${status}:`), `OpenAPI must document audit review ${status} responses`);
  }
  assert.match(auditListBlock, /name:\s+limit/, "OpenAPI must document audit review limit query");
  assert.match(auditListBlock, /name:\s+action/, "OpenAPI must document audit review action filter");
  assert.match(auditListBlock, /name:\s+lifecycleState/, "OpenAPI must document audit review lifecycle filter");
  assert.match(openapi, /HouseholdAuditEventListResponse:/, "OpenAPI must expose the audit list response schema");

  assert.match(zodApi, /export const ListHouseholdAuditEventsQueryParams/, "Zod must validate audit review query params");
  assert.match(zodApi, /export const ListHouseholdAuditEventsResponse/, "Zod must expose audit review response");
  assert.match(reactSchemas, /export interface ListHouseholdAuditEventsParams/, "React schemas must type audit review params");
  assert.match(reactSchemas, /export interface HouseholdAuditEventListResponse/, "React schemas must type audit review response");
  assert.match(reactClient, /listHouseholdAuditEvents/, "React client must expose audit review fetcher");
  assert.match(
    reactClient,
    /getListHouseholdAuditEventsQueryOptions = <TData = Awaited<ReturnType<typeof listHouseholdAuditEvents>>, TError = ErrorType<ApiError>>/,
    "React audit review query must expose ApiError for auth, validation, and forbidden states",
  );
  assert.match(
    reactClient,
    /ListHouseholdAuditEventsQueryError = ErrorType<ApiError>/,
    "React audit review error alias must expose ApiError bodies",
  );
});

test("household sharing cleanup review API stays owner-scoped and typed", () => {
  const householdRoute = read("artifacts/api-server/src/routes/household.ts");
  const sharingCleanup = read("artifacts/api-server/src/lib/household-sharing-cleanup.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodTypesIndex = read("lib/api-zod/src/generated/types/index.ts");
  const reactSchemas = read("lib/api-client-react/src/generated/api.schemas.ts");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const cleanupBlock = section(
    openapi,
    "  /household/sharing-cleanup:",
    "  /household/audit-events:",
  );

  assert.match(
    sharingCleanup,
    /buildHouseholdSharingCleanupCandidates/,
    "sharing cleanup should share stale-invite/helper candidate derivation",
  );
  assert.match(
    sharingCleanup,
    /review-only/,
    "sharing cleanup must stay non-destructive until owner approval and provider policy exist",
  );
  assert.match(
    householdRoute,
    /router\.get\("\/household\/sharing-cleanup", requireAuth/,
    "sharing cleanup review should be an authenticated owner/admin route",
  );
  assert.match(
    householdRoute,
    /ListHouseholdSharingCleanupQueryParams\.safeParse\(req\.query\)/,
    "sharing cleanup review should validate query filters",
  );
  assert.match(
    householdRoute,
    /actor\?\.role !== "owner"/,
    "sharing cleanup review should stay owner/admin-only until cleanup approval is designed",
  );
  assert.match(
    householdRoute,
    /eq\(householdInvitationsTable\.householdId, householdId\)/,
    "sharing cleanup review must scope stale invitations to the active household",
  );
  assert.match(
    householdRoute,
    /eq\(householdMembersTable\.householdId, householdId\)/,
    "sharing cleanup review must scope expired helper memberships to the active household",
  );
  assert.match(
    householdRoute,
    /ListHouseholdSharingCleanupResponse\.parse/,
    "sharing cleanup review should return a typed generated response",
  );

  assert.match(cleanupBlock, /operationId: listHouseholdSharingCleanup/, "OpenAPI must document sharing cleanup review");
  for (const status of ['"400"', '"401"', '"403"']) {
    assert.match(cleanupBlock, new RegExp(`${status}:`), `OpenAPI must document sharing cleanup ${status} responses`);
  }
  assert.match(cleanupBlock, /name:\s+limit/, "OpenAPI must document sharing cleanup limit query");
  assert.match(cleanupBlock, /name:\s+kind/, "OpenAPI must document sharing cleanup kind filter");
  assert.match(openapi, /HouseholdSharingCleanupCandidate:/, "OpenAPI must expose sharing cleanup candidate schema");
  assert.match(openapi, /HouseholdSharingCleanupResponse:/, "OpenAPI must expose sharing cleanup response schema");

  assert.match(zodApi, /export const ListHouseholdSharingCleanupQueryParams/, "Zod must validate sharing cleanup query params");
  assert.match(zodApi, /export const HouseholdSharingCleanupCandidate/, "Zod must expose sharing cleanup candidate schema");
  assert.match(zodApi, /export const ListHouseholdSharingCleanupResponse/, "Zod must expose sharing cleanup response");
  assert.match(zodTypesIndex, /householdSharingCleanupCandidate/, "Zod type exports must include cleanup candidates");
  assert.match(reactSchemas, /export type HouseholdSharingCleanupKind/, "React schemas must type sharing cleanup kind");
  assert.match(reactSchemas, /export interface HouseholdSharingCleanupResponse/, "React schemas must type sharing cleanup response");
  assert.match(reactClient, /listHouseholdSharingCleanup/, "React client must expose sharing cleanup fetcher");
  assert.match(
    reactClient,
    /getListHouseholdSharingCleanupQueryOptions = <TData = Awaited<ReturnType<typeof listHouseholdSharingCleanup>>, TError = ErrorType<ApiError>>/,
    "React sharing cleanup query must expose ApiError for auth, validation, and forbidden states",
  );
  assert.match(
    reactClient,
    /ListHouseholdSharingCleanupQueryError = ErrorType<ApiError>/,
    "React sharing cleanup error alias must expose ApiError bodies",
  );
});

test("Access Pass expiry is enforced at member-auth request time", () => {
  const household = read("artifacts/api-server/src/lib/household.ts");
  const householdRoute = read("artifacts/api-server/src/routes/household.ts");
  const accessPassPolicy = read("artifacts/api-server/src/lib/household-access-pass.ts");
  const careEntryPolicy = read("artifacts/api-server/src/lib/care-entry-authorization.ts");
  const memberSchema = read("lib/db/src/schema/householdMembers.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodMemberType = read("lib/api-zod/src/generated/types/member.ts");
  const reactSchemas = read("lib/api-client-react/src/generated/api.schemas.ts");

  assert.match(
    memberSchema,
    /accessPassExpiresAt:\s*timestamp\("access_pass_expires_at"/,
    "household member rows must store the active Access Pass expiry used for request-time auth",
  );
  assert.match(
    accessPassPolicy,
    /deriveAccessPassRuntimeStatus/,
    "Access Pass policy must expose a shared runtime expiry helper",
  );
  assert.match(
    accessPassPolicy,
    /authorizationRole:\s*"expired access pass"/,
    "expired helpers should receive a denied authorization role instead of keeping helper powers",
  );
  assert.match(
    household,
    /accessPassExpiresAt:\s*householdMembersTable\.accessPassExpiresAt/,
    "household member auth should read Access Pass expiry metadata",
  );
  assert.match(
    household,
    /deriveAccessPassRuntimeStatus\(/,
    "household member auth should apply request-time expiry status",
  );
  assert.match(
    household,
    /role:\s*runtime\.authorizationRole/,
    "care-write authorization should receive the expired access role when an Access Pass lapses",
  );
  assert.match(
    careEntryPolicy,
    /expired access pass/,
    "care-entry policy should treat expired Access Pass helpers as read-only",
  );
  assert.match(
    householdRoute,
    /accessPassExpiresAt:\s*expiryPolicy\.expiresAt \? new Date\(expiryPolicy\.expiresAt\) : null/,
    "Access Pass activation must persist the approved expiry on the member row",
  );
  assert.match(
    accessPassPolicy,
    /access-pass-expired/,
    "Access Pass route contracts should keep expiry lifecycle language visible",
  );

  assert.match(openapi, /accessPassExpiresAt:/, "OpenAPI Member schema must expose Access Pass expiry status");
  assert.match(openapi, /accessPassExpired:/, "OpenAPI Member schema must expose expired-helper status");
  assert.match(
    zodApi,
    /"accessPassExpiresAt": zod\.string\(\)\.nullish\(\)/,
    "Zod member payloads must parse Access Pass expiry status",
  );
  assert.match(
    zodApi,
    /"accessPassExpired": zod\.boolean\(\)\.optional\(\)/,
    "Zod member payloads must parse expired-helper status",
  );
  assert.match(
    zodMemberType,
    /accessPassExpiresAt\?: string \| null/,
    "generated Zod member type must expose Access Pass expiry",
  );
  assert.match(
    reactSchemas,
    /accessPassExpired\?: boolean/,
    "React schemas must expose expired-helper status for UI warnings",
  );
});

test("household invitations have provider-ready lifecycle storage and typed routes", () => {
  const route = read("artifacts/api-server/src/routes/household.ts");
  const invitationPolicy = read("artifacts/api-server/src/lib/household-invitations.ts");
  const invitationSchema = read("lib/db/src/schema/householdInvitations.ts");
  const schemaIndex = read("lib/db/src/schema/index.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSchemas = read("lib/api-client-react/src/generated/api.schemas.ts");

  const invitationListBlock = section(
    openapi,
    "  /household/invitations:",
    "  /household/invitations/{id}/revoke:",
  );
  const invitationRevokeBlock = section(
    openapi,
    "  /household/invitations/{id}/revoke:",
    "components:",
  );

  assert.match(
    invitationSchema,
    /pgTable\("household_invitations"/,
    "database schema must define durable household invitations",
  );
  assert.match(
    invitationSchema,
    /lifecycleState:\s*text\("lifecycle_state"\)/,
    "invitation rows must store explicit lifecycle state",
  );
  assert.match(
    invitationSchema,
    /approvedByUserId:\s*text\("approved_by_user_id"\)/,
    "invitation rows must preserve owner approval evidence",
  );
  assert.match(
    invitationSchema,
    /acceptedAt:\s*timestamp\("accepted_at"/,
    "invitation rows must store accepted-at evidence",
  );
  assert.match(
    schemaIndex,
    /export \* from "\.\/householdInvitations"/,
    "database schema index must export household invitations",
  );

  assert.match(
    invitationPolicy,
    /pending-approval/,
    "invitation policy must model pending approval before membership creation",
  );
  assert.match(
    invitationPolicy,
    /assertHouseholdInvitationAcceptAllowed/,
    "join route must be able to block non-approved invitation lifecycles",
  );
  assert.match(
    invitationPolicy,
    /normalizeHouseholdInvitationListQuery/,
    "owner/admin invitation review must share safe query normalization",
  );

  assert.match(
    route,
    /householdInvitationsTable/,
    "household routes must use durable invitation rows",
  );
  assert.match(
    route,
    /router\.get\("\/household\/invitations", requireAuth/,
    "owner/admin invitation review should be authenticated",
  );
  assert.match(
    route,
    /router\.post\("\/household\/invitations", requireAuth/,
    "owner/admin invitation creation should be authenticated",
  );
  assert.match(
    route,
    /router\.post\("\/household\/invitations\/:id\/revoke", requireAuth/,
    "owner/admin invitation revocation should be authenticated",
  );
  assert.match(
    route,
    /assertHouseholdInvitationAcceptAllowed/,
    "join route should check invitation lifecycle before creating membership",
  );
  assert.match(
    route,
    /lifecycleState:\s*"accepted"/,
    "join route should mark durable invitation rows accepted",
  );

  assert.match(invitationListBlock, /operationId: listHouseholdInvitations/, "OpenAPI must document invitation list");
  assert.match(invitationListBlock, /operationId: createHouseholdInvitation/, "OpenAPI must document invitation creation");
  assert.match(invitationRevokeBlock, /operationId: revokeHouseholdInvitation/, "OpenAPI must document invitation revocation");
  assert.match(openapi, /HouseholdInvitation:/, "OpenAPI must expose household invitation schema");
  assert.match(openapi, /pending-approval/, "OpenAPI must expose pending invitation lifecycle state");
  assert.match(openapi, /HouseholdInvitationMutationResponse:/, "OpenAPI must expose invitation mutation response");

  assert.match(zodApi, /export const ListHouseholdInvitationsQueryParams/, "Zod must validate invitation list queries");
  assert.match(zodApi, /export const CreateHouseholdInvitationBody/, "Zod must validate invitation creation body");
  assert.match(zodApi, /export const RevokeHouseholdInvitationParams/, "Zod must validate invitation revoke params");
  assert.match(zodApi, /export const HouseholdInvitationMutationResponse/, "Zod must expose invitation mutation response");

  assert.match(reactSchemas, /export type HouseholdInvitationLifecycleState/, "React schemas must type invitation lifecycle");
  assert.match(reactSchemas, /export interface HouseholdInvitation/, "React schemas must type invitation rows");
  assert.match(reactSchemas, /export interface HouseholdInvitationMutationResponse/, "React schemas must type invitation mutations");
  assert.match(reactClient, /listHouseholdInvitations/, "React client must expose invitation list fetcher");
  assert.match(reactClient, /createHouseholdInvitation/, "React client must expose invitation creation mutation");
  assert.match(reactClient, /revokeHouseholdInvitation/, "React client must expose invitation revoke mutation");
});

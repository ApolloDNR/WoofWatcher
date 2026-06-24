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

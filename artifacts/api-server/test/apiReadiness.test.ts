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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
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

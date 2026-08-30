import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("Exact Me authority time is required by OpenAPI and every canonical generated client", () => {
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactSchemas = read("lib/api-client-react/src/generated/api.schemas.ts");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodMe = read("lib/api-zod/src/generated/types/me.ts");

  const exactMeSchema = section(openapi, "    Me:", "    HouseholdAuditEvent:");
  assert.match(
    exactMeSchema,
    /authorityObservedAt:[\s\S]*format: date-time/,
    "Exact Me must carry the provider clock used to evaluate Access Pass expiry",
  );
  assert.match(
    exactMeSchema,
    /required:[\s\S]*authorityObservedAt/,
    "authorityObservedAt cannot be optional authority metadata",
  );
  assert.match(
    section(
      reactSchemas,
      "export interface Me {",
      "export type HouseholdAuditEventAction",
    ),
    /authorityObservedAt: string/,
  );
  assert.match(zodMe, /authorityObservedAt: Date/);
  assert.match(
    section(zodApi, "export const GetMe200Response =", "\n\nexport const"),
    /authorityObservedAt:\s*zod\.coerce\s*\.date\(\)/,
    "the generated server validator must require a valid provider authority instant",
  );
});

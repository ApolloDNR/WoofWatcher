import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function readCareEntriesRouteSource(): string {
  return [
    read("artifacts/api-server/src/routes/care-entries.ts"),
    read("artifacts/api-server/src/routes/care-entries-router.ts"),
  ].join("\n");
}

function readCareStateRouteSource(): string {
  return [
    read("artifacts/api-server/src/routes/care-state.ts"),
    read("artifacts/api-server/src/routes/care-state-router.ts"),
    read("artifacts/api-server/src/routes/care-household-capability.ts"),
  ].join("\n");
}

function readHouseholdScopedOperationSource(): string {
  return [
    read("artifacts/api-server/src/lib/household-scoped-operation.ts"),
    read("artifacts/api-server/src/lib/household-scoped-operation-store.ts"),
  ].join("\n");
}

function readHouseholdRouteSource(): string {
  return [
    read("artifacts/api-server/src/routes/household.ts"),
    read("artifacts/api-server/src/routes/household-management-router.ts"),
    read("artifacts/api-server/src/routes/household-scoped-operation-response.ts"),
  ].join("\n");
}

function section(source: string, start: string, end: string): string {
  const normalized = source.replace(/\r\n/g, "\n");
  const startIndex = normalized.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start.trim()}`);
  const endIndex = normalized.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end.trim()}`);
  return normalized.slice(startIndex, endIndex);
}

function operationResponseStatuses(
  source: string,
  start: string,
  end: string,
): string[] {
  return [
    ...section(source, start, end).matchAll(/^        "(\d{3})":/gm),
  ]
    .map((match) => match[1])
    .sort((left, right) => Number(left) - Number(right));
}

function canonicalGeneratedTypeScript(source: string): string {
  const sourceFile = ts.createSourceFile(
    "generated.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let output = "";
  let previousWasWord = false;

  const appendTokens = (node: ts.Node): void => {
    if (
      node.kind >= ts.SyntaxKind.FirstJSDocNode &&
      node.kind <= ts.SyntaxKind.LastJSDocNode
    ) {
      return;
    }

    const children = node.getChildren(sourceFile);
    if (children.length > 0) {
      for (const child of children) {
        appendTokens(child);
      }
      return;
    }
    if (node.kind === ts.SyntaxKind.EndOfFileToken) {
      return;
    }

    const wordLike =
      node.kind === ts.SyntaxKind.Identifier ||
      node.kind === ts.SyntaxKind.PrivateIdentifier ||
      node.kind === ts.SyntaxKind.NumericLiteral ||
      node.kind === ts.SyntaxKind.StringLiteral ||
      (node.kind >= ts.SyntaxKind.FirstKeyword &&
        node.kind <= ts.SyntaxKind.LastKeyword);
    const tokenText = ts.isStringLiteral(node)
      ? JSON.stringify(node.text)
      : node.getText(sourceFile);

    if (previousWasWord && wordLike) {
      output += " ";
    }
    if (node.kind === ts.SyntaxKind.EqualsToken) {
      output += " = ";
    } else {
      output += tokenText;
    }
    previousWasWord = wordLike;
  };

  appendTokens(sourceFile);

  return output
    .replace(/,([}\])])/g, "$1")
    .replace(/([,{])([A-Za-z_$][\w$]*):/g, '$1"$2":')
    .replace(/:\s*/g, ": ")
    .replace(/,\s*/g, ", ")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/<\s*\|\s*/g, "<")
    .replace(/,\s*>/g, ">")
    .replace(/\basync\(/g, "async (");
}

test("OpenAPI and generated clients cover WoofGuide events and Avatar Studio API routes", () => {
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const zodSchemas = read("lib/api-zod/src/generated/api.ts");
  const zodTypesIndex = read("lib/api-zod/src/generated/types/index.ts");

  for (const route of [
    "/woofguide-events",
    "/avatar-stylize",
    "/avatar-emotions",
  ]) {
    assert.match(
      openapi,
      new RegExp(`^  ${route}:`, "m"),
      `${route} is missing from OpenAPI`,
    );
  }

  for (const operation of [
    "getWoofguideEventsStatus",
    "createWoofguideEvents",
    "stylizeAvatar",
    "createAvatarEmotions",
  ]) {
    assert.match(
      reactClient,
      new RegExp(`\\b${operation}\\b`),
      `${operation} is missing from the React API client`,
    );
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
    assert.match(
      reactSchemas,
      new RegExp(`\\b${schema}\\b`),
      `${schema} is missing from generated API types`,
    );
    assert.match(
      zodTypesIndex,
      new RegExp(schema[0].toLowerCase() + schema.slice(1)),
      `${schema} is missing from generated Zod type exports`,
    );
  }

  for (const validator of [
    "GetWoofguideEventsStatus200Response",
    "CreateWoofguideEventsBody",
    "CreateWoofguideEvents200Response",
    "StylizeAvatarBody",
    "StylizeAvatar200Response",
    "CreateAvatarEmotionsBody",
    "CreateAvatarEmotions200Response",
  ]) {
    assert.match(
      zodSchemas,
      new RegExp(`\\b${validator}\\b`),
      `${validator} is missing from generated Zod schemas`,
    );
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

test("generated React errors preserve every guarded operation's prior errors and expected-household failures", () => {
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSignature = canonicalGeneratedTypeScript(reactClient);
  const orvalConfig = read("lib/api-spec/orval.config.ts");
  const guardedOperations = [
    ["UpdateHousehold", []],
    ["ListMyHouseholdMemberships", []],
    ["ActivateHousehold", []],
    ["JoinHousehold", []],
    ["ListHouseholdInvitations", []],
    ["CreateHouseholdInvitation", []],
    ["RevokeHouseholdInvitation", []],
    ["ListHouseholdSharingCleanup", []],
    ["ListHouseholdAuditEvents", []],
    ["UpdateHouseholdMember", []],
    ["RevokeHouseholdMember", []],
    ["ActivateHouseholdAccessPass", []],
    ["RevokeHouseholdAccessPass", []],
    ["GetCareState", []],
    ["PutCareState", ["CareStateEnvelope"]],
    ["ListCareEntries", []],
    ["ListCareEntryTombstones", []],
    ["CreateCareEntry", []],
    ["UpdateCareEntry", ["CareEntryConflict"]],
    ["DeleteCareEntryByClientKey", []],
    ["DeleteCareEntry", []],
  ] as const;
  const operationMarkers = [
    ...reactClient.matchAll(/^export const get([A-Za-z0-9]+)Url/gm),
  ];
  const operationBlocks = new Map<string, string>();

  assert.match(
    orvalConfig,
    /tsconfig: path\.resolve\(root, "lib", "api-client-react", "tsconfig\.json"\)/,
    "React codegen must preserve the custom fetcher's two-argument signature through the ES2022 client tsconfig",
  );
  assert.match(
    reactClient,
    /useGetCareStateQueryOptions[\s\S]*?headers: GetCareStateHeaders[\s\S]*?buildHouseholdQueryKey\(\s*\{ headers \}[\s\S]*?getCareState\(headers, \{ signal, \.\.\.requestOptions \}\)/,
    "generated queries must require, key by, and forward typed household capability headers",
  );
  assert.match(
    reactClient,
    /getPutCareStateMutationOptions[\s\S]*?headers: PutCareStateHeaders[\s\S]*?const \{ data, headers \} = props \?\? \{\};[\s\S]*?return putCareState\(data, headers, requestOptions\)/,
    "generated mutations must require and forward typed household capability headers",
  );

  for (const [index, marker] of operationMarkers.entries()) {
    const start = marker.index;
    assert.notEqual(
      start,
      undefined,
      `Missing source position for ${marker[1]}`,
    );
    const end = operationMarkers[index + 1]?.index ?? reactClient.length;
    operationBlocks.set(marker[1], reactClient.slice(start, end));
  }

  const operationsWithExpectedHouseholdErrors: string[] = [];
  for (const [operation, preservedErrors] of guardedOperations) {
    const block = operationBlocks.get(operation);
    assert.ok(block, `Missing generated operation block for ${operation}`);
    const errorSignatures = [...block.matchAll(/ErrorType<([^>]+)>/g)].map(
      (match) => match[1],
    );

    assert.equal(
      errorSignatures.length,
      3,
      `${operation} must type options, its public error alias, and its hook`,
    );
    for (const signature of errorSignatures) {
      assert.match(
        signature,
        /\bApiError\b/,
        `${operation} must retain ApiError`,
      );
      for (const preservedError of preservedErrors) {
        assert.match(
          signature,
          new RegExp(`\\b${preservedError}\\b`),
          `${operation} must retain ${preservedError}`,
        );
      }
      assert.match(
        signature,
        /\bExpectedHouseholdMismatchResponse\b/,
        `${operation} must expose HTTP 412 household mismatch bodies`,
      );
      assert.match(
        signature,
        /\bExpectedHouseholdRequiredResponse\b/,
        `${operation} must expose HTTP 428 missing-capability bodies`,
      );
    }
  }

  for (const [operation, block] of operationBlocks) {
    const signatures = [...block.matchAll(/ErrorType<([^>]+)>/g)].map(
      (match) => match[1],
    );
    if (
      signatures.some(
        (signature) =>
          signature.includes("ExpectedHouseholdMismatchResponse") ||
          signature.includes("ExpectedHouseholdRequiredResponse"),
      )
    ) {
      operationsWithExpectedHouseholdErrors.push(operation);
    }
  }

  assert.deepEqual(
    operationsWithExpectedHouseholdErrors.sort(),
    guardedOperations.map(([operation]) => operation).sort(),
    "only the exact expected-household guarded operation set may expose 412/428 error unions",
  );
});

test("OpenAPI keeps the audited household and Care response-status sets exact", () => {
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodSignature = canonicalGeneratedTypeScript(zodApi);
  const operations = [
    [
      "getMe",
      "    get:\n      operationId: getMe",
      "    patch:\n      operationId: updateMe",
      ["200", "401", "403", "409"],
    ],
    [
      "updateMe",
      "    patch:\n      operationId: updateMe",
      "  /household:",
      ["200", "400", "401", "403", "409"],
    ],
    [
      "createHouseholdInvitation",
      "    post:\n      operationId: createHouseholdInvitation",
      "  /household/invitations/{id}/revoke:",
      ["201", "400", "401", "403", "409", "412", "428"],
    ],
    [
      "joinHousehold",
      "    post:\n      operationId: joinHousehold",
      "  /household/members/{id}:",
      ["200", "400", "401", "403", "404", "409", "412", "428", "503"],
    ],
    [
      "getCareState",
      "    get:\n      operationId: getCareState",
      "    put:\n      operationId: putCareState",
      ["200", "401", "403", "404", "409", "412", "428"],
    ],
    [
      "putCareState",
      "    put:\n      operationId: putCareState",
      "  /care-entries:",
      ["200", "400", "401", "403", "404", "409", "412", "428"],
    ],
    [
      "listCareEntries",
      "    get:\n      operationId: listCareEntries",
      "    post:\n      operationId: createCareEntry",
      ["200", "400", "401", "403", "409", "412", "428"],
    ],
    [
      "createCareEntry",
      "    post:\n      operationId: createCareEntry",
      "  /care-entries/tombstones:",
      ["200", "201", "400", "401", "403", "409", "410", "412", "428"],
    ],
    [
      "listCareEntryTombstones",
      "    get:\n      operationId: listCareEntryTombstones",
      "  /care-entries/client-key/{clientKey}:",
      ["200", "400", "401", "403", "409", "412", "428"],
    ],
    [
      "deleteCareEntryByClientKey",
      "    delete:\n      operationId: deleteCareEntryByClientKey",
      "  /care-entries/{id}:",
      ["204", "400", "401", "403", "409", "412", "428"],
    ],
    [
      "updateCareEntry",
      "    patch:\n      operationId: updateCareEntry",
      "      operationId: deleteCareEntry\n",
      ["200", "400", "401", "403", "404", "409", "412", "428"],
    ],
    [
      "deleteCareEntry",
      "      operationId: deleteCareEntry\n",
      "\ncomponents:",
      ["204", "400", "401", "403", "404", "409", "412", "428"],
    ],
  ] as const;

  for (const [operationId, start, end, expected] of operations) {
    assert.deepEqual(
      operationResponseStatuses(openapi, start, end),
      [...expected].sort((left, right) => Number(left) - Number(right)),
      `${operationId} response statuses must match the audited contract exactly`,
    );

    const generatedStatuses = [
      ...zodApi.matchAll(
        new RegExp(
          `^export const ${operationId[0].toUpperCase() + operationId.slice(1)}(\\d{3})Response\\b`,
          "gm",
        ),
      ),
    ]
      .map((match) => match[1])
      .sort((left, right) => Number(left) - Number(right));
    assert.deepEqual(
      generatedStatuses,
      expected
        .filter(
          (status) =>
            !(
              operationId.startsWith("deleteCareEntry") && status === "204"
            ),
        )
        .sort((left, right) => Number(left) - Number(right)),
      `${operationId} must generate one exact validator for every response body`,
    );
  }

  const putCareState = section(
    openapi,
    "    put:\n      operationId: putCareState",
    "  /care-entries:",
  );
  assert.match(
    putCareState,
    /"409":[\s\S]*?oneOf:[\s\S]*?#\/components\/schemas\/CareStateEnvelope[\s\S]*?#\/components\/schemas\/ApiError/,
    "care-state 409 must preserve the conflict envelope and authority ApiError",
  );

  const updateCareEntry = section(
    openapi,
    "    patch:\n      operationId: updateCareEntry",
    "      operationId: deleteCareEntry\n",
  );
  assert.match(
    updateCareEntry,
    /"409":[\s\S]*?anyOf:[\s\S]*?#\/components\/schemas\/CareEntryConflict[\s\S]*?#\/components\/schemas\/ApiError/,
    "care-entry 409 must honestly accept the overlapping winning-entry conflict and authority ApiError bodies",
  );
  assert.match(
    zodSignature,
    /export const PutCareState409Response = zod\.union\(\[zod\.object\(\{[\s\S]*?"householdId": zod\.string\(\)[\s\S]*?"version": zod\.number\(\)\.min\(1\)\.max\(putCareState409ResponseOneVersionMax\)\.multipleOf\(putCareState409ResponseOneVersionMultipleOf\)[\s\S]*?zod\.object\(\{\s*"error": zod\.string\(\)\s*\}\)\]\)/,
    "generated care-state 409 must validate both the exact conflict envelope and ApiError",
  );
  assert.match(
    zodSignature,
    /export const UpdateCareEntry409Response = zod\.union\(\[zod\.object\(\{\s*"error": zod\.string\(\),\s*"entry": zod\.object\(\{[\s\S]*?"householdId": zod\.string\(\)[\s\S]*?zod\.object\(\{\s*"error": zod\.string\(\)\s*\}\)\]\)/,
    "generated care-entry 409 must validate both the winning entry and authority ApiError",
  );
});

test("care entries list query stays documented, typed, and validation-aware", () => {
  const route = readCareEntriesRouteSource();
  const queryHelper = read("artifacts/api-server/src/lib/care-entry-query.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const zodSchemas = read("lib/api-zod/src/generated/api.ts");
  const zodSignature = canonicalGeneratedTypeScript(zodSchemas);
  const zodTypes = read(
    "lib/api-zod/src/generated/types/listCareEntriesParams.ts",
  );
  const listCareEntriesBlock = section(
    openapi,
    "    get:\n      operationId: listCareEntries",
    "    post:\n      operationId: createCareEntry",
  );

  assert.match(
    route,
    /normalizeListCareEntriesQuery\(req\.query\)/,
    "care-entries route should use the shared query normalizer",
  );
  assert.match(
    queryHelper,
    /Invalid since query/,
    "care-entry list query should reject malformed incremental sync timestamps",
  );
  assert.match(
    queryHelper,
    /updatedSince/,
    "care-entry list query should expose a server update cursor separate from occurrence filters",
  );
  assert.match(
    route,
    /gte\(careEntriesTable\.updatedAt, updatedSince\)/,
    "care-entry list route should use updatedAt for server cursor reads",
  );
  assert.match(
    listCareEntriesBlock,
    /name:\s+since/,
    "OpenAPI must document the care-entries since query",
  );
  assert.match(
    listCareEntriesBlock,
    /name:\s+updatedSince/,
    "OpenAPI must document the care-entries server update cursor query",
  );
  assert.match(
    openapi,
    /name:\s+limit/,
    "OpenAPI must document the care-entries limit query",
  );
  assert.match(
    listCareEntriesBlock,
    /"400":/,
    "OpenAPI must document invalid care-entry list query errors",
  );
  assert.match(
    reactSchemas,
    /updatedAt:\s*string/,
    "React API client must expose the care-entry update cursor",
  );
  assert.match(
    reactSchemas,
    /since\?:\s*string/,
    "React API client must type the care-entries since query",
  );
  assert.match(
    reactSchemas,
    /updatedSince\?:\s*string/,
    "React API client must type the care-entries updatedSince query",
  );
  assert.match(
    reactSchemas,
    /limit\?:\s*number/,
    "React API client must type the care-entries limit query",
  );
  assert.match(
    zodTypes,
    /updatedSince\?:\s*Date/,
    "Zod generated param types must type the care-entries updatedSince query",
  );
  assert.match(
    zodTypes,
    /since\?:\s*Date/,
    "Zod generated param types must type the care-entries since query",
  );
  assert.match(
    zodTypes,
    /limit\?:\s*number/,
    "Zod generated param types must type the care-entries limit query",
  );
  assert.match(
    zodSignature,
    /"updatedSince":\s*zod\.date\(\)\.optional\(\)/,
    "Zod generated validator must validate the care-entries updatedSince query",
  );
  assert.match(
    zodSignature,
    /"since":\s*zod\.date\(\)\.optional\(\)/,
    "Zod generated validator must validate the care-entries since query",
  );
  assert.match(
    zodSignature,
    /"limit":\s*zod\.number\(\)/,
    "Zod generated validator must validate the care-entries limit query",
  );
});

test("care entry server cursor and tombstone contract stays source-backed", () => {
  const route = readCareEntriesRouteSource();
  const schema = read("lib/db/src/schema/careEntries.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodSignature = canonicalGeneratedTypeScript(zodApi);
  const zodTypesIndex = read("lib/api-zod/src/generated/types/index.ts");
  const zodTombstoneType = read(
    "lib/api-zod/src/generated/types/careEntryTombstone.ts",
  );
  const zodTombstoneParamsType = read(
    "lib/api-zod/src/generated/types/listCareEntryTombstonesParams.ts",
  );
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSignature = canonicalGeneratedTypeScript(reactClient);

  const tombstoneBlock = section(
    openapi,
    "  /care-entries/tombstones:",
    "  /care-entries/client-key/{clientKey}:",
  );

  assert.match(
    schema,
    /updatedAt:\s*timestamp\("updated_at"/,
    "care entries must store an updatedAt cursor",
  );
  assert.match(
    schema,
    /pgTable\(\s*"care_entry_tombstones"/,
    "care-entry deletes must have durable tombstone rows",
  );
  assert.match(
    schema,
    /entryId:\s*uuid\("entry_id"\)/,
    "tombstones must preserve the deleted care-entry id",
  );
  assert.match(
    schema,
    /deletedAt:\s*timestamp\("deleted_at"/,
    "tombstones must preserve delete time",
  );
  assert.match(schema, /clientKey:\s*text\("client_key"\)/);
  assert.match(
    schema,
    /care_entry_tombstones_household_creator_client_key_uidx/,
  );

  assert.match(
    route,
    /router\.get\(\s*"\/care-entries\/tombstones",\s*requireAuth/,
    "care-entry tombstones need an authenticated list route",
  );
  assert.match(
    route,
    /ListCareEntryTombstonesResponse\.parse/,
    "care-entry tombstones should use the generated response validator",
  );
  assert.match(
    route,
    /serializeHouseholdMutation:\s*true[\s\S]*findDeletionTombstone[\s\S]*reply\.status\(410\)/,
  );
  assert.match(
    route,
    /(?:db|tx)\s*\.\s*insert\(careEntryTombstonesTable\)/,
    "care-entry deletes should insert a tombstone with the delete mutation",
  );
  assert.match(
    route,
    /entryId:\s*deleted\.id/,
    "care-entry tombstones should preserve the deleted entry id",
  );
  assert.match(
    route,
    /deletedByUserId:\s*userId/,
    "care-entry tombstones should preserve who deleted the entry",
  );
  const clientKeyRouteIndex = route.indexOf(
    'router.delete(\n    "/care-entries/client-key/:clientKey"',
  );
  const genericIdRouteIndex = route.indexOf(
    'router.delete(\n    "/care-entries/:id"',
  );
  assert.ok(clientKeyRouteIndex >= 0);
  assert.ok(
    genericIdRouteIndex > clientKeyRouteIndex,
    "the exact client-key route must precede the generic id route",
  );
  assert.match(
    route.slice(clientKeyRouteIndex, genericIdRouteIndex),
    /serializeHouseholdMutation:\s*true[\s\S]*normalizeCareEntryClientKey\([\s\S]*eq\(careEntriesTable\.householdId, householdId\)[\s\S]*eq\(careEntriesTable\.caregiverUserId, userId\)[\s\S]*randomUUID\(\)/,
    "delete-by-client-key must normalize and serialize an exact creator/household tombstone even when no row exists",
  );

  assert.match(
    tombstoneBlock,
    /operationId: listCareEntryTombstones/,
    "OpenAPI must document the tombstone list route",
  );
  assert.match(
    tombstoneBlock,
    /name:\s+updatedSince/,
    "OpenAPI must document the tombstone update cursor",
  );
  assert.match(
    tombstoneBlock,
    /"200":/,
    "OpenAPI must document tombstone list success",
  );
  assert.match(
    tombstoneBlock,
    /"400":/,
    "OpenAPI must document invalid tombstone list query errors",
  );
  assert.match(
    tombstoneBlock,
    /"401":/,
    "OpenAPI must document unauthenticated tombstone list errors",
  );
  assert.match(
    openapi,
    /CareEntryTombstone:/,
    "OpenAPI must expose the care-entry tombstone schema",
  );

  assert.match(
    zodSignature,
    /export const ListCareEntryTombstonesQueryParams = zod\.object\(\{\s*"updatedSince": zod\.date\(\)\.optional\(\),\s*"limit": zod\.coerce\.number\(\)\.min\(1\)\.max\(listCareEntryTombstonesQueryLimitMax\)\.default\(listCareEntryTombstonesQueryLimitDefault\)\s*\}\)/,
    "the shipping tombstone query validator must preserve the cursor and bounded default limit",
  );
  assert.match(
    zodSignature,
    /export const ListCareEntryTombstones200ResponseItem = zod\.object\(\{\s*"id": zod\.string\(\),\s*"householdId": zod\.string\(\),\s*"entryId": zod\.string\(\),\s*"petId": zod\.string\(\)\.nullish\(\),\s*"deletedByUserId": zod\.string\(\)\.nullish\(\),\s*"deletedAt": zod\.coerce\.date\(\),\s*"createdAt": zod\.coerce\.date\(\),\s*"updatedAt": zod\.coerce\.date\(\)\s*\}\)/,
    "the shipping 200 validator must validate every tombstone field",
  );
  assert.match(
    zodSignature,
    /export const ListCareEntryTombstones200Response = zod\.array\(ListCareEntryTombstones200ResponseItem\)/,
    "Zod must expose the exact tombstone 200 response validator",
  );
  assert.match(
    zodTypesIndex,
    /careEntryTombstone/,
    "Zod generated type exports must include tombstones",
  );
  assert.match(
    zodTypesIndex,
    /listCareEntryTombstonesParams/,
    "Zod generated type exports must include tombstone query params",
  );
  assert.match(
    zodTombstoneType,
    /export interface CareEntryTombstone \{\s*id: string;\s*householdId: string;\s*entryId: string;[\s\S]*?deletedAt: Date;\s*createdAt: Date;\s*updatedAt: Date;\s*\}/,
    "the generated component type must preserve the authoritative tombstone shape",
  );
  assert.match(
    reactSchemas,
    /export interface CareEntryTombstone/,
    "React schemas must type tombstone rows",
  );
  assert.match(
    zodTombstoneParamsType,
    /export type ListCareEntryTombstonesParams = \{\s*updatedSince\?: Date;[\s\S]*?limit\?: number;\s*\};/,
    "the generated component query type must preserve the Date cursor and bounded numeric limit",
  );
  assert.match(
    reactSchemas,
    /export type ListCareEntryTombstonesParams = \{\s*updatedSince\?: string;[\s\S]*?limit\?: number;\s*\};/,
    "React schemas must preserve the serialized cursor and numeric limit query type",
  );
  assert.match(
    reactSignature,
    /listCareEntryTombstones/,
    "React client must expose the tombstone fetcher",
  );
  assert.match(
    reactSignature,
    /ListCareEntryTombstonesQueryError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React tombstone query error alias must preserve ApiError and expose household capability failures",
  );
});

test("care state write errors stay documented and typed", () => {
  const route = readCareStateRouteSource();
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSignature = canonicalGeneratedTypeScript(reactClient);

  const putCareStateBlock =
    openapi.match(/    put:\r?\n[\s\S]*?  \/care-entries:/)?.[0] ?? "";

  assert.match(
    route,
    /reply\.status\(400\)/,
    "care-state PUT should still return validation errors",
  );
  assert.match(
    route,
    /reply\.status\(404\)/,
    "care-state PUT should still return missing document errors",
  );
  assert.match(
    route,
    /reply\.status\(409\)/,
    "care-state PUT should still return optimistic conflict envelopes",
  );
  assert.match(
    putCareStateBlock,
    /"400":/,
    "OpenAPI must document invalid care-state payload errors",
  );
  assert.match(
    putCareStateBlock,
    /"404":/,
    "OpenAPI must document missing care-state document errors",
  );
  assert.match(
    putCareStateBlock,
    /"409":/,
    "OpenAPI must document stale care-state write conflicts",
  );
  assert.match(
    reactSignature,
    /getPutCareStateMutationOptions = <TError = ErrorType<ApiError \| CareStateEnvelope \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API mutation must preserve care-state errors and expose household capability failures",
  );
  assert.match(
    reactSignature,
    /PutCareStateMutationError = ErrorType<ApiError \| CareStateEnvelope \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API mutation error alias must preserve validation/not-found/conflict and household capability response shapes",
  );
});

test("care entry write errors stay documented and typed", () => {
  const route = readCareEntriesRouteSource();
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSignature = canonicalGeneratedTypeScript(reactClient);

  const createBlock = section(
    openapi,
    "    post:\n      operationId: createCareEntry",
    "  /care-entries/tombstones:",
  );
  const updateBlock = section(
    openapi,
    "    patch:\n      operationId: updateCareEntry",
    "      operationId: deleteCareEntry\n",
  );
  const deleteBlock = section(
    openapi,
    "      operationId: deleteCareEntry\n",
    "\ncomponents:",
  );

  assert.match(
    route,
    /CreateCareEntryBody\.safeParse/,
    "care-entry create should still validate request bodies",
  );
  assert.match(
    route,
    /UpdateCareEntryParams\.safeParse/,
    "care-entry update should still validate route params",
  );
  assert.match(
    route,
    /UpdateCareEntryBody\.safeParse/,
    "care-entry update should still validate request bodies",
  );
  assert.match(
    route,
    /DeleteCareEntryParams\.safeParse/,
    "care-entry delete should still validate route params",
  );
  assert.match(
    createBlock,
    /"400":/,
    "OpenAPI must document invalid create-care-entry payload errors",
  );
  assert.match(createBlock, /"410":[\s\S]*CareEntryCreateRevoked/);
  assert.match(
    updateBlock,
    /"400":/,
    "OpenAPI must document invalid update-care-entry payload or param errors",
  );
  assert.match(
    updateBlock,
    /"404":/,
    "OpenAPI must keep documenting update-care-entry not-found errors",
  );
  assert.match(
    updateBlock,
    /"409":/,
    "OpenAPI must document stale care-entry update conflicts",
  );
  assert.match(
    updateBlock,
    /CareEntryConflict/,
    "OpenAPI must return the winning care entry for one-step conflict rebase",
  );
  assert.match(
    route,
    /CARE_ENTRY_SYNC_REVISION_KEY[\s\S]*incomingRevision[\s\S]*revisionGuard[\s\S]*reply\.status\(409\)[\s\S]*entry: UpdateCareEntryResponse\.parse\(current\)/,
    "care-entry updates must reject stale client revisions atomically",
  );
  assert.match(
    deleteBlock,
    /"400":/,
    "OpenAPI must document invalid delete-care-entry param errors",
  );
  assert.match(
    deleteBlock,
    /"404":/,
    "OpenAPI must keep documenting delete-care-entry not-found errors",
  );
  assert.match(
    reactSignature,
    /getCreateCareEntryMutationOptions = <TError = ErrorType<ApiError \| CareEntryCreateRevoked \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API create mutation must preserve validation errors and expose household capability failures",
  );
  assert.match(
    reactSignature,
    /CreateCareEntryMutationError = ErrorType<ApiError \| CareEntryCreateRevoked \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API create mutation error alias must expose validation and household capability error bodies",
  );
  assert.match(
    reactSignature,
    /UpdateCareEntryMutationError = ErrorType<ApiError \| CareEntryConflict \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API update mutation error alias must preserve invalid, not-found, conflict, and household capability bodies",
  );
  assert.match(
    reactSignature,
    /DeleteCareEntryMutationError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API delete mutation error alias must preserve invalid/not-found and household capability bodies",
  );
});

test("care entry revision protocol stays documented, validated, and emitted by the mobile client", () => {
  const route = readCareEntriesRouteSource();
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const reactSignature = canonicalGeneratedTypeScript(reactSchemas);
  const zodSchemas = read("lib/api-zod/src/generated/api.ts");
  const zodSignature = canonicalGeneratedTypeScript(zodSchemas);
  const zodTypes = read("lib/api-zod/src/generated/types/careEntryUpdate.ts");
  const zodProtocolType = read(
    "lib/api-zod/src/generated/types/careEntryUpdateClientSyncProtocol.ts",
  );
  const zodProtocolSignature = canonicalGeneratedTypeScript(zodProtocolType);
  const zodConflictType = read(
    "lib/api-zod/src/generated/types/careEntryConflict.ts",
  );
  const zodTypesIndex = read("lib/api-zod/src/generated/types/index.ts");
  const zodPublicIndex = read("lib/api-zod/src/index.ts");
  const careContext = read(
    "artifacts/woofwatcher-mobile/context/CareContext.tsx",
  );

  assert.match(
    openapi,
    /clientSyncProtocol:\s*\n\s*type:\s*string\s*\n\s*enum:\s*\[revision-v1\]/,
    "OpenAPI must document the current care-entry revision protocol",
  );
  assert.match(
    reactSchemas,
    /clientSyncProtocol\?:\s*CareEntryUpdateClientSyncProtocol/,
    "React API types must expose the current care-entry revision protocol",
  );
  assert.match(
    reactSignature,
    /export const CareEntryUpdateClientSyncProtocol = \{"revision-v1": "revision-v1"\}as const/,
    "React API models must preserve the generated revision-protocol enum",
  );
  assert.match(
    zodSignature,
    /"clientSyncProtocol": zod\.enum\(\["revision-v1"\]\)\.optional\(\)/,
    "Zod must validate the current care-entry revision protocol",
  );
  assert.match(
    zodTypes,
    /clientSyncProtocol\?:\s*CareEntryUpdateClientSyncProtocol/,
    "Zod request types must expose the current care-entry revision protocol",
  );
  assert.match(
    zodProtocolSignature,
    /export const CareEntryUpdateClientSyncProtocol = \{"revision-v1": "revision-v1"\}as const/,
    "Zod models must preserve the generated revision-protocol enum",
  );
  assert.match(
    zodConflictType,
    /export interface CareEntryConflict \{\s*error: string;\s*entry: CareEntry;\s*\}/,
    "Zod generated models must expose the typed conflict envelope",
  );
  assert.match(
    zodTypesIndex,
    /export \* from ["']\.\/careEntryConflict["']/,
    "Zod generated types must export the conflict envelope",
  );
  assert.match(
    zodPublicIndex,
    /\bCareEntryConflict\b/,
    "the public Zod type barrel must expose the conflict envelope",
  );
  assert.match(
    route,
    /isNextCareEntrySyncRevision\(existing\.details, policy\.details\)/,
    "marked clients must establish exactly the next selected-row revision",
  );
  assert.match(
    route,
    /sql`\$\{storedRevision\} = \$\{incomingRevision - 1\}`/,
    "the atomic update predicate must close the selected-row revision race",
  );
  assert.match(
    route,
    /jsonb_typeof\([^)]*details[^)]*CARE_ENTRY_SYNC_REVISION_KEY[^)]*\) = 'number'/,
    "SQL and domain revision parsing must both reject string revisions",
  );
  assert.match(
    route,
    /trunc\(\([^)]*CARE_ENTRY_SYNC_REVISION_KEY[^)]*\)::numeric\)/,
    "SQL and domain revision parsing must both reject fractional revisions",
  );
  assert.match(
    careContext,
    /clientSyncProtocol:\s*CARE_ENTRY_SYNC_PROTOCOL/,
    "every mobile care-entry PATCH must identify the guarded revision protocol",
  );
  assert.match(
    careContext,
    /prepareCareEntryForOfflineEdit<Entry>\(\s*current,\s*mutablePatch,\s*pendingSyncPatch,/,
    "signed-out edits must persist the merged field-level sync journal",
  );
  assert.match(
    careContext,
    /decideCareEntryEditSyncDisposition\(\s*current,\s*signedInRef\.current,\s*\)/,
    "owner edits must use the auth-aware sync disposition contract",
  );
  assert.doesNotMatch(
    careContext,
    /signedInRef\.current\s*&&\s*requiresCareEntrySyncReview\(current\)/,
    "sign-out must not let a legacy row acquire an incomplete field journal",
  );
});

test("household provisioning and auth errors stay documented and typed", () => {
  const route = readHouseholdRouteSource();
  const auth = read("artifacts/api-server/src/lib/auth.ts");
  const household = read("artifacts/api-server/src/lib/household.ts");
  const activeHouseholdIdentity = read(
    "artifacts/api-server/src/lib/household-active-identity.ts",
  );
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSignature = canonicalGeneratedTypeScript(reactClient);

  const getMeRouteBlock = section(
    route,
    'router.get("/me", requireAuth',
    'router.patch("/me", requireAuth',
  );

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
    "  /household/members/{id}:",
  );
  const joinRouteBlock = section(
    route,
    'router.post("/household/join", requireAuth',
    "const runHouseholdScopedOperation",
  );

  assert.match(
    auth,
    /res\.status\(401\)\.json\(\{ error: "Unauthorized" \}\)/,
    "requireAuth should return ApiError-shaped 401 bodies",
  );
  assert.match(
    household,
    /default household \+ membership \+ care state/,
    "household provisioning should keep first-login care-state bootstrap documented",
  );
  assert.match(
    route,
    /router\.get\("\/me", requireAuth/,
    "getMe must stay authenticated",
  );
  assert.match(
    getMeRouteBlock,
    /res\.set\("Cache-Control", "private, no-store"\)/,
    "getMe must prevent a fresh auth/household authority response from being cached",
  );
  assert.match(
    route,
    /router\.patch\("\/me", requireAuth/,
    "updateMe must stay authenticated",
  );
  assert.match(
    route,
    /router\.patch\(\s*"\/household"\s*,\s*requireAuth/,
    "updateHousehold must stay authenticated",
  );
  assert.match(
    route,
    /router\.post\("\/household\/join", requireAuth/,
    "joinHousehold must stay authenticated",
  );
  assert.match(
    route,
    /UpdateMeBody\.safeParse/,
    "updateMe should still validate profile payloads",
  );
  assert.match(
    route,
    /UpdateHouseholdBody\.safeParse/,
    "updateHousehold should still validate household payloads",
  );
  assert.match(
    route,
    /JoinHouseholdBody\.safeParse/,
    "joinHousehold should still validate invite payloads",
  );
  assert.match(
    joinRouteBlock,
    /Durable invitation code not found/,
    "joinHousehold must distinguish the durable invitation-only missing-code error",
  );
  assert.doesNotMatch(
    joinRouteBlock,
    /from\(householdsTable\)[\s\S]*inviteCode/,
    "joinHousehold must never fall back to the reusable legacy household credential",
  );
  assert.match(
    getMeBlock,
    /"401":/,
    "OpenAPI must document unauthenticated getMe errors",
  );
  assert.match(
    updateMeBlock,
    /"400":/,
    "OpenAPI must document invalid profile update payload errors",
  );
  assert.match(
    updateMeBlock,
    /"401":/,
    "OpenAPI must document unauthenticated profile update errors",
  );
  assert.match(
    updateHouseholdBlock,
    /"400":/,
    "OpenAPI must document invalid household update payload errors",
  );
  assert.match(
    updateHouseholdBlock,
    /"401":/,
    "OpenAPI must document unauthenticated household update errors",
  );
  assert.match(
    joinHouseholdBlock,
    /"400":/,
    "OpenAPI must document invalid invite payload errors",
  );
  assert.match(
    joinHouseholdBlock,
    /"401":/,
    "OpenAPI must document unauthenticated join errors",
  );
  assert.match(
    joinHouseholdBlock,
    /"403":[\s\S]*?#\/components\/schemas\/ApiError/,
    "OpenAPI must document invitation-policy join denials as ApiError",
  );
  assert.match(
    joinHouseholdBlock,
    /"404":/,
    "OpenAPI must keep documenting missing invite errors",
  );
  assert.match(
    joinHouseholdBlock,
    /"409":[\s\S]*?#\/components\/schemas\/ApiError/,
    "OpenAPI must document atomic join authority conflicts as ApiError",
  );
  assert.match(
    activeHouseholdIdentity,
    /readonly status: 403 \| 409 \| 412 \| 428/,
    "join commit errors must keep their actual policy-denial and transactional-conflict statuses explicit",
  );
  assert.match(
    route,
    /error instanceof HouseholdJoinCommitError[\s\S]*res\.status\(error\.status\)\.json\(\{ error: error\.message \}\)/,
    "join routes must preserve typed join-commit status and ApiError bodies",
  );
  assert.match(
    reactSignature,
    /getGetMeQueryOptions = <TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<ApiError>>/,
    "React API getMe query must type auth errors as ApiError",
  );
  assert.match(
    reactSignature,
    /GetMeQueryError = ErrorType<ApiError>/,
    "React API getMe query error alias must expose auth error bodies",
  );
  assert.match(
    reactSignature,
    /getUpdateMeMutationOptions = <TError = ErrorType<ApiError>/,
    "React API updateMe mutation must type validation/auth errors as ApiError",
  );
  assert.match(
    reactSignature,
    /UpdateMeMutationError = ErrorType<ApiError>/,
    "React API updateMe mutation error alias must expose validation/auth error bodies",
  );
  assert.match(
    reactSignature,
    /getUpdateHouseholdMutationOptions = <TError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API updateHousehold mutation must preserve validation/auth errors and expose household capability failures",
  );
  assert.match(
    reactSignature,
    /UpdateHouseholdMutationError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API updateHousehold mutation error alias must expose validation/auth and household capability bodies",
  );
  assert.match(
    reactSignature,
    /JoinHouseholdMutationError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API joinHousehold mutation error alias must preserve invalid/auth/not-found and household capability bodies",
  );
});

test("active household authority keeps schema and provider migration membership-safe", () => {
  const usersSchema = read("lib/db/src/schema/users.ts");
  const migration = read("supabase/migrations/0004_users_active_household.sql");
  const migrationCommentText = migration.replace(/^--\s?/gm, "");
  const invalidPointerCleanup = section(
    migration,
    "update public.users as app_user\nset active_household_id = null",
    "-- Existing accounts deterministically retain their earliest membership",
  );
  const deterministicBackfill = section(
    migration,
    "with earliest_membership as (",
    "do $$",
  );
  const foreignKeyBlock = section(
    migration,
    "do $$",
    "create index if not exists users_active_household_id_idx",
  );

  assert.match(
    usersSchema,
    /activeHouseholdId:\s*uuid\("active_household_id"\)\.references\(\s*\(\) => householdsTable\.id,\s*\{ onDelete: "set null" \},\s*\)/,
    "users must expose a nullable active-household pointer with SET NULL deletion behavior",
  );
  assert.match(
    migrationCommentText,
    /reviewable repository evidence only until it is applied to the approved\s+provider and that application is captured in release proof/,
    "the unapplied provider migration boundary must remain explicit",
  );
  assert.match(
    migration,
    /add column if not exists active_household_id uuid/,
    "the provider migration must add the durable active-household pointer",
  );
  assert.match(
    invalidPointerCleanup,
    /where member\.user_id = app_user\.id\s+and member\.household_id = app_user\.active_household_id/,
    "migration cleanup must retain pointers only for an exact same-user membership",
  );
  assert.match(
    deterministicBackfill,
    /order by member\.user_id, member\.created_at, member\.id/,
    "existing users must backfill deterministically from their earliest membership",
  );
  assert.match(
    deterministicBackfill,
    /where app_user\.id = earliest_membership\.user_id\s+and app_user\.active_household_id is null/,
    "backfill must never overwrite an already-valid active-household choice",
  );
  assert.match(
    foreignKeyBlock,
    /foreign key \(active_household_id\)\s+references public\.households\(id\)\s+on delete set null/,
    "provider storage must clear a pointer when its household is deleted",
  );
});

test("WoofGuide provider actions keep auth, rate-limit, and local-fallback contracts typed", () => {
  const careHelperRoute = read(
    "artifacts/api-server/src/routes/care-helper.ts",
  );
  const woofguideEventsRoute = read(
    "artifacts/api-server/src/routes/woofguide-events.ts",
  );
  const woofguideEvents = read("artifacts/api-server/src/woofguide-events.js");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSignature = canonicalGeneratedTypeScript(reactClient);

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

  assert.match(
    careHelperRoute,
    /router\.post\("\/care-helper", requireAuth/,
    "care-helper questions must stay authenticated",
  );
  assert.match(
    careHelperRoute,
    /makeRateLimiter\(\{ maxPerWindow: 12, globalMaxPerWindow: 120 \}\)/,
    "care-helper provider calls must keep their rate limiter",
  );
  assert.match(
    careHelperRoute,
    /if \(ai && rateLimited\(ip\)\)/,
    "care-helper should rate-limit provider calls without blocking local fallback",
  );
  assert.match(
    careHelperRoute,
    /mode:\s*"local"/,
    "care-helper must keep the local fallback mode truthful",
  );
  assert.match(
    careHelperRoute,
    /AI assistant isn't available/,
    "care-helper local fallback should not imply live AI",
  );

  assert.match(
    woofguideEventsRoute,
    /router\.get\("\/woofguide-events", requireAuth/,
    "WoofGuide events status must stay authenticated",
  );
  assert.match(
    woofguideEventsRoute,
    /router\.post\("\/woofguide-events", requireAuth/,
    "WoofGuide event creation must stay authenticated",
  );
  assert.match(
    woofguideEventsRoute,
    /makeRateLimiter\(\{ maxPerWindow: 8, globalMaxPerWindow: 60 \}\)/,
    "WoofGuide event creation must keep its rate limiter",
  );
  assert.match(
    woofguideEvents,
    /No key configured: always return curated local events/,
    "WoofGuide events must keep the no-key local curation boundary",
  );
  assert.match(
    woofguideEvents,
    /mode:\s*"local"/,
    "WoofGuide events must keep local mode when provider calls are unavailable",
  );

  assert.match(
    careHelperPostBlock,
    /"401":/,
    "OpenAPI must document unauthenticated care-helper question errors",
  );
  assert.match(
    careHelperPostBlock,
    /"429":/,
    "OpenAPI must document care-helper provider rate-limit errors",
  );
  assert.doesNotMatch(
    careHelperPostBlock,
    /"501":/,
    "OpenAPI must not claim local fallback is an unconfigured-provider failure",
  );
  assert.match(
    woofguideEventsGetBlock,
    /"401":/,
    "OpenAPI must document unauthenticated WoofGuide events status errors",
  );
  assert.match(
    woofguideEventsPostBlock,
    /"401":/,
    "OpenAPI must document unauthenticated WoofGuide event creation errors",
  );
  assert.match(
    woofguideEventsPostBlock,
    /"429":/,
    "OpenAPI must document WoofGuide event creation rate-limit errors",
  );

  assert.match(
    reactSignature,
    /getAskCareHelperMutationOptions = <TError = ErrorType<ApiError \| CareHelperError>/,
    "React API care-helper mutation must type auth/rate-limit errors separately from provider failures",
  );
  assert.match(
    reactSignature,
    /AskCareHelperMutationError = ErrorType<ApiError \| CareHelperError>/,
    "React API care-helper mutation error alias must expose auth, rate-limit, and provider error bodies",
  );
  assert.match(
    reactSignature,
    /getGetWoofguideEventsStatusQueryOptions = <TData = Awaited<ReturnType<typeof getWoofguideEventsStatus>>, TError = ErrorType<ApiError>>/,
    "React API WoofGuide events status query must type auth errors as ApiError",
  );
  assert.match(
    reactSignature,
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
  const careStateRoute = readCareStateRouteSource();
  const careEntriesRoute = readCareEntriesRouteSource();
  const scopedOperation = readHouseholdScopedOperationSource();
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSignature = canonicalGeneratedTypeScript(reactClient);
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const zodApi = read("lib/api-zod/src/generated/api.ts");

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
    "  /care-entries/tombstones:",
  );
  const deleteCareEntryByClientKeyBlock = section(
    openapi,
    "    delete:\n      operationId: deleteCareEntryByClientKey",
    "  /care-entries/{id}:",
  );
  const updateCareEntryBlock = section(
    openapi,
    "    patch:\n      operationId: updateCareEntry",
    "      operationId: deleteCareEntry\n",
  );
  const deleteCareEntryBlock = section(
    openapi,
    "      operationId: deleteCareEntry\n",
    "\ncomponents:",
  );

  assert.match(
    careStateRoute,
    /router\.get\("\/care-state", requireAuth/,
    "care-state reads must stay authenticated",
  );
  assert.match(
    careStateRoute,
    /router\.put\("\/care-state", requireAuth/,
    "care-state writes must stay authenticated",
  );
  assert.match(
    careStateRoute,
    /runExpectedCareHouseholdOperation/,
    "care-state reads and writes must require an exact expected-household capability",
  );
  assert.match(
    careStateRoute,
    /runHouseholdScopedOperation/,
    "care-state should validate the authenticated user and membership in its scoped transaction",
  );
  assert.match(
    careStateRoute,
    /where\(eq\(careStateTable\.householdId, scope\.householdId\)\)/,
    "care-state reads and writes must stay scoped to the active household",
  );
  assert.match(
    careStateRoute,
    /eq\(careStateTable\.version, parsed\.data\.version\)/,
    "care-state optimistic concurrency must qualify the UPDATE with the expected version",
  );
  assert.match(
    careStateRoute,
    /await input\.runHouseholdScopedOperation\([\s\S]*?reply\.flush\(input\.res\)/,
    "Care responses must remain deferred until the provider transaction commits",
  );
  for (const boundary of [
    /lockUser\(input\.userId\)/,
    /lockMembership\(/,
    /getCurrentTime\(\)/,
    /database: transaction\.database/,
    /\.for\("share"\)/,
  ]) {
    assert.match(
      scopedOperation,
      boundary,
      "Care access and table work must share one locked provider transaction",
    );
  }

  for (const route of [
    /router\.get\(\s*"\/care-entries",\s*requireAuth/,
    /router\.post\(\s*"\/care-entries",\s*requireAuth/,
    /router\.patch\(\s*"\/care-entries\/:id",\s*requireAuth/,
    /router\.delete\(\s*"\/care-entries\/client-key\/:clientKey",\s*requireAuth/,
    /router\.delete\(\s*"\x2Fcare-entries\/:id",\s*requireAuth/,
  ]) {
    assert.match(
      careEntriesRoute,
      route,
      "care-entry list/create/update/delete routes must stay authenticated",
    );
  }
  assert.match(
    careEntriesRoute,
    /eq\(careEntriesTable\.householdId, householdId\)/,
    "care-entry queries and mutations must stay household-scoped",
  );
  assert.match(
    careEntriesRoute,
    /householdId,\s*\n\s*petId:/,
    "care-entry creates must write the authenticated household id",
  );
  assert.match(
    careEntriesRoute,
    /caregiverUserId:\s*userId/,
    "care-entry creates must preserve the authenticated caregiver id",
  );

  for (const routeBlock of [
    getCareStateBlock,
    putCareStateBlock,
    listCareEntriesBlock,
    createCareEntryBlock,
    deleteCareEntryByClientKeyBlock,
    updateCareEntryBlock,
    deleteCareEntryBlock,
  ]) {
    assert.match(
      routeBlock,
      /#\/components\/parameters\/ExpectedHouseholdId/,
      "every Care operation must require the expected-household header",
    );
    assert.match(
      routeBlock,
      /"412":/,
      "every Care operation must document household mismatch",
    );
    assert.match(
      routeBlock,
      /"428":/,
      "every Care operation must document a missing household capability",
    );
  }

  assert.match(
    reactSignature,
    /getCareState = async \(headers: GetCareStateHeaders, options\?: RequestInit\)/,
    "generated care-state reads must expose a required typed header separately from RequestInit",
  );
  assert.match(
    reactClient,
    /createCareEntry = async \(\s*careEntryInput: CareEntryInput,\s*headers: CreateCareEntryHeaders,\s*options\?: RequestInit,\s*\)/,
    "generated care-entry writes must expose a required typed header separately from RequestInit",
  );
  assert.match(
    reactSchemas,
    /export interface CareStateEnvelope \{[\s\S]*?householdId: string;/,
    "care-state responses must expose the authoritative household id",
  );
  assert.match(
    reactSchemas,
    /export interface CareEntry \{[\s\S]*?householdId: string;/,
    "care-entry responses must expose the authoritative household id",
  );
  for (const validator of [
    "GetCareStateHeader",
    "PutCareStateHeader",
    "ListCareEntriesHeader",
    "ListCareEntryTombstonesHeader",
    "CreateCareEntryHeader",
    "UpdateCareEntryHeader",
    "DeleteCareEntryHeader",
  ]) {
    assert.match(
      zodApi,
      new RegExp(`export const ${validator} = zod\\.object`),
      `${validator} must validate the required expected-household capability`,
    );
  }

  assert.match(
    getCareStateBlock,
    /"401":/,
    "OpenAPI must document unauthenticated care-state reads",
  );
  assert.match(
    getCareStateBlock,
    /"404":/,
    "OpenAPI must document missing active-household care-state reads",
  );
  assert.match(
    putCareStateBlock,
    /"401":/,
    "OpenAPI must document unauthenticated care-state writes",
  );
  assert.match(
    listCareEntriesBlock,
    /"401":/,
    "OpenAPI must document unauthenticated care-entry list reads",
  );
  assert.match(
    createCareEntryBlock,
    /"401":/,
    "OpenAPI must document unauthenticated care-entry creates",
  );
  assert.match(
    updateCareEntryBlock,
    /"401":/,
    "OpenAPI must document unauthenticated care-entry updates",
  );
  assert.match(
    deleteCareEntryByClientKeyBlock,
    /"401":/,
    "OpenAPI must document unauthenticated client-key deletion commits",
  );
  assert.match(
    deleteCareEntryBlock,
    /"401":/,
    "OpenAPI must document unauthenticated care-entry deletes",
  );

  assert.match(
    reactSignature,
    /useGetCareStateQueryOptions = <TData = Awaited<ReturnType<typeof getCareState>>, TError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>>/,
    "React API care-state query must preserve auth/not-found errors and expose household capability failures",
  );
  assert.match(
    reactSignature,
    /GetCareStateQueryError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API care-state query error alias must expose auth/not-found and household capability bodies",
  );
  assert.match(
    reactSignature,
    /useListCareEntriesQueryOptions = <TData = Awaited<ReturnType<typeof listCareEntries>>, TError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>>/,
    "React API care-entry list query must preserve auth errors and expose household capability failures",
  );
  assert.match(
    reactSignature,
    /ListCareEntriesQueryError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API care-entry list query error alias must expose auth and household capability bodies",
  );
});

test("care entry writes keep role-aware trust and read-only boundaries", () => {
  const careEntriesRoute = readCareEntriesRouteSource();
  const scopedOperation = readHouseholdScopedOperationSource();
  const roleAuthority = read(
    "artifacts/api-server/src/lib/household-role-authority.ts",
  );
  const rolePolicy = read(
    "artifacts/api-server/src/lib/care-entry-authorization.ts",
  );
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSignature = canonicalGeneratedTypeScript(reactClient);

  const createCareEntryBlock = section(
    openapi,
    "    post:\n      operationId: createCareEntry",
    "  /care-entries/tombstones:",
  );
  const deleteCareEntryByClientKeyBlock = section(
    openapi,
    "    delete:\n      operationId: deleteCareEntryByClientKey",
    "  /care-entries/{id}:",
  );
  const updateCareEntryBlock = section(
    openapi,
    "    patch:\n      operationId: updateCareEntry",
    "      operationId: deleteCareEntry\n",
  );
  const deleteCareEntryBlock = section(
    openapi,
    "      operationId: deleteCareEntry\n",
    "\ncomponents:",
  );

  assert.match(
    scopedOperation,
    /resolveHouseholdMembershipAuthority\(/,
    "the scoped operation must derive write authority from the locked exact membership",
  );
  assert.match(
    careEntriesRoute,
    /role: scope\.authorizationRole/,
    "care-entry writes should use the atomically validated membership role",
  );
  assert.match(
    roleAuthority,
    /householdAccessAllowed: false/,
    "unknown and expired membership roles must fail closed before a Care write",
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
    /reply\.status\(403\)\.json\(\{ error: policy\.reason \}\)/,
    "care-entry writes should return ApiError-shaped 403 bodies when a role is not allowed",
  );

  assert.match(
    rolePolicy,
    /read-only/i,
    "role policy should define read-only helper boundaries",
  );
  assert.match(
    rolePolicy,
    /vet viewer/i,
    "role policy should name vet viewer as read-only",
  );
  assert.match(
    rolePolicy,
    /kid-log/,
    "role policy should keep kid logs pending adult confirmation",
  );
  assert.match(
    rolePolicy,
    /helper-log/,
    "role policy should keep sitter and trainer logs pending adult confirmation",
  );
  assert.match(
    rolePolicy,
    /safety-critical/,
    "role policy should keep medication and serious health logs adult-reviewable",
  );
  assert.match(
    rolePolicy,
    /photoProofPolicy:\s*"medication-proof"/,
    "medication writes should keep proof policy metadata",
  );
  assert.match(
    rolePolicy,
    /trustState:\s*"pending-confirmation"/,
    "restricted or serious logs should not be silently confirmed",
  );

  assert.match(
    createCareEntryBlock,
    /"403":/,
    "OpenAPI must document forbidden care-entry creates for read-only roles",
  );
  assert.match(
    updateCareEntryBlock,
    /"403":/,
    "OpenAPI must document forbidden care-entry updates for read-only roles",
  );
  assert.match(
    deleteCareEntryByClientKeyBlock,
    /"403":/,
    "OpenAPI must document forbidden client-key deletion commits for read-only roles",
  );
  assert.match(
    deleteCareEntryBlock,
    /"403":/,
    "OpenAPI must document forbidden care-entry deletes for read-only roles",
  );
  assert.match(
    reactSignature,
    /DeleteCareEntryByClientKeyMutationError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API client-key deletion must keep role-policy and household capability errors typed",
  );
  assert.match(
    reactSignature,
    /CreateCareEntryMutationError = ErrorType<ApiError \| CareEntryCreateRevoked \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API create mutation must keep role-policy and household capability errors typed",
  );
  assert.match(
    reactSignature,
    /UpdateCareEntryMutationError = ErrorType<ApiError \| CareEntryConflict \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API update mutation must keep role-policy, conflict, and household capability errors typed",
  );
  assert.match(
    reactSignature,
    /DeleteCareEntryMutationError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API delete mutation must keep role-policy and household capability errors typed",
  );
});

test("household member role mutations keep owner-only and revocation contracts", () => {
  const householdRoute = readHouseholdRouteSource();
  const householdPolicy = read(
    "artifacts/api-server/src/lib/household-authorization.ts",
  );
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodSignature = canonicalGeneratedTypeScript(zodApi);
  const zodTypesIndex = read("lib/api-zod/src/generated/types/index.ts");
  const zodMemberRole = read(
    "lib/api-zod/src/generated/types/householdMemberRole.ts",
  );
  const zodMemberRoleSignature = canonicalGeneratedTypeScript(zodMemberRole);
  const zodRoleConsumers = [
    "member.ts",
    "householdInvitation.ts",
    "householdInvitationCreateInput.ts",
    "myHouseholdMembership.ts",
    "householdMemberUpdate.ts",
    "householdMemberUpdateRole.ts",
    "myHouseholdMembershipRole.ts",
  ].map((file) =>
    read(`lib/api-zod/src/generated/types/${file}`),
  );
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const reactSchemasSignature = canonicalGeneratedTypeScript(reactSchemas);
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactClientSignature = canonicalGeneratedTypeScript(reactClient);

  const memberBlock = section(
    openapi,
    "  /household/members/{id}:",
    "  /care-state:",
  );

  assert.match(
    householdRoute,
    /router\.patch\(\s*"\/household\/members\/:id"\s*,\s*requireAuth/,
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
    /parsed\.data\.role === undefined[\s\S]{0,100}?parsed\.data\.displayName === undefined/,
    "role updates should reject empty member patches instead of issuing no-op writes",
  );
  assert.match(
    householdRoute,
    /RevokeHouseholdMemberParams\.safeParse/,
    "revocation should validate member ids",
  );
  assert.match(
    householdRoute,
    /runHouseholdScopedRouteOperation\(\{[\s\S]*runHouseholdScopedOperation/,
    "member mutations should use the atomically locked actor identity and membership",
  );
  assert.match(
    householdRoute,
    /assertHouseholdMemberMutationAllowed\(/,
    "member mutations should use the owner/admin authorization policy",
  );
  assert.match(
    householdRoute,
    /eq\(householdMembersTable\.householdId, scope\.householdId\)/,
    "member mutations must stay scoped to the active household",
  );
  assert.match(
    householdRoute,
    /reply\.status\(403\)\.json\(\{ error: policy\.reason \}\)/,
    "member mutations should return ApiError-shaped 403 bodies",
  );

  assert.match(
    householdPolicy,
    /owner\/admin/i,
    "role policy should name owner/admin-only authority",
  );
  assert.match(
    householdPolicy,
    /Access Pass/i,
    "role policy should stay aligned with future Access Pass scopes",
  );
  assert.match(
    householdPolicy,
    /helper revocation/i,
    "role policy should explicitly cover helper revocation",
  );
  assert.match(
    householdPolicy,
    /vet viewer/i,
    "role policy should keep vet viewer as a managed read-only role",
  );
  assert.match(
    householdPolicy,
    /targetIsSelf/,
    "role policy should prevent self-revocation or self-demotion",
  );

  assert.match(
    memberBlock,
    /operationId: updateHouseholdMember/,
    "OpenAPI must document household member role updates",
  );
  assert.match(
    memberBlock,
    /operationId: revokeHouseholdMember/,
    "OpenAPI must document household member revocation",
  );
  for (const [schema, start, end] of [
    ["Member", "    Member:", "    Me:"],
    [
      "HouseholdInvitation",
      "    HouseholdInvitation:",
      "    HouseholdInvitationListFilters:",
    ],
    [
      "HouseholdInvitationCreateInput",
      "    HouseholdInvitationCreateInput:",
      "    HouseholdInvitationRevokeInput:",
    ],
    [
      "MyHouseholdMembership",
      "    MyHouseholdMembership:",
      "    MyHouseholdMembershipList:",
    ],
    [
      "HouseholdMemberUpdate",
      "    HouseholdMemberUpdate:",
      "    AccessPassActivationInput:",
    ],
  ]) {
    assert.match(
      section(openapi, start, end),
      /role:\s*\n\s*\$ref: "#\/components\/schemas\/HouseholdMemberRole"/,
      `${schema}.role must reuse the canonical household role component`,
    );
  }
  assert.match(
    section(
      openapi,
      "    HouseholdMemberRole:",
      "    HouseholdMemberUpdateRole:",
    ),
    /enum: \[owner, adult, teen, kid, sitter, trainer, walker, vet viewer\]/,
    "OpenAPI must define the exact canonical role set once",
  );
  for (const alias of [
    ["HouseholdMemberUpdateRole", "    MyHouseholdMembershipRole:"],
    ["MyHouseholdMembershipRole", "    Member:"],
  ]) {
    assert.match(
      section(openapi, `    ${alias[0]}:`, alias[1]),
      /deprecated: true[\s\S]*?\$ref: "#\/components\/schemas\/HouseholdMemberRole"/,
      `${alias[0]} must remain a deliberate deprecated compatibility alias`,
    );
  }
  for (const status of ['"400"', '"401"', '"403"', '"404"']) {
    assert.match(
      memberBlock,
      new RegExp(`${status}:`),
      `OpenAPI must document member mutation ${status} responses`,
    );
  }
  assert.match(
    zodApi,
    /export const UpdateHouseholdMemberParams/,
    "Zod must export update-member params",
  );
  assert.match(
    zodApi,
    /export const UpdateHouseholdMemberBody/,
    "Zod must export update-member body",
  );
  assert.match(
    zodSignature,
    /export const UpdateHouseholdMemberBody = zod\.object\(\{"role": zod\.enum\(\["owner", "adult", "teen", "kid", "sitter", "trainer", "walker", "vet viewer"\]\)\.optional\(\)/,
    "Zod must reject unknown household roles",
  );
  assert.match(
    zodMemberRoleSignature,
    /export const HouseholdMemberRole = \{"owner": "owner", "adult": "adult", "teen": "teen", "kid": "kid", "sitter": "sitter", "trainer": "trainer", "walker": "walker", "vet_viewer": "vet viewer"\}as const/,
    "the generated component type must expose the exact canonical role enum",
  );
  assert.match(
    reactSchemasSignature,
    /export const HouseholdMemberRole = \{"owner": "owner", "adult": "adult", "teen": "teen", "kid": "kid", "sitter": "sitter", "trainer": "trainer", "walker": "walker", "vet_viewer": "vet viewer"\}as const/,
    "React models must expose the exact canonical role enum",
  );
  assert.match(
    zodTypesIndex,
    /export \* from ["']\.\/householdMemberRole["']/,
    "the generated type index must export the canonical role",
  );
  for (const consumer of zodRoleConsumers) {
    assert.match(
      consumer,
      /import type \{ HouseholdMemberRole \} from ["']\.\/householdMemberRole["']/,
      "every role model and compatibility alias must import the canonical role",
    );
    assert.doesNotMatch(
      consumer,
      /export const (?:HouseholdMemberUpdateRole|MyHouseholdMembershipRole) = \{/,
      "compatibility role types must not duplicate the canonical enum",
    );
  }
  assert.match(
    zodApi,
    /export const RevokeHouseholdMemberParams/,
    "Zod must export revoke-member params",
  );
  assert.match(
    reactSchemas,
    /role\?: HouseholdMemberRole/,
    "React schemas must expose typed household member roles",
  );
  assert.match(
    reactClientSignature,
    /UpdateHouseholdMemberMutationError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API update-member mutation must preserve ApiError and expose household capability failures",
  );
  assert.match(
    reactClientSignature,
    /RevokeHouseholdMemberMutationError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React API revoke-member mutation must preserve ApiError and expose household capability failures",
  );
});

test("household invitations and Access Pass mutations emit typed audit contracts", () => {
  const householdRoute = readHouseholdRouteSource();
  const householdJoin = read("artifacts/api-server/src/lib/household-join.ts");
  const householdJoinStore = read(
    "artifacts/api-server/src/lib/household-join-drizzle-store.ts",
  );
  const activeHouseholdIdentity = read(
    "artifacts/api-server/src/lib/household-active-identity.ts",
  );
  const accessPassPolicy = read(
    "artifacts/api-server/src/lib/household-access-pass.ts",
  );
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodSignature = canonicalGeneratedTypeScript(zodApi);
  const zodPublicIndex = read("lib/api-zod/src/index.ts");
  const zodTypesIndex = read("lib/api-zod/src/generated/types/index.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSignature = canonicalGeneratedTypeScript(reactClient);

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
    householdJoin,
    /buildHouseholdAuditEvent\(\s*\{[\s\S]*action:\s*"invitation-accepted"/,
    "the transactional join module should build an invitation-accepted audit event",
  );
  assert.match(
    activeHouseholdIdentity,
    /const invitationRole = parseHouseholdMemberRole\(invitation\.role\)/,
    "the locked invitation role must be validated and canonicalized before membership creation",
  );
  assert.match(
    activeHouseholdIdentity,
    /transaction\.createMembership\(\{[\s\S]*role: invitationRole/,
    "new memberships must receive that exact locked invitation role",
  );
  assert.match(
    householdRoute,
    /commitHouseholdJoin\(\{[\s\S]*expectedSourceHouseholdId,[\s\S]*invitationId:\s*invitation\.id/,
    "the authenticated join route must compose the transaction with source capability and durable invitation identity",
  );
  assert.match(
    householdJoin,
    /targetRole:\s*inThisHousehold \? membership\.role : null,[\s\S]*nextRole:\s*membership\.role/,
    "existing-member audit truth must preserve the role that is actually persisted",
  );
  assert.match(
    householdJoinStore,
    /transaction:\s*\(work\)\s*=>[\s\S]*input\.database\.transaction/,
    "membership, invitation acceptance, audit, care state, and active authority must share one database transaction",
  );
  assert.match(
    householdJoinStore,
    /transaction\s*\.insert\(householdAuditEventsTable\)[\s\S]*buildHouseholdAuditInsert\(event\)/,
    "the invitation-accepted audit event must be persisted inside the join transaction",
  );
  assert.match(
    householdRoute,
    /router\.post\(\s*"\/household\/access-passes\/activate"\s*,\s*requireAuth/,
    "Access Pass activation should be an authenticated route",
  );
  assert.match(
    householdRoute,
    /router\.post\(\s*"\/household\/access-passes\/revoke"\s*,\s*requireAuth/,
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
    /eq\(householdMembersTable\.householdId, scope\.householdId\)/,
    "Access Pass mutations must stay scoped to the active household",
  );
  assert.match(
    householdRoute,
    /reply\.status\(403\)\.json\(\{ error: policy\.reason \}\)/,
    "Access Pass denials should use ApiError-shaped bodies",
  );
  assert.match(
    householdRoute,
    /buildHouseholdAuditEvent\(\s*\{[\s\S]*action:\s*"access-pass-activated"/,
    "Access Pass activation should emit an audit event",
  );
  assert.match(
    householdRoute,
    /buildHouseholdAuditEvent\(\s*\{[\s\S]*action:\s*"access-pass-revoked"/,
    "Access Pass revocation should emit an audit event",
  );

  assert.match(
    accessPassPolicy,
    /owner\/admin/i,
    "Access Pass policy should keep owner/admin-only authority explicit",
  );
  assert.match(
    accessPassPolicy,
    /helper audit/i,
    "Access Pass policy should describe helper audit trail readiness",
  );
  assert.match(
    accessPassPolicy,
    /invitation-accepted/,
    "audit helper should support invitation acceptance events",
  );
  assert.match(
    accessPassPolicy,
    /access-pass-activated/,
    "audit helper should support activation events",
  );
  assert.match(
    accessPassPolicy,
    /access-pass-revoked/,
    "audit helper should support revocation events",
  );
  assert.match(
    accessPassPolicy,
    /vet viewer/i,
    "Access Pass policy should keep vet viewer as a read-only helper role",
  );
  assert.match(
    accessPassPolicy,
    /expiresAt/,
    "Access Pass activation should carry optional expiration metadata for future enforcement",
  );

  assert.match(
    joinHouseholdBlock,
    /HouseholdJoinResponse/,
    "OpenAPI join should return a typed audit-aware response",
  );
  assert.match(
    joinHouseholdBlock,
    /HouseholdAuditEvent/,
    "OpenAPI join should document the invitation audit event",
  );
  assert.match(
    activateBlock,
    /operationId: activateHouseholdAccessPass/,
    "OpenAPI must document Access Pass activation",
  );
  assert.match(
    revokeBlock,
    /operationId: revokeHouseholdAccessPass/,
    "OpenAPI must document Access Pass revocation",
  );
  for (const block of [activateBlock, revokeBlock]) {
    for (const status of ['"400"', '"401"', '"403"', '"404"']) {
      assert.match(
        block,
        new RegExp(`${status}:`),
        `OpenAPI must document Access Pass ${status} responses`,
      );
    }
  }
  assert.match(
    openapi,
    /HouseholdAccessPassMutationResponse:/,
    "OpenAPI must document Access Pass mutation responses",
  );
  assert.match(
    openapi,
    /HouseholdAuditEvent:/,
    "OpenAPI must document household audit events",
  );

  const joinResponse = section(
    zodSignature,
    "export const JoinHousehold200Response =",
    "export const JoinHousehold400Response =",
  );
  const activationBody = section(
    zodSignature,
    "export const ActivateHouseholdAccessPassBody =",
    "export const activateHouseholdAccessPass200ResponseOneHouseholdInviteCodeMax",
  );
  const activationResponse = section(
    zodSignature,
    "export const ActivateHouseholdAccessPass200Response =",
    "export const ActivateHouseholdAccessPass400Response =",
  );
  assert.match(
    joinResponse,
    /"auditEvent": zod\.object\(\{"id": zod\.string\(\), "action": zod\.enum\(\["invitation-created", "invitation-accepted", "invitation-revoked", "member-role-updated", "member-revoked", "access-pass-activated", "access-pass-revoked"\]\), "lifecycleState": zod\.enum\(\["invite-created", "invite-accepted", "invite-revoked", "member-updated", "member-revoked", "access-pass-active", "access-pass-revoked", "access-pass-expired"\]\),[\s\S]*?"storage": zod\.enum\(\["provider-durable"\]\), "boundary": zod\.string\(\)/,
    "the shipping join 200 validator must preserve the exact durable audit envelope",
  );
  assert.match(
    activationBody,
    /"memberId": zod\.string\(\)\.min\(1\), "role": zod\.enum\(\["sitter", "trainer", "walker", "vet viewer"\]\),[\s\S]*?"expiresAt": zod\.string\(\)\.nullish\(\)/,
    "the shipping Access Pass body must constrain helper role and expiry fields",
  );
  assert.match(
    activationResponse,
    /"accessPass": zod\.object\(\{"memberId": zod\.string\(\), "userId": zod\.string\(\), "role": zod\.enum\(\["sitter", "trainer", "walker", "vet viewer"\]\), "status": zod\.enum\(\["active", "revoked"\]\),[\s\S]*?"auditEvent": zod\.object\(\{[\s\S]*?"storage": zod\.enum\(\["provider-durable"\]\), "boundary": zod\.string\(\)/,
    "the shipping Access Pass 200 validator must preserve pass and audit truth",
  );
  for (const compatibilityAlias of [
    /ActivateHouseholdAccessPassBody as AccessPassActivationBody/,
    /RevokeHouseholdAccessPassBody as AccessPassRevocationBody/,
    /ActivateHouseholdAccessPass200Response as HouseholdAccessPassMutationResponse/,
    /JoinHousehold200Response as HouseholdJoinResponse/,
  ]) {
    assert.match(
      zodPublicIndex,
      compatibilityAlias,
      "the public Zod API must preserve its pre-status-validator compatibility surface",
    );
  }
  for (const componentType of [
    "householdAuditEvent",
    "householdJoinResponse",
    "accessPassActivationInput",
    "accessPassRevocationInput",
    "householdAccessPassMutationResponse",
  ]) {
    assert.match(
      zodTypesIndex,
      new RegExp(`export \\* from ["']\\.\\/${componentType}["']`),
      `generated component types must export ${componentType}`,
    );
  }
  assert.match(
    zodSignature,
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
    assert.match(
      reactSchemas,
      new RegExp(`\\b${typeName}\\b`),
      `${typeName} should be exposed to React clients`,
    );
  }
  assert.match(
    reactSignature,
    /activateHouseholdAccessPass/,
    "React client must expose Access Pass activation",
  );
  assert.match(
    reactSignature,
    /revokeHouseholdAccessPass/,
    "React client must expose Access Pass revocation",
  );
  assert.match(
    reactSignature,
    /ActivateHouseholdAccessPassMutationError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React activation mutation must preserve ApiError and expose household capability bodies",
  );
  assert.match(
    reactSignature,
    /RevokeHouseholdAccessPassMutationError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React revocation mutation must preserve ApiError and expose household capability bodies",
  );
});

test("household invite and Access Pass audit storage has provider-ready lifecycle contracts", () => {
  const householdRoute = readHouseholdRouteSource();
  const accessPassPolicy = read(
    "artifacts/api-server/src/lib/household-access-pass.ts",
  );
  const auditSchema = read("lib/db/src/schema/householdAuditEvents.ts");
  const schemaIndex = read("lib/db/src/schema/index.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodSignature = canonicalGeneratedTypeScript(zodApi);
  const zodPublicIndex = read("lib/api-zod/src/index.ts");
  const zodAuditLifecycleType = read(
    "lib/api-zod/src/generated/types/householdAuditEventLifecycleState.ts",
  );
  const zodAuditLifecycleSignature = canonicalGeneratedTypeScript(
    zodAuditLifecycleType,
  );
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const reactSchemasSignature = canonicalGeneratedTypeScript(reactSchemas);

  assert.match(
    auditSchema,
    /pgTable\("household_audit_events"/,
    "database schema must define durable household audit events",
  );
  assert.match(
    auditSchema,
    /lifecycleState:\s*text\("lifecycle_state"\)/,
    "audit rows must store invite/access-pass lifecycle state",
  );
  assert.match(
    auditSchema,
    /expiresAt:\s*timestamp\("expires_at"/,
    "audit rows must store Access Pass expiration metadata",
  );
  assert.match(
    auditSchema,
    /metadata:\s*jsonb\("metadata"\)/,
    "audit rows must preserve provider/export metadata",
  );
  assert.match(
    schemaIndex,
    /export \* from "\.\/householdAuditEvents"/,
    "database schema index must export household audit events",
  );

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
    /scope\.database\s*\.insert\(householdAuditEventsTable\)\s*\.values\(buildHouseholdAuditInsert\(auditEvent\)\)/,
    "household mutations must persist audit events on the scoped transaction before returning them",
  );
  assert.match(
    householdRoute,
    /assertAccessPassExpiryAllowed\(\s*parsed\.data\.expiresAt/,
    "Access Pass activation must enforce future expiration windows",
  );

  assert.match(
    openapi,
    /lifecycleState:/,
    "OpenAPI must expose household audit lifecycle state",
  );
  assert.match(
    openapi,
    /provider-durable/,
    "OpenAPI must expose durable audit storage status",
  );
  assert.match(
    openapi,
    /access-pass-expired/,
    "OpenAPI must expose expired Access Pass lifecycle state",
  );
  const auditListResponse = section(
    zodSignature,
    "export const ListHouseholdAuditEvents200Response =",
    "export const ListHouseholdAuditEvents400Response =",
  );
  assert.match(
    auditListResponse,
    /"lifecycleState": zod\.enum\(\["invite-created", "invite-accepted", "invite-revoked", "member-updated", "member-revoked", "access-pass-active", "access-pass-revoked", "access-pass-expired"\]\)/,
    "the shipping audit-list 200 validator must enforce every lifecycle state",
  );
  assert.match(
    auditListResponse,
    /"storage": zod\.enum\(\["provider-durable"\]\)/,
    "the shipping audit-list 200 validator must allow only provider-durable rows",
  );
  assert.match(
    zodAuditLifecycleSignature,
    /export const HouseholdAuditEventLifecycleState = \{"invite-created": "invite-created", "invite-accepted": "invite-accepted", "invite-revoked": "invite-revoked", "member-updated": "member-updated", "member-revoked": "member-revoked", "access-pass-active": "access-pass-active", "access-pass-revoked": "access-pass-revoked", "access-pass-expired": "access-pass-expired"\}as const/,
    "the generated component type must preserve the exact audit lifecycle set",
  );
  assert.match(
    reactSchemasSignature,
    /export const HouseholdAuditEventLifecycleState = \{"invite-created": "invite-created", "invite-accepted": "invite-accepted", "invite-revoked": "invite-revoked", "member-updated": "member-updated", "member-revoked": "member-revoked", "access-pass-active": "access-pass-active", "access-pass-revoked": "access-pass-revoked", "access-pass-expired": "access-pass-expired"\}as const/,
    "React schemas must expose typed household audit lifecycle states",
  );
  assert.match(
    zodPublicIndex,
    /HouseholdAuditEventLifecycleState as HouseholdAuditLifecycleState/,
    "the public type barrel must deliberately preserve the legacy audit lifecycle alias",
  );
});

test("household audit review API stays owner-scoped and typed", () => {
  const householdRoute = readHouseholdRouteSource();
  const accessPassPolicy = read(
    "artifacts/api-server/src/lib/household-access-pass.ts",
  );
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodSignature = canonicalGeneratedTypeScript(zodApi);
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSignature = canonicalGeneratedTypeScript(reactClient);

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
    /router\.get\(\s*"\/household\/audit-events"\s*,\s*requireAuth/,
    "audit review should be an authenticated owner/admin route",
  );
  assert.match(
    householdRoute,
    /ListHouseholdAuditEventsQueryParams\.safeParse\(req\.query\)/,
    "audit review should validate query filters before querying durable audit rows",
  );
  assert.match(
    householdRoute,
    /runHouseholdScopedRouteOperation\(\{[\s\S]*runHouseholdScopedOperation/,
    "audit review should resolve locked household authority before exposing audit rows",
  );
  assert.match(
    householdRoute,
    /requireOwner\([\s\S]*Only an owner\/admin can review durable household invite, role, and Access Pass audit events/,
    "audit review should stay owner/admin-only until finer-grained admin roles are approved",
  );
  assert.match(
    householdRoute,
    /eq\(householdAuditEventsTable\.householdId, scope\.householdId\)/,
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

  assert.match(
    auditListBlock,
    /operationId: listHouseholdAuditEvents/,
    "OpenAPI must document audit review",
  );
  for (const status of ['"400"', '"401"', '"403"']) {
    assert.match(
      auditListBlock,
      new RegExp(`${status}:`),
      `OpenAPI must document audit review ${status} responses`,
    );
  }
  assert.match(
    auditListBlock,
    /name:\s+limit/,
    "OpenAPI must document audit review limit query",
  );
  assert.match(
    auditListBlock,
    /name:\s+action/,
    "OpenAPI must document audit review action filter",
  );
  assert.match(
    auditListBlock,
    /name:\s+lifecycleState/,
    "OpenAPI must document audit review lifecycle filter",
  );
  assert.match(
    openapi,
    /HouseholdAuditEventListResponse:/,
    "OpenAPI must expose the audit list response schema",
  );

  assert.match(
    zodApi,
    /export const ListHouseholdAuditEventsQueryParams/,
    "Zod must validate audit review query params",
  );
  assert.match(
    zodSignature,
    /export const ListHouseholdAuditEvents200Response = zod\.object\(\{"events": zod\.array\(zod\.object\(\{[\s\S]*?"householdId": zod\.string\(\)[\s\S]*?"storage": zod\.enum\(\["provider-durable"\]\), "boundary": zod\.string\(\)[\s\S]*?"limit": zod\.number\(\), "filters": zod\.object\(\{[\s\S]*?"boundary": zod\.string\(\)\}\)/,
    "Zod must expose the exact audit review 200 response",
  );
  assert.match(
    reactSchemas,
    /export type ListHouseholdAuditEventsParams = \{[\s\S]*?limit\?: number;\s*action\?: ListHouseholdAuditEventsAction;\s*lifecycleState\?: ListHouseholdAuditEventsLifecycleState;\s*\};/,
    "React schemas must strongly type every audit review param",
  );
  assert.match(
    reactSchemas,
    /export interface HouseholdAuditEventListResponse/,
    "React schemas must type audit review response",
  );
  assert.match(
    reactSignature,
    /listHouseholdAuditEvents/,
    "React client must expose audit review fetcher",
  );
  assert.match(
    reactSignature,
    /useListHouseholdAuditEventsQueryOptions = <TData = Awaited<ReturnType<typeof listHouseholdAuditEvents>>, TError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>>/,
    "React audit review query must preserve ApiError and expose household capability failures",
  );
  assert.match(
    reactSignature,
    /ListHouseholdAuditEventsQueryError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React audit review error alias must expose ApiError and household capability bodies",
  );
});

test("household sharing cleanup review API stays owner-scoped and typed", () => {
  const householdRoute = readHouseholdRouteSource();
  const sharingCleanup = read(
    "artifacts/api-server/src/lib/household-sharing-cleanup.ts",
  );
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodSignature = canonicalGeneratedTypeScript(zodApi);
  const zodTypesIndex = read("lib/api-zod/src/generated/types/index.ts");
  const zodCleanupCandidateType = read(
    "lib/api-zod/src/generated/types/householdSharingCleanupCandidate.ts",
  );
  const zodCleanupResponseType = read(
    "lib/api-zod/src/generated/types/householdSharingCleanupResponse.ts",
  );
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSignature = canonicalGeneratedTypeScript(reactClient);

  const cleanupBlock = section(
    openapi,
    "  /household/sharing-cleanup:",
    "  /household/audit-events:",
  );
  const cleanupResponseValidator = section(
    zodSignature,
    "export const ListHouseholdSharingCleanup200Response =",
    "export const ListHouseholdSharingCleanup400Response =",
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
    /router\.get\(\s*"\/household\/sharing-cleanup"\s*,\s*requireAuth/,
    "sharing cleanup review should be an authenticated owner/admin route",
  );
  assert.match(
    householdRoute,
    /ListHouseholdSharingCleanupQueryParams\.safeParse\(req\.query\)/,
    "sharing cleanup review should validate query filters",
  );
  assert.match(
    householdRoute,
    /requireOwner\([\s\S]*Only an owner\/admin can review expired household sharing cleanup candidates/,
    "sharing cleanup review should stay owner/admin-only until cleanup approval is designed",
  );
  assert.match(
    householdRoute,
    /eq\(householdInvitationsTable\.householdId, scope\.householdId\)/,
    "sharing cleanup review must scope stale invitations to the active household",
  );
  assert.match(
    householdRoute,
    /eq\(householdMembersTable\.householdId, scope\.householdId\)/,
    "sharing cleanup review must scope expired helper memberships to the active household",
  );
  assert.match(
    householdRoute,
    /ListHouseholdSharingCleanupResponse\.parse/,
    "sharing cleanup review should return a typed generated response",
  );

  assert.match(
    cleanupBlock,
    /operationId: listHouseholdSharingCleanup/,
    "OpenAPI must document sharing cleanup review",
  );
  for (const status of ['"400"', '"401"', '"403"']) {
    assert.match(
      cleanupBlock,
      new RegExp(`${status}:`),
      `OpenAPI must document sharing cleanup ${status} responses`,
    );
  }
  assert.match(
    cleanupBlock,
    /name:\s+limit/,
    "OpenAPI must document sharing cleanup limit query",
  );
  assert.match(
    cleanupBlock,
    /name:\s+kind/,
    "OpenAPI must document sharing cleanup kind filter",
  );
  assert.match(
    openapi,
    /HouseholdSharingCleanupCandidate:/,
    "OpenAPI must expose sharing cleanup candidate schema",
  );
  assert.match(
    openapi,
    /HouseholdSharingCleanupResponse:/,
    "OpenAPI must expose sharing cleanup response schema",
  );

  assert.match(
    zodSignature,
    /export const ListHouseholdSharingCleanupQueryParams = zod\.object\(\{"limit": zod\.coerce\.number\(\)\.min\(1\)\.max\(listHouseholdSharingCleanupQueryLimitMax\)\.default\(listHouseholdSharingCleanupQueryLimitDefault\), "kind": zod\.enum\(\["expired-invitation", "expired-access-pass"\]\)\.optional\(\)\}\)/,
    "the shipping cleanup query validator must preserve the bounded limit and exact kind filter",
  );
  assert.match(
    cleanupResponseValidator,
    /"candidates": zod\.array\(zod\.object\(\{"id": zod\.string\(\), "kind": zod\.enum\(\["expired-invitation", "expired-access-pass"\]\), "targetId": zod\.string\(\), "householdId": zod\.string\(\), "title": zod\.string\(\), "detail": zod\.string\(\), "role": zod\.string\(\), "displayName": zod\.string\(\)\.nullish\(\), "invitedEmail": zod\.string\(\)\.nullish\(\), "inviteCode": zod\.string\(\)\.nullish\(\), "userId": zod\.string\(\)\.nullish\(\), "expiresAt": zod\.coerce\.date\(\), "staleSince": zod\.coerce\.date\(\), "recommendedAction": zod\.enum\(\["mark-invitation-expired", "review-helper-access"\]\), "storage": zod\.enum\(\["review-only"\]\), "boundary": zod\.string\(\)\}\)\)/,
    "the shipping cleanup 200 validator must validate every candidate field and exact lifecycle enums",
  );
  assert.match(
    cleanupResponseValidator,
    /"limit": zod\.number\(\), "filters": zod\.object\(\{"kind": zod\.enum\(\["expired-invitation", "expired-access-pass"\]\)\.optional\(\)\}\), "pendingReviewCount": zod\.number\(\), "expiredInvitationCount": zod\.number\(\), "expiredAccessPassCount": zod\.number\(\), "boundary": zod\.string\(\)/,
    "the shipping cleanup 200 validator must preserve filters, all counters, and its boundary",
  );
  assert.match(
    zodTypesIndex,
    /householdSharingCleanupCandidate/,
    "Zod type exports must include cleanup candidates",
  );
  assert.match(
    zodTypesIndex,
    /householdSharingCleanupResponse/,
    "Zod type exports must include the cleanup response component",
  );
  assert.match(
    zodCleanupCandidateType,
    /export interface HouseholdSharingCleanupCandidate \{\s*id: string;\s*kind: HouseholdSharingCleanupKind;\s*targetId: string;\s*householdId: string;\s*title: string;\s*detail: string;\s*role: string;[\s\S]*?displayName\?: string \| null;[\s\S]*?invitedEmail\?: string \| null;[\s\S]*?inviteCode\?: string \| null;[\s\S]*?userId\?: string \| null;\s*expiresAt: Date;\s*staleSince: Date;\s*recommendedAction: HouseholdSharingCleanupRecommendedAction;\s*storage: HouseholdSharingCleanupCandidateStorage;\s*boundary: string;\s*\}/,
    "the generated cleanup candidate component type must preserve every authoritative field",
  );
  assert.match(
    zodCleanupResponseType,
    /export interface HouseholdSharingCleanupResponse \{\s*candidates: HouseholdSharingCleanupCandidate\[\];\s*limit: number;\s*filters: HouseholdSharingCleanupFilters;\s*pendingReviewCount: number;\s*expiredInvitationCount: number;\s*expiredAccessPassCount: number;\s*boundary: string;\s*\}/,
    "the generated cleanup response component type must preserve candidates, filters, counters, and boundary",
  );
  assert.match(
    reactSchemas,
    /export type HouseholdSharingCleanupKind/,
    "React schemas must type sharing cleanup kind",
  );
  assert.match(
    reactSchemas,
    /export interface HouseholdSharingCleanupResponse/,
    "React schemas must type sharing cleanup response",
  );
  assert.match(
    reactSignature,
    /listHouseholdSharingCleanup/,
    "React client must expose sharing cleanup fetcher",
  );
  assert.match(
    reactSignature,
    /useListHouseholdSharingCleanupQueryOptions = <TData = Awaited<ReturnType<typeof listHouseholdSharingCleanup>>, TError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>>/,
    "React sharing cleanup query must preserve ApiError and expose household capability failures",
  );
  assert.match(
    reactSignature,
    /ListHouseholdSharingCleanupQueryError = ErrorType<ApiError \| ExpectedHouseholdMismatchResponse \| ExpectedHouseholdRequiredResponse>/,
    "React sharing cleanup error alias must expose ApiError and household capability bodies",
  );
});

test("API Zod public barrel avoids schema and generated-type export ambiguity", () => {
  const publicBarrel = read("lib/api-zod/src/index.ts");
  const generatedApi = read("lib/api-zod/src/generated/api.ts");

  assert.match(
    publicBarrel,
    /export \* from "\.\/generated\/api(?:\.ts)?"/,
    "runtime Zod schemas must stay exported",
  );
  assert.doesNotMatch(
    publicBarrel,
    /export type \* from "\.\/generated\/types"/,
    "generated model types must not be star-exported because some names collide with runtime schemas",
  );

  for (const alias of [
    "HouseholdInvitationType",
    "HouseholdInvitationLifecycleStateType",
    "HouseholdInvitationListFiltersType",
    "HouseholdInvitationMutationResponseType",
    "HouseholdSharingCleanupCandidateType",
    "HouseholdSharingCleanupFiltersType",
    "HouseholdSharingCleanupKindType",
    "HouseholdSharingCleanupRecommendedActionType",
  ]) {
    assert.match(
      publicBarrel,
      new RegExp(`\\b${alias}\\b`),
      `${alias} must stay available for type-only imports`,
    );
  }

  const compatibilityAliases = [
    ["ActivateHouseholdAccessPassBody", "AccessPassActivationBody"],
    ["ActivateHouseholdAccessPass200Response", "ActivateHouseholdAccessPassResponse"],
    ["ActivateHouseholdAccessPass200Response", "HouseholdAccessPassMutationResponse"],
    ["ActivateHousehold200Response", "ActivateHouseholdResponse"],
    ["AskCareHelper200Response", "AskCareHelperResponse"],
    ["CreateAvatarEmotions200Response", "CreateAvatarEmotionsResponse"],
    ["CreateCareEntry200Response", "CreateCareEntryResponse"],
    ["CreateHouseholdInvitation201Response", "CreateHouseholdInvitationResponse"],
    ["CreateHouseholdInvitation201Response", "HouseholdInvitationMutationResponse"],
    ["CreateWoofguideEvents200Response", "CreateWoofguideEventsResponse"],
    ["GetCareHelperStatus200Response", "GetCareHelperStatusResponse"],
    ["GetCareState200Response", "GetCareStateResponse"],
    ["GetMe200Response", "GetMeResponse"],
    ["GetWoofguideEventsStatus200Response", "GetWoofguideEventsStatusResponse"],
    ["HealthCheck200Response", "HealthCheckResponse"],
    ["JoinHousehold200Response", "HouseholdJoinResponse"],
    ["JoinHousehold200Response", "JoinHouseholdResponse"],
    ["ListCareEntries200Response", "ListCareEntriesResponse"],
    ["ListCareEntries200ResponseItem", "ListCareEntriesResponseItem"],
    ["ListCareEntryTombstones200Response", "ListCareEntryTombstonesResponse"],
    ["ListHouseholdAuditEvents200Response", "HouseholdAuditEventListResponse"],
    ["ListHouseholdAuditEvents200Response", "ListHouseholdAuditEventsResponse"],
    ["ListHouseholdInvitations200Response", "HouseholdInvitationListResponse"],
    ["ListHouseholdInvitations200Response", "ListHouseholdInvitationsResponse"],
    ["ListHouseholdSharingCleanup200Response", "HouseholdSharingCleanupResponse"],
    ["ListHouseholdSharingCleanup200Response", "ListHouseholdSharingCleanupResponse"],
    ["ListMyHouseholdMemberships200Response", "ListMyHouseholdMembershipsResponse"],
    ["PutCareState200Response", "PutCareStateResponse"],
    ["RevokeHouseholdAccessPassBody", "AccessPassRevocationBody"],
    ["RevokeHouseholdAccessPass200Response", "RevokeHouseholdAccessPassResponse"],
    ["RevokeHouseholdInvitation200Response", "RevokeHouseholdInvitationResponse"],
    ["RevokeHouseholdMember200Response", "RevokeHouseholdMemberResponse"],
    ["StylizeAvatar200Response", "StylizeAvatarResponse"],
    ["UpdateCareEntry200Response", "UpdateCareEntryResponse"],
    ["UpdateHouseholdMember200Response", "HouseholdMemberMutationResponse"],
    ["UpdateHouseholdMember200Response", "UpdateHouseholdMemberResponse"],
    ["UpdateHousehold200Response", "UpdateHouseholdResponse"],
    ["UpdateMe200Response", "UpdateMeResponse"],
  ] as const;

  for (const [generatedName, compatibilityName] of compatibilityAliases) {
    assert.match(
      generatedApi,
      new RegExp(`^export const ${generatedName}\\b`, "m"),
      `${compatibilityName} must resolve to an emitted operation validator`,
    );
    assert.match(
      publicBarrel,
      new RegExp(`\\b${generatedName} as ${compatibilityName}\\b`),
      `${compatibilityName} must preserve its deliberate public compatibility alias`,
    );
  }
});

test("Access Pass expiry is enforced at member-auth request time", () => {
  const household = read("artifacts/api-server/src/lib/household.ts");
  const householdRoute = readHouseholdRouteSource();
  const accessPassPolicy = read(
    "artifacts/api-server/src/lib/household-access-pass.ts",
  );
  const careEntryPolicy = read(
    "artifacts/api-server/src/lib/care-entry-authorization.ts",
  );
  const roleAuthority = read(
    "artifacts/api-server/src/lib/household-role-authority.ts",
  );
  const memberSchema = read("lib/db/src/schema/householdMembers.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodSignature = canonicalGeneratedTypeScript(zodApi);
  const zodMemberType = read("lib/api-zod/src/generated/types/member.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );

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
    /parseHouseholdMemberRole\(input\.role\)/,
    "care-entry policy should consume strict shared role authority",
  );
  assert.match(
    roleAuthority,
    /authorizationRole: "expired access pass"[\s\S]*householdAccessAllowed: false/,
    "shared role authority must deny household access at Access Pass expiry",
  );
  assert.match(
    householdRoute,
    /accessPassExpiresAt:[\s\S]{0,120}?expiryPolicy\.expiresAt[\s\S]{0,80}?new Date\(expiryPolicy\.expiresAt\)[\s\S]{0,30}?: null/,
    "Access Pass activation must persist the approved expiry on the member row",
  );
  assert.match(
    accessPassPolicy,
    /access-pass-expired/,
    "Access Pass route contracts should keep expiry lifecycle language visible",
  );

  assert.match(
    openapi,
    /accessPassExpiresAt:/,
    "OpenAPI Member schema must expose Access Pass expiry status",
  );
  assert.match(
    openapi,
    /accessPassExpired:/,
    "OpenAPI Member schema must expose expired-helper status",
  );
  assert.match(
    zodSignature,
    /"accessPassExpiresAt": zod\.string\(\)\.nullish\(\)/,
    "Zod member payloads must parse Access Pass expiry status",
  );
  assert.match(
    zodSignature,
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
  const route = readHouseholdRouteSource();
  const householdJoin = read("artifacts/api-server/src/lib/household-join.ts");
  const householdJoinStore = read(
    "artifacts/api-server/src/lib/household-join-drizzle-store.ts",
  );
  const invitationPolicy = read(
    "artifacts/api-server/src/lib/household-invitations.ts",
  );
  const invitationSchema = read("lib/db/src/schema/householdInvitations.ts");
  const schemaIndex = read("lib/db/src/schema/index.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodSignature = canonicalGeneratedTypeScript(zodApi);
  const zodPublicIndex = read("lib/api-zod/src/index.ts");
  const zodTypesIndex = read("lib/api-zod/src/generated/types/index.ts");
  const zodInvitationType = read(
    "lib/api-zod/src/generated/types/householdInvitation.ts",
  );
  const zodInvitationMutationType = read(
    "lib/api-zod/src/generated/types/householdInvitationMutationResponse.ts",
  );
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );

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
  const invitationCreateResponseValidator = section(
    zodSignature,
    "export const CreateHouseholdInvitation201Response =",
    "export const CreateHouseholdInvitation400Response =",
  );
  const invitationRevokeResponseValidator = section(
    zodSignature,
    "export const RevokeHouseholdInvitation200Response =",
    "export const RevokeHouseholdInvitation400Response =",
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
    /router\.get\(\s*"\/household\/invitations"\s*,\s*requireAuth/,
    "owner/admin invitation review should be authenticated",
  );
  assert.match(
    route,
    /router\.post\("\/household\/invitations", requireAuth/,
    "owner/admin invitation creation should be authenticated",
  );
  assert.match(
    route,
    /router\.post\(\s*"\/household\/invitations\/:id\/revoke"\s*,\s*requireAuth/,
    "owner/admin invitation revocation should be authenticated",
  );
  assert.match(
    householdJoinStore,
    /async lockInvitation\(invitationId\)[\s\S]*\.for\("update"\)/,
    "join must lock the durable invitation row before lifecycle authority is decided",
  );
  assert.match(
    route,
    /commitHouseholdJoin\(\{[\s\S]*expectedSourceHouseholdId,[\s\S]*invitationId:\s*invitation\.id/,
    "join route must pass the source capability and selected durable invitation into the transaction",
  );
  assert.match(
    read("artifacts/api-server/src/lib/household-active-identity.ts"),
    /const lifecycleRejection = invitationLifecycleRejection\(\{[\s\S]*throw new HouseholdJoinCommitError\([\s\S]*lifecycleRejection\.status/,
    "the join core must decide lifecycle policy from the invitation held under the transaction lock",
  );
  assert.match(
    householdJoinStore,
    /transaction\s*\.update\(householdInvitationsTable\)[\s\S]*lifecycleState:\s*"accepted"[\s\S]*acceptedByUserId:\s*invitationInput\.userId[\s\S]*acceptedAt:\s*invitationInput\.acceptedAt/,
    "the transactional join module should atomically mark durable invitation rows accepted with actor and time evidence",
  );

  assert.match(
    invitationListBlock,
    /operationId: listHouseholdInvitations/,
    "OpenAPI must document invitation list",
  );
  assert.match(
    invitationListBlock,
    /operationId: createHouseholdInvitation/,
    "OpenAPI must document invitation creation",
  );
  assert.match(
    invitationRevokeBlock,
    /operationId: revokeHouseholdInvitation/,
    "OpenAPI must document invitation revocation",
  );
  assert.match(
    openapi,
    /HouseholdInvitation:/,
    "OpenAPI must expose household invitation schema",
  );
  assert.match(
    openapi,
    /pending-approval/,
    "OpenAPI must expose pending invitation lifecycle state",
  );
  assert.match(
    openapi,
    /HouseholdInvitationMutationResponse:/,
    "OpenAPI must expose invitation mutation response",
  );

  assert.match(
    zodApi,
    /export const ListHouseholdInvitationsQueryParams/,
    "Zod must validate invitation list queries",
  );
  assert.match(
    zodApi,
    /export const CreateHouseholdInvitationBody/,
    "Zod must validate invitation creation body",
  );
  assert.match(
    zodApi,
    /export const RevokeHouseholdInvitationParams/,
    "Zod must validate invitation revoke params",
  );
  assert.match(
    zodPublicIndex,
    /CreateHouseholdInvitation201Response as HouseholdInvitationMutationResponse/,
    "the public compatibility validator must resolve to the exact invitation-create 201 response",
  );
  for (const [validatorName, validator] of [
    ["CreateHouseholdInvitation201Response", invitationCreateResponseValidator],
    ["RevokeHouseholdInvitation200Response", invitationRevokeResponseValidator],
  ] as const) {
    assert.match(
      validator,
      new RegExp(`export const ${validatorName} = zod\\.object`),
      `${validatorName} must remain a separately generated status validator`,
    );
    assert.match(
      validator,
      /"invitation": zod\.object\(\{"id": zod\.string\(\), "householdId": zod\.string\(\), "inviteCode": zod\.string\(\), "invitedEmail": zod\.string\(\)\.nullish\(\), "invitedUserId": zod\.string\(\)\.nullish\(\), "role": zod\.enum\(\["owner", "adult", "teen", "kid", "sitter", "trainer", "walker", "vet viewer"\]\)[\s\S]*?"lifecycleState": zod\.enum\(\["pending-approval", "approved", "accepted", "revoked", "expired", "rejected"\]\), "runtimeLifecycleState": zod\.enum\(\["pending-approval", "approved", "accepted", "revoked", "expired", "rejected"\]\), "expired": zod\.boolean\(\), "createdByUserId": zod\.string\(\), "approvedByUserId": zod\.string\(\)\.nullish\(\), "acceptedByUserId": zod\.string\(\)\.nullish\(\), "revokedByUserId": zod\.string\(\)\.nullish\(\), "rejectedByUserId": zod\.string\(\)\.nullish\(\), "note": zod\.string\(\)\.nullish\(\), "expiresAt": zod\.coerce\.date\(\)\.nullish\(\), "acceptedAt": zod\.coerce\.date\(\)\.nullish\(\), "revokedAt": zod\.coerce\.date\(\)\.nullish\(\), "rejectedAt": zod\.coerce\.date\(\)\.nullish\(\), "createdAt": zod\.coerce\.date\(\), "updatedAt": zod\.coerce\.date\(\)\.nullish\(\), "storage": zod\.enum\(\["provider-durable"\]\), "boundary": zod\.string\(\)\}\)/,
      `${validatorName} must validate every invitation identity and lifecycle field`,
    );
    assert.match(
      validator,
      /"auditEvent": zod\.object\(\{"id": zod\.string\(\), "action": zod\.enum\(\["invitation-created", "invitation-accepted", "invitation-revoked", "member-role-updated", "member-revoked", "access-pass-activated", "access-pass-revoked"\]\), "lifecycleState": zod\.enum\(\["invite-created", "invite-accepted", "invite-revoked", "member-updated", "member-revoked", "access-pass-active", "access-pass-revoked", "access-pass-expired"\]\), "actorUserId": zod\.string\(\), "householdId": zod\.string\(\), "targetMemberId": zod\.string\(\)\.nullish\(\), "targetUserId": zod\.string\(\)\.nullish\(\), "targetRole": zod\.string\(\)\.nullish\(\), "nextRole": zod\.string\(\)\.nullish\(\), "reason": zod\.string\(\)\.nullish\(\), "note": zod\.string\(\)\.nullish\(\), "expiresAt": zod\.string\(\)\.nullish\(\), "createdAt": zod\.coerce\.date\(\), "storage": zod\.enum\(\["provider-durable"\]\), "boundary": zod\.string\(\)\}\)/,
      `${validatorName} must validate the complete provider-durable audit event`,
    );
  }
  assert.match(
    zodInvitationType,
    /import type \{ HouseholdMemberRole \} from ["']\.\/householdMemberRole["'];[\s\S]*export interface HouseholdInvitation \{[\s\S]*role: HouseholdMemberRole;[\s\S]*lifecycleState: HouseholdInvitationLifecycleState;\s*runtimeLifecycleState: HouseholdInvitationLifecycleState;[\s\S]*storage: HouseholdInvitationStorage;\s*boundary: string;\s*\}/,
    "the generated invitation component type must reuse the canonical role and lifecycle types",
  );
  assert.match(
    zodInvitationMutationType,
    /export interface HouseholdInvitationMutationResponse \{\s*invitation: HouseholdInvitation;\s*auditEvent: HouseholdAuditEvent;\s*\}/,
    "the generated mutation component must preserve invitation and audit-event fields",
  );
  assert.match(
    zodTypesIndex,
    /export \* from ["']\.\/householdInvitation["'];[\s\S]*export \* from ["']\.\/householdInvitationMutationResponse["'];/,
    "the generated component index must export invitation and mutation response types",
  );

  assert.match(
    reactSchemas,
    /export type HouseholdInvitationLifecycleState/,
    "React schemas must type invitation lifecycle",
  );
  assert.match(
    reactSchemas,
    /export interface HouseholdInvitation/,
    "React schemas must type invitation rows",
  );
  assert.match(
    reactSchemas,
    /export interface HouseholdInvitationMutationResponse/,
    "React schemas must type invitation mutations",
  );
  assert.match(
    reactClient,
    /listHouseholdInvitations/,
    "React client must expose invitation list fetcher",
  );
  assert.match(
    reactClient,
    /createHouseholdInvitation/,
    "React client must expose invitation creation mutation",
  );
  assert.match(
    reactClient,
    /revokeHouseholdInvitation/,
    "React client must expose invitation revoke mutation",
  );
});

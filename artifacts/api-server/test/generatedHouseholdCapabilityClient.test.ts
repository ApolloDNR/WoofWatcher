import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { buildHouseholdQueryKey } from "../../../lib/api-client-react/src/query-key.ts";

const root = process.cwd();

const guardedQueries = [
  "listMyHouseholdMemberships",
  "listHouseholdInvitations",
  "listHouseholdSharingCleanup",
  "listHouseholdAuditEvents",
  "getCareState",
  "listCareEntries",
  "listCareEntryTombstones",
] as const;

const guardedMutations = [
  "updateHousehold",
  "activateHousehold",
  "createHouseholdInvitation",
  "revokeHouseholdInvitation",
  "joinHousehold",
  "updateHouseholdMember",
  "revokeHouseholdMember",
  "activateHouseholdAccessPass",
  "revokeHouseholdAccessPass",
  "putCareState",
  "createCareEntry",
  "updateCareEntry",
  "deleteCareEntryByClientKey",
  "deleteCareEntry",
] as const;

const guardedOperations = [...guardedQueries, ...guardedMutations] as const;

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");
}

function pascal(value: string): string {
  return `${value[0]?.toUpperCase()}${value.slice(1)}`;
}

function operationBlock(source: string, operation: string): string {
  const marker = `export const get${pascal(operation)}Url`;
  const start = source.indexOf(marker);
  assert.notEqual(
    start,
    -1,
    `${operation} is missing from the generated client`,
  );
  const nextRelative = source
    .slice(start + marker.length)
    .search(/\nexport const get[A-Z][A-Za-z0-9]+Url\b/);
  const end =
    nextRelative === -1 ? source.length : start + marker.length + nextRelative;
  return source.slice(start, end);
}

test("Orval generates required typed household headers for every guarded operation", () => {
  const config = read("lib/api-spec/orval.config.ts");
  const client = read("lib/api-client-react/src/generated/api.ts");
  const schemas = read("lib/api-client-react/src/generated/api.schemas.ts");
  const openapi = read("lib/api-spec/openapi.yaml");

  const guardedSpecOperations = openapi
    .split("\n")
    .flatMap((line, index, lines) => {
      if (!line.includes("#/components/parameters/ExpectedHouseholdId")) {
        return [];
      }
      for (let cursor = index; cursor >= Math.max(0, index - 20); cursor -= 1) {
        const match = lines[cursor]?.match(/operationId:\s*(\S+)/);
        if (match?.[1]) return [match[1]];
      }
      return [];
    });

  assert.deepEqual(
    guardedSpecOperations.sort(),
    [...guardedOperations].sort(),
    "the client gate must cover every and only required-header OpenAPI operation",
  );

  assert.match(
    config,
    /output:\s*\{[\s\S]*?headers:\s*true,/,
    "React client generation must not discard OpenAPI header parameters",
  );

  for (const operation of guardedOperations) {
    const typeName = `${pascal(operation)}Headers`;
    const block = operationBlock(client, operation);

    assert.match(
      schemas,
      new RegExp(
        `export type ${typeName} = \\{[\\s\\S]*?"X-WoofWatcher-Expected-Household-Id": ExpectedHouseholdIdParameter;[\\s\\S]*?\\};`,
      ),
      `${operation} must expose the capability as a required typed header`,
    );
    assert.match(
      block,
      new RegExp(`headers: ${typeName}`),
      `${operation} must require its typed header argument`,
    );
    assert.match(
      block,
      /headers:\s*\{[\s\S]*?\.\.\.options\?\.headers,[\s\S]*?\.\.\.headers[\s\S]*?\}/,
      `${operation} must send the typed capability after ordinary request headers so it cannot be overridden`,
    );
    assert.doesNotMatch(
      block,
      /\.\.\.headers,[\s\S]{0,80}\.\.\.options\?\.headers/,
      `${operation} must not let optional RequestInit replace the typed capability`,
    );
  }
});

test("every guarded generated query key is partitioned by exact household identity", () => {
  const config = read("lib/api-spec/orval.config.ts");
  const client = read("lib/api-client-react/src/generated/api.ts");

  for (const operation of guardedQueries) {
    const block = operationBlock(client, operation);
    const typeName = `${pascal(operation)}Headers`;

    assert.match(
      config,
      new RegExp(
        `${operation}:\\s*\\{\\s*query:\\s*\\{\\s*queryKey:\\s*householdQueryKey\\s*,?\\s*\\}\\s*,?\\s*\\}`,
      ),
      `${operation} must use the household-aware query-key mutator`,
    );
    assert.match(
      block,
      new RegExp(`headers: ${typeName}`),
      `${operation}'s hook must require the typed household capability`,
    );
    assert.match(
      block,
      /const queryKey = buildHouseholdQueryKey\(\s*\{ headers(?:, params)? \},\s*\{ url:/,
      `${operation}'s generated default query key must receive the typed capability`,
    );
    assert.match(
      block,
      /query\?: HouseholdBoundQueryOptions</,
      `${operation} must omit queryKey and queryFn from caller options`,
    );
    assert.match(
      block,
      /return \{ \.\.\.queryOptions, queryKey, queryFn \} as/,
      `${operation} must assign its identity-bound key and request closure after caller options`,
    );
    assert.doesNotMatch(
      block,
      /return \{ queryKey, queryFn, \.\.\.queryOptions \} as/,
      `${operation} must not allow caller options to replace its key or request closure`,
    );
  }
});

test("guarded generated mutation hooks require typed household headers in their variables", () => {
  const client = read("lib/api-client-react/src/generated/api.ts");

  for (const operation of guardedMutations) {
    const block = operationBlock(client, operation);
    const typeName = `${pascal(operation)}Headers`;
    assert.match(
      block,
      new RegExp(`headers: ${typeName}`),
      `${operation}'s hook variables must require the typed capability`,
    );
    assert.match(
      block,
      /const \{[^}]*headers[^}]*\} = props \?\? \{\};[\s\S]*?return [A-Za-z0-9]+\([^;]*headers,/,
      `${operation}'s hook must forward its typed capability to the request function`,
    );
  }
});

test("delete-by-client-key preserves opaque identities through its generated URL", () => {
  const client = read("lib/api-client-react/src/generated/api.ts");
  const block = operationBlock(client, "deleteCareEntryByClientKey");

  assert.match(
    block,
    /`\/api\/care-entries\/client-key\/\$\{encodeURIComponent\(clientKey\)\}`/,
  );
  assert.doesNotMatch(
    block,
    /`\/api\/care-entries\/client-key\/\$\{clientKey\}`/,
  );
});

test("household query keys differ across identities and preserve request identity", () => {
  const headersA = {
    "X-WoofWatcher-Expected-Household-Id": "household-A",
  } as const;
  const headersB = {
    "X-WoofWatcher-Expected-Household-Id": "household-B",
  } as const;
  const params = { updatedSince: "2026-08-29T00:00:00.000Z" };

  const keyA = buildHouseholdQueryKey(
    { headers: headersA, params },
    { url: "/api/care-entries" },
  );
  const keyB = buildHouseholdQueryKey(
    { headers: headersB, params },
    { url: "/api/care-entries" },
  );

  assert.notDeepEqual(keyA, keyB);
  assert.deepEqual(keyA, ["/api/care-entries", "household-A", { params }]);
  assert.throws(
    () =>
      buildHouseholdQueryKey(
        { headers: {} as never },
        { url: "/api/care-entries" },
      ),
    /Expected household identity is required/,
  );
});

test("all guarded query option builders reject forged cache keys and query functions at runtime", async () => {
  const bundleDirectory = mkdtempSync(
    join(tmpdir(), "woofwatcher-household-client-"),
  );
  const bundlePath = join(bundleDirectory, "generated-client.mjs");

  try {
    await build({
      entryPoints: [join(root, "lib/api-client-react/src/generated/api.ts")],
      bundle: true,
      format: "esm",
      platform: "node",
      outfile: bundlePath,
      logLevel: "silent",
    });

    const client = (await import(pathToFileURL(bundlePath).href)) as Record<
      string,
      unknown
    >;
    const headers = {
      "X-WoofWatcher-Expected-Household-Id": "household-runtime-proof",
    } as const;
    const guardedBuilders = [
      {
        name: "useListMyHouseholdMembershipsQueryOptions",
        url: "/api/household/memberships",
      },
      {
        name: "useListHouseholdInvitationsQueryOptions",
        keyName: "getListHouseholdInvitationsQueryKey",
        optionsName: "getListHouseholdInvitationsQueryOptions",
        url: "/api/household/invitations",
        params: { limit: 5 },
      },
      {
        name: "useListHouseholdSharingCleanupQueryOptions",
        keyName: "getListHouseholdSharingCleanupQueryKey",
        optionsName: "getListHouseholdSharingCleanupQueryOptions",
        url: "/api/household/sharing-cleanup",
        params: { limit: 5 },
      },
      {
        name: "useListHouseholdAuditEventsQueryOptions",
        keyName: "getListHouseholdAuditEventsQueryKey",
        optionsName: "getListHouseholdAuditEventsQueryOptions",
        url: "/api/household/audit-events",
        params: { limit: 5 },
      },
      {
        name: "useGetCareStateQueryOptions",
        keyName: "getGetCareStateQueryKey",
        optionsName: "getGetCareStateQueryOptions",
        url: "/api/care-state",
      },
      {
        name: "useListCareEntriesQueryOptions",
        keyName: "getListCareEntriesQueryKey",
        optionsName: "getListCareEntriesQueryOptions",
        url: "/api/care-entries",
        params: { limit: 5 },
      },
      {
        name: "useListCareEntryTombstonesQueryOptions",
        keyName: "getListCareEntryTombstonesQueryKey",
        optionsName: "getListCareEntryTombstonesQueryOptions",
        url: "/api/care-entries/tombstones",
        params: { limit: 5 },
      },
    ] as const;

    const originalFetch = globalThis.fetch;
    try {
      for (const guarded of guardedBuilders) {
        let forgedQueryFnCalled = false;
        const forgedQueryFn = async () => {
          forgedQueryFnCalled = true;
          return "forged";
        };
        const forgedQueryOptions = {
          queryKey: ["forged-household-cache"],
          queryFn: forgedQueryFn,
          staleTime: 1234,
        };
        const forgedOptions = {
          query: forgedQueryOptions,
          request: {
            headers: {
              "X-WoofWatcher-Expected-Household-Id": "forged-request-household",
            },
          },
        };
        const builder = client[guarded.name];
        assert.equal(typeof builder, "function", `${guarded.name} must exist`);

        const built = (
          "params" in guarded
            ? (
                builder as (
                  headers: typeof headers,
                  params: typeof guarded.params,
                  options: typeof forgedOptions,
                ) => Record<string, unknown>
              )(headers, guarded.params, forgedOptions)
            : (
                builder as (
                  headers: typeof headers,
                  options: typeof forgedOptions,
                ) => Record<string, unknown>
              )(headers, forgedOptions)
        ) as {
          queryFn: (context: { signal: AbortSignal }) => Promise<unknown>;
          queryKey: readonly unknown[];
          staleTime: number;
        };

        assert.deepEqual(built.queryKey, [
          guarded.url,
          headers["X-WoofWatcher-Expected-Household-Id"],
          "params" in guarded ? { params: guarded.params } : {},
        ]);
        assert.notEqual(
          built.queryFn,
          forgedQueryFn,
          `${guarded.name} must retain the generated fetch closure`,
        );
        assert.equal(
          built.staleTime,
          1234,
          `${guarded.name} should preserve non-security query options`,
        );
        if ("keyName" in guarded) {
          const compatibilityKeyBuilder = client[guarded.keyName];
          assert.equal(
            typeof compatibilityKeyBuilder,
            "function",
            `${guarded.keyName} must remain runtime-importable`,
          );
          const compatibilityKey =
            "params" in guarded
              ? (
                  compatibilityKeyBuilder as (
                    headers: typeof headers,
                    params: typeof guarded.params,
                  ) => readonly unknown[]
                )(headers, guarded.params)
              : (
                  compatibilityKeyBuilder as (
                    headers: typeof headers,
                  ) => readonly unknown[]
                )(headers);
          assert.deepEqual(compatibilityKey, built.queryKey);
          assert.equal(
            client[guarded.optionsName],
            builder,
            `${guarded.optionsName} must preserve the secured generated builder`,
          );
        }

        let capturedUrl = "";
        let capturedHeaders = new Headers();
        globalThis.fetch = (async (input, init) => {
          capturedUrl = String(input);
          capturedHeaders = new Headers(init?.headers);
          return new Response("{}", {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch;

        await built.queryFn({ signal: new AbortController().signal });
        assert.equal(forgedQueryFnCalled, false);
        assert.ok(capturedUrl.startsWith(guarded.url));
        assert.equal(
          capturedHeaders.get("X-WoofWatcher-Expected-Household-Id"),
          headers["X-WoofWatcher-Expected-Household-Id"],
        );
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    rmSync(bundleDirectory, { recursive: true, force: true });
  }
});

test("canonical generation restores the curated Node-safe Zod public barrel", () => {
  const packageJson = read("lib/api-spec/package.json");
  const finalizer = read("lib/api-spec/scripts/finalize-generated-api.mjs");
  const reactRestoreScript = read(
    "lib/api-spec/scripts/restore-api-client-react-index.mjs",
  );
  const reactTemplate = read(
    "lib/api-spec/templates/api-client-react-index.ts",
  );
  const reactPublicIndex = read("lib/api-client-react/src/index.ts");
  const restoreScript = read("lib/api-spec/scripts/restore-api-zod-index.mjs");
  const template = read("lib/api-spec/templates/api-zod-index.ts");
  const publicIndex = read("lib/api-zod/src/index.ts");

  assert.match(
    packageJson,
    /orval --config \.\/orval\.config\.ts && node \.\/scripts\/finalize-generated-api\.mjs &&/,
    "canonical codegen must finish generated security and compatibility output before typecheck",
  );
  assert.match(
    finalizer,
    /await import\("\.\/harden-generated-household-client\.mjs"\);[\s\S]*?await import\("\.\/restore-api-client-react-index\.mjs"\);[\s\S]*?await import\("\.\/restore-api-zod-index\.mjs"\);/,
    "the finalizer must harden generated React, restore its public root, and then restore Zod",
  );
  assert.match(
    reactRestoreScript,
    /copyFile\(templatePath, publicIndexPath\)/,
    "the React restore step must copy its canonical package-root template",
  );
  assert.equal(
    reactPublicIndex,
    reactTemplate,
    "the checked-in React package root must exactly match its canonical template",
  );
  assert.match(
    restoreScript,
    /copyFile\(templatePath, publicIndexPath\)/,
    "the restore hook must copy the canonical template after generation",
  );
  assert.equal(
    publicIndex,
    template,
    "the checked-in public barrel must exactly match the canonical template",
  );
  assert.match(publicIndex, /export \* from "\.\/generated\/api\.ts"/);
  assert.doesNotMatch(
    publicIndex,
    /export (?:type )?\* from "\.\/generated\/types/,
    "the public barrel must not recreate runtime/type export ambiguity",
  );
});

test("generated compatibility finalization is isolated, byte-drift checked, and idempotent", () => {
  const scriptPath = "lib/api-spec/scripts/finalize-generated-api.mjs";
  const mirrorFiles = [
    scriptPath,
    "lib/api-spec/scripts/harden-generated-household-client.mjs",
    "lib/api-spec/scripts/restore-api-client-react-index.mjs",
    "lib/api-spec/scripts/restore-api-zod-index.mjs",
    "lib/api-spec/templates/api-client-react-index.ts",
    "lib/api-spec/templates/api-zod-index.ts",
    "lib/api-client-react/src/generated/api.ts",
    "lib/api-client-react/src/generated/api.schemas.ts",
    "lib/api-client-react/src/index.ts",
    "lib/api-zod/src/index.ts",
  ] as const;
  const outputFiles = [
    "lib/api-client-react/src/generated/api.ts",
    "lib/api-client-react/src/generated/api.schemas.ts",
    "lib/api-client-react/src/index.ts",
    "lib/api-zod/src/index.ts",
  ] as const;
  const mirrorRoot = mkdtempSync(
    join(tmpdir(), "woofwatcher-generated-finalizer-"),
  );
  const readProductionOutputs = () =>
    Object.fromEntries(
      outputFiles.map((relativePath) => [
        relativePath,
        readFileSync(join(root, relativePath)),
      ]),
    );
  const readProductionMtimes = () =>
    Object.fromEntries(
      outputFiles.map((relativePath) => [
        relativePath,
        statSync(join(root, relativePath), { bigint: true }).mtimeNs,
      ]),
    );
  const productionBefore = readProductionOutputs();
  const productionMtimesBefore = readProductionMtimes();

  try {
    for (const relativePath of mirrorFiles) {
      const mirrorPath = join(mirrorRoot, relativePath);
      mkdirSync(dirname(mirrorPath), { recursive: true });
      copyFileSync(join(root, relativePath), mirrorPath);
    }

    const readMirrorOutput = () =>
      Object.fromEntries(
        outputFiles.map((relativePath) => [
          relativePath,
          readFileSync(join(mirrorRoot, relativePath)),
        ]),
      );
    const before = readMirrorOutput();

    execFileSync(process.execPath, [join(mirrorRoot, scriptPath)], {
      cwd: mirrorRoot,
    });
    const afterFirstPass = readMirrorOutput();
    execFileSync(process.execPath, [join(mirrorRoot, scriptPath)], {
      cwd: mirrorRoot,
    });
    const afterSecondPass = readMirrorOutput();

    assert.deepEqual(afterFirstPass, before);
    assert.deepEqual(afterSecondPass, before);

    const mirroredClientPath = join(
      mirrorRoot,
      "lib/api-client-react/src/generated/api.ts",
    );
    writeFileSync(
      mirroredClientPath,
      readFileSync(mirroredClientPath, "utf8").replace(
        "export const getUpdateHouseholdUrl",
        "export const getRemovedUpdateHouseholdUrl",
      ),
    );
    assert.throws(
      () =>
        execFileSync(process.execPath, [join(mirrorRoot, scriptPath)], {
          cwd: mirrorRoot,
          stdio: "pipe",
        }),
      /Cannot harden missing generated operation updateHousehold/,
    );

    assert.deepEqual(
      readProductionOutputs(),
      productionBefore,
      "success and failure probes must leave production generated bytes untouched",
    );
    assert.deepEqual(
      readProductionMtimes(),
      productionMtimesBefore,
      "the isolation test must not rewrite production output even with identical bytes",
    );
  } finally {
    rmSync(mirrorRoot, { recursive: true, force: true });
  }
});

test("generated React preserves household query-helper and schema compatibility exports", () => {
  const client = read("lib/api-client-react/src/generated/api.ts");
  const schemas = read("lib/api-client-react/src/generated/api.schemas.ts");

  for (const operation of [
    "GetCareState",
    "ListCareEntries",
    "ListCareEntryTombstones",
    "ListHouseholdAuditEvents",
    "ListHouseholdInvitations",
    "ListHouseholdSharingCleanup",
  ]) {
    assert.match(
      client,
      new RegExp(`export const get${operation}QueryKey\\b`),
      `${operation} must retain its public query-key helper name`,
    );
    assert.match(
      client,
      new RegExp(`export const get${operation}QueryOptions\\b`),
      `${operation} must retain its public query-options helper name`,
    );
  }

  for (const [compatibilityName, canonicalName] of [
    ["AccessPassRole", "HouseholdAccessPassRole"],
    ["HouseholdAuditAction", "HouseholdAuditEventAction"],
    ["HouseholdAuditLifecycleState", "HouseholdAuditEventLifecycleState"],
  ] as const) {
    assert.match(
      schemas,
      new RegExp(`export type ${compatibilityName} = ${canonicalName};`),
      `${compatibilityName} must remain a type-compatible generated schema export`,
    );
  }
});

test("React package root preserves transport and household query compatibility exports", async () => {
  const publicIndex = read("lib/api-client-react/src/index.ts");
  for (const exportName of [
    "setAuthTokenGetter",
    "setBaseUrl",
    "getListCareEntriesHouseholdQueryKey",
  ]) {
    assert.match(
      publicIndex,
      new RegExp(`\\b${exportName}\\b`),
      `${exportName} must survive canonical generation at the package root`,
    );
  }

  const bundleDirectory = mkdtempSync(
    join(tmpdir(), "woofwatcher-api-client-root-"),
  );
  const bundlePath = join(bundleDirectory, "api-client-root.mjs");
  try {
    await build({
      entryPoints: [join(root, "lib/api-client-react/src/index.ts")],
      bundle: true,
      format: "esm",
      platform: "node",
      outfile: bundlePath,
      logLevel: "silent",
    });
    const publicApi = (await import(pathToFileURL(bundlePath).href)) as Record<
      string,
      unknown
    >;
    assert.equal(typeof publicApi.setAuthTokenGetter, "function");
    assert.equal(typeof publicApi.setBaseUrl, "function");
    assert.equal(
      typeof publicApi.getListCareEntriesHouseholdQueryKey,
      "function",
    );
    const queryKey = (
      publicApi.getListCareEntriesHouseholdQueryKey as (
        headers: Record<string, string>,
        params: Record<string, unknown>,
      ) => readonly unknown[]
    )(
      { "X-WoofWatcher-Expected-Household-Id": "household-root-proof" },
      { limit: 5 },
    );
    assert.deepEqual(queryKey, [
      "/api/care-entries",
      "household-root-proof",
      { params: { limit: 5 } },
    ]);
  } finally {
    rmSync(bundleDirectory, { recursive: true, force: true });
  }
});

test("Zod public compatibility validators remain runtime-importable and exact", async () => {
  const apiZod = (await import("@workspace/api-zod")) as Record<
    string,
    { safeParse(value: unknown): { success: boolean } } | undefined
  >;

  const validAuditEvent = {
    id: "audit-1",
    action: "invitation-created",
    lifecycleState: "invite-created",
    actorUserId: "user-1",
    householdId: "household-1",
    createdAt: "2026-08-29T00:00:00.000Z",
    storage: "provider-durable",
    boundary: "provider",
  };
  const validInvitation = {
    id: "invitation-1",
    householdId: "household-1",
    inviteCode: "invite-code",
    role: "sitter",
    lifecycleState: "approved",
    runtimeLifecycleState: "approved",
    expired: false,
    createdByUserId: "user-1",
    createdAt: "2026-08-29T00:00:00.000Z",
    storage: "provider-durable",
    boundary: "provider",
  };
  const validCleanupCandidate = {
    id: "cleanup-1",
    kind: "expired-invitation",
    targetId: "invitation-1",
    householdId: "household-1",
    title: "Expired invitation",
    detail: "Review access",
    role: "sitter",
    expiresAt: "2026-08-28T00:00:00.000Z",
    staleSince: "2026-08-28T00:00:00.000Z",
    recommendedAction: "mark-invitation-expired",
    storage: "review-only",
    boundary: "provider",
  };
  const validTombstone = {
    id: "tombstone-1",
    householdId: "household-1",
    entryId: "entry-1",
    deletedAt: "2026-08-29T00:00:00.000Z",
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  };

  for (const [name, value] of [
    ["CareEntryTombstone", validTombstone],
    ["HouseholdAuditEvent", validAuditEvent],
    ["HouseholdAuditEventListFilters", {}],
    ["HouseholdInvitation", validInvitation],
    ["HouseholdInvitationLifecycleState", "approved"],
    ["HouseholdInvitationListFilters", {}],
    ["HouseholdSharingCleanupCandidate", validCleanupCandidate],
    ["HouseholdSharingCleanupFilters", {}],
    ["HouseholdSharingCleanupKind", "expired-invitation"],
    ["HouseholdSharingCleanupRecommendedAction", "mark-invitation-expired"],
  ] as const) {
    const validator = apiZod[name];
    assert.ok(validator, `${name} must remain a runtime export`);
    assert.equal(
      validator.safeParse(value).success,
      true,
      `${name} must preserve its accepted contract`,
    );
  }

  assert.equal(
    apiZod.HouseholdInvitationLifecycleState?.safeParse("invented").success,
    false,
  );
  assert.equal(
    apiZod.HouseholdSharingCleanupKind?.safeParse("invented").success,
    false,
  );
});

test("TypeScript consumers can import every restored React compatibility name", () => {
  const fixtureDirectory = mkdtempSync(
    join(tmpdir(), "woofwatcher-generated-client-compatibility-"),
  );
  const fixturePath = join(fixtureDirectory, "contract.ts");
  const clientSpecifier = relative(
    fixtureDirectory,
    join(root, "lib/api-client-react/src/generated/api.ts"),
  ).replaceAll("\\", "/");
  const schemasSpecifier = relative(
    fixtureDirectory,
    join(root, "lib/api-client-react/src/generated/api.schemas.ts"),
  ).replaceAll("\\", "/");
  const publicIndexSpecifier = relative(
    fixtureDirectory,
    join(root, "lib/api-client-react/src/index.ts"),
  ).replaceAll("\\", "/");
  const fixture = `
import {
  getListCareEntriesHouseholdQueryKey,
  setAuthTokenGetter,
  setBaseUrl,
} from "${publicIndexSpecifier}";
import {
  getGetCareStateQueryKey,
  getGetCareStateQueryOptions,
  getListCareEntriesQueryKey,
  getListCareEntriesQueryOptions,
  getListCareEntryTombstonesQueryKey,
  getListCareEntryTombstonesQueryOptions,
  getListHouseholdAuditEventsQueryKey,
  getListHouseholdAuditEventsQueryOptions,
  getListHouseholdInvitationsQueryKey,
  getListHouseholdInvitationsQueryOptions,
  getListHouseholdSharingCleanupQueryKey,
  getListHouseholdSharingCleanupQueryOptions,
} from "${clientSpecifier}";
import type {
  AccessPassRole,
  HouseholdAccessPassRole,
  HouseholdAuditAction,
  HouseholdAuditEventAction,
  HouseholdAuditEventLifecycleState,
  HouseholdAuditLifecycleState,
} from "${schemasSpecifier}";

const headers = { "X-WoofWatcher-Expected-Household-Id": "household-A" };
const params = { limit: 5 };

setBaseUrl(null);
setAuthTokenGetter(null);
getListCareEntriesHouseholdQueryKey(headers, params);
getGetCareStateQueryKey(headers);
getGetCareStateQueryOptions(headers);
getListCareEntriesQueryKey(headers, params);
getListCareEntriesQueryOptions(headers, params);
getListCareEntryTombstonesQueryKey(headers, params);
getListCareEntryTombstonesQueryOptions(headers, params);
getListHouseholdAuditEventsQueryKey(headers, params);
getListHouseholdAuditEventsQueryOptions(headers, params);
getListHouseholdInvitationsQueryKey(headers, params);
getListHouseholdInvitationsQueryOptions(headers, params);
getListHouseholdSharingCleanupQueryKey(headers, params);
getListHouseholdSharingCleanupQueryOptions(headers, params);

const accessPassRole: AccessPassRole = "sitter";
const canonicalAccessPassRole: HouseholdAccessPassRole = accessPassRole;
const auditAction: HouseholdAuditAction = "invitation-created";
const canonicalAuditAction: HouseholdAuditEventAction = auditAction;
const lifecycle: HouseholdAuditLifecycleState = "invite-created";
const canonicalLifecycle: HouseholdAuditEventLifecycleState = lifecycle;
void [canonicalAccessPassRole, canonicalAuditAction, canonicalLifecycle];
`;

  try {
    writeFileSync(fixturePath, fixture);
    execFileSync(
      join(root, "node_modules/.bin/tsc"),
      [
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--module",
        "esnext",
        "--moduleResolution",
        "bundler",
        "--target",
        "es2022",
        "--lib",
        "es2022,dom",
        "--allowImportingTsExtensions",
        fixturePath,
      ],
      { cwd: root },
    );
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

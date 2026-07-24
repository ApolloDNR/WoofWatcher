import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { createCareStateRouter } from "../src/routes/care-state-router.ts";

const testCareStateTable = pgTable("care_state", {
  householdId: uuid("household_id").primaryKey(),
  doc: jsonb("doc").$type<Record<string, unknown>>().notNull().default({}),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

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

const careStateHouseholdId = "11111111-1111-4111-8111-111111111111";

async function createCareStateDatabase(input?: {
  version?: number;
  doc?: Record<string, unknown>;
}) {
  const client = new PGlite();
  await client.exec(`
    create table care_state (
      household_id uuid primary key,
      doc jsonb not null default '{}'::jsonb,
      version integer not null default 1,
      updated_by text,
      updated_at timestamptz not null default now()
    );
    create table care_state_update_audit (
      household_id uuid not null,
      version integer not null,
      doc jsonb not null
    );
    create function audit_care_state_update() returns trigger as $$
    begin
      insert into care_state_update_audit (household_id, version, doc)
      values (new.household_id, new.version, new.doc);
      return new;
    end;
    $$ language plpgsql;
    create trigger care_state_update_audit_trigger
      after update on care_state
      for each row execute function audit_care_state_update();
  `);
  if (input) {
    await client.query(
      `
        insert into care_state
          (household_id, doc, version, updated_by, updated_at)
        values ($1, $2::jsonb, $3, 'user-base', '2026-07-23T12:00:00.000Z')
      `,
      [
        careStateHouseholdId,
        JSON.stringify(input.doc ?? { winner: "base" }),
        input.version ?? 7,
      ],
    );
  }
  return {
    client,
    db: drizzle(client),
  };
}

async function withCareStateApi(
  db: ReturnType<typeof drizzle>,
  fn: (url: string) => Promise<void>,
  options: {
    getActiveHouseholdId?: () => Promise<string>;
  } = {},
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(
    createCareStateRouter({
      db,
      careStateTable: testCareStateTable,
      queryOps: { and, eq, sql },
      requireAuth(req: Request, _res: Response, next: NextFunction) {
        (req as Request & { userId?: string }).userId =
          req.header("x-test-user") ?? "user-test";
        next();
      },
      getUserId(req: Request) {
        return (req as Request & { userId?: string }).userId ?? "missing-user";
      },
      getActiveHouseholdId:
        options.getActiveHouseholdId ?? (async () => careStateHouseholdId),
    }),
  );
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${port}/care-state`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test("concurrent version-7 care-state writes have one winner and one version-8 conflict", async (t) => {
  const { client, db } = await createCareStateDatabase({
    version: 7,
    doc: { winner: "base" },
  });
  t.after(() => client.close());

  await withCareStateApi(db, async (url) => {
    const responses = await Promise.all(
      ["writer-a", "writer-b"].map((winner) =>
        fetch(`${url}?householdId=${careStateHouseholdId}`, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "x-test-user": winner,
          },
          body: JSON.stringify({ version: 7, doc: { winner } }),
        }),
      ),
    );
    const payloads = await Promise.all(
      responses.map(async (response) => ({
        status: response.status,
        body: (await response.json()) as {
          householdId: string;
          version: number;
          doc: { winner: string };
        },
      })),
    );
    const winning = payloads.find(({ status }) => status === 200);
    const conflict = payloads.find(({ status }) => status === 409);
    const persisted = await client.query<{
      version: number;
      doc: { winner: string };
    }>("select version, doc from care_state");
    const audit = await client.query<{ count: number }>(
      "select count(*)::integer as count from care_state_update_audit",
    );

    assert.deepEqual(
      payloads.map(({ status }) => status).sort((a, b) => a - b),
      [200, 409],
    );
    assert.equal(audit.rows[0]?.count, 1);
    assert.equal(winning?.body.version, 8);
    assert.equal(conflict?.body.version, 8);
    assert.equal(winning?.body.householdId, careStateHouseholdId);
    assert.equal(conflict?.body.householdId, careStateHouseholdId);
    assert.deepEqual(conflict?.body.doc, winning?.body.doc);
    assert.equal(persisted.rows[0]?.version, 8);
    assert.deepEqual(persisted.rows[0]?.doc, winning?.body.doc);
  });
});

test("empty care-state CAS returning re-reads to distinguish conflict from missing", async (t) => {
  const { client, db } = await createCareStateDatabase({
    version: 8,
    doc: { winner: "current" },
  });
  t.after(() => client.close());

  await withCareStateApi(db, async (url) => {
    const stale = await fetch(`${url}?householdId=${careStateHouseholdId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 7, doc: { winner: "stale" } }),
    });
    const staleBody = (await stale.json()) as {
      version: number;
      doc: { winner: string };
    };
    assert.equal(stale.status, 409);
    assert.equal(staleBody.version, 8);
    assert.deepEqual(staleBody.doc, { winner: "current" });

    await client.query("delete from care_state where household_id = $1", [
      careStateHouseholdId,
    ]);
    const missing = await fetch(`${url}?householdId=${careStateHouseholdId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 8, doc: { winner: "missing" } }),
    });
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "Care state not found" });
  });
});

test("care-state GET and PUT reject a captured household after the active household switches", async (t) => {
  const h2 = "22222222-2222-4222-8222-222222222222";
  const { client, db } = await createCareStateDatabase({
    version: 7,
    doc: { household: "h1" },
  });
  t.after(() => client.close());
  await client.query(
    `
      insert into care_state
        (household_id, doc, version, updated_by, updated_at)
      values ($1, $2::jsonb, 7, 'user-h2', '2026-07-23T12:00:00.000Z')
    `,
    [h2, JSON.stringify({ household: "h2" })],
  );

  let activeHouseholdId = careStateHouseholdId;
  await withCareStateApi(
    db,
    async (url) => {
      const boundGet = await fetch(
        `${url}?householdId=${careStateHouseholdId}`,
      );
      assert.equal(boundGet.status, 200);
      assert.equal(
        ((await boundGet.json()) as { householdId: string }).householdId,
        careStateHouseholdId,
      );

      activeHouseholdId = h2;
      const staleGet = await fetch(
        `${url}?householdId=${careStateHouseholdId}`,
      );
      assert.equal(staleGet.status, 412);
      assert.deepEqual(await staleGet.json(), {
        error:
          "Active household changed before care-state access. Restart in the current household.",
        currentHouseholdId: h2,
      });

      const stalePut = await fetch(
        `${url}?householdId=${careStateHouseholdId}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: 7,
            doc: { household: "cross-scope-write" },
          }),
        },
      );
      assert.equal(stalePut.status, 412);
      const h2Row = await client.query<{ doc: { household: string } }>(
        "select doc from care_state where household_id = $1",
        [h2],
      );
      assert.deepEqual(h2Row.rows[0]?.doc, { household: "h2" });
    },
    {
      getActiveHouseholdId: async () => activeHouseholdId,
    },
  );
});

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
    "GetWoofguideEventsStatusResponse",
    "CreateWoofguideEventsBody",
    "CreateWoofguideEventsResponse",
    "StylizeAvatarBody",
    "StylizeAvatarResponse",
    "CreateAvatarEmotionsBody",
    "CreateAvatarEmotionsResponse",
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

test("care entries list query stays documented, typed, and validation-aware", () => {
  const route = readCareEntriesRouteSource();
  const queryHelper = read("artifacts/api-server/src/lib/care-entry-query.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const zodSchemas = read("lib/api-zod/src/generated/api.ts");
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
    zodSchemas,
    /"updatedSince":\s*zod\.date\(\)\.optional\(\)/,
    "Zod generated validator must validate the care-entries updatedSince query",
  );
  assert.match(
    zodSchemas,
    /"since":\s*zod\.date\(\)\.optional\(\)/,
    "Zod generated validator must validate the care-entries since query",
  );
  assert.match(
    zodSchemas,
    /"limit":\s*zod\.number\(\)/,
    "Zod generated validator must validate the care-entries limit query",
  );
});

test("complete care history pagination stays coherent, indexed, and generated end to end", () => {
  const migration = read(
    "supabase/migrations/0008_care_entry_history_cursor.sql",
  );
  const householdsSchema = read("lib/db/src/schema/households.ts");
  const careEntriesSchema = read("lib/db/src/schema/careEntries.ts");
  const route = readCareEntriesRouteSource();
  const wrapper = read("artifacts/api-server/src/routes/care-entries.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const zodApi = read("lib/api-zod/src/generated/api.ts");

  assert.match(
    migration,
    /add column if not exists care_history_generation bigint not null default 0/i,
  );
  assert.match(
    migration,
    /create index if not exists care_entries_history_cursor_idx[\s\S]*\(household_id,\s*occurred_at desc,\s*id desc\)/i,
  );
  assert.match(
    migration,
    /alter column occurred_at type timestamptz\(3\)/i,
    "stored occurrence precision must exactly match JavaScript history cursors",
  );
  assert.match(
    migration,
    /tg_op = 'UPDATE'[\s\S]*old\.household_id is distinct from new\.household_id[\s\S]*old\.household_id[\s\S]*new\.household_id/i,
    "moving a row must invalidate both old and new household snapshots",
  );
  assert.match(
    migration,
    /after insert or update or delete on public\.care_entries/i,
    "old writers must advance history generation without API cooperation",
  );
  assert.match(
    householdsSchema,
    /careHistoryGeneration:\s*bigint\("care_history_generation",\s*\{\s*mode:\s*"number",?\s*\}\)/,
  );
  assert.match(
    careEntriesSchema,
    /index\("care_entries_history_cursor_idx"\)[\s\S]*table\.householdId[\s\S]*table\.occurredAt[\s\S]*table\.id/,
  );
  assert.match(
    careEntriesSchema,
    /occurredAt:\s*timestamp\("occurred_at",\s*\{\s*withTimezone:\s*true,\s*precision:\s*3,?\s*\}\)/,
  );

  assert.match(route, /router\.get\("\/care-entries\/history", requireAuth/);
  assert.match(route, /normalizeListCareEntryHistoryQuery\(req\.query\)/);
  assert.match(
    route,
    /and\([\s\S]*eq\(careEntriesTable\.householdId,\s*householdId\)[\s\S]*visibleToUser\(careEntriesTable,\s*userId\)[\s\S]*or\([\s\S]*lt\(careEntriesTable\.occurredAt,\s*beforeOccurredAt\)[\s\S]*and\([\s\S]*eq\(careEntriesTable\.occurredAt,\s*beforeOccurredAt\)[\s\S]*lt\(careEntriesTable\.id,\s*beforeId\)/,
    "visibility must remain outside the strict occurredAt/id cursor OR",
  );
  assert.match(
    route,
    /orderBy\(\s*desc\(careEntriesTable\.occurredAt\),\s*desc\(careEntriesTable\.id\),?\s*\)/,
  );
  assert.match(route, /readCoherentCareEntryHistoryPage/);
  assert.match(wrapper, /\blt\b/);
  assert.match(wrapper, /householdsTable/);

  const historyBlock = section(
    openapi,
    "  /care-entries/history:",
    "  /care-entries/tombstones:",
  );
  assert.match(historyBlock, /operationId:\s*listCareEntryHistory/);
  for (const field of [
    "householdId",
    "beforeOccurredAt",
    "beforeId",
    "expectedGeneration",
    "limit",
  ]) {
    assert.match(historyBlock, new RegExp(`name:\\s+${field}`));
  }
  assert.match(historyBlock, /"200":/);
  assert.match(historyBlock, /"400":/);
  assert.match(historyBlock, /"409":/);
  assert.match(historyBlock, /"401":/);
  assert.match(
    historyBlock,
    /name:\s+householdId[\s\S]*required:\s+true[\s\S]*pattern:\s+['"]?\^\[0-9a-f\]/,
    "history requests must bind to one canonical household scope",
  );
  assert.match(
    historyBlock,
    /name:\s+beforeOccurredAt[\s\S]*millisecond[\s\S]*pattern:/i,
    "the public cursor contract must document exact millisecond precision",
  );
  assert.match(
    reactSchemas,
    /export interface CareEntryHistoryEnvelope \{[\s\S]*householdId:\s*string;/,
  );
  assert.match(reactClient, /export const listCareEntryHistory/);
  assert.match(reactSchemas, /export interface CareEntryHistoryEnvelope/);
  assert.match(
    reactSchemas,
    /export type ListCareEntryHistoryParams = \{[\s\S]*beforeOccurredAt\?:\s*string;[\s\S]*beforeId\?:\s*string;[\s\S]*expectedGeneration\?:\s*number;/,
  );
  assert.match(zodApi, /export const ListCareEntryHistoryQueryParams/);
  assert.match(zodApi, /export const ListCareEntryHistoryResponse/);
});

test("care entry server cursor and tombstone contract stays source-backed", () => {
  const route = readCareEntriesRouteSource();
  const schema = read("lib/db/src/schema/careEntries.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodTypesIndex = read("lib/api-zod/src/generated/types/index.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const tombstoneBlock = section(
    openapi,
    "  /care-entries/tombstones:",
    "  /care-entries/{id}:",
  );

  assert.match(
    schema,
    /updatedAt:\s*timestamp\("updated_at"/,
    "care entries must store an updatedAt cursor",
  );
  assert.match(
    schema,
    /pgTable\("care_entry_tombstones"/,
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

  assert.match(
    route,
    /router\.get\("\/care-entries\/tombstones", requireAuth/,
    "care-entry tombstones need an authenticated list route",
  );
  assert.match(
    route,
    /ListCareEntryTombstonesResponse\.parse/,
    "care-entry tombstones should use the generated response validator",
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
    zodApi,
    /export const ListCareEntryTombstonesQueryParams/,
    "Zod must validate tombstone query params",
  );
  assert.match(
    zodApi,
    /export const ListCareEntryTombstonesResponseItem/,
    "Zod must expose the tombstone item validator used by the list response",
  );
  assert.match(
    zodApi,
    /export const ListCareEntryTombstonesResponse/,
    "Zod must expose the tombstone response",
  );
  assert.match(
    zodTypesIndex,
    /careEntryTombstone/,
    "Zod generated type exports must include tombstones",
  );
  assert.match(
    reactSchemas,
    /export interface CareEntryTombstone/,
    "React schemas must type tombstone rows",
  );
  assert.match(
    reactSchemas,
    /export (?:interface|type) ListCareEntryTombstonesParams/,
    "React schemas must type tombstone query params",
  );
  assert.match(
    reactClient,
    /listCareEntryTombstones/,
    "React client must expose the tombstone fetcher",
  );
  assert.match(
    reactClient,
    /ListCareEntryTombstonesQueryError = ErrorType<ApiError>/,
    "React tombstone query error alias must expose ApiError bodies",
  );
});

test("private care entries stay server-enforced and retain creator identity", () => {
  const route = readCareEntriesRouteSource();
  const schema = read("lib/db/src/schema/careEntries.ts");
  const migrationPath = "supabase/migrations/0004_care_entry_visibility.sql";
  assert.equal(
    existsSync(join(root, migrationPath)),
    true,
    "private care entries need a durable migration",
  );
  const migration = read(migrationPath);
  const careContext = read(
    "artifacts/woofwatcher-mobile/context/CareContext.tsx",
  );

  assert.match(
    migration,
    /alter table public\.care_entries[\s\S]*household_visible boolean not null default true/i,
    "care entries need a durable server visibility column",
  );
  assert.match(
    migration,
    /alter table public\.care_entry_tombstones[\s\S]*household_visible boolean not null default true[\s\S]*caregiver_user_id text/i,
    "tombstones need durable visibility and creator identity",
  );
  assert.match(
    migration,
    /update public\.care_entry_tombstones[\s\S]*household_visible\s*=\s*false[\s\S]*caregiver_user_id\s*=\s*coalesce\(caregiver_user_id,\s*deleted_by_user_id\)/i,
    "pre-migration tombstones must be quarantined and retain the best available creator",
  );
  assert.match(
    migration,
    /create or replace function public\.derive_care_entry_visibility\(\)[\s\S]*new\.household_visible\s*:=\s*case[\s\S]*new\.details\s*->>\s*'householdVisible'[\s\S]*create trigger care_entries_visibility_guard[\s\S]*before insert or update on public\.care_entries/i,
    "a database trigger must protect private entries from old rolling-deploy writers",
  );
  assert.match(
    migration,
    /create or replace function public\.quarantine_unowned_care_entry_tombstone\(\)[\s\S]*new\.caregiver_user_id is null[\s\S]*new\.caregiver_user_id\s*:=\s*new\.deleted_by_user_id[\s\S]*new\.household_visible\s*:=\s*false[\s\S]*create trigger care_entry_tombstones_visibility_guard[\s\S]*before insert or update on public\.care_entry_tombstones/i,
    "a database trigger must quarantine tombstones written without creator identity",
  );
  assert.match(
    schema,
    /householdVisible:\s*boolean\("household_visible"\)\.notNull\(\)\.default\(true\)/,
    "Drizzle care entries and tombstones must expose durable visibility",
  );
  assert.match(
    schema,
    /careEntryTombstonesTable[\s\S]*caregiverUserId:\s*text\("caregiver_user_id"\)/,
    "Drizzle tombstones must retain the original creator id",
  );
  assert.match(
    route,
    /or\(eq\(table\.householdVisible, true\), eq\(table\.caregiverUserId, userId\)\)/,
    "every private read/mutation predicate must allow only shared rows or their author",
  );
  assert.match(
    route,
    /householdVisible:\s*policy\.details\.householdVisible !== false/,
    "creates and updates must derive server visibility from details",
  );
  assert.match(
    route,
    /eq\(\s*careEntriesTable\.householdVisible,\s*existing\.householdVisible,\s*\)/,
    "PATCH must compare the current visibility with the separately-read value",
  );
  assert.match(
    route,
    /sql`\$\{careEntriesTable\.details\} ->> 'clientKey' = \$\{clientKey\}`,\s*visibleToUser\(careEntriesTable, userId\)/,
    "idempotent create lookups must not return another author's private row",
  );
  assert.match(
    route,
    /caregiverUserId:\s*deleted\.caregiverUserId/,
    "delete tombstones must retain the original creator id",
  );
  assert.match(
    route,
    /householdVisible:\s*deleted\.householdVisible/,
    "delete tombstones must retain the original visibility boundary",
  );
  assert.match(
    careContext,
    /caregiverUserId\?:\s*string/,
    "mobile entries must retain server creator identity",
  );
  assert.match(
    careContext,
    /caregiverUserId:\s*c\.caregiverUserId \?\? undefined/,
    "mobile API mapping must not drop creator identity",
  );
  assert.match(
    careContext,
    /caregiverUserId:\s*entry\.caregiverUserId \?\? userId \?\? undefined/,
    "optimistic mobile entries must preserve or stamp creator identity",
  );
});

test("care state write errors stay documented and typed", () => {
  const route = readCareStateRouteSource();
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");

  const putCareStateBlock =
    openapi.match(/    put:\r?\n[\s\S]*?  \/care-entries:/)?.[0] ?? "";

  assert.match(
    route,
    /res\.status\(400\)/,
    "care-state PUT should still return validation errors",
  );
  assert.match(
    route,
    /res\.status\(404\)/,
    "care-state PUT should still return missing document errors",
  );
  assert.match(
    route,
    /res\.status\(409\)/,
    "care-state PUT should still return optimistic conflict envelopes",
  );
  assert.match(
    route,
    /and\(\s*eq\(careStateTable\.householdId, householdId\),\s*eq\(careStateTable\.version, parsed\.data\.version\),?\s*\)/,
    "care-state writes must claim the household and expected version atomically",
  );
  assert.match(
    route,
    /version:\s*sql`\$\{careStateTable\.version\} \+ 1`/,
    "care-state writes must increment from the database version column",
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
    reactClient,
    /getPutCareStateMutationOptions = <TError = ErrorType<ApiError \| CareStateEnvelope \| CareEntryHouseholdScopeConflict>/,
    "React API mutation must type care-state write errors as ApiError or conflict envelope",
  );
  assert.match(
    reactClient,
    /PutCareStateMutationError = ErrorType<ApiError \| CareStateEnvelope \| CareEntryHouseholdScopeConflict>/,
    "React API mutation error alias must preserve validation/not-found and conflict response shapes",
  );
});

test("care entry write errors stay documented and typed", () => {
  const route = readCareEntriesRouteSource();
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
    reactClient,
    /getCreateCareEntryMutationOptions = <TError = ErrorType<ApiError \| CareEntryHouseholdScopeConflict>/,
    "React API create mutation must type validation errors as ApiError",
  );
  assert.match(
    reactClient,
    /CreateCareEntryMutationError = ErrorType<ApiError \| CareEntryHouseholdScopeConflict>/,
    "React API create mutation error alias must expose validation error bodies",
  );
  assert.match(
    reactClient,
    /UpdateCareEntryMutationError = ErrorType<ApiError \| CareEntry \| CareEntryHouseholdScopeConflict>/,
    "React API update mutation error alias must preserve invalid/not-found errors and the current conflict row",
  );
  assert.match(
    reactClient,
    /DeleteCareEntryMutationError = ErrorType<ApiError \| CareEntryDeleteAbsent \| CareEntryHouseholdScopeConflict>/,
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
    "  /household/members/{id}:",
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
    route,
    /router\.patch\("\/me", requireAuth/,
    "updateMe must stay authenticated",
  );
  assert.match(
    route,
    /router\.patch\("\/household", requireAuth/,
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
    `${route}\n${read("artifacts/api-server/src/lib/household-invitations.ts")}`,
    /Invite code not found/,
    "joinHousehold must keep the owner-readable missing-invite error",
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
    /"403":/,
    "OpenAPI must document rejected, expired, accepted, and revoked invitation errors",
  );
  assert.match(
    joinHouseholdBlock,
    /"404":/,
    "OpenAPI must keep documenting missing invite errors",
  );
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

test("active household selection and atomic invitation claims stay durable, caller-scoped, and typed", () => {
  const route = read("artifacts/api-server/src/routes/household.ts");
  const household = read("artifacts/api-server/src/lib/household.ts");
  const migration = read("supabase/migrations/0005_user_active_household.sql");
  const userSchema = read("lib/db/src/schema/users.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactClient = read("lib/api-client-react/src/generated/api.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const zodApi = read("lib/api-zod/src/generated/api.ts");

  assert.match(migration, /add column if not exists active_household_id uuid/i);
  assert.match(migration, /^\s*begin;|[\r\n]begin;/i);
  assert.match(migration, /commit;\s*$/i);
  assert.match(
    migration,
    /add constraint users_active_household_id_fkey[\s\S]*references public\.households\(id\)[\s\S]*on delete set null/i,
  );
  assert.match(
    migration,
    /row_number\(\) over \(\s*partition by user_id\s*order by created_at,\s*household_id\s*\)/i,
  );
  assert.match(
    migration,
    /create index if not exists users_active_household_id_idx/i,
  );
  assert.match(
    userSchema,
    /activeHouseholdId:\s*uuid\("active_household_id"\)/,
  );
  assert.match(
    household,
    /resolveActiveHouseholdSelection/,
    "resolver must validate and persist the selected eligible membership",
  );
  assert.match(
    household,
    /activeHouseholdId:\s*householdId/,
    "resolver must persist deterministic fallback and initial household selection",
  );
  assert.match(
    household,
    /accessPassExpired/,
    "expired Access Pass memberships must not resolve as active",
  );

  assert.match(route, /router\.get\("\/me\/households", requireAuth/);
  assert.match(route, /router\.put\("\/me\/active-household", requireAuth/);
  assert.match(
    route,
    /eq\(householdMembersTable\.userId,\s*userId\)/,
    "membership list and selection must stay caller-scoped",
  );
  assert.match(
    route,
    /acceptHouseholdInvitationAtomically/,
    "join must use the transaction coordinator",
  );
  assert.match(route, /db\.transaction/);
  assert.match(
    route,
    /eq\(\s*householdInvitationsTable\.lifecycleState,\s*"approved",?\s*\)/,
  );
  assert.match(
    route,
    /gt\(householdInvitationsTable\.expiresAt,\s*now\)/,
    "expiry must be part of the atomic invitation claim predicate",
  );
  assert.doesNotMatch(
    section(
      route,
      'router.post("/household/join"',
      'router.get("/household/sharing-cleanup"',
    ),
    /householdsTable\.inviteCode/,
    "join must never authorize permanent household codes",
  );
  assert.match(
    route,
    /assertHouseholdOwnerActionAllowed\(actor\?\.role,\s*"rename"\)/,
  );

  for (const path of ["/me/households:", "/me/active-household:"]) {
    assert.match(openapi, new RegExp(`^  ${path.replace("/", "\\/")}`, "m"));
  }
  for (const operation of [
    "listMyHouseholds",
    "selectActiveHousehold",
    "createHouseholdInvitation",
    "listHouseholdInvitations",
  ]) {
    assert.match(reactClient, new RegExp(`\\b${operation}\\b`));
  }
  assert.match(reactSchemas, /export interface HouseholdMembershipList/);
  assert.match(reactSchemas, /export interface ActiveHouseholdSelection/);
  assert.match(zodApi, /export const ListMyHouseholdsResponse/);
  assert.match(zodApi, /export const SelectActiveHouseholdBody/);
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
  const careStateRoute = readCareStateRouteSource();
  const careEntriesRoute = readCareEntriesRouteSource();
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
    /const householdId = await getActiveHouseholdId\(userId\)/,
    "care-state should resolve the active household from the authenticated user",
  );
  assert.match(
    careStateRoute,
    /where\(eq\(careStateTable\.householdId, householdId\)\)/,
    "care-state reads and writes must stay scoped to the active household",
  );

  for (const route of [
    /router\.get\("\/care-entries", requireAuth/,
    /router\.post\("\/care-entries", requireAuth/,
    /router\.patch\("\/care-entries\/:id", requireAuth/,
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
    updateCareEntryBlock,
    /"409":/,
    "OpenAPI must document stale care-entry update conflicts",
  );
  assert.match(
    deleteCareEntryBlock,
    /"401":/,
    "OpenAPI must document unauthenticated care-entry deletes",
  );

  assert.match(
    reactClient,
    /getGetCareStateQueryOptions = <TData = Awaited<ReturnType<typeof getCareState>>, TError = ErrorType<ApiError \| CareEntryHouseholdScopeConflict>>/,
    "React API care-state query must type auth and not-found errors as ApiError",
  );
  assert.match(
    reactClient,
    /GetCareStateQueryError = ErrorType<ApiError \| CareEntryHouseholdScopeConflict>/,
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
  const careEntriesRoute = readCareEntriesRouteSource();
  const householdLib = read("artifacts/api-server/src/lib/household.ts");
  const rolePolicy = read(
    "artifacts/api-server/src/lib/care-entry-authorization.ts",
  );
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
    deleteCareEntryBlock,
    /"403":/,
    "OpenAPI must document forbidden care-entry deletes for read-only roles",
  );
  assert.match(
    reactClient,
    /CreateCareEntryMutationError = ErrorType<ApiError \| CareEntryHouseholdScopeConflict>/,
    "React API create mutation must keep role-policy errors typed as ApiError",
  );
  assert.match(
    reactClient,
    /UpdateCareEntryMutationError = ErrorType<ApiError \| CareEntry \| CareEntryHouseholdScopeConflict>/,
    "React API update mutation must keep role-policy errors and current conflict rows typed",
  );
  assert.match(
    reactClient,
    /DeleteCareEntryMutationError = ErrorType<ApiError \| CareEntryDeleteAbsent \| CareEntryHouseholdScopeConflict>/,
    "React API delete mutation must keep role-policy errors typed as ApiError",
  );
});

test("care-entry revisions stay durable, contract-required, and generated end to end", () => {
  const migration = read("supabase/migrations/0006_care_entry_revision.sql");
  const schema = read("lib/db/src/schema/careEntries.ts");
  const route = readCareEntriesRouteSource();
  const openapi = read("lib/api-spec/openapi.yaml");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
  const zodApi = read("lib/api-zod/src/generated/api.ts");

  assert.match(migration, /^\s*begin;|[\r\n]begin;/i);
  assert.match(
    migration,
    /alter table public\.care_entries[\s\S]*add column if not exists revision integer not null default 1/i,
  );
  assert.match(
    migration,
    /check\s*\(\s*revision\s*>=\s*1\s*\)/i,
    "the durable store must reject invalid revision values",
  );
  assert.match(
    migration,
    /create or replace function public\.enforce_care_entry_revision\(\)[\s\S]*if old\.revision = 2147483647[\s\S]*if new\.revision = old\.revision then[\s\S]*new\.revision := old\.revision \+ 1[\s\S]*elsif new\.revision <> old\.revision \+ 1 then[\s\S]*raise exception/i,
    "the rollout trigger must bump legacy writes and reject overflow, jumps, or backwards revisions",
  );
  assert.match(
    migration,
    /create trigger enforce_care_entry_revision\s+before update on public\.care_entries\s+for each row execute function public\.enforce_care_entry_revision\(\)/i,
    "every care-entry update must pass through the rollout revision guard",
  );
  assert.match(migration, /commit;\s*$/i);

  assert.match(
    schema,
    /revision:\s*integer\("revision"\)\.notNull\(\)\.default\(1\)/,
  );
  assert.match(
    schema,
    /check\(\s*"care_entries_revision_minimum",\s*sql`\$\{table\.revision\}\s*>=\s*1`\s*,?\s*\)/,
    "the Drizzle schema must model the migration's revision minimum",
  );
  assert.match(
    route,
    /eq\(careEntriesTable\.revision,\s*parsed\.data\.expectedRevision\)/,
    "PATCH must compare the expected revision in the update predicate",
  );
  assert.match(
    route,
    /revision:\s*sql`\$\{careEntriesTable\.revision\}\s*\+\s*1`/,
    "PATCH must increment revision inside the same SQL update",
  );
  assert.match(
    route,
    /status\(409\)[\s\S]{0,100}\.json\(UpdateCareEntryResponse\.parse\(/,
    "a stale PATCH must return the current typed row",
  );

  const careEntrySchema = section(
    openapi,
    "    CareEntry:\n",
    "    CareEntryTombstone:\n",
  );
  const careEntryUpdateStart = openapi.indexOf("    CareEntryUpdate:\n");
  assert.notEqual(careEntryUpdateStart, -1);
  const careEntryUpdateSchema = openapi.slice(careEntryUpdateStart);
  assert.match(
    careEntrySchema,
    /revision:\s*\n\s*type:\s*integer\s*\n\s*minimum:\s*1\s*\n\s*maximum:\s*2147483647\s*\n\s*multipleOf:\s*1/,
  );
  assert.match(careEntrySchema, /required:[\s\S]*-\s*revision/);
  assert.match(
    careEntryUpdateSchema,
    /expectedRevision:\s*\n\s*type:\s*integer\s*\n\s*minimum:\s*1\s*\n\s*maximum:\s*2147483646\s*\n\s*multipleOf:\s*1/,
  );
  assert.match(careEntryUpdateSchema, /required:\s*\n\s*-\s*expectedRevision/);

  assert.match(
    reactSchemas,
    /export interface CareEntry \{[\s\S]*revision:\s*number;/,
  );
  assert.match(
    reactSchemas,
    /export interface CareEntryUpdate \{[\s\S]*expectedRevision:\s*number;/,
  );
  assert.match(
    zodApi,
    /"expectedRevision":\s*zod\.number\(\)\.min\(1\)\.max\(updateCareEntryBodyExpectedRevisionMax\)\.multipleOf\(updateCareEntryBodyExpectedRevisionMultipleOf\)/,
  );
  assert.match(
    zodApi,
    /ListCareEntriesResponseItem = zod\.object\(\{[\s\S]*"revision":\s*zod\.number\(\)\.min\(1\)\.max\(listCareEntriesResponseRevisionMax\)\.multipleOf\(listCareEntriesResponseRevisionMultipleOf\)/,
  );
  assert.match(
    zodApi,
    /UpdateCareEntryResponse = zod\.object\(\{[\s\S]*"revision":\s*zod\.number\(\)\.min\(1\)\.max\(updateCareEntryResponseRevisionMax\)\.multipleOf\(updateCareEntryResponseRevisionMultipleOf\)/,
  );
});

test("household member role mutations keep owner-only and revocation contracts", () => {
  const householdRoute = read("artifacts/api-server/src/routes/household.ts");
  const householdPolicy = read(
    "artifacts/api-server/src/lib/household-authorization.ts",
  );
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
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
  assert.match(
    openapi,
    /HouseholdMemberUpdate:[\s\S]*enum: \[owner, adult, teen, kid, sitter, trainer, walker, vet viewer\]/,
    "OpenAPI must keep household role updates on canonical roles",
  );
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
    zodApi,
    /zod\.enum\(\[['"]owner['"], ['"]adult['"], ['"]teen['"], ['"]kid['"], ['"]sitter['"], ['"]trainer['"], ['"]walker['"], ['"]vet viewer['"]\]\)/,
    "Zod must reject unknown household roles",
  );
  assert.match(
    zodApi,
    /export const RevokeHouseholdMemberParams/,
    "Zod must export revoke-member params",
  );
  assert.match(
    reactSchemas,
    /role\?: HouseholdMemberUpdateRole/,
    "React schemas must expose typed household member roles",
  );
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
  const accessPassPolicy = read(
    "artifacts/api-server/src/lib/household-access-pass.ts",
  );
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
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
    /role:\s*normalizeHouseholdMemberRole\(role\)/,
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
    /ActivateHouseholdAccessPassBody\.safeParse/,
    "Access Pass activation should validate payloads",
  );
  assert.match(
    householdRoute,
    /RevokeHouseholdAccessPassBody\.safeParse/,
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

  for (const schema of [
    "JoinHouseholdResponse",
    "ActivateHouseholdAccessPassBody",
    "RevokeHouseholdAccessPassBody",
    "ActivateHouseholdAccessPassResponse",
    "RevokeHouseholdAccessPassResponse",
  ]) {
    assert.match(
      zodApi,
      new RegExp(`export const ${schema}`),
      `${schema} should be exported from Zod API schemas`,
    );
  }
  assert.match(
    zodApi,
    /zod\.enum\(\[['"]sitter['"], ['"]trainer['"], ['"]walker['"], ['"]vet viewer['"]\]\)/,
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
    reactClient,
    /activateHouseholdAccessPass/,
    "React client must expose Access Pass activation",
  );
  assert.match(
    reactClient,
    /revokeHouseholdAccessPass/,
    "React client must expose Access Pass revocation",
  );
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
  const accessPassPolicy = read(
    "artifacts/api-server/src/lib/household-access-pass.ts",
  );
  const auditSchema = read("lib/db/src/schema/householdAuditEvents.ts");
  const schemaIndex = read("lib/db/src/schema/index.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );

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
    /db\.insert\(householdAuditEventsTable\)\.values\(buildHouseholdAuditInsert\(auditEvent\)\)/,
    "household mutations must persist audit events before returning them",
  );
  assert.match(
    householdRoute,
    /assertAccessPassExpiryAllowed\(parsed\.data\.expiresAt/,
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
  assert.match(
    zodApi,
    /"lifecycleState": zod\.enum\(\[['"]invite-created['"], ['"]invite-accepted['"], ['"]invite-revoked['"], ['"]member-updated['"], ['"]member-revoked['"], ['"]access-pass-active['"], ['"]access-pass-revoked['"], ['"]access-pass-expired['"]\]\)/,
    "Zod must validate household audit lifecycle states",
  );
  assert.match(
    zodApi,
    /"storage": zod\.enum\(\[['"]provider-durable['"]\]\)/,
    "Zod must no longer allow response-only audit storage for provider-ready household mutations",
  );
  assert.match(
    reactSchemas,
    /export type HouseholdAuditEventLifecycleState = typeof HouseholdAuditEventLifecycleState/,
    "React schemas must expose typed household audit lifecycle states",
  );
});

test("household audit review API stays owner-scoped and typed", () => {
  const householdRoute = read("artifacts/api-server/src/routes/household.ts");
  const accessPassPolicy = read(
    "artifacts/api-server/src/lib/household-access-pass.ts",
  );
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
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
    zodApi,
    /export const ListHouseholdAuditEventsResponse/,
    "Zod must expose audit review response",
  );
  assert.match(
    reactSchemas,
    /export (?:interface|type) ListHouseholdAuditEventsParams/,
    "React schemas must type audit review params",
  );
  assert.match(
    reactSchemas,
    /export interface HouseholdAuditEventListResponse/,
    "React schemas must type audit review response",
  );
  assert.match(
    reactClient,
    /listHouseholdAuditEvents/,
    "React client must expose audit review fetcher",
  );
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
  const sharingCleanup = read(
    "artifacts/api-server/src/lib/household-sharing-cleanup.ts",
  );
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
  const zodTypesIndex = read("lib/api-zod/src/generated/types/index.ts");
  const reactSchemas = read(
    "lib/api-client-react/src/generated/api.schemas.ts",
  );
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
    zodApi,
    /export const ListHouseholdSharingCleanupQueryParams/,
    "Zod must validate sharing cleanup query params",
  );
  assert.match(
    zodApi,
    /export const ListHouseholdSharingCleanupResponse[\s\S]*"recommendedAction": zod\.enum/,
    "Zod must validate sharing cleanup candidates in the operation response",
  );
  assert.match(
    zodApi,
    /export const ListHouseholdSharingCleanupResponse/,
    "Zod must expose sharing cleanup response",
  );
  assert.match(
    zodTypesIndex,
    /householdSharingCleanupCandidate/,
    "Zod type exports must include cleanup candidates",
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
    reactClient,
    /listHouseholdSharingCleanup/,
    "React client must expose sharing cleanup fetcher",
  );
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

test("API Zod public barrel avoids schema and generated-type export ambiguity", () => {
  const publicBarrel = read("lib/api-zod/src/index.ts");

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

  for (const task7Type of [
    "CareEntryDeleteAbsent",
    "CareEntryHistoryConflict",
    "CareEntryHistoryEnvelope",
    "CareEntryHouseholdScopeConflict",
    "CreateCareEntryParams",
    "DeleteCareEntryParamsType",
    "GetCareStateParams",
    "ListCareEntryHistoryParams",
    "PutCareStateParams",
    "UpdateCareEntryParamsType",
  ]) {
    assert.match(
      publicBarrel,
      new RegExp(`\\b${task7Type}\\b`),
      `${task7Type} must be available from the package entry`,
    );
  }
});

test("Access Pass expiry is enforced at member-auth request time", () => {
  const household = read("artifacts/api-server/src/lib/household.ts");
  const householdRoute = read("artifacts/api-server/src/routes/household.ts");
  const accessPassPolicy = read(
    "artifacts/api-server/src/lib/household-access-pass.ts",
  );
  const careEntryPolicy = read(
    "artifacts/api-server/src/lib/care-entry-authorization.ts",
  );
  const memberSchema = read("lib/db/src/schema/householdMembers.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
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
  const invitationPolicy = read(
    "artifacts/api-server/src/lib/household-invitations.ts",
  );
  const invitationSchema = read("lib/db/src/schema/householdInvitations.ts");
  const schemaIndex = read("lib/db/src/schema/index.ts");
  const openapi = read("lib/api-spec/openapi.yaml");
  const zodApi = read("lib/api-zod/src/generated/api.ts");
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
    /acceptHouseholdInvitationAtomically/,
    "join route should atomically check invitation lifecycle before creating membership",
  );
  assert.match(
    route,
    /lifecycleState:\s*"accepted"/,
    "join route should mark durable invitation rows accepted",
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
    zodApi,
    /export const RevokeHouseholdInvitationResponse/,
    "Zod must expose an operation-level invitation mutation response validator",
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

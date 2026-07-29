import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import express, { type NextFunction, type Request, type Response } from "express";

import { createCareEntriesRouter } from "../src/routes/care-entries-router.ts";

type SelectCall = {
  table?: unknown;
  where?: unknown;
  orderBy?: unknown;
  limit?: number;
};

type FakeDb = {
  selectCalls: SelectCall[];
  select: () => {
    from: (table: unknown) => {
      where: (where: unknown) => {
        orderBy: (orderBy: unknown) => {
          limit: (limit: number) => Promise<unknown[]>;
        };
      };
    };
  };
};

function createSelectOnlyDb(rows: unknown[]): FakeDb {
  const selectCalls: SelectCall[] = [];

  return {
    selectCalls,
    select() {
      const call: SelectCall = {};
      selectCalls.push(call);

      return {
        from(table: unknown) {
          call.table = table;
          return {
            where(where: unknown) {
              call.where = where;
              return {
                orderBy(orderBy: unknown) {
                  call.orderBy = orderBy;
                  return {
                    async limit(limit: number) {
                      call.limit = limit;
                      return rows;
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

const fakeCareEntriesTable = {
  householdId: "careEntries.householdId",
  updatedAt: "careEntries.updatedAt",
  occurredAt: "careEntries.occurredAt",
  id: "careEntries.id",
};

const fakeCareEntryTombstonesTable = {
  householdId: "careEntryTombstones.householdId",
  updatedAt: "careEntryTombstones.updatedAt",
};

const fakeQueryOps = {
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  desc: (column: unknown) => ({ op: "desc", column }),
  eq: (left: unknown, right: unknown) => ({ op: "eq", left, right }),
  gte: (left: unknown, right: unknown) => ({ op: "gte", left, right }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: "sql",
    strings: [...strings],
    values,
  }),
};

async function withApi(
  db: FakeDb,
  fn: (baseUrl: string, calls: { auth: string[]; households: string[] }) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  const calls = { auth: [] as string[], households: [] as string[] };

  app.use(
    createCareEntriesRouter({
      db,
      careEntriesTable: fakeCareEntriesTable,
      careEntryTombstonesTable: fakeCareEntryTombstonesTable,
      queryOps: fakeQueryOps,
      requireAuth(req: Request, _res: Response, next: NextFunction) {
        calls.auth.push(req.path);
        (req as Request & { userId?: string }).userId = "user_route";
        next();
      },
      getUserId(req: Request) {
        return (req as Request & { userId?: string }).userId ?? "missing-user";
      },
      async getActiveHouseholdId(userId: string) {
        calls.households.push(userId);
        return "11111111-1111-4111-8111-111111111111";
      },
      async getCaregiverName() {
        return "Apollo";
      },
      async getHouseholdMemberAuthz() {
        return { role: "adult" };
      },
      now() {
        return new Date("2026-07-03T12:30:00.000Z");
      },
    }),
  );

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${port}`, calls);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

const careEntryRow = {
  id: "22222222-2222-4222-8222-222222222222",
  householdId: "11111111-1111-4111-8111-111111111111",
  petId: "phoenix",
  type: "meal",
  occurredAt: new Date("2026-07-03T07:30:00.000Z"),
  caregiverUserId: "user_route",
  caregiverName: "Apollo",
  mood: null,
  severity: null,
  note: "Breakfast updated after review.",
  details: {},
  createdAt: new Date("2026-07-03T07:30:00.000Z"),
  updatedAt: new Date("2026-07-03T12:15:00.000Z"),
};

const tombstoneRow = {
  id: "33333333-3333-4333-8333-333333333333",
  householdId: "11111111-1111-4111-8111-111111111111",
  entryId: "22222222-2222-4222-8222-222222222222",
  petId: "phoenix",
  deletedByUserId: "user_route",
  deletedAt: new Date("2026-07-03T12:30:00.000Z"),
  createdAt: new Date("2026-07-03T12:30:00.000Z"),
  updatedAt: new Date("2026-07-03T12:30:00.000Z"),
};

test("care-entry route lists server cursor rows through the real Express handler", async () => {
  const db = createSelectOnlyDb([careEntryRow]);

  await withApi(db, async (baseUrl, calls) => {
    const response = await fetch(`${baseUrl}/care-entries?updatedSince=2026-07-03T12:00:00.000Z&limit=900`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body[0].id, careEntryRow.id);
    assert.equal(body[0].updatedAt, "2026-07-03T12:15:00.000Z");
    assert.deepEqual(calls.auth, ["/care-entries"]);
    assert.deepEqual(calls.households, ["user_route"]);
    assert.equal(db.selectCalls.length, 1);
    assert.equal(db.selectCalls[0]?.limit, 500);
    assert.ok(db.selectCalls[0]?.where, "route should apply active-household and cursor filters");
    assert.ok(db.selectCalls[0]?.orderBy, "route should order cursor reads by updatedAt");
  });
});

test("care-entry route rejects ambiguous occurrence and update cursors before querying", async () => {
  const db = createSelectOnlyDb([careEntryRow]);

  await withApi(db, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/care-entries?since=2026-07-03T07:00:00.000Z&updatedSince=2026-07-03T12:00:00.000Z`,
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      error: "Use either since or updatedSince for care-entry sync, not both.",
    });
    assert.equal(db.selectCalls.length, 0);
  });
});

test("care-entry tombstone route lists delete cursor rows through the real Express handler", async () => {
  const db = createSelectOnlyDb([tombstoneRow]);

  await withApi(db, async (baseUrl, calls) => {
    const response = await fetch(`${baseUrl}/care-entries/tombstones?updatedSince=2026-07-03T12:00:00.000Z&limit=2`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body[0].entryId, tombstoneRow.entryId);
    assert.equal(body[0].updatedAt, "2026-07-03T12:30:00.000Z");
    assert.deepEqual(calls.auth, ["/care-entries/tombstones"]);
    assert.deepEqual(calls.households, ["user_route"]);
    assert.equal(db.selectCalls.length, 1);
    assert.equal(db.selectCalls[0]?.limit, 2);
    assert.ok(db.selectCalls[0]?.where, "tombstone route should apply active-household and cursor filters");
    assert.ok(db.selectCalls[0]?.orderBy, "tombstone route should order cursor reads by updatedAt");
  });
});

test("care-entry tombstone route rejects invalid update cursors before querying", async () => {
  const db = createSelectOnlyDb([tombstoneRow]);

  await withApi(db, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/care-entries/tombstones?updatedSince=not-a-date`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      error: "Invalid updatedSince query. Use an ISO date-time string.",
    });
    assert.equal(db.selectCalls.length, 0);
  });
});

/**
 * Fake db for the idempotent-create path: select().from().where().limit()
 * results are served from a queue, and inserts append rows (or throw a
 * queued error) so the dedupe + unique-violation flows can be driven
 * through the real Express handler.
 */
function createIdempotentCreateDb() {
  const insertedRows: Array<Record<string, unknown>> = [];
  const selectQueue: unknown[][] = [];
  const db = {
    insertedRows,
    selectQueue,
    failNextInsertWith: null as unknown,
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit() {
                  return selectQueue.shift() ?? [];
                },
                orderBy() {
                  return {
                    async limit() {
                      return selectQueue.shift() ?? [];
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        values(values: Record<string, unknown>) {
          return {
            async returning() {
              if (db.failNextInsertWith) {
                const err = db.failNextInsertWith;
                db.failNextInsertWith = null;
                throw err;
              }
              const row = {
                ...careEntryRow,
                id: `44444444-4444-4444-8444-44444444444${insertedRows.length + 1}`,
                details: (values.details as Record<string, unknown>) ?? {},
              };
              insertedRows.push(row);
              return [row];
            },
          };
        },
      };
    },
  };
  return db;
}

test("care-entry create is idempotent: a retry with the same clientKey returns the existing row", async () => {
  const db = createIdempotentCreateDb();
  // First create: no existing row -> insert. Second create (retry after a
  // lost response): the dedupe lookup finds the first row -> 200, no insert.
  db.selectQueue.push([]);
  await withApi(db as unknown as FakeDb, async (baseUrl) => {
    const first = await fetch(`${baseUrl}/care-entries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "meal", details: { clientKey: "temp_retry_1" } }),
    });
    assert.equal(first.status, 201);
    const firstBody = (await first.json()) as { id: string };
    assert.equal(db.insertedRows.length, 1);
    assert.equal(
      (db.insertedRows[0].details as Record<string, unknown>).clientKey,
      "temp_retry_1",
    );

    db.selectQueue.push([db.insertedRows[0]]);
    const retry = await fetch(`${baseUrl}/care-entries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "meal", details: { clientKey: "temp_retry_1" } }),
    });
    assert.equal(retry.status, 200);
    const retryBody = (await retry.json()) as { id: string };
    assert.equal(retryBody.id, firstBody.id);
    assert.equal(db.insertedRows.length, 1);
  });
});

test("care-entry create returns the winning row when the unique index rejects a concurrent duplicate", async () => {
  const db = createIdempotentCreateDb();
  const winner = { ...careEntryRow, details: { clientKey: "temp_race_1" } };
  // Dedupe lookup misses (the race), the insert hits the partial unique
  // index (23505), and the recovery lookup returns the winner.
  db.selectQueue.push([]);
  db.failNextInsertWith = Object.assign(new Error("duplicate key"), { code: "23505" });
  await withApi(db as unknown as FakeDb, async (baseUrl) => {
    db.selectQueue.push([winner]);
    const res = await fetch(`${baseUrl}/care-entries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "meal", details: { clientKey: "temp_race_1" } }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { id: string };
    assert.equal(body.id, careEntryRow.id);
    assert.equal(db.insertedRows.length, 0);
  });
});

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
};

async function withApi(
  db: FakeDb,
  fn: (baseUrl: string, calls: { auth: string[]; households: string[] }) => Promise<void>,
): Promise<void> {
  const app = express();
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

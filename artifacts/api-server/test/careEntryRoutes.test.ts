import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { test } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
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
  caregiverUserId: "careEntries.caregiverUserId",
  householdVisible: "careEntries.householdVisible",
  details: "careEntries.details",
  revision: "careEntries.revision",
};

const fakeCareEntryTombstonesTable = {
  householdId: "careEntryTombstones.householdId",
  updatedAt: "careEntryTombstones.updatedAt",
  caregiverUserId: "careEntryTombstones.caregiverUserId",
  householdVisible: "careEntryTombstones.householdVisible",
};

const fakeHouseholdsTable = {
  id: "households.id",
  careHistoryGeneration: "households.careHistoryGeneration",
};

const fakeQueryOps = {
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  desc: (column: unknown) => ({ op: "desc", column }),
  eq: (left: unknown, right: unknown) => ({ op: "eq", left, right }),
  gte: (left: unknown, right: unknown) => ({ op: "gte", left, right }),
  lt: (left: unknown, right: unknown) => ({ op: "lt", left, right }),
  or: (...conditions: unknown[]) => ({ op: "or", conditions }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: "sql",
    strings: [...strings],
    values,
  }),
};

async function withApi(
  db: FakeDb | Record<string, unknown>,
  fn: (baseUrl: string, calls: { auth: string[]; households: string[] }) => Promise<void>,
  options: {
    readActiveHouseholdId?: () => string;
  } = {},
): Promise<void> {
  const app = express();
  app.use(express.json());
  const calls = { auth: [] as string[], households: [] as string[] };

  app.use(
    createCareEntriesRouter({
      db,
      careEntriesTable: fakeCareEntriesTable,
      careEntryTombstonesTable: fakeCareEntryTombstonesTable,
      householdsTable: fakeHouseholdsTable,
      queryOps: fakeQueryOps,
      requireAuth(req: Request, _res: Response, next: NextFunction) {
        calls.auth.push(req.path);
        (req as Request & { userId?: string }).userId =
          req.header("x-test-user") ?? "user_route";
        next();
      },
      getUserId(req: Request) {
        return (req as Request & { userId?: string }).userId ?? "missing-user";
      },
      async getActiveHouseholdId(userId: string) {
        calls.households.push(userId);
        return (
          options.readActiveHouseholdId?.() ??
          "11111111-1111-4111-8111-111111111111"
        );
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
  householdVisible: true,
  caregiverName: "Apollo",
  mood: null,
  severity: null,
  note: "Breakfast updated after review.",
  details: {},
  revision: 1,
  createdAt: new Date("2026-07-03T07:30:00.000Z"),
  updatedAt: new Date("2026-07-03T12:15:00.000Z"),
};

const tombstoneRow = {
  id: "33333333-3333-4333-8333-333333333333",
  householdId: "11111111-1111-4111-8111-111111111111",
  entryId: "22222222-2222-4222-8222-222222222222",
  petId: "phoenix",
  caregiverUserId: "user_route",
  householdVisible: true,
  deletedByUserId: "user_route",
  deletedAt: new Date("2026-07-03T12:30:00.000Z"),
  createdAt: new Date("2026-07-03T12:30:00.000Z"),
  updatedAt: new Date("2026-07-03T12:30:00.000Z"),
};

type QueryExpression = {
  op: "and" | "desc" | "eq" | "gte" | "or" | "sql";
  conditions?: QueryExpression[];
  column?: unknown;
  left?: unknown;
  right?: unknown;
};

function resolveQueryOperand(row: Record<string, unknown>, operand: unknown): unknown {
  if (
    typeof operand === "string" &&
    (operand.startsWith("careEntries.") ||
      operand.startsWith("careEntryTombstones."))
  ) {
    return row[operand.slice(operand.indexOf(".") + 1)];
  }
  return operand;
}

function matchesQuery(
  row: Record<string, unknown>,
  expression: QueryExpression,
): boolean {
  if (expression.op === "and") {
    return (expression.conditions ?? []).every((condition) =>
      matchesQuery(row, condition),
    );
  }
  if (expression.op === "or") {
    return (expression.conditions ?? []).some((condition) =>
      matchesQuery(row, condition),
    );
  }
  if (expression.op === "eq") {
    return (
      resolveQueryOperand(row, expression.left) ===
      resolveQueryOperand(row, expression.right)
    );
  }
  if (expression.op === "gte") {
    const left = resolveQueryOperand(row, expression.left);
    const right = resolveQueryOperand(row, expression.right);
    return new Date(left as string | number | Date).getTime() >=
      new Date(right as string | number | Date).getTime();
  }
  throw new Error(`Unsupported fake query expression: ${expression.op}`);
}

function createPrivateCareDb(
  initialEntries: Array<Record<string, unknown>>,
  initialTombstones: Array<Record<string, unknown>> = [],
  options: {
    beforeFirstUpdate?: (rows: Array<Record<string, unknown>>) => void;
  } = {},
) {
  const entries = initialEntries.map((entry) => ({ ...entry }));
  const tombstones = initialTombstones.map((tombstone) => ({ ...tombstone }));
  let beforeFirstUpdate = options.beforeFirstUpdate;
  let nextId = 1;

  const rowsFor = (table: unknown) =>
    table === fakeCareEntriesTable ? entries : tombstones;
  const queryRows = (
    table: unknown,
    expression: QueryExpression,
    orderBy?: QueryExpression,
    limit = Number.POSITIVE_INFINITY,
  ) => {
    const rows = rowsFor(table).filter((row) => matchesQuery(row, expression));
    if (orderBy?.op === "desc") {
      rows.sort((left, right) => {
        const leftValue = resolveQueryOperand(left, orderBy.column);
        const rightValue = resolveQueryOperand(right, orderBy.column);
        return (
          new Date(rightValue as string | number | Date).getTime() -
          new Date(leftValue as string | number | Date).getTime()
        );
      });
    }
    return rows.slice(0, limit);
  };

  const mutationApi = {
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          const row = {
            ...(table === fakeCareEntriesTable
              ? careEntryRow
              : tombstoneRow),
            id:
              table === fakeCareEntriesTable
                ? `44444444-4444-4444-8444-44444444444${nextId++}`
                : `55555555-5555-4555-8555-55555555555${nextId++}`,
            createdAt: new Date("2026-07-03T12:30:00.000Z"),
            updatedAt: new Date("2026-07-03T12:30:00.000Z"),
            ...values,
          };
          rowsFor(table).push(row);
          return {
            async returning() {
              return [row];
            },
            then(
              resolve: (value: unknown) => unknown,
              reject: (reason: unknown) => unknown,
            ) {
              return Promise.resolve(undefined).then(resolve, reject);
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where(expression: QueryExpression) {
              return {
                async returning() {
                  const beforeUpdate = beforeFirstUpdate;
                  beforeFirstUpdate = undefined;
                  beforeUpdate?.(rowsFor(table));
                  const matched = rowsFor(table).filter((row) =>
                    matchesQuery(row, expression),
                  );
                  matched.forEach((row) => {
                    const revisionValue = values.revision as QueryExpression | undefined;
                    Object.assign(row, {
                      ...values,
                      ...(revisionValue?.op === "sql"
                        ? { revision: Number(row.revision ?? 1) + 1 }
                        : {}),
                    });
                  });
                  return matched;
                },
              };
            },
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where(expression: QueryExpression) {
          return {
            async returning() {
              const rows = rowsFor(table);
              const index = rows.findIndex((row) =>
                matchesQuery(row, expression),
              );
              if (index === -1) return [];
              return rows.splice(index, 1);
            },
          };
        },
      };
    },
  };

  return {
    entries,
    tombstones,
    select() {
      return {
        from(table: unknown) {
          return {
            where(expression: QueryExpression) {
              return {
                async limit(limit: number) {
                  return queryRows(table, expression, undefined, limit);
                },
                orderBy(orderBy: QueryExpression) {
                  return {
                    async limit(limit: number) {
                      return queryRows(table, expression, orderBy, limit);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    ...mutationApi,
    async transaction(
      callback: (tx: typeof mutationApi) => Promise<void>,
    ) {
      await callback(mutationApi);
    },
  };
}

const sharedEntry = {
  ...careEntryRow,
  id: "66666666-6666-4666-8666-666666666666",
  caregiverUserId: "user_a",
  caregiverName: "A",
  householdVisible: true,
  note: "Shared household note.",
  details: { householdVisible: true },
};

const privateEntry = {
  ...careEntryRow,
  id: "77777777-7777-4777-8777-777777777777",
  caregiverUserId: "user_a",
  caregiverName: "A",
  householdVisible: false,
  note: "A private note.",
  details: { householdVisible: false },
};

const sharedTombstone = {
  ...tombstoneRow,
  id: "88888888-8888-4888-8888-888888888888",
  entryId: sharedEntry.id,
  caregiverUserId: "user_a",
  householdVisible: true,
};

const privateTombstone = {
  ...tombstoneRow,
  id: "99999999-9999-4999-8999-999999999999",
  entryId: privateEntry.id,
  caregiverUserId: "user_a",
  householdVisible: false,
};

const asUser = (userId: string) => ({ "x-test-user": userId });

test("care-entry full and cursor reads expose private rows only to their author", async () => {
  const db = createPrivateCareDb([sharedEntry, privateEntry]);

  await withApi(db, async (baseUrl) => {
    const authorResponse = await fetch(`${baseUrl}/care-entries`, {
      headers: asUser("user_a"),
    });
    const authorRows = (await authorResponse.json()) as Array<{ id: string }>;
    assert.equal(authorResponse.status, 200);
    assert.deepEqual(
      authorRows.map((row) => row.id).sort(),
      [privateEntry.id, sharedEntry.id].sort(),
    );

    for (const query of [
      "",
      "?since=2026-07-03T07:00:00.000Z",
      "?updatedSince=2026-07-03T12:00:00.000Z",
    ]) {
      const householdResponse = await fetch(
        `${baseUrl}/care-entries${query}`,
        { headers: asUser("user_b") },
      );
      const householdRows = (await householdResponse.json()) as Array<{
        id: string;
      }>;
      assert.equal(householdResponse.status, 200);
      assert.deepEqual(
        householdRows.map((row) => row.id),
        [sharedEntry.id],
        `user_b should not receive user_a's private row for ${query || "full read"}`,
      );
    }
  });
});

test("care-entry tombstone reads expose private deletes only to their author", async () => {
  const db = createPrivateCareDb([], [sharedTombstone, privateTombstone]);

  await withApi(db, async (baseUrl) => {
    const authorResponse = await fetch(
      `${baseUrl}/care-entries/tombstones?updatedSince=2026-07-03T12:00:00.000Z`,
      { headers: asUser("user_a") },
    );
    const authorRows = (await authorResponse.json()) as Array<{
      entryId: string;
    }>;
    assert.equal(authorResponse.status, 200);
    assert.deepEqual(
      authorRows.map((row) => row.entryId).sort(),
      [privateEntry.id, sharedEntry.id].sort(),
    );
    for (const row of authorRows) {
      assert.equal("householdVisible" in row, false);
      assert.equal("caregiverUserId" in row, false);
    }

    const householdResponse = await fetch(
      `${baseUrl}/care-entries/tombstones?updatedSince=2026-07-03T12:00:00.000Z`,
      { headers: asUser("user_b") },
    );
    const householdRows = (await householdResponse.json()) as Array<{
      entryId: string;
    }>;
    assert.equal(householdResponse.status, 200);
    assert.deepEqual(
      householdRows.map((row) => row.entryId),
      [sharedEntry.id],
    );
  });
});

test("care-entry create and update persist visibility from details", async () => {
  const db = createPrivateCareDb([sharedEntry]);

  await withApi(db, async (baseUrl) => {
    const createResponse = await fetch(
      `${baseUrl}/care-entries?householdId=${sharedEntry.householdId}`,
      {
      method: "POST",
      headers: {
        ...asUser("user_a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "note",
        note: "Private from create.",
        details: { householdVisible: false },
      }),
      },
    );
    assert.equal(createResponse.status, 201);
    const created = db.entries.find(
      (entry) => entry.note === "Private from create.",
    );
    assert.equal(created?.caregiverUserId, "user_a");
    assert.equal(created?.householdVisible, false);

    const updateResponse = await fetch(
      `${baseUrl}/care-entries/${sharedEntry.id}?householdId=${sharedEntry.householdId}`,
      {
        method: "PATCH",
        headers: {
          ...asUser("user_a"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expectedRevision: 1,
          note: "Author made this private.",
          details: { householdVisible: false },
        }),
      },
    );
    assert.equal(updateResponse.status, 200);
    assert.equal(
      db.entries.find((entry) => entry.id === sharedEntry.id)
        ?.householdVisible,
      false,
    );
  });
});

test("care-entry create, update, and delete reject a captured household after the active household switches", async () => {
  const h1 = "11111111-1111-4111-8111-111111111111";
  const h2 = "22222222-2222-4222-8222-222222222222";
  const db = createPrivateCareDb([sharedEntry]);
  let activeHouseholdId = h2;

  await withApi(
    db,
    async (baseUrl) => {
      const create = await fetch(
        `${baseUrl}/care-entries?householdId=${h1}`,
        {
          method: "POST",
          headers: {
            ...asUser("user_a"),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            type: "note",
            note: "Must never land in H2.",
          }),
        },
      );
      assert.equal(create.status, 412);

      const update = await fetch(
        `${baseUrl}/care-entries/${sharedEntry.id}?householdId=${h1}`,
        {
          method: "PATCH",
          headers: {
            ...asUser("user_a"),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            expectedRevision: 1,
            note: "Must never update H2.",
          }),
        },
      );
      assert.equal(update.status, 412);

      const deletion = await fetch(
        `${baseUrl}/care-entries/${sharedEntry.id}?householdId=${h1}`,
        {
          method: "DELETE",
          headers: asUser("user_a"),
        },
      );
      assert.equal(deletion.status, 412);
      assert.equal(db.entries.length, 1);
      assert.equal(db.entries[0]?.note, sharedEntry.note);
      assert.equal(db.tombstones.length, 0);

      activeHouseholdId = h1;
      const missingScope = await fetch(
        `${baseUrl}/care-entries/${sharedEntry.id}`,
        {
          method: "DELETE",
          headers: asUser("user_a"),
        },
      );
      assert.equal(missingScope.status, 400);
      assert.equal(db.entries.length, 1);
    },
    { readActiveHouseholdId: () => activeHouseholdId },
  );
});

test("a household member cannot update another author's private entry", async () => {
  const db = createPrivateCareDb([privateEntry]);

  await withApi(db, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/care-entries/${privateEntry.id}?householdId=${privateEntry.householdId}`,
      {
        method: "PATCH",
        headers: {
          ...asUser("user_b"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expectedRevision: 1,
          note: "B should not write this.",
        }),
      },
    );

    assert.equal(response.status, 404);
    assert.equal(db.entries[0]?.note, privateEntry.note);
  });
});

test("a household member cannot delete another author's private entry", async () => {
  const db = createPrivateCareDb([privateEntry]);

  await withApi(db, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/care-entries/${privateEntry.id}?householdId=${privateEntry.householdId}`,
      {
        method: "DELETE",
        headers: asUser("user_b"),
      },
    );

    assert.equal(response.status, 404);
    assert.equal(db.entries.length, 1);
    assert.equal(db.tombstones.length, 0);
  });
});

test("private authors can mutate their row and tombstones retain creator visibility", async () => {
  const db = createPrivateCareDb([privateEntry]);

  await withApi(db, async (baseUrl) => {
    const updateResponse = await fetch(
      `${baseUrl}/care-entries/${privateEntry.id}?householdId=${privateEntry.householdId}`,
      {
        method: "PATCH",
        headers: {
          ...asUser("user_a"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expectedRevision: 1,
          note: "Author-only edit.",
          details: { householdVisible: false },
        }),
      },
    );
    assert.equal(updateResponse.status, 200);

    const deleteResponse = await fetch(
      `${baseUrl}/care-entries/${privateEntry.id}?householdId=${privateEntry.householdId}`,
      {
        method: "DELETE",
        headers: asUser("user_a"),
      },
    );
    assert.equal(deleteResponse.status, 204);
    assert.equal(db.tombstones[0]?.caregiverUserId, "user_a");
    assert.equal(db.tombstones[0]?.householdVisible, false);
  });
});

test("shared entries retain the existing adult update and delete policy", async () => {
  const db = createPrivateCareDb([sharedEntry]);

  await withApi(db, async (baseUrl) => {
    const sharedUpdate = await fetch(
      `${baseUrl}/care-entries/${sharedEntry.id}?householdId=${sharedEntry.householdId}`,
      {
        method: "PATCH",
        headers: {
          ...asUser("user_b"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expectedRevision: 1,
          note: "Shared policy still permits an adult household update.",
          details: { householdVisible: true },
        }),
      },
    );
    assert.equal(sharedUpdate.status, 200);

    const sharedDelete = await fetch(
      `${baseUrl}/care-entries/${sharedEntry.id}?householdId=${sharedEntry.householdId}`,
      {
        method: "DELETE",
        headers: asUser("user_b"),
      },
    );
    assert.equal(sharedDelete.status, 204);
    assert.equal(db.entries.length, 0);
    assert.equal(db.tombstones[0]?.householdVisible, true);
  });
});

test("a stale PATCH cannot re-expose an entry made private after its initial read", async () => {
  const db = createPrivateCareDb([sharedEntry], [], {
    beforeFirstUpdate(rows) {
      const current = rows.find((row) => row.id === sharedEntry.id);
      assert.ok(current);
      Object.assign(current, {
        householdVisible: false,
        details: { householdVisible: false },
        note: "Concurrent private edit.",
        revision: 2,
      });
    },
  });

  await withApi(db, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/care-entries/${sharedEntry.id}?householdId=${sharedEntry.householdId}`,
      {
        method: "PATCH",
        headers: {
          ...asUser("user_a"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expectedRevision: 1,
          note: "Stale shared edit.",
          details: { householdVisible: true },
        }),
      },
    );
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.id, sharedEntry.id);
    assert.equal(body.revision, 2);
    assert.equal(body.note, "Concurrent private edit.");
    assert.equal(db.entries[0]?.householdVisible, false);
    assert.deepEqual(db.entries[0]?.details, { householdVisible: false });
    assert.equal(db.entries[0]?.note, "Concurrent private edit.");
  });
});

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
    const first = await fetch(
      `${baseUrl}/care-entries?householdId=${careEntryRow.householdId}`,
      {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "meal", details: { clientKey: "temp_retry_1" } }),
      },
    );
    assert.equal(first.status, 201);
    const firstBody = (await first.json()) as { id: string };
    assert.equal(db.insertedRows.length, 1);
    assert.equal(
      (db.insertedRows[0].details as Record<string, unknown>).clientKey,
      "temp_retry_1",
    );

    db.selectQueue.push([db.insertedRows[0]]);
    const retry = await fetch(
      `${baseUrl}/care-entries?householdId=${careEntryRow.householdId}`,
      {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "meal", details: { clientKey: "temp_retry_1" } }),
      },
    );
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
    const res = await fetch(
      `${baseUrl}/care-entries?householdId=${careEntryRow.householdId}`,
      {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "meal", details: { clientKey: "temp_race_1" } }),
      },
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { id: string };
    assert.equal(body.id, careEntryRow.id);
    assert.equal(db.insertedRows.length, 0);
  });
});

const revisionCareEntriesTable = pgTable("care_entries", {
  id: uuid("id").primaryKey(),
  householdId: uuid("household_id").notNull(),
  petId: text("pet_id"),
  type: text("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  caregiverUserId: text("caregiver_user_id"),
  householdVisible: boolean("household_visible").notNull().default(true),
  caregiverName: text("caregiver_name"),
  mood: text("mood"),
  severity: text("severity"),
  note: text("note"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

const revisionCareEntryTombstonesTable = pgTable("care_entry_tombstones", {
  id: uuid("id").primaryKey(),
  householdId: uuid("household_id").notNull(),
  entryId: uuid("entry_id").notNull(),
  caregiverUserId: text("caregiver_user_id"),
  householdVisible: boolean("household_visible").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

const revisionHouseholdId = "11111111-1111-4111-8111-111111111111";
const revisionEntryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const privateRevisionEntryId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function createRevisionCareEntryDatabase() {
  const client = new PGlite();
  await client.exec(`
    create table care_entries (
      id uuid primary key,
      household_id uuid not null,
      pet_id text,
      type text not null,
      occurred_at timestamptz not null,
      caregiver_user_id text,
      household_visible boolean not null default true,
      caregiver_name text,
      mood text,
      severity text,
      note text,
      details jsonb,
      created_at timestamptz not null,
      updated_at timestamptz not null
    );
    insert into care_entries (
      id,
      household_id,
      pet_id,
      type,
      occurred_at,
      caregiver_user_id,
      household_visible,
      caregiver_name,
      note,
      details,
      created_at,
      updated_at
    ) values
      (
        '${revisionEntryId}',
        '${revisionHouseholdId}',
        'phoenix',
        'meal',
        '2026-07-03T07:30:00.000Z',
        'user_route',
        true,
        'Apollo',
        'Base note',
        '{"householdVisible":true}'::jsonb,
        '2026-07-03T07:30:00.000Z',
        '2026-07-03T07:30:00.000Z'
      ),
      (
        '${privateRevisionEntryId}',
        '${revisionHouseholdId}',
        'phoenix',
        'note',
        '2026-07-03T08:30:00.000Z',
        'different_author',
        false,
        'Different author',
        'Private note',
        '{"householdVisible":false}'::jsonb,
        '2026-07-03T08:30:00.000Z',
        '2026-07-03T08:30:00.000Z'
      );
  `);
  await client.exec(
    readFileSync(
      join(process.cwd(), "supabase/migrations/0006_care_entry_revision.sql"),
      "utf8",
    ),
  );
  return { client, db: drizzle(client) };
}

async function withRevisionCareEntryApi(
  db: ReturnType<typeof drizzle>,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(
    createCareEntriesRouter({
      db,
      careEntriesTable: revisionCareEntriesTable,
      careEntryTombstonesTable: revisionCareEntryTombstonesTable,
      householdsTable: historyHouseholdsTable,
      queryOps: { and, desc, eq, gte, lt, or, sql },
      requireAuth(req: Request, _res: Response, next: NextFunction) {
        (req as Request & { userId?: string }).userId = req.header("x-test-user") ?? "user_route";
        next();
      },
      getUserId(req: Request) {
        return (req as Request & { userId?: string }).userId ?? "missing-user";
      },
      async getActiveHouseholdId() {
        return revisionHouseholdId;
      },
      async getCaregiverName() {
        return "Apollo";
      },
      async getHouseholdMemberAuthz() {
        return { role: "adult" };
      },
      now() {
        return new Date("2026-07-23T12:30:00.000Z");
      },
    }),
  );

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test("concurrent revision-1 care-entry patches have one revision-2 winner and one current-row conflict", async (t) => {
  const { client, db } = await createRevisionCareEntryDatabase();
  t.after(() => client.close());

  await withRevisionCareEntryApi(db, async (baseUrl) => {
    const responses = await Promise.all(
      ["Writer A", "Writer B"].map((note) =>
        fetch(
          `${baseUrl}/care-entries/${revisionEntryId}?householdId=${revisionHouseholdId}`,
          {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedRevision: 1, note }),
          },
        ),
      ),
    );
    const payloads = await Promise.all(
      responses.map(async (response) => ({
        status: response.status,
        body: (await response.json()) as { id: string; note: string | null; revision: number },
      })),
    );
    const winner = payloads.find(({ status }) => status === 200);
    const conflict = payloads.find(({ status }) => status === 409);
    const persisted = await client.query<{ note: string | null; revision: number }>(
      "select note, revision from care_entries where id = $1",
      [revisionEntryId],
    );

    assert.deepEqual(
      payloads.map(({ status }) => status).sort((a, b) => a - b),
      [200, 409],
    );
    assert.equal(winner?.body.revision, 2);
    assert.equal(conflict?.body.revision, 2);
    assert.equal(conflict?.body.id, revisionEntryId);
    assert.equal(conflict?.body.note, winner?.body.note);
    assert.equal(persisted.rows[0]?.revision, 2);
    assert.equal(persisted.rows[0]?.note, winner?.body.note);
  });
});

test("the real care-entry revision migration serializes legacy and CAS writers", async (t) => {
  const { client } = await createRevisionCareEntryDatabase();
  t.after(() => client.close());

  const initial = await client.query<{ revision: number }>(
    "select revision from care_entries where id = $1",
    [revisionEntryId],
  );
  assert.equal(initial.rows[0]?.revision, 1);

  await client.query(
    "update care_entries set note = 'Legacy writer' where id = $1",
    [revisionEntryId],
  );
  const legacy = await client.query<{ note: string; revision: number }>(
    "select note, revision from care_entries where id = $1",
    [revisionEntryId],
  );
  assert.deepEqual(legacy.rows[0], { note: "Legacy writer", revision: 2 });

  await client.query(
    "update care_entries set note = 'CAS writer', revision = revision + 1 where id = $1",
    [revisionEntryId],
  );
  const cas = await client.query<{ note: string; revision: number }>(
    "select note, revision from care_entries where id = $1",
    [revisionEntryId],
  );
  assert.deepEqual(cas.rows[0], { note: "CAS writer", revision: 3 });

  for (const invalidRevision of [1, 5]) {
    await assert.rejects(
      client.query(
        "update care_entries set revision = $1 where id = $2",
        [invalidRevision, revisionEntryId],
      ),
      /care-entry revision/i,
    );
  }

  const maximumRevisionEntryId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  await client.query(
    `insert into care_entries (
      id,
      household_id,
      type,
      occurred_at,
      household_visible,
      revision,
      created_at,
      updated_at
    ) values ($1, $2, 'note', now(), true, 2147483647, now(), now())`,
    [maximumRevisionEntryId, revisionHouseholdId],
  );
  await assert.rejects(
    client.query(
      "update care_entries set note = 'Must not overflow' where id = $1",
      [maximumRevisionEntryId],
    ),
    /care-entry revision overflow/i,
  );

  const persisted = await client.query<{ note: string; revision: number }>(
    "select note, revision from care_entries where id = $1",
    [revisionEntryId],
  );
  assert.deepEqual(persisted.rows[0], { note: "CAS writer", revision: 3 });
});

test("care-entry PATCH requires an integer expectedRevision of at least one", async (t) => {
  const { client, db } = await createRevisionCareEntryDatabase();
  t.after(() => client.close());

  await withRevisionCareEntryApi(db, async (baseUrl) => {
    for (const body of [
      { note: "Missing revision" },
      { expectedRevision: 0, note: "Zero revision" },
      { expectedRevision: 1.5, note: "Fractional revision" },
      { expectedRevision: "1", note: "String revision" },
      { expectedRevision: 2_147_483_647, note: "Overflowing revision" },
      { expectedRevision: 2_147_483_648, note: "Out-of-range revision" },
    ]) {
      const response = await fetch(
        `${baseUrl}/care-entries/${revisionEntryId}?householdId=${revisionHouseholdId}`,
        {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        },
      );
      assert.equal(response.status, 400, JSON.stringify(body));
    }

    const persisted = await client.query<{ note: string | null; revision: number }>(
      "select note, revision from care_entries where id = $1",
      [revisionEntryId],
    );
    assert.deepEqual(persisted.rows[0], { note: "Base note", revision: 1 });
  });
});

test("empty care-entry CAS returning distinguishes conflict from absent or invisible rows", async (t) => {
  const { client, db } = await createRevisionCareEntryDatabase();
  t.after(() => client.close());

  await withRevisionCareEntryApi(db, async (baseUrl) => {
    const first = await fetch(
      `${baseUrl}/care-entries/${revisionEntryId}?householdId=${revisionHouseholdId}`,
      {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision: 1, note: "Winner" }),
      },
    );
    assert.equal(first.status, 200);

    const conflict = await fetch(
      `${baseUrl}/care-entries/${revisionEntryId}?householdId=${revisionHouseholdId}`,
      {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision: 1, note: "Stale" }),
      },
    );
    const current = (await conflict.json()) as { id: string; note: string | null; revision: number };
    assert.equal(conflict.status, 409);
    assert.deepEqual(
      { id: current.id, note: current.note, revision: current.revision },
      { id: revisionEntryId, note: "Winner", revision: 2 },
    );

    for (const id of ["cccccccc-cccc-4ccc-8ccc-cccccccccccc", privateRevisionEntryId]) {
      const missing = await fetch(
        `${baseUrl}/care-entries/${id}?householdId=${revisionHouseholdId}`,
        {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: 1, note: "Missing" }),
        },
      );
      assert.equal(missing.status, 404, id);
    }
  });
});

const historyHouseholdsTable = pgTable("households", {
  id: uuid("id").primaryKey(),
  careHistoryGeneration: bigint("care_history_generation", {
    mode: "number",
  })
    .notNull()
    .default(0),
});

const historyHouseholdId = "11111111-1111-4111-8111-111111111111";
const secondHistoryHouseholdId = "22222222-2222-4222-8222-222222222222";
const historyOccurredAt = "2026-07-23T12:00:00.000Z";
const privateHistoryBoundaryId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function historyEntryId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

async function createHistoryCareEntryDatabase(input: {
  applyMigration?: boolean;
  seedVisibleCount?: number;
} = {}) {
  const client = new PGlite();
  await client.exec(`
    create table households (
      id uuid primary key,
      care_history_generation bigint not null default 0
    );
    create table care_entries (
      id uuid primary key,
      household_id uuid not null,
      pet_id text,
      type text not null,
      occurred_at timestamptz not null,
      caregiver_user_id text,
      household_visible boolean not null default true,
      caregiver_name text,
      mood text,
      severity text,
      note text,
      details jsonb,
      revision integer not null default 1,
      created_at timestamptz not null,
      updated_at timestamptz not null
    );
    create table care_entry_tombstones (
      id uuid primary key,
      household_id uuid not null,
      entry_id uuid not null,
      caregiver_user_id text,
      household_visible boolean not null default true,
      updated_at timestamptz not null
    );
    insert into households (id) values
      ('${historyHouseholdId}'),
      ('${secondHistoryHouseholdId}');
  `);

  const visibleCount = input.seedVisibleCount ?? 0;
  if (visibleCount > 0) {
    const visibleValues = Array.from({ length: visibleCount }, (_, offset) => {
      const id = historyEntryId(offset + 1);
      return `(
        '${id}',
        '${historyHouseholdId}',
        'note',
        '${historyOccurredAt}',
        'user_route',
        true,
        'Visible ${offset + 1}',
        '{}'::jsonb,
        1,
        '${historyOccurredAt}',
        '${historyOccurredAt}'
      )`;
    });
    visibleValues.push(`(
      '${privateHistoryBoundaryId}',
      '${historyHouseholdId}',
      'note',
      '${historyOccurredAt}',
      'different_author',
      false,
      'Invisible boundary row',
      '{"householdVisible":false}'::jsonb,
      1,
      '${historyOccurredAt}',
      '${historyOccurredAt}'
    )`);
    await client.exec(`
      insert into care_entries (
        id,
        household_id,
        type,
        occurred_at,
        caregiver_user_id,
        household_visible,
        note,
        details,
        revision,
        created_at,
        updated_at
      ) values ${visibleValues.join(",")};
    `);
  }

  if (input.applyMigration) {
    await client.exec(
      readFileSync(
        join(
          process.cwd(),
          "supabase/migrations/0008_care_entry_history_cursor.sql",
        ),
        "utf8",
      ),
    );
  }

  return { client, db: drizzle(client) };
}

async function withHistoryCareEntryApi(
  db: ReturnType<typeof drizzle>,
  fn: (baseUrl: string) => Promise<void>,
  options: {
    readActiveHouseholdId?: () => string;
  } = {},
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(
    createCareEntriesRouter({
      db,
      careEntriesTable: revisionCareEntriesTable,
      careEntryTombstonesTable: revisionCareEntryTombstonesTable,
      householdsTable: historyHouseholdsTable,
      queryOps: { and, desc, eq, gte, lt, or, sql },
      requireAuth(req: Request, _res: Response, next: NextFunction) {
        (req as Request & { userId?: string }).userId =
          req.header("x-test-user") ?? "user_route";
        next();
      },
      getUserId(req: Request) {
        return (req as Request & { userId?: string }).userId ?? "missing-user";
      },
      async getActiveHouseholdId() {
        return (
          options.readActiveHouseholdId?.() ??
          historyHouseholdId
        );
      },
      async getCaregiverName() {
        return "Apollo";
      },
      async getHouseholdMemberAuthz() {
        return { role: "adult" };
      },
      now() {
        return new Date("2026-07-23T12:30:00.000Z");
      },
    }),
  );

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test("history route traverses 251 equal-timestamp visible rows exactly once across a private high-id boundary", async (t) => {
  const { client, db } = await createHistoryCareEntryDatabase({
    seedVisibleCount: 251,
  });
  t.after(() => client.close());

  await withHistoryCareEntryApi(db, async (baseUrl) => {
    const received: string[] = [];
    let beforeOccurredAt: string | undefined;
    let beforeId: string | undefined;
    let expectedGeneration: number | undefined;

    for (;;) {
      const params = new URLSearchParams({
        householdId: historyHouseholdId,
        limit: "250",
      });
      if (beforeOccurredAt && beforeId && expectedGeneration !== undefined) {
        params.set("beforeOccurredAt", beforeOccurredAt);
        params.set("beforeId", beforeId);
        params.set("expectedGeneration", String(expectedGeneration));
      }
      const response = await fetch(
        `${baseUrl}/care-entries/history?${params.toString()}`,
      );
      assert.equal(response.status, 200);
      const page = (await response.json()) as {
        householdId: string;
        entries: Array<{ id: string; occurredAt: string }>;
        historyGeneration: number;
      };
      expectedGeneration ??= page.historyGeneration;
      assert.equal(page.historyGeneration, expectedGeneration);
      assert.equal(page.householdId, historyHouseholdId);
      received.push(...page.entries.map((entry) => entry.id));
      if (page.entries.length < 250) break;
      const last = page.entries.at(-1);
      assert.ok(last);
      beforeOccurredAt = last.occurredAt;
      beforeId = last.id;
    }

    const expected = Array.from(
      { length: 251 },
      (_, offset) => historyEntryId(251 - offset),
    );
    assert.deepEqual(received, expected);
    assert.equal(new Set(received).size, 251);
    assert.equal(received.includes(privateHistoryBoundaryId), false);
  });
});

test("history route advances from equal-time UUID ties into strictly older timestamps", async (t) => {
  const { client, db } = await createHistoryCareEntryDatabase({
    seedVisibleCount: 3,
  });
  t.after(() => client.close());
  await client.query(
    "update care_entries set occurred_at = $1 where id = $2",
    ["2026-07-22T12:00:00.000Z", historyEntryId(1)],
  );

  await withHistoryCareEntryApi(db, async (baseUrl) => {
    const first = await fetch(
      `${baseUrl}/care-entries/history?householdId=${historyHouseholdId}&limit=2`,
    );
    assert.equal(first.status, 200);
    const firstPage = (await first.json()) as {
      entries: Array<{ id: string; occurredAt: string }>;
      historyGeneration: number;
    };
    assert.deepEqual(
      firstPage.entries.map((entry) => entry.id),
      [historyEntryId(3), historyEntryId(2)],
    );
    const cursor = firstPage.entries.at(-1);
    assert.ok(cursor);

    const params = new URLSearchParams({
      householdId: historyHouseholdId,
      limit: "2",
      beforeOccurredAt: cursor.occurredAt,
      beforeId: cursor.id,
      expectedGeneration: String(firstPage.historyGeneration),
    });
    const second = await fetch(
      `${baseUrl}/care-entries/history?${params.toString()}`,
    );
    assert.equal(second.status, 200);
    const secondPage = (await second.json()) as {
      entries: Array<{ id: string; occurredAt: string }>;
    };
    assert.deepEqual(secondPage.entries.map(({ id, occurredAt }) => ({
      id,
      occurredAt,
    })), [
      {
        id: historyEntryId(1),
        occurredAt: "2026-07-22T12:00:00.000Z",
      },
    ]);
  });
});

test("history route preserves microsecond inputs across millisecond cursor boundaries", async (t) => {
  const { client, db } = await createHistoryCareEntryDatabase({
    applyMigration: true,
  });
  t.after(() => client.close());
  const inputs = [
    [historyEntryId(3), "2026-07-23T12:00:00.000600Z"],
    [historyEntryId(2), "2026-07-23T12:00:00.000500Z"],
    [historyEntryId(1), "2026-07-23T12:00:00.000400Z"],
  ] as const;
  for (const [id, occurredAt] of inputs) {
    await client.query(
      `insert into care_entries (
        id, household_id, type, occurred_at, caregiver_user_id,
        household_visible, note, details, revision, created_at, updated_at
      ) values ($1, $2, 'note', $3, 'user_route', true, 'Precision boundary',
        '{}'::jsonb, 1, $3, $3)`,
      [id, historyHouseholdId, occurredAt],
    );
  }

  await withHistoryCareEntryApi(db, async (baseUrl) => {
    const received: Array<{ id: string; occurredAt: string }> = [];
    let cursor:
      | {
          beforeOccurredAt: string;
          beforeId: string;
          expectedGeneration: number;
        }
      | undefined;

    for (;;) {
      const params = new URLSearchParams({
        householdId: historyHouseholdId,
        limit: "1",
      });
      if (cursor) {
        params.set("beforeOccurredAt", cursor.beforeOccurredAt);
        params.set("beforeId", cursor.beforeId);
        params.set(
          "expectedGeneration",
          String(cursor.expectedGeneration),
        );
      }
      const response = await fetch(
        `${baseUrl}/care-entries/history?${params.toString()}`,
      );
      assert.equal(response.status, 200);
      const page = (await response.json()) as {
        entries: Array<{ id: string; occurredAt: string }>;
        historyGeneration: number;
      };
      received.push(...page.entries);
      if (page.entries.length === 0) break;
      const last = page.entries[0];
      assert.ok(last);
      cursor = {
        beforeOccurredAt: last.occurredAt,
        beforeId: last.id,
        expectedGeneration: page.historyGeneration,
      };
    }

    assert.deepEqual(
      received.map((entry) => entry.id),
      [historyEntryId(3), historyEntryId(2), historyEntryId(1)],
    );
    assert.equal(new Set(received.map((entry) => entry.id)).size, 3);
    assert.ok(
      received.every(
        (entry) => /\.(?:\d{3})Z$/.test(entry.occurredAt),
      ),
      "every emitted cursor timestamp must have JavaScript-exact millisecond precision",
    );
  });
});

test("history cursor cannot cross an equal-generation active-household switch", async (t) => {
  const { client, db } = await createHistoryCareEntryDatabase({
    seedVisibleCount: 2,
  });
  t.after(() => client.close());
  await client.query(
    `insert into care_entries (
      id, household_id, type, occurred_at, caregiver_user_id,
      household_visible, note, details, revision, created_at, updated_at
    ) values ($1, $2, 'note', $3, 'user_route', true, 'H2 row',
      '{}'::jsonb, 1, $3, $3)`,
    [
      historyEntryId(50),
      secondHistoryHouseholdId,
      historyOccurredAt,
    ],
  );
  let activeHouseholdId = historyHouseholdId;

  await withHistoryCareEntryApi(
    db,
    async (baseUrl) => {
      const first = await fetch(
        `${baseUrl}/care-entries/history?householdId=${historyHouseholdId}&limit=1`,
      );
      assert.equal(first.status, 200);
      const firstPage = (await first.json()) as {
        householdId: string;
        historyGeneration: number;
        entries: Array<{ id: string; occurredAt: string }>;
      };
      assert.equal(firstPage.householdId, historyHouseholdId);
      const cursor = firstPage.entries[0];
      assert.ok(cursor);

      activeHouseholdId = secondHistoryHouseholdId;
      const params = new URLSearchParams({
        householdId: historyHouseholdId,
        limit: "1",
        beforeOccurredAt: cursor.occurredAt,
        beforeId: cursor.id,
        expectedGeneration: String(firstPage.historyGeneration),
      });
      const crossed = await fetch(
        `${baseUrl}/care-entries/history?${params.toString()}`,
      );
      assert.equal(crossed.status, 412);
      const conflict = (await crossed.json()) as {
        error: string;
      };
      assert.match(conflict.error, /household.*changed/i);
    },
    { readActiveHouseholdId: () => activeHouseholdId },
  );
});

test("a scope-bound cleanup never converts a wrong-household delete into confirmed absence", async (t) => {
  const { client, db } = await createHistoryCareEntryDatabase({
    seedVisibleCount: 1,
  });
  t.after(() => client.close());
  let activeHouseholdId = secondHistoryHouseholdId;

  await withHistoryCareEntryApi(
    db,
    async (baseUrl) => {
      const wrongScope = await fetch(
        `${baseUrl}/care-entries/${historyEntryId(1)}?householdId=${historyHouseholdId}`,
        { method: "DELETE" },
      );
      assert.equal(wrongScope.status, 412);
      const stillPresent = await client.query<{ count: number }>(
        "select count(*)::int as count from care_entries where id = $1",
        [historyEntryId(1)],
      );
      assert.equal(stillPresent.rows[0]?.count, 1);

      activeHouseholdId = historyHouseholdId;
      const confirmedAbsent = await fetch(
        `${baseUrl}/care-entries/${historyEntryId(99)}?householdId=${historyHouseholdId}`,
        { method: "DELETE" },
      );
      assert.equal(confirmedAbsent.status, 404);
      assert.deepEqual(await confirmedAbsent.json(), {
        error: "Entry not found",
        householdId: historyHouseholdId,
        scopeBound: true,
      });
    },
    { readActiveHouseholdId: () => activeHouseholdId },
  );
});

test("history route rejects remote churn and a clean restart sees the new generation", async (t) => {
  const { client, db } = await createHistoryCareEntryDatabase({
    applyMigration: true,
    seedVisibleCount: 251,
  });
  t.after(() => client.close());

  await withHistoryCareEntryApi(db, async (baseUrl) => {
    const first = await fetch(
      `${baseUrl}/care-entries/history?householdId=${historyHouseholdId}&limit=250`,
    );
    assert.equal(first.status, 200);
    const firstPage = (await first.json()) as {
      entries: Array<{ id: string; occurredAt: string }>;
      historyGeneration: number;
    };
    const last = firstPage.entries.at(-1);
    assert.ok(last);

    await client.query(
      `insert into care_entries (
        id, household_id, type, occurred_at, caregiver_user_id,
        household_visible, note, details, revision, created_at, updated_at
      ) values ($1, $2, 'note', $3, 'user_route', true, 'Remote churn',
        '{}'::jsonb, 1, $3, $3)`,
      [historyEntryId(252), historyHouseholdId, historyOccurredAt],
    );

    const staleParams = new URLSearchParams({
      householdId: historyHouseholdId,
      limit: "250",
      beforeOccurredAt: last.occurredAt,
      beforeId: last.id,
      expectedGeneration: String(firstPage.historyGeneration),
    });
    const stale = await fetch(
      `${baseUrl}/care-entries/history?${staleParams.toString()}`,
    );
    assert.equal(stale.status, 409);

    const restarted = await fetch(
      `${baseUrl}/care-entries/history?householdId=${historyHouseholdId}&limit=250`,
    );
    assert.equal(restarted.status, 200);
    const restartedPage = (await restarted.json()) as {
      entries: Array<{ id: string }>;
      historyGeneration: number;
    };
    assert.ok(
      restartedPage.historyGeneration > firstPage.historyGeneration,
    );
    assert.equal(restartedPage.entries[0]?.id, historyEntryId(252));
  });
});

test("history migration advances old-writer generations for insert, update, household move, and delete", async (t) => {
  const { client } = await createHistoryCareEntryDatabase({
    applyMigration: true,
  });
  t.after(() => client.close());

  const generations = async () => {
    const result = await client.query<{
      id: string;
      care_history_generation: number;
    }>(
      `select id, care_history_generation
       from households
       order by id`,
    );
    return result.rows.map((row) => [
      row.id,
      Number(row.care_history_generation),
    ]);
  };

  const movedId = historyEntryId(900);
  await client.query(
    `insert into care_entries (
      id, household_id, type, occurred_at, caregiver_user_id,
      household_visible, note, details, revision, created_at, updated_at
    ) values ($1, $2, 'note', $3, 'user_route', true, 'Legacy insert',
      '{}'::jsonb, 1, $3, $3)`,
    [movedId, historyHouseholdId, historyOccurredAt],
  );
  assert.deepEqual(await generations(), [
    [historyHouseholdId, 1],
    [secondHistoryHouseholdId, 0],
  ]);

  await client.query(
    "update care_entries set note = 'Legacy update' where id = $1",
    [movedId],
  );
  assert.deepEqual(await generations(), [
    [historyHouseholdId, 2],
    [secondHistoryHouseholdId, 0],
  ]);

  await client.query(
    "update care_entries set household_id = $1 where id = $2",
    [secondHistoryHouseholdId, movedId],
  );
  assert.deepEqual(await generations(), [
    [historyHouseholdId, 3],
    [secondHistoryHouseholdId, 1],
  ]);

  await client.query("delete from care_entries where id = $1", [movedId]);
  assert.deepEqual(await generations(), [
    [historyHouseholdId, 3],
    [secondHistoryHouseholdId, 2],
  ]);
});

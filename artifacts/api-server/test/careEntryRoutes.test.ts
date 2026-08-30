import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

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
  householdVisible: "careEntries.householdVisible",
  caregiverUserId: "careEntries.caregiverUserId",
  updatedAt: "careEntries.updatedAt",
  occurredAt: "careEntries.occurredAt",
  id: "careEntries.id",
};

const fakeCareEntryTombstonesTable = {
  householdId: "careEntryTombstones.householdId",
  householdVisible: "careEntryTombstones.householdVisible",
  caregiverUserId: "careEntryTombstones.caregiverUserId",
  updatedAt: "careEntryTombstones.updatedAt",
};

const ACTIVE_HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const EXPECTED_HOUSEHOLD_HEADER = "X-WoofWatcher-Expected-Household-Id";
const expectedHouseholdHeaders = {
  [EXPECTED_HOUSEHOLD_HEADER]: ACTIVE_HOUSEHOLD_ID,
};

const fakeQueryOps = {
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  desc: (column: unknown) => ({ op: "desc", column }),
  eq: (left: unknown, right: unknown) => ({ op: "eq", left, right }),
  gte: (left: unknown, right: unknown) => ({ op: "gte", left, right }),
  or: (...conditions: unknown[]) => ({ op: "or", conditions }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: "sql",
    strings: [...strings],
    values,
  }),
};

async function withApi(
  db: FakeDb,
  fn: (
    baseUrl: string,
    calls: {
      auth: string[];
      households: string[];
      scopedOperations: string[];
    },
  ) => Promise<void>,
  options: { authorizationRole?: string } = {},
): Promise<void> {
  const app = express();
  app.use(express.json());
  const calls = {
    auth: [] as string[],
    households: [] as string[],
    scopedOperations: [] as string[],
  };

  app.use(
    createCareEntriesRouter({
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
      async runHouseholdScopedOperation(input: {
        userId: string;
        expectedHouseholdId: string;
        operation: (scope: {
          database: unknown;
          userId: string;
          householdId: string;
          role: string;
          authorizationRole: string;
          caregiverName: string | null;
          now: Date;
        }) => Promise<unknown>;
      }) {
        calls.households.push(input.userId);
        if (input.expectedHouseholdId !== ACTIVE_HOUSEHOLD_ID) {
          throw Object.assign(
            new Error(
              "Active household changed. Refresh household identity before retrying.",
            ),
            { name: "HouseholdScopedOperationError", status: 412 },
          );
        }
        calls.scopedOperations.push(input.expectedHouseholdId);
        const authorizationRole = options.authorizationRole ?? "adult";
        return input.operation({
          database: db,
          userId: input.userId,
          householdId: input.expectedHouseholdId,
          role: authorizationRole,
          authorizationRole,
          caregiverName: "Apollo",
          now: new Date("2026-07-03T12:30:00.000Z"),
        });
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
  householdVisible: true,
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
  caregiverUserId: "user_route",
  householdVisible: true,
  deletedByUserId: "user_route",
  deletedAt: new Date("2026-07-03T12:30:00.000Z"),
  createdAt: new Date("2026-07-03T12:30:00.000Z"),
  updatedAt: new Date("2026-07-03T12:30:00.000Z"),
};

test("care-entry route lists server cursor rows through the real Express handler", async () => {
  const db = createSelectOnlyDb([careEntryRow]);

  await withApi(db, async (baseUrl, calls) => {
    const response = await fetch(
      `${baseUrl}/care-entries?updatedSince=2026-07-03T12:00:00.000Z&limit=900`,
      { headers: expectedHouseholdHeaders },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(
      response.headers.get("vary") ?? "",
      /X-WoofWatcher-Expected-Household-Id/i,
    );
    assert.equal(body[0].id, careEntryRow.id);
    assert.equal(body[0].householdId, ACTIVE_HOUSEHOLD_ID);
    assert.equal(body[0].updatedAt, "2026-07-03T12:15:00.000Z");
    assert.deepEqual(calls.auth, ["/care-entries"]);
    assert.deepEqual(calls.households, ["user_route"]);
    assert.deepEqual(calls.scopedOperations, [ACTIVE_HOUSEHOLD_ID]);
    assert.equal(db.selectCalls.length, 1);
    assert.equal(db.selectCalls[0]?.limit, 500);
    assert.ok(
      db.selectCalls[0]?.where,
      "route should apply active-household and cursor filters",
    );
    assert.ok(
      db.selectCalls[0]?.orderBy,
      "route should order cursor reads by updatedAt",
    );
  });
});

for (const capabilityCase of [
  {
    name: "missing",
    headers: {},
    status: 428,
    expectedAuthorityLookups: 0,
    error:
      "Expected household header is required. Refresh household identity and retry.",
  },
  {
    name: "blank",
    headers: { [EXPECTED_HOUSEHOLD_HEADER]: "   " },
    status: 428,
    expectedAuthorityLookups: 0,
    error:
      "Expected household header is required. Refresh household identity and retry.",
  },
  {
    name: "mismatched",
    headers: {
      [EXPECTED_HOUSEHOLD_HEADER]: "99999999-9999-4999-8999-999999999999",
    },
    status: 412,
    expectedAuthorityLookups: 6,
    error:
      "Active household changed. Refresh household identity before retrying.",
  },
] as const) {
  test(`every care-entry route rejects a ${capabilityCase.name} expected-household capability before Care access`, async () => {
    let careDbAccesses = 0;
    const db = new Proxy(
      {},
      {
        get() {
          careDbAccesses += 1;
          throw new Error("a rejected capability must not touch a Care table");
        },
      },
    );

    await withApi(db as unknown as FakeDb, async (baseUrl, calls) => {
      const requests: Array<{ path: string; init?: RequestInit }> = [
        { path: "/care-entries" },
        { path: "/care-entries/tombstones" },
        {
          path: "/care-entries",
          init: {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "meal" }),
          },
        },
        {
          path: `/care-entries/${careEntryRow.id}`,
          init: {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ note: "Should not write" }),
          },
        },
        {
          path: `/care-entries/${careEntryRow.id}`,
          init: { method: "DELETE" },
        },
        {
          path: "/care-entries/client-key/temp_capability_guard",
          init: { method: "DELETE" },
        },
      ];

      for (const request of requests) {
        const response = await fetch(`${baseUrl}${request.path}`, {
          ...request.init,
          headers: {
            ...Object.fromEntries(new Headers(request.init?.headers)),
            ...capabilityCase.headers,
          },
        });
        assert.equal(response.status, capabilityCase.status, request.path);
        assert.deepEqual(
          await response.json(),
          { error: capabilityCase.error },
          request.path,
        );
      }

      assert.equal(careDbAccesses, 0);
      assert.deepEqual(
        calls.households,
        Array(capabilityCase.expectedAuthorityLookups).fill("user_route"),
      );
    });
  });
}

test("care-entry route rejects ambiguous occurrence and update cursors before querying", async () => {
  const db = createSelectOnlyDb([careEntryRow]);

  await withApi(db, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/care-entries?since=2026-07-03T07:00:00.000Z&updatedSince=2026-07-03T12:00:00.000Z`,
      { headers: expectedHouseholdHeaders },
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
    const response = await fetch(
      `${baseUrl}/care-entries/tombstones?updatedSince=2026-07-03T12:00:00.000Z&limit=2`,
      { headers: expectedHouseholdHeaders },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body[0].entryId, tombstoneRow.entryId);
    assert.equal(body[0].updatedAt, "2026-07-03T12:30:00.000Z");
    assert.deepEqual(calls.auth, ["/care-entries/tombstones"]);
    assert.deepEqual(calls.households, ["user_route"]);
    assert.deepEqual(calls.scopedOperations, [ACTIVE_HOUSEHOLD_ID]);
    assert.equal(db.selectCalls.length, 1);
    assert.equal(db.selectCalls[0]?.limit, 2);
    assert.ok(
      db.selectCalls[0]?.where,
      "tombstone route should apply active-household and cursor filters",
    );
    assert.ok(
      db.selectCalls[0]?.orderBy,
      "tombstone route should order cursor reads by updatedAt",
    );
  });
});

test("care-entry tombstone route rejects invalid update cursors before querying", async () => {
  const db = createSelectOnlyDb([tombstoneRow]);

  await withApi(db, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/care-entries/tombstones?updatedSince=not-a-date`,
      { headers: expectedHouseholdHeaders },
    );
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
    onConflictDoNothingCalls: 0,
    conflictNextInsert: false,
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
            onConflictDoNothing() {
              db.onConflictDoNothingCalls += 1;
              return this;
            },
            async returning() {
              if (db.conflictNextInsert) {
                db.conflictNextInsert = false;
                return [];
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
  db.selectQueue.push([], []);
  await withApi(db as unknown as FakeDb, async (baseUrl) => {
    const first = await fetch(`${baseUrl}/care-entries`, {
      method: "POST",
      headers: {
        ...expectedHouseholdHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "meal",
        details: { clientKey: "temp_retry_1" },
      }),
    });
    assert.equal(first.status, 201);
    const firstBody = (await first.json()) as {
      id: string;
      householdId: string;
    };
    assert.equal(firstBody.householdId, ACTIVE_HOUSEHOLD_ID);
    assert.equal(db.insertedRows.length, 1);
    assert.equal(db.onConflictDoNothingCalls, 1);
    assert.equal(
      (db.insertedRows[0].details as Record<string, unknown>).clientKey,
      "temp_retry_1",
    );

    db.selectQueue.push([], [db.insertedRows[0]]);
    const retry = await fetch(`${baseUrl}/care-entries`, {
      method: "POST",
      headers: {
        ...expectedHouseholdHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "meal",
        details: { clientKey: "temp_retry_1" },
      }),
    });
    assert.equal(retry.status, 200);
    const retryBody = (await retry.json()) as { id: string };
    assert.equal(retryBody.id, firstBody.id);
    assert.equal(db.insertedRows.length, 1);
  });
});

test("care-entry create returns the winning row when ON CONFLICT observes a concurrent duplicate", async () => {
  const db = createIdempotentCreateDb();
  const winner = { ...careEntryRow, details: { clientKey: "temp_race_1" } };
  // Dedupe lookup misses (the race), the insert hits the partial unique
  // index (23505), and the recovery lookup returns the winner.
  db.selectQueue.push([], []);
  db.conflictNextInsert = true;
  await withApi(db as unknown as FakeDb, async (baseUrl) => {
    db.selectQueue.push([winner]);
    const res = await fetch(`${baseUrl}/care-entries`, {
      method: "POST",
      headers: {
        ...expectedHouseholdHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "meal",
        details: { clientKey: "temp_race_1" },
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { id: string };
    assert.equal(body.id, careEntryRow.id);
    assert.equal(db.insertedRows.length, 0);
  });
});

test("care-entry update returns 409 when the atomic revision guard rejects a stale write", async () => {
  const updateCalls: Array<{
    values?: Record<string, unknown>;
    where?: unknown;
  }> = [];
  const currentRow = {
    ...careEntryRow,
    details: { clientSyncRevision: 2 },
  };
  const db = {
    selectCalls: [],
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit() {
                  return [currentRow];
                },
              };
            },
          };
        },
      };
    },
    update() {
      const call: {
        values?: Record<string, unknown>;
        where?: unknown;
      } = {};
      updateCalls.push(call);
      return {
        set(values: Record<string, unknown>) {
          call.values = values;
          return {
            where(where: unknown) {
              call.where = where;
              return {
                async returning() {
                  return [];
                },
              };
            },
          };
        },
      };
    },
  };

  await withApi(db as unknown as FakeDb, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/care-entries/${careEntryRow.id}`, {
      method: "PATCH",
      headers: {
        ...expectedHouseholdHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        note: "Stale local note",
        details: { clientSyncRevision: 1 },
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(
      body.error,
      "A newer care entry update already exists. Refresh before retrying.",
    );
    assert.equal(body.entry.id, careEntryRow.id);
    assert.equal(body.entry.householdId, ACTIVE_HOUSEHOLD_ID);
    assert.equal(body.entry.details.clientSyncRevision, 2);
    assert.equal(updateCalls.length, 1);
    assert.ok(
      updateCalls[0]?.where,
      "stale writes must be rejected by the update where-clause",
    );
  });
});

test("revision-v1 rejects delayed equal and skipped revisions before update", async () => {
  for (const clientSyncRevision of [8, 10]) {
    let updateCallCount = 0;
    const currentRow = {
      ...careEntryRow,
      details: { clientSyncRevision: 8 },
    };
    const db = {
      selectCalls: [],
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  async limit() {
                    return [currentRow];
                  },
                };
              },
            };
          },
        };
      },
      update() {
        updateCallCount += 1;
        throw new Error("revision mismatch must not reach UPDATE");
      },
    };

    await withApi(db as unknown as FakeDb, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/care-entries/${careEntryRow.id}`,
        {
          method: "PATCH",
          headers: {
            ...expectedHouseholdHeaders,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            clientSyncProtocol: "revision-v1",
            note: "Delayed local note",
            details: { clientSyncRevision },
          }),
        },
      );
      const body = await response.json();

      assert.equal(response.status, 409);
      assert.equal(body.entry.details.clientSyncRevision, 8);
      assert.equal(updateCallCount, 0);
    });
  }
});

test("revision-v1 requires a valid revision before update", async () => {
  let updateCallCount = 0;
  const currentRow = {
    ...careEntryRow,
    details: { clientSyncRevision: 8 },
  };
  const db = {
    selectCalls: [],
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit() {
                  return [currentRow];
                },
              };
            },
          };
        },
      };
    },
    update() {
      updateCallCount += 1;
      throw new Error("invalid revision must not reach UPDATE");
    },
  };

  await withApi(db as unknown as FakeDb, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/care-entries/${careEntryRow.id}`, {
      method: "PATCH",
      headers: {
        ...expectedHouseholdHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        clientSyncProtocol: "revision-v1",
        note: "Missing revision",
        details: { routeName: "Creek loop" },
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(
      body.error,
      "revision-v1 care entry updates require clientSyncRevision.",
    );
    assert.equal(updateCallCount, 0);
  });
});

test("two revision-v1 writes built from the same row cannot both commit", async () => {
  let currentRow = {
    ...careEntryRow,
    details: { clientSyncRevision: 7 },
  };
  let updateCallCount = 0;
  const db = {
    selectCalls: [],
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit() {
                  return [currentRow];
                },
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          return {
            where() {
              return {
                async returning() {
                  updateCallCount += 1;
                  currentRow = { ...currentRow, ...values };
                  return [currentRow];
                },
              };
            },
          };
        },
      };
    },
  };

  await withApi(db as unknown as FakeDb, async (baseUrl) => {
    const request = (note: string) =>
      fetch(`${baseUrl}/care-entries/${careEntryRow.id}`, {
        method: "PATCH",
        headers: {
          ...expectedHouseholdHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          clientSyncProtocol: "revision-v1",
          note,
          details: { clientSyncRevision: 8 },
        }),
      });

    const first = await request("First caregiver");
    const delayed = await request("Delayed caregiver");
    const delayedBody = await delayed.json();

    assert.equal(first.status, 200);
    assert.equal(delayed.status, 409);
    assert.equal(delayedBody.entry.details.clientSyncRevision, 8);
    assert.equal(delayedBody.entry.note, "First caregiver");
    assert.equal(updateCallCount, 1);
  });
});

test("care-entry update advances partial and legacy echoed revisions", async () => {
  const cases = [
    {
      name: "partial",
      body: { note: "Partial note update" },
    },
    {
      name: "legacy echoed revision",
      body: {
        note: "Legacy full-details update",
        details: {
          clientSyncRevision: 2,
          routeName: "Creek loop",
        },
      },
    },
  ] as const;

  for (const scenario of cases) {
    const updateCalls: Array<{
      values?: Record<string, unknown>;
      where?: unknown;
    }> = [];
    const currentRow = {
      ...careEntryRow,
      details: {
        clientSyncRevision: 2,
        routeName: "Creek loop",
      },
    };
    const db = {
      selectCalls: [],
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  async limit() {
                    return [currentRow];
                  },
                };
              },
            };
          },
        };
      },
      update() {
        const call: {
          values?: Record<string, unknown>;
          where?: unknown;
        } = {};
        updateCalls.push(call);
        return {
          set(values: Record<string, unknown>) {
            call.values = values;
            return {
              where(where: unknown) {
                call.where = where;
                return {
                  async returning() {
                    return [{ ...currentRow, ...values }];
                  },
                };
              },
            };
          },
        };
      },
    };

    await withApi(db as unknown as FakeDb, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/care-entries/${careEntryRow.id}`,
        {
          method: "PATCH",
          headers: {
            ...expectedHouseholdHeaders,
            "content-type": "application/json",
          },
          body: JSON.stringify(scenario.body),
        },
      );
      const body = await response.json();

      assert.equal(response.status, 200, scenario.name);
      assert.equal(body.householdId, ACTIVE_HOUSEHOLD_ID, scenario.name);
      assert.equal(body.details.clientSyncRevision, 3, scenario.name);
      assert.equal(updateCalls.length, 1, scenario.name);
      assert.equal(
        (updateCalls[0]?.values?.details as Record<string, unknown> | undefined)
          ?.clientSyncRevision,
        3,
        scenario.name,
      );
      assert.ok(updateCalls[0]?.where, scenario.name);
    });
  }
});

test("care-entry delete and tombstone commit through the scoped authority database without a nested transaction", async () => {
  const tombstones: Array<Record<string, unknown>> = [];
  let deleteCalls = 0;
  const db = {
    selectCalls: [],
    transaction() {
      throw new Error(
        "the route must not open a transaction outside the authority lock scope",
      );
    },
    delete() {
      deleteCalls += 1;
      return {
        where() {
          return {
            async returning() {
              return [careEntryRow];
            },
          };
        },
      };
    },
    insert() {
      return {
        async values(values: Record<string, unknown>) {
          tombstones.push(values);
        },
      };
    },
  };

  await withApi(db as unknown as FakeDb, async (baseUrl, calls) => {
    const response = await fetch(`${baseUrl}/care-entries/${careEntryRow.id}`, {
      method: "DELETE",
      headers: expectedHouseholdHeaders,
    });

    assert.equal(response.status, 204);
    assert.equal(deleteCalls, 1);
    assert.deepEqual(calls.scopedOperations, [ACTIVE_HOUSEHOLD_ID]);
    assert.deepEqual(tombstones, [
      {
        householdId: ACTIVE_HOUSEHOLD_ID,
        entryId: careEntryRow.id,
        petId: careEntryRow.petId,
        caregiverUserId: "user_route",
        householdVisible: true,
        deletedByUserId: "user_route",
        deletedAt: new Date("2026-07-03T12:30:00.000Z"),
        updatedAt: new Date("2026-07-03T12:30:00.000Z"),
      },
    ]);
  });
});

test("care-entry delete denies a read-only role before touching Care tables", async () => {
  let careDbAccesses = 0;
  const db = new Proxy(
    { selectCalls: [] },
    {
      get(target, property, receiver) {
        if (property === "selectCalls") {
          return Reflect.get(target, property, receiver);
        }
        careDbAccesses += 1;
        throw new Error("a read-only delete must not touch a Care table");
      },
    },
  );

  await withApi(
    db as unknown as FakeDb,
    async (baseUrl) => {
      for (const path of [
        `/care-entries/${careEntryRow.id}`,
        "/care-entries/client-key/temp_read_only_guard",
      ]) {
        const response = await fetch(`${baseUrl}${path}`, {
          method: "DELETE",
          headers: expectedHouseholdHeaders,
        });

        assert.equal(response.status, 403, path);
        assert.deepEqual(await response.json(), {
          error: "Role is read-only for care log writes.",
        });
      }
      assert.equal(careDbAccesses, 0);
    },
    { authorizationRole: "vet viewer" },
  );
});

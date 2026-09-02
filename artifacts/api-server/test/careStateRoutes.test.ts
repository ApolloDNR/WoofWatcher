import assert from "node:assert/strict";
import { test } from "node:test";

import { createCareStateRouter } from "../src/routes/care-state-router.ts";

type Handler = (
  req: { body?: unknown },
  res: FakeResponse,
) => Promise<void> | void;

type Registration = {
  path: string;
  handlers: unknown[];
};

type CareStateRow = {
  householdId: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
  doc: Record<string, unknown>;
};

class FakeResponse {
  statusCode = 200;
  body: unknown;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): this {
    this.body = body;
    return this;
  }
}

const householdId = "11111111-1111-4111-8111-111111111111";
const userId = "user_route";
const careStateTable = {
  householdId: "careState.householdId",
  version: "careState.version",
};
const queryOps = {
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  eq: (left: unknown, right: unknown) => ({ op: "eq", left, right }),
};
const currentRow: CareStateRow = {
  householdId,
  version: 7,
  updatedAt: "2026-09-02T12:00:00.000Z",
  updatedBy: "first_owner",
  doc: { profile: { name: "Phoenix" }, marker: "current" },
};

function createDb(
  selectQueue: CareStateRow[][],
  updateQueue: CareStateRow[][] = [],
) {
  const selectCalls: Array<{ table?: unknown; where?: unknown }> = [];
  const updateCalls: Array<{
    table?: unknown;
    values?: unknown;
    where?: unknown;
  }> = [];

  return {
    selectCalls,
    updateCalls,
    select() {
      const call: { table?: unknown; where?: unknown } = {};
      selectCalls.push(call);
      return {
        from(table: unknown) {
          call.table = table;
          return {
            async where(where: unknown) {
              call.where = where;
              return selectQueue.shift() ?? [];
            },
          };
        },
      };
    },
    update(table: unknown) {
      const call: { table?: unknown; values?: unknown; where?: unknown } = {
        table,
      };
      updateCalls.push(call);
      return {
        set(values: unknown) {
          call.values = values;
          return {
            where(where: unknown) {
              call.where = where;
              return {
                async returning() {
                  return updateQueue.shift() ?? [];
                },
              };
            },
          };
        },
      };
    },
  };
}

function matchesRow(condition: any, row: CareStateRow): boolean {
  if (condition?.op === "and") {
    return condition.conditions.every((child: unknown) =>
      matchesRow(child, row),
    );
  }
  if (condition?.op !== "eq") return false;
  if (condition.left === careStateTable.householdId) {
    return row.householdId === condition.right;
  }
  if (condition.left === careStateTable.version) {
    return row.version === condition.right;
  }
  return false;
}

function createStatefulCasDb(
  initialRow: CareStateRow,
  beforeUpdate: () => CareStateRow | null,
) {
  let row: CareStateRow | null = initialRow;
  let hookPending = true;
  const selectCalls: Array<{ table?: unknown; where?: unknown }> = [];
  const updateCalls: Array<{
    table?: unknown;
    values?: unknown;
    where?: unknown;
  }> = [];

  return {
    selectCalls,
    updateCalls,
    select() {
      const call: { table?: unknown; where?: unknown } = {};
      selectCalls.push(call);
      return {
        from(table: unknown) {
          call.table = table;
          return {
            async where(where: unknown) {
              call.where = where;
              return row && matchesRow(where, row) ? [{ ...row }] : [];
            },
          };
        },
      };
    },
    update(table: unknown) {
      const call: { table?: unknown; values?: unknown; where?: unknown } = {
        table,
      };
      updateCalls.push(call);
      return {
        set(values: Partial<CareStateRow>) {
          call.values = values;
          return {
            where(where: unknown) {
              call.where = where;
              return {
                async returning() {
                  if (hookPending) {
                    hookPending = false;
                    row = beforeUpdate();
                  }
                  if (!row || !matchesRow(where, row)) return [];
                  row = { ...row, ...values };
                  return [{ ...row }];
                },
              };
            },
          };
        },
      };
    },
  };
}

function createHarness(input: {
  role?: string | null;
  authorizationRole?: string | null;
  selectQueue?: CareStateRow[][];
  updateQueue?: CareStateRow[][];
  db?: any;
}) {
  const getRoutes: Registration[] = [];
  const putRoutes: Registration[] = [];
  const calls = {
    households: [] as string[],
    authz: [] as Array<[string, string]>,
  };
  const db =
    input.db ??
    createDb(input.selectQueue ?? [[currentRow]], input.updateQueue ?? []);
  const requireAuth = () => undefined;
  const router = {
    get(path: string, ...handlers: unknown[]) {
      getRoutes.push({ path, handlers });
      return router;
    },
    put(path: string, ...handlers: unknown[]) {
      putRoutes.push({ path, handlers });
      return router;
    },
  };

  createCareStateRouter({
    createRouter: () => router,
    db,
    careStateTable,
    queryOps,
    schemas: {
      GetCareStateResponse: { parse: (value: unknown) => value },
      PutCareStateBody: {
        safeParse(value: unknown) {
          if (
            value &&
            typeof value === "object" &&
            typeof (value as { version?: unknown }).version === "number" &&
            "doc" in value
          ) {
            return {
              success: true as const,
              data: value as { version: number; doc: unknown },
            };
          }
          return {
            success: false as const,
            error: { message: "Invalid care-state body" },
          };
        },
      },
    },
    requireAuth,
    getUserId: () => userId,
    async getActiveHouseholdId(receivedUserId: string) {
      calls.households.push(receivedUserId);
      return householdId;
    },
    async getHouseholdMemberAuthz(
      receivedHouseholdId: string,
      receivedUserId: string,
    ) {
      calls.authz.push([receivedHouseholdId, receivedUserId]);
      return input.role === undefined
        ? null
        : {
            storedRole: input.role,
            role: input.authorizationRole ?? input.role,
          };
    },
  });

  assert.equal(getRoutes.length, 1);
  assert.equal(putRoutes.length, 1);
  assert.equal(getRoutes[0]?.path, "/care-state");
  assert.equal(putRoutes[0]?.path, "/care-state");
  assert.equal(getRoutes[0]?.handlers[0], requireAuth);
  assert.equal(putRoutes[0]?.handlers[0], requireAuth);

  return {
    calls,
    db,
    get: getRoutes[0]?.handlers.at(-1) as Handler,
    put: putRoutes[0]?.handlers.at(-1) as Handler,
  };
}

async function invoke(handler: Handler, body?: unknown): Promise<FakeResponse> {
  const response = new FakeResponse();
  await handler({ body }, response);
  return response;
}

test("care-state GET stays authenticated and readable for an active household", async () => {
  const harness = createHarness({
    role: "vet viewer",
    selectQueue: [[currentRow]],
  });

  const response = await invoke(harness.get);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    version: currentRow.version,
    updatedAt: currentRow.updatedAt,
    updatedBy: currentRow.updatedBy,
    doc: currentRow.doc,
  });
  assert.deepEqual(harness.calls.households, [userId]);
  assert.deepEqual(harness.calls.authz, []);
  assert.equal(harness.db.selectCalls.length, 1);
});

test("care-state PUT denies an unknown stored role even when runtime normalization says adult", async () => {
  const harness = createHarness({
    role: "owner impersonator",
    authorizationRole: "adult",
  });

  const response = await invoke(harness.put, {
    version: 7,
    doc: { marker: "attacker" },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(harness.db.selectCalls.length, 0);
  assert.equal(harness.db.updateCalls.length, 0);
});

test("care-state PUT rejects invalid bodies before household or role lookup", async () => {
  const harness = createHarness({ role: "owner" });

  const response = await invoke(harness.put, { version: "7" });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: "Invalid care-state body" });
  assert.deepEqual(harness.calls.households, []);
  assert.deepEqual(harness.calls.authz, []);
  assert.equal(harness.db.selectCalls.length, 0);
  assert.equal(harness.db.updateCalls.length, 0);
});

test("care-state PUT denies youth, helper, read-only, expired, missing, and unknown roles before SELECT or UPDATE", async () => {
  const deniedRoles = [
    "teen",
    "kid",
    "sitter",
    "trainer",
    "walker",
    "vet viewer",
    "expired access pass",
    "unknown-role",
    null,
    undefined,
  ] as const;

  for (const role of deniedRoles) {
    const harness = createHarness({ role });
    const response = await invoke(harness.put, {
      version: 7,
      doc: { marker: "attacker" },
    });

    assert.equal(response.statusCode, 403, String(role));
    assert.deepEqual(response.body, {
      error:
        "Only an owner or adult household member can replace the shared care document.",
    });
    assert.deepEqual(
      harness.calls.authz,
      [[householdId, userId]],
      String(role),
    );
    assert.equal(harness.db.selectCalls.length, 0, String(role));
    assert.equal(harness.db.updateCalls.length, 0, String(role));
  }
});

test("owner and adult writes use household plus current version in the atomic UPDATE", async () => {
  for (const role of ["owner", "adult"]) {
    const updatedRow: CareStateRow = {
      ...currentRow,
      version: 8,
      updatedAt: "2026-09-02T12:01:00.000Z",
      updatedBy: userId,
      doc: { marker: role },
    };
    const harness = createHarness({
      role,
      selectQueue: [[currentRow]],
      updateQueue: [[updatedRow]],
    });

    const response = await invoke(harness.put, {
      version: 7,
      doc: updatedRow.doc,
    });

    assert.equal(response.statusCode, 200, role);
    assert.deepEqual(response.body, {
      version: 8,
      updatedAt: updatedRow.updatedAt,
      updatedBy: userId,
      doc: updatedRow.doc,
    });
    assert.equal(harness.db.updateCalls.length, 1);
    assert.deepEqual(harness.db.updateCalls[0]?.where, {
      op: "and",
      conditions: [
        { op: "eq", left: careStateTable.householdId, right: householdId },
        { op: "eq", left: careStateTable.version, right: 7 },
      ],
    });
  }
});

test("a stale care-state version returns the current conflict envelope without UPDATE", async () => {
  const harness = createHarness({ role: "owner", selectQueue: [[currentRow]] });

  const response = await invoke(harness.put, {
    version: 6,
    doc: { marker: "stale" },
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    version: currentRow.version,
    updatedAt: currentRow.updatedAt,
    updatedBy: currentRow.updatedBy,
    doc: currentRow.doc,
  });
  assert.equal(harness.db.updateCalls.length, 0);
});

test("a write that loses the compare-and-swap race refetches and returns the winning envelope", async () => {
  const winningRow: CareStateRow = {
    ...currentRow,
    version: 8,
    updatedAt: "2026-09-02T12:01:00.000Z",
    updatedBy: "other_device",
    doc: { marker: "winner" },
  };
  const db = createStatefulCasDb(currentRow, () => winningRow);
  const harness = createHarness({ role: "adult", db });

  const response = await invoke(harness.put, {
    version: 7,
    doc: { marker: "loser" },
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    version: winningRow.version,
    updatedAt: winningRow.updatedAt,
    updatedBy: winningRow.updatedBy,
    doc: winningRow.doc,
  });
  assert.equal(harness.db.selectCalls.length, 2);
  assert.equal(harness.db.updateCalls.length, 1);
});

test("a care-state row deleted during compare-and-swap recovery returns 404", async () => {
  const db = createStatefulCasDb(currentRow, () => null);
  const harness = createHarness({ role: "owner", db });

  const response = await invoke(harness.put, {
    version: 7,
    doc: { marker: "late" },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: "Care state not found" });
  assert.equal(harness.db.selectCalls.length, 2);
  assert.equal(harness.db.updateCalls.length, 1);
});

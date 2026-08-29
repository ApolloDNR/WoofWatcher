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

const HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const EXPECTED_HOUSEHOLD_HEADER = "X-WoofWatcher-Expected-Household-Id";

type TableName = "entries" | "tombstones";
type Column = { table: TableName; key: string };
type Expression =
  | { op: "and" | "or"; conditions: Expression[] }
  | { op: "eq" | "gte"; left: unknown; right: unknown }
  | {
      op: "sql";
      strings: string[];
      values: unknown[];
    };

const column = (table: TableName, key: string): Column => ({ table, key });

const careEntriesTable = {
  __table: "entries" as const,
  id: column("entries", "id"),
  householdId: column("entries", "householdId"),
  householdVisible: column("entries", "householdVisible"),
  caregiverUserId: column("entries", "caregiverUserId"),
  occurredAt: column("entries", "occurredAt"),
  updatedAt: column("entries", "updatedAt"),
  details: column("entries", "details"),
};

const careEntryTombstonesTable = {
  __table: "tombstones" as const,
  householdId: column("tombstones", "householdId"),
  householdVisible: column("tombstones", "householdVisible"),
  caregiverUserId: column("tombstones", "caregiverUserId"),
  clientKey: column("tombstones", "clientKey"),
  updatedAt: column("tombstones", "updatedAt"),
};

function isColumn(value: unknown): value is Column {
  return (
    value != null &&
    typeof value === "object" &&
    "table" in value &&
    "key" in value
  );
}

function resolveOperand(value: unknown, row: Record<string, unknown>): unknown {
  return isColumn(value) ? row[value.key] : value;
}

function matches(
  expression: Expression,
  row: Record<string, unknown>,
): boolean {
  if (expression.op === "and") {
    return expression.conditions.every((condition) => matches(condition, row));
  }
  if (expression.op === "or") {
    return expression.conditions.some((condition) => matches(condition, row));
  }
  if (expression.op === "eq") {
    return (
      resolveOperand(expression.left, row) ===
      resolveOperand(expression.right, row)
    );
  }
  if (expression.op === "gte") {
    return (
      new Date(String(resolveOperand(expression.left, row))).getTime() >=
      new Date(String(resolveOperand(expression.right, row))).getTime()
    );
  }

  const source = expression.strings.join("?");
  if (source.includes("clientKey")) {
    const clientKey = [...expression.values]
      .reverse()
      .find((value) => typeof value === "string");
    return (
      typeof clientKey === "string" &&
      (row.details as Record<string, unknown> | null | undefined)?.clientKey ===
        clientKey
    );
  }

  // Revision predicates are independently covered by careEntryRoutes.test.ts.
  return true;
}

function createPrivacyDb() {
  let nextEntry = 1;
  let nextTombstone = 1;
  const entries: Array<Record<string, unknown>> = [];
  const tombstones: Array<Record<string, unknown>> = [];

  const rowsFor = (table: { __table: TableName }) =>
    table.__table === "entries" ? entries : tombstones;

  const db = {
    entries,
    tombstones,
    serializedOperations: [] as boolean[],
    failNextTombstoneInsert: false,
    select() {
      return {
        from(table: { __table: TableName }) {
          return {
            where(where: Expression) {
              const selected = () =>
                rowsFor(table).filter((row) => matches(where, row));
              return {
                async limit(limit: number) {
                  return selected().slice(0, limit);
                },
                orderBy() {
                  return {
                    async limit(limit: number) {
                      return selected().slice(0, limit);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    insert(table: { __table: TableName }) {
      return {
        values(values: Record<string, unknown>) {
          if (table.__table === "tombstones") {
            if (db.failNextTombstoneInsert) {
              db.failNextTombstoneInsert = false;
              throw new Error("injected tombstone insert failure");
            }
            const now = values.deletedAt as Date;
            tombstones.push({
              id: `33333333-3333-4333-8333-${String(nextTombstone++).padStart(12, "0")}`,
              createdAt: now,
              ...values,
            });
            return Promise.resolve();
          }

          const createEntry = () => {
            const clientKey = (
              values.details as Record<string, unknown> | null | undefined
            )?.clientKey;
            const duplicate = entries.find(
              (row) =>
                row.householdId === values.householdId &&
                row.caregiverUserId === values.caregiverUserId &&
                typeof clientKey === "string" &&
                (row.details as Record<string, unknown> | null | undefined)
                  ?.clientKey === clientKey,
            );
            if (duplicate) return [];

            const now = new Date("2026-08-29T12:00:00.000Z");
            const row = {
              id: `22222222-2222-4222-8222-${String(nextEntry++).padStart(12, "0")}`,
              petId: null,
              mood: null,
              severity: null,
              note: null,
              createdAt: now,
              updatedAt: now,
              ...values,
            };
            entries.push(row);
            return [row];
          };

          return {
            onConflictDoNothing() {
              return this;
            },
            async returning() {
              return createEntry();
            },
          };
        },
      };
    },
    update(table: { __table: TableName }) {
      assert.equal(table.__table, "entries");
      return {
        set(values: Record<string, unknown>) {
          return {
            where(where: Expression) {
              return {
                async returning() {
                  const index = entries.findIndex((row) => matches(where, row));
                  if (index < 0) return [];
                  entries[index] = { ...entries[index], ...values };
                  return [entries[index]];
                },
              };
            },
          };
        },
      };
    },
    delete(table: { __table: TableName }) {
      assert.equal(table.__table, "entries");
      return {
        where(where: Expression) {
          return {
            async returning() {
              const index = entries.findIndex((row) => matches(where, row));
              if (index < 0) return [];
              return entries.splice(index, 1);
            },
          };
        },
      };
    },
  };

  return db;
}

async function withApi(
  db: ReturnType<typeof createPrivacyDb>,
  run: (baseUrl: string) => Promise<void>,
  options: {
    beforeSerializedOperation?: (input: {
      userId: string;
      sequence: number;
    }) => Promise<void> | void;
  } = {},
): Promise<void> {
  let serializedTail = Promise.resolve();
  let serializedSequence = 0;
  const app = express();
  app.use(express.json());
  app.use(
    createCareEntriesRouter({
      careEntriesTable,
      careEntryTombstonesTable,
      queryOps: {
        and: (...conditions: Expression[]) => ({ op: "and", conditions }),
        or: (...conditions: Expression[]) => ({ op: "or", conditions }),
        desc: (value: unknown) => value,
        eq: (left: unknown, right: unknown) => ({ op: "eq", left, right }),
        gte: (left: unknown, right: unknown) => ({ op: "gte", left, right }),
        sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
          op: "sql",
          strings: [...strings],
          values,
        }),
      },
      requireAuth(req: Request, _res: Response, next: NextFunction) {
        (req as Request & { userId?: string }).userId =
          req.get("x-test-user") ?? "missing-user";
        next();
      },
      getUserId(req: Request) {
        return (req as Request & { userId?: string }).userId ?? "missing-user";
      },
      async runHouseholdScopedOperation(input: {
        userId: string;
        expectedHouseholdId: string;
        serializeHouseholdMutation?: boolean;
        operation: (scope: {
          database: unknown;
          userId: string;
          householdId: string;
          role: string;
          authorizationRole: string;
          caregiverName: string;
          now: Date;
        }) => Promise<unknown>;
      }) {
        assert.equal(input.expectedHouseholdId, HOUSEHOLD_ID);
        db.serializedOperations.push(
          input.serializeHouseholdMutation === true,
        );
        const invoke = () => {
          const entriesBefore = db.entries.map((row) => ({ ...row }));
          const tombstonesBefore = db.tombstones.map((row) => ({ ...row }));
          return input
            .operation({
              database: db,
              userId: input.userId,
              householdId: HOUSEHOLD_ID,
              role: "adult",
              authorizationRole: "adult",
              caregiverName: input.userId,
              now: new Date("2026-08-29T12:00:00.000Z"),
            })
            .catch((error) => {
              db.entries.splice(0, db.entries.length, ...entriesBefore);
              db.tombstones.splice(
                0,
                db.tombstones.length,
                ...tombstonesBefore,
              );
              throw error;
            });
        };
        if (!input.serializeHouseholdMutation) return invoke();

        const previous = serializedTail;
        let release = () => {};
        const current = new Promise<void>((resolve) => {
          release = resolve;
        });
        serializedTail = previous.then(() => current);
        await previous;
        const sequence = ++serializedSequence;
        try {
          await options.beforeSerializedOperation?.({
            userId: input.userId,
            sequence,
          });
          return await invoke();
        } finally {
          release();
        }
      },
    } as never),
  );
  app.use(
    (
      _error: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      res.status(503).json({ error: "Care transaction did not commit." });
    },
  );

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
}

function headers(userId: string, json = false): Record<string, string> {
  return {
    [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_ID,
    "x-test-user": userId,
    ...(json ? { "content-type": "application/json" } : {}),
  };
}

async function createEntry(
  baseUrl: string,
  userId: string,
  input: {
    householdVisible: boolean;
    clientKey: string;
    note?: string;
  },
) {
  const response = await fetch(`${baseUrl}/care-entries`, {
    method: "POST",
    headers: headers(userId, true),
    body: JSON.stringify({
      type: "note",
      note: input.note,
      details: {
        clientKey: input.clientKey,
        householdVisible: input.householdVisible,
      },
    }),
  });
  return { response, body: (await response.json()) as Record<string, unknown> };
}

async function deleteEntryByClientKey(
  baseUrl: string,
  userId: string,
  clientKey: string,
) {
  return fetch(
    `${baseUrl}/care-entries/client-key/${encodeURIComponent(clientKey)}`,
    {
      method: "DELETE",
      headers: headers(userId),
    },
  );
}

test("private creates remain visible across the creator's devices but never list for another household member", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const privateCreate = await createEntry(baseUrl, "user_apollo", {
      householdVisible: false,
      clientKey: "temp_private",
      note: "Private medication detail",
    });
    const sharedCreate = await createEntry(baseUrl, "user_apollo", {
      householdVisible: true,
      clientKey: "temp_shared",
      note: "Shared walk",
    });
    assert.equal(privateCreate.response.status, 201);
    assert.equal(sharedCreate.response.status, 201);

    const creatorList = await fetch(`${baseUrl}/care-entries`, {
      headers: headers("user_apollo"),
    });
    const creatorRows = (await creatorList.json()) as Array<{ id: string }>;
    assert.deepEqual(
      new Set(creatorRows.map((row) => row.id)),
      new Set([privateCreate.body.id, sharedCreate.body.id]),
    );

    const memberList = await fetch(`${baseUrl}/care-entries`, {
      headers: headers("user_jordan"),
    });
    const memberRows = (await memberList.json()) as Array<{ id: string }>;
    assert.deepEqual(
      memberRows.map((row) => row.id),
      [sharedCreate.body.id],
    );
  });
});

test("an absent householdVisible flag remains legacy-shared", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/care-entries`, {
      method: "POST",
      headers: headers("user_apollo", true),
      body: JSON.stringify({
        type: "note",
        note: "Legacy shared note",
        details: { clientKey: "temp_legacy_shared" },
      }),
    });
    assert.equal(response.status, 201);
    assert.equal(db.entries[0]?.householdVisible, true);

    const memberList = await fetch(`${baseUrl}/care-entries`, {
      headers: headers("user_jordan"),
    });
    const rows = (await memberList.json()) as Array<{ note: string }>;
    assert.deepEqual(
      rows.map((row) => row.note),
      ["Legacy shared note"],
    );
  });
});

test("create rejects every present non-boolean householdVisible value", async () => {
  const malformedValues: unknown[] = ["false", null, 0, {}, []];
  for (const householdVisible of malformedValues) {
    const db = createPrivacyDb();
    await withApi(db, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/care-entries`, {
        method: "POST",
        headers: headers("user_apollo", true),
        body: JSON.stringify({
          type: "note",
          details: { householdVisible },
        }),
      });
      assert.equal(response.status, 400, JSON.stringify(householdVisible));
      assert.deepEqual(await response.json(), {
        error: "householdVisible must be a boolean when provided.",
      });
      assert.equal(db.entries.length, 0);
    });
  }
});

test("private idempotency keys are creator-scoped and cannot return another member's row", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const first = await createEntry(baseUrl, "user_apollo", {
      householdVisible: false,
      clientKey: "temp_same_device_key",
    });
    const sameUserRetry = await createEntry(baseUrl, "user_apollo", {
      householdVisible: false,
      clientKey: "temp_same_device_key",
    });
    const otherMember = await createEntry(baseUrl, "user_jordan", {
      householdVisible: false,
      clientKey: "temp_same_device_key",
    });

    assert.equal(first.response.status, 201);
    assert.equal(sameUserRetry.response.status, 200);
    assert.equal(sameUserRetry.body.id, first.body.id);
    assert.equal(otherMember.response.status, 201);
    assert.notEqual(otherMember.body.id, first.body.id);
  });
});

test("another household member cannot read through, update, privatize, or delete the creator's private row", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const created = await createEntry(baseUrl, "user_apollo", {
      householdVisible: false,
      clientKey: "temp_private_mutation",
      note: "Creator-only detail",
    });
    const id = String(created.body.id);

    const patch = await fetch(`${baseUrl}/care-entries/${id}`, {
      method: "PATCH",
      headers: headers("user_jordan", true),
      body: JSON.stringify({ note: "Intruding edit" }),
    });
    assert.equal(patch.status, 404);
    assert.deepEqual(await patch.json(), { error: "Entry not found" });

    const remove = await fetch(`${baseUrl}/care-entries/${id}`, {
      method: "DELETE",
      headers: headers("user_jordan"),
    });
    assert.equal(remove.status, 404);
    assert.deepEqual(await remove.json(), { error: "Entry not found" });
    assert.equal(db.entries[0]?.note, "Creator-only detail");
    assert.equal(db.tombstones.length, 0);

    const creatorPatch = await fetch(`${baseUrl}/care-entries/${id}`, {
      method: "PATCH",
      headers: headers("user_apollo", true),
      body: JSON.stringify({ note: "Creator edit" }),
    });
    assert.equal(creatorPatch.status, 200);
  });
});

test("only a shared row's creator may make it private", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const created = await createEntry(baseUrl, "user_apollo", {
      householdVisible: true,
      clientKey: "temp_shared_to_private",
    });
    const response = await fetch(`${baseUrl}/care-entries/${created.body.id}`, {
      method: "PATCH",
      headers: headers("user_jordan", true),
      body: JSON.stringify({
        details: {
          clientKey: "temp_shared_to_private",
          householdVisible: false,
        },
      }),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "Only the creator can make a care entry private.",
    });
    assert.equal(db.entries[0]?.householdVisible, true);
  });
});

test("a partial details update cannot silently turn a private row household-visible", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const created = await createEntry(baseUrl, "user_apollo", {
      householdVisible: false,
      clientKey: "temp_private_partial_update",
    });
    const response = await fetch(`${baseUrl}/care-entries/${created.body.id}`, {
      method: "PATCH",
      headers: headers("user_apollo", true),
      body: JSON.stringify({
        details: {
          clientKey: "temp_private_partial_update",
          routeName: "Creek loop",
        },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(db.entries[0]?.householdVisible, false);
    assert.equal(
      (db.entries[0]?.details as Record<string, unknown>).householdVisible,
      false,
    );

    const memberList = await fetch(`${baseUrl}/care-entries`, {
      headers: headers("user_jordan"),
    });
    assert.deepEqual(await memberList.json(), []);
  });
});

test("update rejects every present non-boolean householdVisible value", async () => {
  const malformedValues: unknown[] = ["true", null, 1, {}, []];
  for (const householdVisible of malformedValues) {
    const db = createPrivacyDb();
    await withApi(db, async (baseUrl) => {
      const created = await createEntry(baseUrl, "user_apollo", {
        householdVisible: false,
        clientKey: `temp_malformed_update_${JSON.stringify(householdVisible)}`,
      });
      const response = await fetch(
        `${baseUrl}/care-entries/${created.body.id}`,
        {
          method: "PATCH",
          headers: headers("user_apollo", true),
          body: JSON.stringify({ details: { householdVisible } }),
        },
      );
      assert.equal(response.status, 400, JSON.stringify(householdVisible));
      assert.deepEqual(await response.json(), {
        error: "householdVisible must be a boolean when provided.",
      });
      assert.equal(db.entries[0]?.householdVisible, false);
    });
  }
});

test("private delete tombstones remain creator-only while shared tombstones propagate to the household", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const privateEntry = await createEntry(baseUrl, "user_apollo", {
      householdVisible: false,
      clientKey: "temp_private_delete",
    });
    const privateDelete = await fetch(
      `${baseUrl}/care-entries/${privateEntry.body.id}`,
      { method: "DELETE", headers: headers("user_apollo") },
    );
    assert.equal(privateDelete.status, 204);

    const otherPrivateTombstones = await fetch(
      `${baseUrl}/care-entries/tombstones`,
      { headers: headers("user_jordan") },
    );
    assert.deepEqual(await otherPrivateTombstones.json(), []);

    const creatorPrivateTombstones = await fetch(
      `${baseUrl}/care-entries/tombstones`,
      { headers: headers("user_apollo") },
    );
    const creatorRows = (await creatorPrivateTombstones.json()) as Array<{
      entryId: string;
    }>;
    assert.deepEqual(
      creatorRows.map((row) => row.entryId),
      [privateEntry.body.id],
    );

    const sharedEntry = await createEntry(baseUrl, "user_apollo", {
      householdVisible: true,
      clientKey: "temp_shared_delete",
    });
    const sharedDelete = await fetch(
      `${baseUrl}/care-entries/${sharedEntry.body.id}`,
      { method: "DELETE", headers: headers("user_jordan") },
    );
    assert.equal(sharedDelete.status, 204);

    const householdTombstones = await fetch(
      `${baseUrl}/care-entries/tombstones`,
      { headers: headers("user_jordan") },
    );
    const householdRows = (await householdTombstones.json()) as Array<{
      entryId: string;
    }>;
    assert.deepEqual(
      householdRows.map((row) => row.entryId),
      [sharedEntry.body.id],
    );
  });
});

test("a lost create response cannot be resurrected after another device deletes the acknowledged row", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const firstDevice = await createEntry(baseUrl, "user_apollo", {
      householdVisible: true,
      clientKey: "temp_lost_response_then_deleted",
      note: "The response never reached device A",
    });
    assert.equal(firstDevice.response.status, 201);

    const otherDeviceDelete = await fetch(
      `${baseUrl}/care-entries/${firstDevice.body.id}`,
      { method: "DELETE", headers: headers("user_apollo") },
    );
    assert.equal(otherDeviceDelete.status, 204);
    assert.equal(db.entries.length, 0);
    assert.equal(
      db.tombstones[0]?.clientKey,
      "temp_lost_response_then_deleted",
      "the delete must copy the normalized creator-scoped client key atomically",
    );

    const staleRetry = await createEntry(baseUrl, "user_apollo", {
      householdVisible: true,
      clientKey: "temp_lost_response_then_deleted",
      note: "Stale device A retry",
    });
    assert.equal(staleRetry.response.status, 410);
    assert.deepEqual(staleRetry.body, {
      error: "This care entry was deleted and cannot be recreated.",
      code: "care_entry_create_revoked",
      clientKey: "temp_lost_response_then_deleted",
    });
    assert.equal(db.entries.length, 0);
  });
});

test("a creator-scoped deletion key does not revoke another creator's create", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const original = await createEntry(baseUrl, "user_apollo", {
      householdVisible: false,
      clientKey: "temp_creator_scoped_delete",
    });
    assert.equal(original.response.status, 201);
    const removed = await fetch(
      `${baseUrl}/care-entries/${original.body.id}`,
      { method: "DELETE", headers: headers("user_apollo") },
    );
    assert.equal(removed.status, 204);

    const otherCreator = await createEntry(baseUrl, "user_jordan", {
      householdVisible: false,
      clientKey: "temp_creator_scoped_delete",
    });
    assert.equal(otherCreator.response.status, 201);
    assert.equal(db.entries.length, 1);
    assert.equal(db.entries[0]?.caregiverUserId, "user_jordan");
  });
});

test("concurrent delete-first serialization makes the queued stale retry terminal", async () => {
  const db = createPrivacyDb();
  let armed = false;
  let releaseFirst = () => {};
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let markFirstEntered = () => {};
  const firstEntered = new Promise<void>((resolve) => {
    markFirstEntered = resolve;
  });

  await withApi(
    db,
    async (baseUrl) => {
      const original = await createEntry(baseUrl, "user_apollo", {
        householdVisible: true,
        clientKey: "temp_delete_first",
      });
      assert.equal(original.response.status, 201);
      armed = true;

      const deleting = fetch(`${baseUrl}/care-entries/${original.body.id}`, {
        method: "DELETE",
        headers: headers("user_jordan"),
      });
      await firstEntered;
      const retrying = createEntry(baseUrl, "user_apollo", {
        householdVisible: true,
        clientKey: "temp_delete_first",
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      releaseFirst();

      const [deleted, retried] = await Promise.all([deleting, retrying]);
      assert.equal(deleted.status, 204);
      assert.equal(retried.response.status, 410);
      assert.equal(retried.body.clientKey, "temp_delete_first");
      assert.equal(db.entries.length, 0);
      assert.equal(db.tombstones.length, 1);
      assert.ok(db.serializedOperations.every(Boolean));
    },
    {
      async beforeSerializedOperation({ userId }) {
        if (!armed || userId !== "user_jordan") return;
        armed = false;
        markFirstEntered();
        await firstGate;
      },
    },
  );
});

test("concurrent retry-first serialization returns the existing row before the queued delete wins", async () => {
  const db = createPrivacyDb();
  let armed = false;
  let releaseFirst = () => {};
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let markFirstEntered = () => {};
  const firstEntered = new Promise<void>((resolve) => {
    markFirstEntered = resolve;
  });

  await withApi(
    db,
    async (baseUrl) => {
      const original = await createEntry(baseUrl, "user_apollo", {
        householdVisible: true,
        clientKey: "temp_retry_first",
      });
      assert.equal(original.response.status, 201);
      armed = true;

      const retrying = createEntry(baseUrl, "user_apollo", {
        householdVisible: true,
        clientKey: "temp_retry_first",
      });
      await firstEntered;
      const deleting = fetch(`${baseUrl}/care-entries/${original.body.id}`, {
        method: "DELETE",
        headers: headers("user_jordan"),
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      releaseFirst();

      const [retried, deleted] = await Promise.all([retrying, deleting]);
      assert.equal(retried.response.status, 200);
      assert.equal(retried.body.id, original.body.id);
      assert.equal(deleted.status, 204);
      assert.equal(db.entries.length, 0);
      assert.equal(db.tombstones[0]?.clientKey, "temp_retry_first");
      assert.ok(db.serializedOperations.every(Boolean));
    },
    {
      async beforeSerializedOperation({ userId }) {
        if (!armed || userId !== "user_apollo") return;
        armed = false;
        markFirstEntered();
        await firstGate;
      },
    },
  );
});

test("private creator tombstones revoke the same creator across devices without affecting another household", async () => {
  const db = createPrivacyDb();
  db.tombstones.push({
    householdId: "99999999-9999-4999-8999-999999999999",
    caregiverUserId: "user_apollo",
    householdVisible: false,
    clientKey: "temp_other_household",
  });

  await withApi(db, async (baseUrl) => {
    const currentHousehold = await createEntry(baseUrl, "user_apollo", {
      householdVisible: false,
      clientKey: "temp_other_household",
    });
    assert.equal(currentHousehold.response.status, 201);

    const removed = await fetch(
      `${baseUrl}/care-entries/${currentHousehold.body.id}`,
      { method: "DELETE", headers: headers("user_apollo") },
    );
    assert.equal(removed.status, 204);
    const staleOtherDevice = await createEntry(baseUrl, "user_apollo", {
      householdVisible: false,
      clientKey: "temp_other_household",
    });
    assert.equal(staleOtherDevice.response.status, 410);
    assert.equal(db.entries.length, 0);
  });
});

test("legacy creates without a client key keep their pre-tombstone behavior", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const first = await fetch(`${baseUrl}/care-entries`, {
      method: "POST",
      headers: headers("user_apollo", true),
      body: JSON.stringify({ type: "note", note: "Legacy device" }),
    });
    assert.equal(first.status, 201);
    const firstBody = (await first.json()) as { id: string };
    const removed = await fetch(`${baseUrl}/care-entries/${firstBody.id}`, {
      method: "DELETE",
      headers: headers("user_apollo"),
    });
    assert.equal(removed.status, 204);
    assert.equal(db.tombstones.at(-1)?.clientKey, undefined);

    const second = await fetch(`${baseUrl}/care-entries`, {
      method: "POST",
      headers: headers("user_apollo", true),
      body: JSON.stringify({ type: "note", note: "Legacy device again" }),
    });
    assert.equal(second.status, 201);
    assert.equal(db.entries.length, 1);
  });
});

test("client keys are normalized once and the exact normalized value is returned terminally", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const original = await createEntry(baseUrl, "user_apollo", {
      householdVisible: true,
      clientKey: "  temp_normalized  ",
    });
    assert.equal(original.response.status, 201);
    assert.equal(
      (db.entries[0]?.details as Record<string, unknown>).clientKey,
      "temp_normalized",
    );
    const removed = await fetch(
      `${baseUrl}/care-entries/${original.body.id}`,
      { method: "DELETE", headers: headers("user_apollo") },
    );
    assert.equal(removed.status, 204);
    assert.equal(db.tombstones[0]?.clientKey, "temp_normalized");

    const staleRetry = await createEntry(baseUrl, "user_apollo", {
      householdVisible: true,
      clientKey: " temp_normalized ",
    });
    assert.equal(staleRetry.response.status, 410);
    assert.equal(staleRetry.body.clientKey, "temp_normalized");
    assert.equal(db.entries.length, 0);
  });
});

test("delete-by-client-key commits an idempotent private tombstone even when no live row exists", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const opaqueClientKey = "  temp/off-page?#% identity  ";
    const first = await deleteEntryByClientKey(
      baseUrl,
      "user_apollo",
      opaqueClientKey,
    );
    assert.equal(first.status, 204);
    assert.equal(db.entries.length, 0);
    assert.equal(db.tombstones.length, 1);
    assert.equal(db.tombstones[0]?.clientKey, "temp/off-page?#% identity");
    assert.equal(db.tombstones[0]?.caregiverUserId, "user_apollo");
    assert.equal(db.tombstones[0]?.householdVisible, false);
    assert.equal(db.tombstones[0]?.petId, null);
    assert.match(
      String(db.tombstones[0]?.entryId),
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const repeated = await deleteEntryByClientKey(
      baseUrl,
      "user_apollo",
      opaqueClientKey,
    );
    assert.equal(repeated.status, 204);
    assert.equal(db.tombstones.length, 1, "retries must not duplicate intent");

    const staleCreate = await createEntry(baseUrl, "user_apollo", {
      householdVisible: true,
      clientKey: opaqueClientKey,
    });
    assert.equal(staleCreate.response.status, 410);
    assert.equal(staleCreate.body.clientKey, "temp/off-page?#% identity");
    assert.equal(db.entries.length, 0);
  });
});

test("delete-by-client-key rejects a key that becomes empty after normalization", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const response = await deleteEntryByClientKey(
      baseUrl,
      "user_apollo",
      "   ",
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "A non-empty care entry client key is required.",
    });
    assert.equal(db.entries.length, 0);
    assert.equal(db.tombstones.length, 0);
  });
});

test("delete-by-client-key removes only the exact creator and household row and preserves deletion metadata", async () => {
  const db = createPrivacyDb();
  db.entries.push({
    id: "88888888-8888-4888-8888-888888888888",
    householdId: "99999999-9999-4999-8999-999999999999",
    petId: "pet_other_household",
    caregiverUserId: "user_apollo",
    householdVisible: true,
    details: { clientKey: "temp_scoped_key" },
  });

  await withApi(db, async (baseUrl) => {
    const creator = await createEntry(baseUrl, "user_apollo", {
      householdVisible: true,
      clientKey: "temp_scoped_key",
      note: "Creator row",
    });
    const otherCreator = await createEntry(baseUrl, "user_jordan", {
      householdVisible: false,
      clientKey: "temp_scoped_key",
      note: "Other creator row",
    });
    assert.equal(creator.response.status, 201);
    assert.equal(otherCreator.response.status, 201);

    const response = await deleteEntryByClientKey(
      baseUrl,
      "user_apollo",
      " temp_scoped_key ",
    );
    assert.equal(response.status, 204);
    assert.deepEqual(
      db.entries.map((row) => row.id),
      [
        "88888888-8888-4888-8888-888888888888",
        otherCreator.body.id,
      ],
      "another household and another creator must remain untouched",
    );
    assert.deepEqual(
      {
        entryId: db.tombstones[0]?.entryId,
        petId: db.tombstones[0]?.petId,
        caregiverUserId: db.tombstones[0]?.caregiverUserId,
        householdVisible: db.tombstones[0]?.householdVisible,
        clientKey: db.tombstones[0]?.clientKey,
      },
      {
        entryId: creator.body.id,
        petId: null,
        caregiverUserId: "user_apollo",
        householdVisible: true,
        clientKey: "temp_scoped_key",
      },
    );

    const otherCreatorRetry = await createEntry(baseUrl, "user_jordan", {
      householdVisible: false,
      clientKey: "temp_scoped_key",
    });
    assert.equal(otherCreatorRetry.response.status, 200);
    assert.equal(otherCreatorRetry.body.id, otherCreator.body.id);
  });
});

test("delete-by-client-key wins the delete-first lock order against an in-flight create", async () => {
  const db = createPrivacyDb();
  let releaseFirst = () => {};
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let markFirstEntered = () => {};
  const firstEntered = new Promise<void>((resolve) => {
    markFirstEntered = resolve;
  });

  await withApi(
    db,
    async (baseUrl) => {
      const deleting = deleteEntryByClientKey(
        baseUrl,
        "user_apollo",
        "temp_delete_by_key_first",
      );
      await firstEntered;
      const creating = createEntry(baseUrl, "user_apollo", {
        householdVisible: true,
        clientKey: "temp_delete_by_key_first",
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      releaseFirst();

      const [deleted, created] = await Promise.all([deleting, creating]);
      assert.equal(deleted.status, 204);
      assert.equal(created.response.status, 410);
      assert.equal(db.entries.length, 0);
      assert.equal(db.tombstones.length, 1);
      assert.ok(db.serializedOperations.every(Boolean));
    },
    {
      async beforeSerializedOperation({ sequence }) {
        if (sequence !== 1) return;
        markFirstEntered();
        await firstGate;
      },
    },
  );
});

test("delete-by-client-key wins after an in-flight create commits first", async () => {
  const db = createPrivacyDb();
  let releaseFirst = () => {};
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let markFirstEntered = () => {};
  const firstEntered = new Promise<void>((resolve) => {
    markFirstEntered = resolve;
  });

  await withApi(
    db,
    async (baseUrl) => {
      const creating = createEntry(baseUrl, "user_apollo", {
        householdVisible: true,
        clientKey: "temp_create_before_delete_by_key",
      });
      await firstEntered;
      const deleting = deleteEntryByClientKey(
        baseUrl,
        "user_apollo",
        "temp_create_before_delete_by_key",
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      releaseFirst();

      const [created, deleted] = await Promise.all([creating, deleting]);
      assert.equal(created.response.status, 201);
      assert.equal(deleted.status, 204);
      assert.equal(db.entries.length, 0);
      assert.equal(db.tombstones.length, 1);
      assert.equal(db.tombstones[0]?.entryId, created.body.id);
      assert.equal(
        db.tombstones[0]?.clientKey,
        "temp_create_before_delete_by_key",
      );
      assert.ok(db.serializedOperations.every(Boolean));
    },
    {
      async beforeSerializedOperation({ sequence }) {
        if (sequence !== 1) return;
        markFirstEntered();
        await firstGate;
      },
    },
  );
});

test("delete-by-client-key rolls a live-row delete back when its tombstone cannot commit", async () => {
  const db = createPrivacyDb();
  await withApi(db, async (baseUrl) => {
    const created = await createEntry(baseUrl, "user_apollo", {
      householdVisible: true,
      clientKey: "temp_atomic_delete",
    });
    assert.equal(created.response.status, 201);
    db.failNextTombstoneInsert = true;

    const failed = await deleteEntryByClientKey(
      baseUrl,
      "user_apollo",
      "temp_atomic_delete",
    );
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), {
      error: "Care transaction did not commit.",
    });
    assert.equal(db.entries.length, 1, "the live delete must roll back");
    assert.equal(db.entries[0]?.id, created.body.id);
    assert.equal(db.tombstones.length, 0);

    const retry = await deleteEntryByClientKey(
      baseUrl,
      "user_apollo",
      "temp_atomic_delete",
    );
    assert.equal(retry.status, 204);
    assert.equal(db.entries.length, 0);
    assert.equal(db.tombstones.length, 1);
    assert.equal(db.tombstones[0]?.entryId, created.body.id);
  });
});

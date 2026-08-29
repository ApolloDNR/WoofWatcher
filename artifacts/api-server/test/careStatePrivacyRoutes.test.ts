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

import { createCareStateRouter } from "../src/routes/care-state-router.ts";

const HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const EXPECTED_HOUSEHOLD_HEADER = "X-WoofWatcher-Expected-Household-Id";

type Expression =
  | { op: "and"; conditions: Expression[] }
  | { op: "eq"; left: unknown; right: unknown };

const careStateTable = {
  householdId: "householdId",
  version: "version",
};

function matches(
  expression: Expression,
  row: Record<string, unknown>,
): boolean {
  if (expression.op === "and") {
    return expression.conditions.every((condition) => matches(condition, row));
  }
  return row[String(expression.left)] === expression.right;
}

function createDb(doc: Record<string, unknown>) {
  const row: Record<string, unknown> = {
    householdId: HOUSEHOLD_ID,
    version: 4,
    updatedAt: new Date("2026-08-29T12:00:00.000Z"),
    updatedBy: "user_apollo",
    doc,
  };
  let updateCalls = 0;

  return {
    row,
    get updateCalls() {
      return updateCalls;
    },
    select() {
      return {
        from() {
          return {
            async where(where: Expression) {
              return matches(where, row) ? [row] : [];
            },
          };
        },
      };
    },
    update() {
      updateCalls += 1;
      return {
        set(values: Record<string, unknown>) {
          return {
            where(where: Expression) {
              return {
                async returning() {
                  if (!matches(where, row)) return [];
                  Object.assign(row, values);
                  return [row];
                },
              };
            },
          };
        },
      };
    },
  };
}

async function withApi(
  db: ReturnType<typeof createDb>,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(
    createCareStateRouter({
      careStateTable,
      and: (...conditions: Expression[]) => ({ op: "and", conditions }),
      eq: (left: unknown, right: unknown) => ({ op: "eq", left, right }),
      requireAuth(req: Request, _res: Response, next: NextFunction) {
        (req as Request & { userId?: string }).userId = "user_apollo";
        next();
      },
      getUserId() {
        return "user_apollo";
      },
      async runHouseholdScopedOperation(input: {
        expectedHouseholdId: string;
        operation: (scope: {
          database: unknown;
          householdId: string;
          authorizationRole: string;
          now: Date;
        }) => Promise<unknown>;
      }) {
        assert.equal(input.expectedHouseholdId, HOUSEHOLD_ID);
        return input.operation({
          database: db,
          householdId: HOUSEHOLD_ID,
          authorizationRole: "owner",
          now: new Date("2026-08-29T12:30:00.000Z"),
        });
      },
    } as never),
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

const headers = {
  [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_ID,
};

test("care-state GET strips legacy embedded care-log collections instead of leaking them household-wide", async () => {
  const db = createDb({
    profile: { dogName: "Phoenix" },
    entries: [{ id: "private-entry", details: { householdVisible: false } }],
    careEntries: [{ id: "legacy-private-entry" }],
    careEntryTombstones: [{ entryId: "private-entry" }],
  });

  await withApi(db, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/care-state`, { headers });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      doc: Record<string, unknown>;
    };
    assert.deepEqual(body.doc, { profile: { dogName: "Phoenix" } });
  });
});

test("care-state PUT rejects embedded care-log collections before touching storage", async () => {
  for (const reservedKey of ["entries", "careEntries", "careEntryTombstones"]) {
    const db = createDb({ profile: { dogName: "Phoenix" } });
    await withApi(db, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/care-state`, {
        method: "PUT",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          version: 4,
          doc: {
            profile: { dogName: "Phoenix" },
            [reservedKey]: [{ id: "private-entry" }],
          },
        }),
      });

      assert.equal(response.status, 400, reservedKey);
      assert.deepEqual(await response.json(), {
        error:
          "Care log entries and tombstones must use the private care-entry sync routes.",
      });
      assert.equal(db.updateCalls, 0, reservedKey);
    });
  }
});

test("care-state conflict responses also strip legacy embedded care logs", async () => {
  const db = createDb({
    profile: { dogName: "Phoenix" },
    entries: [{ id: "private-entry", note: "do not disclose" }],
  });

  await withApi(db, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/care-state`, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        version: 3,
        doc: { profile: { dogName: "Phoenix local" } },
      }),
    });
    assert.equal(response.status, 409);
    const body = (await response.json()) as {
      doc: Record<string, unknown>;
    };
    assert.deepEqual(body.doc, { profile: { dogName: "Phoenix" } });
  });
});

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
import { requireExpectedHousehold } from "../src/routes/care-household-capability.ts";

const ACTIVE_HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const EXPECTED_HOUSEHOLD_HEADER = "X-WoofWatcher-Expected-Household-Id";

const fakeCareStateTable = {
  householdId: "careState.householdId",
  version: "careState.version",
};

const careStateRow = {
  householdId: ACTIVE_HOUSEHOLD_ID,
  version: 3,
  updatedAt: new Date("2026-08-28T12:30:00.000Z"),
  updatedBy: "user_route",
  doc: { profile: { dogName: "Phoenix" } },
};

test("the expected-household capability does not normalize a nonblank value into equality", async () => {
  let status: number | null = null;
  let body: unknown;
  const response = {
    set() {
      return response;
    },
    vary() {
      return response;
    },
    status(nextStatus: number) {
      status = nextStatus;
      return response;
    },
    json(nextBody: unknown) {
      body = nextBody;
      return response;
    },
  };

  const result = await requireExpectedHousehold({
    req: {
      get() {
        return ` ${ACTIVE_HOUSEHOLD_ID} `;
      },
    } as Request,
    res: response as unknown as Response,
    userId: "user_route",
    async getActiveHouseholdId() {
      return ACTIVE_HOUSEHOLD_ID;
    },
  });

  assert.equal(result, null);
  assert.equal(status, 412);
  assert.deepEqual(body, {
    error:
      "Active household changed. Refresh household identity before retrying.",
  });
});

async function withApi(
  db: unknown,
  fn: (
    baseUrl: string,
    calls: {
      auth: string[];
      households: string[];
      scopedOperations: string[];
    },
  ) => Promise<void>,
  options: {
    authorizationRole?: string;
    failAfterOperation?: boolean;
  } = {},
): Promise<void> {
  const app = express();
  app.use(express.json());
  const calls = {
    auth: [] as string[],
    households: [] as string[],
    scopedOperations: [] as string[],
  };

  app.use(
    createCareStateRouter({
      careStateTable: fakeCareStateTable,
      and(...conditions: unknown[]) {
        return { op: "and", conditions };
      },
      eq(left: unknown, right: unknown) {
        return { op: "eq", left, right };
      },
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
        const result = await input.operation({
          database: db,
          userId: input.userId,
          householdId: input.expectedHouseholdId,
          role: authorizationRole,
          authorizationRole,
          caregiverName: "Apollo",
        });
        if (options.failAfterOperation) {
          throw new Error("provider commit failed");
        }
        return result;
      },
    }),
  );

  app.use(
    (_error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      res.status(503).json({ error: "Care transaction did not commit." });
    },
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
    expectedAuthorityLookups: 2,
    error:
      "Active household changed. Refresh household identity before retrying.",
  },
] as const) {
  test(`care-state GET and PUT reject a ${capabilityCase.name} expected-household capability before Care access`, async () => {
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

    await withApi(db, async (baseUrl, calls) => {
      for (const request of [
        { method: "GET", body: undefined },
        {
          method: "PUT",
          body: JSON.stringify({ version: 3, doc: { stale: true } }),
        },
      ] as const) {
        const response = await fetch(`${baseUrl}/care-state`, {
          method: request.method,
          headers: {
            ...(request.body ? { "content-type": "application/json" } : {}),
            ...capabilityCase.headers,
          },
          body: request.body,
        });

        assert.equal(response.status, capabilityCase.status, request.method);
        assert.deepEqual(
          await response.json(),
          { error: capabilityCase.error },
          request.method,
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

test("care-state GET returns the authoritative household id", async () => {
  const db = {
    select() {
      return {
        from() {
          return {
            async where() {
              return [careStateRow];
            },
          };
        },
      };
    },
  };

  await withApi(db, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/care-state`, {
      headers: { [EXPECTED_HOUSEHOLD_HEADER]: ACTIVE_HOUSEHOLD_ID },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(
      response.headers.get("vary") ?? "",
      /X-WoofWatcher-Expected-Household-Id/i,
    );
    assert.equal(body.householdId, ACTIVE_HOUSEHOLD_ID);
    assert.equal(body.version, 3);
    assert.equal(body.doc.profile.dogName, "Phoenix");
  });
});

test("care-state optimistic conflict includes the authoritative household id", async () => {
  let updateCalls = 0;
  const db = {
    select() {
      return {
        from() {
          return {
            async where() {
              return [careStateRow];
            },
          };
        },
      };
    },
    update() {
      updateCalls += 1;
      return {
        set() {
          return {
            where() {
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

  await withApi(db, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/care-state`, {
      method: "PUT",
      headers: {
        [EXPECTED_HOUSEHOLD_HEADER]: ACTIVE_HOUSEHOLD_ID,
        "content-type": "application/json",
      },
      body: JSON.stringify({ version: 2, doc: { stale: true } }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.householdId, ACTIVE_HOUSEHOLD_ID);
    assert.equal(body.version, 3);
    assert.deepEqual(body.doc, careStateRow.doc);
    assert.equal(
      updateCalls,
      1,
      "PUT must attempt one version-qualified UPDATE so a concurrent winner cannot be overwritten",
    );
  });
});

test("care-state PUT commits only through a household-and-version-qualified CAS", async () => {
  let selected = false;
  let updateWhere: unknown;
  const updatedRow = {
    ...careStateRow,
    version: 4,
    updatedBy: "user_route",
    doc: { profile: { dogName: "Phoenix", color: "gold" } },
  };
  const db = {
    select() {
      selected = true;
      throw new Error("a successful CAS must not depend on a preflight SELECT");
    },
    update() {
      return {
        set() {
          return {
            where(where: unknown) {
              updateWhere = where;
              return {
                async returning() {
                  return [updatedRow];
                },
              };
            },
          };
        },
      };
    },
  };

  await withApi(db, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/care-state`, {
      method: "PUT",
      headers: {
        [EXPECTED_HOUSEHOLD_HEADER]: ACTIVE_HOUSEHOLD_ID,
        "content-type": "application/json",
      },
      body: JSON.stringify({ version: 3, doc: updatedRow.doc }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.version, 4);
    assert.equal(selected, false);
    assert.deepEqual(updateWhere, {
      op: "and",
      conditions: [
        {
          op: "eq",
          left: fakeCareStateTable.householdId,
          right: ACTIVE_HOUSEHOLD_ID,
        },
        {
          op: "eq",
          left: fakeCareStateTable.version,
          right: 3,
        },
      ],
    });
  });
});

test("care-state PUT rejects fractional and non-advancing integer versions before UPDATE", async () => {
  for (const version of [0, 2.5, 2_147_483_647] as const) {
    let updateCalls = 0;
    const db = {
      update() {
        updateCalls += 1;
        throw new Error("an invalid Care-state version must not reach UPDATE");
      },
    };

    await withApi(db, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/care-state`, {
        method: "PUT",
        headers: {
          [EXPECTED_HOUSEHOLD_HEADER]: ACTIVE_HOUSEHOLD_ID,
          "content-type": "application/json",
        },
        body: JSON.stringify({ version, doc: { invalid: true } }),
      });

      assert.equal(response.status, 400, String(version));
      assert.deepEqual(await response.json(), {
        error:
          "Care state version must be a positive 32-bit integer that can advance.",
      });
      assert.equal(updateCalls, 0, String(version));
    });
  }
});

test("care-state never sends success before the scoped provider transaction commits", async () => {
  const updatedRow = {
    ...careStateRow,
    version: 4,
    doc: { committed: false },
  };
  const db = {
    update() {
      return {
        set() {
          return {
            where() {
              return {
                async returning() {
                  return [updatedRow];
                },
              };
            },
          };
        },
      };
    },
  };

  await withApi(
    db,
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/care-state`, {
        method: "PUT",
        headers: {
          [EXPECTED_HOUSEHOLD_HEADER]: ACTIVE_HOUSEHOLD_ID,
          "content-type": "application/json",
        },
        body: JSON.stringify({ version: 3, doc: updatedRow.doc }),
      });

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: "Care transaction did not commit.",
      });
    },
    { failAfterOperation: true },
  );
});

test("care-state PUT denies teen and helper roles before any Care write", async () => {
  for (const authorizationRole of [
    "teen",
    "kid",
    "sitter",
    "trainer",
  ] as const) {
    let updateCalls = 0;
    const db = {
      update() {
        updateCalls += 1;
        throw new Error("a non-adult Care-state write must not reach UPDATE");
      },
    };

    await withApi(
      db,
      async (baseUrl, calls) => {
        const response = await fetch(`${baseUrl}/care-state`, {
          method: "PUT",
          headers: {
            [EXPECTED_HOUSEHOLD_HEADER]: ACTIVE_HOUSEHOLD_ID,
            "content-type": "application/json",
          },
          body: JSON.stringify({ version: 3, doc: { denied: true } }),
        });

        assert.equal(response.status, 403, authorizationRole);
        assert.deepEqual(await response.json(), {
          error: "Only an owner or adult can update shared Care state.",
        });
        assert.equal(updateCalls, 0, authorizationRole);
        assert.deepEqual(calls.scopedOperations, [ACTIVE_HOUSEHOLD_ID]);
      },
      { authorizationRole },
    );
  }
});

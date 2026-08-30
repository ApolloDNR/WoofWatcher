import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import express, { type RequestHandler } from "express";

import {
  HOUSEHOLD_SCOPED_INTEGRITY_ERROR,
  HouseholdScopedOperationError,
  runHouseholdScopedOperation,
  type HouseholdScopedOperationScope,
  type RunHouseholdScopedOperation,
} from "../src/lib/household-scoped-operation.ts";
import { createHouseholdManagementRouter } from "../src/routes/household-management-router.ts";
import { EXPECTED_HOUSEHOLD_HEADER } from "../src/routes/household-capability.ts";

const USER_ID = "user_owner";
const HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-28T12:00:00.000Z");

const householdsTable = {
  id: "households.id",
  name: "households.name",
};
const householdInvitationsTable = {
  id: "invitations.id",
  householdId: "invitations.householdId",
  lifecycleState: "invitations.lifecycleState",
  createdAt: "invitations.createdAt",
};
const householdMembersTable = {
  id: "members.id",
  userId: "members.userId",
  householdId: "members.householdId",
  role: "members.role",
  displayName: "members.displayName",
  accessPassExpiresAt: "members.accessPassExpiresAt",
  createdAt: "members.createdAt",
};
const householdAuditEventsTable = {
  householdId: "audit.householdId",
  action: "audit.action",
  lifecycleState: "audit.lifecycleState",
  createdAt: "audit.createdAt",
};

const allowAuth: RequestHandler = (_req, _res, next) => next();
const queryOps = {
  and: (...parts: unknown[]) => ({ and: parts }),
  desc: (part: unknown) => ({ desc: part }),
  eq: (left: unknown, right: unknown) => ({ eq: [left, right] }),
  inArray: (left: unknown, right: unknown) => ({ inArray: [left, right] }),
};

function exactMe(name = "Phoenix Pack") {
  return {
    authorityObservedAt: NOW.toISOString(),
    user: {
      id: USER_ID,
      email: "apollo@example.com",
      displayName: "Apollo",
    },
    household: { id: HOUSEHOLD_ID, name, inviteCode: "" },
    members: [
      {
        id: "member-owner",
        userId: USER_ID,
        role: "owner",
        displayName: "Apollo",
        email: "apollo@example.com",
        isSelf: true,
        accessPassExpiresAt: null,
        accessPassExpired: false,
      },
    ],
  };
}

function routerFor(input: {
  runHouseholdScopedOperation: RunHouseholdScopedOperation;
  getUserId?: () => string;
  buildMeInTransaction?: (
    transaction: unknown,
    userId: string,
    householdId: string,
  ) => Promise<ReturnType<typeof exactMe>>;
}) {
  return createHouseholdManagementRouter({
    tables: {
      householdsTable,
      householdAuditEventsTable,
      householdInvitationsTable,
      householdMembersTable,
    },
    queryOps,
    requireAuth: allowAuth,
    getUserId: input.getUserId ?? (() => USER_ID),
    runHouseholdScopedOperation: input.runHouseholdScopedOperation,
    buildMeInTransaction:
      input.buildMeInTransaction ??
      (async () => {
        throw new Error("Exact Me must not run");
      }),
  });
}

async function withServer(
  router: ReturnType<typeof routerFor>,
  work: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(503).json({ error: String(error) });
    },
  );
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address() as AddressInfo;
    await work(`http://127.0.0.1:${port}/api`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
}

function scopeRunner(input: {
  database: unknown;
  events?: string[];
  role?: HouseholdScopedOperationScope["role"];
  failAfterOperation?: Error;
}): RunHouseholdScopedOperation {
  return async (request) => {
    const events = input.events ?? [];
    events.push("transaction:begin");
    assert.equal(request.userId, USER_ID);
    assert.equal(request.expectedHouseholdId, HOUSEHOLD_ID);
    try {
      const result = await request.operation({
        database: input.database,
        userId: USER_ID,
        householdId: HOUSEHOLD_ID,
        membershipId: "member-owner",
        role: input.role ?? "owner",
        authorizationRole: input.role ?? "owner",
        caregiverName: "Apollo",
        now: NOW,
      });
      if (input.failAfterOperation) throw input.failAfterOperation;
      events.push("transaction:commit");
      return result;
    } catch (error) {
      events.push("transaction:rollback");
      throw error;
    }
  };
}

test("all nine management routes reject missing and blank capabilities before authority or table work", async () => {
  let scopedCalls = 0;
  let identityReads = 0;
  const runHouseholdScopedOperation: RunHouseholdScopedOperation = async () => {
    scopedCalls += 1;
    throw new Error("authority must not run");
  };
  const routes = [
    { method: "PATCH", path: "/household", body: { name: "Pack" } },
    { method: "GET", path: "/household/invitations" },
    {
      method: "POST",
      path: "/household/invitations/invite-a/revoke",
      body: {},
    },
    { method: "GET", path: "/household/sharing-cleanup" },
    { method: "GET", path: "/household/audit-events" },
    {
      method: "PATCH",
      path: "/household/members/member-a",
      body: { displayName: "Helper" },
    },
    { method: "DELETE", path: "/household/members/member-a" },
    {
      method: "POST",
      path: "/household/access-passes/activate",
      body: { memberId: "member-a", role: "sitter" },
    },
    {
      method: "POST",
      path: "/household/access-passes/revoke",
      body: { memberId: "member-a" },
    },
  ] as const;

  await withServer(routerFor({
    runHouseholdScopedOperation,
    getUserId() {
      identityReads += 1;
      return USER_ID;
    },
  }), async (base) => {
    for (const capability of [undefined, "   "] as const) {
      for (const route of routes) {
        const response = await fetch(`${base}${route.path}`, {
          method: route.method,
          headers: {
            ...(route.body ? { "content-type": "application/json" } : {}),
            ...(capability === undefined
              ? {}
              : { [EXPECTED_HOUSEHOLD_HEADER]: capability }),
          },
          ...(route.body ? { body: JSON.stringify(route.body) } : {}),
        });
        assert.equal(response.status, 428, `${route.method} ${route.path}`);
      }
    }
  });

  assert.equal(scopedCalls, 0);
  assert.equal(identityReads, 0);
});

test("expired and unknown actor memberships fail before invitation table access", async () => {
  for (const membership of [
    {
      role: "sitter",
      accessPassExpiresAt: NOW,
    },
    {
      role: "former owner",
      accessPassExpiresAt: null,
    },
  ] as const) {
    const events: string[] = [];
    const store = {
      async transaction<T>(
        work: (transaction: {
          database: unknown;
          lockHouseholdMutation(householdId: string): Promise<void>;
          getCurrentTime(): Promise<Date>;
          lockUser(): Promise<{
            id: string;
            activeHouseholdId: string;
            displayName: string;
          }>;
          lockMembership(): Promise<{
            id: string;
            userId: string;
            householdId: string;
            role: string;
            displayName: string;
            accessPassExpiresAt: Date | null;
          }>;
        }) => Promise<T>,
      ): Promise<T> {
        events.push("transaction:begin");
        try {
          return await work({
            database: {
              select() {
                events.push("table:forbidden");
                throw new Error("table access must not run");
              },
            },
            async lockHouseholdMutation() {
              events.push("household-mutation:lock");
            },
            async getCurrentTime() {
              events.push("clock");
              return NOW;
            },
            async lockUser() {
              events.push("user:lock");
              return {
                id: USER_ID,
                activeHouseholdId: HOUSEHOLD_ID,
                displayName: "Apollo",
              };
            },
            async lockMembership() {
              events.push("membership:lock");
              return {
                id: "member-owner",
                userId: USER_ID,
                householdId: HOUSEHOLD_ID,
                role: membership.role,
                displayName: "Apollo",
                accessPassExpiresAt: membership.accessPassExpiresAt,
              };
            },
          });
        } catch (error) {
          events.push("transaction:rollback");
          throw error;
        }
      },
    };
    const runner: RunHouseholdScopedOperation = (request) =>
      runHouseholdScopedOperation({ store, ...request });

    await withServer(routerFor({ runHouseholdScopedOperation: runner }), async (base) => {
      const response = await fetch(`${base}/household/invitations`, {
        headers: { [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_ID },
      });
      assert.equal(response.status, 403);
    });
    assert.deepEqual(events, [
      "transaction:begin",
      "user:lock",
      "membership:lock",
      "clock",
      "transaction:rollback",
    ]);
  }
});

test("a stale expected household is returned as a truthful 412 before route table work", async () => {
  let tableCalls = 0;
  const runner: RunHouseholdScopedOperation = async () => {
    throw new HouseholdScopedOperationError(
      "Active household changed. Refresh household identity before retrying.",
      412,
    );
  };
  await withServer(
    routerFor({
      runHouseholdScopedOperation: runner,
      async buildMeInTransaction() {
        tableCalls += 1;
        return exactMe();
      },
    }),
    async (base) => {
      const response = await fetch(`${base}/household/invitations`, {
        headers: { [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_ID },
      });
      assert.equal(response.status, 412);
      assert.match(JSON.stringify(await response.json()), /Active household changed/);
    },
  );
  assert.equal(tableCalls, 0);
});

test("invitation list and revoke reject unknown persisted roles as typed 409s", async () => {
  let writes = 0;
  const database = {
    select() {
      const chain = {
        from() {
          return chain;
        },
        where() {
          return chain;
        },
        orderBy() {
          return chain;
        },
        async limit() {
          return [{ role: "former owner" }];
        },
        async for() {
          return [{ role: "former owner" }];
        },
      };
      return chain;
    },
    update() {
      writes += 1;
      throw new Error("invalid invitation role must block update");
    },
    insert() {
      writes += 1;
      throw new Error("invalid invitation role must block audit");
    },
  };
  const runner = scopeRunner({ database });

  await withServer(routerFor({ runHouseholdScopedOperation: runner }), async (base) => {
    for (const request of [
      fetch(`${base}/household/invitations`, {
        headers: { [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_ID },
      }),
      fetch(`${base}/household/invitations/invite-a/revoke`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_ID,
        },
        body: "{}",
      }),
    ]) {
      const response = await request;
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), {
        error: HOUSEHOLD_SCOPED_INTEGRITY_ERROR,
      });
    }
  });
  assert.equal(writes, 0);
});

test("a member mutation race returns 409 and rolls back before audit or Exact Me", async () => {
  const events: string[] = [];
  const target = {
    id: "member-helper",
    userId: "user_helper",
    householdId: HOUSEHOLD_ID,
    role: "adult",
    displayName: "Helper",
    accessPassExpiresAt: null,
  };
  const database = {
    select() {
      const chain = {
        from() {
          return chain;
        },
        where() {
          return chain;
        },
        async for(lock: string) {
          events.push(`target:for-${lock}`);
          return [target];
        },
      };
      return chain;
    },
    update() {
      return {
        set() {
          return {
            where() {
              return {
                async returning() {
                  events.push("member:update-zero");
                  return [];
                },
              };
            },
          };
        },
      };
    },
    insert() {
      events.push("audit:forbidden");
      throw new Error("audit must not run");
    },
  };
  const runner = scopeRunner({ database, events });
  let meCalls = 0;

  await withServer(
    routerFor({
      runHouseholdScopedOperation: runner,
      async buildMeInTransaction() {
        meCalls += 1;
        return exactMe();
      },
    }),
    async (base) => {
      const response = await fetch(
        `${base}/household/members/member-helper`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_ID,
          },
          body: JSON.stringify({ displayName: "Updated Helper" }),
        },
      );
      assert.equal(response.status, 409);
    },
  );
  assert.deepEqual(events, [
    "transaction:begin",
    "target:for-update",
    "member:update-zero",
    "transaction:rollback",
  ]);
  assert.equal(meCalls, 0);
});

test("audit failure after a member update rolls back and never leaks a success body", async () => {
  const events: string[] = [];
  const database = {
    select() {
      const chain = {
        from() {
          return chain;
        },
        where() {
          return chain;
        },
        async for() {
          events.push("target:locked");
          return [
            {
              id: "member-helper",
              userId: "user_helper",
              householdId: HOUSEHOLD_ID,
              role: "adult",
              displayName: "Helper",
              accessPassExpiresAt: null,
            },
          ];
        },
      };
      return chain;
    },
    update() {
      return {
        set() {
          return {
            where() {
              return {
                async returning() {
                  events.push("member:updated");
                  return [{ id: "member-helper" }];
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        async values() {
          events.push("audit:failed");
          throw new Error("audit unavailable");
        },
      };
    },
  };
  const runner = scopeRunner({ database, events });
  let meCalls = 0;

  await withServer(
    routerFor({
      runHouseholdScopedOperation: runner,
      async buildMeInTransaction() {
        meCalls += 1;
        return exactMe();
      },
    }),
    async (base) => {
      const response = await fetch(
        `${base}/household/members/member-helper`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_ID,
          },
          body: JSON.stringify({ displayName: "Updated Helper" }),
        },
      );
      assert.equal(response.status, 503);
      assert.match(JSON.stringify(await response.json()), /audit unavailable/);
    },
  );
  assert.deepEqual(events, [
    "transaction:begin",
    "target:locked",
    "member:updated",
    "audit:failed",
    "transaction:rollback",
  ]);
  assert.equal(meCalls, 0);
});

test("successful member mutation audits and builds Exact Me on the same handle before commit", async () => {
  const events: string[] = [];
  const database = {
    select() {
      const chain = {
        from() {
          return chain;
        },
        where() {
          return chain;
        },
        async for() {
          events.push("target:locked");
          return [
            {
              id: "member-helper",
              userId: "user_helper",
              householdId: HOUSEHOLD_ID,
              role: "adult",
              displayName: "Helper",
              accessPassExpiresAt: null,
            },
          ];
        },
      };
      return chain;
    },
    update() {
      return {
        set() {
          return {
            where() {
              return {
                async returning() {
                  events.push("member:updated");
                  return [{ id: "member-helper" }];
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        async values() {
          events.push("audit:inserted");
        },
      };
    },
  };
  const runner = scopeRunner({ database, events });

  await withServer(
    routerFor({
      runHouseholdScopedOperation: runner,
      async buildMeInTransaction(transaction, userId, householdId) {
        assert.equal(transaction, database);
        assert.equal(userId, USER_ID);
        assert.equal(householdId, HOUSEHOLD_ID);
        events.push("exact-me");
        return exactMe();
      },
    }),
    async (base) => {
      const response = await fetch(
        `${base}/household/members/member-helper`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_ID,
          },
          body: JSON.stringify({ displayName: "Updated Helper" }),
        },
      );
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.household.id, HOUSEHOLD_ID);
      assert.equal(body.auditEvent.action, "member-role-updated");
    },
  );
  assert.deepEqual(events, [
    "transaction:begin",
    "target:locked",
    "member:updated",
    "audit:inserted",
    "exact-me",
    "transaction:commit",
  ]);
});

test("household rename trims a real name, rejects blank input, and defers success until commit", async () => {
  const events: string[] = [];
  let storedName = "";
  const database = {
    update() {
      return {
        set(values: { name: string }) {
          storedName = values.name;
          return {
            where() {
              return {
                async returning() {
                  events.push("household:renamed");
                  return [{ id: HOUSEHOLD_ID }];
                },
              };
            },
          };
        },
      };
    },
  };
  let scopedCalls = 0;
  const runner = scopeRunner({ database, events });
  const countedRunner: RunHouseholdScopedOperation = async (input) => {
    scopedCalls += 1;
    return runner(input);
  };

  await withServer(
    routerFor({
      runHouseholdScopedOperation: countedRunner,
      async buildMeInTransaction(transaction) {
        assert.equal(transaction, database);
        events.push("exact-me");
        return exactMe("Trail Pack");
      },
    }),
    async (base) => {
      const headers = {
        "content-type": "application/json",
        [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_ID,
      };
      const blank = await fetch(`${base}/household`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: "   " }),
      });
      assert.equal(blank.status, 400);
      const renamed = await fetch(`${base}/household`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: "  Trail Pack  " }),
      });
      assert.equal(renamed.status, 200);
      assert.equal((await renamed.json()).household.name, "Trail Pack");
    },
  );
  assert.equal(scopedCalls, 1);
  assert.equal(storedName, "Trail Pack");
  assert.deepEqual(events, [
    "transaction:begin",
    "household:renamed",
    "exact-me",
    "transaction:commit",
  ]);
});

import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import express, { type RequestHandler } from "express";

import { HouseholdMembershipActivationError } from "../src/lib/household-membership-activation.ts";
import { HouseholdAuthoritySnapshotError } from "../src/lib/household-me-snapshot.ts";
import { createHouseholdMembershipRouter } from "../src/routes/household-membership-router.ts";
import { EXPECTED_HOUSEHOLD_HEADER } from "../src/routes/household-capability.ts";

const USER_A = "user_a";
const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";

const ME = {
  authorityObservedAt: "2026-08-29T12:00:00.000Z",
  user: { id: USER_A, email: null, displayName: "Apollo" },
  household: { id: HOUSEHOLD_B, name: "Trail Pack", inviteCode: "" },
  members: [
    {
      id: "member-b",
      userId: USER_A,
      role: "owner",
      displayName: "Apollo",
      email: null,
      isSelf: true,
      accessPassExpiresAt: null,
      accessPassExpired: false,
    },
  ],
};

async function withServer(
  build: () => {
    app: express.Express;
    calls: { list: number; activate: number };
  },
  work: (
    baseUrl: string,
    calls: { list: number; activate: number },
  ) => Promise<void>,
): Promise<void> {
  const { app, calls } = build();
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address() as AddressInfo;
    await work(`http://127.0.0.1:${port}`, calls);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
}

function appWith(
  overrides: {
    list?: () => Promise<unknown>;
    activate?: () => Promise<{ householdId: string; me: typeof ME }>;
  } = {},
) {
  const app = express();
  app.use(express.json());
  const calls = { list: 0, activate: 0 };
  const fakeAuth: RequestHandler = (req, _res, next) => {
    (req as express.Request & { userId?: string }).userId = USER_A;
    next();
  };
  app.use(
    "/api",
    createHouseholdMembershipRouter({
      requireAuth: fakeAuth,
      getUserId: (req) => (req as express.Request & { userId: string }).userId,
      async listMemberships() {
        calls.list += 1;
        return overrides.list
          ? overrides.list()
          : {
              activeHouseholdId: HOUSEHOLD_A,
              memberships: [
                {
                  householdId: HOUSEHOLD_A,
                  householdName: "Phoenix Pack",
                  role: "owner" as const,
                  accessPassExpiresAt: null,
                },
              ],
            };
      },
      async activateMembership() {
        calls.activate += 1;
        return overrides.activate
          ? overrides.activate()
          : { householdId: HOUSEHOLD_B, me: ME };
      },
    }),
  );
  return { app, calls };
}

test("membership routes reject missing and blank capabilities before handlers and set private Vary headers", async () => {
  await withServer(appWith, async (baseUrl, calls) => {
    for (const value of [undefined, "   "] as const) {
      const response = await fetch(`${baseUrl}/api/household/memberships`, {
        headers:
          value === undefined ? {} : { [EXPECTED_HOUSEHOLD_HEADER]: value },
      });
      assert.equal(response.status, 428);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.match(
        response.headers.get("vary") ?? "",
        new RegExp(EXPECTED_HOUSEHOLD_HEADER, "i"),
      );
    }
    assert.deepEqual(calls, { list: 0, activate: 0 });
  });
});

test("GET memberships carries the exact source and returns only the safe list envelope", async () => {
  let received: unknown;
  await withServer(
    () =>
      appWith({
        list: async function () {
          return {
            activeHouseholdId: HOUSEHOLD_A,
            memberships: [
              {
                householdId: HOUSEHOLD_A,
                householdName: "Phoenix Pack",
                role: "owner" as const,
                accessPassExpiresAt: null,
              },
            ],
          };
        },
      }),
    async (baseUrl, calls) => {
      const response = await fetch(`${baseUrl}/api/household/memberships`, {
        headers: { [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_A },
      });
      received = await response.json();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.match(
        response.headers.get("vary") ?? "",
        /expected-household-id/i,
      );
      assert.deepEqual(calls, { list: 1, activate: 0 });
    },
  );
  assert.deepEqual(received, {
    activeHouseholdId: HOUSEHOLD_A,
    memberships: [
      {
        householdId: HOUSEHOLD_A,
        householdName: "Phoenix Pack",
        role: "owner",
        accessPassExpiresAt: null,
      },
    ],
  });
});

test("POST activation validates the body after the capability but before activation", async () => {
  await withServer(appWith, async (baseUrl, calls) => {
    const response = await fetch(`${baseUrl}/api/household/activate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_A,
      },
      body: JSON.stringify({ householdId: "not-a-uuid" }),
    });
    assert.equal(response.status, 400);
    assert.equal(calls.activate, 0);
  });
});

test("POST activation carries source and target authority and returns only exact target Me", async () => {
  let receivedInput:
    | {
        userId: string;
        expectedSourceHouseholdId: string;
        targetHouseholdId: string;
      }
    | undefined;
  await withServer(
    () => {
      const base = appWith();
      const app = express();
      app.use(express.json());
      const calls = { list: 0, activate: 0 };
      const fakeAuth: RequestHandler = (req, _res, next) => {
        (req as express.Request & { userId?: string }).userId = USER_A;
        next();
      };
      app.use(
        "/api",
        createHouseholdMembershipRouter({
          requireAuth: fakeAuth,
          getUserId: () => USER_A,
          async listMemberships() {
            calls.list += 1;
            return { activeHouseholdId: HOUSEHOLD_A, memberships: [] };
          },
          async activateMembership(input) {
            calls.activate += 1;
            receivedInput = input;
            return { householdId: HOUSEHOLD_B, me: ME };
          },
        }),
      );
      void base;
      return { app, calls };
    },
    async (baseUrl, calls) => {
      const response = await fetch(`${baseUrl}/api/household/activate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_A,
        },
        body: JSON.stringify({ householdId: HOUSEHOLD_B }),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), ME);
      assert.deepEqual(receivedInput, {
        userId: USER_A,
        expectedSourceHouseholdId: HOUSEHOLD_A,
        targetHouseholdId: HOUSEHOLD_B,
      });
      assert.deepEqual(calls, { list: 0, activate: 1 });
    },
  );
});

test("route errors preserve exact 403, 409, and 412 semantics without a response snapshot", async () => {
  for (const status of [403, 409, 412] as const) {
    await withServer(
      () =>
        appWith({
          activate: async () => {
            throw new HouseholdMembershipActivationError("blocked", status);
          },
        }),
      async (baseUrl, calls) => {
        const response = await fetch(`${baseUrl}/api/household/activate`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_A,
          },
          body: JSON.stringify({ householdId: HOUSEHOLD_B }),
        });
        assert.equal(response.status, status);
        assert.deepEqual(await response.json(), { error: "blocked" });
        assert.equal(calls.activate, 1);
      },
    );
  }
});

test("an in-transaction exact-snapshot conflict remains a truthful 409", async () => {
  await withServer(
    () =>
      appWith({
        activate: async () => {
          throw new HouseholdAuthoritySnapshotError("snapshot conflict");
        },
      }),
    async (baseUrl, calls) => {
      const response = await fetch(`${baseUrl}/api/household/activate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_A,
        },
        body: JSON.stringify({ householdId: HOUSEHOLD_B }),
      });
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { error: "snapshot conflict" });
      assert.equal(calls.activate, 1);
    },
  );
});

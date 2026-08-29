import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import express, { type RequestHandler } from "express";

import { createHouseholdMembershipRouter } from "../src/routes/household-membership-router.ts";
import { EXPECTED_HOUSEHOLD_HEADER } from "../src/routes/household-capability.ts";

const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";

test("unauthenticated membership GET and POST stop before every capability handler", async () => {
  const calls = {
    auth: 0,
    getUserId: 0,
    list: 0,
    activate: 0,
  };
  const rejectAuth: RequestHandler = (_req, res) => {
    calls.auth += 1;
    res.status(401).json({ error: "Unauthorized" });
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createHouseholdMembershipRouter({
      requireAuth: rejectAuth,
      getUserId() {
        calls.getUserId += 1;
        return "must-not-run";
      },
      async listMemberships() {
        calls.list += 1;
        throw new Error("must not list while unauthenticated");
      },
      async activateMembership() {
        calls.activate += 1;
        throw new Error("must not activate while unauthenticated");
      },
    }),
  );

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;
    const requests = [
      fetch(`${baseUrl}/api/household/memberships`, {
        headers: { [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_A },
      }),
      fetch(`${baseUrl}/api/household/activate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [EXPECTED_HOUSEHOLD_HEADER]: HOUSEHOLD_A,
        },
        body: JSON.stringify({ householdId: HOUSEHOLD_B }),
      }),
    ];

    for (const response of await Promise.all(requests)) {
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Unauthorized" });
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }

  assert.deepEqual(calls, {
    auth: 2,
    getUserId: 0,
    list: 0,
    activate: 0,
  });
});

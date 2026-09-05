import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

const ROUTER_MODULE_PATH = new URL(
  "../src/routes/household-update-router.ts",
  import.meta.url,
);

type HouseholdUpdateRouterDependencies = {
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  getUserId: (req: Request) => string;
  ensureUserAndHousehold: (userId: string) => Promise<{ householdId: string }>;
  getHouseholdMemberAuthz: (
    householdId: string,
    userId: string,
  ) => Promise<{ role?: string | null } | null>;
  rejectMismatchedHouseholdRequestScope: (
    req: Request,
    res: Response,
    householdId: string,
  ) => boolean;
  updateHouseholdName: (householdId: string, name: string) => Promise<void>;
  buildMe: (userId: string, householdId: string) => Promise<unknown>;
};

type CreateHouseholdUpdateRouter = (
  dependencies: HouseholdUpdateRouterDependencies,
) => express.Router;

async function loadRouterFactory(): Promise<CreateHouseholdUpdateRouter> {
  assert.equal(
    existsSync(ROUTER_MODULE_PATH),
    true,
    "the household update endpoint must have a behavior-testable router boundary",
  );
  const module = (await import(ROUTER_MODULE_PATH.href)) as {
    createHouseholdUpdateRouter?: CreateHouseholdUpdateRouter;
  };
  assert.equal(typeof module.createHouseholdUpdateRouter, "function");
  return module.createHouseholdUpdateRouter as CreateHouseholdUpdateRouter;
}

async function withHouseholdUpdateApi(
  role: string,
  run: (
    baseUrl: string,
    state: { householdName: string; updateCount: number },
  ) => Promise<void>,
): Promise<void> {
  const createHouseholdUpdateRouter = await loadRouterFactory();
  const state = { householdName: "Phoenix House", updateCount: 0 };
  const householdId = "11111111-1111-4111-8111-111111111111";
  const userId = "owner_user";
  const app = express();
  app.use(express.json());
  app.use(
    createHouseholdUpdateRouter({
      requireAuth(req, _res, next) {
        (req as Request & { userId?: string }).userId = userId;
        next();
      },
      getUserId(req) {
        return (req as Request & { userId?: string }).userId ?? "missing-user";
      },
      async ensureUserAndHousehold() {
        return { householdId };
      },
      async getHouseholdMemberAuthz() {
        return { role };
      },
      rejectMismatchedHouseholdRequestScope() {
        return false;
      },
      async updateHouseholdName(activeHouseholdId, name) {
        assert.equal(activeHouseholdId, householdId);
        state.updateCount += 1;
        state.householdName = name;
      },
      async buildMe() {
        return {
          user: {
            id: userId,
            email: "owner@example.com",
            displayName: "Apollo",
          },
          household: {
            id: householdId,
            name: state.householdName,
            inviteCode: "PHX123",
          },
          members: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              userId,
              role,
              displayName: "Apollo",
              email: "owner@example.com",
              isSelf: true,
              accessPassExpiresAt: null,
              accessPassExpired: false,
              careStateWriteAllowed: role === "owner" || role === "adult",
            },
          ],
        };
      },
    }),
  );

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`, state);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test("PATCH /household rejects a non-owner without mutating the household", async () => {
  await withHouseholdUpdateApi("adult", async (baseUrl, state) => {
    const response = await fetch(`${baseUrl}/household`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Unauthorized Rename" }),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "Only an owner/admin can change household settings.",
    });
    assert.equal(state.householdName, "Phoenix House");
    assert.equal(state.updateCount, 0);
  });
});

test("PATCH /household lets an owner rename the active household", async () => {
  await withHouseholdUpdateApi("owner", async (baseUrl, state) => {
    const response = await fetch(`${baseUrl}/household`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Phoenix Family" }),
    });
    const body = (await response.json()) as {
      household: { name: string };
    };

    assert.equal(response.status, 200);
    assert.equal(body.household.name, "Phoenix Family");
    assert.equal(state.householdName, "Phoenix Family");
    assert.equal(state.updateCount, 1);
  });
});

test("PATCH /household trims a valid household name before storing it", async () => {
  await withHouseholdUpdateApi("owner", async (baseUrl, state) => {
    const response = await fetch(`${baseUrl}/household`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "  Phoenix Family  " }),
    });
    const body = (await response.json()) as {
      household: { name: string };
    };

    assert.equal(response.status, 200);
    assert.equal(body.household.name, "Phoenix Family");
    assert.equal(state.householdName, "Phoenix Family");
    assert.equal(state.updateCount, 1);
  });
});

test("PATCH /household rejects a whitespace-only household name without mutating", async () => {
  await withHouseholdUpdateApi("owner", async (baseUrl, state) => {
    const response = await fetch(`${baseUrl}/household`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "   \t  " }),
    });

    assert.equal(response.status, 400);
    assert.equal(state.householdName, "Phoenix House");
    assert.equal(state.updateCount, 0);
  });
});

test("PATCH /household rejects names longer than 80 characters without mutating", async () => {
  await withHouseholdUpdateApi("owner", async (baseUrl, state) => {
    const response = await fetch(`${baseUrl}/household`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "H".repeat(81) }),
    });

    assert.equal(response.status, 400);
    assert.equal(state.householdName, "Phoenix House");
    assert.equal(state.updateCount, 0);
  });
});

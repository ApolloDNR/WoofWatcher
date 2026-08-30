import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import express, { type ErrorRequestHandler } from "express";

import {
  type HouseholdInvitationCreateRecord,
  type HouseholdInvitationCreateStore,
  type HouseholdInvitationCreateTransaction,
} from "../src/lib/household-invitation-create.ts";
import {
  EXPECTED_HOUSEHOLD_HEADER,
  EXPECTED_HOUSEHOLD_REQUIRED_ERROR,
} from "../src/routes/household-capability.ts";
import {
  createHouseholdInvitationCreateHandler,
  type InvitationCreatedHouseholdAuditEvent,
} from "../src/routes/household-invitation-create-handler.ts";

const USER_A = "user_a";
const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const MEMBER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-08-28T12:00:00.000Z");
const FUTURE = "2026-08-29T12:00:00.000Z";

interface RouteState {
  invitations: HouseholdInvitationCreateRecord[];
  audits: InvitationCreatedHouseholdAuditEvent[];
}

function cloneState(state: RouteState): RouteState {
  return {
    invitations: state.invitations.map((invitation) => ({ ...invitation })),
    audits: state.audits.map((audit) => ({ ...audit })),
  };
}

class RouteInvitationStore implements HouseholdInvitationCreateStore<InvitationCreatedHouseholdAuditEvent> {
  state: RouteState = { invitations: [], audits: [] };
  transactionCalls = 0;
  candidateCalls = 0;
  insertCalls = 0;
  auditCalls = 0;
  commits = 0;
  rollbacks = 0;
  failAudit = false;
  user = { id: USER_A, activeHouseholdId: HOUSEHOLD_A };

  async transaction<T>(
    work: (
      transaction: HouseholdInvitationCreateTransaction<InvitationCreatedHouseholdAuditEvent>,
    ) => Promise<T>,
  ): Promise<T> {
    this.transactionCalls += 1;
    const draft = cloneState(this.state);
    try {
      const result = await work({
        lockHouseholds: async () => {},
        lockUser: async () => ({ ...this.user }),
        lockActorMembership: async () => ({
          id: MEMBER_A,
          userId: USER_A,
          householdId: HOUSEHOLD_A,
          role: "owner",
        }),
        getCurrentTime: async () => new Date(NOW),
        nextInviteCodeCandidate: async () => {
          this.candidateCalls += 1;
          return "FRESH123";
        },
        tryInsertInvitation: async (input) => {
          this.insertCalls += 1;
          const invitation: HouseholdInvitationCreateRecord = {
            id: "invitation-1",
            householdId: input.householdId,
            inviteCode: input.inviteCode,
            invitedEmail: input.invitedEmail,
            role: input.role,
            lifecycleState: input.lifecycleState,
            createdByUserId: input.actorUserId,
            approvedByUserId: input.approvedByUserId,
            note: input.note,
            expiresAt: input.expiresAt,
            createdAt: input.createdAt,
          };
          draft.invitations.push(invitation);
          return { status: "created" as const, invitation };
        },
        recordAudit: async (event) => {
          this.auditCalls += 1;
          if (this.failAudit) throw new Error("scripted audit failure");
          draft.audits.push({ ...event });
        },
      });
      this.state = draft;
      this.commits += 1;
      return result;
    } catch (error) {
      this.rollbacks += 1;
      throw error;
    }
  }
}

async function withInvitationServer(
  store: RouteInvitationStore,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.post(
    "/household/invitations",
    createHouseholdInvitationCreateHandler({
      getUserId: () => USER_A,
      store,
    }),
  );
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    res.status(500).json({ error: String(error?.message ?? error) });
  };
  app.use(errorHandler);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function invitationRequest(
  baseUrl: string,
  input: {
    expectedHouseholdId?: string;
    body?: unknown;
  } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (input.expectedHouseholdId !== undefined) {
    headers[EXPECTED_HOUSEHOLD_HEADER] = input.expectedHouseholdId;
  }
  return fetch(`${baseUrl}/household/invitations`, {
    method: "POST",
    headers,
    body: JSON.stringify(
      input.body ?? {
        invitedEmail: "caregiver@example.com",
        role: "walker",
        lifecycleState: "approved",
        expiresAt: FUTURE,
        note: "Evening care",
      },
    ),
  });
}

test("missing and blank invitation capabilities perform zero database work", async () => {
  for (const expectedHouseholdId of [undefined, "   "]) {
    const store = new RouteInvitationStore();
    await withInvitationServer(store, async (baseUrl) => {
      const response = await invitationRequest(baseUrl, {
        expectedHouseholdId,
      });
      assert.equal(response.status, 428);
      assert.deepEqual(await response.json(), {
        error: EXPECTED_HOUSEHOLD_REQUIRED_ERROR,
      });
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      assert.match(
        response.headers.get("vary") ?? "",
        new RegExp(EXPECTED_HOUSEHOLD_HEADER, "i"),
      );
    });
    assert.equal(store.transactionCalls, 0);
    assert.equal(store.insertCalls, 0);
    assert.equal(store.auditCalls, 0);
  }
});

test("an invalid invitation body is rejected before opening a transaction", async () => {
  const store = new RouteInvitationStore();
  await withInvitationServer(store, async (baseUrl) => {
    const response = await invitationRequest(baseUrl, {
      expectedHouseholdId: HOUSEHOLD_A,
      body: { invitedEmail: "not-an-email" },
    });
    assert.equal(response.status, 400);
  });
  assert.equal(store.transactionCalls, 0);
  assert.equal(store.insertCalls, 0);
  assert.equal(store.auditCalls, 0);
});

test("a source switch mismatch rolls back with no invitation or audit write", async () => {
  const store = new RouteInvitationStore();
  store.user = { id: USER_A, activeHouseholdId: HOUSEHOLD_B };

  await withInvitationServer(store, async (baseUrl) => {
    const response = await invitationRequest(baseUrl, {
      expectedHouseholdId: HOUSEHOLD_A,
    });
    assert.equal(response.status, 412);
    assert.match(
      String(((await response.json()) as { error: string }).error),
      /changed/i,
    );
  });

  assert.equal(store.transactionCalls, 1);
  assert.equal(store.candidateCalls, 0);
  assert.equal(store.insertCalls, 0);
  assert.equal(store.auditCalls, 0);
  assert.equal(store.commits, 0);
  assert.equal(store.rollbacks, 1);
  assert.deepEqual(store.state, { invitations: [], audits: [] });
});

test("an audit insert failure rolls back the invitation and returns no success", async () => {
  const store = new RouteInvitationStore();
  store.failAudit = true;

  await withInvitationServer(store, async (baseUrl) => {
    const response = await invitationRequest(baseUrl, {
      expectedHouseholdId: HOUSEHOLD_A,
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "scripted audit failure",
    });
  });

  assert.equal(store.insertCalls, 1);
  assert.equal(store.auditCalls, 1);
  assert.equal(store.commits, 0);
  assert.equal(store.rollbacks, 1);
  assert.deepEqual(store.state, { invitations: [], audits: [] });
});

test("success returns the exact invitation and audit committed together", async () => {
  const store = new RouteInvitationStore();
  let body: any;

  await withInvitationServer(store, async (baseUrl) => {
    const response = await invitationRequest(baseUrl, {
      expectedHouseholdId: HOUSEHOLD_A,
    });
    assert.equal(response.status, 201);
    body = await response.json();
  });

  assert.equal(store.commits, 1);
  assert.equal(store.rollbacks, 0);
  assert.equal(store.state.invitations.length, 1);
  assert.equal(store.state.audits.length, 1);
  assert.deepEqual(body.invitation, {
    id: "invitation-1",
    householdId: HOUSEHOLD_A,
    inviteCode: "FRESH123",
    invitedEmail: "caregiver@example.com",
    invitedUserId: null,
    role: "walker",
    lifecycleState: "approved",
    runtimeLifecycleState: "approved",
    expired: false,
    createdByUserId: USER_A,
    approvedByUserId: USER_A,
    acceptedByUserId: null,
    revokedByUserId: null,
    rejectedByUserId: null,
    note: "Evening care",
    expiresAt: FUTURE,
    acceptedAt: null,
    revokedAt: null,
    rejectedAt: null,
    createdAt: NOW.toISOString(),
    updatedAt: null,
    storage: "provider-durable",
    boundary:
      "Durable household invitation lifecycle storage is provider-ready; Supabase migration, RLS, retention, export/deletion policy, and notification delivery remain launch approval gates.",
  });
  assert.deepEqual(body.auditEvent, store.state.audits[0]);
  assert.equal(body.auditEvent.householdId, HOUSEHOLD_A);
  assert.equal(body.auditEvent.actorUserId, USER_A);
  assert.equal(body.auditEvent.nextRole, "walker");
  assert.equal(body.auditEvent.createdAt, NOW.toISOString());
});

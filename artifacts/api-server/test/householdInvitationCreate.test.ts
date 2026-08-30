import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HOUSEHOLD_INVITATION_CODE_ATTEMPTS,
  HouseholdInvitationCreateError,
  createHouseholdInvitationAtomically,
  type HouseholdInvitationCreateRecord,
  type HouseholdInvitationCreateStore,
  type HouseholdInvitationCreateTransaction,
} from "../src/lib/household-invitation-create.ts";

const USER_A = "user_a";
const USER_B = "user_b";
const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const MEMBER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-08-28T12:00:00.000Z");
const FUTURE = new Date("2026-08-29T12:00:00.000Z");

interface InvitationAudit {
  id: string;
  action: "invitation-created";
  actorUserId: string;
  householdId: string;
  invitationId: string;
  inviteCode: string;
  nextRole: string;
  lifecycleState: "invite-created";
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface StoreState {
  invitations: Map<string, HouseholdInvitationCreateRecord>;
  audits: InvitationAudit[];
}

function cloneInvitation(
  invitation: HouseholdInvitationCreateRecord,
): HouseholdInvitationCreateRecord {
  return {
    ...invitation,
    expiresAt:
      invitation.expiresAt instanceof Date
        ? new Date(invitation.expiresAt)
        : invitation.expiresAt,
    createdAt:
      invitation.createdAt instanceof Date
        ? new Date(invitation.createdAt)
        : invitation.createdAt,
  };
}

function cloneState(state: StoreState): StoreState {
  return {
    invitations: new Map(
      [...state.invitations].map(([code, invitation]) => [
        code,
        cloneInvitation(invitation),
      ]),
    ),
    audits: state.audits.map((audit) => ({ ...audit })),
  };
}

class InMemoryInvitationCreateStore implements HouseholdInvitationCreateStore<InvitationAudit> {
  state: StoreState = { invitations: new Map(), audits: [] };
  events: string[] = [];
  candidateCodes: string[] = ["FRESH123"];
  collidingCodes = new Set<string>();
  now = new Date(NOW);
  user: { id: string; activeHouseholdId: string | null } | null = {
    id: USER_A,
    activeHouseholdId: HOUSEHOLD_A,
  };
  membership: {
    id: string;
    userId: string;
    householdId: string;
    role: string;
  } | null = {
    id: MEMBER_A,
    userId: USER_A,
    householdId: HOUSEHOLD_A,
    role: "owner",
  };
  failInsert = false;
  failAudit = false;
  malformedCreatedInvitation: Partial<HouseholdInvitationCreateRecord> | null =
    null;
  transactionCalls = 0;
  commits = 0;
  rollbacks = 0;

  async transaction<T>(
    work: (
      transaction: HouseholdInvitationCreateTransaction<InvitationAudit>,
    ) => Promise<T>,
  ): Promise<T> {
    this.transactionCalls += 1;
    this.events.push("transaction:begin");
    const draft = cloneState(this.state);
    try {
      const result = await work({
        lockHouseholds: async (householdIds) => {
          this.events.push(`lock-households:${householdIds.join(",")}`);
        },
        lockUser: async (userId) => {
          this.events.push(`lock-user:${userId}`);
          return this.user ? { ...this.user } : null;
        },
        lockActorMembership: async (userId, householdId) => {
          this.events.push(`lock-membership:${userId}:${householdId}`);
          return this.membership ? { ...this.membership } : null;
        },
        getCurrentTime: async () => {
          this.events.push("db-clock");
          return new Date(this.now);
        },
        nextInviteCodeCandidate: async () => {
          this.events.push("candidate");
          const candidate = this.candidateCodes.shift();
          if (candidate === undefined) {
            throw new Error("candidate generator exhausted unexpectedly");
          }
          return candidate;
        },
        tryInsertInvitation: async (input) => {
          this.events.push(`insert:${input.inviteCode}`);
          if (this.failInsert) throw new Error("invitation insert failed");
          if (
            this.collidingCodes.has(input.inviteCode) ||
            draft.invitations.has(input.inviteCode)
          ) {
            return { status: "collision" as const };
          }
          const invitation: HouseholdInvitationCreateRecord = {
            id: `invitation-${input.inviteCode}`,
            householdId: input.householdId,
            inviteCode: input.inviteCode,
            invitedEmail: input.invitedEmail,
            role: input.role,
            lifecycleState: input.lifecycleState,
            createdByUserId: input.actorUserId,
            approvedByUserId: input.approvedByUserId,
            note: input.note,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            createdAt: new Date(input.createdAt),
            ...this.malformedCreatedInvitation,
          };
          draft.invitations.set(input.inviteCode, invitation);
          return { status: "created" as const, invitation };
        },
        recordAudit: async (event) => {
          this.events.push(`audit:${event.invitationId}`);
          if (this.failAudit) throw new Error("audit insert failed");
          draft.audits.push({ ...event });
        },
      });
      this.state = draft;
      this.commits += 1;
      this.events.push("transaction:commit");
      return result;
    } catch (error) {
      this.rollbacks += 1;
      this.events.push("transaction:rollback");
      throw error;
    }
  }
}

function buildAuditEvent(input: {
  invitation: HouseholdInvitationCreateRecord;
  actorMembership: {
    id: string;
    userId: string;
    householdId: string;
    role: string;
  };
  now: Date;
}): InvitationAudit {
  return {
    id: `audit-${input.invitation.id}`,
    action: "invitation-created",
    actorUserId: input.actorMembership.userId,
    householdId: input.actorMembership.householdId,
    invitationId: input.invitation.id,
    inviteCode: input.invitation.inviteCode,
    nextRole: input.invitation.role,
    lifecycleState: "invite-created",
    note: input.invitation.note ?? null,
    expiresAt: input.invitation.expiresAt
      ? new Date(input.invitation.expiresAt).toISOString()
      : null,
    createdAt: input.now.toISOString(),
  };
}

function createInput(
  store: InMemoryInvitationCreateStore,
  overrides: Partial<
    Parameters<typeof createHouseholdInvitationAtomically<InvitationAudit>>[0]
  > = {},
) {
  return {
    store,
    actorUserId: USER_A,
    householdId: HOUSEHOLD_A,
    expectedSourceHouseholdId: HOUSEHOLD_A,
    invitedEmail: "caregiver@example.com",
    role: "adult",
    lifecycleState: "approved" as const,
    note: "Evening care",
    expiresAt: FUTURE,
    buildAuditEvent,
    ...overrides,
  };
}

async function expectCreateError(
  promise: Promise<unknown>,
  status: 400 | 403 | 409 | 412 | 428,
): Promise<void> {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof HouseholdInvitationCreateError);
    assert.equal(error.status, status);
    return true;
  });
}

test("atomic creation retries a unique-code collision and commits the matching invitation and audit", async () => {
  const store = new InMemoryInvitationCreateStore();
  store.collidingCodes.add("COLLIDE1");
  store.candidateCodes = ["COLLIDE1", "FRESH123"];

  const result = await createHouseholdInvitationAtomically(createInput(store));

  assert.equal(result.invitation.inviteCode, "FRESH123");
  assert.equal(result.invitation.approvedByUserId, USER_A);
  assert.equal(result.auditEvent.invitationId, result.invitation.id);
  assert.equal(result.auditEvent.inviteCode, result.invitation.inviteCode);
  assert.equal(result.auditEvent.actorUserId, USER_A);
  assert.equal(result.auditEvent.householdId, HOUSEHOLD_A);
  assert.equal(result.auditEvent.nextRole, "adult");
  assert.equal(result.auditEvent.createdAt, NOW.toISOString());
  assert.deepEqual([...store.state.invitations.keys()], ["FRESH123"]);
  assert.deepEqual(store.state.audits, [result.auditEvent]);
  assert.deepEqual(store.events, [
    "transaction:begin",
    `lock-households:${HOUSEHOLD_A}`,
    `lock-user:${USER_A}`,
    `lock-membership:${USER_A}:${HOUSEHOLD_A}`,
    "db-clock",
    "candidate",
    "insert:COLLIDE1",
    "candidate",
    "insert:FRESH123",
    `audit:${result.invitation.id}`,
    "transaction:commit",
  ]);
});

test("only approved and pending invitations are created, with nullable or future expiry", async () => {
  for (const scenario of [
    {
      lifecycleState: "approved" as const,
      expiresAt: FUTURE,
      approvedByUserId: USER_A,
    },
    {
      lifecycleState: "pending-approval" as const,
      expiresAt: null,
      approvedByUserId: null,
    },
  ]) {
    const store = new InMemoryInvitationCreateStore();
    store.membership = { ...store.membership!, role: "admin" };
    const result = await createHouseholdInvitationAtomically(
      createInput(store, scenario),
    );
    assert.equal(result.invitation.lifecycleState, scenario.lifecycleState);
    assert.equal(result.invitation.approvedByUserId, scenario.approvedByUserId);
    assert.equal(
      result.invitation.expiresAt
        ? new Date(result.invitation.expiresAt).toISOString()
        : null,
      scenario.expiresAt?.toISOString() ?? null,
    );
  }
});

test("requested invitation roles use the canonical parser and can never create another owner", async () => {
  for (const scenario of [
    { requestedRole: "viewer", expectedRole: "vet viewer" },
    { requestedRole: "owner", expectedRole: "adult" },
  ]) {
    const store = new InMemoryInvitationCreateStore();
    const result = await createHouseholdInvitationAtomically(
      createInput(store, { role: scenario.requestedRole }),
    );

    assert.equal(result.invitation.role, scenario.expectedRole);
    assert.equal(result.auditEvent.nextRole, scenario.expectedRole);
  }

  const store = new InMemoryInvitationCreateStore();
  await expectCreateError(
    createHouseholdInvitationAtomically(
      createInput(store, { role: "invented-supervisor" }),
    ),
    400,
  );
  assert.equal(store.events.includes("candidate"), false);
  assert.equal(store.state.invitations.size, 0);
  assert.deepEqual(store.state.audits, []);
});

test("source capability and exact owner membership fail closed before any candidate or write", async () => {
  const scenarios: Array<{
    label: string;
    status: 403 | 409 | 412 | 428;
    prepare(
      store: InMemoryInvitationCreateStore,
    ): Partial<
      Parameters<typeof createHouseholdInvitationAtomically<InvitationAudit>>[0]
    >;
  }> = [
    {
      label: "missing source capability",
      status: 428,
      prepare: () => ({ expectedSourceHouseholdId: null }),
    },
    {
      label: "capability targets another household",
      status: 412,
      prepare: () => ({ expectedSourceHouseholdId: HOUSEHOLD_B }),
    },
    {
      label: "missing locked user",
      status: 409,
      prepare: (store) => {
        store.user = null;
        return {};
      },
    },
    {
      label: "foreign locked user",
      status: 409,
      prepare: (store) => {
        store.user = { id: USER_B, activeHouseholdId: HOUSEHOLD_A };
        return {};
      },
    },
    {
      label: "active source changed",
      status: 412,
      prepare: (store) => {
        store.user = { id: USER_A, activeHouseholdId: HOUSEHOLD_B };
        return {};
      },
    },
    {
      label: "missing actor membership",
      status: 403,
      prepare: (store) => {
        store.membership = null;
        return {};
      },
    },
    {
      label: "foreign actor membership",
      status: 403,
      prepare: (store) => {
        store.membership = {
          id: MEMBER_A,
          userId: USER_B,
          householdId: HOUSEHOLD_A,
          role: "owner",
        };
        return {};
      },
    },
    {
      label: "blank actor membership identity",
      status: 403,
      prepare: (store) => {
        store.membership = { ...store.membership!, id: "" };
        return {};
      },
    },
    {
      label: "wrong-household actor membership",
      status: 403,
      prepare: (store) => {
        store.membership = {
          id: MEMBER_A,
          userId: USER_A,
          householdId: HOUSEHOLD_B,
          role: "owner",
        };
        return {};
      },
    },
    {
      label: "non-owner actor",
      status: 403,
      prepare: (store) => {
        store.membership = { ...store.membership!, role: "adult" };
        return {};
      },
    },
    {
      label: "unknown actor role",
      status: 403,
      prepare: (store) => {
        store.membership = { ...store.membership!, role: "super-owner" };
        return {};
      },
    },
  ];

  for (const scenario of scenarios) {
    const store = new InMemoryInvitationCreateStore();
    await expectCreateError(
      createHouseholdInvitationAtomically(
        createInput(store, scenario.prepare(store)),
      ),
      scenario.status,
    );
    assert.equal(store.state.invitations.size, 0, scenario.label);
    assert.deepEqual(store.state.audits, [], scenario.label);
    assert.equal(store.commits, 0, scenario.label);
    assert.equal(store.rollbacks, 1, scenario.label);
    assert.equal(
      store.events.some((event) => event.startsWith("insert:")),
      false,
      scenario.label,
    );
  }
});

test("DB time, lifecycle, and expiry are validated before generating a code", async () => {
  for (const scenario of [
    {
      label: "invalid DB clock",
      status: 409 as const,
      prepare(store: InMemoryInvitationCreateStore) {
        store.now = new Date(Number.NaN);
        return {};
      },
    },
    {
      label: "terminal lifecycle",
      status: 400 as const,
      prepare() {
        return { lifecycleState: "accepted" as never };
      },
    },
    {
      label: "malformed expiry",
      status: 400 as const,
      prepare() {
        return { expiresAt: "not-a-date" };
      },
    },
    {
      label: "expiry equal to DB time",
      status: 400 as const,
      prepare() {
        return { expiresAt: NOW };
      },
    },
    {
      label: "past expiry",
      status: 400 as const,
      prepare() {
        return { expiresAt: new Date(NOW.getTime() - 1) };
      },
    },
  ]) {
    const store = new InMemoryInvitationCreateStore();
    await expectCreateError(
      createHouseholdInvitationAtomically(
        createInput(store, scenario.prepare(store)),
      ),
      scenario.status,
    );
    assert.equal(store.events.includes("candidate"), false, scenario.label);
    assert.equal(store.state.invitations.size, 0, scenario.label);
    assert.deepEqual(store.state.audits, [], scenario.label);
  }
});

test("candidate exhaustion and malformed created authority roll back with no audit", async () => {
  const exhausted = new InMemoryInvitationCreateStore();
  exhausted.candidateCodes = Array.from(
    { length: HOUSEHOLD_INVITATION_CODE_ATTEMPTS },
    (_, index) => `USED${String(index).padStart(4, "0")}`,
  );
  exhausted.collidingCodes = new Set(exhausted.candidateCodes);
  await expectCreateError(
    createHouseholdInvitationAtomically(createInput(exhausted)),
    409,
  );
  assert.equal(
    exhausted.events.filter((event) => event === "candidate").length,
    HOUSEHOLD_INVITATION_CODE_ATTEMPTS,
  );
  assert.equal(exhausted.state.invitations.size, 0);
  assert.deepEqual(exhausted.state.audits, []);

  for (const malformed of [
    { householdId: HOUSEHOLD_B },
    { inviteCode: "OTHER123" },
    { createdByUserId: USER_B },
    { lifecycleState: "accepted" },
    { role: "owner" },
    { expiresAt: new Date("2026-08-30T12:00:00.000Z") },
  ]) {
    const store = new InMemoryInvitationCreateStore();
    store.malformedCreatedInvitation = malformed;
    await expectCreateError(
      createHouseholdInvitationAtomically(createInput(store)),
      409,
    );
    assert.equal(store.state.invitations.size, 0);
    assert.deepEqual(store.state.audits, []);
  }
});

test("invitation insert and audit failures both roll back and return no success", async () => {
  for (const failure of ["insert", "audit"] as const) {
    const store = new InMemoryInvitationCreateStore();
    if (failure === "insert") store.failInsert = true;
    else store.failAudit = true;

    await assert.rejects(
      createHouseholdInvitationAtomically(createInput(store)),
      new RegExp(
        `${failure === "insert" ? "invitation" : "audit"} insert failed`,
      ),
    );
    assert.equal(store.state.invitations.size, 0);
    assert.deepEqual(store.state.audits, []);
    assert.equal(store.commits, 0);
    assert.equal(store.rollbacks, 1);
  }
});

test("a mismatched audit is rejected inside the transaction and rolls back its invitation", async () => {
  const store = new InMemoryInvitationCreateStore();
  await expectCreateError(
    createHouseholdInvitationAtomically(
      createInput(store, {
        buildAuditEvent(context) {
          return {
            ...buildAuditEvent(context),
            householdId: HOUSEHOLD_B,
          };
        },
      }),
    ),
    409,
  );
  assert.equal(store.state.invitations.size, 0);
  assert.deepEqual(store.state.audits, []);
  assert.equal(store.commits, 0);
  assert.equal(store.rollbacks, 1);
});

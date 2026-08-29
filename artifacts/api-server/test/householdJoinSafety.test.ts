import assert from "node:assert/strict";
import { test } from "node:test";

import * as activeHouseholdIdentity from "../src/lib/household-active-identity.ts";

const {
  HouseholdJoinCommitError,
  commitJoinedHouseholdActivation,
  ensureActiveHouseholdIdentity,
} = activeHouseholdIdentity;

const USER_A = "user_a";
const USER_B = "user_b";
const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const ACCEPTED_AT = new Date("2026-08-28T10:00:00.000Z");

interface JoinUser {
  id: string;
  email: string | null;
  displayName: string | null;
  activeHouseholdId: string | null;
}

interface JoinMembership {
  id: string;
  userId: string;
  householdId: string;
  role: string;
  createdAt: Date;
}

interface JoinInvitation {
  id: string;
  householdId: string;
  invitedUserId: string | null;
  invitedEmail: string | null;
  role: string;
  lifecycleState:
    | "pending-approval"
    | "approved"
    | "accepted"
    | "revoked"
    | "expired"
    | "rejected";
  acceptedByUserId: string | null;
  expiresAt: Date | null;
}

interface JoinAudit {
  id: string;
  action: "invitation-accepted";
  actorUserId: string;
  householdId: string;
  targetMemberId: string;
  targetUserId: string;
  targetRole: string | null;
  nextRole: string;
  invitationId: string;
}

interface JoinSnapshot {
  userId: string;
  householdId: string;
  activeHouseholdId: string;
  memberIds: string[];
}

interface JoinState {
  users: Map<string, JoinUser>;
  memberships: JoinMembership[];
  invitations: Map<string, JoinInvitation>;
  audits: Map<string, JoinAudit>;
  careStates: Set<string>;
}

function cloneState(state: JoinState): JoinState {
  return {
    users: new Map([...state.users].map(([id, user]) => [id, { ...user }])),
    memberships: state.memberships.map((membership) => ({ ...membership })),
    invitations: new Map(
      [...state.invitations].map(([id, invitation]) => [id, { ...invitation }]),
    ),
    audits: new Map([...state.audits].map(([id, audit]) => [id, { ...audit }])),
    careStates: new Set(state.careStates),
  };
}

function createState(): JoinState {
  return {
    users: new Map([
      [
        USER_A,
        {
          id: USER_A,
          email: "caregiver@example.com",
          displayName: "Caregiver",
          activeHouseholdId: HOUSEHOLD_A,
        },
      ],
    ]),
    memberships: [
      {
        id: "member-a",
        userId: USER_A,
        householdId: HOUSEHOLD_A,
        role: "owner",
        createdAt: new Date("2026-08-28T08:00:00.000Z"),
      },
    ],
    invitations: new Map([
      [
        "invite-b",
        {
          id: "invite-b",
          householdId: HOUSEHOLD_B,
          invitedUserId: null,
          invitedEmail: null,
          role: "adult",
          lifecycleState: "approved",
          acceptedByUserId: null,
          expiresAt: null,
        },
      ],
    ]),
    audits: new Map(),
    careStates: new Set([HOUSEHOLD_A]),
  };
}

class InMemorySafetyJoinStore {
  state: JoinState;
  calls: string[] = [];
  writes: string[] = [];
  databaseNow = ACCEPTED_AT;
  acceptedAtInputs: Date[] = [];
  householdLockInputs: string[][] = [];
  beforeInvitationLock: (() => void) | null = null;
  afterCommit: (() => void) | null = null;
  failAudit = false;
  failActiveCas = false;
  failSnapshot = false;

  constructor(state: JoinState) {
    this.state = cloneState(state);
  }

  async transaction<T>(
    work: (
      transaction: activeHouseholdIdentity.HouseholdJoinTransaction<
        JoinAudit,
        JoinSnapshot
      >,
    ) => Promise<T>,
  ): Promise<T> {
    const draft = cloneState(this.state);
    try {
      const result = await work({
        lockHouseholds: async (householdIds) => {
          this.householdLockInputs.push([...householdIds]);
        },
        getCurrentTime: async () => {
          this.calls.push("get-current-time");
          return this.databaseNow;
        },
        lockUser: async (userId) => {
          this.calls.push("lock-user");
          return draft.users.get(userId) ?? null;
        },
        lockInvitation: async (invitationId) => {
          this.calls.push("lock-invitation");
          if (this.beforeInvitationLock) {
            const interleave = this.beforeInvitationLock;
            this.beforeInvitationLock = null;
            interleave();
            const externallyCommitted =
              this.state.invitations.get(invitationId);
            if (externallyCommitted) {
              draft.invitations.set(invitationId, { ...externallyCommitted });
            }
          }
          return draft.invitations.get(invitationId) ?? null;
        },
        findMembership: async (userId, householdId) => {
          this.calls.push("find-membership");
          return (
            draft.memberships.find(
              (membership) =>
                membership.userId === userId &&
                membership.householdId === householdId,
            ) ?? null
          );
        },
        findExistingAcceptanceAudit: async (input) => {
          this.calls.push("find-acceptance-audit");
          const audit = draft.audits.get(input.invitationId) ?? null;
          return audit ? { ...audit } : null;
        },
        createMembership: async (input) => {
          this.calls.push("create-membership");
          this.writes.push("membership");
          const membership: JoinMembership = {
            id: `member-${draft.memberships.length + 1}`,
            ...input,
            createdAt: ACCEPTED_AT,
          };
          draft.memberships.push(membership);
          return membership;
        },
        acceptInvitation: async (input) => {
          this.calls.push("accept-invitation");
          this.writes.push("invitation");
          this.acceptedAtInputs.push(input.acceptedAt);
          const invitation = draft.invitations.get(input.invitationId);
          if (
            !invitation ||
            invitation.householdId !== input.householdId ||
            invitation.lifecycleState !== "approved" ||
            (invitation.expiresAt !== null &&
              invitation.expiresAt.getTime() <= input.acceptedAt.getTime())
          ) {
            return {
              allowed: false as const,
              reason: "Invitation changed before acceptance committed.",
            };
          }
          invitation.lifecycleState = "accepted";
          invitation.acceptedByUserId = input.userId;
          invitation.invitedUserId ??= input.userId;
          return { allowed: true as const };
        },
        ensureCareState: async (householdId) => {
          this.calls.push("ensure-care-state");
          this.writes.push("care-state");
          draft.careStates.add(householdId);
        },
        recordAudit: async (event) => {
          this.calls.push("record-audit");
          this.writes.push("audit");
          if (this.failAudit) throw new Error("audit write failed");
          draft.audits.set(event.invitationId, { ...event });
        },
        setActiveHousehold: async (input) => {
          this.calls.push("set-active-household");
          this.writes.push("active-household");
          if (this.failActiveCas) return false;
          const user = draft.users.get(input.userId);
          const membership = draft.memberships.find(
            (candidate) =>
              candidate.id === input.membershipId &&
              candidate.userId === input.userId &&
              candidate.householdId === input.householdId,
          );
          if (
            !user ||
            !membership ||
            user.activeHouseholdId !== input.expectedSourceHouseholdId
          ) {
            return false;
          }
          user.activeHouseholdId = input.householdId;
          return true;
        },
        buildExactMeSnapshot: async ({ userId, householdId }) => {
          this.calls.push("build-exact-me-snapshot");
          if (this.failSnapshot) {
            throw new Error("exact Me snapshot failed");
          }
          const user = draft.users.get(userId);
          if (!user || user.activeHouseholdId !== householdId) {
            throw new HouseholdJoinCommitError(
              "Exact Me authority changed during join response.",
            );
          }
          return {
            userId,
            householdId,
            activeHouseholdId: user.activeHouseholdId,
            memberIds: draft.memberships
              .filter(
                (membership) => membership.householdId === householdId,
              )
              .map((membership) => membership.id),
          } satisfies JoinSnapshot;
        },
      });
      this.state = draft;
      this.afterCommit?.();
      return result;
    } catch (error) {
      throw error;
    }
  }
}

function buildAudit(input: {
  invitationId: string;
  userId: string;
  householdId: string;
  membership: { id: string; role: string };
  inThisHousehold: boolean;
}): JoinAudit {
  return {
    id: `acceptance-${input.invitationId}`,
    action: "invitation-accepted",
    actorUserId: input.userId,
    householdId: input.householdId,
    targetMemberId: input.membership.id,
    targetUserId: input.userId,
    targetRole: input.inThisHousehold ? input.membership.role : null,
    nextRole: input.membership.role,
    invitationId: input.invitationId,
  };
}

async function join(
  store: InMemorySafetyJoinStore,
  input: {
    userId?: string;
    householdId?: string;
    expectedSourceHouseholdId?: string | null;
    invitationId?: string | null;
    verifiedIdentity?:
      | {
          state: "verified";
          userId: string;
          verifiedEmails: readonly string[];
        }
      | { state: "provider-unavailable"; userId: string };
    acceptedAt?: Date | null;
  } = {},
) {
  const userId = input.userId ?? USER_A;
  const householdId = input.householdId ?? HOUSEHOLD_B;
  const invitationId =
    input.invitationId === undefined ? "invite-b" : input.invitationId;
  return commitJoinedHouseholdActivation({
    store,
    userId,
    householdId,
    expectedSourceHouseholdId:
      input.expectedSourceHouseholdId === undefined
        ? HOUSEHOLD_A
        : input.expectedSourceHouseholdId,
    invitationId,
    verifiedIdentity: input.verifiedIdentity ?? {
      state: "verified",
      userId,
      verifiedEmails: ["caregiver@example.com"],
    },
    ...(input.acceptedAt === null
      ? {}
      : { acceptedAt: input.acceptedAt ?? ACCEPTED_AT }),
    buildAuditEvent({ inThisHousehold, membership }) {
      return buildAudit({
        invitationId: invitationId ?? "missing",
        userId,
        householdId,
        membership,
        inThisHousehold,
      });
    },
  });
}

test("shipping join uses the transaction's database clock when no deterministic acceptance time is injected", async () => {
  const state = createState();
  state.invitations.get("invite-b")!.expiresAt = new Date(
    "2029-01-01T00:00:00.000Z",
  );
  const store = new InMemorySafetyJoinStore(state);
  store.databaseNow = new Date("2029-01-01T00:00:00.001Z");

  await assert.rejects(
    join(store, { acceptedAt: null }),
    assertCommitError(403, /expired/i),
  );

  assert.deepEqual(store.calls, [
    "lock-user",
    "lock-invitation",
    "get-current-time",
  ]);
  assert.deepEqual(store.acceptedAtInputs, []);
  assert.deepEqual(store.householdLockInputs, [[HOUSEHOLD_A, HOUSEHOLD_B]]);
  assert.deepEqual(store.writes, []);
});

test("shipping join carries one database timestamp through expiry, acceptance, and later writes", async () => {
  const state = createState();
  state.invitations.get("invite-b")!.expiresAt = new Date(
    "2029-01-01T00:00:00.001Z",
  );
  const store = new InMemorySafetyJoinStore(state);
  store.databaseNow = new Date("2029-01-01T00:00:00.000Z");

  const result = await join(store, { acceptedAt: null });

  assert.equal(result.replayed, false);
  assert.deepEqual(store.acceptedAtInputs, [store.databaseNow]);
  assert.deepEqual(store.calls.slice(0, 3), [
    "lock-user",
    "lock-invitation",
    "get-current-time",
  ]);
  assert.deepEqual(store.householdLockInputs, [[HOUSEHOLD_A, HOUSEHOLD_B]]);
});

function assertCommitError(
  status: 403 | 409 | 412 | 428 | 503,
  message: RegExp,
): (error: unknown) => boolean {
  return (error: unknown) => {
    assert.ok(error instanceof HouseholdJoinCommitError);
    assert.equal(error.status, status);
    assert.match(error.message, message);
    return true;
  };
}

test("join requires a durable invitation id before opening a transaction", async () => {
  const store = new InMemorySafetyJoinStore(createState());

  await assert.rejects(
    join(store, { invitationId: null }),
    assertCommitError(428, /durable invitation/i),
  );

  assert.deepEqual(store.calls, []);
  assert.deepEqual(store.writes, []);
});

test("join requires an expected source household before opening a transaction", async () => {
  const store = new InMemorySafetyJoinStore(createState());

  await assert.rejects(
    join(store, { expectedSourceHouseholdId: null }),
    assertCommitError(428, /source household/i),
  );

  assert.deepEqual(store.calls, []);
  assert.deepEqual(store.writes, []);
});

test("join compares the expected source household as an opaque exact value", async () => {
  const store = new InMemorySafetyJoinStore(createState());

  await assert.rejects(
    join(store, { expectedSourceHouseholdId: ` ${HOUSEHOLD_A} ` }),
    assertCommitError(412, /active household changed/i),
  );

  assert.deepEqual(store.calls, ["lock-user"]);
  assert.deepEqual(store.writes, []);
});

test("the locked active household CAS is checked before invitation or membership access", async () => {
  const state = createState();
  state.users.get(USER_A)!.activeHouseholdId = HOUSEHOLD_B;
  const store = new InMemorySafetyJoinStore(state);

  await assert.rejects(
    join(store),
    assertCommitError(412, /active household changed/i),
  );

  assert.deepEqual(store.calls, ["lock-user"]);
  assert.deepEqual(store.writes, []);
});

test("a targeted invitation rejects another user without any write", async () => {
  const state = createState();
  state.invitations.get("invite-b")!.invitedUserId = USER_B;
  const store = new InMemorySafetyJoinStore(state);

  await assert.rejects(
    join(store),
    assertCommitError(403, /different authenticated user/i),
  );

  assert.deepEqual(store.calls, ["lock-user", "lock-invitation"]);
  assert.deepEqual(store.writes, []);
});

test("a user-targeted invitation rejects whitespace-altered identity bytes", async () => {
  const state = createState();
  state.invitations.get("invite-b")!.invitedUserId = ` ${USER_A} `;
  const store = new InMemorySafetyJoinStore(state);

  await assert.rejects(
    join(store),
    assertCommitError(403, /different authenticated user/i),
  );

  assert.deepEqual(store.calls, ["lock-user", "lock-invitation"]);
  assert.deepEqual(store.writes, []);
});

test("email targeting is case-insensitive but otherwise exact", async () => {
  const state = createState();
  state.invitations.get("invite-b")!.invitedEmail = "CAREGIVER@EXAMPLE.COM";
  const store = new InMemorySafetyJoinStore(state);

  await join(store);

  assert.equal(
    store.state.invitations.get("invite-b")?.acceptedByUserId,
    USER_A,
  );

  const mismatchState = createState();
  mismatchState.invitations.get("invite-b")!.invitedUserId = USER_A;
  mismatchState.invitations.get("invite-b")!.invitedEmail =
    "caregiver@example.com.attacker.invalid";
  const mismatchStore = new InMemorySafetyJoinStore(mismatchState);
  await assert.rejects(
    join(mismatchStore),
    assertCommitError(403, /different.*email/i),
  );
  assert.deepEqual(mismatchStore.writes, []);
});

test("email targeting uses only the fresh verified provider identity, never the cached user email", async () => {
  const newEmailState = createState();
  newEmailState.users.get(USER_A)!.email = "cached-old@example.com";
  newEmailState.invitations.get("invite-b")!.invitedEmail =
    "provider-new@example.com";
  const newEmailStore = new InMemorySafetyJoinStore(newEmailState);

  await join(newEmailStore, {
    verifiedIdentity: {
      state: "verified",
      userId: USER_A,
      verifiedEmails: ["provider-new@example.com"],
    },
  });
  assert.equal(
    newEmailStore.state.invitations.get("invite-b")?.acceptedByUserId,
    USER_A,
  );

  const oldEmailState = createState();
  oldEmailState.users.get(USER_A)!.email = "cached-old@example.com";
  oldEmailState.invitations.get("invite-b")!.invitedEmail =
    "cached-old@example.com";
  const oldEmailStore = new InMemorySafetyJoinStore(oldEmailState);
  await assert.rejects(
    join(oldEmailStore, {
      verifiedIdentity: {
        state: "verified",
        userId: USER_A,
        verifiedEmails: ["provider-new@example.com"],
      },
    }),
    assertCommitError(403, /verified.*email|different.*email/i),
  );
  assert.deepEqual(oldEmailStore.writes, []);
});

test("email targeting fails closed for provider outage or no verified email with zero join writes", async () => {
  for (const identityCase of [
    {
      identity: {
        state: "provider-unavailable" as const,
        userId: USER_A,
      },
      status: 503 as const,
      message: /verify.*right now|provider/i,
    },
    {
      identity: {
        state: "verified" as const,
        userId: USER_A,
        verifiedEmails: [] as const,
      },
      status: 403 as const,
      message: /verified.*email|different.*email/i,
    },
  ]) {
    const state = createState();
    state.users.get(USER_A)!.email = "caregiver@example.com";
    state.invitations.get("invite-b")!.invitedEmail =
      "caregiver@example.com";
    const store = new InMemorySafetyJoinStore(state);

    await assert.rejects(
      join(store, { verifiedIdentity: identityCase.identity }),
      assertCommitError(identityCase.status, identityCase.message),
    );
    assert.deepEqual(store.writes, []);
  }
});

test("an invitation targeted by both user id and email requires both fresh identities to match", async () => {
  const matchingState = createState();
  matchingState.invitations.get("invite-b")!.invitedUserId = USER_A;
  matchingState.invitations.get("invite-b")!.invitedEmail =
    "CAREGIVER@EXAMPLE.COM";
  const matchingStore = new InMemorySafetyJoinStore(matchingState);
  const matchingResult = await join(matchingStore);
  assert.equal(matchingResult.me.householdId, HOUSEHOLD_B);

  const wrongUserState = createState();
  wrongUserState.invitations.get("invite-b")!.invitedUserId = USER_B;
  wrongUserState.invitations.get("invite-b")!.invitedEmail =
    "caregiver@example.com";
  const wrongUserStore = new InMemorySafetyJoinStore(wrongUserState);
  await assert.rejects(
    join(wrongUserStore),
    assertCommitError(403, /different authenticated user/i),
  );
  assert.deepEqual(wrongUserStore.writes, []);

  const wrongEmailState = createState();
  wrongEmailState.invitations.get("invite-b")!.invitedUserId = USER_A;
  wrongEmailState.invitations.get("invite-b")!.invitedEmail =
    "other@example.com";
  const wrongEmailStore = new InMemorySafetyJoinStore(wrongEmailState);
  await assert.rejects(
    join(wrongEmailStore),
    assertCommitError(403, /verified.*email|different.*email/i),
  );
  assert.deepEqual(wrongEmailStore.writes, []);
});

test("provider unavailability does not block an invitation with no email target", async () => {
  const store = new InMemorySafetyJoinStore(createState());

  const result = await join(store, {
    verifiedIdentity: {
      state: "provider-unavailable",
      userId: USER_A,
    },
  });

  assert.equal(result.me.householdId, HOUSEHOLD_B);
  assert.equal(
    store.state.invitations.get("invite-b")?.acceptedByUserId,
    USER_A,
  );
});

test("email targeting rejects whitespace-altered address bytes", async () => {
  const state = createState();
  state.invitations.get("invite-b")!.invitedEmail = " caregiver@example.com ";
  const store = new InMemorySafetyJoinStore(state);

  await assert.rejects(join(store), assertCommitError(403, /email/i));

  assert.deepEqual(store.calls, ["lock-user", "lock-invitation"]);
  assert.deepEqual(store.writes, []);
});

test("an email-targeted invitation ignores a missing cached email when fresh provider identity matches", async () => {
  const state = createState();
  state.users.get(USER_A)!.email = null;
  state.invitations.get("invite-b")!.invitedEmail = "caregiver@example.com";
  const store = new InMemorySafetyJoinStore(state);

  const result = await join(store);

  assert.equal(result.me.householdId, HOUSEHOLD_B);
  assert.equal(
    store.state.invitations.get("invite-b")?.acceptedByUserId,
    USER_A,
  );
});

test("a revocation committed before the invitation row lock wins without partial join writes", async () => {
  const store = new InMemorySafetyJoinStore(createState());
  store.beforeInvitationLock = () => {
    store.state.invitations.get("invite-b")!.lifecycleState = "revoked";
  };

  await assert.rejects(join(store), assertCommitError(403, /revoked/i));

  assert.equal(
    store.state.invitations.get("invite-b")?.lifecycleState,
    "revoked",
  );
  assert.equal(
    store.state.memberships.some(
      (membership) => membership.householdId === HOUSEHOLD_B,
    ),
    false,
  );
  assert.deepEqual(store.writes, []);
});

function makeAcceptedRetryState(): JoinState {
  const state = createState();
  const invitation = state.invitations.get("invite-b")!;
  invitation.lifecycleState = "accepted";
  invitation.acceptedByUserId = USER_A;
  invitation.invitedUserId = USER_A;
  state.users.get(USER_A)!.activeHouseholdId = HOUSEHOLD_B;
  const membership: JoinMembership = {
    id: "member-b",
    userId: USER_A,
    householdId: HOUSEHOLD_B,
    role: "adult",
    createdAt: ACCEPTED_AT,
  };
  state.memberships.push(membership);
  const audit = buildAudit({
    invitationId: "invite-b",
    userId: USER_A,
    householdId: HOUSEHOLD_B,
    membership,
    inThisHousehold: false,
  });
  state.audits.set("invite-b", audit);
  state.careStates.add(HOUSEHOLD_B);
  return state;
}

test("same-user accepted retry returns the exact persisted audit with zero writes", async () => {
  const state = makeAcceptedRetryState();
  const expectedAudit = state.audits.get("invite-b")!;
  const store = new InMemorySafetyJoinStore(state);

  const result = await join(store, {
    expectedSourceHouseholdId: HOUSEHOLD_B,
  });

  assert.equal(result.replayed, true);
  assert.deepEqual(result.auditEvent, expectedAudit);
  assert.deepEqual(store.writes, []);
  assert.deepEqual(store.calls, [
    "lock-user",
    "lock-invitation",
    "find-membership",
    "find-acceptance-audit",
    "build-exact-me-snapshot",
  ]);
});

test("join success and replay return the exact Me snapshot captured before the transaction lock releases", async () => {
  for (const input of [
    {
      state: createState(),
      expectedSourceHouseholdId: HOUSEHOLD_A,
      expectedMemberId: "member-2",
    },
    {
      state: makeAcceptedRetryState(),
      expectedSourceHouseholdId: HOUSEHOLD_B,
      expectedMemberId: "member-b",
    },
  ]) {
    const store = new InMemorySafetyJoinStore(input.state);
    store.afterCommit = () => {
      store.calls.push("after-commit-activation");
      store.state.users.get(USER_A)!.activeHouseholdId = HOUSEHOLD_A;
    };

    const result = await join(store, {
      expectedSourceHouseholdId: input.expectedSourceHouseholdId,
    });

    assert.deepEqual(result.me, {
      userId: USER_A,
      householdId: HOUSEHOLD_B,
      activeHouseholdId: HOUSEHOLD_B,
      memberIds: [input.expectedMemberId],
    });
    assert.equal(
      store.state.users.get(USER_A)?.activeHouseholdId,
      HOUSEHOLD_A,
      "the simulated activation commits after the join lock releases, but cannot invalidate the already-captured response",
    );
    assert.deepEqual(store.calls.slice(-2), [
      "build-exact-me-snapshot",
      "after-commit-activation",
    ]);
  }
});

test("an exact Me snapshot failure rolls the entire join mutation back", async () => {
  const store = new InMemorySafetyJoinStore(createState());
  store.failSnapshot = true;

  await assert.rejects(join(store), /exact Me snapshot failed/);

  assert.equal(
    store.state.invitations.get("invite-b")?.lifecycleState,
    "approved",
  );
  assert.equal(store.state.memberships.length, 1);
  assert.equal(store.state.careStates.has(HOUSEHOLD_B), false);
  assert.equal(store.state.users.get(USER_A)?.activeHouseholdId, HOUSEHOLD_A);
  assert.equal(store.state.audits.size, 0);
});

test("accepted retry fails closed when its exact persisted audit is missing", async () => {
  const state = makeAcceptedRetryState();
  state.audits.clear();
  const store = new InMemorySafetyJoinStore(state);

  await assert.rejects(
    join(store, { expectedSourceHouseholdId: HOUSEHOLD_B }),
    assertCommitError(409, /acceptance audit/i),
  );

  assert.deepEqual(store.writes, []);
});

test("accepted retry fails closed when the original membership was revoked", async () => {
  const state = makeAcceptedRetryState();
  state.memberships = state.memberships.filter(
    (membership) => membership.id !== "member-b",
  );
  const store = new InMemorySafetyJoinStore(state);

  await assert.rejects(
    join(store, { expectedSourceHouseholdId: HOUSEHOLD_B }),
    assertCommitError(409, /membership.*revoked/i),
  );

  assert.equal(store.calls.includes("create-membership"), false);
  assert.deepEqual(store.writes, []);
});

test("accepted retry rejects a replacement membership row and never recreates authority", async () => {
  const state = makeAcceptedRetryState();
  state.memberships.find(
    (membership) => membership.householdId === HOUSEHOLD_B,
  )!.id = "replacement-member-b";
  const store = new InMemorySafetyJoinStore(state);

  await assert.rejects(
    join(store, { expectedSourceHouseholdId: HOUSEHOLD_B }),
    assertCommitError(409, /original membership/i),
  );

  assert.deepEqual(store.writes, []);
});

test("accepted invitation rejects a retry by another authenticated user", async () => {
  const state = makeAcceptedRetryState();
  state.users.set(USER_B, {
    id: USER_B,
    email: "other@example.com",
    displayName: "Other",
    activeHouseholdId: HOUSEHOLD_A,
  });
  const store = new InMemorySafetyJoinStore(state);

  await assert.rejects(
    join(store, { userId: USER_B }),
    assertCommitError(403, /different authenticated user/i),
  );

  assert.deepEqual(store.writes, []);
});

test("an already accepted invitation cannot promote from another active household", async () => {
  const state = makeAcceptedRetryState();
  state.users.get(USER_A)!.activeHouseholdId = HOUSEHOLD_A;
  const store = new InMemorySafetyJoinStore(state);

  await assert.rejects(
    join(store),
    assertCommitError(409, /already accepted.*active/i),
  );

  assert.deepEqual(store.writes, []);
});

test("existing membership role remains authoritative for membership and audit", async () => {
  const state = createState();
  state.memberships.push({
    id: "member-b",
    userId: USER_A,
    householdId: HOUSEHOLD_B,
    role: "teen",
    createdAt: ACCEPTED_AT,
  });
  state.invitations.get("invite-b")!.role = "adult";
  const store = new InMemorySafetyJoinStore(state);

  const result = await join(store);

  assert.equal(result.inThisHousehold, true);
  assert.equal(result.auditEvent.targetRole, "teen");
  assert.equal(result.auditEvent.nextRole, "teen");
  assert.equal(store.calls.includes("create-membership"), false);
  assert.equal(
    store.state.memberships.find(
      (membership) => membership.householdId === HOUSEHOLD_B,
    )?.role,
    "teen",
  );
});

test("new membership receives the role from the locked approved invitation", async () => {
  const state = createState();
  state.invitations.get("invite-b")!.role = "walker";
  const store = new InMemorySafetyJoinStore(state);

  const result = await join(store);

  assert.equal(result.auditEvent.targetRole, null);
  assert.equal(result.auditEvent.nextRole, "walker");
  assert.equal(
    store.state.memberships.find(
      (membership) => membership.householdId === HOUSEHOLD_B,
    )?.role,
    "walker",
  );
});

test("an unknown locked invitation role fails closed before any join write", async () => {
  const state = createState();
  state.invitations.get("invite-b")!.role = "former owner";
  const store = new InMemorySafetyJoinStore(state);

  await assert.rejects(
    join(store),
    assertCommitError(409, /invitation role authority/i),
  );

  assert.deepEqual(store.calls, ["lock-user", "lock-invitation"]);
  assert.deepEqual(store.writes, []);
});

test("an unknown existing membership role fails closed before invitation acceptance", async () => {
  const state = createState();
  state.memberships.push({
    id: "member-b",
    userId: USER_A,
    householdId: HOUSEHOLD_B,
    role: "owner-ish",
    createdAt: ACCEPTED_AT,
  });
  const store = new InMemorySafetyJoinStore(state);

  await assert.rejects(
    join(store),
    assertCommitError(409, /membership role authority/i),
  );

  assert.equal(store.calls.includes("accept-invitation"), false);
  assert.deepEqual(store.writes, []);
});

test("a locked invitation uses only an explicit legacy alias and persists its canonical role", async () => {
  const state = createState();
  state.invitations.get("invite-b")!.role = "member";
  const store = new InMemorySafetyJoinStore(state);

  const result = await join(store);

  assert.equal(result.auditEvent.nextRole, "adult");
  assert.equal(
    store.state.memberships.find(
      (membership) => membership.householdId === HOUSEHOLD_B,
    )?.role,
    "adult",
  );
});

test("invitation acceptance, membership, audit, care state, and activation roll back together", async () => {
  const store = new InMemorySafetyJoinStore(createState());
  store.failAudit = true;

  await assert.rejects(join(store), /audit write failed/);

  assert.equal(
    store.state.invitations.get("invite-b")?.lifecycleState,
    "approved",
  );
  assert.equal(
    store.state.memberships.some(
      (membership) => membership.householdId === HOUSEHOLD_B,
    ),
    false,
  );
  assert.equal(store.state.careStates.has(HOUSEHOLD_B), false);
  assert.equal(store.state.users.get(USER_A)?.activeHouseholdId, HOUSEHOLD_A);
  assert.equal(store.state.audits.size, 0);
});

test("a failed final active-household CAS rolls back every join write", async () => {
  const store = new InMemorySafetyJoinStore(createState());
  store.failActiveCas = true;

  await assert.rejects(
    join(store),
    assertCommitError(409, /membership changed.*active/i),
  );

  assert.equal(
    store.state.invitations.get("invite-b")?.lifecycleState,
    "approved",
  );
  assert.equal(store.state.memberships.length, 1);
  assert.equal(store.state.careStates.has(HOUSEHOLD_B), false);
  assert.equal(store.state.users.get(USER_A)?.activeHouseholdId, HOUSEHOLD_A);
  assert.equal(store.state.audits.size, 0);
});

test("missing provisioning user is a typed catchable conflict", async () => {
  const store = new InMemorySafetyJoinStore(createState());
  store.state.users.delete(USER_A);

  await assert.rejects(join(store), assertCommitError(409, /not provisioned/i));

  assert.deepEqual(store.calls, ["lock-user"]);
  assert.deepEqual(store.writes, []);
});

test("active identity provisioning failures use the same typed catchable error", async () => {
  await assert.rejects(
    ensureActiveHouseholdIdentity({
      userId: USER_A,
      store: {
        async transaction(work) {
          return work({
            async lockUserHouseholds() {
              return [];
            },
            async getCurrentTime() {
              return ACCEPTED_AT;
            },
            async lockUser() {
              return null;
            },
            async confirmUserHouseholdsLocked() {
              throw new Error("must not confirm a missing user");
            },
            async listMemberships() {
              throw new Error("must not list memberships");
            },
            async createDefaultHousehold() {
              throw new Error("must not create a household");
            },
            async createOwnerMembership() {
              throw new Error("must not create membership");
            },
            async ensureCareState() {
              throw new Error("must not create care state");
            },
            async setActiveHousehold() {
              throw new Error("must not set active household");
            },
          });
        },
      },
    }),
    assertCommitError(409, /not provisioned/i),
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";

import * as activeHouseholdIdentity from "../src/lib/household-active-identity.ts";

const {
  HouseholdJoinCommitError,
  commitJoinedHouseholdActivation,
  ensureActiveHouseholdIdentity,
  resolveActiveHouseholdMembership,
} = activeHouseholdIdentity;

const USER_A = "user_a";
const USER_B = "user_b";
const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const HOUSEHOLD_C = "33333333-3333-4333-8333-333333333333";
const AUTHORITY_NOW = new Date("2026-08-28T12:00:00.000Z");

const membershipA = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  userId: USER_A,
  householdId: HOUSEHOLD_A,
  role: "owner",
  accessPassExpiresAt: null,
  createdAt: "2026-08-28T08:00:00.000Z",
};

const membershipB = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  userId: USER_A,
  householdId: HOUSEHOLD_B,
  role: "adult",
  accessPassExpiresAt: null,
  createdAt: "2026-08-28T09:00:00.000Z",
};

test("a successful join keeps the explicitly active joined household authoritative after relaunch", () => {
  assert.deepEqual(
    resolveActiveHouseholdMembership({
      userId: USER_A,
      persistedActiveHouseholdId: HOUSEHOLD_B,
      memberships: [membershipA, membershipB],
      now: AUTHORITY_NOW,
    }),
    {
      householdId: HOUSEHOLD_B,
      shouldPersist: false,
      canProvisionDefault: false,
    },
  );
});

test("a revoked active membership falls back deterministically and repairs the persisted pointer", () => {
  assert.deepEqual(
    resolveActiveHouseholdMembership({
      userId: USER_A,
      persistedActiveHouseholdId: HOUSEHOLD_B,
      memberships: [membershipA],
      now: AUTHORITY_NOW,
    }),
    {
      householdId: HOUSEHOLD_A,
      shouldPersist: true,
      canProvisionDefault: false,
    },
  );
});

test("active-household resolution never admits another user's membership", () => {
  assert.deepEqual(
    resolveActiveHouseholdMembership({
      userId: USER_A,
      persistedActiveHouseholdId: HOUSEHOLD_C,
      memberships: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          userId: USER_B,
          householdId: HOUSEHOLD_C,
          role: "owner",
          accessPassExpiresAt: null,
          createdAt: "2026-08-28T07:00:00.000Z",
        },
      ],
      now: AUTHORITY_NOW,
    }),
    {
      householdId: null,
      shouldPersist: true,
      canProvisionDefault: true,
    },
  );
});

test("an expired active helper falls back only to a valid retained membership", () => {
  assert.deepEqual(
    resolveActiveHouseholdMembership({
      userId: USER_A,
      persistedActiveHouseholdId: HOUSEHOLD_B,
      memberships: [
        membershipA,
        {
          ...membershipB,
          role: "sitter",
          accessPassExpiresAt: "2026-08-28T11:59:59.999Z",
        },
      ],
      now: AUTHORITY_NOW,
    }),
    {
      householdId: HOUSEHOLD_A,
      shouldPersist: true,
      canProvisionDefault: false,
    },
  );
});

for (const invalidMembership of [
  {
    ...membershipB,
    role: "trainer",
    accessPassExpiresAt: "2026-08-28T12:00:00.000Z",
  },
  {
    ...membershipB,
    role: "former owner",
  },
] as const) {
  test(`an unavailable ${invalidMembership.role} membership cannot authorize access or default provisioning`, () => {
    assert.deepEqual(
      resolveActiveHouseholdMembership({
        userId: USER_A,
        persistedActiveHouseholdId: HOUSEHOLD_B,
        memberships: [invalidMembership],
        now: AUTHORITY_NOW,
      }),
      {
        householdId: null,
        shouldPersist: true,
        canProvisionDefault: false,
      },
    );
  });
}

interface AuditEvent {
  id: string;
  action: "invitation-accepted";
  actorUserId: string;
  householdId: string;
  targetMemberId: string;
  targetUserId: string;
  targetRole: string | null;
  nextRole: string;
  invitationId: string;
  existing: boolean;
}

interface JoinMeSnapshot {
  userId: string;
  householdId: string;
}

interface InvitationState {
  id: string;
  householdId: string;
  invitedUserId: string | null;
  invitedEmail: string | null;
  role: string;
  lifecycleState: "approved" | "accepted";
  acceptedByUserId: string | null;
  expiresAt: Date | null;
}

interface JoinState {
  users: Map<string, string | null>;
  memberships: Array<{
    id: string;
    userId: string;
    householdId: string;
    role: string;
    createdAt: Date;
  }>;
  invitations: Map<string, InvitationState>;
  careStates: Set<string>;
  audits: AuditEvent[];
}

function cloneJoinState(state: JoinState): JoinState {
  return {
    users: new Map(state.users),
    memberships: state.memberships.map((membership) => ({ ...membership })),
    invitations: new Map(
      [...state.invitations].map(([id, invitation]) => [id, { ...invitation }]),
    ),
    careStates: new Set(state.careStates),
    audits: state.audits.map((audit) => ({ ...audit })),
  };
}

class InMemoryJoinStore {
  state: JoinState;
  private queue: Promise<void> = Promise.resolve();
  currentTime = new Date("2026-08-28T10:00:00.000Z");
  failAudit = false;
  forgeCreatedMembershipForUser: string | null = null;

  constructor(state: JoinState) {
    this.state = cloneJoinState(state);
  }

  async transaction<T>(
    work: (
      transaction: activeHouseholdIdentity.HouseholdJoinTransaction<
        AuditEvent,
        JoinMeSnapshot
      >,
    ) => Promise<T>,
  ): Promise<T> {
    const previous = this.queue;
    let release = () => {};
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const draft = cloneJoinState(this.state);
    try {
      const result = await work({
        async lockHouseholds() {},
        getCurrentTime: async () => this.currentTime,
        async lockUser(userId) {
          if (!draft.users.has(userId)) return null;
          return {
            id: userId,
            email: `${userId}@example.com`,
            displayName: "Caregiver",
            activeHouseholdId: draft.users.get(userId) ?? null,
          };
        },
        async lockInvitation(invitationId) {
          return draft.invitations.get(invitationId) ?? null;
        },
        async findMembership(userId, householdId) {
          return (
            draft.memberships.find(
              (membership) =>
                membership.userId === userId &&
                membership.householdId === householdId,
            ) ?? null
          );
        },
        createMembership: async (input) => {
          const membership = {
            id: `member-${draft.memberships.length + 1}`,
            userId: this.forgeCreatedMembershipForUser ?? input.userId,
            householdId: input.householdId,
            role: input.role,
            createdAt: new Date("2026-08-28T10:00:00.000Z"),
          };
          draft.memberships.push(membership);
          return membership;
        },
        async findExistingAcceptanceAudit(input) {
          return (
            draft.audits.find(
              (audit) => audit.invitationId === input.invitationId,
            ) ?? null
          );
        },
        async acceptInvitation(input) {
          const invitation = draft.invitations.get(input.invitationId);
          if (
            !invitation ||
            invitation.householdId !== input.householdId ||
            invitation.lifecycleState !== "approved"
          ) {
            return {
              allowed: false as const,
              reason: "Invitation has already been accepted.",
            };
          }
          invitation.lifecycleState = "accepted";
          invitation.acceptedByUserId = input.userId;
          invitation.invitedUserId ??= input.userId;
          return { allowed: true as const };
        },
        async ensureCareState(householdId) {
          draft.careStates.add(householdId);
        },
        recordAudit: async (event) => {
          if (this.failAudit) throw new Error("audit write failed");
          draft.audits.push(event);
        },
        async setActiveHousehold(input) {
          const isMember = draft.memberships.some(
            (membership) =>
              membership.id === input.membershipId &&
              membership.userId === input.userId &&
              membership.householdId === input.householdId,
          );
          if (
            !draft.users.has(input.userId) ||
            !isMember ||
            draft.users.get(input.userId) !== input.expectedSourceHouseholdId
          ) {
            return false;
          }
          draft.users.set(input.userId, input.householdId);
          return true;
        },
        async buildExactMeSnapshot({ userId, householdId }) {
          const activeHouseholdId = draft.users.get(userId);
          const isMember = draft.memberships.some(
            (membership) =>
              membership.userId === userId &&
              membership.householdId === householdId,
          );
          if (activeHouseholdId !== householdId || !isMember) {
            throw new Error("exact Me snapshot authority changed");
          }
          return { userId, householdId };
        },
      });
      this.state = draft;
      return result;
    } finally {
      release();
    }
  }
}

function createJoinState(): JoinState {
  return {
    users: new Map([[USER_A, HOUSEHOLD_A]]),
    memberships: [
      {
        ...membershipA,
        role: "owner",
        createdAt: new Date(membershipA.createdAt),
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
    careStates: new Set([HOUSEHOLD_A]),
    audits: [],
  };
}

async function join(
  store: InMemoryJoinStore,
  input: {
    userId?: string;
    householdId?: string;
    invitationId?: string | null;
    expectedSourceHouseholdId?: string | null;
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
        ? userId === USER_A
          ? HOUSEHOLD_A
          : HOUSEHOLD_C
        : input.expectedSourceHouseholdId,
    invitationId,
    verifiedIdentity: {
      state: "verified",
      userId,
      verifiedEmails: [`${userId}@example.com`],
    },
    acceptedAt: new Date("2026-08-28T10:00:00.000Z"),
    buildAuditEvent({ inThisHousehold, membership }) {
      return {
        id: `audit-${userId}-${householdId}`,
        action: "invitation-accepted",
        actorUserId: userId,
        householdId,
        targetMemberId: membership.id,
        targetUserId: userId,
        targetRole: inThisHousehold ? membership.role : null,
        nextRole: membership.role,
        invitationId: invitationId ?? "missing",
        existing: inThisHousehold,
      };
    },
  });
}

test("join commit atomically retains the personal household and promotes the invited household", async () => {
  const store = new InMemoryJoinStore(createJoinState());

  const result = await join(store);

  assert.equal(result.inThisHousehold, false);
  assert.equal(store.state.users.get(USER_A), HOUSEHOLD_B);
  assert.deepEqual(
    store.state.memberships.map(({ userId, householdId }) => ({
      userId,
      householdId,
    })),
    [
      { userId: USER_A, householdId: HOUSEHOLD_A },
      { userId: USER_A, householdId: HOUSEHOLD_B },
    ],
    "joining must not delete the user's original personal household",
  );
  assert.equal(
    store.state.invitations.get("invite-b")?.acceptedByUserId,
    USER_A,
  );
  assert.equal(store.state.careStates.has(HOUSEHOLD_B), true);
  assert.deepEqual(store.state.audits, [result.auditEvent]);
});

test("a failed join rolls back membership, invitation, audit, care state, and active household", async () => {
  const store = new InMemoryJoinStore(createJoinState());
  store.failAudit = true;

  await assert.rejects(join(store), /audit write failed/);

  assert.equal(store.state.users.get(USER_A), HOUSEHOLD_A);
  assert.equal(store.state.memberships.length, 1);
  assert.equal(
    store.state.invitations.get("invite-b")?.lifecycleState,
    "approved",
  );
  assert.equal(store.state.careStates.has(HOUSEHOLD_B), false);
  assert.deepEqual(store.state.audits, []);
});

test("a forged cross-user membership aborts the whole join before active authority changes", async () => {
  const store = new InMemoryJoinStore(createJoinState());
  store.forgeCreatedMembershipForUser = USER_B;

  await assert.rejects(
    join(store),
    (error: unknown) =>
      error instanceof HouseholdJoinCommitError &&
      /authority changed/i.test(error.message),
  );

  assert.equal(store.state.users.get(USER_A), HOUSEHOLD_A);
  assert.equal(store.state.memberships.length, 1);
});

test("concurrent acceptance of one invitation commits exactly one user and no impossible partial state", async () => {
  const state = createJoinState();
  state.users.set(USER_B, HOUSEHOLD_C);
  state.memberships.push({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    userId: USER_B,
    householdId: HOUSEHOLD_C,
    role: "owner",
    createdAt: new Date("2026-08-28T08:30:00.000Z"),
  });
  const store = new InMemoryJoinStore(state);

  const results = await Promise.allSettled([
    join(store),
    join(store, { userId: USER_B }),
  ]);

  assert.deepEqual(results.map((result) => result.status).sort(), [
    "fulfilled",
    "rejected",
  ]);
  const acceptedBy = store.state.invitations.get("invite-b")?.acceptedByUserId;
  assert.ok(acceptedBy === USER_A || acceptedBy === USER_B);
  assert.equal(store.state.users.get(acceptedBy), HOUSEHOLD_B);
  const losingUser = acceptedBy === USER_A ? USER_B : USER_A;
  assert.equal(
    store.state.users.get(losingUser),
    losingUser === USER_A ? HOUSEHOLD_A : HOUSEHOLD_C,
  );
  assert.equal(
    store.state.memberships.filter(
      (membership) => membership.householdId === HOUSEHOLD_B,
    ).length,
    1,
  );
  assert.equal(store.state.audits.length, 1);
});

test("serialized joins from one stale source let exactly one target commit", async () => {
  const state = createJoinState();
  state.invitations.set("invite-c", {
    id: "invite-c",
    householdId: HOUSEHOLD_C,
    invitedUserId: null,
    invitedEmail: null,
    role: "adult",
    lifecycleState: "approved",
    acceptedByUserId: null,
    expiresAt: null,
  });
  const store = new InMemoryJoinStore(state);

  const results = await Promise.allSettled([
    join(store),
    join(store, {
      householdId: HOUSEHOLD_C,
      invitationId: "invite-c",
    }),
  ]);

  assert.deepEqual(results.map((result) => result.status).sort(), [
    "fulfilled",
    "rejected",
  ]);
  assert.equal(store.state.users.get(USER_A), HOUSEHOLD_B);
  assert.deepEqual(
    new Set(
      store.state.memberships
        .filter((membership) => membership.userId === USER_A)
        .map((membership) => membership.householdId),
    ),
    new Set([HOUSEHOLD_A, HOUSEHOLD_B]),
  );
  assert.equal(
    store.state.invitations.get("invite-c")?.lifecycleState,
    "approved",
  );
  assert.equal(store.state.audits.length, 1);
});

interface ProvisionState {
  users: Map<
    string,
    {
      id: string;
      displayName: string | null;
      activeHouseholdId: string | null;
    }
  >;
  memberships: Array<{
    id: string;
    userId: string;
    householdId: string;
    role: string;
    accessPassExpiresAt: Date | string | null;
    createdAt: Date;
  }>;
  households: Map<string, string>;
  careStates: Set<string>;
}

function cloneProvisionState(state: ProvisionState): ProvisionState {
  return {
    users: new Map([...state.users].map(([id, user]) => [id, { ...user }])),
    memberships: state.memberships.map((membership) => ({ ...membership })),
    households: new Map(state.households),
    careStates: new Set(state.careStates),
  };
}

class InMemoryProvisionStore {
  state: ProvisionState;
  events: string[] = [];
  householdLockSetCurrent = true;
  private queue: Promise<void> = Promise.resolve();

  constructor(state: ProvisionState) {
    this.state = cloneProvisionState(state);
  }

  async transaction<T>(
    work: (
      transaction: activeHouseholdIdentity.HouseholdProvisionTransaction<{
        id: string;
        displayName: string | null;
        activeHouseholdId: string | null;
      }>,
    ) => Promise<T>,
  ): Promise<T> {
    const previous = this.queue;
    let release = () => {};
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const draft = cloneProvisionState(this.state);
    const events = this.events;
    const store = this;
    try {
      const result = await work({
        async lockUserHouseholds() {
          events.push("serialize-households");
          return [];
        },
        async getCurrentTime() {
          events.push("clock");
          return new Date(AUTHORITY_NOW);
        },
        async lockUser(userId) {
          events.push("lock-user");
          return draft.users.get(userId) ?? null;
        },
        async confirmUserHouseholdsLocked() {
          events.push("confirm-households");
          return store.householdLockSetCurrent;
        },
        async listMemberships(userId) {
          events.push("list-memberships");
          return draft.memberships.filter(
            (membership) => membership.userId === userId,
          );
        },
        async createDefaultHousehold({ name }) {
          const householdId = `default-household-${draft.households.size + 1}`;
          draft.households.set(householdId, name);
          return { householdId };
        },
        async createOwnerMembership(input) {
          const membership = {
            id: `default-member-${draft.memberships.length + 1}`,
            userId: input.userId,
            householdId: input.householdId,
            role: "owner",
            accessPassExpiresAt: null,
            createdAt: new Date("2026-08-28T12:00:00.000Z"),
          };
          draft.memberships.push(membership);
          return membership;
        },
        async ensureCareState(householdId) {
          draft.careStates.add(householdId);
        },
        async setActiveHousehold(userId, householdId) {
          const user = draft.users.get(userId);
          const isMember = draft.memberships.some(
            (membership) =>
              membership.userId === userId &&
              membership.householdId === householdId,
          );
          if (!user || !isMember) return false;
          user.activeHouseholdId = householdId;
          return true;
        },
      });
      this.state = draft;
      return result;
    } finally {
      release();
    }
  }
}

test("concurrent first provisioning calls serialize to exactly one default personal household", async () => {
  const store = new InMemoryProvisionStore({
    users: new Map([
      [USER_A, { id: USER_A, displayName: "Apollo", activeHouseholdId: null }],
    ]),
    memberships: [],
    households: new Map(),
    careStates: new Set(),
  });

  const [first, second] = await Promise.all([
    ensureActiveHouseholdIdentity({ store, userId: USER_A }),
    ensureActiveHouseholdIdentity({ store, userId: USER_A }),
  ]);

  assert.equal(first.householdId, second.householdId);
  assert.deepEqual(
    [first.createdDefaultHousehold, second.createdDefaultHousehold].sort(),
    [false, true],
  );
  assert.equal(store.state.households.size, 1);
  assert.equal(store.state.memberships.length, 1);
  assert.equal(store.state.careStates.size, 1);
  assert.equal(
    store.state.users.get(USER_A)?.activeHouseholdId,
    first.householdId,
  );
});

test("provisioning aborts before membership reads when a join commits in the serializer/user-lock gap", async () => {
  const store = new InMemoryProvisionStore({
    users: new Map([
      [
        USER_A,
        {
          id: USER_A,
          displayName: "Apollo",
          activeHouseholdId: HOUSEHOLD_A,
        },
      ],
    ]),
    memberships: [
      {
        ...membershipA,
        createdAt: new Date(membershipA.createdAt),
      },
    ],
    households: new Map([[HOUSEHOLD_A, "Apollo's Pack"]]),
    careStates: new Set(),
  });
  store.householdLockSetCurrent = false;

  await assert.rejects(
    ensureActiveHouseholdIdentity({ store, userId: USER_A }),
    (error: unknown) =>
      error instanceof HouseholdJoinCommitError && error.status === 409,
  );
  assert.equal(store.events.includes("list-memberships"), false);
  assert.deepEqual(store.events.slice(0, 3), [
    "serialize-households",
    "lock-user",
    "confirm-households",
  ]);
});

test("provisioning repairs a revoked active membership to the deterministic remaining membership", async () => {
  const store = new InMemoryProvisionStore({
    users: new Map([
      [
        USER_A,
        {
          id: USER_A,
          displayName: "Apollo",
          activeHouseholdId: HOUSEHOLD_B,
        },
      ],
    ]),
    memberships: [
      {
        ...membershipA,
        createdAt: new Date(membershipA.createdAt),
      },
    ],
    households: new Map([[HOUSEHOLD_A, "Apollo's Pack"]]),
    careStates: new Set(),
  });

  const result = await ensureActiveHouseholdIdentity({
    store,
    userId: USER_A,
  });

  assert.equal(result.householdId, HOUSEHOLD_A);
  assert.equal(result.createdDefaultHousehold, false);
  assert.equal(store.state.users.get(USER_A)?.activeHouseholdId, HOUSEHOLD_A);
  assert.equal(store.state.careStates.has(HOUSEHOLD_A), true);
  assert.equal(store.state.households.size, 1);
  assert.deepEqual(store.events.slice(0, 3), [
    "serialize-households",
    "lock-user",
    "confirm-households",
  ]);
});

for (const blockedMembership of [
  {
    ...membershipB,
    role: "walker",
    accessPassExpiresAt: "2026-08-28T11:59:59.999Z",
  },
  {
    ...membershipB,
    role: "owner-ish",
    accessPassExpiresAt: null,
  },
] as const) {
  test(`provisioning fails closed for a ${blockedMembership.role} active membership without minting owner authority`, async () => {
    const store = new InMemoryProvisionStore({
      users: new Map([
        [
          USER_A,
          {
            id: USER_A,
            displayName: "Apollo",
            activeHouseholdId: HOUSEHOLD_B,
          },
        ],
      ]),
      memberships: [
        {
          ...blockedMembership,
          createdAt: new Date(blockedMembership.createdAt),
        },
      ],
      households: new Map([[HOUSEHOLD_B, "Unavailable Pack"]]),
      careStates: new Set(),
    });

    await assert.rejects(
      ensureActiveHouseholdIdentity({ store, userId: USER_A }),
      (error: unknown) =>
        error instanceof HouseholdJoinCommitError &&
        error.status === 403 &&
        /expired|invalid/i.test(error.message),
    );

    assert.equal(store.state.households.size, 1);
    assert.equal(store.state.memberships.length, 1);
    assert.equal(store.state.careStates.size, 0);
    assert.equal(
      store.state.users.get(USER_A)?.activeHouseholdId,
      HOUSEHOLD_B,
    );
  });
}

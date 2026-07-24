import { strict as assert } from "node:assert";
import test from "node:test";
import * as householdInvitations from "../src/lib/household-invitations.ts";
import * as householdAuthorization from "../src/lib/household-authorization.ts";
import * as householdAccessPass from "../src/lib/household-access-pass.ts";

const {
  acceptHouseholdInvitationAtomically,
  assertHouseholdInvitationAcceptAllowed,
  deriveHouseholdInvitationRuntimeStatus,
  normalizeHouseholdInvitationListQuery,
  resolveActiveHouseholdSelection,
} = householdInvitations;
const {
  assertActiveHouseholdSelectionAllowed,
  assertHouseholdOwnerActionAllowed,
} = householdAuthorization;
const { deriveAccessPassRuntimeStatus } = householdAccessPass;

type TestMembership = {
  householdId: string;
  role: string;
  accessPassExpiresAt: string | null;
  accessPassExpired?: boolean;
  createdAt: string;
};

type TestInvitation = {
  id: string;
  householdId: string;
  inviteCode: string;
  role: string;
  lifecycleState: string;
  expiresAt: string | null;
  invitedEmail: string | null;
  acceptedByUserId: string | null;
};

function createInvitationStore(input: {
  invitations: TestInvitation[];
  memberships?: Array<{ householdId: string; userId: string; role: string }>;
  activeHouseholds?: Record<string, string | null>;
  failAudit?: boolean;
}) {
  const state = {
    invitations: structuredClone(input.invitations),
    memberships: structuredClone(input.memberships ?? []),
    activeHouseholds: structuredClone(input.activeHouseholds ?? {}),
    audits: [] as Array<{ householdId: string; userId: string; role: string }>,
  };
  let queue = Promise.resolve();

  const transaction = async <T>(
    callback: (tx: {
      claimApprovedInvitation: (claim: {
        code: string;
        userId: string;
        now: Date;
      }) => Promise<TestInvitation | null>;
      classifyInvitation: (code: string) => Promise<TestInvitation | null>;
      createMembership: (membership: {
        householdId: string;
        userId: string;
        role: string;
        displayName: string | null;
      }) => Promise<void>;
      setActiveHousehold: (userId: string, householdId: string) => Promise<void>;
      createAcceptanceAudit: (event: {
        householdId: string;
        userId: string;
        role: string;
      }) => Promise<{ householdId: string; userId: string }>;
    }) => Promise<T>,
  ): Promise<T> => {
    const previous = queue;
    let release = () => {};
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const draft = structuredClone(state);
    try {
      const result = await callback({
        async claimApprovedInvitation({ code, userId, now }) {
          const invitation = draft.invitations.find(
            (row) =>
              row.inviteCode === code &&
              row.lifecycleState === "approved" &&
              (!row.expiresAt ||
                new Date(row.expiresAt).getTime() > now.getTime()),
          );
          if (!invitation) return null;
          invitation.lifecycleState = "accepted";
          invitation.acceptedByUserId = userId;
          return structuredClone(invitation);
        },
        async classifyInvitation(code) {
          return (
            structuredClone(
              draft.invitations.find((row) => row.inviteCode === code),
            ) ?? null
          );
        },
        async createMembership({ householdId, userId, role }) {
          if (
            !draft.memberships.some(
              (row) =>
                row.householdId === householdId && row.userId === userId,
            )
          ) {
            draft.memberships.push({ householdId, userId, role });
          }
        },
        async setActiveHousehold(userId, householdId) {
          draft.activeHouseholds[userId] = householdId;
        },
        async createAcceptanceAudit({ householdId, userId, role }) {
          if (input.failAudit) throw new Error("audit unavailable");
          const event = { householdId, userId, role };
          draft.audits.push(event);
          return event;
        },
      });
      Object.assign(state, draft);
      return result;
    } finally {
      release();
    }
  };

  return { state, transaction };
}

test("household invitation lifecycle blocks unapproved or expired invites before membership creation", () => {
  assert.equal(
    typeof deriveHouseholdInvitationRuntimeStatus,
    "function",
    "household invitations need shared lifecycle logic before join routes create memberships",
  );
  assert.equal(
    typeof assertHouseholdInvitationAcceptAllowed,
    "function",
    "join-by-invite must have an explicit accept policy",
  );

  const now = new Date("2026-06-24T12:00:00.000Z");

  const approved = deriveHouseholdInvitationRuntimeStatus({
    lifecycleState: "approved",
    expiresAt: "2026-06-24T13:00:00.000Z",
    now,
  });
  assert.deepEqual(approved, {
    lifecycleState: "approved",
    runtimeLifecycleState: "approved",
    expiresAt: "2026-06-24T13:00:00.000Z",
    expired: false,
  });
  assert.deepEqual(assertHouseholdInvitationAcceptAllowed(approved), {
    allowed: true,
    lifecycleState: "approved",
  });

  const pending = deriveHouseholdInvitationRuntimeStatus({
    lifecycleState: "pending-approval",
    expiresAt: "2026-06-24T13:00:00.000Z",
    now,
  });
  assert.equal(assertHouseholdInvitationAcceptAllowed(pending).allowed, false);
  assert.match(
    assertHouseholdInvitationAcceptAllowed(pending).reason ?? "",
    /waiting for owner approval/i,
  );

  const expired = deriveHouseholdInvitationRuntimeStatus({
    lifecycleState: "approved",
    expiresAt: "2026-06-24T11:59:59.000Z",
    now,
  });
  assert.deepEqual(expired, {
    lifecycleState: "approved",
    runtimeLifecycleState: "expired",
    expiresAt: "2026-06-24T11:59:59.000Z",
    expired: true,
    reason: "Invitation expired before it was accepted.",
  });
  assert.equal(assertHouseholdInvitationAcceptAllowed(expired).lifecycleState, "expired");
});

test("household invitation list query keeps safe lifecycle filters", () => {
  assert.equal(
    typeof normalizeHouseholdInvitationListQuery,
    "function",
    "owner/admin invitation review needs a shared query normalizer",
  );

  assert.deepEqual(
    normalizeHouseholdInvitationListQuery({
      limit: "500",
      lifecycleState: "APPROVED",
    }),
    {
      limit: 100,
      lifecycleState: "approved",
    },
  );

  assert.deepEqual(
    normalizeHouseholdInvitationListQuery({
      limit: "-10",
      lifecycleState: "unknown",
    }),
    {
      limit: 1,
    },
  );
});

test("active household selection persists H2 and deterministically replaces stale or expired-pass access", async () => {
  assert.equal(
    typeof resolveActiveHouseholdSelection,
    "function",
    "active household resolution needs a durable selection policy",
  );
  if (!resolveActiveHouseholdSelection) return;

  const memberships: TestMembership[] = [
    {
      householdId: "h1",
      role: "owner",
      accessPassExpiresAt: null,
      createdAt: "2026-07-20T10:00:00.000Z",
    },
    {
      householdId: "h2",
      role: "adult",
      accessPassExpiresAt: null,
      createdAt: "2026-07-21T10:00:00.000Z",
    },
  ];
  let persisted: string | null = "h2";
  const h2 = await resolveActiveHouseholdSelection(
    {
      activeHouseholdId: persisted,
      memberships,
      now: new Date("2026-07-23T12:00:00.000Z"),
    },
    async (householdId: string) => {
      persisted = householdId;
    },
  );
  assert.equal(h2, "h2");
  assert.equal(persisted, "h2");

  persisted = "removed-household";
  const fallback = await resolveActiveHouseholdSelection(
    {
      activeHouseholdId: persisted,
      memberships: [
        {
          householdId: "expired-pass",
          role: "sitter",
          accessPassExpiresAt: "2026-07-23T11:59:59.000Z",
          accessPassExpired: true,
          createdAt: "2026-07-19T10:00:00.000Z",
        },
        ...memberships,
      ],
      now: new Date("2026-07-23T12:00:00.000Z"),
    },
    async (householdId: string) => {
      persisted = householdId;
    },
  );
  assert.equal(fallback, "h1");
  assert.equal(persisted, "h1");
});

test("active household selection rejects non-members and expired Access Pass memberships", () => {
  assert.equal(
    typeof assertActiveHouseholdSelectionAllowed,
    "function",
    "the selection endpoint needs an explicit current-membership policy",
  );
  if (!assertActiveHouseholdSelectionAllowed) return;

  assert.deepEqual(
    assertActiveHouseholdSelectionAllowed({
      hasMembership: false,
      accessPassExpired: false,
    }),
    {
      allowed: false,
      reason: "You can only select a household where you are a current member.",
    },
  );
  assert.deepEqual(
    assertActiveHouseholdSelectionAllowed({
      hasMembership: true,
      accessPassExpired: true,
    }),
    {
      allowed: false,
      reason: "An expired Access Pass cannot be selected as the active household.",
    },
  );
  assert.deepEqual(
    assertActiveHouseholdSelectionAllowed({
      hasMembership: true,
      accessPassExpired: false,
    }),
    { allowed: true },
  );
});

test("every expired Access Pass role alias is ineligible and persists the deterministic fallback", async () => {
  assert.equal(typeof deriveAccessPassRuntimeStatus, "function");
  assert.equal(typeof resolveActiveHouseholdSelection, "function");
  if (!deriveAccessPassRuntimeStatus || !resolveActiveHouseholdSelection) return;

  const aliases = [
    "sitter",
    "trainer",
    "walker",
    "helper",
    "temporary helper",
    "viewer",
    "vet",
    "vet viewer",
    "veterinary viewer",
    "read-only",
    "readonly",
  ];
  const now = new Date("2026-07-23T12:00:00.000Z");

  for (const role of aliases) {
    const runtime = deriveAccessPassRuntimeStatus({
      role,
      accessPassExpiresAt: "2026-07-23T11:59:59.000Z",
      now,
    });
    assert.equal(runtime.accessPassExpired, true, `${role} should expire`);
    let persisted: string | null = "expired-h2";
    const selected = await resolveActiveHouseholdSelection(
      {
        activeHouseholdId: persisted,
        memberships: [
          {
            householdId: "expired-h2",
            role,
            accessPassExpiresAt: "2026-07-23T11:59:59.000Z",
            accessPassExpired: runtime.accessPassExpired,
            createdAt: "2026-07-20T10:00:00.000Z",
          },
          {
            householdId: "eligible-h1",
            role: "adult",
            accessPassExpiresAt: null,
            accessPassExpired: false,
            createdAt: "2026-07-21T10:00:00.000Z",
          },
        ],
        now,
      },
      async (householdId: string) => {
        persisted = householdId;
      },
    );
    assert.equal(selected, "eligible-h1", `${role} must not remain active`);
    assert.equal(persisted, "eligible-h1", `${role} must persist fallback`);
  }
});

test("atomic invitation acceptance grants exactly one of two distinct users and makes that household active", async () => {
  assert.equal(
    typeof acceptHouseholdInvitationAtomically,
    "function",
    "join needs a transaction coordinator whose first authority action is the invitation claim",
  );
  if (!acceptHouseholdInvitationAtomically) return;

  const store = createInvitationStore({
    invitations: [
      {
        id: "invite-1",
        householdId: "h2",
        inviteCode: "PACK2026",
        role: "adult",
        lifecycleState: "approved",
        expiresAt: "2026-07-24T12:00:00.000Z",
        invitedEmail: "delivery-label@example.com",
        acceptedByUserId: null,
      },
    ],
    activeHouseholds: { user_a: "h1", user_b: "h3" },
  });

  const results = await Promise.allSettled(
    ["user_a", "user_b"].map((userId) =>
      acceptHouseholdInvitationAtomically(
        {
          code: "PACK2026",
          userId,
          displayName: userId,
          now: new Date("2026-07-23T12:00:00.000Z"),
        },
        store,
      ),
    ),
  );

  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  const winner = store.state.invitations[0].acceptedByUserId;
  assert.ok(winner === "user_a" || winner === "user_b");
  assert.deepEqual(store.state.memberships, [
    { householdId: "h2", userId: winner, role: "adult" },
  ]);
  assert.equal(store.state.activeHouseholds[winner], "h2");
  assert.deepEqual(store.state.audits, [
    { householdId: "h2", userId: winner, role: "adult" },
  ]);
});

test("claimed owner aliases are clamped to adult for membership and audit", async () => {
  assert.equal(typeof acceptHouseholdInvitationAtomically, "function");
  if (!acceptHouseholdInvitationAtomically) return;

  for (const role of ["owner", "admin", "adult admin"]) {
    const inviteCode = `ROLE-${role.replace(/\s+/g, "-")}`.toUpperCase();
    const store = createInvitationStore({
      invitations: [
        {
          id: `invite-${role}`,
          householdId: "h2",
          inviteCode,
          role,
          lifecycleState: "approved",
          expiresAt: "2026-07-24T12:00:00.000Z",
          invitedEmail: null,
          acceptedByUserId: null,
        },
      ],
    });
    await acceptHouseholdInvitationAtomically(
      {
        code: inviteCode,
        userId: `user-${role}`,
        displayName: role,
        now: new Date("2026-07-23T12:00:00.000Z"),
      },
      store,
    );
    assert.equal(store.state.memberships[0]?.role, "adult", role);
    assert.equal(store.state.audits[0]?.role, "adult", role);
  }
});

test("invitation claim rejects permanent, accepted, revoked, and expired codes without creating access", async () => {
  assert.equal(typeof acceptHouseholdInvitationAtomically, "function");
  if (!acceptHouseholdInvitationAtomically) return;

  const store = createInvitationStore({
    invitations: [
      {
        id: "accepted",
        householdId: "h2",
        inviteCode: "ACCEPTED",
        role: "adult",
        lifecycleState: "accepted",
        expiresAt: "2026-07-24T12:00:00.000Z",
        invitedEmail: null,
        acceptedByUserId: "someone_else",
      },
      {
        id: "revoked",
        householdId: "h2",
        inviteCode: "REVOKED",
        role: "adult",
        lifecycleState: "revoked",
        expiresAt: "2026-07-24T12:00:00.000Z",
        invitedEmail: null,
        acceptedByUserId: null,
      },
      {
        id: "expired",
        householdId: "h2",
        inviteCode: "EXPIRED",
        role: "adult",
        lifecycleState: "approved",
        expiresAt: "2026-07-23T11:59:59.000Z",
        invitedEmail: null,
        acceptedByUserId: null,
      },
    ],
    activeHouseholds: { user_c: "h1" },
  });

  for (const code of ["LEGACY-HOUSEHOLD-CODE", "ACCEPTED", "REVOKED", "EXPIRED"]) {
    await assert.rejects(
      acceptHouseholdInvitationAtomically(
        {
          code,
          userId: "user_c",
          displayName: "C",
          now: new Date("2026-07-23T12:00:00.000Z"),
        },
        store,
      ),
    );
  }
  assert.deepEqual(store.state.memberships, []);
  assert.deepEqual(store.state.audits, []);
  assert.equal(store.state.activeHouseholds.user_c, "h1");
});

test("invitation possession is the acceptance authority; invitedEmail is a delivery label, not recipient binding", async () => {
  assert.equal(typeof acceptHouseholdInvitationAtomically, "function");
  if (!acceptHouseholdInvitationAtomically) return;

  const store = createInvitationStore({
    invitations: [
      {
        id: "invite-recipient-label",
        householdId: "h2",
        inviteCode: "POSSESSION",
        role: "adult",
        lifecycleState: "approved",
        expiresAt: "2026-07-24T12:00:00.000Z",
        invitedEmail: "different-person@example.com",
        acceptedByUserId: null,
      },
    ],
  });
  await acceptHouseholdInvitationAtomically(
    {
      code: "POSSESSION",
      userId: "code_holder",
      displayName: "Code Holder",
      now: new Date("2026-07-23T12:00:00.000Z"),
    },
    store,
  );
  assert.equal(store.state.invitations[0].acceptedByUserId, "code_holder");
});

test("invitation acceptance rolls back claim, membership, active selection, and audit together", async () => {
  assert.equal(typeof acceptHouseholdInvitationAtomically, "function");
  if (!acceptHouseholdInvitationAtomically) return;

  const store = createInvitationStore({
    invitations: [
      {
        id: "invite-rollback",
        householdId: "h2",
        inviteCode: "ROLLBACK",
        role: "adult",
        lifecycleState: "approved",
        expiresAt: "2026-07-24T12:00:00.000Z",
        invitedEmail: null,
        acceptedByUserId: null,
      },
    ],
    activeHouseholds: { user_d: "h1" },
    failAudit: true,
  });

  await assert.rejects(
    acceptHouseholdInvitationAtomically(
      {
        code: "ROLLBACK",
        userId: "user_d",
        displayName: "D",
        now: new Date("2026-07-23T12:00:00.000Z"),
      },
      store,
    ),
    /audit unavailable/,
  );
  assert.equal(store.state.invitations[0].lifecycleState, "approved");
  assert.equal(store.state.invitations[0].acceptedByUserId, null);
  assert.deepEqual(store.state.memberships, []);
  assert.equal(store.state.activeHouseholds.user_d, "h1");
  assert.deepEqual(store.state.audits, []);
});

test("owner/admin alone can rename households or create invitations", () => {
  assert.equal(
    typeof assertHouseholdOwnerActionAllowed,
    "function",
    "rename and invitation creation need one owner/admin policy boundary",
  );
  if (!assertHouseholdOwnerActionAllowed) return;

  for (const role of ["owner", "admin"]) {
    assert.equal(assertHouseholdOwnerActionAllowed(role, "rename").allowed, true);
    assert.equal(
      assertHouseholdOwnerActionAllowed(role, "create invitation").allowed,
      true,
    );
  }
  for (const role of [
    "adult",
    "helper",
    "kid",
    "expired access pass",
  ]) {
    assert.equal(assertHouseholdOwnerActionAllowed(role, "rename").allowed, false);
    assert.equal(
      assertHouseholdOwnerActionAllowed(role, "create invitation").allowed,
      false,
    );
  }
});

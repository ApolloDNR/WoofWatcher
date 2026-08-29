import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HouseholdInvitationRevocationError,
  revokePreAcceptanceInvitation,
  type HouseholdInvitationRevocationStore,
} from "../src/lib/household-invitation-revocation.ts";

type Audit = { id: string };

function createStore(input: {
  actorRole?: string | null;
  lifecycleState?: string;
  conditionalUpdateSucceeds?: boolean;
}) {
  const events: string[] = [];
  const store: HouseholdInvitationRevocationStore<Audit> = {
    async transaction(work) {
      return work({
        async lockActorMembership() {
          events.push("lock-actor");
          return input.actorRole === null
            ? null
            : { role: input.actorRole ?? "owner" };
        },
        async lockInvitation() {
          events.push("lock-invitation");
          return {
            id: "invite-a",
            householdId: "household-a",
            lifecycleState: input.lifecycleState ?? "approved",
            role: "adult",
            expiresAt: null,
            note: null,
          };
        },
        async revokePendingInvitation() {
          events.push("revoke");
          if (input.conditionalUpdateSucceeds === false) return null;
          return {
            id: "invite-a",
            householdId: "household-a",
            lifecycleState: "revoked",
            role: "adult",
            expiresAt: null,
            note: "Owner revoked before acceptance.",
          };
        },
        async recordAudit() {
          events.push("audit");
        },
      });
    },
  };
  return { store, events };
}

test("pre-acceptance invitation revocation conditionally updates and audits inside one transaction", async () => {
  const { store, events } = createStore({ lifecycleState: "approved" });
  const result = await revokePreAcceptanceInvitation({
    store,
    actorUserId: "owner-a",
    householdId: "household-a",
    invitationId: "invite-a",
    reason: "Owner revoked before acceptance.",
    now: new Date("2026-08-28T12:00:00.000Z"),
    buildAuditEvent() {
      return { id: "audit-a" };
    },
  });

  assert.deepEqual(events, [
    "lock-actor",
    "lock-invitation",
    "revoke",
    "audit",
  ]);
  assert.equal(result.invitation.lifecycleState, "revoked");
  assert.deepEqual(result.auditEvent, { id: "audit-a" });
});

for (const lifecycleState of ["accepted", "revoked", "expired", "rejected"]) {
  test(`invitation revocation treats ${lifecycleState} as terminal and performs zero writes`, async () => {
    const { store, events } = createStore({ lifecycleState });

    await assert.rejects(
      revokePreAcceptanceInvitation({
        store,
        actorUserId: "owner-a",
        householdId: "household-a",
        invitationId: "invite-a",
        reason: null,
        buildAuditEvent() {
          return { id: "should-not-build" };
        },
      }),
      (error: unknown) =>
        error instanceof HouseholdInvitationRevocationError &&
        error.status === 409,
    );

    assert.deepEqual(events, ["lock-actor", "lock-invitation"]);
  });
}

test("a helper cannot revoke an invitation and no invitation row is read or written", async () => {
  const { store, events } = createStore({ actorRole: "sitter" });

  await assert.rejects(
    revokePreAcceptanceInvitation({
      store,
      actorUserId: "helper-a",
      householdId: "household-a",
      invitationId: "invite-a",
      reason: null,
      buildAuditEvent() {
        return { id: "should-not-build" };
      },
    }),
    (error: unknown) =>
      error instanceof HouseholdInvitationRevocationError &&
      error.status === 403,
  );

  assert.deepEqual(events, ["lock-actor"]);
});

test("Join winning after the row lock is represented by a failed conditional revoke with no audit", async () => {
  const { store, events } = createStore({
    lifecycleState: "approved",
    conditionalUpdateSucceeds: false,
  });

  await assert.rejects(
    revokePreAcceptanceInvitation({
      store,
      actorUserId: "owner-a",
      householdId: "household-a",
      invitationId: "invite-a",
      reason: null,
      buildAuditEvent() {
        return { id: "should-not-persist" };
      },
    }),
    (error: unknown) =>
      error instanceof HouseholdInvitationRevocationError &&
      error.status === 409,
  );

  assert.deepEqual(events, ["lock-actor", "lock-invitation", "revoke"]);
});

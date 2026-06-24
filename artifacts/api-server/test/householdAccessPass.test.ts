import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertAccessPassExpiryAllowed,
  buildHouseholdAuditEvent,
  buildHouseholdAuditInsert,
} from "../src/lib/household-access-pass.ts";

test("Access Pass activation rejects expired helper windows", () => {
  const now = new Date("2026-06-24T12:00:00.000Z");

  assert.deepEqual(assertAccessPassExpiryAllowed(null, now), {
    allowed: true,
    expiresAt: null,
    lifecycleState: "access-pass-active",
  });

  assert.deepEqual(assertAccessPassExpiryAllowed("2026-06-24T12:30:00.000Z", now), {
    allowed: true,
    expiresAt: "2026-06-24T12:30:00.000Z",
    lifecycleState: "access-pass-active",
  });

  assert.deepEqual(assertAccessPassExpiryAllowed("2026-06-24T11:59:59.000Z", now), {
    allowed: false,
    expiresAt: "2026-06-24T11:59:59.000Z",
    lifecycleState: "access-pass-expired",
    reason: "Access Pass expiration must be in the future before helper access can be activated.",
  });

  assert.deepEqual(assertAccessPassExpiryAllowed("not a date", now), {
    allowed: false,
    expiresAt: null,
    lifecycleState: "access-pass-expired",
    reason: "Access Pass expiration must be a valid ISO date.",
  });
});

test("household audit events map to durable provider insert records", () => {
  const event = buildHouseholdAuditEvent(
    {
      action: "access-pass-activated",
      actorUserId: "user_owner",
      householdId: "11111111-1111-4111-8111-111111111111",
      targetMemberId: "22222222-2222-4222-8222-222222222222",
      targetUserId: "user_helper",
      targetRole: "adult",
      nextRole: "sitter",
      reason: "Owner/admin Access Pass activation is allowed.",
      note: "Weekend trip",
      expiresAt: "2026-06-25T12:00:00.000Z",
    },
    new Date("2026-06-24T12:00:00.000Z"),
  );

  assert.equal(event.storage, "provider-durable");
  assert.equal(event.lifecycleState, "access-pass-active");
  assert.match(event.boundary, /durable provider audit storage/i);

  assert.deepEqual(buildHouseholdAuditInsert(event), {
    id: event.id,
    action: "access-pass-activated",
    lifecycleState: "access-pass-active",
    actorUserId: "user_owner",
    householdId: "11111111-1111-4111-8111-111111111111",
    targetMemberId: "22222222-2222-4222-8222-222222222222",
    targetUserId: "user_helper",
    targetRole: "adult",
    nextRole: "sitter",
    reason: "Owner/admin Access Pass activation is allowed.",
    note: "Weekend trip",
    expiresAt: new Date("2026-06-25T12:00:00.000Z"),
    createdAt: new Date("2026-06-24T12:00:00.000Z"),
    metadata: {
      boundary:
        "Durable provider audit storage is ready for household invite, role, and Access Pass mutations; retention/export/deletion policy remains a launch approval gate.",
      storage: "provider-durable",
    },
  });
});

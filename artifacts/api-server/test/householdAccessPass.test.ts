import assert from "node:assert/strict";
import { test } from "node:test";

import * as householdAccessPass from "../src/lib/household-access-pass.ts";

const {
  assertAccessPassExpiryAllowed,
  buildHouseholdAuditEvent,
  buildHouseholdAuditInsert,
  deriveAccessPassRuntimeStatus,
} = householdAccessPass;

test("Access Pass activation rejects expired helper windows", () => {
  const now = new Date("2026-06-24T12:00:00.000Z");

  assert.deepEqual(assertAccessPassExpiryAllowed(null, now), {
    allowed: true,
    expiresAt: null,
    lifecycleState: "access-pass-active",
  });

  assert.deepEqual(
    assertAccessPassExpiryAllowed("2026-06-24T12:30:00.000Z", now),
    {
      allowed: true,
      expiresAt: "2026-06-24T12:30:00.000Z",
      lifecycleState: "access-pass-active",
    },
  );

  assert.deepEqual(
    assertAccessPassExpiryAllowed("2026-06-24T11:59:59.000Z", now),
    {
      allowed: false,
      expiresAt: "2026-06-24T11:59:59.000Z",
      lifecycleState: "access-pass-expired",
      reason:
        "Access Pass expiration must be in the future before helper access can be activated.",
    },
  );

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

test("identical household audit events created in the same millisecond receive collision-safe ids", () => {
  const input = {
    action: "invitation-created" as const,
    actorUserId: "user_owner",
    householdId: "11111111-1111-4111-8111-111111111111",
    nextRole: "adult",
  };
  const now = new Date("2026-08-28T12:00:00.000Z");

  const first = buildHouseholdAuditEvent(input, now);
  const second = buildHouseholdAuditEvent(input, now);

  assert.notEqual(first.id, second.id);
  assert.match(first.id, /^household_audit_[0-9a-f-]{36}$/i);
  assert.match(second.id, /^household_audit_[0-9a-f-]{36}$/i);
  assert.equal(first.createdAt, second.createdAt);
});

test("household audit review queries clamp limits and preserve safe filters", () => {
  const normalizeHouseholdAuditListQuery = (
    householdAccessPass as typeof householdAccessPass & {
      normalizeHouseholdAuditListQuery?: (query: Record<string, unknown>) => {
        limit: number;
        action?: string;
        lifecycleState?: string;
      };
    }
  ).normalizeHouseholdAuditListQuery;

  assert.equal(
    typeof normalizeHouseholdAuditListQuery,
    "function",
    "audit review should expose a shared query normalizer",
  );

  assert.deepEqual(
    normalizeHouseholdAuditListQuery({
      limit: "500",
      action: "access-pass-activated",
      lifecycleState: "access-pass-active",
    }),
    {
      limit: 100,
      action: "access-pass-activated",
      lifecycleState: "access-pass-active",
    },
  );

  assert.deepEqual(
    normalizeHouseholdAuditListQuery({
      limit: "0",
      action: "made-up-action",
      lifecycleState: "made-up-state",
    }),
    {
      limit: 1,
    },
  );

  assert.deepEqual(normalizeHouseholdAuditListQuery({}), {
    limit: 50,
  });
});

test("Access Pass runtime status expires helper authority at request time", () => {
  assert.equal(
    typeof deriveAccessPassRuntimeStatus,
    "function",
    "Access Pass helpers need request-time expiry enforcement before scheduler cleanup is approved",
  );

  const now = new Date("2026-06-24T12:00:00.000Z");

  assert.deepEqual(
    deriveAccessPassRuntimeStatus({
      role: "sitter",
      accessPassExpiresAt: "2026-06-24T12:30:00.000Z",
      now,
    }),
    {
      role: "sitter",
      authorizationRole: "sitter",
      accessPassExpiresAt: "2026-06-24T12:30:00.000Z",
      accessPassExpired: false,
    },
  );

  assert.deepEqual(
    deriveAccessPassRuntimeStatus({
      role: "sitter",
      accessPassExpiresAt: "2026-06-24T11:59:59.000Z",
      now,
    }),
    {
      role: "sitter",
      authorizationRole: "expired access pass",
      accessPassExpiresAt: "2026-06-24T11:59:59.000Z",
      accessPassExpired: true,
      reason:
        "Access Pass expired; helper writes should be blocked until an owner/admin renews access.",
    },
  );

  assert.deepEqual(
    deriveAccessPassRuntimeStatus({
      role: "adult",
      accessPassExpiresAt: "2026-06-24T11:59:59.000Z",
      now,
    }),
    {
      role: "adult",
      authorizationRole: "adult",
      accessPassExpiresAt: "2026-06-24T11:59:59.000Z",
      accessPassExpired: false,
    },
  );
});

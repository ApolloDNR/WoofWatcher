import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HOUSEHOLD_MEMBER_ROLES,
  parseHouseholdMemberRole,
  resolveHouseholdMembershipAuthority,
} from "../src/lib/household-role-authority.ts";
import { applyCareEntryWritePolicy } from "../src/lib/care-entry-authorization.ts";
import {
  assertAccessPassMutationAllowed,
  deriveAccessPassRuntimeStatus,
  normalizeAccessPassRole,
} from "../src/lib/household-access-pass.ts";
import {
  assertHouseholdMemberMutationAllowed,
  normalizeHouseholdMemberRole,
} from "../src/lib/household-authorization.ts";

const NOW = new Date("2026-08-28T12:00:00.000Z");

test("canonical household roles and only explicit legacy aliases resolve", () => {
  for (const role of HOUSEHOLD_MEMBER_ROLES) {
    assert.equal(parseHouseholdMemberRole(role), role);
  }

  assert.deepEqual(
    [
      "admin",
      "adult admin",
      "member",
      "primary caregiver",
      "child",
      "minor",
      "helper",
      "temporary helper",
      "viewer",
      "vet",
      "veterinary viewer",
      "read-only",
      "readonly",
    ].map((role) => parseHouseholdMemberRole(role)),
    [
      "owner",
      "owner",
      "adult",
      "adult",
      "kid",
      "kid",
      "sitter",
      "sitter",
      "vet viewer",
      "vet viewer",
      "vet viewer",
      "vet viewer",
      "vet viewer",
    ],
  );

  for (const role of [
    null,
    "",
    "former owner",
    "owner-ish",
    "super-admin",
    "expired access pass",
  ]) {
    assert.equal(parseHouseholdMemberRole(role), null, String(role));
  }
});

test("membership authority uses the supplied provider clock and expires at the exact boundary", () => {
  assert.deepEqual(
    resolveHouseholdMembershipAuthority({
      role: "temporary helper",
      accessPassExpiresAt: "2026-08-28T12:00:00.001Z",
      now: NOW,
    }),
    {
      state: "active",
      role: "sitter",
      authorizationRole: "sitter",
      accessPassExpiresAt: "2026-08-28T12:00:00.001Z",
      accessPassExpired: false,
      householdAccessAllowed: true,
    },
  );

  assert.deepEqual(
    resolveHouseholdMembershipAuthority({
      role: "temporary helper",
      accessPassExpiresAt: NOW,
      now: NOW,
    }),
    {
      state: "expired",
      role: "sitter",
      authorizationRole: "expired access pass",
      accessPassExpiresAt: NOW.toISOString(),
      accessPassExpired: true,
      householdAccessAllowed: false,
    },
  );
});

test("unknown roles, corrupt expiry, and an invalid provider clock fail closed", () => {
  for (const input of [
    { role: "former owner", accessPassExpiresAt: null, now: NOW },
    { role: "owner", accessPassExpiresAt: "not-a-date", now: NOW },
    {
      role: "owner",
      accessPassExpiresAt: null,
      now: new Date("not-a-date"),
    },
  ]) {
    const authority = resolveHouseholdMembershipAuthority(input);
    assert.equal(authority.state, "invalid");
    assert.equal(authority.authorizationRole, "invalid household role");
    assert.equal(authority.householdAccessAllowed, false);
  }
});

test("all existing write-policy primitives consume the strict role authority", () => {
  assert.equal(normalizeHouseholdMemberRole("member"), "adult");
  assert.equal(normalizeHouseholdMemberRole("former owner"), "");
  assert.equal(normalizeAccessPassRole("helper"), "sitter");
  assert.equal(normalizeAccessPassRole("former owner"), "");

  assert.equal(
    applyCareEntryWritePolicy({ role: "former owner", action: "create" })
      .allowed,
    false,
  );
  assert.equal(
    applyCareEntryWritePolicy({
      role: "expired access pass",
      action: "create",
    }).allowed,
    false,
  );
  assert.equal(
    applyCareEntryWritePolicy({
      role: "primary caregiver",
      action: "create",
    }).allowed,
    true,
  );

  assert.equal(
    assertHouseholdMemberMutationAllowed({
      actorRole: "owner-ish",
      targetRole: "sitter",
      action: "revoke",
    }).allowed,
    false,
  );
  assert.equal(
    assertHouseholdMemberMutationAllowed({
      actorRole: "owner",
      targetRole: "unknown helper",
      action: "revoke",
    }).allowed,
    false,
  );
  assert.equal(
    assertAccessPassMutationAllowed({
      actorRole: "owner",
      targetRole: "unknown helper",
      action: "revoke",
    }).allowed,
    false,
  );

  assert.deepEqual(
    deriveAccessPassRuntimeStatus({
      role: "former owner",
      accessPassExpiresAt: null,
      now: NOW,
    }),
    {
      role: "",
      authorizationRole: "invalid household role",
      accessPassExpiresAt: null,
      accessPassExpired: false,
      reason: "Household role or Access Pass authority is invalid.",
    },
  );
});

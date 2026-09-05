import assert from "node:assert/strict";
import { test } from "node:test";

import * as careDomain from "../src/index.ts";

type HouseholdSettingsAccess = {
  allowed: boolean;
  reason?: string;
};

type DeriveHouseholdSettingsAccess = (
  role: string | null | undefined,
) => HouseholdSettingsAccess;

type CanCurrentMemberManageHouseholdSettings = (
  members:
    | readonly { isSelf?: boolean | null; role?: string | null }[]
    | null
    | undefined,
) => boolean;

function householdSettingsPolicy() {
  const derive = (
    careDomain as typeof careDomain & {
      deriveHouseholdSettingsAccess?: DeriveHouseholdSettingsAccess;
    }
  ).deriveHouseholdSettingsAccess;
  const canCurrentMemberManage = (
    careDomain as typeof careDomain & {
      canCurrentMemberManageHouseholdSettings?: CanCurrentMemberManageHouseholdSettings;
    }
  ).canCurrentMemberManageHouseholdSettings;

  assert.equal(
    typeof derive,
    "function",
    "the shared domain must expose the owner/admin household-settings policy",
  );
  assert.equal(
    typeof canCurrentMemberManage,
    "function",
    "mobile clients must resolve the exact signed-in member through the shared policy",
  );

  return {
    derive: derive as DeriveHouseholdSettingsAccess,
    canCurrentMemberManage:
      canCurrentMemberManage as CanCurrentMemberManageHouseholdSettings,
  };
}

test("allows only owner/admin roles to change household settings", () => {
  const { derive } = householdSettingsPolicy();

  for (const role of ["owner", "admin", "adult admin"] as const) {
    assert.deepEqual(derive(role), { allowed: true }, role);
  }

  for (const role of [
    "adult",
    "teen",
    "kid",
    "sitter",
    "trainer",
    "walker",
    "vet viewer",
    "unknown",
    null,
  ] as const) {
    const access = derive(role);
    assert.equal(access.allowed, false, String(role));
    assert.match(access.reason ?? "", /owner\/admin/i, String(role));
  }
});

test("fails closed unless exactly one current member has owner/admin authority", () => {
  const { canCurrentMemberManage } = householdSettingsPolicy();

  assert.equal(
    canCurrentMemberManage([
      { isSelf: true, role: "owner" },
      { isSelf: false, role: "adult" },
    ]),
    true,
  );
  assert.equal(
    canCurrentMemberManage([{ isSelf: true, role: "adult" }]),
    false,
  );
  assert.equal(canCurrentMemberManage([]), false);
  assert.equal(
    canCurrentMemberManage([
      { isSelf: true, role: "owner" },
      { isSelf: true, role: "owner" },
    ]),
    false,
    "ambiguous self membership must not expose privileged household settings",
  );
});

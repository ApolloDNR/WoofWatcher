import {
  careStateTable,
  db,
  householdMembersTable,
  householdsTable,
  usersTable,
} from "@workspace/db";

import {
  activateRetainedHousehold,
  listSwitchableHouseholdMemberships,
} from "./household-membership-activation.ts";
import { createDrizzleHouseholdMembershipStore } from "./household-membership-drizzle-store.ts";

const providerHouseholdMembershipStore = () =>
  createDrizzleHouseholdMembershipStore({
    database: db,
    tables: {
      usersTable,
      householdMembersTable,
      householdsTable,
      careStateTable,
    },
  });

export async function listMyHouseholdMembershipsFromProvider(input: {
  userId: string;
  expectedSourceHouseholdId: string;
}) {
  return listSwitchableHouseholdMemberships({
    store: providerHouseholdMembershipStore(),
    ...input,
  });
}

export async function activateHouseholdFromProvider(input: {
  userId: string;
  expectedSourceHouseholdId: string;
  targetHouseholdId: string;
}) {
  return activateRetainedHousehold({
    store: providerHouseholdMembershipStore(),
    ...input,
  });
}

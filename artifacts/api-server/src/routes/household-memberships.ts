import { getUserId, requireAuth } from "../lib/auth.ts";
import {
  activateHouseholdFromProvider,
  listMyHouseholdMembershipsFromProvider,
} from "../lib/household-membership-store.ts";
import { createHouseholdMembershipRouter } from "./household-membership-router.ts";

export default createHouseholdMembershipRouter({
  requireAuth,
  getUserId,
  listMemberships: listMyHouseholdMembershipsFromProvider,
  activateMembership: activateHouseholdFromProvider,
});

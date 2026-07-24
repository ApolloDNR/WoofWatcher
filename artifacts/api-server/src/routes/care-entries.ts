import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import {
  db,
  careEntriesTable,
  careEntryTombstonesTable,
  householdsTable,
} from "@workspace/db";
import { requireAuth, getUserId } from "../lib/auth.ts";
import {
  getActiveHouseholdId,
  getCaregiverName,
  getHouseholdMemberAuthz,
} from "../lib/household.ts";
import { createCareEntriesRouter } from "./care-entries-router.ts";

const router = createCareEntriesRouter({
  db,
  careEntriesTable,
  careEntryTombstonesTable,
  householdsTable,
  queryOps: { and, desc, eq, gte, lt, or, sql },
  requireAuth,
  getUserId,
  getActiveHouseholdId,
  getCaregiverName,
  getHouseholdMemberAuthz,
  now: () => new Date(),
});

export { createCareEntriesRouter };
export default router;

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, careEntriesTable, careEntryTombstonesTable } from "@workspace/db";
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
  queryOps: { and, desc, eq, gte, sql },
  requireAuth,
  getUserId,
  getActiveHouseholdId,
  getCaregiverName,
  getHouseholdMemberAuthz,
  now: () => new Date(),
});

export { createCareEntriesRouter };
export default router;

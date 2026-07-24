import { and, eq, sql } from "drizzle-orm";
import { db, careStateTable } from "@workspace/db";
import { requireAuth, getUserId } from "../lib/auth";
import { getActiveHouseholdId } from "../lib/household";
import { createCareStateRouter } from "./care-state-router";

const router = createCareStateRouter({
  db,
  careStateTable,
  queryOps: { and, eq, sql },
  requireAuth,
  getUserId,
  getActiveHouseholdId,
});

export { createCareStateRouter };
export default router;

import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, careStateTable } from "@workspace/db";
import { GetCareStateResponse, PutCareStateBody } from "@workspace/api-zod";
import { requireAuth, getUserId } from "../lib/auth.ts";
import {
  getActiveHouseholdId,
  getHouseholdMemberAuthz,
} from "../lib/household.ts";
import { createCareStateRouter } from "./care-state-router.ts";

const router: IRouter = createCareStateRouter({
  createRouter: Router,
  db,
  careStateTable,
  queryOps: { and, eq },
  schemas: { GetCareStateResponse, PutCareStateBody },
  requireAuth,
  getUserId,
  getActiveHouseholdId,
  getHouseholdMemberAuthz,
}) as IRouter;

export { createCareStateRouter };
export default router;

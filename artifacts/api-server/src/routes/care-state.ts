import { and, eq } from "drizzle-orm";
import {
  careStateTable,
  db,
  householdMembersTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, getUserId } from "../lib/auth";
import { createHouseholdScopedOperationRunner } from "../lib/household-scoped-operation.ts";
import { createDrizzleHouseholdScopedOperationStore } from "../lib/household-scoped-operation-store.ts";
import { createCareStateRouter } from "./care-state-router.ts";

const runHouseholdScopedOperation = createHouseholdScopedOperationRunner(
  createDrizzleHouseholdScopedOperationStore({
    database: db,
    tables: { usersTable, householdMembersTable },
  }),
);

const router = createCareStateRouter({
  careStateTable,
  and,
  eq,
  requireAuth,
  getUserId,
  runHouseholdScopedOperation,
});

export { createCareStateRouter };
export default router;

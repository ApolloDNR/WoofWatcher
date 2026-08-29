import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import {
  careEntriesTable,
  careEntryTombstonesTable,
  db,
  householdMembersTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, getUserId } from "../lib/auth.ts";
import { createHouseholdScopedOperationRunner } from "../lib/household-scoped-operation.ts";
import { createDrizzleHouseholdScopedOperationStore } from "../lib/household-scoped-operation-store.ts";
import { createCareEntriesRouter } from "./care-entries-router.ts";

const runHouseholdScopedOperation = createHouseholdScopedOperationRunner(
  createDrizzleHouseholdScopedOperationStore({
    database: db,
    tables: { usersTable, householdMembersTable },
  }),
);

const router = createCareEntriesRouter({
  careEntriesTable,
  careEntryTombstonesTable,
  queryOps: { and, desc, eq, gte, or, sql },
  requireAuth,
  getUserId,
  runHouseholdScopedOperation,
});

export { createCareEntriesRouter };
export default router;

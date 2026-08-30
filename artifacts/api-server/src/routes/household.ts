import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, householdsTable, householdAuditEventsTable, householdInvitationsTable, householdMembersTable, usersTable } from "@workspace/db";
import {
  GetMeResponse,
  JoinHouseholdResponse,
  UpdateMeBody,
  JoinHouseholdBody,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../lib/auth";
import { ensureUserAndHousehold, buildMe, buildMeInTransaction, getFreshVerifiedHouseholdJoinIdentity, updateHouseholdProfileAtomically } from "../lib/household";
import { HouseholdAuthoritySnapshotError } from "../lib/household-me-snapshot.ts";
import { HouseholdJoinCommitError, commitHouseholdJoin } from "../lib/household-join";
import {
  buildHouseholdAuditInsert,
} from "../lib/household-access-pass";
import { parseExpectedHouseholdCapability, verifyExpectedHouseholdCapability } from "./household-capability.ts";
import { createDrizzleHouseholdInvitationCreateStore } from "../lib/household-invitation-create-drizzle-store.ts";
import { createDrizzleHouseholdScopedOperationStore } from "../lib/household-scoped-operation-store.ts";
import { createHouseholdScopedOperationRunner } from "../lib/household-scoped-operation.ts";
import {
  createHouseholdInvitationCreateHandler,
  type InvitationCreatedHouseholdAuditEvent,
} from "./household-invitation-create-handler.ts";
import { runHouseholdAuthorityRequest } from "./household-authority-response.ts";
import { createHouseholdManagementRouter } from "./household-management-router.ts";

const router: IRouter = Router();

const INVITATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeInvitationCode(): string {
  return Array.from(randomBytes(8), (byte) => INVITATION_CODE_ALPHABET[byte % INVITATION_CODE_ALPHABET.length]).join("");
}

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  res.set("Cache-Control", "private, no-store");
  const userId = getUserId(req);
  const me = await runHouseholdAuthorityRequest({
    res,
    async operation() {
      const { householdId } = await ensureUserAndHousehold(userId);
      return buildMe(userId, householdId);
    },
  });
  if (!me) return;
  res.json(GetMeResponse.parse(me));
});

router.patch("/me", requireAuth, async (req, res): Promise<void> => {
  res.set("Cache-Control", "private, no-store");
  const userId = getUserId(req);
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const me = await runHouseholdAuthorityRequest({
    res,
    async operation() {
      return updateHouseholdProfileAtomically({
        userId,
        displayName: parsed.data.displayName,
      });
    },
  });
  if (!me) return;
  res.json(GetMeResponse.parse(me));
});

router.post("/household/invitations", requireAuth,
  createHouseholdInvitationCreateHandler({
    getUserId,
    store:
      createDrizzleHouseholdInvitationCreateStore<InvitationCreatedHouseholdAuditEvent>(
        {
          database: db,
          tables: {
            usersTable,
            householdsTable,
            householdMembersTable,
            householdInvitationsTable,
            householdAuditEventsTable,
          },
          nextInviteCodeCandidate: makeInvitationCode,
          buildAuditInsert: buildHouseholdAuditInsert,
        },
      ),
  }),
);

router.post("/household/join", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const capability = parseExpectedHouseholdCapability(req, res);
  if (!capability) return;

  const parsed = JoinHouseholdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let joinResult: Awaited<ReturnType<typeof commitHouseholdJoin>> | null = null;
  try {
    const { householdId: activeHouseholdId } = await ensureUserAndHousehold(userId);
    const expectedSourceHouseholdId = verifyExpectedHouseholdCapability({
      capability,
      actualHouseholdId: activeHouseholdId,
      res,
    });
    if (!expectedSourceHouseholdId) return;

    const code = parsed.data.inviteCode.trim().toUpperCase();
    const [invitation] = await db
      .select({
        id: householdInvitationsTable.id,
        householdId: householdInvitationsTable.householdId,
      })
      .from(householdInvitationsTable)
      .where(eq(householdInvitationsTable.inviteCode, code))
      .limit(1);
    if (!invitation) {
      res.status(404).json({ error: "Durable invitation code not found" });
      return;
    }

    const verifiedIdentity =
      await getFreshVerifiedHouseholdJoinIdentity(userId);
    joinResult = await commitHouseholdJoin({
      userId,
      householdId: invitation.householdId,
      expectedSourceHouseholdId,
      invitationId: invitation.id,
      verifiedIdentity,
    });
  } catch (error) {
    if (
      error instanceof HouseholdJoinCommitError ||
      error instanceof HouseholdAuthoritySnapshotError
    ) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    throw error;
  }

  if (!joinResult) return;
  res.json(
    JoinHouseholdResponse.parse({
      ...joinResult.me,
      auditEvent: joinResult.auditEvent,
    }),
  );
});

const runHouseholdScopedOperation = createHouseholdScopedOperationRunner(
  createDrizzleHouseholdScopedOperationStore({
    database: db,
    tables: { usersTable, householdMembersTable },
  }),
  { serializeHouseholdMutations: true },
);

router.use(
  createHouseholdManagementRouter({
    tables: {
      householdsTable,
      householdAuditEventsTable,
      householdInvitationsTable,
      householdMembersTable,
    },
    queryOps: { and, desc, eq, inArray },
    requireAuth,
    getUserId,
    runHouseholdScopedOperation,
    buildMeInTransaction,
  }),
);

export default router;

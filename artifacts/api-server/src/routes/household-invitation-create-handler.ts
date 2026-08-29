import type { Request, RequestHandler } from "express";
import {
  CreateHouseholdInvitationBody,
  HouseholdInvitationMutationResponse,
} from "@workspace/api-zod";

import {
  buildHouseholdAuditEvent,
  type HouseholdAuditEvent,
} from "../lib/household-access-pass.ts";
import {
  HouseholdInvitationCreateError,
  createHouseholdInvitationAtomically,
  type HouseholdInvitationCreateStore,
} from "../lib/household-invitation-create.ts";
import { buildHouseholdInvitationView } from "../lib/household-invitations.ts";
import { parseExpectedHouseholdCapability } from "./household-capability.ts";

export type InvitationCreatedHouseholdAuditEvent = HouseholdAuditEvent & {
  action: "invitation-created";
  lifecycleState: "invite-created";
};

function invitationExpiryIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

export function createHouseholdInvitationCreateHandler(input: {
  getUserId(req: Request): string;
  store: HouseholdInvitationCreateStore<InvitationCreatedHouseholdAuditEvent>;
}): RequestHandler {
  return async (req, res): Promise<void> => {
    const capability = parseExpectedHouseholdCapability(req, res);
    if (!capability) return;

    const parsed = CreateHouseholdInvitationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const actorUserId = input.getUserId(req);
    try {
      const result = await createHouseholdInvitationAtomically({
        store: input.store,
        actorUserId,
        householdId: capability.expectedHouseholdId,
        expectedSourceHouseholdId: capability.expectedHouseholdId,
        invitedEmail: parsed.data.invitedEmail ?? null,
        role: parsed.data.role ?? "adult",
        lifecycleState: parsed.data.lifecycleState ?? "approved",
        note: parsed.data.note ?? null,
        expiresAt: parsed.data.expiresAt ?? null,
        buildAuditEvent({ invitation, actorMembership, now }) {
          return buildHouseholdAuditEvent(
            {
              action: "invitation-created",
              actorUserId: actorMembership.userId,
              householdId: actorMembership.householdId,
              nextRole: invitation.role,
              reason:
                invitation.lifecycleState === "approved"
                  ? "Owner/admin created an approved household invitation."
                  : "Owner/admin staged an invitation that still needs approval before acceptance.",
              note: invitation.note,
              expiresAt: invitationExpiryIso(invitation.expiresAt),
            },
            now,
          ) as InvitationCreatedHouseholdAuditEvent;
        },
      });

      const responseTime = new Date(result.auditEvent.createdAt);
      res.status(201).json(
        HouseholdInvitationMutationResponse.parse({
          invitation: buildHouseholdInvitationView(
            result.invitation,
            responseTime,
          ),
          auditEvent: result.auditEvent,
        }),
      );
    } catch (error) {
      if (error instanceof HouseholdInvitationCreateError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  };
}

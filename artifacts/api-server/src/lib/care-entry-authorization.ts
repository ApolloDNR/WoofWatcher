import { normalizeCareEventType } from "@workspace/care-domain";
import {
  parseHouseholdMemberRole,
  type HouseholdMemberRole,
} from "./household-role-authority.ts";

type CareEntryWriteAction = "create" | "update" | "delete";

export interface CareEntryWritePolicyInput {
  role?: string | null;
  type?: string | null;
  details?: Record<string, unknown> | null;
  action?: CareEntryWriteAction;
}

export interface CareEntryWritePolicyResult {
  allowed: boolean;
  reason?: string;
  details: Record<string, unknown>;
}

function isAdultRole(role: HouseholdMemberRole | null): boolean {
  return role === "adult" || role === "owner";
}

function isKidRole(role: HouseholdMemberRole | null): boolean {
  return role === "kid" || role === "teen";
}

function isHelperRole(role: HouseholdMemberRole | null): boolean {
  return role === "sitter" || role === "trainer" || role === "walker";
}

function isReadOnlyRole(role: HouseholdMemberRole | null): boolean {
  return role === null || role === "vet viewer";
}

function roleConfirmationReason(
  role: HouseholdMemberRole | null,
): "kid-log" | "helper-log" | null {
  if (isKidRole(role)) return "kid-log";
  if (isHelperRole(role)) return "helper-log";
  return null;
}

function safetyCriticalReason(type: string | null | undefined): "safety-critical" | null {
  const normalizedType = normalizeCareEventType(type);
  if (
    normalizedType === "medication" ||
    normalizedType === "vomit" ||
    normalizedType === "symptom" ||
    normalizedType === "incident"
  ) {
    return "safety-critical";
  }
  return null;
}

function forbiddenReason(
  role: HouseholdMemberRole | null,
  action: CareEntryWriteAction,
): string | null {
  if (isReadOnlyRole(role)) return "Role is read-only for care log writes.";
  if (action === "delete" && !isAdultRole(role)) {
    return "Only an adult owner can delete shared care logs.";
  }
  return null;
}

export function applyCareEntryWritePolicy(
  input: CareEntryWritePolicyInput,
): CareEntryWritePolicyResult {
  const role = parseHouseholdMemberRole(input.role);
  const action = input.action ?? "create";
  const denied = forbiddenReason(role, action);
  const details = { ...(input.details ?? {}) };

  if (denied) {
    return {
      allowed: false,
      reason: denied,
      details,
    };
  }

  const confirmationReason =
    roleConfirmationReason(role) ?? safetyCriticalReason(input.type);
  const confirmationRequired = Boolean(confirmationReason);
  const reviewDetails = confirmationRequired
    ? {
        trustState: "pending-confirmation",
        confirmationRequired,
        ...(confirmationReason ? { confirmationReason } : {}),
      }
    : {
        trustState: "confirmed",
        confirmationRequired,
      };
  const nextDetails = {
    ...details,
    ...reviewDetails,
  };

  if (normalizeCareEventType(input.type, details) === "medication") {
    Object.assign(nextDetails, {
      photoProofStatus: details.photoProofStatus ?? "not-attached",
      photoProofPolicy: "medication-proof",
    });
  }

  return {
    allowed: true,
    details: nextDetails,
  };
}

export function assertCareEntryWriteAllowed(
  input: CareEntryWritePolicyInput,
): CareEntryWritePolicyResult {
  return applyCareEntryWritePolicy(input);
}

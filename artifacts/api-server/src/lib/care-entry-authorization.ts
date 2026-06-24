import { normalizeCareEventType } from "@workspace/care-domain";

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

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeRole(role: string | null | undefined): string {
  return clean(role).toLowerCase();
}

function isAdultRole(role: string): boolean {
  return (
    role === "member" ||
    role === "adult" ||
    role === "owner" ||
    role === "admin" ||
    role === "adult admin" ||
    role.includes("owner") ||
    role.includes("admin") ||
    role.includes("primary caregiver")
  );
}

function isKidRole(role: string): boolean {
  return role === "kid" || role === "teen" || role === "minor" || role === "child";
}

function isHelperRole(role: string): boolean {
  return (
    role === "sitter" ||
    role === "trainer" ||
    role === "walker" ||
    role === "helper" ||
    role === "temporary helper" ||
    role.includes("sitter") ||
    role.includes("trainer") ||
    role.includes("walker")
  );
}

function isReadOnlyRole(role: string): boolean {
  return (
    !role ||
    role === "viewer" ||
    role === "read-only" ||
    role === "readonly" ||
    role === "vet viewer" ||
    role === "veterinary viewer" ||
    role === "expired access pass" ||
    role.includes("read-only") ||
    role.includes("vet viewer") ||
    role.includes("expired access pass")
  );
}

function roleConfirmationReason(role: string): "kid-log" | "helper-log" | null {
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

function forbiddenReason(role: string, action: CareEntryWriteAction): string | null {
  if (isReadOnlyRole(role)) return "Role is read-only for care log writes.";
  if (action === "delete" && !isAdultRole(role)) {
    return "Only an adult owner can delete shared care logs.";
  }
  return null;
}

export function applyCareEntryWritePolicy(
  input: CareEntryWritePolicyInput,
): CareEntryWritePolicyResult {
  const role = normalizeRole(input.role);
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

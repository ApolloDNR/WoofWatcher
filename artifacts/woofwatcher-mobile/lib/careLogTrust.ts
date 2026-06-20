import { appendCareAuditEvent, normalizeCareEventType } from "../../../lib/care-domain/src/index.ts";

export type CareLogTrustState =
  | "confirmed"
  | "pending-confirmation"
  | "estimated"
  | "corrected"
  | "rejected";

export type CareLogReviewAction = "confirm" | "reject" | "request-photo" | "mark-corrected";
export type CareLogInteraction = "quick-tap" | "detail-sheet";
export type CareLogAttentionTone = "amber" | "copper" | "rose" | "sage";
export type CareLogProofSource = "camera" | "library" | "manual";

export interface CareLogTrustEntryLike {
  id?: string;
  type: string;
  title?: string | null;
  caregiver?: string | null;
  occurredAt: string;
  severity?: string | null;
  details?: Record<string, unknown>;
}

export interface CareLogTrustReviewActionOption {
  id: CareLogReviewAction;
  label: string;
}

export interface CareLogTrustReview {
  visible: boolean;
  canReview: boolean;
  state: CareLogTrustState;
  statusLabel: string;
  reasonLabel: string;
  helperText: string;
  proofStatus: string | null;
  proofAttachmentName: string | null;
  proofStorageStatus: string | null;
  actions: CareLogTrustReviewActionOption[];
}

export interface CareLogTrustReviewOptions {
  action: CareLogReviewAction;
  reviewer: string;
  reviewerRole?: string | null;
  now?: number;
  note?: string;
}

export interface CareLogTrustReviewPatch {
  severity?: string;
  details: Record<string, unknown>;
}

export interface CareLogPhotoProofAttachmentOptions {
  caregiver: string;
  uri: string;
  fileName?: string | null;
  source?: CareLogProofSource;
  now?: number;
  note?: string;
}

export interface CareLogTrustDefaultsOptions {
  type: string | null | undefined;
  caregiverRole?: string | null;
  interaction: CareLogInteraction;
}

export interface CareLogAttentionChip {
  id: string;
  label: string;
  tone: CareLogAttentionTone;
}

const REVIEW_ACTIONS: CareLogTrustReviewActionOption[] = [
  { id: "confirm", label: "Confirm" },
  { id: "reject", label: "Reject" },
  { id: "request-photo", label: "Request photo" },
  { id: "mark-corrected", label: "Mark corrected" },
];

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function entryDetails(entry: CareLogTrustEntryLike): Record<string, unknown> {
  return isRecord(entry.details) ? entry.details : {};
}

function iso(now: number | undefined): string {
  return new Date(now ?? Date.now()).toISOString();
}

function normalizeRole(role: string | null | undefined): string {
  return clean(role).toLowerCase();
}

function roleRequiresConfirmation(role: string | null | undefined): "kid-log" | "helper-log" | null {
  const normalized = normalizeRole(role);
  if (normalized === "kid") return "kid-log";
  if (normalized === "sitter" || normalized === "trainer") return "helper-log";
  return null;
}

function safetyCriticalReason(type: string | null | undefined): "safety-critical" | null {
  const normalized = normalizeCareEventType(type);
  if (normalized === "medication" || normalized === "vomit" || normalized === "symptom" || normalized === "incident") {
    return "safety-critical";
  }
  return null;
}

export function canReviewCareLogTrust(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  if (normalized.includes("admin")) return true;
  if (normalized.includes("owner")) return true;
  if (normalized === "adult") return true;
  if (normalized.includes("primary caregiver")) return true;
  return false;
}

export function buildCareLogTrustDefaults(options: CareLogTrustDefaultsOptions): Record<string, unknown> {
  const normalizedType = normalizeCareEventType(options.type);
  const confirmationReason = roleRequiresConfirmation(options.caregiverRole) ?? safetyCriticalReason(normalizedType);
  const confirmationRequired = Boolean(confirmationReason);
  const details: Record<string, unknown> = {
    logInteraction: options.interaction,
    trustState: confirmationRequired ? "pending-confirmation" : "confirmed",
    confirmationRequired,
    ...(confirmationReason ? { confirmationReason } : {}),
  };

  if (normalizedType === "medication") {
    details.photoProofStatus = "not-attached";
    details.photoProofPolicy = "medication-proof";
  }

  return details;
}

function trustState(value: unknown, confirmationRequired: boolean): CareLogTrustState {
  const cleaned = clean(value) as CareLogTrustState;
  if (
    cleaned === "confirmed" ||
    cleaned === "pending-confirmation" ||
    cleaned === "estimated" ||
    cleaned === "corrected" ||
    cleaned === "rejected"
  ) {
    return cleaned;
  }
  return confirmationRequired ? "pending-confirmation" : "confirmed";
}

function addChip(chips: CareLogAttentionChip[], chip: CareLogAttentionChip): void {
  if (!chips.some((item) => item.id === chip.id)) chips.push(chip);
}

export function getCareLogAttentionChips(entry: CareLogTrustEntryLike): CareLogAttentionChip[] {
  const details = entryDetails(entry);
  const confirmationRequired = details.confirmationRequired === true;
  const state = trustState(details.trustState, confirmationRequired);
  const proofStatus = clean(details.photoProofStatus).toLowerCase();
  const proofPolicy = clean(details.photoProofPolicy).toLowerCase();
  const normalizedType = normalizeCareEventType(entry.type, details);
  const chips: CareLogAttentionChip[] = [];

  if (state === "rejected") addChip(chips, { id: "rejected", label: "Rejected", tone: "rose" });
  if (state === "corrected") addChip(chips, { id: "corrected", label: "Corrected", tone: "copper" });
  if (state === "estimated") addChip(chips, { id: "estimated", label: "Estimated", tone: "amber" });
  if (state === "pending-confirmation" || confirmationRequired) {
    addChip(chips, { id: "needs-review", label: "Needs review", tone: "amber" });
  }
  if (proofStatus === "requested") {
    addChip(chips, { id: "photo-requested", label: "Photo requested", tone: "copper" });
  } else if (proofStatus === "attached") {
    addChip(chips, { id: "proof-attached", label: "Proof attached", tone: "sage" });
  } else if (proofStatus === "not-attached" && (proofPolicy || normalizedType === "medication")) {
    addChip(chips, { id: "proof-needed", label: "Proof needed", tone: "copper" });
  }

  const mealLifecycle = clean(details.mealLifecycle).toLowerCase();
  const mealCompletion = clean(details.mealCompletion).toLowerCase();
  if (mealLifecycle === "outcome-pending" || mealCompletion === "served" || mealCompletion === "grazing") {
    addChip(chips, { id: "outcome-pending", label: "Outcome pending", tone: "sage" });
  }

  return chips;
}

function reasonLabel(reason: unknown): string {
  const cleaned = clean(reason).toLowerCase();
  if (cleaned === "kid-log") return "Kid log";
  if (cleaned === "helper-log") return "Helper log";
  if (cleaned === "safety-critical") return "Safety-critical log";
  if (cleaned === "owner-reviewed") return "Owner reviewed";
  return cleaned ? cleaned.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "Shared household log";
}

function statusLabel(state: CareLogTrustState, confirmationRequired: boolean, proofStatus: string): string {
  if (state === "rejected") return "Rejected";
  if (state === "corrected") return "Corrected";
  if (proofStatus === "requested") return "Photo requested";
  if (state === "estimated") return "Estimated";
  if (confirmationRequired || state === "pending-confirmation") return "Needs adult confirmation";
  if (proofStatus === "attached") return "Photo attached";
  return "Confirmed";
}

function helperText(state: CareLogTrustState, confirmationRequired: boolean, canReview: boolean, proofStatus: string): string {
  if (proofStatus === "attached" && (confirmationRequired || state === "pending-confirmation")) {
    return "Photo proof is attached. An adult owner can review and confirm the medication log.";
  }
  if (!canReview && (confirmationRequired || state === "pending-confirmation")) {
    return "An adult owner can confirm, correct, or request proof for this log.";
  }
  if (state === "rejected") return "This log stays in history, but the household should not treat it as confirmed care.";
  if (state === "corrected") return "This log was corrected so the care record keeps the original trail.";
  if (proofStatus === "requested") return "Photo proof has been requested before this log is confirmed.";
  if (proofStatus === "attached") return "Photo proof is attached to this log. Cloud file storage is still provider-gated.";
  if (confirmationRequired || state === "pending-confirmation") {
    return "Review this log before it drives household handoff, medication, or report decisions.";
  }
  return "This log is confirmed and available for household summaries.";
}

export function getCareLogTrustReview(
  entry: CareLogTrustEntryLike,
  reviewerRole?: string | null,
): CareLogTrustReview {
  const details = entryDetails(entry);
  const confirmationRequired = details.confirmationRequired === true;
  const proofStatus = clean(details.photoProofStatus).toLowerCase();
  const state = trustState(details.trustState, confirmationRequired);
  const visible = state !== "confirmed" || confirmationRequired || Boolean(proofStatus);
  const canReview = visible && canReviewCareLogTrust(reviewerRole);
  const proofAttachmentName = clean(details.photoProofAttachmentName);
  const proofStorageStatus = clean(details.photoProofStorageStatus).toLowerCase();

  return {
    visible,
    canReview,
    state,
    statusLabel: statusLabel(state, confirmationRequired, proofStatus),
    reasonLabel: reasonLabel(details.confirmationReason),
    helperText: helperText(state, confirmationRequired, canReview, proofStatus),
    proofStatus: proofStatus || null,
    proofAttachmentName: proofAttachmentName || null,
    proofStorageStatus: proofStorageStatus || null,
    actions: visible ? REVIEW_ACTIONS.map((action) => ({ ...action })) : [],
  };
}

function auditId(action: CareLogReviewAction, occurredAt: string): string {
  return `trust_${action}_${occurredAt.replace(/[^0-9a-z]/gi, "")}`;
}

function summaryFor(action: CareLogReviewAction, reviewer: string, title: string): string {
  if (action === "confirm") return `${reviewer} confirmed "${title}" for the shared care record.`;
  if (action === "reject") return `${reviewer} rejected "${title}" until the household corrects it.`;
  if (action === "request-photo") return `${reviewer} requested photo proof for "${title}".`;
  return `${reviewer} marked "${title}" corrected in the shared care record.`;
}

export function buildCareLogPhotoProofAttachmentPatch(
  entry: CareLogTrustEntryLike,
  options: CareLogPhotoProofAttachmentOptions,
): CareLogTrustReviewPatch | null {
  const uri = clean(options.uri);
  if (!uri) return null;

  const caregiver = clean(options.caregiver) || "Care team";
  const title = clean(entry.title) || "Care log";
  const occurredAt = iso(options.now);
  const existing = entryDetails(entry);
  const existingState = trustState(existing.trustState, existing.confirmationRequired === true);
  const confirmationRequired = existing.confirmationRequired === true || existingState === "pending-confirmation";
  const fileName = clean(options.fileName) || "Care proof photo";
  const note = clean(options.note);
  const source = options.source ?? "library";
  const nextDetails = {
    ...existing,
    trustState: existingState,
    confirmationRequired,
    photoProofStatus: "attached",
    photoProofAttachmentUri: uri,
    photoProofAttachmentName: fileName,
    photoProofSource: source,
    photoProofStorageStatus: "local-only",
    photoProofStorageNote: "Attachment is saved as a local URI until provider-backed storage is enabled.",
    photoProofAttachedBy: caregiver,
    photoProofAttachedAt: occurredAt,
    ...(note ? { photoProofAttachmentNote: note } : {}),
  };

  return {
    details: appendCareAuditEvent(nextDetails, {
      id: `proof_attached_${occurredAt.replace(/[^0-9a-z]/gi, "")}`,
      action: "updated",
      caregiver,
      occurredAt,
      summary: `${caregiver} attached photo proof for "${title}".`,
      changes: ["photoProofStatus", "photoProofAttachmentUri", "photoProofAttachedAt"],
    }),
  };
}

export function buildCareLogTrustReviewPatch(
  entry: CareLogTrustEntryLike,
  options: CareLogTrustReviewOptions,
): CareLogTrustReviewPatch | null {
  if (!canReviewCareLogTrust(options.reviewerRole)) return null;

  const reviewer = clean(options.reviewer) || "Care team";
  const title = clean(entry.title) || "Care log";
  const occurredAt = iso(options.now);
  const note = clean(options.note);
  const existing = entryDetails(entry);
  let severity: string | undefined;
  let nextDetails: Record<string, unknown> = { ...existing };
  let changes: string[] = ["trustState"];

  if (options.action === "confirm") {
    nextDetails = {
      ...nextDetails,
      trustState: "confirmed",
      confirmationRequired: false,
      confirmedBy: reviewer,
      confirmedAt: occurredAt,
      ...(note ? { confirmationNote: note } : {}),
    };
    changes = ["trustState", "confirmationRequired", "confirmedAt"];
  } else if (options.action === "reject") {
    nextDetails = {
      ...nextDetails,
      trustState: "rejected",
      confirmationRequired: false,
      rejectedBy: reviewer,
      rejectedAt: occurredAt,
      ...(note ? { rejectionNote: note } : {}),
    };
    severity = "watch";
    changes = ["trustState", "confirmationRequired", "rejectedAt"];
  } else if (options.action === "request-photo") {
    nextDetails = {
      ...nextDetails,
      trustState: trustState(nextDetails.trustState, true) === "confirmed" ? "pending-confirmation" : trustState(nextDetails.trustState, true),
      confirmationRequired: true,
      photoProofStatus: "requested",
      photoProofRequestedBy: reviewer,
      photoProofRequestedAt: occurredAt,
      ...(note ? { photoProofNote: note } : {}),
    };
    changes = ["photoProofStatus", "confirmationRequired", "photoProofRequestedAt"];
  } else {
    nextDetails = {
      ...nextDetails,
      trustState: "corrected",
      confirmationRequired: false,
      correctedBy: reviewer,
      correctedAt: occurredAt,
      ...(note ? { correctionNote: note } : {}),
    };
    changes = ["trustState", "confirmationRequired", "correctedAt"];
  }

  return {
    ...(severity ? { severity } : {}),
    details: appendCareAuditEvent(nextDetails, {
      id: auditId(options.action, occurredAt),
      action: "updated",
      caregiver: reviewer,
      occurredAt,
      summary: summaryFor(options.action, reviewer, title),
      changes,
    }),
  };
}

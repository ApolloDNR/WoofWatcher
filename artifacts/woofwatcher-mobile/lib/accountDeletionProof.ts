export interface AccountDeletionProofItem {
  label: string;
  requiredEvidence: string;
}

export type AccountDeletionProofStatus = "blocked" | "ready-for-review";

export interface AccountDeletionProofEvidence {
  deletionRouteAuth?: string | null;
  exportBeforeDeleteHandoff?: string | null;
  dataObjectDeletionReceipt?: string | null;
  auditSupportReceipt?: string | null;
  recoveryCancellationPolicy?: string | null;
  legalStoreApproval?: string | null;
  accountDeletionEvidence?: readonly AccountDeletionEvidenceFile[];
}

export type AccountDeletionEvidenceKind =
  | "deletion-route-auth"
  | "export-before-delete"
  | "data-object-deletion-receipt"
  | "audit-support-receipt"
  | "recovery-cancellation-policy"
  | "legal-store-approval";

export interface AccountDeletionEvidenceFile {
  kind: AccountDeletionEvidenceKind;
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  deletionRoute?: string | null;
  reauthenticationMethod?: string | null;
  activeHouseholdScope?: string | null;
  destructiveConfirmationCopy?: string | null;
  localPreviewBoundaryAcknowledged?: boolean | null;
  exportWarningCopy?: string | null;
  ownerDataExportLink?: string | null;
  retainedRecordsExplanation?: string | null;
  exitBeforeDeleteConfirmed?: boolean | null;
  deletionReceiptId?: string | null;
  accountRowsDeleted?: boolean | null;
  householdMembershipDeleted?: boolean | null;
  careEntriesDeleted?: boolean | null;
  reportsDeleted?: boolean | null;
  credentialsDeleted?: boolean | null;
  storageObjectsDeleted?: boolean | null;
  providerTombstonesCreated?: boolean | null;
  auditTrailId?: string | null;
  supportReceiptId?: string | null;
  requestId?: string | null;
  deletionTimestamp?: string | null;
  actingAccount?: string | null;
  supportEscalationPath?: string | null;
  providerDelayEscalationReady?: boolean | null;
  recoveryWindowPolicy?: string | null;
  cancellationBehavior?: string | null;
  irreversibleDeletionTimestamp?: string | null;
  accountLockoutRules?: string | null;
  postWindowSupportLimits?: string | null;
  cancelDeletionTested?: boolean | null;
  privacyPolicySection?: string | null;
  appStoreReviewReference?: string | null;
  playStoreReviewReference?: string | null;
  supportTermsReference?: string | null;
  approvalOwner?: string | null;
  legalApproved?: boolean | null;
  storeComplianceApproved?: boolean | null;
  apolloApproved?: boolean | null;
}

export interface AccountDeletionProofManifestItem extends AccountDeletionProofItem {
  status: "blocked" | "ready";
  evidenceAttached: readonly string[];
}

export interface AccountDeletionProofManifest {
  title: "Account deletion proof manifest";
  status: AccountDeletionProofStatus;
  statusLabel: string;
  summary: string;
  readyCount: number;
  openCount: number;
  totalCount: number;
  destructiveDeletionAllowed: boolean;
  items: AccountDeletionProofManifestItem[];
  blockers: string[];
}

export const ACCOUNT_DELETION_PROOF_ITEMS: readonly AccountDeletionProofItem[] = [
  {
    label: "Deletion route and authentication gate",
    requiredEvidence:
      "self-serve deletion route, reauthentication requirement, active-household scope, destructive-action confirmation copy, and proof that local preview cannot delete provider data in a deletion-route/auth proof file with MIME and byte size.",
  },
  {
    label: "Export-before-delete handoff",
    requiredEvidence:
      "export-before-delete warning, owner data export link, retained-record explanation, and confirmation that the owner can leave before destructive deletion starts in an export-before-delete proof file with MIME and byte size.",
  },
  {
    label: "Data and object deletion receipt",
    requiredEvidence:
      "data/object deletion receipt proof file covering account rows, household membership, care entries, reports, credentials, media/storage objects, and provider tombstones with MIME and byte size.",
  },
  {
    label: "Audit trail and support receipt",
    requiredEvidence:
      "audit/support receipt proof file with audit trail, support receipt, request id, deletion timestamp, acting account, and support escalation path if provider deletion is partial or delayed.",
  },
  {
    label: "Recovery window and cancellation rules",
    requiredEvidence:
      "recovery-window policy and cancellation rules in a recovery/cancellation proof file with cancel deletion behavior, irreversible-deletion timestamp, account lockout rules, post-window support limitations, MIME, and byte size.",
  },
  {
    label: "Legal and store approval",
    requiredEvidence:
      "legal/store approval proof file with privacy policy language, App Store and Play Store account-deletion compliance review, support terms, Apollo approval, MIME, and byte size before enabling production deletion.",
  },
];

export const ACCOUNT_DELETION_PROOF_SUMMARY =
  "Self-serve account deletion proof packet: structured proof files for self-serve deletion route, export-before-delete warning, data/object deletion receipt, audit trail, recovery-window policy, and legal/store approval before destructive account deletion can be enabled.";

const ACCOUNT_DELETION_PROOF_EVIDENCE_KEYS: readonly (keyof AccountDeletionProofEvidence)[] = [
  "deletionRouteAuth",
  "exportBeforeDeleteHandoff",
  "dataObjectDeletionReceipt",
  "auditSupportReceipt",
  "recoveryCancellationPolicy",
  "legalStoreApproval",
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase();
}

function hasPositiveByteSize(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasProofMime(value: unknown): boolean {
  const mime = normalize(value);
  return (
    mime === "application/json" ||
    mime.endsWith("+json") ||
    mime === "text/markdown" ||
    mime === "text/plain" ||
    mime === "application/pdf"
  );
}

type AccountDeletionTextField = keyof Pick<
  AccountDeletionEvidenceFile,
  | "deletionRoute"
  | "reauthenticationMethod"
  | "activeHouseholdScope"
  | "destructiveConfirmationCopy"
  | "exportWarningCopy"
  | "ownerDataExportLink"
  | "retainedRecordsExplanation"
  | "deletionReceiptId"
  | "auditTrailId"
  | "supportReceiptId"
  | "requestId"
  | "deletionTimestamp"
  | "actingAccount"
  | "supportEscalationPath"
  | "recoveryWindowPolicy"
  | "cancellationBehavior"
  | "irreversibleDeletionTimestamp"
  | "accountLockoutRules"
  | "postWindowSupportLimits"
  | "privacyPolicySection"
  | "appStoreReviewReference"
  | "playStoreReviewReference"
  | "supportTermsReference"
  | "approvalOwner"
>;

type AccountDeletionBooleanField = keyof Pick<
  AccountDeletionEvidenceFile,
  | "localPreviewBoundaryAcknowledged"
  | "exitBeforeDeleteConfirmed"
  | "accountRowsDeleted"
  | "householdMembershipDeleted"
  | "careEntriesDeleted"
  | "reportsDeleted"
  | "credentialsDeleted"
  | "storageObjectsDeleted"
  | "providerTombstonesCreated"
  | "providerDelayEscalationReady"
  | "cancelDeletionTested"
  | "legalApproved"
  | "storeComplianceApproved"
  | "apolloApproved"
>;

interface AccountDeletionEvidenceRequirement {
  kind: AccountDeletionEvidenceKind;
  locatorTokens: readonly string[];
  textFields: readonly AccountDeletionTextField[];
  booleanFields: readonly AccountDeletionBooleanField[];
  readyLabel: string;
}

const ACCOUNT_DELETION_EVIDENCE_REQUIREMENTS: readonly AccountDeletionEvidenceRequirement[] = [
  {
    kind: "deletion-route-auth",
    locatorTokens: ["deletion-route", "auth"],
    textFields: ["deletionRoute", "reauthenticationMethod", "activeHouseholdScope", "destructiveConfirmationCopy"],
    booleanFields: ["localPreviewBoundaryAcknowledged"],
    readyLabel: "Deletion route and reauthentication proof ready",
  },
  {
    kind: "export-before-delete",
    locatorTokens: ["export-before-delete"],
    textFields: ["exportWarningCopy", "ownerDataExportLink", "retainedRecordsExplanation"],
    booleanFields: ["exitBeforeDeleteConfirmed"],
    readyLabel: "Export-before-delete handoff proof ready",
  },
  {
    kind: "data-object-deletion-receipt",
    locatorTokens: ["data-object-deletion", "receipt"],
    textFields: ["deletionReceiptId"],
    booleanFields: [
      "accountRowsDeleted",
      "householdMembershipDeleted",
      "careEntriesDeleted",
      "reportsDeleted",
      "credentialsDeleted",
      "storageObjectsDeleted",
      "providerTombstonesCreated",
    ],
    readyLabel: "Data and object deletion receipt proof ready",
  },
  {
    kind: "audit-support-receipt",
    locatorTokens: ["audit", "support-receipt"],
    textFields: ["auditTrailId", "supportReceiptId", "requestId", "deletionTimestamp", "actingAccount", "supportEscalationPath"],
    booleanFields: ["providerDelayEscalationReady"],
    readyLabel: "Audit trail and support receipt proof ready",
  },
  {
    kind: "recovery-cancellation-policy",
    locatorTokens: ["recovery", "cancellation"],
    textFields: [
      "recoveryWindowPolicy",
      "cancellationBehavior",
      "irreversibleDeletionTimestamp",
      "accountLockoutRules",
      "postWindowSupportLimits",
    ],
    booleanFields: ["cancelDeletionTested"],
    readyLabel: "Recovery window and cancellation policy proof ready",
  },
  {
    kind: "legal-store-approval",
    locatorTokens: ["legal", "store"],
    textFields: [
      "privacyPolicySection",
      "appStoreReviewReference",
      "playStoreReviewReference",
      "supportTermsReference",
      "approvalOwner",
    ],
    booleanFields: ["legalApproved", "storeComplianceApproved", "apolloApproved"],
    readyLabel: "Legal, store, and Apollo approval proof ready",
  },
];

function evidenceMatchesRequirement(
  evidence: AccountDeletionEvidenceFile,
  requirement: AccountDeletionEvidenceRequirement,
): boolean {
  const locator = `${normalize(evidence.fileName)} ${normalize(evidence.uri)}`;
  return (
    evidence.kind === requirement.kind &&
    requirement.locatorTokens.every((token) => locator.includes(token)) &&
    hasProofMime(evidence.mimeType) &&
    hasPositiveByteSize(evidence.byteSize) &&
    requirement.textFields.every((field) => clean(evidence[field]).length > 0) &&
    requirement.booleanFields.every((field) => evidence[field] === true)
  );
}

export function buildAccountDeletionProofManifest(
  input: AccountDeletionProofEvidence | null | undefined,
): AccountDeletionProofManifest {
  const evidence = input ?? {};
  const attachedEvidence = evidence.accountDeletionEvidence ?? [];
  const items = ACCOUNT_DELETION_PROOF_ITEMS.map<AccountDeletionProofManifestItem>((item, index) => {
    const note = clean(evidence[ACCOUNT_DELETION_PROOF_EVIDENCE_KEYS[index]]);
    const requirement = ACCOUNT_DELETION_EVIDENCE_REQUIREMENTS[index];
    const matched = requirement
      ? attachedEvidence.find((candidate) => evidenceMatchesRequirement(candidate, requirement))
      : undefined;
    return {
      ...item,
      status: matched ? "ready" : "blocked",
      evidenceAttached: matched && requirement ? [requirement.readyLabel, ...(note ? [note] : [])] : [],
    };
  });
  const readyCount = items.filter((item) => item.status === "ready").length;
  const totalCount = items.length;
  const openCount = totalCount - readyCount;
  const destructiveDeletionAllowed = openCount === 0;

  return {
    title: "Account deletion proof manifest",
    status: destructiveDeletionAllowed ? "ready-for-review" : "blocked",
    statusLabel: destructiveDeletionAllowed ? "Ready for deletion review" : "Deletion blocked",
    summary: destructiveDeletionAllowed
      ? "All structured self-serve account deletion proof files are attached for review before destructive deletion can be enabled."
      : "Destructive account deletion must stay blocked until structured proof files cover the self-serve deletion route, export-before-delete warning, data/object deletion receipt, audit trail, recovery-window policy, and legal/store approval.",
    readyCount,
    openCount,
    totalCount,
    destructiveDeletionAllowed,
    items,
    blockers: items.filter((item) => item.status === "blocked").map((item) => `${item.label}: ${item.requiredEvidence}`),
  };
}

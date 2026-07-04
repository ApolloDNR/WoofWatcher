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
      "self-serve deletion route, reauthentication requirement, active-household scope, destructive-action confirmation copy, and proof that local preview cannot delete provider data.",
  },
  {
    label: "Export-before-delete handoff",
    requiredEvidence:
      "export-before-delete warning, owner data export link, retained-record explanation, and confirmation that the owner can leave before destructive deletion starts.",
  },
  {
    label: "Data and object deletion receipt",
    requiredEvidence:
      "data/object deletion receipt covering account rows, household membership, care entries, reports, credentials, media/storage objects, and provider tombstones.",
  },
  {
    label: "Audit trail and support receipt",
    requiredEvidence:
      "audit trail, support receipt, request id, deletion timestamp, acting account, and support escalation path if provider deletion is partial or delayed.",
  },
  {
    label: "Recovery window and cancellation rules",
    requiredEvidence:
      "recovery-window policy, cancel deletion behavior, irreversible-deletion timestamp, account lockout rules, and post-window support limitations.",
  },
  {
    label: "Legal and store approval",
    requiredEvidence:
      "legal/store approval, privacy policy language, App Store and Play Store account-deletion compliance review, support terms, and Apollo approval before enabling production deletion.",
  },
];

export const ACCOUNT_DELETION_PROOF_SUMMARY =
  "Self-serve account deletion proof packet: self-serve deletion route, export-before-delete warning, data/object deletion receipt, audit trail, recovery-window policy, and legal/store approval before destructive account deletion can be enabled.";

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

export function buildAccountDeletionProofManifest(
  input: AccountDeletionProofEvidence | null | undefined,
): AccountDeletionProofManifest {
  const evidence = input ?? {};
  const items = ACCOUNT_DELETION_PROOF_ITEMS.map<AccountDeletionProofManifestItem>((item, index) => {
    const attached = clean(evidence[ACCOUNT_DELETION_PROOF_EVIDENCE_KEYS[index]]);
    return {
      ...item,
      status: attached ? "ready" : "blocked",
      evidenceAttached: attached ? [attached] : [],
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
      ? "All self-serve account deletion proof is attached for review before destructive deletion can be enabled."
      : "Destructive account deletion must stay blocked until the self-serve deletion route, export-before-delete warning, data/object deletion receipt, audit trail, recovery-window policy, and legal/store approval proof are attached.",
    readyCount,
    openCount,
    totalCount,
    destructiveDeletionAllowed,
    items,
    blockers: items.filter((item) => item.status === "blocked").map((item) => `${item.label}: ${item.requiredEvidence}`),
  };
}

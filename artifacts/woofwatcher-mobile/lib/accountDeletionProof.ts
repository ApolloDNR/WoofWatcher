export interface AccountDeletionProofItem {
  label: string;
  requiredEvidence: string;
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

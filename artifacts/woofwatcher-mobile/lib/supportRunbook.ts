export type SupportRunbookStatus = "ready" | "limited" | "blocked" | "manual_required";

export interface SupportRunbookInput {
  supportEmail?: string | null;
  privacyPolicyUrl?: string | null;
  termsUrl?: string | null;
  refundPolicyApproved?: boolean;
  veterinaryBoundaryApproved?: boolean;
  accountDeletionEscalationApproved?: boolean;
  incidentResponseApproved?: boolean;
}

export interface SupportRunbookSection {
  title: string;
  status: SupportRunbookStatus;
  detail: string;
  action: string;
}

export interface SupportRunbookPlan {
  launchReady: boolean;
  supportRunbookApproved: boolean;
  privacyLegalApproved: boolean;
  verdictLabel: string;
  summary: string;
  supportEmail: string | null;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
  sections: SupportRunbookSection[];
  launchBlockers: string[];
}

export interface SupportRunbookShareOptions {
  appName?: string;
  generatedAtIso?: string;
}

export interface SupportLegalReadinessProofItem {
  label: string;
  requiredEvidence: string;
}

export type SupportLegalReadinessProofStatus = "blocked" | "ready-for-review";

export interface SupportLegalReadinessProofEvidence {
  supportInbox?: string | null;
  privacyTermsLinks?: string | null;
  refundSubscriptionPolicy?: string | null;
  veterinaryEmergencyBoundary?: string | null;
  deletionEscalation?: string | null;
  incidentResponseOwner?: string | null;
  apolloApproval?: string | null;
  supportLegalEvidence?: readonly SupportLegalEvidenceFile[];
}

export interface SupportLegalReadinessProofManifestItem extends SupportLegalReadinessProofItem {
  status: "blocked" | "ready";
  evidenceAttached: readonly string[];
}

export interface SupportLegalReadinessProofManifest {
  title: "Support legal readiness proof manifest";
  status: SupportLegalReadinessProofStatus;
  statusLabel: string;
  summary: string;
  readyCount: number;
  openCount: number;
  totalCount: number;
  publicLaunchAllowed: boolean;
  items: SupportLegalReadinessProofManifestItem[];
  blockers: string[];
}

export type SupportLegalEvidenceKind =
  | "support-inbox"
  | "privacy-terms-links"
  | "refund-subscription-policy"
  | "veterinary-emergency-boundary"
  | "deletion-escalation"
  | "incident-response-owner"
  | "apollo-launch-approval";

export interface SupportLegalEvidenceFile {
  kind: SupportLegalEvidenceKind;
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  supportEmail?: string | null;
  supportOwner?: string | null;
  coverageSchedule?: string | null;
  storeSupportUrl?: string | null;
  escalationPath?: string | null;
  supportInboxMonitored?: boolean | null;
  privacyPolicyUrl?: string | null;
  termsUrl?: string | null;
  dataRetentionPolicy?: string | null;
  exportDeletionPolicy?: string | null;
  aiStoragePaymentsDisclosure?: string | null;
  storeListingUrlOwned?: boolean | null;
  refundPolicyReference?: string | null;
  subscriptionCancellationLanguage?: string | null;
  billingSupportWorkflow?: string | null;
  restorePurchaseSupport?: string | null;
  appStorePlaySubscriptionCompliance?: boolean | null;
  premiumSurfaceCopyApproved?: boolean | null;
  veterinaryBoundaryCopy?: string | null;
  emergencyEscalationCopy?: string | null;
  healthWatchBoundary?: string | null;
  woofGuideBoundary?: string | null;
  supportBoundary?: string | null;
  storeCopyBoundary?: string | null;
  notVeterinaryAdviceApproved?: boolean | null;
  deletionEscalationOwner?: string | null;
  exportFirstSupportFlow?: string | null;
  deletionRequestReceiptTemplate?: string | null;
  providerDelayFallback?: string | null;
  selfServeDeletionProofReference?: string | null;
  escalationOwnerApproved?: boolean | null;
  incidentResponseOwner?: string | null;
  loginBillingTriagePath?: string | null;
  privacyRequestsTriagePath?: string | null;
  aiSafetyComplaintsTriagePath?: string | null;
  storeReviewFollowUpPath?: string | null;
  incidentOwnerApproved?: boolean | null;
  apolloApprovalOwner?: string | null;
  launchWindow?: string | null;
  noLaunchBoundary?: string | null;
  publicLaunchDecision?: string | null;
  supportLegalRefundVetApproved?: boolean | null;
  apolloApproved?: boolean | null;
  noLaunchBoundaryAcknowledged?: boolean | null;
}

export const SUPPORT_LEGAL_READINESS_PROOF_ITEMS: readonly SupportLegalReadinessProofItem[] = [
  {
    label: "Support inbox",
    requiredEvidence:
      "support inbox proof file with monitored inbox, owner/access list, response coverage, store support URL, customer escalation path, MIME, and byte size before public accounts or subscriptions.",
  },
  {
    label: "Privacy policy and terms links",
    requiredEvidence:
      "privacy/terms proof file with final https privacy policy and terms links, data retention/export/deletion language, AI/storage/payments disclosures, store-listing URL ownership, MIME, and byte size.",
  },
  {
    label: "Refund/subscription policy",
    requiredEvidence:
      "refund/subscription proof file with cancellation language, billing support workflow, restore-purchase support, App Store/Play subscription compliance, Premium surface copy approval, MIME, and byte size.",
  },
  {
    label: "Veterinary and emergency boundary",
    requiredEvidence:
      "veterinary/emergency boundary proof file proving WoofWatcher is not veterinary advice, diagnosis, treatment, or emergency triage across Health Watch, WoofGuide, support, store copy, MIME, and byte size.",
  },
  {
    label: "Deletion escalation",
    requiredEvidence:
      "deletion escalation proof file with escalation owner, export-first support flow, account-deletion request receipt, provider-delay fallback, self-serve deletion proof packet reference, MIME, and byte size.",
  },
  {
    label: "Incident response owner",
    requiredEvidence:
      "incident response proof file with response owner and triage paths for login, billing, export, deletion, AI/veterinary-boundary, safety complaints, privacy requests, store-review follow-up, MIME, and byte size.",
  },
  {
    label: "Apollo approval",
    requiredEvidence:
      "Apollo launch approval proof file with support operations, privacy/legal copy, refund/subscription policy, veterinary-boundary approval, public launch timing, no-launch boundary, MIME, and byte size.",
  },
];

export const SUPPORT_LEGAL_READINESS_PROOF_SUMMARY =
  "Support legal readiness proof packet: structured proof files for support inbox, privacy policy and terms links, refund/subscription policy, veterinary boundary, deletion escalation, incident response owner, and Apollo approval before public launch can be claimed.";

type SupportLegalReadinessProofLegacyEvidenceKey = Exclude<
  keyof SupportLegalReadinessProofEvidence,
  "supportLegalEvidence"
>;

const SUPPORT_LEGAL_READINESS_PROOF_EVIDENCE_KEYS: readonly SupportLegalReadinessProofLegacyEvidenceKey[] = [
  "supportInbox",
  "privacyTermsLinks",
  "refundSubscriptionPolicy",
  "veterinaryEmergencyBoundary",
  "deletionEscalation",
  "incidentResponseOwner",
  "apolloApproval",
];

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown): string {
  return clean(typeof value === "string" ? value : null).toLowerCase();
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

type SupportLegalTextField = keyof Pick<
  SupportLegalEvidenceFile,
  | "supportEmail"
  | "supportOwner"
  | "coverageSchedule"
  | "storeSupportUrl"
  | "escalationPath"
  | "privacyPolicyUrl"
  | "termsUrl"
  | "dataRetentionPolicy"
  | "exportDeletionPolicy"
  | "aiStoragePaymentsDisclosure"
  | "refundPolicyReference"
  | "subscriptionCancellationLanguage"
  | "billingSupportWorkflow"
  | "restorePurchaseSupport"
  | "veterinaryBoundaryCopy"
  | "emergencyEscalationCopy"
  | "healthWatchBoundary"
  | "woofGuideBoundary"
  | "supportBoundary"
  | "storeCopyBoundary"
  | "deletionEscalationOwner"
  | "exportFirstSupportFlow"
  | "deletionRequestReceiptTemplate"
  | "providerDelayFallback"
  | "selfServeDeletionProofReference"
  | "incidentResponseOwner"
  | "loginBillingTriagePath"
  | "privacyRequestsTriagePath"
  | "aiSafetyComplaintsTriagePath"
  | "storeReviewFollowUpPath"
  | "apolloApprovalOwner"
  | "launchWindow"
  | "noLaunchBoundary"
  | "publicLaunchDecision"
>;

type SupportLegalBooleanField = keyof Pick<
  SupportLegalEvidenceFile,
  | "supportInboxMonitored"
  | "storeListingUrlOwned"
  | "appStorePlaySubscriptionCompliance"
  | "premiumSurfaceCopyApproved"
  | "notVeterinaryAdviceApproved"
  | "escalationOwnerApproved"
  | "incidentOwnerApproved"
  | "supportLegalRefundVetApproved"
  | "apolloApproved"
  | "noLaunchBoundaryAcknowledged"
>;

interface SupportLegalEvidenceRequirement {
  kind: SupportLegalEvidenceKind;
  locatorTokens: readonly string[];
  textFields: readonly SupportLegalTextField[];
  booleanFields: readonly SupportLegalBooleanField[];
  readyLabel: string;
}

const SUPPORT_LEGAL_EVIDENCE_REQUIREMENTS: readonly SupportLegalEvidenceRequirement[] = [
  {
    kind: "support-inbox",
    locatorTokens: ["support-inbox"],
    textFields: ["supportEmail", "supportOwner", "coverageSchedule", "storeSupportUrl", "escalationPath"],
    booleanFields: ["supportInboxMonitored"],
    readyLabel: "Support inbox proof ready",
  },
  {
    kind: "privacy-terms-links",
    locatorTokens: ["privacy", "terms"],
    textFields: ["privacyPolicyUrl", "termsUrl", "dataRetentionPolicy", "exportDeletionPolicy", "aiStoragePaymentsDisclosure"],
    booleanFields: ["storeListingUrlOwned"],
    readyLabel: "Privacy policy and terms proof ready",
  },
  {
    kind: "refund-subscription-policy",
    locatorTokens: ["refund", "subscription"],
    textFields: [
      "refundPolicyReference",
      "subscriptionCancellationLanguage",
      "billingSupportWorkflow",
      "restorePurchaseSupport",
    ],
    booleanFields: ["appStorePlaySubscriptionCompliance", "premiumSurfaceCopyApproved"],
    readyLabel: "Refund and subscription policy proof ready",
  },
  {
    kind: "veterinary-emergency-boundary",
    locatorTokens: ["veterinary", "emergency"],
    textFields: [
      "veterinaryBoundaryCopy",
      "emergencyEscalationCopy",
      "healthWatchBoundary",
      "woofGuideBoundary",
      "supportBoundary",
      "storeCopyBoundary",
    ],
    booleanFields: ["notVeterinaryAdviceApproved"],
    readyLabel: "Veterinary and emergency boundary proof ready",
  },
  {
    kind: "deletion-escalation",
    locatorTokens: ["deletion", "escalation"],
    textFields: [
      "deletionEscalationOwner",
      "exportFirstSupportFlow",
      "deletionRequestReceiptTemplate",
      "providerDelayFallback",
      "selfServeDeletionProofReference",
    ],
    booleanFields: ["escalationOwnerApproved"],
    readyLabel: "Deletion escalation proof ready",
  },
  {
    kind: "incident-response-owner",
    locatorTokens: ["incident", "response"],
    textFields: [
      "incidentResponseOwner",
      "loginBillingTriagePath",
      "privacyRequestsTriagePath",
      "aiSafetyComplaintsTriagePath",
      "storeReviewFollowUpPath",
    ],
    booleanFields: ["incidentOwnerApproved"],
    readyLabel: "Incident response owner proof ready",
  },
  {
    kind: "apollo-launch-approval",
    locatorTokens: ["apollo", "launch-approval"],
    textFields: ["apolloApprovalOwner", "launchWindow", "noLaunchBoundary", "publicLaunchDecision"],
    booleanFields: ["supportLegalRefundVetApproved", "apolloApproved", "noLaunchBoundaryAcknowledged"],
    readyLabel: "Apollo launch approval and no-launch boundary proof ready",
  },
];

function evidenceMatchesRequirement(
  evidence: SupportLegalEvidenceFile,
  requirement: SupportLegalEvidenceRequirement,
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

function hasEmail(value: string | null | undefined): boolean {
  const email = clean(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasHttpsUrl(value: string | null | undefined): boolean {
  const url = clean(value);
  return /^https:\/\/[^\s]+$/i.test(url);
}

function statusLabel(status: SupportRunbookStatus): string {
  if (status === "ready") return "Ready";
  if (status === "limited") return "Limited";
  if (status === "manual_required") return "Manual review";
  return "Blocked";
}

function formatDateLabel(input: string | undefined): string {
  const parsed = input ? new Date(input) : new Date();
  const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(safe);
}

export function deriveSupportRunbookPlan(input: SupportRunbookInput = {}): SupportRunbookPlan {
  const supportEmail = hasEmail(input.supportEmail) ? clean(input.supportEmail) : null;
  const privacyPolicyUrl = hasHttpsUrl(input.privacyPolicyUrl) ? clean(input.privacyPolicyUrl) : null;
  const termsUrl = hasHttpsUrl(input.termsUrl) ? clean(input.termsUrl) : null;
  const refundPolicyApproved = Boolean(input.refundPolicyApproved);
  const veterinaryBoundaryApproved = Boolean(input.veterinaryBoundaryApproved);
  const accountDeletionEscalationApproved = Boolean(input.accountDeletionEscalationApproved);
  const incidentResponseApproved = Boolean(input.incidentResponseApproved);
  const privacyLinksReady = Boolean(privacyPolicyUrl && termsUrl);

  const sections: SupportRunbookSection[] = [
    {
      title: "Support inbox",
      status: supportEmail ? "ready" : "manual_required",
      detail: supportEmail
        ? `Customer support routes to ${supportEmail}.`
        : "Choose the monitored support inbox before public accounts, subscriptions, or store review.",
      action: supportEmail ? "Monitor inbox" : "Add support email",
    },
    {
      title: "Refund and subscription policy",
      status: refundPolicyApproved ? "ready" : "blocked",
      detail: refundPolicyApproved
        ? "Refund, cancellation, billing support, and App Store subscription language are owner-approved."
        : "Payments stay disabled until refund, cancellation, billing support, and app-store subscription language are approved.",
      action: refundPolicyApproved ? "Keep with store packet" : "Approve policy",
    },
    {
      title: "Vet and emergency boundary",
      status: veterinaryBoundaryApproved ? "ready" : "blocked",
      detail: veterinaryBoundaryApproved
        ? "Health copy keeps WoofWatcher as care organization and not veterinary advice, diagnosis, or emergency triage."
        : "Approve the health boundary: WoofWatcher is not veterinary advice, diagnosis, treatment, or emergency triage.",
      action: veterinaryBoundaryApproved ? "Use approved language" : "Approve boundary",
    },
    {
      title: "Privacy and terms links",
      status: privacyLinksReady ? "ready" : "blocked",
      detail: privacyLinksReady
        ? `Privacy policy and terms are linked for store review: ${privacyPolicyUrl} and ${termsUrl}.`
        : "Publish final privacy policy and terms links before public accounts, uploads, AI, payments, or app-store submission.",
      action: privacyLinksReady ? "Attach to store packet" : "Add policy links",
    },
    {
      title: "Deletion escalation",
      status: accountDeletionEscalationApproved && supportEmail ? "ready" : "manual_required",
      detail:
        accountDeletionEscalationApproved && supportEmail
          ? "Manual deletion escalation has a support owner until provider-backed self-serve deletion is enabled."
          : "Manual deletion requests need a support owner, export-first process, and deletion/audit escalation before launch.",
      action: accountDeletionEscalationApproved && supportEmail ? "Escalate through support" : "Approve escalation",
    },
    {
      title: "Incident response",
      status: incidentResponseApproved && supportEmail ? "ready" : "manual_required",
      detail:
        incidentResponseApproved && supportEmail
          ? "Support has a triage path for login, billing, data export, deletion, health-boundary, and safety complaints."
          : "Define who handles login, billing, export, deletion, health-boundary, and safety complaints before launch.",
      action: incidentResponseApproved && supportEmail ? "Use support runbook" : "Assign response owner",
    },
  ];

  const launchBlockers: string[] = [];
  if (!supportEmail) launchBlockers.push("Support inbox is not configured.");
  if (!refundPolicyApproved) launchBlockers.push("Refund and subscription policy is not approved.");
  if (!veterinaryBoundaryApproved) launchBlockers.push("Veterinary and emergency boundary language is not approved.");
  if (!privacyLinksReady) launchBlockers.push("Privacy policy and terms links are not ready.");
  if (!accountDeletionEscalationApproved) launchBlockers.push("Account deletion escalation is not approved.");
  if (!incidentResponseApproved) launchBlockers.push("Support incident-response owner is not approved.");

  const supportRunbookApproved =
    Boolean(supportEmail) && refundPolicyApproved && accountDeletionEscalationApproved && incidentResponseApproved;
  const privacyLegalApproved = privacyLinksReady && veterinaryBoundaryApproved;
  const launchReady = supportRunbookApproved && privacyLegalApproved;

  return {
    launchReady,
    supportRunbookApproved,
    privacyLegalApproved,
    verdictLabel: launchReady ? "Support runbook ready for owner approval" : "Not approved for public launch",
    summary: launchReady
      ? "Support, refund, legal links, deletion escalation, and health-boundary language are staged for final owner sign-off."
      : "Public launch, subscriptions, uploads, and AI should stay gated until the support and policy blockers are closed.",
    supportEmail,
    privacyPolicyUrl,
    termsUrl,
    sections,
    launchBlockers,
  };
}

export function buildSupportLegalReadinessProofManifest(
  input: SupportLegalReadinessProofEvidence | null | undefined,
): SupportLegalReadinessProofManifest {
  const evidence = input ?? {};
  const attachedEvidence = evidence.supportLegalEvidence ?? [];
  const items = SUPPORT_LEGAL_READINESS_PROOF_ITEMS.map<SupportLegalReadinessProofManifestItem>((item, index) => {
    const note = clean(evidence[SUPPORT_LEGAL_READINESS_PROOF_EVIDENCE_KEYS[index]]);
    const requirement = SUPPORT_LEGAL_EVIDENCE_REQUIREMENTS[index];
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
  const publicLaunchAllowed = openCount === 0;

  return {
    title: "Support legal readiness proof manifest",
    status: publicLaunchAllowed ? "ready-for-review" : "blocked",
    statusLabel: publicLaunchAllowed ? "Ready for launch review" : "Public launch blocked",
    summary: publicLaunchAllowed
      ? "All structured support, privacy, refund, veterinary-boundary, deletion escalation, incident-response, and Apollo approval proof files are attached for launch review."
      : "Public launch must stay blocked until structured proof files cover support inbox, privacy policy and terms links, refund/subscription policy, veterinary boundary, deletion escalation, incident response owner, and Apollo approval.",
    readyCount,
    openCount,
    totalCount,
    publicLaunchAllowed,
    items,
    blockers: items.filter((item) => item.status === "blocked").map((item) => `${item.label}: ${item.requiredEvidence}`),
  };
}

function formatList(items: readonly string[], fallback: string): string {
  if (!items.length) return `- ${fallback}`;
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildSupportRunbookShareText(
  plan: SupportRunbookPlan,
  options: SupportRunbookShareOptions = {},
): string {
  const appName = clean(options.appName) || "WoofWatcher";
  const rows = plan.sections.map((section) => {
    return `- ${section.title}: ${statusLabel(section.status)} - ${section.detail}`;
  });

  return [
    `${appName} Support Runbook`,
    `Generated: ${formatDateLabel(options.generatedAtIso)}`,
    `Verdict: ${plan.verdictLabel}`,
    "",
    plan.summary,
    "",
    `Support inbox: ${plan.supportEmail ?? "Not configured"}`,
    `Privacy policy: ${plan.privacyPolicyUrl ?? "Not linked"}`,
    `Terms: ${plan.termsUrl ?? "Not linked"}`,
    "",
    "Runbook sections:",
    rows.join("\n"),
    "",
    "Open blockers:",
    formatList(plan.launchBlockers, "No support blockers in this packet."),
    "",
    "Boundary:",
    "- WoofWatcher organizes owner-entered dog care. It is not veterinary advice, diagnosis, treatment, or emergency triage.",
    "- Urgent health, poisoning, injury, breathing, seizure, collapse, severe pain, or repeated vomiting concerns should go to a veterinarian or emergency clinic.",
  ].join("\n");
}

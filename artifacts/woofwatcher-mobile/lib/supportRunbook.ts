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

export const SUPPORT_LEGAL_READINESS_PROOF_ITEMS: readonly SupportLegalReadinessProofItem[] = [
  {
    label: "Support inbox",
    requiredEvidence:
      "monitored support inbox, owner/access list, response coverage, store support URL, and customer escalation path before public accounts or subscriptions.",
  },
  {
    label: "Privacy policy and terms links",
    requiredEvidence:
      "final https privacy policy and terms links, data retention/export/deletion language, AI/storage/payments disclosures, and store-listing URL ownership.",
  },
  {
    label: "Refund/subscription policy",
    requiredEvidence:
      "refund/subscription policy, cancellation language, billing support workflow, restore-purchase support, App Store/Play subscription compliance, and Premium surface copy approval.",
  },
  {
    label: "Veterinary and emergency boundary",
    requiredEvidence:
      "veterinary boundary and emergency language proving WoofWatcher is not veterinary advice, diagnosis, treatment, or emergency triage across Health Watch, WoofGuide, support, and store copy.",
  },
  {
    label: "Deletion escalation",
    requiredEvidence:
      "deletion escalation owner, export-first support flow, account-deletion request receipt, provider-delay fallback, and link to the self-serve deletion proof packet.",
  },
  {
    label: "Incident response owner",
    requiredEvidence:
      "incident response owner and triage path for login, billing, export, deletion, AI/veterinary-boundary, safety complaints, privacy requests, and store-review follow-up.",
  },
  {
    label: "Apollo approval",
    requiredEvidence:
      "Apollo approval of support operations, privacy/legal copy, refund/subscription policy, veterinary-boundary language, public launch timing, and no-launch boundary.",
  },
];

export const SUPPORT_LEGAL_READINESS_PROOF_SUMMARY =
  "Support legal readiness proof packet: support inbox, privacy policy and terms links, refund/subscription policy, veterinary boundary, deletion escalation, incident response owner, and Apollo approval before public launch can be claimed.";

const SUPPORT_LEGAL_READINESS_PROOF_EVIDENCE_KEYS: readonly (keyof SupportLegalReadinessProofEvidence)[] = [
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
  const items = SUPPORT_LEGAL_READINESS_PROOF_ITEMS.map<SupportLegalReadinessProofManifestItem>((item, index) => {
    const attached = clean(evidence[SUPPORT_LEGAL_READINESS_PROOF_EVIDENCE_KEYS[index]]);
    return {
      ...item,
      status: attached ? "ready" : "blocked",
      evidenceAttached: attached ? [attached] : [],
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
      ? "All support, privacy, refund, veterinary-boundary, deletion escalation, incident-response, and Apollo approval proof is attached for launch review."
      : "Public launch must stay blocked until support inbox, privacy policy and terms links, refund/subscription policy, veterinary boundary, deletion escalation, incident response owner, and Apollo approval proof are attached.",
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

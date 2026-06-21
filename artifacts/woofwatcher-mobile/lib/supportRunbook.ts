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

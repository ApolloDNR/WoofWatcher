export interface AiProviderProofItem {
  label: string;
  requiredEvidence: string;
}

export type AiProviderProofStatus = "blocked" | "ready-for-review";

export interface AiProviderProofEvidence {
  providerKeyStorage?: string | null;
  approvedModelPolicy?: string | null;
  sourceCitationRules?: string | null;
  ownerReviewWriteGate?: string | null;
  veterinarySafetyBoundary?: string | null;
  fallbackIncidentHandling?: string | null;
}

export interface AiProviderProofManifestItem extends AiProviderProofItem {
  status: "blocked" | "ready";
  evidenceAttached: readonly string[];
}

export interface AiProviderProofManifest {
  title: "WoofGuide AI provider proof manifest";
  status: AiProviderProofStatus;
  statusLabel: string;
  summary: string;
  readyCount: number;
  openCount: number;
  totalCount: number;
  liveAiAllowed: boolean;
  items: AiProviderProofManifestItem[];
  blockers: string[];
}

export const AI_PROVIDER_PROOF_ITEMS: readonly AiProviderProofItem[] = [
  {
    label: "Provider key and secret storage",
    requiredEvidence:
      "OpenAI key location, secret storage, environment scope, rotation owner, and confirmation that local placeholders are not used for release.",
  },
  {
    label: "Approved model policy",
    requiredEvidence:
      "Approved model id, prompt policy, safety/system instructions, data retention stance, and allowed WoofGuide tasks for beta and production.",
  },
  {
    label: "Source and citation rules",
    requiredEvidence:
      "Approved source labels, citation behavior, source freshness rules, and visible local-care-log boundaries for every AI-assisted answer.",
  },
  {
    label: "Owner-review write gate",
    requiredEvidence:
      "owner-reviewed draft flow, no automatic care-log writes, no direct record mutation, and audit copy before any AI suggestion can affect saved care data.",
  },
  {
    label: "Veterinary safety boundary",
    requiredEvidence:
      "not veterinary advice copy, emergency escalation language, diagnosis/treatment refusal examples, and vet-contact guidance for concerning symptoms.",
  },
  {
    label: "Fallback and incident handling",
    requiredEvidence:
      "fallback copy, rate-limit and provider-error behavior, incident logging, rollback plan, and owner support handoff if AI is unavailable or unsafe.",
  },
];

export const AI_PROVIDER_PROOF_SUMMARY =
  "WoofGuide AI provider proof packet: OpenAI key location, approved model policy, source/citation rules, owner-review write gate, veterinary safety boundary, and fallback handling before live AI can be enabled.";

const AI_PROVIDER_PROOF_EVIDENCE_KEYS: readonly (keyof AiProviderProofEvidence)[] = [
  "providerKeyStorage",
  "approvedModelPolicy",
  "sourceCitationRules",
  "ownerReviewWriteGate",
  "veterinarySafetyBoundary",
  "fallbackIncidentHandling",
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildAiProviderProofManifest(
  input: AiProviderProofEvidence | null | undefined,
): AiProviderProofManifest {
  const evidence = input ?? {};
  const items = AI_PROVIDER_PROOF_ITEMS.map<AiProviderProofManifestItem>((item, index) => {
    const attached = clean(evidence[AI_PROVIDER_PROOF_EVIDENCE_KEYS[index]]);
    return {
      ...item,
      status: attached ? "ready" : "blocked",
      evidenceAttached: attached ? [attached] : [],
    };
  });
  const readyCount = items.filter((item) => item.status === "ready").length;
  const totalCount = items.length;
  const openCount = totalCount - readyCount;
  const liveAiAllowed = openCount === 0;

  return {
    title: "WoofGuide AI provider proof manifest",
    status: liveAiAllowed ? "ready-for-review" : "blocked",
    statusLabel: liveAiAllowed ? "Ready for AI provider review" : "Live AI blocked",
    summary: liveAiAllowed
      ? "All WoofGuide AI provider proof is attached for review before live AI is enabled."
      : "WoofGuide must stay deterministic and owner-reviewed until OpenAI key storage, model policy, source/citation rules, write gates, veterinary safety, and fallback proof are attached.",
    readyCount,
    openCount,
    totalCount,
    liveAiAllowed,
    items,
    blockers: items.filter((item) => item.status === "blocked").map((item) => `${item.label}: ${item.requiredEvidence}`),
  };
}

export interface AiProviderProofItem {
  label: string;
  requiredEvidence: string;
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

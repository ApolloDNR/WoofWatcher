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
  aiProviderEvidence?: readonly AiProviderEvidenceFile[];
}

export type AiProviderEvidenceKind =
  | "provider-key-storage"
  | "model-policy"
  | "source-citation-rules"
  | "owner-review-write-gate"
  | "veterinary-safety-boundary"
  | "fallback-incident-handling";

export interface AiProviderEvidenceFile {
  kind: AiProviderEvidenceKind;
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  openAiKeyLocation?: string | null;
  secretStorage?: string | null;
  environmentScope?: string | null;
  rotationOwner?: string | null;
  localPlaceholdersExcluded?: boolean | null;
  approvedModelId?: string | null;
  promptPolicy?: string | null;
  systemInstructions?: string | null;
  dataRetentionStance?: string | null;
  allowedTasks?: string | null;
  safetyReviewed?: boolean | null;
  sourceLabels?: string | null;
  citationBehavior?: string | null;
  sourceFreshnessRules?: string | null;
  localCareLogBoundary?: string | null;
  visibleBoundaryApproved?: boolean | null;
  ownerReviewedDraftFlow?: string | null;
  auditCopy?: string | null;
  noAutomaticCareLogWrites?: boolean | null;
  noDirectRecordMutation?: boolean | null;
  notVeterinaryAdviceCopy?: string | null;
  emergencyEscalationLanguage?: string | null;
  diagnosisTreatmentRefusalExamples?: string | null;
  vetContactGuidance?: string | null;
  safetyApproved?: boolean | null;
  fallbackCopy?: string | null;
  incidentLogging?: string | null;
  rollbackPlan?: string | null;
  supportHandoff?: string | null;
  rateLimitBehaviorApproved?: boolean | null;
  providerErrorBehaviorApproved?: boolean | null;
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
      "OpenAI key location, secret storage, environment scope, rotation owner, and confirmation that local placeholders are not used for release in a provider key storage proof file named for OpenAI/secret storage with MIME and byte size.",
  },
  {
    label: "Approved model policy",
    requiredEvidence:
      "Approved model id, prompt policy, safety/system instructions, data retention stance, and allowed WoofGuide tasks for beta and production in a model-policy proof file with MIME and byte size.",
  },
  {
    label: "Source and citation rules",
    requiredEvidence:
      "Approved source labels, citation behavior, source freshness rules, and visible local-care-log boundaries for every AI-assisted answer in a source/citation proof file with MIME and byte size.",
  },
  {
    label: "Owner-review write gate",
    requiredEvidence:
      "owner-reviewed draft flow, no automatic care-log writes, no direct record mutation, and audit copy before any AI suggestion can affect saved care data in an owner-review write-gate proof file.",
  },
  {
    label: "Veterinary safety boundary",
    requiredEvidence:
      "not veterinary advice copy, emergency escalation language, diagnosis/treatment refusal examples, and vet-contact guidance for concerning symptoms in a veterinary safety proof file.",
  },
  {
    label: "Fallback and incident handling",
    requiredEvidence:
      "fallback copy, rate-limit and provider-error behavior, incident logging, rollback plan, and owner support handoff if AI is unavailable or unsafe in a fallback/incident proof file.",
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

type AiProviderTextField = keyof Pick<
  AiProviderEvidenceFile,
  | "openAiKeyLocation"
  | "secretStorage"
  | "environmentScope"
  | "rotationOwner"
  | "approvedModelId"
  | "promptPolicy"
  | "systemInstructions"
  | "dataRetentionStance"
  | "allowedTasks"
  | "sourceLabels"
  | "citationBehavior"
  | "sourceFreshnessRules"
  | "localCareLogBoundary"
  | "ownerReviewedDraftFlow"
  | "auditCopy"
  | "notVeterinaryAdviceCopy"
  | "emergencyEscalationLanguage"
  | "diagnosisTreatmentRefusalExamples"
  | "vetContactGuidance"
  | "fallbackCopy"
  | "incidentLogging"
  | "rollbackPlan"
  | "supportHandoff"
>;

type AiProviderBooleanField = keyof Pick<
  AiProviderEvidenceFile,
  | "localPlaceholdersExcluded"
  | "safetyReviewed"
  | "visibleBoundaryApproved"
  | "noAutomaticCareLogWrites"
  | "noDirectRecordMutation"
  | "safetyApproved"
  | "rateLimitBehaviorApproved"
  | "providerErrorBehaviorApproved"
>;

interface AiProviderEvidenceRequirement {
  kind: AiProviderEvidenceKind;
  locatorTokens: readonly string[];
  textFields: readonly AiProviderTextField[];
  booleanFields: readonly AiProviderBooleanField[];
  readyLabel: string;
}

const AI_PROVIDER_EVIDENCE_REQUIREMENTS: readonly AiProviderEvidenceRequirement[] = [
  {
    kind: "provider-key-storage",
    locatorTokens: ["openai", "secret-storage"],
    textFields: ["openAiKeyLocation", "secretStorage", "environmentScope", "rotationOwner"],
    booleanFields: ["localPlaceholdersExcluded"],
    readyLabel: "WoofGuide OpenAI secret storage proof ready",
  },
  {
    kind: "model-policy",
    locatorTokens: ["model-policy"],
    textFields: ["approvedModelId", "promptPolicy", "systemInstructions", "dataRetentionStance", "allowedTasks"],
    booleanFields: ["safetyReviewed"],
    readyLabel: "WoofGuide approved model policy proof ready",
  },
  {
    kind: "source-citation-rules",
    locatorTokens: ["source", "citation"],
    textFields: ["sourceLabels", "citationBehavior", "sourceFreshnessRules", "localCareLogBoundary"],
    booleanFields: ["visibleBoundaryApproved"],
    readyLabel: "WoofGuide source and citation rules proof ready",
  },
  {
    kind: "owner-review-write-gate",
    locatorTokens: ["owner-review", "write-gate"],
    textFields: ["ownerReviewedDraftFlow", "auditCopy"],
    booleanFields: ["noAutomaticCareLogWrites", "noDirectRecordMutation"],
    readyLabel: "WoofGuide owner-review write gate proof ready",
  },
  {
    kind: "veterinary-safety-boundary",
    locatorTokens: ["veterinary", "safety"],
    textFields: [
      "notVeterinaryAdviceCopy",
      "emergencyEscalationLanguage",
      "diagnosisTreatmentRefusalExamples",
      "vetContactGuidance",
    ],
    booleanFields: ["safetyApproved"],
    readyLabel: "WoofGuide veterinary safety proof ready",
  },
  {
    kind: "fallback-incident-handling",
    locatorTokens: ["fallback", "incident"],
    textFields: ["fallbackCopy", "incidentLogging", "rollbackPlan", "supportHandoff"],
    booleanFields: ["rateLimitBehaviorApproved", "providerErrorBehaviorApproved"],
    readyLabel: "WoofGuide fallback and incident handling proof ready",
  },
];

function evidenceMatchesRequirement(
  evidence: AiProviderEvidenceFile,
  requirement: AiProviderEvidenceRequirement,
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

export function buildAiProviderProofManifest(
  input: AiProviderProofEvidence | null | undefined,
): AiProviderProofManifest {
  const evidence = input ?? {};
  const attachedEvidence = evidence.aiProviderEvidence ?? [];
  const items = AI_PROVIDER_PROOF_ITEMS.map<AiProviderProofManifestItem>((item, index) => {
    const note = clean(evidence[AI_PROVIDER_PROOF_EVIDENCE_KEYS[index]]);
    const requirement = AI_PROVIDER_EVIDENCE_REQUIREMENTS[index];
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
  const liveAiAllowed = openCount === 0;

  return {
    title: "WoofGuide AI provider proof manifest",
    status: liveAiAllowed ? "ready-for-review" : "blocked",
    statusLabel: liveAiAllowed ? "Ready for AI provider review" : "Live AI blocked",
    summary: liveAiAllowed
      ? "All structured WoofGuide AI provider proof files are attached for review before live AI is enabled."
      : "WoofGuide must stay deterministic and owner-reviewed until structured proof files cover OpenAI key storage, model policy, source/citation rules, write gates, veterinary safety, and fallback handling.",
    readyCount,
    openCount,
    totalCount,
    liveAiAllowed,
    items,
    blockers: items.filter((item) => item.status === "blocked").map((item) => `${item.label}: ${item.requiredEvidence}`),
  };
}

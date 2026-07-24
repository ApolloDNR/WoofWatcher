export type HealthHeroAttentionKind =
  | "not-logged"
  | "care-evidence"
  | "health-attention";

export interface HealthHeroAttentionInput {
  careEvidenceObservedCount: number;
  careEvidenceTotalCount: number;
  evidenceWatchCount: number;
  healthStatus: "good" | "watch" | "alert";
  healthSummary: string;
  bileStatus: "No logs" | "Watch" | "Review";
}

export interface HealthHeroAttention {
  kind: HealthHeroAttentionKind;
  title: string;
  copy: string;
  statusLabel: "NOT LOGGED" | "OBSERVED" | "REVIEW LOGS";
  supportCopy: string;
}

/**
 * The six care-evidence lanes deliberately measure daily-care coverage, not
 * every health observation. A yellow-bile or symptom log can therefore be
 * important even when coverage is 0/6. Keep that observation visible instead
 * of translating it into a false empty state or a wellness score.
 */
export function deriveHealthHeroAttention(
  input: HealthHeroAttentionInput,
): HealthHeroAttention {
  const hasHealthAttention =
    input.healthStatus !== "good" || input.bileStatus !== "No logs";

  if (hasHealthAttention) {
    return {
      kind: "health-attention",
      title: "Recent health observation to review",
      copy: `${input.healthSummary} This organizes owner observations; it does not diagnose.`,
      statusLabel: "REVIEW LOGS",
      supportCopy:
        "A health observation was logged. Add context and share recurring concerns with a veterinarian.",
    };
  }

  if (input.careEvidenceObservedCount === 0) {
    return {
      kind: "not-logged",
      title: "No care evidence yet",
      copy:
        "Mood, energy, appetite, hydration, stool, and activity stay Not logged until the household records them.",
      statusLabel: "NOT LOGGED",
      supportCopy:
        "Start with one matching care log. Unrelated notes do not fill these lanes.",
    };
  }

  if (input.evidenceWatchCount > 0) {
    return {
      kind: "health-attention",
      title: "Recent observations to review",
      copy: `${input.careEvidenceObservedCount} of ${input.careEvidenceTotalCount} care lanes have shared observations from the last 7 days. This organizes logs; it does not diagnose.`,
      statusLabel: "REVIEW LOGS",
      supportCopy:
        "A watch label reflects what an owner recorded. Add context and share recurring concerns with a veterinarian.",
    };
  }

  return {
    kind: "care-evidence",
    title: "Recent observations logged",
    copy: `${input.careEvidenceObservedCount} of ${input.careEvidenceTotalCount} care lanes have shared observations from the last 7 days. This organizes logs; it does not diagnose.`,
    statusLabel: "OBSERVED",
    supportCopy:
      "These lanes confirm recent entries only; they are not a wellness grade.",
  };
}

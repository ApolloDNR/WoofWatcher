import type { CareHealthStatus } from "@workspace/care-domain";

export type HealthReviewPacketRoute = "/log" | "/woofguide" | "/records";

export interface HealthReviewPacketAction {
  label: string;
  route: HealthReviewPacketRoute;
  params?: Record<string, string>;
}

export interface HealthReviewPacketInput {
  dogName: string;
  healthStatus: CareHealthStatus;
  healthSummary: string;
  healthCounts: {
    vomit7: number;
    appetiteWatch7: number;
    stoolWatch7: number;
    anxiety7: number;
  };
  redFlagCount: number;
  bileStatus: "Low Risk" | "Watch" | "Review";
  lastYellowBileLabel: string;
  longestFoodGapLabel: string;
  bedtimeSnackLabel: string;
}

export interface HealthReviewPacket {
  title: string;
  statusLabel: "Steady" | "Worth watching" | "Consider sharing with your vet";
  languagePill: "Not veterinary advice" | "Pattern noticed" | "Review";
  summary: string;
  prompts: string[];
  vetShareChecklist: string[];
  boundary: string;
  primaryAction: HealthReviewPacketAction;
  secondaryAction: HealthReviewPacketAction;
}

export interface HealthReviewPacketShareOptions {
  dogName: string;
  generatedAtIso?: string;
}

function hasFoodGapLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return !!normalized && !normalized.includes("needs more") && !normalized.includes("learning");
}

function statusLabelFor(status: CareHealthStatus): HealthReviewPacket["statusLabel"] {
  if (status === "alert") return "Consider sharing with your vet";
  if (status === "watch") return "Worth watching";
  return "Steady";
}

function languagePillFor(input: HealthReviewPacketInput): HealthReviewPacket["languagePill"] {
  if (input.healthStatus === "alert" || input.bileStatus === "Review" || input.redFlagCount > 0) {
    return "Review";
  }
  if (input.healthStatus === "watch" || input.bileStatus === "Watch") return "Pattern noticed";
  return "Not veterinary advice";
}

function buildSummary(input: HealthReviewPacketInput, languagePill: HealthReviewPacket["languagePill"]): string {
  if (input.healthStatus === "good" && input.bileStatus === "Low Risk") {
    return `${input.dogName}'s Health Review Packet is built from owner observations: meals, stool, vomiting, energy, hydration, and medication context.`;
  }

  const foodGap = hasFoodGapLabel(input.longestFoodGapLabel)
    ? ` Longest food gap: ${input.longestFoodGapLabel}.`
    : "";
  return `${languagePill}: ${input.healthSummary}${foodGap} Keep the packet factual so a caregiver or vet can review the same context.`;
}

function buildPrompts(input: HealthReviewPacketInput): string[] {
  const prompts =
    input.healthStatus === "good" && input.bileStatus === "Low Risk"
      ? [
          "Keep logging meals, stool, vomiting, energy, and medication.",
          "Use bedtime snack notes to keep Bile Watch context readable.",
          "Add a note if appetite, energy, stool, or behavior changes.",
        ]
      : [
          "Capture timing, food gap, appetite after, energy after, stool detail, and hydration.",
          "Add a photo only when it helps the household or vet understand the observation.",
          "Keep notes factual: what happened, when, what Phoenix ate, and how she acted after.",
        ];

  if (input.healthStatus === "alert" || input.redFlagCount > 0) {
    return [...prompts, "If urgent red flags appear, contact a veterinarian or emergency clinic promptly."];
  }

  return prompts;
}

function buildChecklist(input: HealthReviewPacketInput): string[] {
  const checklist = [
    "Recent meals, portions, and appetite notes",
    `Last yellow bile event: ${input.lastYellowBileLabel}`,
    `Longest food gap: ${input.longestFoodGapLabel}`,
    `Bedtime snack proof: ${input.bedtimeSnackLabel}`,
    `Vomiting logs in 7 days: ${input.healthCounts.vomit7}`,
    `Appetite watch logs: ${input.healthCounts.appetiteWatch7}`,
    `Stool watch logs: ${input.healthCounts.stoolWatch7}`,
    `Anxiety or alone-time signals: ${input.healthCounts.anxiety7}`,
  ];

  if (input.redFlagCount > 0) {
    checklist.push(`Red-flag logs to review: ${input.redFlagCount}`);
  }

  return checklist;
}

export function deriveHealthReviewPacket(input: HealthReviewPacketInput): HealthReviewPacket {
  const languagePill = languagePillFor(input);
  const vetShareLanguage =
    input.healthStatus === "good"
      ? "Save this as calm household context."
      : "Consider sharing with your vet if the pattern repeats, worsens, or appears with other concerning signs.";

  return {
    title: "Review packet",
    statusLabel: statusLabelFor(input.healthStatus),
    languagePill,
    summary: buildSummary(input, languagePill),
    prompts: buildPrompts(input),
    vetShareChecklist: buildChecklist(input),
    boundary: `${vetShareLanguage} Not veterinary advice.`,
    primaryAction: {
      label: "Log health detail",
      route: "/log",
      params: { type: "symptom" },
    },
    secondaryAction: {
      label: "Draft vet questions",
      route: "/woofguide",
      params: { prompt: "health-review" },
    },
  };
}

function formatShareList(items: readonly string[], fallback: string): string[] {
  if (!items.length) return [`- ${fallback}`];
  return items.map((item) => `- ${item}`);
}

export function buildHealthReviewPacketShareText(
  packet: HealthReviewPacket,
  options: HealthReviewPacketShareOptions,
): string {
  const generatedAtIso = options.generatedAtIso ?? new Date().toISOString();

  return [
    "WoofWatcher Health Review Packet",
    `Generated: ${generatedAtIso}`,
    `Dog: ${options.dogName}`,
    `Status: ${packet.statusLabel}`,
    `Language: ${packet.languagePill}`,
    "",
    "Summary",
    packet.summary,
    "",
    "Suggested prompts",
    ...formatShareList(packet.prompts, "Keep logging care observations before sharing."),
    "",
    "Vet-share checklist",
    ...formatShareList(packet.vetShareChecklist, "No checklist items available yet."),
    "",
    "Boundary",
    packet.boundary,
    "This packet organizes owner observations only. It is not veterinary advice. Contact a veterinarian for medical concerns.",
  ].join("\n");
}

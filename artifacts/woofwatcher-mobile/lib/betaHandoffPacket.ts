import {
  mobileLaunchQaCaptureTargetStatusLabel,
  type MobileLaunchQaCapturePlan,
  type MobileLaunchQaCaptureTarget,
} from "./mobileLaunchQaEvidence.ts";
import type { LaunchProviderSetupPlan } from "./launchProviderSetup.ts";
import type { ReleasePacket } from "./releasePacket.ts";

const dependencyProofCommands = [
  "corepack prepare pnpm@10.24.0 --activate (if pnpm is missing and Corepack is available)",
  "pnpm install",
  "pnpm run doctor:mobile-beta",
  "pnpm run doctor:mobile-beta:json",
  "pnpm --filter @workspace/woofwatcher-mobile run smoke:web",
] as const;

export type BetaHandoffPacketOptions =
  | string
  | {
      generatedAtIso?: string;
      providerSetupPlan?: LaunchProviderSetupPlan;
    };

function formatList(items: readonly string[], fallback: string): string {
  if (!items.length) return `- ${fallback}`;
  return items.map((item) => `- ${item}`).join("\n");
}

function normalizeOptions(input: BetaHandoffPacketOptions | undefined): {
  generatedAtIso: string;
  providerSetupPlan?: LaunchProviderSetupPlan;
} {
  if (typeof input === "string") return { generatedAtIso: input };
  return {
    generatedAtIso: input?.generatedAtIso ?? new Date().toISOString(),
    providerSetupPlan: input?.providerSetupPlan,
  };
}

function formatProviderProof(plan: LaunchProviderSetupPlan | undefined): string[] {
  if (!plan) return [];

  return [
    "",
    "Provider proof needed:",
    ...plan.rows.map((row) => `- ${row.label}: ${row.proofRequired}`),
    "- Provider proof does not approve App Store, Play Store, payment, AI, storage, or database readiness.",
  ];
}

function formatCurrentMission(target: MobileLaunchQaCaptureTarget | undefined): string[] {
  if (!target) {
    return [
      "Next device mission: All listed capture surfaces are locally complete.",
      "Status: No active target",
      "Missing proof: No missing evidence.",
    ];
  }

  const lines = [
    `Next device mission: ${target.title} (${target.route})`,
    `Status: ${mobileLaunchQaCaptureTargetStatusLabel(target)}`,
    `Missing proof: ${target.missingEvidence.join(" ") || "No missing evidence."}`,
    `Setup: ${target.setupSteps.join(" ") || "Use the local Phoenix preview state."}`,
    `Steps: ${target.verificationSteps.join(" ") || "Open the route, verify it on phone, and attach proof."}`,
    `Pass criteria: ${target.acceptanceCriteria.join(" ") || "The route is readable, reachable, and useful."}`,
    `Needs tune if: ${target.failureEscalation}`,
    `Evidence attached: ${target.evidenceAttached}`,
  ];

  if (target.routeChecklist?.length) {
    lines.push("Run order:");
    target.routeChecklist.forEach((routeCheck, index) => {
      lines.push(
        `${index + 1}. ${routeCheck.label} (${routeCheck.route}): ${routeCheck.expected}${
          routeCheck.proof ? ` Proof: ${routeCheck.proof}` : ""
        }`,
      );
    });
  }

  if (mobileLaunchQaCaptureTargetStatusLabel(target) === "Pass pending proof") {
    lines.push("Tester instruction: finish the missing proof before treating this beta mission as complete.");
  }

  return lines;
}

function formatOwnerPreviewProof(plan: MobileLaunchQaCapturePlan): string[] {
  const proof = plan.ownerPreviewProofStatus;

  return [
    `Owner preview proof: ${proof.statusLabel}`,
    `Owner preview missing: ${
      proof.missingEvidence.length ? proof.missingEvidence.join(" ") : "No owner-preview proof is missing."
    }`,
    `Owner preview evidence: ${proof.evidenceAttached} attached`,
  ];
}

export function buildBetaHandoffPacketShareText(
  releasePacket: ReleasePacket,
  capturePlan: MobileLaunchQaCapturePlan,
  optionsOrGeneratedAt?: BetaHandoffPacketOptions,
): string {
  const { generatedAtIso, providerSetupPlan } = normalizeOptions(optionsOrGeneratedAt);
  const currentMission = capturePlan.nextTargets[0];

  return [
    "WoofWatcher 48-Hour Beta Handoff",
    `Generated: ${generatedAtIso}`,
    `Build: ${releasePacket.buildName}`,
    `Beta verdict: ${releasePacket.betaVerdictLabel}`,
    `Public launch verdict: ${releasePacket.verdictLabel}`,
    `Readiness score: ${releasePacket.readinessScore}%`,
    `QA progress: ${capturePlan.completeSurfaces}/${capturePlan.totalSurfaces} surfaces complete, ${capturePlan.openSurfaces} open.`,
    ...formatOwnerPreviewProof(capturePlan),
    "",
    releasePacket.betaSummary,
    "",
    "Current mission:",
    ...formatCurrentMission(currentMission),
    "",
    "Beta next actions:",
    formatList(releasePacket.betaNextActions, "Share beta build after final owner sign-off."),
    "",
    "Dependency proof commands:",
    formatList(dependencyProofCommands, "Run the mobile beta doctor before sharing."),
    "- Dependency proof only counts when both doctor commands report no blockers.",
    "- Dependency proof requires a real PATH pnpm at 10.24.0; do not use a bundled pnpm 11.x candidate.",
    "- If JSON doctor reports BLOCKED, attach the JSON output to the handoff instead of claiming readiness.",
    "",
    "Required beta proof after export:",
    "- Open /care-twin-qa on iOS and Android before sharing beta proof.",
    "- Attach iOS Quick Log/Log proof and Android Launch Readiness proof.",
    "- Confirm Care Pass Report History storage status says Saved on this device or Ready to upload.",
    "- Save the Mission note and clear Pass pending proof in both /care-twin-qa and More.",
    "",
    "Native QA Needs tune fix brief:",
    "- If any route is marked Needs tune, use More's Share Fix Brief before claiming beta proof.",
    "- Fix the first below-beta route, return to /care-twin-qa, attach confirmation proof, and update the Mission note.",
    ...formatProviderProof(providerSetupPlan),
    "",
    "Truth boundaries:",
    "- No App Store or Play Store submission is approved by this packet.",
    "- Provider-backed auth, database, storage, AI, push, and payments must stay gated until credentials and policies are configured.",
    "- WoofGuide stays non-diagnostic and owner-reviewed.",
    "- Public launch remains separate from local beta evidence.",
    "",
    "Done condition: capture required iOS/Android proof, save the Mission note, clear Pass pending proof, then share the QA summary.",
  ].join("\n");
}

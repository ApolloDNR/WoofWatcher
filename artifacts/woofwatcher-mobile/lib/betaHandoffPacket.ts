import {
  mobileLaunchQaCaptureTargetStatusLabel,
  type MobileLaunchQaCapturePlan,
  type MobileLaunchQaCaptureTarget,
} from "./mobileLaunchQaEvidence.ts";
import { mobileReleaseQaRouteProofLabel } from "./mobileReleaseQa.ts";
import {
  buildMobileQaSessionProofManifestShareText,
  type MobileQaSessionProofManifest,
} from "./mobileQaSession.ts";
import type { LaunchProviderSetupPlan } from "./launchProviderSetup.ts";
import {
  buildMobileReleaseSmokeChecklist,
  buildMobileReleaseSmokeChecklistShareText,
  MOBILE_RELEASE_SMOKE_DEPENDENCY_COMMANDS,
} from "./mobileReleaseSmokeChecklist.ts";
import type { ReleasePacket } from "./releasePacket.ts";

const dependencyProofCommands = MOBILE_RELEASE_SMOKE_DEPENDENCY_COMMANDS;

export interface MobileBetaCiProof {
  workflowName: "WoofWatcher Verify";
  runId: string;
  jobId: string;
  branch: string;
  commit: string;
  duration: string;
  proofUrl: string;
  passedSteps: readonly string[];
  coverage: string;
}

export const RECORDED_MOBILE_BETA_CI_PROOF: MobileBetaCiProof = {
  workflowName: "WoofWatcher Verify",
  runId: "28653297333",
  jobId: "84976275755",
  branch: "automation/premium-revenue-product-builder",
  commit: "9a36135",
  duration: "2m57s",
  proofUrl: "https://github.com/ApolloDNR/WoofWatcher/actions/runs/28653297333",
  passedSteps: [
    "Setup pnpm",
    "Install dependencies",
    "Run mobile beta doctor",
    "Run focused behavior tests",
    "Typecheck and CI-safe builds",
  ],
  coverage: "pinned pnpm 10.24.0, JSON mobile beta doctor, focused tests, build:ci, mobile smoke:web and smoke:runtime",
};

export type BetaHandoffPacketOptions =
  | string
  | {
      generatedAtIso?: string;
      ciProof?: MobileBetaCiProof | null;
      providerSetupPlan?: LaunchProviderSetupPlan;
      proofManifest?: MobileQaSessionProofManifest | null;
    };

function formatList(items: readonly string[], fallback: string): string {
  if (!items.length) return `- ${fallback}`;
  return items.map((item) => `- ${item}`).join("\n");
}

function normalizeOptions(input: BetaHandoffPacketOptions | undefined): {
  generatedAtIso: string;
  ciProof?: MobileBetaCiProof | null;
  providerSetupPlan?: LaunchProviderSetupPlan;
  proofManifest?: MobileQaSessionProofManifest | null;
} {
  if (typeof input === "string") return { generatedAtIso: input };
  return {
    generatedAtIso: input?.generatedAtIso ?? new Date().toISOString(),
    ciProof: input?.ciProof,
    providerSetupPlan: input?.providerSetupPlan,
    proofManifest: input?.proofManifest,
  };
}

function formatCiProof(proof: MobileBetaCiProof | null | undefined): string[] {
  if (!proof) {
    return [
      "- No GitHub Actions proof is attached; dispatch WoofWatcher Verify on the branch before treating dependency proof as complete.",
      "- CI proof does not approve native screenshots, provider setup, store approval, or Apollo sign-off.",
    ];
  }

  return [
    `- ${proof.workflowName} run ${proof.runId} passed on ${proof.branch} at commit ${proof.commit} (job ${proof.jobId}, ${proof.duration}).`,
    `- Proof URL: ${proof.proofUrl}`,
    `- Passed steps: ${proof.passedSteps.join("; ")}.`,
    `- Covers: ${proof.coverage}.`,
    "- CI proof does not approve native screenshots, provider setup, store approval, or Apollo sign-off.",
  ];
}

function formatProviderProof(plan: LaunchProviderSetupPlan | undefined): string[] {
  if (!plan) return [];

  return [
    "",
    "Provider proof needed:",
    ...plan.rows.flatMap((row) => [
      `- ${row.label}: ${row.proofRequired}`,
      ...row.proofChecklist.map((item) => `  - ${item}`),
    ]),
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
      const routeProof = mobileReleaseQaRouteProofLabel(routeCheck);
      lines.push(
        `${index + 1}. ${routeCheck.label} (${routeCheck.route}): ${routeCheck.expected}${
          routeProof ? ` Proof: ${routeProof}` : ""
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
  const { generatedAtIso, ciProof, providerSetupPlan, proofManifest } = normalizeOptions(optionsOrGeneratedAt);
  const currentMission = capturePlan.nextTargets[0];
  const releaseSmokeChecklist = buildMobileReleaseSmokeChecklist(releasePacket, capturePlan, {
    generatedAtIso,
    providerSetupPlan,
  });

  return [
    "WoofWatcher 48-Hour Beta Handoff",
    `Generated: ${generatedAtIso}`,
    `Build: ${releasePacket.buildName}`,
    `Beta verdict: ${releasePacket.betaVerdictLabel}`,
    `Public launch verdict: ${releasePacket.verdictLabel}`,
    `Readiness score: ${releasePacket.readinessScore}%`,
    `QA progress: ${capturePlan.completeSurfaces}/${capturePlan.totalSurfaces} surfaces complete, ${capturePlan.openSurfaces} open.`,
    ...(proofManifest ? ["", buildMobileQaSessionProofManifestShareText(proofManifest)] : []),
    ...formatOwnerPreviewProof(capturePlan),
    "",
    "Release smoke checklist:",
    buildMobileReleaseSmokeChecklistShareText(releaseSmokeChecklist),
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
    "Dependency-complete CI proof:",
    ...formatCiProof(ciProof),
    "",
    "Required beta proof after export:",
    "- Open /care-twin-qa on iOS and Android before sharing beta proof.",
    "- Attach iOS Quick Log/Log proof and Android Launch Readiness proof.",
    "- Confirm Care Pass Report History storage status says Saved on this device or Ready to upload.",
    "- Confirm Care Pass export manifest shows Printable HTML local file, file size, and PDF pending before claiming PDF readiness.",
    "- Confirm Records Dog ID printable source shares as a local HTML credential file; image/PDF export stays pending.",
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

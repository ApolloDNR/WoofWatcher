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

export interface MobileLivePreviewHandoffProof {
  title: "WoofWatcher Live Preview Handoff Proof";
  generatedAtIso: string;
  result: "PASS" | "BLOCKED";
  baseUrl: string;
  commit: string;
  exportIndexMtimeIso: string;
  routeChecks: readonly {
    route: string;
    status: "PASS" | "BLOCKED";
    detail: string;
  }[];
  truthBoundaries: readonly string[];
  nextActions: readonly string[];
}

export const RECORDED_MOBILE_BETA_CI_PROOF: MobileBetaCiProof = {
  workflowName: "WoofWatcher Verify",
  runId: "28683229279",
  jobId: "85070831897",
  branch: "automation/premium-revenue-product-builder",
  commit: "2f8f36a",
  duration: "3m2s",
  proofUrl: "https://github.com/ApolloDNR/WoofWatcher/actions/runs/28683229279",
  passedSteps: [
    "Setup pnpm",
    "Setup Node",
    "Install dependencies",
    "Run mobile beta doctor",
    "Run focused behavior tests",
    "Typecheck and CI-safe builds",
  ],
  coverage:
    "pinned pnpm 10.24.0, JSON mobile beta doctor with auth/setup smoke proof, auth/setup native QA target, auth provider proof packet, provider staged-row truth boundary, support legal readiness proof target, provider-approved support/legal launch-readiness wiring, Plus checkout approval truth boundary, Records storage provider-approval clamp, Records binary proof manifest, focused tests, build:ci with mobile smoke:web, smoke:runtime, and proof:live-preview",
};

export const RECORDED_LIVE_PREVIEW_HANDOFF_PROOF: MobileLivePreviewHandoffProof = {
  title: "WoofWatcher Live Preview Handoff Proof",
  generatedAtIso: "2026-07-03T21:06:14.191Z",
  result: "PASS",
  baseUrl: "http://127.0.0.1:60306/",
  commit: "2f8f36a",
  exportIndexMtimeIso: "2026-07-03T12:38:39.906Z",
  routeChecks: [
    { route: "/", status: "PASS", detail: "200 text/html; charset=utf-8; Expo web entry present" },
    { route: "/sign-in", status: "PASS", detail: "200 text/html; charset=utf-8; Expo web entry present" },
    { route: "/setup", status: "PASS", detail: "200 text/html; charset=utf-8; Expo web entry present" },
    { route: "/log", status: "PASS", detail: "200 text/html; charset=utf-8; Expo web entry present" },
    { route: "/calendar", status: "PASS", detail: "200 text/html; charset=utf-8; Expo web entry present" },
    { route: "/health", status: "PASS", detail: "200 text/html; charset=utf-8; Expo web entry present" },
    { route: "/records", status: "PASS", detail: "200 text/html; charset=utf-8; Expo web entry present" },
    { route: "/more", status: "PASS", detail: "200 text/html; charset=utf-8; Expo web entry present" },
    {
      route: "/care-twin-qa?qaSurface=auth-setup-onboarding-proof",
      status: "PASS",
      detail: "200 text/html; charset=utf-8; Expo web entry present",
    },
    {
      route: "/care-twin-qa?qaSurface=records-local-file-handoff",
      status: "PASS",
      detail: "200 text/html; charset=utf-8; Expo web entry present",
    },
    {
      route: "/care-twin-qa?qaSurface=report-binary-export-proof",
      status: "PASS",
      detail: "200 text/html; charset=utf-8; Expo web entry present",
    },
    {
      route: "/care-twin-qa?qaSurface=care-entry-provider-sync-proof",
      status: "PASS",
      detail: "200 text/html; charset=utf-8; Expo web entry present",
    },
    {
      route: "/care-twin-qa?qaSurface=woofguide-ai-provider-proof",
      status: "PASS",
      detail: "200 text/html; charset=utf-8; Expo web entry present",
    },
    {
      route: "/care-twin-qa?qaSurface=push-notifications-proof",
      status: "PASS",
      detail: "200 text/html; charset=utf-8; Expo web entry present",
    },
    {
      route: "/care-twin-qa?qaSurface=payments-provider-proof",
      status: "PASS",
      detail: "200 text/html; charset=utf-8; Expo web entry present",
    },
    {
      route: "/care-twin-qa?qaSurface=store-accounts-proof",
      status: "PASS",
      detail: "200 text/html; charset=utf-8; Expo web entry present",
    },
    {
      route: "/care-twin-qa?qaSurface=account-deletion-proof",
      status: "PASS",
      detail: "200 text/html; charset=utf-8; Expo web entry present",
    },
    {
      route: "/care-twin-qa?qaSurface=support-legal-readiness-proof",
      status: "PASS",
      detail: "200 text/html; charset=utf-8; Expo web entry present",
    },
    {
      route: "/care-twin-qa?qaSurface=route-visual-consistency",
      status: "PASS",
      detail: "200 text/html; charset=utf-8; Expo web entry present",
    },
  ],
  truthBoundaries: [
    "Live preview proof is web preview only and does not replace native iOS/Android proof.",
    "Live preview proof does not approve provider-backed storage, sync, AI, payments, push, store approval, public launch, or Apollo sign-off.",
    ".expo-smoke metadata does not prove the export was produced from the current commit; keep branch CI and export logs attached.",
  ],
  nextActions: [
    "Attach this JSON, the preview URL, and the preview:smoke terminal output to Share Beta Handoff without claiming native QA.",
    "Run WoofWatcher Verify after each new commit before treating dependency proof as current.",
    "Run native iOS/Android proof targets separately for Records local files, care-entry provider sync, push notifications, route visual consistency, and generated PDF/PNG artifacts.",
  ],
};

export type BetaHandoffPacketOptions =
  | string
  | {
      generatedAtIso?: string;
      ciProof?: MobileBetaCiProof | null;
      livePreviewProof?: MobileLivePreviewHandoffProof | null;
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
  livePreviewProof?: MobileLivePreviewHandoffProof | null;
  providerSetupPlan?: LaunchProviderSetupPlan;
  proofManifest?: MobileQaSessionProofManifest | null;
} {
  if (typeof input === "string") return { generatedAtIso: input };
  return {
    generatedAtIso: input?.generatedAtIso ?? new Date().toISOString(),
    ciProof: input?.ciProof,
    livePreviewProof: input?.livePreviewProof,
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
    `- Recorded branch CI proof: ${proof.workflowName} run ${proof.runId} passed on ${proof.branch} at commit ${proof.commit} (job ${proof.jobId}, ${proof.duration}).`,
    `- Proof URL: ${proof.proofUrl}`,
    `- Passed steps: ${proof.passedSteps.join("; ")}.`,
    `- Covers: ${proof.coverage}.`,
    "- Rerun WoofWatcher Verify after any new commit before treating dependency proof as current.",
    "- CI proof does not approve native screenshots, provider setup, store approval, or Apollo sign-off.",
  ];
}

function formatLivePreviewProof(proof: MobileLivePreviewHandoffProof | null | undefined): string[] {
  if (!proof) {
    return [
      "- No live preview route proof is attached; run pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview after smoke:web and smoke:runtime.",
      "- Attach JSON route proof plus preview:smoke URL/output before claiming live preview handoff proof.",
      "- Live preview proof does not replace native iOS/Android proof.",
    ];
  }

  const passCount = proof.routeChecks.filter((check) => check.status === "PASS").length;
  const totalCount = proof.routeChecks.length;

  return [
    `- Recorded live preview proof: ${proof.title} generated ${proof.generatedAtIso} on commit ${proof.commit}.`,
    `- Result: ${proof.result}. Routes: ${passCount}/${totalCount} web-preview shell checks passed.`,
    `- Recorded verifier URL: ${proof.baseUrl}`,
    "- Preview handoff URL: http://127.0.0.1:4194/ after preview:smoke is running.",
    `- Export index mtime: ${proof.exportIndexMtimeIso}`,
    `- Route checks: ${proof.routeChecks.map((check) => `${check.route} ${check.status}`).join("; ")}.`,
    "- Attach proof: JSON route proof plus preview:smoke URL/output before claiming preview handoff.",
    "- Rerun proof:live-preview after any new commit or export before treating preview proof as current.",
    "- Live preview proof does not replace native iOS/Android proof.",
    ...proof.truthBoundaries.map((boundary) => `- ${boundary}`),
    ...proof.nextActions.map((action) => `- Next: ${action}`),
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
  const { generatedAtIso, ciProof, livePreviewProof, providerSetupPlan, proofManifest } =
    normalizeOptions(optionsOrGeneratedAt);
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
    "Recorded live preview proof:",
    ...formatLivePreviewProof(livePreviewProof),
    "",
    "Required beta proof after export:",
    "- Open /care-twin-qa on iOS and Android before sharing beta proof.",
    "- Attach iOS Quick Log/Log proof and Android Launch Readiness proof.",
    "- Confirm Care Pass Report History storage status says Saved on this device, or Ready to upload only after provider-approved storage.",
    "- Confirm Care Pass export manifest shows Printable HTML local file, file size, and PDF pending before claiming PDF readiness.",
    "- Confirm Records Dog ID shares a local HTML credential file and SVG image source; PNG/PDF export stays pending.",
    "- Open focused auth/setup target: /care-twin-qa?qaSurface=auth-setup-onboarding-proof.",
    "- Capture Auth gateway and Setup local-preview proof while provider-backed auth and household creation stay blocked.",
    "- Open focused Records handoff target: /care-twin-qa?qaSurface=records-local-file-handoff.",
    "- Capture Care Pass Report History local HTML, Dog ID local HTML, Dog ID SVG, share sheet behavior, Android content URI, and fallback copy.",
    "- Open focused binary export proof target: /care-twin-qa?qaSurface=report-binary-export-proof.",
    "- Approve Care Pass PDF generator, Dog ID PNG renderer, provider storage policy, and iOS/Android artifact proof before claiming PDF/PNG readiness.",
    "- Open focused care-entry provider sync target: /care-twin-qa?qaSurface=care-entry-provider-sync-proof.",
    "- Attach Supabase project id, migration/backfill for care_entries.updated_at and care_entry_tombstones, active-household RLS cursor/tombstone proof, retention/export/deletion policy, dependency-complete build proof, and mobile full-refresh sign-off before enabling incremental sync.",
    "- Open focused WoofGuide AI provider target: /care-twin-qa?qaSurface=woofguide-ai-provider-proof.",
    "- Attach OpenAI key location, approved model policy, source/citation rules, and owner-review write gate, veterinary safety boundary and fallback/incident handling before enabling live AI.",
    "- Open focused push notifications target: /care-twin-qa?qaSurface=push-notifications-proof.",
    "- Attach Expo push project id, APNs credentials, Firebase/FCM credentials, permission prompt copy, quiet hours, opt-out behavior, delivery QA, and missed notification fallback before claiming reminder delivery.",
    "- Open focused payments provider target: /care-twin-qa?qaSurface=payments-provider-proof.",
    "- Attach Plus and Family product ids, billing path decision, sandbox purchase/renewal/cancel/refund/expired receipt proof, restore purchases behavior, entitlement mapping, refund/support policy, and checkout-gate proof before enabling paid checkout.",
    "- Open focused store accounts target: /care-twin-qa?qaSurface=store-accounts-proof.",
    "- Attach Apple Developer team id, App Store Connect app record, Google Play package record, bundle/signing ownership, reviewer access/test credentials, screenshots/metadata ownership, and release role approval before claiming store submission.",
    "- Open focused account deletion target: /care-twin-qa?qaSurface=account-deletion-proof.",
    "- Attach self-serve deletion route, reauthentication requirement, export-before-delete warning, data/object deletion receipt, audit trail, support receipt, recovery-window policy, and legal/store approval before enabling destructive deletion.",
    "- Open focused support legal readiness target: /care-twin-qa?qaSurface=support-legal-readiness-proof.",
    "- Attach support inbox, privacy policy and terms links, refund/subscription policy, veterinary boundary, deletion escalation, incident response owner, and Apollo approval before public launch.",
    "- Open focused route visual target: /care-twin-qa?qaSurface=route-visual-consistency.",
    "- Capture Home, Log, Plans, Health, Records, and More on iOS and Android before claiming route visual proof.",
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

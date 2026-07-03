import type { LaunchProviderSetupPlan } from "./launchProviderSetup.ts";
import {
  mobileLaunchQaCaptureTargetStatusLabel,
  type MobileLaunchQaCapturePlan,
  type MobileLaunchQaCaptureTarget,
} from "./mobileLaunchQaEvidence.ts";
import type { MobileReleaseQaRouteCheck } from "./mobileReleaseQa.ts";
import type { ReleasePacket } from "./releasePacket.ts";

export const MOBILE_RELEASE_SMOKE_DEPENDENCY_COMMANDS = [
  "corepack prepare pnpm@10.24.0 --activate",
  "pnpm install",
  "pnpm run doctor:mobile-beta",
  "pnpm run doctor:mobile-beta:json",
  "pnpm --filter @workspace/woofwatcher-mobile run smoke:web",
  "pnpm --filter @workspace/woofwatcher-mobile run smoke:runtime",
  "pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview",
  "pnpm --filter @workspace/woofwatcher-mobile run preview:smoke",
] as const;

export type MobileReleaseSmokeChecklistItemStatus = "required" | "blocked" | "source-backed";

export interface MobileReleaseSmokeChecklistItem {
  label: string;
  detail: string;
  proof: string;
  status: MobileReleaseSmokeChecklistItemStatus;
}

export interface MobileReleaseSmokeChecklistSection {
  title: string;
  items: MobileReleaseSmokeChecklistItem[];
}

export interface MobileReleaseSmokeChecklistOptions {
  generatedAtIso?: string;
  providerSetupPlan?: LaunchProviderSetupPlan;
}

export interface MobileReleaseSmokeChecklist {
  title: "WoofWatcher Release Smoke Checklist";
  generatedAtIso: string;
  buildName: string;
  releaseVerdict: string;
  betaVerdict: string;
  readinessScore: number;
  summary: string;
  dependencyCommands: readonly string[];
  sections: MobileReleaseSmokeChecklistSection[];
  truthBoundaries: string[];
  doneCondition: string;
}

function normalizeGeneratedAt(input: string | undefined): string {
  const parsed = input ? new Date(input) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function formatRouteProof(routeCheck: MobileReleaseQaRouteCheck): string {
  return routeCheck.proof ? ` Proof: ${routeCheck.proof}` : "";
}

function routeChecklistItems(target: MobileLaunchQaCaptureTarget | undefined): MobileReleaseSmokeChecklistItem[] {
  if (!target?.routeChecklist?.length) return [];

  return target.routeChecklist.map((routeCheck) => ({
    label: `${routeCheck.label} (${routeCheck.route})`,
    detail: `${routeCheck.expected}${formatRouteProof(routeCheck)}`,
    proof: routeCheck.requiredNativePlatforms?.length
      ? `Capture ${routeCheck.requiredNativePlatforms.join(" and ")} native proof.`
      : "Capture the route result in the Mission note or attached proof.",
    status: "required" as const,
  }));
}

function buildRouteRehearsalSection(capturePlan: MobileLaunchQaCapturePlan): MobileReleaseSmokeChecklistSection {
  const currentMission = capturePlan.nextTargets[0];
  const routeItems = routeChecklistItems(currentMission);
  const missionStatus = currentMission
    ? mobileLaunchQaCaptureTargetStatusLabel(currentMission)
    : "No active target";

  return {
    title: "Route rehearsal",
    items: [
      {
        label: currentMission ? `${currentMission.title} (${currentMission.route})` : "All QA routes",
        detail: currentMission
          ? `Status: ${missionStatus}. Missing proof: ${
              currentMission.missingEvidence.join(" ") || "No missing proof."
            }`
          : "All listed capture surfaces are locally complete.",
        proof: currentMission
          ? `Open with QA return: ${currentMission.qaReturnRoute}`
          : "Attach the final QA summary before beta sharing.",
        status: currentMission ? "required" : "source-backed",
      },
      {
        label: "Owner route loop",
        detail:
          "Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, and Care Pass must open without dead ends.",
        proof: capturePlan.ownerPreviewProofStatus.missingEvidence.length
          ? capturePlan.ownerPreviewProofStatus.missingEvidence.join(" ")
          : "Owner Preview Core Loop proof is complete.",
        status: capturePlan.ownerPreviewProofStatus.complete ? "source-backed" : "required",
      },
      ...routeItems,
    ],
  };
}

function buildProviderProofSection(
  providerSetupPlan: LaunchProviderSetupPlan | undefined,
): MobileReleaseSmokeChecklistSection {
  if (!providerSetupPlan) {
    return {
      title: "Provider proof gates",
      items: [
        {
          label: "Provider Launch Setup",
          detail: "Attach the live Provider Launch Setup plan before claiming provider-backed smoke proof.",
          proof: "No Supabase, storage, AI, payments, push, or store-account provider proof is attached by default.",
          status: "blocked",
        },
      ],
    };
  }

  return {
    title: "Provider proof gates",
    items: providerSetupPlan.rows.map((row) => ({
      label: row.label,
      detail: row.proofRequired,
      proof: row.proofChecklist.length
        ? row.proofChecklist.join(" ")
        : "Attach the provider evidence named in the proof requirement.",
      status: row.status === "ready" ? "source-backed" : "blocked",
    })),
  };
}

export function buildMobileReleaseSmokeChecklist(
  releasePacket: ReleasePacket,
  capturePlan: MobileLaunchQaCapturePlan,
  options: MobileReleaseSmokeChecklistOptions = {},
): MobileReleaseSmokeChecklist {
  const generatedAtIso = normalizeGeneratedAt(options.generatedAtIso);

  return {
    title: "WoofWatcher Release Smoke Checklist",
    generatedAtIso,
    buildName: releasePacket.buildName,
    releaseVerdict: releasePacket.verdictLabel,
    betaVerdict: releasePacket.betaVerdictLabel,
    readinessScore: releasePacket.readinessScore,
    summary:
      "Run this checklist after a dependency-complete export and before sharing the beta handoff or claiming release proof.",
    dependencyCommands: MOBILE_RELEASE_SMOKE_DEPENDENCY_COMMANDS,
    sections: [
      {
        title: "Dependency and export proof",
        items: MOBILE_RELEASE_SMOKE_DEPENDENCY_COMMANDS.map((command) => ({
          label: command,
          detail:
            command.includes("doctor:mobile-beta")
              ? "Doctor output must report no dependency/export blockers before beta export proof counts."
              : "Run from a dependency-complete checkout with pnpm 10.24.0 on PATH.",
          proof: "Attach terminal output or JSON doctor output to the handoff.",
          status: "required" as const,
        })),
      },
      {
        title: "Live preview handoff proof",
        items: [
          {
            label: "Dependency-complete branch CI",
            detail:
              "Attach a WoofWatcher Verify run proving pnpm 10.24.0 install, JSON doctor, focused tests, smoke:web, and smoke:runtime for the branch.",
            proof:
              "Run URL, job id, commit SHA, and passed step list; CI proof does not approve native screenshots.",
            status: "required",
          },
          {
            label: "Live preview handoff verifier",
            detail:
              "Run pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview to produce JSON route proof for the exported web preview.",
            proof:
              "Attach the JSON result with route status, commit, export index timestamp, and web-preview-only truth boundaries.",
            status: "required",
          },
          {
            label: "Preview server handoff",
            detail:
              "Run pnpm --filter @workspace/woofwatcher-mobile run preview:smoke, then open http://127.0.0.1:4194/.",
            proof:
              "Attach preview:smoke terminal output, URL, browser-open note, and any web screenshot as preview-only evidence.",
            status: "required",
          },
          {
            label: "Auth and setup route smoke",
            detail:
              "Confirm /sign-in and /setup return the Expo web shell in smoke:runtime and proof:live-preview before account or onboarding handoff.",
            proof:
              "Attach smoke:runtime and proof:live-preview output showing /sign-in and /setup passing; this does not prove provider-backed auth or household creation.",
            status: "required",
          },
          {
            label: "Preview truth boundary",
            detail:
              "Use preview proof for live review and visual triage only; live preview proof does not replace native iOS/Android proof.",
            proof:
              "Keep native QA, provider setup, store approval, and Apollo sign-off listed as open until real artifacts exist.",
            status: "required",
          },
        ],
      },
      buildRouteRehearsalSection(capturePlan),
      {
        title: "Records and export truth",
        items: [
          {
            label: "Care Pass Report History",
            detail:
              "Confirm WoofWatcherReports contains the Printable HTML local file, file size, and PDF pending copy.",
            proof:
              "Attach iOS or Android proof that Report History says Saved on this device or Ready to upload before handoff.",
            status: "required",
          },
          {
            label: "Dog ID credential",
            detail:
              "Confirm WoofWatcherCredentials contains the local HTML credential file and SVG image source while PNG/PDF export stays pending.",
            proof: "Attach share-sheet or saved-file proof from a native runtime.",
            status: "required",
          },
          {
            label: "Focused Records handoff target",
            detail:
              "Open /care-twin-qa?qaSurface=records-local-file-handoff and capture Care Pass Report History local HTML, Dog ID local HTML, and Dog ID SVG image source proof.",
            proof:
              "Attach iOS/Android share sheet behavior, Android content URI or saved-file proof, and fallback copy note before claiming Records handoff proof.",
            status: "required",
          },
          {
            label: "Focused binary export proof target",
            detail:
              "Open /care-twin-qa?qaSurface=report-binary-export-proof and confirm approved Care Pass PDF generator, approved Dog ID PNG renderer, provider storage policy, and iOS/Android artifact proof before binary readiness.",
            proof:
              "Attach generator choices, file name, file size, MIME proof, share/reopen proof, and storage policy evidence before claiming PDF/PNG readiness.",
            status: "required",
          },
          {
            label: "Focused care-entry provider sync proof target",
            detail:
              "Open /care-twin-qa?qaSurface=care-entry-provider-sync-proof and confirm Supabase migration/backfill for care_entries.updated_at and care_entry_tombstones, active-household RLS, retention/export/deletion policy, dependency proof, and mobile full-refresh sign-off before incremental sync.",
            proof:
              "Attach Supabase project id, migration ids, updated_at backfill timestamp, cursor/tombstone RLS proof, retention/export/deletion policy, dependency-complete build URL, and mobile full-refresh sign-off.",
            status: "required",
          },
          {
            label: "Focused route visual consistency target",
            detail:
              "Open /care-twin-qa?qaSurface=route-visual-consistency and capture Home, Log, Plans, Health, Records, and More on iOS and Android.",
            proof:
              "Attach 6 iOS screenshots and 6 Android screenshots plus the QA note; web preview screenshots do not replace native proof.",
            status: "required",
          },
        ],
      },
      buildProviderProofSection(options.providerSetupPlan),
      {
        title: "Native and store proof",
        items: [
          {
            label: "iOS Quick Log/Log proof",
            detail: "Open /care-twin-qa on iOS and attach the required Quick Log or Log evidence.",
            proof: "Mission note plus iOS screenshot evidence.",
            status: "required",
          },
          {
            label: "Android Launch Readiness proof",
            detail: "Open /care-twin-qa on Android and attach Launch Readiness evidence.",
            proof: "Mission note plus Android screenshot evidence.",
            status: "required",
          },
          {
            label: "Store Screenshot QA",
            detail: "Continue screenshot-candidate routes only after the owner-preview proof is current.",
            proof: "Attach store screenshot QA evidence; this does not approve store submission.",
            status: "blocked",
          },
        ],
      },
    ],
    truthBoundaries: [
      "This smoke checklist does not approve App Store or Play Store submission.",
      "This smoke checklist does not prove provider-backed storage, sync, AI, payments, or push.",
      "Generated PDF and credential PNG/PDF export stay pending until native/provider export work is approved.",
      "Apollo launch sign-off remains separate from dependency, route, and QA proof.",
    ],
    doneCondition:
      "Dependency proof passes, route rehearsal is captured, Records exports stay truthful, provider gates are attached or blocked, and iOS/Android proof is saved.",
  };
}

function formatItems(items: readonly MobileReleaseSmokeChecklistItem[]): string[] {
  return items.map((item) => `- ${item.label}: ${item.detail} Proof: ${item.proof}`);
}

export function buildMobileReleaseSmokeChecklistShareText(
  checklist: MobileReleaseSmokeChecklist,
): string {
  return [
    checklist.title,
    `Generated: ${checklist.generatedAtIso}`,
    `Build: ${checklist.buildName}`,
    `Beta verdict: ${checklist.betaVerdict}`,
    `Public launch verdict: ${checklist.releaseVerdict}`,
    `Readiness score: ${checklist.readinessScore}%`,
    checklist.summary,
    "",
    ...checklist.sections.flatMap((section) => [
      `${section.title}:`,
      ...formatItems(section.items),
      "",
    ]),
    "Truth boundaries:",
    ...checklist.truthBoundaries.map((boundary) => `- ${boundary}`),
    "",
    `Done condition: ${checklist.doneCondition}`,
  ].join("\n");
}

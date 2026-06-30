import {
  deriveLaunchReadiness,
  type LaunchReadinessNativeQaSummary,
} from "./launchReadiness.ts";
import {
  buildStoreSubmissionScreenshotQaSurfaces,
  listMobileReleaseQaSurfaces,
  summarizeMobileReleaseQaReviews,
  type MobileReleaseQaReview,
  type MobileReleaseQaSurface,
} from "./mobileReleaseQa.ts";
import type { MobileQaSessionState } from "./mobileQaSession.ts";
import { buildReleasePacket } from "./releasePacket.ts";
import { buildStoreSubmissionPacket } from "./storeSubmissionPacket.ts";

export interface MobileLaunchQaCaptureTarget {
  surfaceId: string;
  title: string;
  route: string;
  priority: MobileReleaseQaSurface["priority"];
  status: MobileReleaseQaReview["status"];
  missingEvidence: string[];
  setupSteps: readonly string[];
  verificationSteps: readonly string[];
  acceptanceCriteria: readonly string[];
  failureEscalation: string;
  evidenceAttached: number;
  note?: string;
  routeChecklist?: MobileReleaseQaSurface["routeChecklist"];
}

export interface MobileLaunchQaOwnerPreviewProofStatus {
  surfaceId: string;
  title: string;
  route: string;
  status: MobileReleaseQaReview["status"] | "missing";
  statusLabel: string;
  complete: boolean;
  missingEvidence: string[];
  evidenceAttached: number;
  note?: string;
}

export interface MobileLaunchQaStoreScreenshotProofStatus {
  total: number;
  complete: number;
  open: number;
  statusLabel: string;
  nextTarget: MobileLaunchQaCaptureTarget | null;
  missingEvidence: string[];
}

export type MobileLaunchQaPrimaryMissionKind =
  | "needs-tune"
  | "proof-pending"
  | "owner-preview"
  | "store-screenshot"
  | "next-capture"
  | "complete";

export interface MobileLaunchQaPrimaryMission {
  kind: MobileLaunchQaPrimaryMissionKind;
  label: string;
  detail: string;
  ctaLabel: string;
  target: MobileLaunchQaCaptureTarget | null;
  missingEvidence: string[];
  doneCondition: string;
}

export interface MobileLaunchQaCapturePlan {
  totalSurfaces: number;
  openSurfaces: number;
  completeSurfaces: number;
  primaryMission: MobileLaunchQaPrimaryMission;
  nextTargets: MobileLaunchQaCaptureTarget[];
  firstNeedsTuneTarget: MobileLaunchQaCaptureTarget | null;
  ownerPreviewProofStatus: MobileLaunchQaOwnerPreviewProofStatus;
  storeScreenshotProofStatus: MobileLaunchQaStoreScreenshotProofStatus;
}

export interface MobileLaunchQaFocusedTarget {
  surface: MobileReleaseQaSurface;
  target: MobileLaunchQaCaptureTarget;
  statusLabel: string;
  complete: boolean;
}

const OWNER_PREVIEW_CORE_LOOP_ID = "owner-preview-core-loop";
const STORE_SCREENSHOT_SURFACE_PREFIX = "store-";

export function mobileLaunchQaCaptureTargetStatusLabel(
  target: MobileLaunchQaCaptureTarget | null | undefined,
): string {
  if (!target) return "No active target";
  if (target.status === "pass" && target.missingEvidence.length > 0) return "Pass pending proof";
  if (target.status === "pass") return "Pass";
  if (target.status === "needs-review") return "Needs tune";
  return "Not reviewed";
}

function buildScreenshotCandidateStoreSurfaces(): readonly MobileReleaseQaSurface[] {
  const launchReadinessPlan = deriveLaunchReadiness({
    nativeQa: null,
    local: {
      careWorkflowsReady: true,
      easProfilesReady: true,
      pixelAssetsReady: true,
      privacyExportReady: true,
    },
    provider: {
      authConfigured: false,
      databaseConfigured: false,
      storageProviderConfigured: false,
      aiProviderConfigured: false,
      paymentsEnabled: false,
      accountDeletionEnabled: false,
      pushNotificationsConfigured: false,
      appStoreAccountsReady: false,
      privacyLegalApproved: false,
      supportRunbookApproved: false,
    },
    syncStatus: "healthy",
  });
  const releasePacket = buildReleasePacket(launchReadinessPlan, {
    appName: "WoofWatcher",
    buildName: "mobile screenshot candidate",
  });
  return buildStoreSubmissionScreenshotQaSurfaces(buildStoreSubmissionPacket(releasePacket));
}

export function listMobileLaunchQaSurfaces(): readonly MobileReleaseQaSurface[] {
  return [...listMobileReleaseQaSurfaces(), ...buildScreenshotCandidateStoreSurfaces()];
}

export function hasMobileQaSessionReviewData(
  session: MobileQaSessionState | null | undefined,
): session is MobileQaSessionState {
  if (!session) return false;
  return (
    Object.values(session.surfaceStatusById).some((status) => status !== "unreviewed") ||
    Object.values(session.surfaceNotes).some((note) => Boolean(note.trim())) ||
    Object.values(session.surfaceEvidenceById).some((items) => items.length > 0)
  );
}

function screenshotRequirementPlatform(value: string): "ios" | "android" | "any" | null {
  const normalized = value.toLowerCase();
  if (!normalized.includes("screenshot")) return null;
  if (normalized.includes("ios screenshot")) return "ios";
  if (normalized.includes("android screenshot")) return "android";
  return "any";
}

function evidenceRequiresNote(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("note ") || normalized.startsWith("note:") || normalized.includes("note confirming");
}

function pluralLabel(value: number, label: string): string {
  return `${value} ${label}${value === 1 ? "" : "s"}`;
}

function missingEvidenceForSurface(
  surface: MobileReleaseQaSurface,
  review: MobileReleaseQaReview,
): string[] {
  const requiredPlatforms = surface.requiredEvidence
    .map(screenshotRequirementPlatform)
    .filter((platform): platform is "ios" | "android" | "any" => !!platform);
  const requiredIos = requiredPlatforms.filter((platform) => platform === "ios").length;
  const requiredAndroid = requiredPlatforms.filter((platform) => platform === "android").length;
  const requiredAny = requiredPlatforms.filter((platform) => platform === "any").length;
  const evidence = review.screenshotEvidence ?? [];
  const requiresNote = surface.requiredEvidence.some(evidenceRequiresNote);
  const hasNote = Boolean(review.note?.trim());
  const attachedIos = evidence.filter((item) => item.targetPlatform === "ios").length;
  const attachedAndroid = evidence.filter((item) => item.targetPlatform === "android").length;
  const platformSpecificUsed = Math.min(requiredIos, attachedIos) + Math.min(requiredAndroid, attachedAndroid);
  const flexibleAvailable = Math.max(0, evidence.length - platformSpecificUsed);
  const missingIos = Math.max(0, requiredIos - attachedIos);
  const missingAndroid = Math.max(0, requiredAndroid - attachedAndroid);
  const missingAny = Math.max(0, requiredAny - flexibleAvailable);
  const missing: string[] = [];

  if (missingIos > 0) missing.push(`Attach ${pluralLabel(missingIos, "iOS screenshot")} for ${surface.title}.`);
  if (missingAndroid > 0) missing.push(`Attach ${pluralLabel(missingAndroid, "Android screenshot")} for ${surface.title}.`);
  if (missingAny > 0) missing.push(`Attach ${pluralLabel(missingAny, "screenshot")} for ${surface.title}.`);
  if (requiresNote && !hasNote) missing.push(`Add QA note for ${surface.title}.`);

  if (!missing.length && review.status === "unreviewed") {
    missing.push(`Mark Pass or Needs tune for ${surface.title}.`);
  }
  if (!missing.length && review.status === "needs-review") {
    missing.push(`Resolve Needs tune notes for ${surface.title}.`);
  }

  return missing;
}

function reviewForSessionSurface(
  session: MobileQaSessionState | null | undefined,
  surface: MobileReleaseQaSurface,
): MobileReleaseQaReview {
  return {
    surfaceId: surface.id,
    status: session?.surfaceStatusById[surface.id] ?? "unreviewed",
    note: session?.surfaceNotes[surface.id]?.trim(),
    screenshotEvidence: session?.surfaceEvidenceById[surface.id],
  };
}

function captureTargetForSurface(
  surface: MobileReleaseQaSurface,
  review: MobileReleaseQaReview,
  missingEvidence: string[],
): MobileLaunchQaCaptureTarget {
  const routeChecklist = surface.routeChecklist?.length ? { routeChecklist: surface.routeChecklist } : {};
  return {
    surfaceId: surface.id,
    title: surface.title,
    route: surface.route,
    priority: surface.priority,
    status: review.status,
    missingEvidence,
    setupSteps: surface.setupSteps,
    verificationSteps: surface.verificationSteps,
    acceptanceCriteria: surface.acceptanceCriteria,
    failureEscalation: surface.failureEscalation,
    evidenceAttached: review.screenshotEvidence?.length ?? 0,
    note: review.note,
    ...routeChecklist,
  };
}

function ownerPreviewProofStatusFor(
  session: MobileQaSessionState | null | undefined,
  surfaces: readonly MobileReleaseQaSurface[],
): MobileLaunchQaOwnerPreviewProofStatus {
  const surface = surfaces.find((item) => item.id === OWNER_PREVIEW_CORE_LOOP_ID);

  if (!surface) {
    return {
      surfaceId: OWNER_PREVIEW_CORE_LOOP_ID,
      title: "Owner Preview Core Loop",
      route: "/care-twin-qa",
      status: "missing",
      statusLabel: "Missing from QA plan",
      complete: false,
      missingEvidence: ["Add Owner Preview Core Loop to the native QA plan."],
      evidenceAttached: 0,
    };
  }

  const review = reviewForSessionSurface(session, surface);
  const missingEvidence = missingEvidenceForSurface(surface, review);
  const complete = review.status === "pass" && missingEvidence.length === 0;
  const target = captureTargetForSurface(surface, review, missingEvidence);

  return {
    surfaceId: surface.id,
    title: surface.title,
    route: surface.route,
    status: review.status,
    statusLabel: complete ? "Pass" : mobileLaunchQaCaptureTargetStatusLabel(target),
    complete,
    missingEvidence,
    evidenceAttached: review.screenshotEvidence?.length ?? 0,
    note: review.note,
  };
}

function isStoreScreenshotSurface(surface: MobileReleaseQaSurface): boolean {
  return surface.id.startsWith(STORE_SCREENSHOT_SURFACE_PREFIX);
}

function storeScreenshotProofStatusFor(
  session: MobileQaSessionState | null | undefined,
  surfaces: readonly MobileReleaseQaSurface[],
): MobileLaunchQaStoreScreenshotProofStatus {
  const storeSurfaces = surfaces.filter(isStoreScreenshotSurface);
  const openTargets = storeSurfaces
    .map<MobileLaunchQaCaptureTarget | null>((surface) => {
      const review = reviewForSessionSurface(session, surface);
      const missingEvidence = missingEvidenceForSurface(surface, review);
      const complete = review.status === "pass" && missingEvidence.length === 0;
      if (complete) return null;
      return captureTargetForSurface(surface, review, missingEvidence);
    })
    .filter((target): target is MobileLaunchQaCaptureTarget => !!target);
  const nextTarget = openTargets[0] ?? null;
  const complete = Math.max(0, storeSurfaces.length - openTargets.length);

  let statusLabel = "No store screenshots";
  if (storeSurfaces.length > 0 && openTargets.length === 0) {
    statusLabel = "Store proof complete";
  } else if (nextTarget?.status === "pass" && nextTarget.missingEvidence.length > 0) {
    statusLabel = "Pass pending proof";
  } else if (nextTarget?.status === "needs-review") {
    statusLabel = "Needs tune";
  } else if (nextTarget) {
    statusLabel = "Store proof open";
  }

  return {
    total: storeSurfaces.length,
    complete,
    open: openTargets.length,
    statusLabel,
    nextTarget,
    missingEvidence: nextTarget?.missingEvidence ?? [],
  };
}

function firstMissionDetail(target: MobileLaunchQaCaptureTarget): string {
  return (
    target.note?.trim() ||
    target.missingEvidence[0] ||
    target.setupSteps[0] ||
    target.verificationSteps[0] ||
    target.failureEscalation
  );
}

function primaryMissionFor(
  targets: readonly MobileLaunchQaCaptureTarget[],
  ownerPreviewProofStatus: MobileLaunchQaOwnerPreviewProofStatus,
  storeScreenshotProofStatus: MobileLaunchQaStoreScreenshotProofStatus,
): MobileLaunchQaPrimaryMission {
  const firstNeedsTuneTarget = targets.find((target) => target.status === "needs-review");

  if (firstNeedsTuneTarget) {
    return {
      kind: "needs-tune",
      label: `Fix ${firstNeedsTuneTarget.title}`,
      detail: firstMissionDetail(firstNeedsTuneTarget),
      ctaLabel: "Fix Needs Tune",
      target: firstNeedsTuneTarget,
      missingEvidence: firstNeedsTuneTarget.missingEvidence,
      doneCondition:
        "Fix the noted issue, attach confirmation proof if required, update the Mission note, and mark the target Pass in /care-twin-qa.",
    };
  }

  const firstProofPendingTarget = targets.find(
    (target) => target.status === "pass" && target.missingEvidence.length > 0,
  );

  if (firstProofPendingTarget) {
    return {
      kind: "proof-pending",
      label: `Finish proof for ${firstProofPendingTarget.title}`,
      detail: firstProofPendingTarget.missingEvidence.join(" "),
      ctaLabel: "Finish Proof",
      target: firstProofPendingTarget,
      missingEvidence: firstProofPendingTarget.missingEvidence,
      doneCondition:
        "Attach the required proof, save any required Mission note, and keep the target marked Pass in /care-twin-qa.",
    };
  }

  const ownerPreviewTarget = targets.find((target) => target.surfaceId === OWNER_PREVIEW_CORE_LOOP_ID);

  if (ownerPreviewTarget) {
    return {
      kind: "owner-preview",
      label: ownerPreviewTarget.title,
      detail:
        ownerPreviewTarget.missingEvidence[0] ||
        "Run the real owner loop before isolated polish: Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, and Care Pass.",
      ctaLabel: "Run Owner Preview",
      target: ownerPreviewTarget,
      missingEvidence: ownerPreviewTarget.missingEvidence,
      doneCondition:
        "iOS/Android proof is attached, the owner route-loop QA note is saved, and the Owner Preview Core Loop is marked Pass.",
    };
  }

  if (ownerPreviewProofStatus.status === "missing") {
    return {
      kind: "owner-preview",
      label: "Restore Owner Preview Core Loop",
      detail: ownerPreviewProofStatus.missingEvidence.join(" "),
      ctaLabel: "Open QA Cockpit",
      target: null,
      missingEvidence: ownerPreviewProofStatus.missingEvidence,
      doneCondition: "Owner Preview Core Loop is restored to the native QA plan before launch proof is accepted.",
    };
  }

  if (storeScreenshotProofStatus.nextTarget) {
    return {
      kind: "store-screenshot",
      label: storeScreenshotProofStatus.nextTarget.title,
      detail: storeScreenshotProofStatus.missingEvidence.join(" ") || firstMissionDetail(storeScreenshotProofStatus.nextTarget),
      ctaLabel: "Capture Store Proof",
      target: storeScreenshotProofStatus.nextTarget,
      missingEvidence: storeScreenshotProofStatus.missingEvidence,
      doneCondition:
        "Truthful App Store and Play Store screenshots are attached for the target and it is marked Pass in /care-twin-qa.",
    };
  }

  const nextCaptureTarget = targets[0] ?? null;

  if (nextCaptureTarget) {
    return {
      kind: "next-capture",
      label: nextCaptureTarget.title,
      detail: firstMissionDetail(nextCaptureTarget),
      ctaLabel: "Open Next Surface",
      target: nextCaptureTarget,
      missingEvidence: nextCaptureTarget.missingEvidence,
      doneCondition:
        "Required iOS/Android proof is attached, any Mission note is saved, and the target is marked Pass or Needs tune.",
    };
  }

  return {
    kind: "complete",
    label: "QA evidence complete",
    detail: "All listed launch QA surfaces have local evidence. Share the QA summary and keep public store approval separate.",
    ctaLabel: "Share QA Summary",
    target: null,
    missingEvidence: [],
    doneCondition: "Share the QA report, beta handoff, and store packet only after Apollo reviews the saved proof.",
  };
}

export function buildMobileLaunchQaFocusedTarget(
  session: MobileQaSessionState | null | undefined,
  surfaceId: string,
  surfaces: readonly MobileReleaseQaSurface[] = listMobileLaunchQaSurfaces(),
): MobileLaunchQaFocusedTarget | null {
  const surface = surfaces.find((item) => item.id === surfaceId);
  if (!surface) return null;

  const review = reviewForSessionSurface(session, surface);
  const missingEvidence = missingEvidenceForSurface(surface, review);
  const complete = review.status === "pass" && missingEvidence.length === 0;
  const target = captureTargetForSurface(surface, review, missingEvidence);

  return {
    surface,
    target,
    statusLabel: complete ? "Pass" : mobileLaunchQaCaptureTargetStatusLabel(target),
    complete,
  };
}

export function buildMobileLaunchQaCapturePlan(
  session: MobileQaSessionState | null | undefined,
  surfaces: readonly MobileReleaseQaSurface[] = listMobileLaunchQaSurfaces(),
): MobileLaunchQaCapturePlan {
  const surfaceOrder = new Map(surfaces.map((surface, index) => [surface.id, index]));
  const ownerPreviewProofStatus = ownerPreviewProofStatusFor(session, surfaces);
  const storeScreenshotProofStatus = storeScreenshotProofStatusFor(session, surfaces);
  const targets = surfaces
    .map<MobileLaunchQaCaptureTarget | null>((surface) => {
      const review = reviewForSessionSurface(session, surface);
      const missingEvidence = missingEvidenceForSurface(surface, review);
      const complete = review.status === "pass" && missingEvidence.length === 0;
      if (complete) return null;
      return captureTargetForSurface(surface, review, missingEvidence);
    })
    .filter((target): target is MobileLaunchQaCaptureTarget => !!target)
    .sort((first, second) => {
      const priorityDelta =
        (first.priority === "launch-critical" ? 0 : 1) - (second.priority === "launch-critical" ? 0 : 1);
      if (priorityDelta !== 0) return priorityDelta;
      return (surfaceOrder.get(first.surfaceId) ?? 0) - (surfaceOrder.get(second.surfaceId) ?? 0);
    });
  const firstNeedsTuneTarget = targets.find((target) => target.status === "needs-review") ?? null;
  const primaryMission = primaryMissionFor(targets, ownerPreviewProofStatus, storeScreenshotProofStatus);

  return {
    totalSurfaces: surfaces.length,
    openSurfaces: targets.length,
    completeSurfaces: Math.max(0, surfaces.length - targets.length),
    primaryMission,
    nextTargets: targets.slice(0, 4),
    firstNeedsTuneTarget,
    ownerPreviewProofStatus,
    storeScreenshotProofStatus,
  };
}

export function buildMobileLaunchQaFocusedTargetShareText(
  focused: MobileLaunchQaFocusedTarget | null | undefined,
  generatedAtIso = new Date().toISOString(),
): string {
  const lines = ["WoofWatcher Focused QA Target", `Generated: ${generatedAtIso}`];

  if (!focused) {
    lines.push(
      "",
      "No focused QA target is active.",
      "Open More > Launch Readiness or /care-twin-qa and choose the next proof target before sharing a focused checklist.",
    );
    return lines.join("\n");
  }

  const { surface, target, statusLabel } = focused;
  const focusedRoute = `/care-twin-qa?qaSurface=${encodeURIComponent(target.surfaceId)}`;

  lines.push(
    "",
    `Target: ${target.title}`,
    `Focused cockpit: ${focusedRoute}`,
    `Open route: ${target.route}`,
    `Priority: ${target.priority}`,
    `Status: ${statusLabel}`,
    `Goal: ${surface.goal}`,
    `Device prompt: ${surface.devicePrompt}`,
    `Proof needed: ${target.missingEvidence.join(" ") || "No missing proof remains for this focused target."}`,
    `Attached proof: ${pluralLabel(target.evidenceAttached, "screenshot")}.`,
    `Setup: ${target.setupSteps.join(" ") || "Open the route from the current local beta state."}`,
    `Verify: ${target.verificationSteps.join(" ") || "Review the route on a phone-sized iOS or Android surface."}`,
  );

  if (target.routeChecklist?.length) {
    lines.push("", "Owner route loop:");
    target.routeChecklist.forEach((routeCheck, index) => {
      lines.push(
        `${index + 1}. ${routeCheck.label} (${routeCheck.route}): ${routeCheck.expected}${
          routeCheck.proof ? ` Proof: ${routeCheck.proof}` : ""
        }`,
      );
    });
  }

  lines.push(
    "",
    `Pass when: ${target.acceptanceCriteria.join(" ") || "The focused route passes its acceptance criteria."}`,
    `Needs tune if: ${target.failureEscalation}`,
    `After capture: return to ${focusedRoute}, attach focused proof, save a note if needed, and mark Pass or Needs tune.`,
    "Keep App Store/Play Store approval separate from this local beta QA evidence.",
  );

  return lines.join("\n");
}

export function buildMobileLaunchQaFixBriefShareText(
  plan: MobileLaunchQaCapturePlan,
  generatedAtIso = new Date().toISOString(),
): string {
  const target = plan.firstNeedsTuneTarget;
  const lines = ["WoofWatcher Needs Tune Fix Brief", `Generated: ${generatedAtIso}`];

  if (!target) {
    lines.push(
      "",
      "No Needs tune route is currently marked.",
      "Continue with the next QA capture in /care-twin-qa, attach required proof, and mark any below-beta route as Needs tune.",
    );
    return lines.join("\n");
  }

  const tuneBlockers = target.missingEvidence.filter((item) => item.startsWith("Resolve Needs tune notes"));
  const proofGaps = target.missingEvidence.filter((item) => !item.startsWith("Resolve Needs tune notes"));

  lines.push(
    "",
    `Fix first: ${target.title}`,
    `Route: ${target.route}`,
    `Priority: ${target.priority}`,
    `Status: ${mobileLaunchQaCaptureTargetStatusLabel(target)}`,
    `QA note: ${target.note?.trim() || "No route note saved yet. Add the first visible issue in /care-twin-qa before handing this off."}`,
    `Missing proof: ${
      proofGaps.length
        ? proofGaps.join(" ")
        : "No required proof is missing; fix the noted UX issue and attach confirmation proof."
    }`,
    `Setup: ${target.setupSteps.join(" ") || "Open the route from the current local beta state."}`,
    `Reproduce: ${target.verificationSteps.join(" ") || "Re-open the route on a phone-sized iOS or Android surface."}`,
  );

  if (tuneBlockers.length) {
    lines.push(`Fix blocker: ${tuneBlockers.join(" ")}`);
  }

  if (target.routeChecklist?.length) {
    lines.push("", "Owner route loop:");
    target.routeChecklist.forEach((routeCheck, index) => {
      lines.push(
        `${index + 1}. ${routeCheck.label} (${routeCheck.route}): ${routeCheck.expected}${
          routeCheck.proof ? ` Proof: ${routeCheck.proof}` : ""
        }`,
      );
    });
  }

  lines.push(
    "",
    `Done when: ${target.acceptanceCriteria.join(" ") || "The route passes its original acceptance criteria."}`,
    `Needs tune rule: ${target.failureEscalation}`,
    "After fix: return to /care-twin-qa, attach iOS/Android proof if required, update the Mission note, mark Pass, and confirm More no longer shows Needs tune for this route.",
  );

  return lines.join("\n");
}

export function buildMobileLaunchQaCaptureShareText(
  plan: MobileLaunchQaCapturePlan,
  generatedAtIso = new Date().toISOString(),
): string {
  const lines = [
    "WoofWatcher Native QA Capture Plan",
    `Generated: ${generatedAtIso}`,
    `Progress: ${plan.completeSurfaces}/${plan.totalSurfaces} complete, ${plan.openSurfaces} open.`,
    `Primary mission: ${plan.primaryMission.label}.`,
    `Primary action: ${plan.primaryMission.ctaLabel}.`,
    `Primary missing: ${
      plan.primaryMission.missingEvidence.length
        ? plan.primaryMission.missingEvidence.join(" ")
        : "No missing proof is attached to the primary mission."
    }`,
    `Primary done when: ${plan.primaryMission.doneCondition}`,
    `Owner preview proof: ${plan.ownerPreviewProofStatus.statusLabel}.`,
    `Owner preview missing: ${
      plan.ownerPreviewProofStatus.missingEvidence.length
        ? plan.ownerPreviewProofStatus.missingEvidence.join(" ")
        : "No owner-preview proof is missing."
    }`,
    `Owner preview evidence: ${plan.ownerPreviewProofStatus.evidenceAttached} attached.`,
    `Store screenshot proof: ${plan.storeScreenshotProofStatus.statusLabel}. ${plan.storeScreenshotProofStatus.complete}/${plan.storeScreenshotProofStatus.total} complete.`,
    `Next store screenshot: ${
      plan.storeScreenshotProofStatus.nextTarget
        ? `${plan.storeScreenshotProofStatus.nextTarget.title} (${plan.storeScreenshotProofStatus.nextTarget.route})`
        : "No store screenshot target is open."
    }`,
    `Store screenshot missing: ${
      plan.storeScreenshotProofStatus.missingEvidence.length
        ? plan.storeScreenshotProofStatus.missingEvidence.join(" ")
        : "No store screenshot proof is missing."
    }`,
    "",
    "Next captures:",
  ];

  if (!plan.nextTargets.length) {
    lines.push("- All listed capture surfaces are locally complete.");
  }

  plan.nextTargets.forEach((target, index) => {
    lines.push(`${index + 1}. ${target.title} (${target.route})`);
    lines.push(`   Priority: ${target.priority}`);
    lines.push(`   Status: ${mobileLaunchQaCaptureTargetStatusLabel(target)}`);
    lines.push(`   Missing: ${target.missingEvidence.join(" ") || "No missing evidence."}`);
    lines.push(`   Setup: ${target.setupSteps.join(" ")}`);
    lines.push(`   Steps: ${target.verificationSteps.join(" ")}`);
    if (target.routeChecklist?.length) {
      lines.push("   Route loop:");
      target.routeChecklist.forEach((routeCheck, routeIndex) => {
        lines.push(
          `   ${routeIndex + 1}. ${routeCheck.label} (${routeCheck.route}): ${routeCheck.expected}${
            routeCheck.proof ? ` Proof: ${routeCheck.proof}` : ""
          }`,
        );
      });
    }
    lines.push(`   Pass criteria: ${target.acceptanceCriteria.join(" ")}`);
    lines.push(`   Needs tune if: ${target.failureEscalation}`);
    lines.push(`   Evidence attached: ${target.evidenceAttached}`);
    if (target.note) lines.push(`   Note: ${target.note}`);
  });

  lines.push(
    "",
    "Done condition: capture iOS and Android proof in /care-twin-qa, mark Pass or Needs tune for each surface, share the QA report, and keep store approval separate from local evidence.",
  );

  return lines.join("\n");
}

export function deriveNativeQaSummaryFromMobileQaSession(
  session: MobileQaSessionState | null | undefined,
  surfaces: readonly MobileReleaseQaSurface[] = listMobileLaunchQaSurfaces(),
): LaunchReadinessNativeQaSummary | null {
  if (!hasMobileQaSessionReviewData(session)) return null;

  const reviews: MobileReleaseQaReview[] = surfaces.map((surface) => reviewForSessionSurface(session, surface));
  const summary = summarizeMobileReleaseQaReviews(surfaces, reviews);

  return {
    total: summary.total,
    passed: summary.passed,
    needsReview: summary.needsReview,
    unreviewed: summary.unreviewed,
    requiredScreenshots: summary.requiredScreenshots,
    missingScreenshots: summary.missingScreenshots,
    missingIosScreenshots: summary.missingIosScreenshots,
    missingAndroidScreenshots: summary.missingAndroidScreenshots,
    missingAnyScreenshots: summary.missingAnyScreenshots,
  };
}

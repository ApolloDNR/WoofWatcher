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
  evidenceAttached: number;
  note?: string;
}

export interface MobileLaunchQaCapturePlan {
  totalSurfaces: number;
  openSurfaces: number;
  completeSurfaces: number;
  nextTargets: MobileLaunchQaCaptureTarget[];
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

export function buildMobileLaunchQaCapturePlan(
  session: MobileQaSessionState | null | undefined,
  surfaces: readonly MobileReleaseQaSurface[] = listMobileLaunchQaSurfaces(),
): MobileLaunchQaCapturePlan {
  const targets = surfaces
    .map<MobileLaunchQaCaptureTarget | null>((surface) => {
      const review = reviewForSessionSurface(session, surface);
      const missingEvidence = missingEvidenceForSurface(surface, review);
      const complete = review.status === "pass" && missingEvidence.length === 0;
      if (complete) return null;
      return {
        surfaceId: surface.id,
        title: surface.title,
        route: surface.route,
        priority: surface.priority,
        status: review.status,
        missingEvidence,
        evidenceAttached: review.screenshotEvidence?.length ?? 0,
        note: review.note,
      };
    })
    .filter((target): target is MobileLaunchQaCaptureTarget => !!target)
    .sort((first, second) => {
      const priorityDelta =
        (first.priority === "launch-critical" ? 0 : 1) - (second.priority === "launch-critical" ? 0 : 1);
      if (priorityDelta !== 0) return priorityDelta;
      return first.title.localeCompare(second.title);
    });

  return {
    totalSurfaces: surfaces.length,
    openSurfaces: targets.length,
    completeSurfaces: Math.max(0, surfaces.length - targets.length),
    nextTargets: targets.slice(0, 4),
  };
}

export function buildMobileLaunchQaCaptureShareText(
  plan: MobileLaunchQaCapturePlan,
  generatedAtIso = new Date().toISOString(),
): string {
  const lines = [
    "WoofWatcher Native QA Capture Plan",
    `Generated: ${generatedAtIso}`,
    `Progress: ${plan.completeSurfaces}/${plan.totalSurfaces} complete, ${plan.openSurfaces} open.`,
    "",
    "Next captures:",
  ];

  if (!plan.nextTargets.length) {
    lines.push("- All listed capture surfaces are locally complete.");
  }

  plan.nextTargets.forEach((target, index) => {
    lines.push(`${index + 1}. ${target.title} (${target.route})`);
    lines.push(`   Priority: ${target.priority}`);
    lines.push(`   Status: ${target.status}`);
    lines.push(`   Missing: ${target.missingEvidence.join(" ") || "No missing evidence."}`);
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

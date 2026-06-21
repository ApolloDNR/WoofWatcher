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

export function deriveNativeQaSummaryFromMobileQaSession(
  session: MobileQaSessionState | null | undefined,
  surfaces: readonly MobileReleaseQaSurface[] = listMobileLaunchQaSurfaces(),
): LaunchReadinessNativeQaSummary | null {
  if (!hasMobileQaSessionReviewData(session)) return null;

  const reviews: MobileReleaseQaReview[] = surfaces.map((surface) => ({
    surfaceId: surface.id,
    status: session.surfaceStatusById[surface.id] ?? "unreviewed",
    note: session.surfaceNotes[surface.id]?.trim(),
    screenshotEvidence: session.surfaceEvidenceById[surface.id],
  }));
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

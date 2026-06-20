import type { QaScreenshotEvidence } from "./qaScreenshotEvidence.ts";
import { qaScreenshotEvidenceNames } from "./qaScreenshotEvidence.ts";

export type MobileReleaseQaReviewStatus = "unreviewed" | "pass" | "needs-review";

export interface MobileReleaseQaSurface {
  id: string;
  title: string;
  route: string;
  priority: "launch-critical" | "release-polish";
  goal: string;
  devicePrompt: string;
  requiredEvidence: readonly string[];
  launchRisk: string;
}

export interface MobileReleaseQaReview {
  surfaceId: string;
  status: MobileReleaseQaReviewStatus;
  note?: string;
  screenshotEvidence?: readonly QaScreenshotEvidence[];
}

export interface MobileReleaseQaSummary {
  total: number;
  passed: number;
  needsReview: number;
  unreviewed: number;
  requiredScreenshots: number;
  requiredIosScreenshots: number;
  requiredAndroidScreenshots: number;
  requiredAnyScreenshots: number;
  attachedScreenshots: number;
  attachedIosScreenshots: number;
  attachedAndroidScreenshots: number;
  attachedOtherScreenshots: number;
  missingScreenshots: number;
  missingIosScreenshots: number;
  missingAndroidScreenshots: number;
  missingAnyScreenshots: number;
}

export const MOBILE_RELEASE_QA_SURFACES: readonly MobileReleaseQaSurface[] = [
  {
    id: "phoenix-home",
    title: "Phoenix Home",
    route: "/",
    priority: "launch-critical",
    goal: "Prove the first screen answers where Phoenix is, how she feels, what is next, and what can be logged quickly.",
    devicePrompt:
      "Check header safe area, bottom-nav clearance, one main Phoenix sprite, room crop, quick-log response, and Next Up reachability on iOS and Android.",
    requiredEvidence: [
      "iOS screenshot of Phoenix Home above the fold.",
      "Android screenshot of Phoenix Home above the fold.",
      "Note from one quick-log tap confirming the main sprite reacts without spawning a second avatar.",
    ],
    launchRisk:
      "If Home fails, the app reads as a prototype instead of a trustworthy daily dog-care command center.",
  },
  {
    id: "care-twin-state-lab",
    title: "Care Twin State Lab",
    route: "/care-twin-qa",
    priority: "launch-critical",
    goal: "Review every registered Phoenix room/sprite state through production LivingPhoenixRoom assets.",
    devicePrompt:
      "Run the 12-state matrix, mark Pass or Needs tune, add notes for crop, scale, loop timing, gait, and touch response, then share the QA summary.",
    requiredEvidence: [
      "iOS screenshot of happy idle.",
      "iOS screenshot of Health Watch state.",
      "Android screenshot of bedtime/sleep state.",
      "Shared text QA report from the native share sheet.",
    ],
    launchRisk:
      "If this pass is skipped, weak animation, stage crop, or room/sprite scale issues can ship unnoticed.",
  },
  {
    id: "avatar-studio",
    title: "Avatar Studio",
    route: "/portrait",
    priority: "launch-critical",
    goal: "Prove PixelLab-backed templates feel like intentional live care twins and unfinished states remain truthful.",
    devicePrompt:
      "Switch at least Shepherd, Retriever, Husky, Bully, Doodle, and Mixed Breed; verify live/still badges, thumbnail crispness, and no oversized overlays.",
    requiredEvidence: [
      "iOS screenshot with a live template selected.",
      "Android screenshot with a non-Phoenix template selected.",
      "Note any template whose gait, crop, or accessory alignment needs production polish.",
    ],
    launchRisk:
      "Avatar Studio is the product hook; fake readiness or blurry assets will break the care-twin promise.",
  },
  {
    id: "incident-composer",
    title: "Incident Composer",
    route: "/log?type=incident",
    priority: "launch-critical",
    goal: "Confirm behavior-safety events can be logged with trigger, exposure, injury/action, follow-up, notes, and household visibility.",
    devicePrompt:
      "Open the Incident detail flow from Log, verify all fields fit in a phone bottom sheet, and confirm safety copy stays factual and non-diagnostic.",
    requiredEvidence: [
      "iOS screenshot of the Incident detail composer.",
      "Android screenshot of the Incident detail composer.",
      "Note whether all fields can be completed without keyboard or bottom-nav overlap.",
    ],
    launchRisk:
      "If incident logging is clumsy, owners will skip the details that make trainer/vet handoffs useful.",
  },
  {
    id: "records-incident-watch",
    title: "Records Incident Watch",
    route: "/records",
    priority: "launch-critical",
    goal: "Confirm Incident Watch turns logged events into trend signal, follow-up tasks, trainer goals, and safe handoff language.",
    devicePrompt:
      "Review Records on a small phone screen, tap Incident Watch follow-up rows, and verify routes go to the Incident composer or trainer Care Pass preview.",
    requiredEvidence: [
      "iOS screenshot of Records Incident Watch.",
      "Android screenshot after tapping a follow-up row or trainer goal.",
      "Note any dead recommendation or unclear non-diagnostic boundary.",
    ],
    launchRisk:
      "If follow-up rows do not route to real workflows, Incident Watch becomes decorative instead of operational.",
  },
  {
    id: "trainer-care-pass",
    title: "Trainer Care Pass",
    route: "/records",
    priority: "release-polish",
    goal: "Verify trainer handoff output includes Incident Watch trend, owner follow-ups, and goal ideas without diagnosing behavior.",
    devicePrompt:
      "Preview or share the trainer Care Pass from Records, then verify incident trend/follow-up/goal lines are readable and factual.",
    requiredEvidence: [
      "Screenshot of trainer Care Pass preview with Incident Watch.",
      "Shared text report snippet showing incident trend and follow-up lines.",
    ],
    launchRisk:
      "If trainer handoff language is vague, the feature loses the premium report value that supports Family/Pro packaging.",
  },
];

function reviewFor(
  reviews: readonly MobileReleaseQaReview[],
  surfaceId: string,
): MobileReleaseQaReview {
  return reviews.find((review) => review.surfaceId === surfaceId) ?? {
    surfaceId,
    status: "unreviewed",
  };
}

function screenshotRequirementPlatform(value: string): "ios" | "android" | "any" | null {
  const normalized = value.toLowerCase();
  if (!normalized.includes("screenshot")) return null;
  if (normalized.includes("ios screenshot")) return "ios";
  if (normalized.includes("android screenshot")) return "android";
  return "any";
}

export function listMobileReleaseQaSurfaces(): readonly MobileReleaseQaSurface[] {
  return MOBILE_RELEASE_QA_SURFACES;
}

export function mobileReleaseQaStatusLabel(status: MobileReleaseQaReviewStatus): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "needs-review":
      return "Needs tune";
    default:
      return "Unreviewed";
  }
}

export function summarizeMobileReleaseQaReviews(
  surfaces: readonly MobileReleaseQaSurface[],
  reviews: readonly MobileReleaseQaReview[],
): MobileReleaseQaSummary {
  const statuses = surfaces.map((surface) => reviewFor(reviews, surface.id).status);
  const passed = statuses.filter((status) => status === "pass").length;
  const needsReview = statuses.filter((status) => status === "needs-review").length;
  const requiredScreenshotPlatforms = surfaces.flatMap((surface) =>
    surface.requiredEvidence
      .map(screenshotRequirementPlatform)
      .filter((platform): platform is "ios" | "android" | "any" => !!platform),
  );
  const requiredScreenshots = requiredScreenshotPlatforms.length;
  const requiredIosScreenshots = requiredScreenshotPlatforms.filter((platform) => platform === "ios").length;
  const requiredAndroidScreenshots = requiredScreenshotPlatforms.filter((platform) => platform === "android").length;
  const requiredAnyScreenshots = requiredScreenshotPlatforms.filter((platform) => platform === "any").length;
  const screenshotEvidence = surfaces.flatMap((surface) => reviewFor(reviews, surface.id).screenshotEvidence ?? []);
  const attachedScreenshots = screenshotEvidence.length;
  const attachedIosScreenshots = screenshotEvidence.filter((item) => item.targetPlatform === "ios").length;
  const attachedAndroidScreenshots = screenshotEvidence.filter((item) => item.targetPlatform === "android").length;
  const attachedOtherScreenshots = screenshotEvidence.filter(
    (item) => item.targetPlatform !== "ios" && item.targetPlatform !== "android",
  ).length;
  const missingIosScreenshots = Math.max(0, requiredIosScreenshots - attachedIosScreenshots);
  const missingAndroidScreenshots = Math.max(0, requiredAndroidScreenshots - attachedAndroidScreenshots);
  const platformSurplusScreenshots =
    Math.max(0, attachedIosScreenshots - requiredIosScreenshots) +
    Math.max(0, attachedAndroidScreenshots - requiredAndroidScreenshots) +
    attachedOtherScreenshots;
  const missingAnyScreenshots = Math.max(0, requiredAnyScreenshots - platformSurplusScreenshots);

  return {
    total: surfaces.length,
    passed,
    needsReview,
    unreviewed: Math.max(0, surfaces.length - passed - needsReview),
    requiredScreenshots,
    requiredIosScreenshots,
    requiredAndroidScreenshots,
    requiredAnyScreenshots,
    attachedScreenshots,
    attachedIosScreenshots,
    attachedAndroidScreenshots,
    attachedOtherScreenshots,
    missingScreenshots: missingIosScreenshots + missingAndroidScreenshots + missingAnyScreenshots,
    missingIosScreenshots,
    missingAndroidScreenshots,
    missingAnyScreenshots,
  };
}

export function buildMobileReleaseQaShareText(
  surfaces: readonly MobileReleaseQaSurface[],
  reviews: readonly MobileReleaseQaReview[],
  reviewedAtIso = new Date().toISOString(),
): string {
  const summary = summarizeMobileReleaseQaReviews(surfaces, reviews);
  const lines = [
    "WoofWatcher Mobile Release QA",
    `Reviewed: ${reviewedAtIso}`,
    `Summary: ${summary.passed}/${summary.total} passed, ${summary.needsReview} needs tune, ${summary.unreviewed} unreviewed.`,
    `Required screenshot slots: ${summary.requiredScreenshots}.`,
    `Screenshot evidence: ${summary.attachedScreenshots} attached, ${summary.missingScreenshots} still missing.`,
    `Platform evidence: iOS ${summary.attachedIosScreenshots}/${summary.requiredIosScreenshots}, Android ${summary.attachedAndroidScreenshots}/${summary.requiredAndroidScreenshots}, general ${Math.max(0, summary.attachedOtherScreenshots)}/${summary.requiredAnyScreenshots}.`,
    "",
    "Workflow notes:",
  ];

  for (const surface of surfaces) {
    const review = reviewFor(reviews, surface.id);
    const note = review.note?.trim();

    lines.push(
      `- ${surface.title}: ${mobileReleaseQaStatusLabel(review.status)} | route=${surface.route} | priority=${surface.priority}`,
    );
    lines.push(`  Goal: ${surface.goal}`);

    if (note) {
      lines.push(`  Note: ${note}`);
    }

    if (review.screenshotEvidence?.length) {
      lines.push(`  Screenshots: ${qaScreenshotEvidenceNames(review.screenshotEvidence)}`);
    }
  }

  lines.push(
    "",
    "Launch boundary: this report is a device-session checklist. It does not replace attached iOS/Android screenshots or human review before release approval.",
  );

  return lines.join("\n");
}

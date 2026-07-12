import type { CareTwinRuntimeQaResult } from "./careTwinAssets.ts";
import { describeMotionRecipeForSpriteAction } from "./careTwinChoreography.ts";
import { describeCareTwinStageFraming } from "./careTwinStage.ts";
import type { QaScreenshotEvidence } from "./qaScreenshotEvidence.ts";
import { qaScreenshotEvidenceNames } from "./qaScreenshotEvidence.ts";

export type CareTwinQaReviewStatus = "unreviewed" | "pass" | "needs-review";

export interface CareTwinQaReview {
  scenarioId: string;
  status: CareTwinQaReviewStatus;
  note?: string;
  screenshotEvidence?: readonly QaScreenshotEvidence[];
}

export interface CareTwinQaSummary {
  total: number;
  passed: number;
  passedWithNativeProof: number;
  passPendingProof: number;
  needsReview: number;
  unreviewed: number;
  readyLayered: number;
  attachedScreenshots: number;
  attachedIosScreenshots: number;
  attachedAndroidScreenshots: number;
  attachedUnknownScreenshots: number;
}

function reviewFor(
  reviews: readonly CareTwinQaReview[],
  scenarioId: string,
): CareTwinQaReview {
  return reviews.find((review) => review.scenarioId === scenarioId) ?? {
    scenarioId,
    status: "unreviewed",
  };
}

function hasNativeScreenshotEvidence(review: CareTwinQaReview): boolean {
  return (review.screenshotEvidence ?? []).some(
    (item) => item.targetPlatform === "ios" || item.targetPlatform === "android",
  );
}

export function careTwinQaMissingNativeProof(review: CareTwinQaReview): string[] {
  if (review.status !== "pass" || hasNativeScreenshotEvidence(review)) {
    return [];
  }

  return [
    "Attach at least one iOS or Android screenshot for this care-twin state before treating Pass as native launch proof.",
  ];
}

export function summarizeCareTwinQaReviews(
  results: readonly CareTwinRuntimeQaResult[],
  reviews: readonly CareTwinQaReview[],
): CareTwinQaSummary {
  const scenarioReviews = results.map((result) => reviewFor(reviews, result.scenario.id));
  const passed = scenarioReviews.filter((review) => review.status === "pass").length;
  const needsReview = scenarioReviews.filter((review) => review.status === "needs-review").length;
  const passPendingProof = scenarioReviews.filter(
    (review) => review.status === "pass" && careTwinQaMissingNativeProof(review).length > 0,
  ).length;
  const screenshotEvidence = results.flatMap(
    (result) => reviewFor(reviews, result.scenario.id).screenshotEvidence ?? [],
  );

  return {
    total: results.length,
    passed,
    passedWithNativeProof: passed - passPendingProof,
    passPendingProof,
    needsReview,
    unreviewed: Math.max(0, results.length - passed - needsReview),
    readyLayered: results.filter((result) => result.readiness.layeredReady).length,
    attachedScreenshots: screenshotEvidence.length,
    attachedIosScreenshots: screenshotEvidence.filter((item) => item.targetPlatform === "ios").length,
    attachedAndroidScreenshots: screenshotEvidence.filter((item) => item.targetPlatform === "android").length,
    attachedUnknownScreenshots: screenshotEvidence.filter(
      (item) => item.targetPlatform !== "ios" && item.targetPlatform !== "android",
    ).length,
  };
}

export function careTwinQaStatusLabel(status: CareTwinQaReviewStatus): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "needs-review":
      return "Needs tune";
    default:
      return "Unreviewed";
  }
}

export function careTwinQaReviewStatusLabel(review: CareTwinQaReview): string {
  if (review.status === "pass" && careTwinQaMissingNativeProof(review).length > 0) {
    return "Pass pending proof";
  }

  return careTwinQaStatusLabel(review.status);
}

export function buildCareTwinQaShareText(
  results: readonly CareTwinRuntimeQaResult[],
  reviews: readonly CareTwinQaReview[],
  reviewedAtIso = new Date().toISOString(),
): string {
  const summary = summarizeCareTwinQaReviews(results, reviews);
  const lines = [
    "WoofWatcher Care Twin QA",
    `Reviewed: ${reviewedAtIso}`,
    `Summary: ${summary.passed}/${summary.total} passed, ${summary.passedWithNativeProof} native-proof pass, ${summary.passPendingProof} pass pending proof, ${summary.needsReview} needs tune, ${summary.unreviewed} unreviewed.`,
    `Layered assets ready: ${summary.readyLayered}/${summary.total}.`,
    `Attached screenshots: ${summary.attachedScreenshots} (iOS ${summary.attachedIosScreenshots}, Android ${summary.attachedAndroidScreenshots}, other ${summary.attachedUnknownScreenshots}).`,
    "",
    "Device notes:",
  ];

  for (const result of results) {
    const review = reviewFor(reviews, result.scenario.id);
    const note = review.note?.trim();
    const missingProof = careTwinQaMissingNativeProof(review);

    lines.push(
      `- ${result.scenario.label}: ${careTwinQaReviewStatusLabel(review)} | sprite=${result.actualAction} | room=${result.actualRoomVariant} | zone=${result.actualZone} | need=${result.actualNeed}`,
    );
    lines.push(`  ${describeMotionRecipeForSpriteAction(result.actualAction)}`);
    lines.push(`  ${describeCareTwinStageFraming(result.stageFraming)}`);

    for (const missingProofItem of missingProof) {
      lines.push(`  Missing proof: ${missingProofItem}`);
    }

    if (note) {
      lines.push(`  Note: ${note}`);
    }

    if (review.screenshotEvidence?.length) {
      lines.push(`  Screenshots: ${qaScreenshotEvidenceNames(review.screenshotEvidence)}`);
    }
  }

  lines.push(
    "",
    "Native screenshot evidence still required before launch: iOS Home, iOS happy idle, iOS Health Watch, Android sleep/bedtime, and Avatar Studio live template.",
  );

  return lines.join("\n");
}

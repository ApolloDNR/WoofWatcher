import type { CareTwinRuntimeQaResult } from "./careTwinAssets.ts";
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
  needsReview: number;
  unreviewed: number;
  readyLayered: number;
  attachedScreenshots: number;
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

export function summarizeCareTwinQaReviews(
  results: readonly CareTwinRuntimeQaResult[],
  reviews: readonly CareTwinQaReview[],
): CareTwinQaSummary {
  const passed = reviews.filter((review) => review.status === "pass").length;
  const needsReview = reviews.filter((review) => review.status === "needs-review").length;

  return {
    total: results.length,
    passed,
    needsReview,
    unreviewed: Math.max(0, results.length - passed - needsReview),
    readyLayered: results.filter((result) => result.readiness.layeredReady).length,
    attachedScreenshots: results.reduce(
      (total, result) => total + (reviewFor(reviews, result.scenario.id).screenshotEvidence?.length ?? 0),
      0,
    ),
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

export function buildCareTwinQaShareText(
  results: readonly CareTwinRuntimeQaResult[],
  reviews: readonly CareTwinQaReview[],
  reviewedAtIso = new Date().toISOString(),
): string {
  const summary = summarizeCareTwinQaReviews(results, reviews);
  const lines = [
    "WoofWatcher Care Twin QA",
    `Reviewed: ${reviewedAtIso}`,
    `Summary: ${summary.passed}/${summary.total} passed, ${summary.needsReview} needs tune, ${summary.unreviewed} unreviewed.`,
    `Layered assets ready: ${summary.readyLayered}/${summary.total}.`,
    `Attached screenshots: ${summary.attachedScreenshots}.`,
    "",
    "Device notes:",
  ];

  for (const result of results) {
    const review = reviewFor(reviews, result.scenario.id);
    const note = review.note?.trim();

    lines.push(
      `- ${result.scenario.label}: ${careTwinQaStatusLabel(review.status)} | sprite=${result.actualAction} | room=${result.actualRoomVariant} | zone=${result.actualZone} | need=${result.actualNeed}`,
    );

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

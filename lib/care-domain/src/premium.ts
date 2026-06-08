export type PremiumPlanId = "free" | "plus" | "family";

export interface PremiumPlan {
  id: PremiumPlanId;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  badge: string;
  summary: string;
  features: readonly string[];
  checkoutEnabled: boolean;
}

export interface PremiumPreviewInput {
  caregiverCount?: number | null;
  routineCount?: number | null;
  reportHistoryCount?: number | null;
  recordCount?: number | null;
  healthSignalCount?: number | null;
}

export interface PremiumValueSignal {
  key: "household" | "health" | "reports" | "records" | "routines";
  label: string;
  detail: string;
  score: number;
}

export interface PremiumPreview {
  plans: readonly PremiumPlan[];
  recommendedPlanId: PremiumPlanId;
  valueSignals: PremiumValueSignal[];
  checkoutEnabled: boolean;
  launchNotice: string;
}

export const PREMIUM_PLANS: readonly PremiumPlan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    badge: "Start",
    summary: "One dog, basic logs, profile, and starter care history.",
    features: ["Dog profile", "Basic logs", "Starter routines", "Local care history"],
    checkoutEnabled: false,
  },
  {
    id: "plus",
    name: "Plus",
    monthlyPrice: "$7-$10/mo",
    annualPrice: "$79-$99/yr",
    badge: "Best solo owner",
    summary: "Advanced meals, Health Watch, records, WoofGuide drafting, and care reports.",
    features: ["Advanced meal and diet tracking", "Health Watch pattern summaries", "Records vault", "Stored report history", "WoofGuide action drafting"],
    checkoutEnabled: false,
  },
  {
    id: "family",
    name: "Family",
    monthlyPrice: "$12-$15/mo",
    annualPrice: "$129-$149/yr",
    badge: "Best household",
    summary: "Everything in Plus with household coordination, caregiver roles, and shared routines.",
    features: ["Multiple caregivers", "Shared household routine board", "Caregiver handoffs", "Family calendar", "Sitter and vet report packs"],
    checkoutEnabled: false,
  },
];

function count(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function derivePremiumPreview(input: PremiumPreviewInput = {}): PremiumPreview {
  const caregiverCount = count(input.caregiverCount);
  const routineCount = count(input.routineCount);
  const reportHistoryCount = count(input.reportHistoryCount);
  const recordCount = count(input.recordCount);
  const healthSignalCount = count(input.healthSignalCount);

  const signals: PremiumValueSignal[] = [
    {
      key: "household",
      label: "Household sync",
      detail: caregiverCount > 1 ? `${caregiverCount} caregivers need one shared source of truth.` : "Invite caregivers and keep routine ownership clear.",
      score: caregiverCount > 1 ? 100 + caregiverCount : 15,
    },
    {
      key: "health",
      label: "Health Watch",
      detail: healthSignalCount > 0 ? `${healthSignalCount} recent watch signal${healthSignalCount === 1 ? "" : "s"} should stay easy to review.` : "Turn symptoms, appetite, stool, and vomit notes into bounded pattern summaries.",
      score: healthSignalCount > 0 ? 80 + healthSignalCount : 30,
    },
    {
      key: "reports",
      label: "Care reports",
      detail: reportHistoryCount > 0 ? `${reportHistoryCount} report snapshot${reportHistoryCount === 1 ? "" : "s"} already saved for resend.` : "Package sitter, trainer, household, and vet context into shareable reports.",
      score: reportHistoryCount > 0 ? 70 + reportHistoryCount : 25,
    },
    {
      key: "records",
      label: "Records vault",
      detail: recordCount > 0 ? `${recordCount} record${recordCount === 1 ? "" : "s"} can support credential and report value.` : "Keep vaccines, insurance, vet visits, microchip, and receipts ready.",
      score: recordCount > 0 ? 60 + recordCount : 20,
    },
    {
      key: "routines",
      label: "Rich routines",
      detail: routineCount > 0 ? `${routineCount} routine${routineCount === 1 ? "" : "s"} can drive reminders, logs, and handoffs.` : "Create recurring care plans before adding reminders.",
      score: routineCount > 0 ? 50 + routineCount : 10,
    },
  ].sort((a, b) => b.score - a.score);

  const recommendedPlanId: PremiumPlanId = caregiverCount > 1 ? "family" : "plus";
  const checkoutEnabled = PREMIUM_PLANS.some((plan) => plan.checkoutEnabled);

  return {
    plans: PREMIUM_PLANS,
    recommendedPlanId,
    valueSignals: signals,
    checkoutEnabled,
    launchNotice:
      "Preview only: payments stay disabled until privacy, support, refund, and subscription-launch obligations are ready.",
  };
}

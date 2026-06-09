export type PremiumPlanId = "free" | "plus" | "family";

export type PremiumFeatureKey =
  | "dog_profile"
  | "basic_logs"
  | "starter_routines"
  | "local_history"
  | "advanced_meals"
  | "health_watch"
  | "records_vault"
  | "care_reports"
  | "woofguide_drafts"
  | "report_history"
  | "household_roles"
  | "shared_routines"
  | "caregiver_handoffs"
  | "family_calendar";

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
  activePlanId?: PremiumPlanId | null;
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
  entitlements: PremiumEntitlementSummary;
  checkoutEnabled: boolean;
  launchNotice: string;
}

export interface PremiumFeatureEntitlement {
  key: PremiumFeatureKey;
  label: string;
  detail: string;
  requiredPlanId: PremiumPlanId;
}

export interface PremiumFeatureGate extends PremiumFeatureEntitlement {
  unlocked: boolean;
}

export interface PremiumEntitlementSummary {
  activePlanId: PremiumPlanId;
  included: readonly PremiumFeatureGate[];
  locked: readonly PremiumFeatureGate[];
  nextPlanId: PremiumPlanId | null;
  upgradeHeadline: string;
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

export const PREMIUM_FEATURES: readonly PremiumFeatureEntitlement[] = [
  {
    key: "dog_profile",
    label: "Dog profile",
    detail: "Core dog identity, care focus, weight, vet boundary, and credential fallback fields.",
    requiredPlanId: "free",
  },
  {
    key: "basic_logs",
    label: "Basic care logs",
    detail: "Meal, walk, potty, training, symptoms, medication, grooming, notes, and sticky notes.",
    requiredPlanId: "free",
  },
  {
    key: "starter_routines",
    label: "Starter routines",
    detail: "Basic expected-care routines that logs can satisfy.",
    requiredPlanId: "free",
  },
  {
    key: "local_history",
    label: "Local care history",
    detail: "Local-first timeline history and owner-controlled export.",
    requiredPlanId: "free",
  },
  {
    key: "advanced_meals",
    label: "Advanced meal and diet tracking",
    detail: "Expected, served, eaten, skipped, partial, and daily diet progress.",
    requiredPlanId: "plus",
  },
  {
    key: "health_watch",
    label: "Health Watch pattern summaries",
    detail: "Non-diagnostic appetite, stool, vomit, anxiety, and red-flag organization.",
    requiredPlanId: "plus",
  },
  {
    key: "records_vault",
    label: "Records vault",
    detail: "Vaccine, vet, insurance, microchip, receipt, and document metadata.",
    requiredPlanId: "plus",
  },
  {
    key: "care_reports",
    label: "Care Pass reports",
    detail: "Sitter, trainer, caregiver, and vet handoff reports with health pattern context.",
    requiredPlanId: "plus",
  },
  {
    key: "woofguide_drafts",
    label: "WoofGuide reviewed drafts",
    detail: "Owner-reviewed meal logs, reminders, vet notes, and Care Pass next steps.",
    requiredPlanId: "plus",
  },
  {
    key: "report_history",
    label: "Stored report history",
    detail: "Saved Care Pass snapshots for resend and household review.",
    requiredPlanId: "plus",
  },
  {
    key: "household_roles",
    label: "Household roles",
    detail: "Owner and caregiver roles with clearer responsibility boundaries.",
    requiredPlanId: "family",
  },
  {
    key: "shared_routines",
    label: "Shared routine board",
    detail: "Household-wide routine ownership, completion, skipped, and partial state.",
    requiredPlanId: "family",
  },
  {
    key: "caregiver_handoffs",
    label: "Caregiver handoffs",
    detail: "Shared sitter, family, trainer, and walker handoff workflows.",
    requiredPlanId: "family",
  },
  {
    key: "family_calendar",
    label: "Family calendar",
    detail: "Shared care calendar for multiple caregivers and upcoming obligations.",
    requiredPlanId: "family",
  },
];

const PLAN_RANK: Record<PremiumPlanId, number> = {
  free: 0,
  plus: 1,
  family: 2,
};

function normalizePlanId(planId: PremiumPlanId | null | undefined): PremiumPlanId {
  return planId === "plus" || planId === "family" ? planId : "free";
}

function planAllows(activePlanId: PremiumPlanId, requiredPlanId: PremiumPlanId): boolean {
  return PLAN_RANK[activePlanId] >= PLAN_RANK[requiredPlanId];
}

export function isPremiumFeatureUnlocked(
  activePlanId: PremiumPlanId | null | undefined,
  featureKey: PremiumFeatureKey,
): boolean {
  const feature = PREMIUM_FEATURES.find((item) => item.key === featureKey);
  return feature ? planAllows(normalizePlanId(activePlanId), feature.requiredPlanId) : false;
}

export function derivePremiumEntitlements(
  activePlanId: PremiumPlanId | null | undefined = "free",
): PremiumEntitlementSummary {
  const planId = normalizePlanId(activePlanId);
  const gates = PREMIUM_FEATURES.map((feature) => ({
    ...feature,
    unlocked: planAllows(planId, feature.requiredPlanId),
  }));
  const included = gates.filter((feature) => feature.unlocked);
  const locked = gates.filter((feature) => !feature.unlocked);
  const nextPlanId: PremiumPlanId | null =
    planId === "free" ? "plus" : planId === "plus" ? "family" : null;

  return {
    activePlanId: planId,
    included,
    locked,
    nextPlanId,
    upgradeHeadline: nextPlanId
      ? `Upgrade to ${PREMIUM_PLANS.find((plan) => plan.id === nextPlanId)?.name ?? nextPlanId} to unlock ${locked.length} more care tools.`
      : "All current premium care tools are unlocked for this plan.",
  };
}

function count(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function derivePremiumPreview(input: PremiumPreviewInput = {}): PremiumPreview {
  const activePlanId = normalizePlanId(input.activePlanId);
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
  ];
  signals.sort((a, b) => b.score - a.score);

  const recommendedPlanId: PremiumPlanId = caregiverCount > 1 ? "family" : "plus";
  const checkoutEnabled = PREMIUM_PLANS.some((plan) => plan.checkoutEnabled);

  return {
    plans: PREMIUM_PLANS,
    recommendedPlanId,
    valueSignals: signals,
    entitlements: derivePremiumEntitlements(activePlanId),
    checkoutEnabled,
    launchNotice:
      "Preview only: payments stay disabled until privacy, support, refund, and subscription-launch obligations are ready.",
  };
}

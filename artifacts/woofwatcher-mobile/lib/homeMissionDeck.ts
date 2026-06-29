export type HomeMissionTone = "sage" | "copper" | "amber" | "rose" | "navy";

export type HomeMissionRoute =
  | "/adventure"
  | "/calendar"
  | "/health?tab=health"
  | "/health?tab=bile"
  | "/log"
  | "/log?type=meal"
  | `/log?entry=${string}`
  | `/log?type=${string}&detail=1&intent=${number}`
  | "/records";

export type HomeMissionIcon =
  | "bile"
  | "bond"
  | "clock"
  | "energy"
  | "happy"
  | "health"
  | "heart"
  | "hunger"
  | "meal"
  | "medication"
  | "mood_good"
  | "mood_great"
  | "mood_meh"
  | "mood_okay"
  | "mood_rough"
  | "note"
  | "pee"
  | "poo"
  | "play"
  | "training"
  | "treat"
  | "vomit"
  | "anxious"
  | "walk";

export interface HomeMissionCareInput {
  label: string;
  detail: string;
  icon: HomeMissionIcon;
  route: HomeMissionRoute;
  openLoop: boolean;
}

export interface HomeMissionAdventureInput {
  title: string;
  level: number;
  todayXp: number;
  memoriesCount: number;
}

export interface HomeMissionHealthInput {
  label: string;
  status: string;
  detail: string;
  needsReview: boolean;
}

export interface HomeMissionCarePassInput {
  label: string;
  detail: string;
  ready: boolean;
}

export interface HomeMissionDeckInput {
  petName: string;
  caregiverName: string;
  nextCare: HomeMissionCareInput;
  adventure: HomeMissionAdventureInput;
  health: HomeMissionHealthInput;
  carePass: HomeMissionCarePassInput;
}

export interface HomeMission {
  key: "care-today" | "adventure" | "health" | "care-pass";
  label: string;
  title: string;
  detail: string;
  statusLabel: string;
  cta: string;
  icon: HomeMissionIcon;
  route: HomeMissionRoute;
  tone: HomeMissionTone;
}

function clean(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function buildHomeMissionDeck(input: HomeMissionDeckInput): HomeMission[] {
  const petName = clean(input.petName, "Phoenix");
  const caregiverName = clean(input.caregiverName, "caregiver");
  const nextCareTitle = clean(input.nextCare.label, `${petName}'s next care`);
  const nextCareDetail = clean(input.nextCare.detail, `${caregiverName} can review today's plan.`);
  const adventureLevel = safeNumber(input.adventure.level);
  const todayXp = safeNumber(input.adventure.todayXp);
  const memoriesCount = safeNumber(input.adventure.memoriesCount);

  // No mission in this deck should pretend to be live cloud sync; each one routes to a real local-first workflow.
  return [
    {
      key: "care-today",
      label: "My Care Today",
      title: nextCareTitle,
      detail: nextCareDetail,
      statusLabel: input.nextCare.openLoop ? "Open loop" : "Next care",
      cta: input.nextCare.openLoop ? "Update care" : "View plan",
      icon: input.nextCare.icon,
      route: input.nextCare.route,
      tone: input.nextCare.openLoop ? "copper" : "sage",
    },
    {
      key: "adventure",
      label: "Adventure",
      title: clean(input.adventure.title, `${petName}'s next quest`),
      detail: `Level ${adventureLevel} - ${todayXp} XP today - ${memoriesCount} memories`,
      statusLabel: "Care RPG",
      cta: "Start quest",
      icon: "walk",
      route: "/adventure",
      tone: todayXp > 0 ? "copper" : "navy",
    },
    {
      key: "health",
      label: input.health.needsReview ? "Health Review" : "Health Watch",
      title: clean(input.health.label, "Health Watch"),
      detail: clean(input.health.detail, "Calm, non-diagnostic care signals."),
      statusLabel: clean(input.health.status, input.health.needsReview ? "Review" : "Stable"),
      cta: input.health.needsReview ? "Review" : "Open health",
      icon: input.health.needsReview ? "bile" : "health",
      route: input.health.needsReview ? "/health?tab=bile" : "/health?tab=health",
      tone: input.health.needsReview ? "amber" : "sage",
    },
    {
      key: "care-pass",
      label: "Care Pass",
      title: clean(input.carePass.label, `${petName}'s Care Pass`),
      detail: clean(input.carePass.detail, "Diet, records, and shareable care history."),
      statusLabel: input.carePass.ready ? "Ready" : "Build pass",
      cta: "Open pass",
      icon: "note",
      route: "/records",
      tone: input.carePass.ready ? "sage" : "amber",
    },
  ];
}

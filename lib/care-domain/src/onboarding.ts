export interface OnboardingProfile {
  name?: string | null;
  breed?: string | null;
  weight?: {
    current?: number | null;
    unit?: string | null;
  } | null;
}

export interface OnboardingDietProfile {
  primaryFood?: string | null;
  normalPortion?: string | null;
  mealSchedule?: string | null;
}

export interface OnboardingRoutine {
  type?: string | null;
  label?: string | null;
  time?: string | null;
}

export interface OnboardingCaregiver {
  name?: string | null;
  role?: string | null;
}

export interface OnboardingInput {
  profile?: OnboardingProfile | null;
  dietProfile?: OnboardingDietProfile | null;
  routines?: readonly OnboardingRoutine[] | null;
  caregivers?: readonly OnboardingCaregiver[] | null;
}

export interface OnboardingStep {
  id: "dog-profile" | "diet-profile" | "starter-routine" | "household-caregiver";
  title: string;
  detail: string;
  route: "/more" | "/calendar";
  done: boolean;
}

export interface OnboardingStatus {
  isComplete: boolean;
  completedCount: number;
  totalCount: number;
  percent: number;
  summary: string;
  nextStep: OnboardingStep | null;
  steps: OnboardingStep[];
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasRealDogName(profile: OnboardingProfile | null | undefined): boolean {
  const name = clean(profile?.name).toLowerCase();
  return Boolean(name && name !== "my dog" && name !== "dog");
}

function hasDogProfile(profile: OnboardingProfile | null | undefined): boolean {
  const breed = clean(profile?.breed);
  const weight = profile?.weight?.current ?? 0;
  return hasRealDogName(profile) && (breed.length > 0 || weight > 0);
}

function hasDietProfile(dietProfile: OnboardingDietProfile | null | undefined): boolean {
  return Boolean(
    clean(dietProfile?.primaryFood) &&
      clean(dietProfile?.normalPortion) &&
      clean(dietProfile?.mealSchedule),
  );
}

function hasStarterRoutine(routines: readonly OnboardingRoutine[] | null | undefined): boolean {
  return (routines ?? []).some(
    (routine) => clean(routine.type) && clean(routine.label) && clean(routine.time),
  );
}

function hasHouseholdCaregiver(caregivers: readonly OnboardingCaregiver[] | null | undefined): boolean {
  return (caregivers ?? []).some((caregiver) => clean(caregiver.name));
}

export function deriveOnboardingStatus(input: OnboardingInput): OnboardingStatus {
  const steps: OnboardingStep[] = [
    {
      id: "dog-profile",
      title: "Set up dog profile",
      detail: "Add the dog's name plus breed or weight so care summaries are specific.",
      route: "/more",
      done: hasDogProfile(input.profile),
    },
    {
      id: "diet-profile",
      title: "Add diet baseline",
      detail: "Add food, normal portion, and meal schedule to unlock meal progress.",
      route: "/more",
      done: hasDietProfile(input.dietProfile),
    },
    {
      id: "starter-routine",
      title: "Create first routine",
      detail: "Add at least one feeding, walk, medication, or care routine.",
      route: "/calendar",
      done: hasStarterRoutine(input.routines),
    },
    {
      id: "household-caregiver",
      title: "Add care team",
      detail: "Add at least one household caregiver so handoffs have an owner.",
      route: "/more",
      done: hasHouseholdCaregiver(input.caregivers),
    },
  ];
  const completedCount = steps.filter((step) => step.done).length;
  const totalCount = steps.length;
  const percent = Math.round((completedCount / totalCount) * 100);
  const nextStep = steps.find((step) => !step.done) ?? null;
  return {
    isComplete: completedCount === totalCount,
    completedCount,
    totalCount,
    percent,
    nextStep,
    steps,
    summary:
      completedCount === totalCount
        ? "Care foundation ready."
        : `${completedCount}/${totalCount} setup steps complete.`,
  };
}

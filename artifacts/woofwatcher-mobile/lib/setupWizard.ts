export interface SetupWizardWeightInfo {
  current: number;
  goal?: string;
  unit: string;
}

export interface SetupWizardProfile {
  name: string;
  publicLabel: string;
  breed: string;
  background?: string;
  careFocus?: string;
  weight: SetupWizardWeightInfo;
}

export interface SetupWizardCaregiver {
  name: string;
  role: string;
}

export interface SetupWizardRoutine {
  id: string;
  label: string;
  type: string;
  time: string;
  owner: string;
  note: string;
}

export interface SetupWizardDietProfile {
  primaryFood: string;
  normalPortion: string;
  mealSchedule: string;
}

export interface SetupWizardCareDoc {
  createdAt: string;
  updatedAt: string;
  profile: SetupWizardProfile;
  caregivers: SetupWizardCaregiver[];
  dietProfile: SetupWizardDietProfile;
  routines: SetupWizardRoutine[];
}

export interface SetupWizardDraft {
  dogName: string;
  breed: string;
  weight: string;
  weightUnit: string;
  careFocus: string;
  caregiverName: string;
  caregiverRole: string;
  primaryFood: string;
  normalPortion: string;
  mealSchedule: string;
  routineType: string;
  routineLabel: string;
  routineTime: string;
  householdSetupIntent: SetupWizardHouseholdSetupIntent;
}

export interface SetupWizardConfirmation {
  title: string;
  body: string;
  nextStep: string;
}

export interface SetupWizardHouseholdContext {
  activeHouseholdName?: string | null;
  householdCount?: number | null;
  householdSetupIntent?: SetupWizardHouseholdSetupIntent | null;
}

export type SetupWizardHouseholdSetupIntent = "start_pack" | "join_pack" | "decide_later";

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isPlaceholderDogName(name: string): boolean {
  const normalized = clean(name).toLowerCase();
  return normalized === "" || normalized === "my dog" || normalized === "dog";
}

function safeRoutineId(type: string, nowIso: string): string {
  const stamp = Date.parse(nowIso);
  const suffix = Number.isFinite(stamp) ? stamp : 0;
  return `routine_${clean(type).toLowerCase() || "care"}_${suffix}`;
}

export function createSetupWizardDraft(doc: SetupWizardCareDoc): SetupWizardDraft {
  const caregiver = doc.caregivers[0];
  const routine = doc.routines[0];
  return {
    dogName: isPlaceholderDogName(doc.profile.name) ? "" : clean(doc.profile.name),
    breed: clean(doc.profile.breed),
    weight: doc.profile.weight.current > 0 ? String(doc.profile.weight.current) : "",
    weightUnit: clean(doc.profile.weight.unit) || "lb",
    careFocus: clean(doc.profile.careFocus),
    caregiverName: clean(caregiver?.name),
    caregiverRole: clean(caregiver?.role) || "Primary caregiver",
    primaryFood: clean(doc.dietProfile.primaryFood),
    normalPortion: clean(doc.dietProfile.normalPortion),
    mealSchedule: clean(doc.dietProfile.mealSchedule),
    routineType: clean(routine?.type) || "meal",
    routineLabel: clean(routine?.label),
    routineTime: clean(routine?.time),
    householdSetupIntent: "decide_later",
  };
}

export function applySetupWizardDraft<TDoc extends SetupWizardCareDoc>(
  doc: TDoc,
  draft: SetupWizardDraft,
  nowIso: string = new Date().toISOString(),
): TDoc {
  const dogName = clean(draft.dogName) || doc.profile.name;
  const weight = Number.parseFloat(clean(draft.weight));
  const caregiverName = clean(draft.caregiverName);
  const caregiverRole = clean(draft.caregiverRole) || "Caregiver";
  const routineType = clean(draft.routineType) || "meal";
  const routineLabel = clean(draft.routineLabel);
  const routineTime = clean(draft.routineTime);
  const existingRoutine = doc.routines[0];
  const nextCaregivers = caregiverName
    ? [
        { name: caregiverName, role: caregiverRole },
        ...doc.caregivers.filter((caregiver) => clean(caregiver.name).toLowerCase() !== caregiverName.toLowerCase()),
      ]
    : doc.caregivers;
  const nextRoutines =
    routineLabel && routineTime
      ? [
          {
            id: existingRoutine?.id || safeRoutineId(routineType, nowIso),
            label: routineLabel,
            type: routineType,
            time: routineTime,
            owner: caregiverName || existingRoutine?.owner || doc.caregivers[0]?.name || "",
            note: existingRoutine?.note || "",
          },
          ...doc.routines.slice(1),
        ]
      : doc.routines;

  return {
    ...doc,
    updatedAt: nowIso,
    profile: {
      ...doc.profile,
      name: dogName,
      publicLabel: dogName,
      breed: clean(draft.breed),
      careFocus: clean(draft.careFocus),
      weight: {
        ...doc.profile.weight,
        current: Number.isFinite(weight) && weight > 0 ? weight : doc.profile.weight.current,
        unit: clean(draft.weightUnit) || doc.profile.weight.unit,
      },
    },
    caregivers: nextCaregivers,
    dietProfile: {
      ...doc.dietProfile,
      primaryFood: clean(draft.primaryFood),
      normalPortion: clean(draft.normalPortion),
      mealSchedule: clean(draft.mealSchedule),
    },
    routines: nextRoutines,
  } as TDoc;
}

export function buildSetupConfirmation(
  doc: SetupWizardCareDoc,
  householdContext: SetupWizardHouseholdContext = {},
): SetupWizardConfirmation {
  const dogName = clean(doc.profile.name) || "Your dog";
  const caregiver = doc.caregivers.find((item) => clean(item.name)) ?? null;
  const routine = doc.routines.find((item) => clean(item.label) && clean(item.time)) ?? null;
  const food = clean(doc.dietProfile.primaryFood);
  const portion = clean(doc.dietProfile.normalPortion);
  const schedule = clean(doc.dietProfile.mealSchedule);
  const activeHouseholdName = clean(householdContext.activeHouseholdName);
  const householdCount = Math.max(0, Math.floor(householdContext.householdCount ?? 0));
  const householdSetupIntent = householdContext.householdSetupIntent ?? "decide_later";

  const routineLine = routine
    ? `${clean(routine.label)} at ${clean(routine.time)}`
    : "A starter routine is ready";
  const caregiverLine = caregiver
    ? `${clean(caregiver.name)} is listed as ${clean(caregiver.role) || "caregiver"}`
    : "A household caregiver is listed";
  const dietLine =
    food && portion && schedule
      ? `${food}, ${portion}, ${schedule}`
      : "The diet baseline is saved";
  const baseHouseholdStep = activeHouseholdName
    ? householdCount > 1
      ? `Active household: ${activeHouseholdName}. Manage invite, sync, and switching for your ${householdCount} packs in More; setup only saved the care foundation.`
      : `Active household: ${activeHouseholdName}. Household invite and sync controls stay in More when you are ready to coordinate the pack.`
    : "Household invite and sync controls stay in More when you are ready to coordinate the pack.";
  const intentStep =
    householdSetupIntent === "start_pack"
      ? "Next: open More to share the owner/admin invite code and review Household Access before anyone else logs care."
      : householdSetupIntent === "join_pack"
        ? "Next: open More and use Join another household with the invite code from the pack owner."
        : "Next: keep using Today now; More has invite, join, sync health, and switching controls when the household is ready.";
  const householdStep = `${baseHouseholdStep} ${intentStep}`;

  return {
    title: `${dogName}'s care foundation is ready`,
    body: `${routineLine}. ${caregiverLine}. Diet baseline: ${dietLine}. WoofWatcher will use this for Today, Log, Records, reports, and WoofGuide.`,
    nextStep: householdStep,
  };
}

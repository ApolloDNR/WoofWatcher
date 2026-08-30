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

export type SetupWizardHouseholdMode = "create" | "join" | "local";
export type SetupWizardProviderStatus = "local-only" | "pending-provider";

export interface SetupWizardHouseholdSetup {
  mode: SetupWizardHouseholdMode;
  householdName: string;
  inviteCode?: string;
  providerStatus: SetupWizardProviderStatus;
  updatedAt?: string;
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
  householdSetup?: SetupWizardHouseholdSetup;
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
  householdMode: SetupWizardHouseholdMode;
  householdName: string;
  inviteCode: string;
  primaryFood: string;
  normalPortion: string;
  mealSchedule: string;
  routineType: string;
  routineLabel: string;
  routineTime: string;
}

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

function normalizeHouseholdMode(value: unknown): SetupWizardHouseholdMode {
  if (value === "join" || value === "local" || value === "create") return value;
  return "create";
}

function normalizeInviteCode(value: unknown): string {
  return clean(value).replace(/\s+/g, "").toUpperCase();
}

function defaultHouseholdName(dogName: string): string {
  const name = clean(dogName);
  return name && !isPlaceholderDogName(name) ? `${name}'s Household` : "Dog household";
}

function householdProviderStatus(mode: SetupWizardHouseholdMode): SetupWizardProviderStatus {
  return mode === "local" ? "local-only" : "pending-provider";
}

export function createSetupWizardDraft(doc: SetupWizardCareDoc): SetupWizardDraft {
  const caregiver = doc.caregivers[0];
  const routine = doc.routines[0];
  const householdSetup = doc.householdSetup;
  const householdMode = normalizeHouseholdMode(householdSetup?.mode);
  return {
    dogName: isPlaceholderDogName(doc.profile.name) ? "" : clean(doc.profile.name),
    breed: clean(doc.profile.breed),
    weight: doc.profile.weight.current > 0 ? String(doc.profile.weight.current) : "",
    weightUnit: clean(doc.profile.weight.unit) || "lb",
    careFocus: clean(doc.profile.careFocus),
    caregiverName: clean(caregiver?.name),
    caregiverRole: clean(caregiver?.role) || "Primary caregiver",
    householdMode,
    householdName: clean(householdSetup?.householdName) || defaultHouseholdName(doc.profile.name),
    inviteCode: normalizeInviteCode(householdSetup?.inviteCode),
    primaryFood: clean(doc.dietProfile.primaryFood),
    normalPortion: clean(doc.dietProfile.normalPortion),
    mealSchedule: clean(doc.dietProfile.mealSchedule),
    routineType: clean(routine?.type) || "meal",
    routineLabel: clean(routine?.label),
    routineTime: clean(routine?.time),
  };
}

/**
 * Store-production setup is intentionally device-only for free v1. Normalize
 * stale internal create/join plans before previewing or saving so a previous
 * QA choice cannot leak invite/account promises into the consumer build.
 */
export function makeSetupWizardDraftDeviceOnly(
  draft: SetupWizardDraft,
): SetupWizardDraft {
  return {
    ...draft,
    householdMode: "local",
    inviteCode: "",
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
  const householdMode = normalizeHouseholdMode(draft.householdMode);
  const householdName = clean(draft.householdName) || defaultHouseholdName(dogName);
  const inviteCode = householdMode === "join" ? normalizeInviteCode(draft.inviteCode) : "";
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
    householdSetup: {
      mode: householdMode,
      householdName,
      inviteCode,
      providerStatus: householdProviderStatus(householdMode),
      updatedAt: nowIso,
    },
    dietProfile: {
      ...doc.dietProfile,
      primaryFood: clean(draft.primaryFood),
      normalPortion: clean(draft.normalPortion),
      mealSchedule: clean(draft.mealSchedule),
    },
    routines: nextRoutines,
  } as TDoc;
}

export interface SetupWizardConfirmationOptions {
  isSignedIn?: boolean;
  isClerkConfigured?: boolean;
  consumerRelease?: boolean;
}

export interface SetupWizardConfirmation {
  title: string;
  detail: string;
  householdLabel: string;
  syncLabel: string;
  providerBoundary: string;
  nextActions: string[];
}

export function buildSetupWizardConfirmation(
  doc: SetupWizardCareDoc,
  options: SetupWizardConfirmationOptions = {},
): SetupWizardConfirmation {
  const dogName = clean(doc.profile.name) || "your dog";
  const setup = doc.householdSetup;
  const mode = normalizeHouseholdMode(setup?.mode);
  const householdName = clean(setup?.householdName) || defaultHouseholdName(dogName);
  const inviteCode = normalizeInviteCode(setup?.inviteCode);
  if (options.consumerRelease) {
    return {
      title: "Ready to care",
      detail: `${dogName}'s profile, routines, and care history will be saved on this device.`,
      householdLabel: "Private care record",
      syncLabel: "Saved on this device.",
      providerBoundary:
        "This version does not create an account, send invites, or share care data with other people.",
      nextActions: [
        "Save the dog profile, diet baseline, starter routine, and caregiver.",
        "Open Home to start logging real care.",
        "Export a backup before changing or resetting this device.",
      ],
    };
  }
  const syncLabel = !options.isClerkConfigured
    ? "Local preview: account sync is not configured in this build."
    : options.isSignedIn
      ? "Signed in: this household plan is saved and ready for when household sync turns on."
      : "Account needed: sign in before this can sync across devices.";

  if (mode === "join") {
    return {
      title: inviteCode ? "Join invite staged" : "Invite code needed",
      detail: inviteCode
        ? `${dogName}'s care foundation will be saved locally with invite ${inviteCode}.`
        : "Add the household invite code before saving this as a join flow.",
      householdLabel: `${householdName} - join by invite`,
      syncLabel,
      providerBoundary: "Setup does not send or accept remote invites yet; it stores the owner-reviewed join plan locally.",
      nextActions: [
        "Save the dog profile, diet baseline, starter routine, and caregiver.",
        "Keep the invite code attached to the household setup plan.",
        "Joining across devices is coming soon - the invite code stays saved on this device for now.",
      ],
    };
  }

  if (mode === "local") {
    return {
      title: "Local preview household",
      detail: `${dogName}'s care foundation will stay on this device until the household is connected.`,
      householdLabel: `${householdName} - local only`,
      syncLabel,
      providerBoundary: "Local preview mode does not invite people, sync records, or move data between devices.",
      nextActions: [
        "Save the dog profile, diet baseline, starter routine, and caregiver.",
        "Use backup/export before changing devices.",
        "Sign in later to connect shared household sync when it's ready.",
      ],
    };
  }

  return {
    title: "Shared household foundation",
    detail: `${householdName} becomes ${dogName}'s care home base for routines, logs, handoffs, and reports.`,
    householdLabel: `${householdName} - create household`,
    syncLabel,
    providerBoundary: "Setup stores the household plan now; remote member invites are coming soon, so everything stays on this device for now.",
    nextActions: [
      "Save the dog profile, diet baseline, starter routine, and caregiver.",
      "Open Home to start logging real care.",
      "Remote household invites are coming soon - the plan is saved and ready for them.",
    ],
  };
}

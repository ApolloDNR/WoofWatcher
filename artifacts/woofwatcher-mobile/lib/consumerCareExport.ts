import { resolvePetName } from "./petIdentity.ts";

export interface ConsumerCareExportState {
  dataVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  activePetId?: string;
  profile?: { name?: string } | null;
  pets?: readonly unknown[];
  caregivers?: readonly unknown[];
  householdSetup?: unknown;
  reminderNotificationPreferences?: unknown;
  dietProfile?: unknown;
  routines?: readonly unknown[];
  goals?: readonly unknown[];
  records?: readonly unknown[];
  accessPasses?: readonly unknown[];
  adventureMemories?: readonly unknown[];
  reportArtifacts?: readonly unknown[];
  calendarEvents?: readonly unknown[];
  entries?: readonly unknown[];
}

export interface ConsumerCareExportBundle {
  app: "WoofWatcher";
  formatVersion: 1;
  generatedAt: string;
  scope: "current_device_care";
  dogName: string;
  counts: {
    caregivers: number;
    pets: number;
    accessPasses: number;
    adventureMemories: number;
    routines: number;
    entries: number;
    records: number;
    reportArtifacts: number;
    calendarEvents: number;
  };
  care: {
    dataVersion: number | null;
    createdAt: string | null;
    updatedAt: string | null;
    activePetId: string | null;
    profile: ConsumerCareExportState["profile"];
    pets: readonly unknown[];
    caregivers: readonly unknown[];
    householdSetup: unknown | null;
    reminderNotificationPreferences: unknown | null;
    dietProfile: unknown | null;
    routines: readonly unknown[];
    goals: readonly unknown[];
    records: readonly unknown[];
    accessPasses: readonly unknown[];
    adventureMemories: readonly unknown[];
    reportArtifacts: readonly unknown[];
    calendarEvents: readonly unknown[];
    entries: readonly unknown[];
  };
  disclosures: {
    fileBytes: string;
    providerCopies: string;
  };
}

function list(value: readonly unknown[] | undefined): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

export function buildConsumerCareExport(
  state: ConsumerCareExportState,
  now: number = Date.now(),
): ConsumerCareExportBundle {
  const pets = list(state.pets);
  const caregivers = list(state.caregivers);
  const accessPasses = list(state.accessPasses);
  const adventureMemories = list(state.adventureMemories);
  const routines = list(state.routines);
  const goals = list(state.goals);
  const records = list(state.records);
  const reportArtifacts = list(state.reportArtifacts);
  const calendarEvents = list(state.calendarEvents);
  const entries = list(state.entries);

  return {
    app: "WoofWatcher",
    formatVersion: 1,
    generatedAt: new Date(now).toISOString(),
    scope: "current_device_care",
    dogName: resolvePetName(state.profile?.name),
    counts: {
      caregivers: caregivers.length,
      pets: pets.length,
      accessPasses: accessPasses.length,
      adventureMemories: adventureMemories.length,
      routines: routines.length,
      entries: entries.length,
      records: records.length,
      reportArtifacts: reportArtifacts.length,
      calendarEvents: calendarEvents.length,
    },
    care: {
      dataVersion: state.dataVersion ?? null,
      createdAt: state.createdAt ?? null,
      updatedAt: state.updatedAt ?? null,
      activePetId: state.activePetId ?? null,
      profile: state.profile ?? null,
      pets,
      caregivers,
      householdSetup: state.householdSetup ?? null,
      reminderNotificationPreferences:
        state.reminderNotificationPreferences ?? null,
      dietProfile: state.dietProfile ?? null,
      routines,
      goals,
      records,
      accessPasses,
      adventureMemories,
      reportArtifacts,
      calendarEvents,
      entries,
    },
    disclosures: {
      fileBytes:
        "This JSON lists the current care data but does not include photo, document, or report file bytes.",
      providerCopies:
        "A connected or older build may also have stored a provider account copy. This device export does not inspect that copy.",
    },
  };
}

export function serializeConsumerCareExport(
  bundle: ConsumerCareExportBundle,
): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

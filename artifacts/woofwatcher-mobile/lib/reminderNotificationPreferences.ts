export type ReminderNotificationPermissionStatus = "unknown" | "granted" | "denied" | "unavailable";

export interface ReminderNotificationPreferences {
  pushEnabled: boolean;
  permissionStatus: ReminderNotificationPermissionStatus;
  quietHoursStart: string;
  quietHoursEnd: string;
  optOut: boolean;
  updatedAt?: string;
}

export interface ReminderNotificationProviderProfile {
  pushNotificationsConfigured?: unknown;
  providerStatus?: unknown;
}

export interface CareReminderNotificationPreferencesForCenter {
  providerConfigured: boolean;
  pushEnabled: boolean;
  permissionStatus: ReminderNotificationPermissionStatus;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  optOut: boolean;
}

export type ReminderNotificationPreferenceDraft = Partial<ReminderNotificationPreferences>;

const PERMISSION_STATUSES: readonly ReminderNotificationPermissionStatus[] = [
  "unknown",
  "granted",
  "denied",
  "unavailable",
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizePermissionStatus(value: unknown): ReminderNotificationPermissionStatus {
  return PERMISSION_STATUSES.includes(value as ReminderNotificationPermissionStatus)
    ? (value as ReminderNotificationPermissionStatus)
    : "unknown";
}

export function normalizeReminderNotificationPreferences(value: unknown): ReminderNotificationPreferences {
  const source = asRecord(value);
  const optOut = Boolean(source.optOut);
  return {
    pushEnabled: optOut ? false : Boolean(source.pushEnabled),
    permissionStatus: normalizePermissionStatus(source.permissionStatus),
    quietHoursStart: clean(source.quietHoursStart),
    quietHoursEnd: clean(source.quietHoursEnd),
    optOut,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : undefined,
  };
}

export function applyReminderNotificationPreferenceDraft<TDoc extends { reminderNotificationPreferences?: unknown; updatedAt?: string }>(
  doc: TDoc,
  draft: ReminderNotificationPreferenceDraft,
  now: string,
): TDoc & { reminderNotificationPreferences: ReminderNotificationPreferences; updatedAt: string } {
  const current = normalizeReminderNotificationPreferences(doc.reminderNotificationPreferences);
  const next = normalizeReminderNotificationPreferences({
    ...current,
    ...draft,
    updatedAt: now,
  });

  return {
    ...doc,
    updatedAt: now,
    reminderNotificationPreferences: next,
  };
}

export function buildReminderNotificationPreferencesForCenter(
  providerProfile: ReminderNotificationProviderProfile | null | undefined,
  preferences: unknown,
): CareReminderNotificationPreferencesForCenter {
  const normalized = normalizeReminderNotificationPreferences(preferences);
  return {
    providerConfigured:
      providerProfile?.pushNotificationsConfigured === true &&
      providerProfile.providerStatus === "provider-approved",
    pushEnabled: normalized.pushEnabled,
    permissionStatus: normalized.permissionStatus,
    quietHoursStart: normalized.quietHoursStart || null,
    quietHoursEnd: normalized.quietHoursEnd || null,
    optOut: normalized.optOut,
  };
}

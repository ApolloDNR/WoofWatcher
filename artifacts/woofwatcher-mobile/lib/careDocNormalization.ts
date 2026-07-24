import type { CareDoc } from "../context/CareContext";
import { normalizeLaunchProviderProfile } from "./launchProviderSetup.ts";
import { normalizeReminderNotificationPreferences } from "./reminderNotificationPreferences.ts";

type UnknownRecord = Record<string, unknown>;

export const CARE_DOC_LEGACY_SENTINEL_AT = "1970-01-01T00:00:00.000Z";

export function createFreshCareDocMetadata(
  now = new Date().toISOString(),
): Pick<CareDoc, "createdAt" | "updatedAt"> {
  return {
    createdAt: now,
    // A fresh device is pristine until the first real edit. This prevents it
    // from outranking an existing household document during first refresh.
    updatedAt: CARE_DOC_LEGACY_SENTINEL_AT,
  };
}

export function createLegacyCareDocMetadata(): Pick<
  CareDoc,
  "createdAt" | "updatedAt"
> {
  return {
    // Deterministic legacy fallback: normalization of the same old document
    // on multiple devices must not manufacture a createdAt conflict.
    createdAt: CARE_DOC_LEGACY_SENTINEL_AT,
    updatedAt: CARE_DOC_LEGACY_SENTINEL_AT,
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(source: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function hasStrings(source: UnknownRecord, keys: readonly string[]): boolean {
  return keys.every(
    (key) => hasOwn(source, key) && typeof source[key] === "string",
  );
}

function hasBooleans(
  source: UnknownRecord,
  keys: readonly string[],
): boolean {
  return keys.every(
    (key) => hasOwn(source, key) && typeof source[key] === "boolean",
  );
}

function optionalString(source: UnknownRecord, key: string): boolean {
  return (
    !hasOwn(source, key) ||
    source[key] === undefined ||
    typeof source[key] === "string"
  );
}

function arrayOfRecords(
  value: unknown,
  predicate: (row: UnknownRecord) => boolean,
): boolean {
  return (
    Array.isArray(value) &&
    value.every((row) => isRecord(row) && predicate(row))
  );
}

/**
 * Any document that can participate in cache, baseline, or remote
 * reconciliation must have the complete known shape. Missing known fields
 * cannot be filled from install defaults: doing so would reinterpret absence
 * as an intentional edit during a merge. Arbitrary extension fields remain
 * allowed for forward-compatible round trips.
 */
export function isCompleteCareDocSnapshot(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const source = value;
  if (
    !hasStrings(source, ["createdAt", "updatedAt", "activePetId"]) ||
    !isRecord(source.profile) ||
    !isRecord(source.householdSetup) ||
    !isRecord(source.launchSupportProfile) ||
    !isRecord(source.launchProviderProfile) ||
    !isRecord(source.reminderNotificationPreferences) ||
    !isRecord(source.dietProfile)
  ) {
    return false;
  }

  const profile = source.profile;
  if (
    !hasStrings(profile, [
      "name",
      "publicLabel",
      "breed",
      "background",
      "careFocus",
      "vetBoundary",
    ]) ||
    !isRecord(profile.weight) ||
    typeof profile.weight.current !== "number" ||
    !Number.isFinite(profile.weight.current) ||
    !hasStrings(profile.weight, ["goal", "unit"])
  ) {
    return false;
  }

  const household = source.householdSetup;
  if (
    !hasStrings(household, ["mode", "householdName", "providerStatus"]) ||
    !optionalString(household, "inviteCode") ||
    !optionalString(household, "updatedAt")
  ) {
    return false;
  }

  const support = source.launchSupportProfile;
  if (
    !hasStrings(support, [
      "supportEmail",
      "privacyPolicyUrl",
      "termsUrl",
      "providerStatus",
    ]) ||
    !hasBooleans(support, [
      "refundPolicyApproved",
      "veterinaryBoundaryApproved",
      "accountDeletionEscalationApproved",
      "incidentResponseApproved",
    ]) ||
    !optionalString(support, "ownerReviewedAt") ||
    (hasOwn(support, "supportLegalReadinessEvidence") &&
      support.supportLegalReadinessEvidence !== null &&
      !isRecord(support.supportLegalReadinessEvidence))
  ) {
    return false;
  }

  const provider = source.launchProviderProfile;
  if (
    !hasStrings(provider, ["providerStatus", "notes"]) ||
    !hasBooleans(provider, [
      "authConfigured",
      "authProviderProofReady",
      "databaseConfigured",
      "databaseProviderProofReady",
      "storageProviderConfigured",
      "storageProviderProofReady",
      "aiProviderConfigured",
      "aiProviderProofReady",
      "paymentsEnabled",
      "paymentsProviderProofReady",
      "pushNotificationsConfigured",
      "pushNotificationsProofReady",
      "appStoreAccountsReady",
      "storeAccountsProofReady",
      "accountDeletionEnabled",
      "accountDeletionProofReady",
    ]) ||
    !optionalString(provider, "ownerReviewedAt") ||
    (hasOwn(provider, "storageProviderEvidence") &&
      provider.storageProviderEvidence !== null &&
      !isRecord(provider.storageProviderEvidence))
  ) {
    return false;
  }

  const reminders = source.reminderNotificationPreferences;
  if (
    !hasStrings(reminders, [
      "permissionStatus",
      "quietHoursStart",
      "quietHoursEnd",
    ]) ||
    !hasBooleans(reminders, ["pushEnabled", "optOut"]) ||
    !optionalString(reminders, "updatedAt")
  ) {
    return false;
  }

  if (
    !hasStrings(source.dietProfile, [
      "primaryFood",
      "normalPortion",
      "mealSchedule",
      "toppers",
      "supplements",
      "bedtimeSnack",
      "treatsAllowed",
      "avoid",
      "sensitivities",
      "appetiteQuirks",
      "vetNotes",
    ])
  ) {
    return false;
  }

  return (
    arrayOfRecords(
      source.pets,
      (row) =>
        hasStrings(row, ["id", "name", "breed"]) &&
        optionalString(row, "publicLabel") &&
        optionalString(row, "careFocus") &&
        optionalString(row, "avatarTemplateId") &&
        optionalString(row, "status") &&
        optionalString(row, "createdAt"),
    ) &&
    arrayOfRecords(source.caregivers, (row) =>
      hasStrings(row, ["name", "role"]),
    ) &&
    arrayOfRecords(source.routines, (row) =>
      hasStrings(row, ["id", "label", "type", "time", "owner", "note"]),
    ) &&
    arrayOfRecords(source.goals, (row) =>
      hasStrings(row, [
        "id",
        "category",
        "title",
        "target",
        "status",
        "due",
        "note",
      ]),
    ) &&
    arrayOfRecords(source.records, (row) =>
      hasStrings(row, ["id", "type", "title", "due", "note"]),
    ) &&
    arrayOfRecords(source.accessPasses, (row) =>
      hasStrings(row, [
        "id",
        "holderName",
        "role",
        "kind",
        "startsAt",
        "endsAt",
      ]),
    ) &&
    arrayOfRecords(
      source.adventureMemories,
      (row) =>
        hasStrings(row, [
          "id",
          "petName",
          "questId",
          "title",
          "note",
          "createdAt",
          "storageStatus",
          "mediaStatus",
        ]) &&
        Array.isArray(row.humans) &&
        row.humans.every((human) => typeof human === "string") &&
        typeof row.xp === "number" &&
        Number.isFinite(row.xp),
    ) &&
    arrayOfRecords(
      source.reportArtifacts,
      (row) =>
        hasStrings(row, [
          "id",
          "kind",
          "audience",
          "title",
          "generatedAt",
          "createdAt",
          "summary",
          "message",
        ]) &&
        Array.isArray(row.sectionTitles) &&
        row.sectionTitles.every((title) => typeof title === "string"),
    ) &&
    arrayOfRecords(
      source.calendarEvents,
      (row) =>
        hasStrings(row, ["id", "title", "type", "date", "source"]) &&
        optionalString(row, "time") &&
        optionalString(row, "location") &&
        optionalString(row, "note"),
    )
  );
}

function assertOptionalRecord(source: UnknownRecord, key: string): void {
  if (source[key] !== undefined && !isRecord(source[key])) {
    throw new TypeError(`Care document ${key} must be an object.`);
  }
}

function assertOptionalArray(source: UnknownRecord, key: string): void {
  if (source[key] !== undefined && !Array.isArray(source[key])) {
    throw new TypeError(`Care document ${key} must be an array.`);
  }
}

/**
 * Overlays normalized known fields onto the original object. Starting from
 * the original is deliberate: a newer client may add fields that this build
 * does not understand yet, and an older client must round-trip them intact.
 */
function preserveUnknownFields(
  original: unknown,
  normalized: unknown,
): unknown {
  if (!isRecord(original) || !isRecord(normalized)) return normalized;
  const result: UnknownRecord = { ...original };
  for (const [key, value] of Object.entries(normalized)) {
    result[key] = preserveUnknownFields(original[key], value);
  }
  return result;
}

function supportEvidence(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

/**
 * Runtime-normalizes a cached or remote care document without stripping
 * forward-compatible fields. The root must be an object; callers use that
 * failure to quarantine corrupt cache snapshots instead of pairing defaults
 * with an unrelated acknowledged server base.
 */
export function normalizeCareDoc(
  value: unknown,
  defaults: CareDoc,
): CareDoc {
  if (!isRecord(value)) {
    throw new TypeError("Care document must be an object.");
  }

  const source = value;
  for (const key of [
    "profile",
    "dietProfile",
    "householdSetup",
    "launchSupportProfile",
    "launchProviderProfile",
    "reminderNotificationPreferences",
  ]) {
    assertOptionalRecord(source, key);
  }
  for (const key of [
    "pets",
    "caregivers",
    "routines",
    "goals",
    "records",
    "accessPasses",
    "adventureMemories",
    "reportArtifacts",
    "calendarEvents",
  ]) {
    assertOptionalArray(source, key);
  }
  const merged = { ...defaults, ...source } as CareDoc & UnknownRecord;
  const householdSource = isRecord(source.householdSetup)
    ? source.householdSetup
    : {};
  const supportSource = isRecord(source.launchSupportProfile)
    ? source.launchSupportProfile
    : {};
  const providerSource = isRecord(source.launchProviderProfile)
    ? source.launchProviderProfile
    : {};
  const reminderSource = isRecord(source.reminderNotificationPreferences)
    ? source.reminderNotificationPreferences
    : {};

  const householdSetup = preserveUnknownFields(householdSource, {
    mode:
      householdSource.mode === "join" || householdSource.mode === "local"
        ? householdSource.mode
        : "create",
    householdName:
      typeof householdSource.householdName === "string"
        ? householdSource.householdName
        : "",
    inviteCode:
      typeof householdSource.inviteCode === "string"
        ? householdSource.inviteCode
        : "",
    providerStatus:
      householdSource.providerStatus === "pending-provider"
        ? "pending-provider"
        : "local-only",
    updatedAt:
      typeof householdSource.updatedAt === "string"
        ? householdSource.updatedAt
        : undefined,
  });

  const launchSupportProfile = preserveUnknownFields(supportSource, {
    supportEmail:
      typeof supportSource.supportEmail === "string"
        ? supportSource.supportEmail
        : "",
    privacyPolicyUrl:
      typeof supportSource.privacyPolicyUrl === "string"
        ? supportSource.privacyPolicyUrl
        : "",
    termsUrl:
      typeof supportSource.termsUrl === "string" ? supportSource.termsUrl : "",
    refundPolicyApproved: Boolean(supportSource.refundPolicyApproved),
    veterinaryBoundaryApproved: Boolean(
      supportSource.veterinaryBoundaryApproved,
    ),
    accountDeletionEscalationApproved: Boolean(
      supportSource.accountDeletionEscalationApproved,
    ),
    incidentResponseApproved: Boolean(
      supportSource.incidentResponseApproved,
    ),
    supportLegalReadinessEvidence: supportEvidence(
      supportSource.supportLegalReadinessEvidence,
    ),
    ownerReviewedAt:
      typeof supportSource.ownerReviewedAt === "string"
        ? supportSource.ownerReviewedAt
        : undefined,
    providerStatus:
      supportSource.providerStatus === "owner-reviewed" ||
      supportSource.providerStatus === "provider-approved"
        ? supportSource.providerStatus
        : "local-draft",
  });

  return {
    ...merged,
    createdAt:
      typeof merged.createdAt === "string"
        ? merged.createdAt
        : defaults.createdAt,
    updatedAt:
      typeof merged.updatedAt === "string"
        ? merged.updatedAt
        : defaults.updatedAt,
    activePetId:
      typeof merged.activePetId === "string" && merged.activePetId.trim()
        ? merged.activePetId
        : "primary",
    profile: isRecord(merged.profile) ? merged.profile : defaults.profile,
    dietProfile: isRecord(merged.dietProfile)
      ? merged.dietProfile
      : defaults.dietProfile,
    pets: Array.isArray(merged.pets) ? merged.pets : [],
    caregivers: Array.isArray(merged.caregivers) ? merged.caregivers : [],
    routines: Array.isArray(merged.routines) ? merged.routines : [],
    goals: Array.isArray(merged.goals) ? merged.goals : [],
    records: Array.isArray(merged.records) ? merged.records : [],
    accessPasses: Array.isArray(merged.accessPasses)
      ? merged.accessPasses
      : [],
    adventureMemories: Array.isArray(merged.adventureMemories)
      ? merged.adventureMemories
      : [],
    reportArtifacts: Array.isArray(merged.reportArtifacts)
      ? merged.reportArtifacts
      : [],
    calendarEvents: Array.isArray(merged.calendarEvents)
      ? merged.calendarEvents
      : [],
    householdSetup: householdSetup as CareDoc["householdSetup"],
    launchSupportProfile:
      launchSupportProfile as CareDoc["launchSupportProfile"],
    launchProviderProfile: preserveUnknownFields(
      providerSource,
      normalizeLaunchProviderProfile(providerSource),
    ) as CareDoc["launchProviderProfile"],
    reminderNotificationPreferences: preserveUnknownFields(
      reminderSource,
      normalizeReminderNotificationPreferences(reminderSource),
    ) as CareDoc["reminderNotificationPreferences"],
  };
}

export interface PushNotificationsProofItem {
  label: string;
  requiredEvidence: string;
}

export type PushNotificationsProofStatus = "blocked" | "ready-for-review";

export interface PushNotificationsProofEvidence {
  expoPushProjectConfig?: string | null;
  appleApnsCredentials?: string | null;
  firebaseFcmCredentials?: string | null;
  permissionPromptPreferenceCopy?: string | null;
  quietHoursOptOutBehavior?: string | null;
  reminderDeliveryQaFallback?: string | null;
  nativeDeliveryEvidence?: readonly PushNotificationsNativeDeliveryEvidence[];
}

export type PushNotificationsNativeDeliveryPlatform = "ios" | "android";

export type PushNotificationsNativeDeliveryProvider = "apns" | "fcm";

export interface PushNotificationsNativeDeliveryEvidence {
  platform: PushNotificationsNativeDeliveryPlatform;
  provider: PushNotificationsNativeDeliveryProvider;
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  pushTokenRegistered?: boolean | null;
  reminderDelivered?: boolean | null;
  capturesPermissionPreference?: boolean | null;
  capturesQuietHoursOrOptOut?: boolean | null;
  capturesFallbackPath?: boolean | null;
}

export interface PushNotificationsProofManifestItem extends PushNotificationsProofItem {
  status: "blocked" | "ready";
  evidenceAttached: readonly string[];
}

export interface PushNotificationsProofManifest {
  title: "Push notifications proof manifest";
  status: PushNotificationsProofStatus;
  statusLabel: string;
  summary: string;
  readyCount: number;
  openCount: number;
  totalCount: number;
  reminderDeliveryAllowed: boolean;
  items: PushNotificationsProofManifestItem[];
  blockers: string[];
}

export const PUSH_NOTIFICATIONS_PROOF_ITEMS: readonly PushNotificationsProofItem[] = [
  {
    label: "Expo push project config",
    requiredEvidence:
      "Expo push project id, EAS project linkage, push token registration, notification channel setup, and confirmation that local preview tokens are not counted as production delivery.",
  },
  {
    label: "Apple APNs credentials",
    requiredEvidence:
      "APNs credentials, iOS device token proof, production entitlement profile, push environment, and iOS APNs delivery proof with platform/provider naming, image MIME, byte size, token registration, delivered reminder, permission preference, quiet-hours or opt-out, and fallback capture.",
  },
  {
    label: "Firebase and FCM credentials",
    requiredEvidence:
      "Firebase/FCM credentials, Android delivery proof, Google services configuration, notification channel behavior, production sender/project ownership, and Android FCM delivery proof with platform/provider naming, image MIME, byte size, token registration, delivered reminder, permission preference, quiet-hours or opt-out, and fallback capture.",
  },
  {
    label: "Permission prompt and preference copy",
    requiredEvidence:
      "permission prompt copy, notification preferences, caregiver-visible consent language, denied-permission fallback, and no-surprise medical/reminder boundary copy.",
  },
  {
    label: "Quiet hours and opt-out behavior",
    requiredEvidence:
      "quiet hours, opt-out behavior, medication and routine exception rules, per-device preference persistence, and proof that disabled notifications stay off.",
  },
  {
    label: "Reminder delivery QA and fallback",
    requiredEvidence:
      "delivery QA, missed notification fallback, reminder-center recovery path, platform-specific iOS APNs and Android FCM scheduled/delivered evidence, and support handoff for failed provider delivery.",
  },
];

export const PUSH_NOTIFICATIONS_PROOF_SUMMARY =
  "Push notifications proof packet: Expo push project config, APNs credentials, Firebase/FCM credentials, permission prompt copy, quiet hours, opt-out behavior, and delivery QA before reminder delivery can be claimed.";

const PUSH_NOTIFICATIONS_PROOF_EVIDENCE_KEYS: readonly (keyof PushNotificationsProofEvidence)[] = [
  "expoPushProjectConfig",
  "appleApnsCredentials",
  "firebaseFcmCredentials",
  "permissionPromptPreferenceCopy",
  "quietHoursOptOutBehavior",
  "reminderDeliveryQaFallback",
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

interface NativeDeliveryRequirement {
  platform: PushNotificationsNativeDeliveryPlatform;
  provider: PushNotificationsNativeDeliveryProvider;
  readyLabel: string;
  pendingLabel: string;
}

const PUSH_NOTIFICATION_NATIVE_DELIVERY_REQUIREMENTS: readonly NativeDeliveryRequirement[] = [
  {
    platform: "ios",
    provider: "apns",
    readyLabel: "1/1 iOS APNs delivery proof ready",
    pendingLabel: "0/1 iOS APNs delivery proof ready",
  },
  {
    platform: "android",
    provider: "fcm",
    readyLabel: "1/1 Android FCM delivery proof ready",
    pendingLabel: "0/1 Android FCM delivery proof ready",
  },
];

function normalize(value: unknown): string {
  return clean(value).toLowerCase();
}

function hasPositiveByteSize(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasImageMime(value: unknown): boolean {
  return normalize(value).startsWith("image/");
}

function nativeDeliveryEvidenceMatches(
  evidence: PushNotificationsNativeDeliveryEvidence,
  requirement: NativeDeliveryRequirement,
): boolean {
  const locator = `${normalize(evidence.fileName)} ${normalize(evidence.uri)} ${normalize(evidence.provider)}`;
  return (
    evidence.platform === requirement.platform &&
    evidence.provider === requirement.provider &&
    locator.includes(requirement.platform) &&
    locator.includes(requirement.provider) &&
    hasImageMime(evidence.mimeType) &&
    hasPositiveByteSize(evidence.byteSize) &&
    evidence.pushTokenRegistered === true &&
    evidence.reminderDelivered === true &&
    evidence.capturesPermissionPreference === true &&
    evidence.capturesQuietHoursOrOptOut === true &&
    evidence.capturesFallbackPath === true
  );
}

function summarizeNativeDeliveryEvidence(
  evidence: readonly PushNotificationsNativeDeliveryEvidence[] | undefined,
): Record<PushNotificationsNativeDeliveryPlatform, NativeDeliveryRequirement["readyLabel"] | NativeDeliveryRequirement["pendingLabel"]> {
  const rows = PUSH_NOTIFICATION_NATIVE_DELIVERY_REQUIREMENTS.map((requirement) => {
    const ready = evidence?.some((item) => nativeDeliveryEvidenceMatches(item, requirement)) ?? false;
    return [requirement.platform, ready ? requirement.readyLabel : requirement.pendingLabel] as const;
  });
  return Object.fromEntries(rows) as Record<
    PushNotificationsNativeDeliveryPlatform,
    NativeDeliveryRequirement["readyLabel"] | NativeDeliveryRequirement["pendingLabel"]
  >;
}

export function buildPushNotificationsProofManifest(
  input: PushNotificationsProofEvidence | null | undefined,
): PushNotificationsProofManifest {
  const evidence = input ?? {};
  const nativeDeliveryProof = summarizeNativeDeliveryEvidence(evidence.nativeDeliveryEvidence);
  const nativeDeliveryReady =
    nativeDeliveryProof.ios === "1/1 iOS APNs delivery proof ready" &&
    nativeDeliveryProof.android === "1/1 Android FCM delivery proof ready";
  const items = PUSH_NOTIFICATIONS_PROOF_ITEMS.map<PushNotificationsProofManifestItem>((item, index) => {
    const attached = clean(evidence[PUSH_NOTIFICATIONS_PROOF_EVIDENCE_KEYS[index]]);
    if (item.label === "Apple APNs credentials") {
      return {
        ...item,
        status: attached && nativeDeliveryProof.ios.startsWith("1/1") ? "ready" : "blocked",
        evidenceAttached: attached ? [attached, nativeDeliveryProof.ios] : [nativeDeliveryProof.ios],
      };
    }
    if (item.label === "Firebase and FCM credentials") {
      return {
        ...item,
        status: attached && nativeDeliveryProof.android.startsWith("1/1") ? "ready" : "blocked",
        evidenceAttached: attached ? [attached, nativeDeliveryProof.android] : [nativeDeliveryProof.android],
      };
    }
    if (item.label === "Reminder delivery QA and fallback") {
      const deliverySummary = nativeDeliveryReady ? "2/2 native delivery proofs ready" : "0/2 native delivery proofs ready";
      return {
        ...item,
        status: attached && nativeDeliveryReady ? "ready" : "blocked",
        evidenceAttached: attached ? [attached, deliverySummary] : [deliverySummary],
      };
    }
    return {
      ...item,
      status: attached ? "ready" : "blocked",
      evidenceAttached: attached ? [attached] : [],
    };
  });
  const readyCount = items.filter((item) => item.status === "ready").length;
  const totalCount = items.length;
  const openCount = totalCount - readyCount;
  const reminderDeliveryAllowed = openCount === 0;

  return {
    title: "Push notifications proof manifest",
    status: reminderDeliveryAllowed ? "ready-for-review" : "blocked",
    statusLabel: reminderDeliveryAllowed ? "Ready for notification provider review" : "Reminder delivery blocked",
    summary: reminderDeliveryAllowed
      ? "All push notification provider proof is attached for review before reminder delivery can be enabled."
      : "Reminder Center must stay local until Expo/APNs/FCM credentials, permission copy, quiet-hours opt-out behavior, and delivery QA proof are attached.",
    readyCount,
    openCount,
    totalCount,
    reminderDeliveryAllowed,
    items,
    blockers: items.filter((item) => item.status === "blocked").map((item) => `${item.label}: ${item.requiredEvidence}`),
  };
}

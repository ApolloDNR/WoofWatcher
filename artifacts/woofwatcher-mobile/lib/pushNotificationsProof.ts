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
      "APNs credentials, iOS device token proof, production entitlement profile, push environment, and TestFlight or device evidence that iOS registration succeeds.",
  },
  {
    label: "Firebase and FCM credentials",
    requiredEvidence:
      "Firebase/FCM credentials, Android delivery proof, Google services configuration, notification channel behavior, and production sender/project ownership.",
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
      "delivery QA, missed notification fallback, reminder-center recovery path, iOS and Android scheduled/delivered evidence, and support handoff for failed provider delivery.",
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

export function buildPushNotificationsProofManifest(
  input: PushNotificationsProofEvidence | null | undefined,
): PushNotificationsProofManifest {
  const evidence = input ?? {};
  const items = PUSH_NOTIFICATIONS_PROOF_ITEMS.map<PushNotificationsProofManifestItem>((item, index) => {
    const attached = clean(evidence[PUSH_NOTIFICATIONS_PROOF_EVIDENCE_KEYS[index]]);
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

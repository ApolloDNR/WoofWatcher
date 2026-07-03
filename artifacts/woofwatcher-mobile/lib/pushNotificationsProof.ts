export interface PushNotificationsProofItem {
  label: string;
  requiredEvidence: string;
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

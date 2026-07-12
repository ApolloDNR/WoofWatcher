import type { ReleasePacket } from "./releasePacket.ts";

export type StoreSubmissionItemStatus = "ready" | "needed" | "blocked";

export interface StoreSubmissionMetadata {
  appName: string;
  subtitle: string;
  shortDescription: string;
  fullDescription: string;
  category: string;
  contentBoundary: string;
}

export interface StoreScreenshotChecklistItem {
  screen: string;
  requirement: string;
  status: StoreSubmissionItemStatus;
}

export interface StoreSubmissionPacket {
  title: string;
  buildName: string;
  generatedAtLabel: string;
  submissionReady: boolean;
  verdictLabel: string;
  metadata: StoreSubmissionMetadata;
  keywords: string[];
  screenshotChecklist: StoreScreenshotChecklistItem[];
  reviewNotes: string[];
  privacyDisclosures: string[];
  blockedUntil: string[];
}

const KEYWORDS = [
  "dog care",
  "pet care",
  "dog tracker",
  "dog walking",
  "pet health",
  "care log",
  "pet records",
  "family pet",
  "dog routine",
  "puppy training",
];

function buildMetadata(appName: string): StoreSubmissionMetadata {
  return {
    appName,
    subtitle: "Real care. Pixel heart.",
    shortDescription: "Dog care, logs, records, and a living pixel care twin.",
    fullDescription: [
      `${appName} is a real-life dog care RPG for households who want everyday pet care to feel clear, coordinated, and alive.`,
      "Track meals, walks, potty breaks, medications, records, reports, sitter handoffs, and Health Watch patterns while your dog's pixel care twin reacts to real care.",
      "Built for shared households, sitters, trainers, and vet-prep handoffs, WoofWatcher keeps routines and logs connected so everyone can see what happened, what is next, and what still needs attention.",
      "Health Watch and Bile Watch organize owner observations and care history, but WoofWatcher is not veterinary advice, diagnosis, treatment, or emergency triage.",
    ].join("\n\n"),
    category: "Lifestyle / Health & Fitness",
    contentBoundary: "Dog care organization, household coordination, and owner-reviewed guidance only.",
  };
}

function buildScreenshotChecklist(submissionReady: boolean): StoreScreenshotChecklistItem[] {
  const status: StoreSubmissionItemStatus = submissionReady ? "ready" : "needed";
  return [
    {
      screen: "Phoenix Home",
      requirement: "Capture iOS and Android hero screenshots showing the pixel care twin, status meters, next action, and household presence.",
      status,
    },
    {
      screen: "Quick Log",
      requirement: "Capture quick tap logging plus detail-sheet behavior for meal lifecycle, potty outcomes, medication, and health logs.",
      status,
    },
    {
      screen: "Plans & Schedule",
      requirement: "Capture assigned routines, completed/open care, and responsibility clarity on iOS and Android.",
      status,
    },
    {
      screen: "Health Watch",
      requirement:
        "Capture non-diagnostic Health Watch, Bile Watch, the Review packet, Vet-share checklist, and Draft vet questions action.",
      status,
    },
    {
      screen: "Care Pass",
      requirement: "Capture vet/sitter handoff value without exposing private records or implying cloud sharing before provider approval.",
      status,
    },
    {
      screen: "Avatar Studio",
      requirement:
        "Capture the PixelLab avatar template/customization flow with Template overlay readiness, Template-fitted, and Pack pending accessory labels visible.",
      status,
    },
    {
      screen: "Privacy & Launch Gates",
      requirement: "Capture export, deletion request, support runbook, attachment queue, and launch-gate truth before submission.",
      status: submissionReady ? "ready" : "blocked",
    },
  ];
}

function buildReviewNotes(releasePacket: ReleasePacket): string[] {
  if (releasePacket.storeLaunchReady) {
    return [
      "Final owner sign-off is still required before uploading binaries or metadata to Apple App Store Connect or Google Play Console.",
      "Health Watch and Bile Watch organize owner observations only; WoofWatcher is not veterinary advice, diagnosis, treatment, or emergency triage.",
      "Confirm production auth, storage, AI, payments, push notifications, account deletion, support, and privacy policy URLs in the store consoles.",
    ];
  }

  return [
    "Not approved for App Store or Play Store submission. Use this packet for metadata and screenshot prep only until release blockers close.",
    "Health Watch and Bile Watch organize owner observations only; WoofWatcher is not veterinary advice, diagnosis, treatment, or emergency triage.",
    "WoofGuide copy must match the configured AI mode and keep owner review plus veterinary-boundary language visible.",
    "Storage, sync, payments, push notifications, and account deletion claims must match configured provider state.",
  ];
}

function buildPrivacyDisclosures(): string[] {
  return [
    "Care logs, routines, notes, household roles, and dog profile details may be stored to coordinate real pet care.",
    "Dog health observations, appetite, stool, vomiting, medication, weight, and vet-record notes may be stored for owner review and care-pass preparation.",
    "Photos, proof images, record documents, Adventure memories, and QA screenshots require explicit storage, export, and deletion rules before provider upload.",
    "AI assistant, notifications, payments, and cross-device sync must disclose provider use only after those services are configured.",
  ];
}

export function buildStoreSubmissionPacket(releasePacket: ReleasePacket): StoreSubmissionPacket {
  const appName = releasePacket.title.replace(/\s+Release Packet$/i, "").trim() || "WoofWatcher";
  const submissionReady = releasePacket.storeLaunchReady && releasePacket.blockers.length === 0;

  return {
    title: `${appName} Store Submission Packet`,
    buildName: releasePacket.buildName,
    generatedAtLabel: releasePacket.generatedAtLabel,
    submissionReady,
    verdictLabel: submissionReady ? "Ready for store submission prep" : "Submission prep only",
    metadata: buildMetadata(appName),
    keywords: [...KEYWORDS],
    screenshotChecklist: buildScreenshotChecklist(submissionReady),
    reviewNotes: buildReviewNotes(releasePacket),
    privacyDisclosures: buildPrivacyDisclosures(),
    blockedUntil: submissionReady ? [] : [...releasePacket.blockers],
  };
}

function formatList(items: readonly string[], fallback: string): string {
  if (!items.length) return `- ${fallback}`;
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildStoreSubmissionPacketShareText(packet: StoreSubmissionPacket): string {
  return [
    packet.title,
    `Build: ${packet.buildName}`,
    `Generated: ${packet.generatedAtLabel}`,
    `Verdict: ${packet.verdictLabel}`,
    "",
    "Metadata draft:",
    `Short description: ${packet.metadata.shortDescription}`,
    `Subtitle: ${packet.metadata.subtitle}`,
    `Category: ${packet.metadata.category}`,
    `Keywords: ${packet.keywords.join(", ")}`,
    "",
    "Review notes:",
    formatList(packet.reviewNotes, "Final owner review required before submission."),
    "",
    "Screenshot checklist:",
    formatList(
      packet.screenshotChecklist.map((item) => `${item.screen}: ${item.status} - ${item.requirement}`),
      "No screenshots listed.",
    ),
    "",
    "Privacy disclosures:",
    formatList(packet.privacyDisclosures, "Privacy disclosures require owner review."),
    "",
    "Blocked until:",
    formatList(packet.blockedUntil, "No launch blockers in this packet."),
  ].join("\n");
}

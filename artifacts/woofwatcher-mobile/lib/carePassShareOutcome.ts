import type { ShareTextOutcome } from "./shareTextOutcome.ts";

const SAVED_CARE_PASS_SHARE_ANNOUNCEMENTS: Record<ShareTextOutcome, string> = {
  shared: "Care Pass saved to Report History and shared.",
  copied:
    "Care Pass saved to Report History and copied to the clipboard. Treat the clipboard as private care data.",
  downloaded:
    "Care Pass saved to Report History and its download started. Store the file only in a trusted location.",
  dismissed:
    "Care Pass saved to Report History. The share sheet closed without sharing.",
  unconfirmed:
    "Care Pass saved to Report History. Android cannot confirm whether it was sent or saved.",
  "not-completed":
    "Care Pass saved to Report History. Sharing was not completed; the sheet may have closed, or no share target was available.",
  failed:
    "Care Pass saved to Report History, but sharing could not be confirmed. You can retry from Report History.",
};

export function buildSavedCarePassShareAnnouncement(
  outcome: ShareTextOutcome,
): string {
  return SAVED_CARE_PASS_SHARE_ANNOUNCEMENTS[outcome];
}

export interface SavedCarePassShareSession {
  pending: boolean;
  saved: boolean;
}

interface SavedCarePassShareDependencies {
  save: () => boolean;
  share: () => Promise<ShareTextOutcome>;
  present: (message: string) => void;
}

export type SavedCarePassShareRunResult =
  | { status: "in-flight" }
  | { status: "save-blocked" }
  | {
      status: "completed";
      outcome: ShareTextOutcome;
      message: string;
    };

export function createSavedCarePassShareSession(): SavedCarePassShareSession {
  return { pending: false, saved: false };
}

export async function runSavedCarePassShare(
  session: SavedCarePassShareSession,
  dependencies: SavedCarePassShareDependencies,
): Promise<SavedCarePassShareRunResult> {
  if (session.pending) return { status: "in-flight" };

  session.pending = true;
  try {
    if (!session.saved) {
      if (!dependencies.save()) return { status: "save-blocked" };
      session.saved = true;
    }

    const outcome = await dependencies.share();
    const message = buildSavedCarePassShareAnnouncement(outcome);
    dependencies.present(message);
    return { status: "completed", outcome, message };
  } finally {
    session.pending = false;
  }
}

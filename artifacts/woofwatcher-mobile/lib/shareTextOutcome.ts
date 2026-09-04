export type ShareTextOutcome =
  | "shared"
  | "dismissed"
  | "unconfirmed"
  | "not-completed"
  | "copied"
  | "downloaded"
  | "failed";

export interface ShareResultDialogOptions {
  presentResultDialogs?: boolean;
}

export function presentShareResultDialog(
  options: ShareResultDialogOptions,
  notify: (title: string, message: string) => void,
  title: string,
  message: string,
): void {
  if (options.presentResultDialogs !== false) {
    notify(title, message);
  }
}

export function classifyNativeShareAction(
  action: unknown,
  platform: string,
): Extract<
  ShareTextOutcome,
  "shared" | "dismissed" | "unconfirmed" | "failed"
> {
  if (action === "sharedAction") {
    return platform === "android" ? "unconfirmed" : "shared";
  }
  if (action === "dismissedAction") return "dismissed";
  return "failed";
}

export function classifyWebShareError(
  error: unknown,
): Extract<ShareTextOutcome, "not-completed" | "failed"> {
  return (error as { name?: unknown } | null)?.name === "AbortError"
    ? "not-completed"
    : "failed";
}

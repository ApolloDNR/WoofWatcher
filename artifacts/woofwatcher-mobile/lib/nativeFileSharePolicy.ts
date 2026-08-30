export interface NativeFileSharePolicyPayload {
  readonly url?: string;
}

export type NativeFileShareOutcome = "shared" | "dismissed";

export function classifyNativeFileShareResult(
  _platform: string,
  result: { readonly action?: string },
  dismissedAction: string,
): NativeFileShareOutcome {
  return result.action === dismissedAction ? "dismissed" : "shared";
}

export type NativeFileShareDecision =
  | { supported: true }
  | {
      supported: false;
      reason: "android-url-attachment-unsupported";
    };

/**
 * React Native's core Share API supports a URL attachment on iOS, while its
 * Android payload contract shares text. Refuse the Android URL path so the UI
 * can use an honest saved-file/text fallback instead of claiming attachment.
 */
export function decideNativeFileShare(
  platform: string,
  payload: NativeFileSharePolicyPayload,
): NativeFileShareDecision {
  if (platform === "android" && typeof payload.url === "string") {
    return {
      supported: false,
      reason: "android-url-attachment-unsupported",
    };
  }
  return { supported: true };
}

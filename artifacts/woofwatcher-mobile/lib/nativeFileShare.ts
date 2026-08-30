import { Platform, Share } from "react-native";

import type { NativeRecordsFileShareContent } from "./recordsFileShareActions.ts";
import {
  classifyNativeFileShareResult,
  decideNativeFileShare,
  type NativeFileShareOutcome,
} from "./nativeFileSharePolicy.ts";

export class NativeFileAttachmentUnsupportedError extends Error {
  constructor() {
    super("This native share API cannot attach the saved file on Android.");
    this.name = "NativeFileAttachmentUnsupportedError";
  }
}

export async function shareNativeFilePayload(
  payload: NativeRecordsFileShareContent,
): Promise<NativeFileShareOutcome> {
  const decision = decideNativeFileShare(Platform.OS, payload);
  if (!decision.supported) {
    throw new NativeFileAttachmentUnsupportedError();
  }
  const result = await Share.share(payload);
  return classifyNativeFileShareResult(
    Platform.OS,
    result,
    Share.dismissedAction,
  );
}

import { Share } from "react-native";

import type { NativeRecordsFileShareContent } from "./recordsFileShareActions.ts";

export async function shareNativeFilePayload(
  payload: NativeRecordsFileShareContent,
): Promise<void> {
  await Share.share(payload);
}

import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import type { AppFileSystemAdapter } from "./appFileSystem.ts";

export function createExpoAppFileSystemAdapter(): AppFileSystemAdapter {
  return {
    platform: Platform.OS,
    documentDirectory: FileSystem.documentDirectory,
    getInfoAsync: (uri) => FileSystem.getInfoAsync(uri),
    makeDirectoryAsync: (uri, options) =>
      FileSystem.makeDirectoryAsync(uri, options),
    copyAsync: (options) => FileSystem.copyAsync(options),
    writeAsStringAsync: (uri, content, options) =>
      FileSystem.writeAsStringAsync(uri, content, {
        encoding:
          options.encoding === "base64"
            ? FileSystem.EncodingType.Base64
            : FileSystem.EncodingType.UTF8,
      }),
    getContentUriAsync: (uri) => FileSystem.getContentUriAsync(uri),
  };
}

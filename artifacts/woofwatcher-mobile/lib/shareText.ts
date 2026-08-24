import { Platform, Share } from "react-native";

import { notifyDialog } from "./confirmDialog.ts";
import { classifyNativeFileShareResult } from "./nativeFileSharePolicy.ts";

/**
 * Cross-platform text sharing: native uses the OS share sheet; web tries
 * the Web Share API, then falls back to the clipboard, then to a plain
 * text-file download. react-native-web's Share.share rejects wherever
 * navigator.share is missing, which silently killed every share/export
 * button in web builds — this helper guarantees a real outcome everywhere.
 */

export type ShareTextOutcome =
  | "shared"
  | "dismissed"
  | "copied"
  | "downloaded"
  | "failed";

export interface ShareTextPayload {
  title: string;
  message: string;
}

export interface ShareTextOptions {
  /** Let a higher-level flow own the single failure presentation. */
  notifyOnFailure?: boolean;
}

interface WebShareGlobals {
  navigator?: {
    share?: (data: { title?: string; text?: string }) => Promise<void>;
    clipboard?: { writeText?: (text: string) => Promise<void> };
  };
  document?: {
    createElement: (tag: string) => {
      href: string;
      download: string;
      click: () => void;
    };
  };
  URL?: {
    createObjectURL: (blob: unknown) => string;
    revokeObjectURL: (url: string) => void;
  };
  Blob?: new (parts: string[], options: { type: string }) => unknown;
}

export function shareFileNameForTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "woofwatcher-share"}.txt`;
}

async function shareOnWeb(
  payload: ShareTextPayload,
  options: ShareTextOptions,
): Promise<ShareTextOutcome> {
  const g = globalThis as WebShareGlobals;

  if (typeof g.navigator?.share === "function") {
    try {
      await g.navigator.share({ title: payload.title, text: payload.message });
      return "shared";
    } catch (error) {
      // A deliberate cancel is a completed decision, not a failure to
      // route around — only unsupported payloads fall through.
      if ((error as { name?: string })?.name === "AbortError") {
        return "dismissed";
      }
    }
  }

  if (typeof g.navigator?.clipboard?.writeText === "function") {
    try {
      await g.navigator.clipboard.writeText(
        `${payload.title}\n\n${payload.message}`,
      );
      notifyDialog("Copied to clipboard", `${payload.title} is ready to paste.`);
      return "copied";
    } catch {
      // Clipboard can be blocked; fall through to the download.
    }
  }

  try {
    if (g.Blob && g.URL && g.document) {
      const blob = new g.Blob([`${payload.title}\n\n${payload.message}`], {
        type: "text/plain",
      });
      const url = g.URL.createObjectURL(blob);
      const anchor = g.document.createElement("a");
      anchor.href = url;
      anchor.download = shareFileNameForTitle(payload.title);
      anchor.click();
      g.URL.revokeObjectURL(url);
      return "downloaded";
    }
  } catch {
    // Nothing else to try on this platform.
  }

  if (options.notifyOnFailure !== false) {
    notifyDialog("Sharing unavailable", "This browser blocked sharing, clipboard, and downloads.");
  }
  return "failed";
}

export async function shareTextPayload(
  payload: ShareTextPayload,
  options: ShareTextOptions = {},
): Promise<ShareTextOutcome> {
  if (Platform.OS === "web") {
    return shareOnWeb(payload, options);
  }
  try {
    const result = await Share.share({
      title: payload.title,
      message: payload.message,
    });
    return classifyNativeFileShareResult(
      Platform.OS,
      result,
      Share.dismissedAction,
    );
  } catch {
    if (options.notifyOnFailure !== false) {
      notifyDialog("Sharing unavailable", "The device share sheet could not open.");
    }
    return "failed";
  }
}

import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { useLocalDataReset } from "@/context/LocalDataResetContext";
import {
  createWebRuntimeLocalDataResetController,
  type WebRuntimeCacheStorage,
  type WebRuntimeLocalDataResetController,
} from "@/lib/webRuntimeLocalDataReset";

const CLEAR_REQUEST = "woofwatcher:clear-local-data";
const CLEAR_COMPLETE = "woofwatcher:clear-local-data:complete";

interface WebRuntimeGlobals {
  caches?: WebRuntimeCacheStorage;
  navigator?: {
    serviceWorker?: {
      controller?: {
        postMessage(message: unknown, transfer: unknown[]): void;
      } | null;
    };
  };
  MessageChannel?: new () => {
    port1: {
      onmessage: ((event: { data?: { type?: string } }) => void) | null;
      close(): void;
    };
    port2: { close(): void };
  };
}

function requestServiceWorkerClear(): Promise<void> {
  if (Platform.OS !== "web") return Promise.resolve();
  const globals = globalThis as unknown as WebRuntimeGlobals;
  const controller = globals.navigator?.serviceWorker?.controller;
  if (!controller) return Promise.resolve();
  if (!globals.MessageChannel) {
    return Promise.reject(
      new Error("Service-worker cache clearing cannot be acknowledged."),
    );
  }

  return new Promise<void>((resolve, reject) => {
    const channel = new globals.MessageChannel!();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      channel.port1.close();
      channel.port2.close();
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(
      () => finish(new Error("Service-worker cache clearing timed out.")),
      3_000,
    );
    channel.port1.onmessage = (event) => {
      finish(
        event.data?.type === CLEAR_COMPLETE
          ? undefined
          : new Error("Service worker reported a cache-clearing failure."),
      );
    };
    try {
      controller.postMessage({ type: CLEAR_REQUEST }, [channel.port2]);
    } catch (error) {
      finish(
        error instanceof Error
          ? error
          : new Error("Service-worker message failed."),
      );
    }
  });
}

export function WebRuntimeLocalDataResetProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { attachRequiredParticipant } = useLocalDataReset();
  const controllerRef = useRef<WebRuntimeLocalDataResetController | null>(null);
  if (controllerRef.current === null) {
    const globals = globalThis as unknown as WebRuntimeGlobals;
    controllerRef.current = createWebRuntimeLocalDataResetController({
      platform: Platform.OS,
      cacheStorage: Platform.OS === "web" ? (globals.caches ?? null) : null,
      requestServiceWorkerClear,
    });
  }

  useEffect(
    () =>
      attachRequiredParticipant(
        "web-runtime",
        controllerRef.current!.participant,
      ),
    [attachRequiredParticipant],
  );

  return <>{children}</>;
}

import React, { createContext, useContext, useEffect, useRef } from "react";

import { useLocalDataReset } from "@/context/LocalDataResetContext";
import {
  createAppFileSystem,
  type AppFileSystem,
} from "@/lib/appFileSystem";
import { createExpoAppFileSystemAdapter } from "@/lib/expoAppFileSystem";

const AppFileSystemContext = createContext<AppFileSystem | null>(null);

export function AppFileSystemProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const {
    captureLocalDataIntent,
    isLocalDataIntentCurrent,
    runTrackedLocalDataWork,
    drainTrackedLocalDataWork,
    attachRequiredParticipant,
  } = useLocalDataReset();
  const fileSystemRef = useRef<AppFileSystem | null>(null);
  if (fileSystemRef.current === null) {
    fileSystemRef.current = createAppFileSystem({
      adapter: createExpoAppFileSystemAdapter(),
      intentAuthority: Object.freeze({
        capture: captureLocalDataIntent,
        isCurrent: isLocalDataIntentCurrent,
      }),
      runTrackedLocalDataWork,
      drainTrackedLocalDataWork,
    });
  }

  useEffect(
    () => attachRequiredParticipant(
      "files",
      fileSystemRef.current!.localDataResetParticipant,
    ),
    [attachRequiredParticipant],
  );

  return (
    <AppFileSystemContext.Provider value={fileSystemRef.current}>
      {children}
    </AppFileSystemContext.Provider>
  );
}

export function useAppFileSystem(): AppFileSystem {
  const value = useContext(AppFileSystemContext);
  if (!value) {
    throw new Error("useAppFileSystem must be used within AppFileSystemProvider.");
  }
  return value;
}

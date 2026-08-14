import React, { createContext, useContext, useMemo, useRef } from "react";

import { useLocalDataReset } from "@/context/LocalDataResetContext";
import {
  createDevicePreferencesStore,
  type DevicePreferencesStore,
} from "@/lib/devicePreferences";

export interface DevicePreferencesContextValue {
  store: DevicePreferencesStore;
  operationSettledEpoch: number;
}

const DevicePreferencesContext =
  createContext<DevicePreferencesContextValue | null>(null);

export function DevicePreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const {
    removableStorage,
    operationSettledEpoch,
    runTrackedLocalDataWork,
  } = useLocalDataReset();
  const storeRef = useRef<DevicePreferencesStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createDevicePreferencesStore(removableStorage, {
      runTrackedHydration: runTrackedLocalDataWork,
    });
  }
  const store = storeRef.current;
  const value = useMemo<DevicePreferencesContextValue>(
    () => ({ store, operationSettledEpoch }),
    [operationSettledEpoch, store],
  );

  return (
    <DevicePreferencesContext.Provider value={value}>
      {children}
    </DevicePreferencesContext.Provider>
  );
}

export function useDevicePreferences(): DevicePreferencesContextValue {
  const value = useContext(DevicePreferencesContext);
  if (!value) {
    throw new Error(
      "useDevicePreferences must be used within DevicePreferencesProvider.",
    );
  }
  return value;
}

import React, { createContext, useContext, useMemo, useState } from "react";

export type PrivacyEraseStage =
  | "confirm"
  | "confirm-final"
  | "done"
  | "cancelled"
  | "failed"
  | null;

interface PrivacyEraseFlowContextValue {
  eraseStage: PrivacyEraseStage;
  setEraseStage: React.Dispatch<React.SetStateAction<PrivacyEraseStage>>;
  erasing: boolean;
  setErasing: React.Dispatch<React.SetStateAction<boolean>>;
}

const PrivacyEraseFlowContext =
  createContext<PrivacyEraseFlowContextValue | null>(null);

/**
 * Lives above Avatar's exact dog-scoped session boundary so a completed
 * owner wipe can keep its confirmation visible while Avatar remounts from a
 * deleted secondary dog to the fresh primary profile.
 */
export function PrivacyEraseFlowProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [eraseStage, setEraseStage] = useState<PrivacyEraseStage>(null);
  const [erasing, setErasing] = useState(false);
  const value = useMemo(
    () => ({ eraseStage, setEraseStage, erasing, setErasing }),
    [eraseStage, erasing],
  );

  return (
    <PrivacyEraseFlowContext.Provider value={value}>
      {children}
    </PrivacyEraseFlowContext.Provider>
  );
}

export function usePrivacyEraseFlow() {
  const context = useContext(PrivacyEraseFlowContext);
  if (!context) {
    throw new Error(
      "usePrivacyEraseFlow must be used within PrivacyEraseFlowProvider",
    );
  }
  return context;
}

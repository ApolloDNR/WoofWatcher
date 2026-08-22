import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useLocalDataReset } from "@/context/LocalDataResetContext";
import { useWoofAuth } from "@/lib/auth";
import {
  createPersonalQueryObserverShield,
  createQueryCacheLocalDataResetController,
  type QueryCacheLocalDataResetController,
  type QueryCacheResetIdentityState,
} from "@/lib/queryCacheLocalDataReset";

export interface QueryCacheLocalDataResetContextValue {
  attachPersonalQueryObserverShieldHost(): () => void;
  subscribeToPersonalQueryObserverShield(listener: () => void): () => void;
  isPersonalQueryObserverShieldRequested(): boolean;
  confirmPersonalQueryObserversHidden(): void;
  releasePersonalQueryObserverShield(): void;
}

const QueryCacheLocalDataResetContext =
  createContext<QueryCacheLocalDataResetContextValue | null>(null);

export function QueryCacheLocalDataResetProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const { isLoaded, userId, sessionId } = useWoofAuth();
  const { attachRequiredParticipant } = useLocalDataReset();
  const identityRef = useRef<QueryCacheResetIdentityState>({
    isLoaded: Boolean(isLoaded),
    userId: userId ?? null,
    sessionId: sessionId ?? null,
  });
  identityRef.current = {
    isLoaded: Boolean(isLoaded),
    userId: userId ?? null,
    sessionId: sessionId ?? null,
  };

  const shieldRef = useRef<ReturnType<
    typeof createPersonalQueryObserverShield
  > | null>(null);
  if (shieldRef.current === null) {
    shieldRef.current = createPersonalQueryObserverShield();
  }
  const shield = shieldRef.current;

  const controllerRef = useRef<QueryCacheLocalDataResetController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createQueryCacheLocalDataResetController({
      getIdentity: () => identityRef.current,
      waitUntilPersonalQueryConsumersUnmounted: shield.requestAndWait,
      cancelQueries: () =>
        queryClient.cancelQueries(undefined, { revert: true, silent: true }),
      clearQueryAndMutationCaches: () => queryClient.clear(),
    });
  }
  const controller = controllerRef.current;

  useEffect(
    () => attachRequiredParticipant("query-cache", controller.participant),
    [attachRequiredParticipant, controller],
  );

  const value = useMemo<QueryCacheLocalDataResetContextValue>(
    () => ({
      attachPersonalQueryObserverShieldHost: shield.attachHost,
      subscribeToPersonalQueryObserverShield: shield.subscribe,
      isPersonalQueryObserverShieldRequested: shield.isRequested,
      confirmPersonalQueryObserversHidden:
        shield.confirmPersonalObserversHidden,
      releasePersonalQueryObserverShield: shield.release,
    }),
    [shield],
  );

  return (
    <QueryCacheLocalDataResetContext.Provider value={value}>
      {children}
    </QueryCacheLocalDataResetContext.Provider>
  );
}

export function useQueryCacheLocalDataReset(): QueryCacheLocalDataResetContextValue {
  const value = useContext(QueryCacheLocalDataResetContext);
  if (!value) {
    throw new Error(
      "useQueryCacheLocalDataReset must be used within QueryCacheLocalDataResetProvider.",
    );
  }
  return value;
}

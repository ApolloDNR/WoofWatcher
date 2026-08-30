import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import { useLocalDataReset } from "@/context/LocalDataResetContext";
import { useWoofAuth } from "@/lib/auth";
import {
  createPersonalQueryObserverShield,
  createQueryCacheAuthTransitionController,
  createQueryCacheLocalDataResetController,
  type QueryCacheAuthTransitionController,
  type QueryCacheAuthTransitionSnapshot,
  type QueryCacheLocalDataResetController,
  type QueryCacheResetIdentityState,
} from "@/lib/queryCacheLocalDataReset";

export interface QueryCacheLocalDataResetContextValue {
  attachPersonalQueryObserverShieldHost(): () => void;
  subscribeToPersonalQueryObserverShield(listener: () => void): () => void;
  isPersonalQueryObserverShieldRequested(): boolean;
  confirmPersonalQueryObserversHidden(): void;
  releasePersonalQueryObserverShield(): void;
  authTransition: QueryCacheAuthTransitionSnapshot;
  observeAuthDataScopeKey(
    dataScopeKey: string | null,
  ): QueryCacheAuthTransitionSnapshot;
  confirmAuthTransitionObserversHidden(revision: number): void;
  runAuthTransition(): Promise<void>;
  retryAuthTransition(): Promise<void>;
  prepareHouseholdTransition(expectedDataScopeKey: string): Promise<void>;
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
  const { attachRequiredParticipant, drainTrackedLocalDataWork } =
    useLocalDataReset();
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

  const authTransitionControllerRef =
    useRef<QueryCacheAuthTransitionController | null>(null);
  if (authTransitionControllerRef.current === null) {
    authTransitionControllerRef.current =
      createQueryCacheAuthTransitionController({
        cancelQueries: () =>
          queryClient.cancelQueries(undefined, {
            revert: true,
            silent: true,
          }),
        drainMutations: drainTrackedLocalDataWork,
        clearQueryAndMutationCaches: () => queryClient.clear(),
      });
  }
  const authTransitionController = authTransitionControllerRef.current;
  const authTransition = authTransitionController.observeIdentity(
    identityRef.current,
  );
  const [, renderAuthTransitionEpoch] = useReducer(
    (epoch: number) => epoch + 1,
    0,
  );

  useEffect(
    () => authTransitionController.subscribe(renderAuthTransitionEpoch),
    [authTransitionController],
  );

  // The descendant auth boundary renders no personal screens while blocked.
  // Layout effects run after React's mutation phase, so this acknowledgement
  // is later than every observer cleanup from that same identity change.
  useLayoutEffect(() => {
    if (authTransition.status === "blocked") {
      authTransitionController.confirmPersonalObserversHidden(
        authTransition.revision,
      );
    }
  }, [authTransition, authTransitionController]);

  useEffect(() => {
    if (authTransition.status !== "blocked") return;
    void authTransitionController.runCurrentTransition().catch(() => {
      // The controller publishes a retryable failed state. Keeping the
      // boundary mounted and blocked is the fail-closed behavior.
    });
  }, [authTransition, authTransitionController]);

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
      authTransition,
      observeAuthDataScopeKey: authTransitionController.observeDataScopeKey,
      confirmAuthTransitionObserversHidden:
        authTransitionController.confirmPersonalObserversHidden,
      runAuthTransition: authTransitionController.runCurrentTransition,
      retryAuthTransition: authTransitionController.retryCurrentTransition,
      prepareHouseholdTransition:
        authTransitionController.prepareHouseholdTransition,
    }),
    [authTransition, authTransitionController, shield],
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

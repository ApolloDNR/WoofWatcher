import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { useLocalDataReset } from "@/context/LocalDataResetContext";
import { isClerkEnabledForBuild, useWoofAuth } from "@/lib/auth";
import {
  clearKnownClerkWebStorage,
  createAuthCredentialsLocalDataResetController,
  type AuthCredentialsLocalDataResetController,
  type AuthCredentialsResetState,
} from "@/lib/authCredentialsLocalDataReset";

const clerkSecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} satisfies SecureStore.SecureStoreOptions;

export function AuthCredentialsLocalDataResetProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { attachRequiredParticipant } = useLocalDataReset();
  const auth = useWoofAuth();
  const authRef = useRef<AuthCredentialsResetState>({
    isLoaded: Boolean(auth.isLoaded),
    isSignedIn: Boolean(auth.isSignedIn),
    signOut: () => auth.signOut(),
  });
  authRef.current = {
    isLoaded: Boolean(auth.isLoaded),
    isSignedIn: Boolean(auth.isSignedIn),
    signOut: () => auth.signOut(),
  };

  const controllerRef = useRef<AuthCredentialsLocalDataResetController | null>(
    null,
  );
  if (controllerRef.current === null) {
    controllerRef.current = createAuthCredentialsLocalDataResetController({
      getAuthState: () => authRef.current,
      async clearToken(key) {
        if (Platform.OS === "web") {
          throw new Error(
            "Native Clerk credential cleanup was invoked on web.",
          );
        }
        await SecureStore.deleteItemAsync(key, clerkSecureStoreOptions);
      },
      web:
        Platform.OS === "web"
          ? {
              providerSignOutAvailable: isClerkEnabledForBuild,
              async clearJsReadableStorage() {
                if (typeof window === "undefined") {
                  throw new Error("Clerk browser storage is unavailable.");
                }
                clearKnownClerkWebStorage(
                  window.localStorage,
                  window.sessionStorage,
                );
              },
            }
          : undefined,
    });
  }

  useEffect(
    () =>
      attachRequiredParticipant(
        "auth-credentials",
        controllerRef.current!.participant,
      ),
    [attachRequiredParticipant],
  );

  return <>{children}</>;
}

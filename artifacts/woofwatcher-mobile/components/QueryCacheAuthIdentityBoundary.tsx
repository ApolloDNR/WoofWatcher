import React, { useEffect, useLayoutEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useQueryCacheLocalDataReset } from "@/context/QueryCacheLocalDataResetContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { CARE_READ_ONLY_MESSAGE } from "@/lib/careWriteProtection";
import { MIN_MOBILE_TOUCH_TARGET } from "@/lib/mobileLayout";

/**
 * Keeps personal query consumers unmounted until the singleton QueryClient is
 * safe for the currently loaded auth identity.
 */
export function QueryCacheAuthIdentityBoundary({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const colors = useColors();
  const {
    identityScopeKey,
    identityScopeStatus,
    initialSyncStatus,
    storageWarning,
    retryIdentityScope,
    retryInitialSync,
    retryLocalHydration,
  } = useCare();
  const {
    observeAuthDataScopeKey,
    confirmAuthTransitionObserversHidden,
    runAuthTransition,
    retryAuthTransition,
  } = useQueryCacheLocalDataReset();
  const authTransition = observeAuthDataScopeKey(identityScopeKey);

  useLayoutEffect(() => {
    if (authTransition.status === "blocked") {
      confirmAuthTransitionObserversHidden(authTransition.revision);
    }
  }, [authTransition, confirmAuthTransitionObserversHidden]);

  useEffect(() => {
    if (authTransition.status !== "blocked") return;
    void runAuthTransition().catch(() => {
      // The controller publishes a retryable failed state and the boundary
      // keeps personal descendants unmounted.
    });
  }, [authTransition, runAuthTransition]);

  const localHydrationFailed = storageWarning === "read-failed";
  const futureSchemaBlocked = storageWarning === "newer-version";
  const identityScopeReady =
    (identityScopeStatus.state === "local" ||
      identityScopeStatus.state === "resolved") &&
    initialSyncStatus.isSettled &&
    !localHydrationFailed &&
    !futureSchemaBlocked;
  if (authTransition.status === "admitted" && identityScopeReady) {
    return <>{children}</>;
  }

  const cacheFailed = authTransition.status === "failed";
  const identityScopeFailed = identityScopeStatus.state === "error";
  const initialSyncFailed =
    identityScopeStatus.state === "resolved" &&
    initialSyncStatus.state === "error";
  const initialSyncPending =
    (identityScopeStatus.state === "local" ||
      identityScopeStatus.state === "resolved") &&
    !initialSyncStatus.isSettled &&
    !localHydrationFailed &&
    !futureSchemaBlocked &&
    !initialSyncFailed;
  const failed =
    cacheFailed ||
    identityScopeFailed ||
    localHydrationFailed ||
    futureSchemaBlocked ||
    initialSyncFailed;
  const title = cacheFailed
    ? "Account data protection needs attention"
    : identityScopeFailed
      ? "Account check needs attention"
      : localHydrationFailed
        ? "Local care data needs attention"
        : futureSchemaBlocked
          ? "WoofWatcher update required"
          : initialSyncFailed
            ? "Care refresh needs attention"
            : authTransition.status === "loading" ||
                identityScopeStatus.state === "pending"
              ? "Checking your account…"
              : initialSyncPending
                ? identityScopeStatus.state === "local"
                  ? "Loading local care data…"
                  : "Refreshing care records…"
                : "Securing account data…";
  const message = cacheFailed
    ? "WoofWatcher could not safely prepare the private account cache. Retry before continuing."
    : identityScopeFailed
      ? (identityScopeStatus.message ??
        "WoofWatcher could not verify the current household. Try again.")
      : localHydrationFailed
        ? "WoofWatcher could not safely read the local Care cache. Retry before continuing."
        : futureSchemaBlocked
          ? CARE_READ_ONLY_MESSAGE
          : initialSyncFailed
            ? (initialSyncStatus.message ??
              "WoofWatcher could not confirm the current household records. Try again.")
            : initialSyncPending
              ? identityScopeStatus.state === "local"
                ? "Personal screens will reopen after local Care data is safely loaded."
                : "Personal screens will reopen after the current household records are refreshed."
              : "Personal screens will reopen after account requests settle and the private cache is ready.";
  const canRetry =
    cacheFailed ||
    (identityScopeFailed && identityScopeStatus.retryable) ||
    localHydrationFailed ||
    (initialSyncFailed && initialSyncStatus.retryable);
  const retryLabel = cacheFailed
    ? "Retry securing account data"
    : identityScopeFailed
      ? "Retry account check"
      : localHydrationFailed
        ? "Retry loading local care data"
        : "Retry care refresh";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { backgroundColor: colors.background },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: failed ? colors.rose : colors.border,
          },
        ]}
      >
        <View
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${message}`}
          style={styles.alertContent}
        >
          {!failed ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : null}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {title}
          </Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            {message}
          </Text>
        </View>
        {canRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={retryLabel}
            onPress={() => {
              if (cacheFailed) {
                void retryAuthTransition().catch(() => {
                  // The controller republishes `failed`; keeping the promise
                  // observed prevents a repeated cleanup failure from
                  // surfacing as an unhandled rejection/redbox.
                });
              } else if (identityScopeFailed) {
                retryIdentityScope();
              } else if (localHydrationFailed) {
                retryLocalHydration();
              } else {
                retryInitialSync();
              }
            }}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            <Text
              style={[styles.retryText, { color: colors.primaryForeground }]}
            >
              Retry
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    gap: 14,
  },
  alertContent: {
    width: "100%",
    alignItems: "center",
    gap: 14,
  },
  title: {
    fontFamily: "Fredoka_700Bold",
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
  },
  message: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  retryButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    minWidth: 160,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 15,
    flexShrink: 1,
    textAlign: "center",
  },
});

import React, {
  useCallback,
  useLayoutEffect,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useLocalDataReset } from "@/context/LocalDataResetContext";
import { useQueryCacheLocalDataReset } from "@/context/QueryCacheLocalDataResetContext";
import { useColors } from "@/hooks/useColors";
import {
  getPrivacyLocalDataResetView,
  runPrivacyLocalDataReset,
} from "@/lib/privacyLocalDataActions";

export function LocalDataResetAppShield({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const colors = useColors();
  const { operationState, runReset, clearResult } = useLocalDataReset();
  const {
    attachPersonalQueryObserverShieldHost,
    subscribeToPersonalQueryObserverShield,
    isPersonalQueryObserverShieldRequested,
    confirmPersonalQueryObserversHidden,
    releasePersonalQueryObserverShield,
  } = useQueryCacheLocalDataReset();
  const shieldRequested = useSyncExternalStore(
    subscribeToPersonalQueryObserverShield,
    isPersonalQueryObserverShieldRequested,
    isPersonalQueryObserverShieldRequested,
  );
  const resetView = getPrivacyLocalDataResetView(operationState);
  const hidePersonalScreens = shieldRequested || resetView.status !== "hidden";

  useLayoutEffect(
    () => attachPersonalQueryObserverShieldHost(),
    [attachPersonalQueryObserverShieldHost],
  );
  useLayoutEffect(() => {
    if (hidePersonalScreens && shieldRequested) {
      confirmPersonalQueryObserversHidden();
    }
  }, [
    confirmPersonalQueryObserversHidden,
    hidePersonalScreens,
    shieldRequested,
  ]);

  const leaveTerminalState = useCallback(() => {
    clearResult();
    releasePersonalQueryObserverShield();
  }, [clearResult, releasePersonalQueryObserverShield]);

  if (!hidePersonalScreens) return <>{children}</>;

  if (resetView.status === "complete") {
    return (
      <View
        accessibilityRole="alert"
        accessibilityLabel="All data deleted"
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.eyebrow, { color: colors.sage }]}>
            DELETE COMPLETE
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {resetView.title}
          </Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            WoofWatcher has been reset to a fresh household on this device.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue after local data deletion"
            onPress={leaveTerminalState}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: colors.primaryForeground },
              ]}
            >
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (resetView.status === "failed") {
    return (
      <View
        accessibilityRole="alert"
        accessibilityLabel="Local data deletion needs attention"
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.rose },
          ]}
        >
          <Text style={[styles.eyebrow, { color: colors.rose }]}>
            DELETION NEEDS ATTENTION
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {resetView.title}
          </Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            WoofWatcher could not verify every local-data owner. Retry now, or
            return and keep the categories below for support.
          </Text>
          <View style={styles.failureList}>
            {resetView.failures.map((failure) => (
              <Text
                key={failure.id}
                accessibilityLabel={`${failure.label}. Failed owner ID: ${failure.id}`}
                style={[
                  styles.failureRow,
                  { color: colors.foreground, borderColor: colors.border },
                ]}
              >
                {failure.label} · {failure.id}
              </Text>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry deleting all local data"
            onPress={() => {
              void runPrivacyLocalDataReset(runReset);
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.rose, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Text style={styles.destructiveButtonText}>Retry deletion</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return without claiming deletion succeeded"
            onPress={leaveTerminalState}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Text
              style={[styles.secondaryButtonText, { color: colors.foreground }]}
            >
              Return
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel="Deleting all local WoofWatcher data"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.title, { color: colors.foreground }]}>
          {resetView.status === "deleting"
            ? resetView.title
            : "Deleting local data…"}
        </Text>
        <Text style={[styles.message, { color: colors.mutedForeground }]}>
          WoofWatcher is closing active care work and verifying every local-data
          owner before showing a result.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    gap: 14,
  },
  eyebrow: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 12,
    letterSpacing: 1.1,
  },
  title: {
    fontFamily: "Fredoka_700Bold",
    fontSize: 28,
    lineHeight: 33,
  },
  message: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 22,
  },
  failureList: {
    gap: 8,
  },
  failureRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 15,
  },
  destructiveButtonText: {
    color: "#FFFFFF",
    fontFamily: "Inter_800ExtraBold",
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 15,
  },
});

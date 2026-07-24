import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useWebQaFontScale } from "@/hooks/useWebQaFontScale";
import {
  getAccessibleLayoutMetrics,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";
import {
  registerWebDialogPresenter,
  type WebDialogRequest,
} from "@/lib/confirmDialog";

/**
 * Themed in-app dialog for the web build, replacing raw window.alert /
 * window.confirm chrome for notifyDialog and confirmThroughSteps. Mounted
 * once in app/_layout inside the web frame; native platforms render nothing
 * and keep using the OS Alert. Board-style: soft card, title, message, and
 * explicit buttons, in both light and dark palettes.
 */
export function WebDialogHost() {
  const colors = useColors();
  const { fontScale: runtimeFontScale } = useWindowDimensions();
  const { fontScale } = useWebQaFontScale(runtimeFontScale);
  const layout = getAccessibleLayoutMetrics({
    platform: Platform.OS,
    fontScale,
  });
  const [queue, setQueue] = useState<WebDialogRequest[]>([]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    // Queue requests so a confirm step (or a second notice) presented from a
    // dialog's own callback is shown next instead of lost.
    return registerWebDialogPresenter((request) => {
      setQueue((current) => [...current, request]);
    });
  }, []);

  const current = queue[0] ?? null;

  const closeWith = useCallback((action: () => void) => {
    setQueue((currentQueue) => currentQueue.slice(1));
    action();
  }, []);

  // Escape dismisses like every native web dialog: cancel when the dialog
  // has a cancel path, otherwise acknowledge (OK).
  useEffect(() => {
    if (Platform.OS !== "web" || !current || typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeWith(current.cancelLabel != null ? current.onCancel : current.onConfirm);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeWith, current]);

  if (Platform.OS !== "web" || !current) return null;

  const confirmTone = current.destructive ? colors.rose : colors.primary;

  return (
    <View
      style={[s.backdrop, { backgroundColor: "rgba(9,17,32,0.55)" }]}
      accessibilityViewIsModal
      testID="web-dialog-host"
    >
      <View
        accessibilityRole="alert"
        accessibilityLabel={`${current.title}. ${current.message}`}
        style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[s.title, { color: colors.foreground, fontFamily: "Fredoka_600SemiBold" }]}>
          {current.title}
        </Text>
        <Text style={[s.message, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          {current.message}
        </Text>
        <View
          style={[
            s.buttonRow,
            layout.stackStatusRows && s.buttonRowStacked,
          ]}
        >
          {current.cancelLabel != null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={current.cancelLabel}
              onPress={() => closeWith(current.onCancel)}
              style={({ pressed }) => [
                s.button,
                {
                  backgroundColor: pressed ? colors.muted : colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[s.buttonText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {current.cancelLabel}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={current.confirmLabel}
            onPress={() => closeWith(current.onConfirm)}
            style={({ pressed }) => [
              s.button,
              {
                backgroundColor: confirmTone,
                borderColor: confirmTone,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[s.buttonText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
              {current.confirmLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 330,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 8,
    boxShadow: "0 18px 44px rgba(0, 0, 0, 0.3)",
  },
  title: {
    fontSize: 19,
    lineHeight: 24,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  buttonRowStacked: {
    alignItems: "stretch",
    flexDirection: "column-reverse",
  },
  button: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    minWidth: 84,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 14,
  },
});

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  registerWebDialogPresenter,
  type WebDialogRequest,
} from "@/lib/confirmDialog";
import {
  activateDeliberateConfirmation,
  createDeliberateConfirmationLatch,
  getDeliberateConfirmationDelay,
  resetDeliberateConfirmation,
  transitionDeliberateConfirmation,
  trySettleDeliberateConfirmation,
} from "@/lib/deliberateConfirmation";
import { MIN_MOBILE_TOUCH_TARGET } from "@/lib/mobileLayout";
import {
  getNextWebDialogFocusIndex,
  WEB_DIALOG_STEP_TRANSITION_MS,
} from "@/lib/webDialogFocus";
import { deriveWebDialogLayout } from "@/lib/webDialogLayout";

type FocusTarget = {
  focus(): void;
};

type WebDialogControl = View & FocusTarget;

/**
 * Themed in-app dialog for the web build, replacing raw window.alert /
 * window.confirm chrome for notifyDialog and confirmThroughSteps. Mounted
 * once in app/_layout inside the web frame; native platforms render nothing
 * and keep using the OS Alert. Board-style: soft card, title, message, and
 * explicit buttons, in both light and dark palettes.
 */
export function WebDialogHost() {
  const colors = useColors();
  const { width, height, fontScale } = useWindowDimensions();
  const dialogLayout = deriveWebDialogLayout({ width, height, fontScale });
  const [queue, setQueue] = useState<WebDialogRequest[]>([]);
  const [activationEpoch, setActivationEpoch] = useState(0);
  const queueRef = useRef<WebDialogRequest[]>([]);
  const activationLatchRef = useRef(
    createDeliberateConfirmationLatch<WebDialogRequest>(
      WEB_DIALOG_STEP_TRANSITION_MS,
    ),
  );
  const cancelButtonRef = useRef<WebDialogControl | null>(null);
  const confirmButtonRef = useRef<WebDialogControl | null>(null);
  const previouslyFocusedRef = useRef<FocusTarget | null>(null);
  const dialogSessionActiveRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    // Queue requests so a confirm step (or a second notice) presented from a
    // dialog's own callback is shown next instead of lost.
    const unregister = registerWebDialogPresenter((request) => {
      if (!dialogSessionActiveRef.current) {
        const activeElement = typeof document === "undefined"
          ? null
          : document.activeElement;
        previouslyFocusedRef.current =
          activeElement && "focus" in activeElement
            ? activeElement as unknown as FocusTarget
            : null;
        dialogSessionActiveRef.current = true;
      }

      if (queueRef.current.length === 0) {
        activateDeliberateConfirmation(
          activationLatchRef.current,
          request,
          Date.now(),
        );
      }
      const nextQueue = [...queueRef.current, request];
      queueRef.current = nextQueue;
      setQueue(nextQueue);
    });

    return () => {
      unregister();
      queueRef.current = [];
      resetDeliberateConfirmation(activationLatchRef.current);
      if (dialogSessionActiveRef.current) {
        dialogSessionActiveRef.current = false;
        previouslyFocusedRef.current?.focus();
        previouslyFocusedRef.current = null;
      }
    };
  }, []);

  const current = queue[0] ?? null;
  const activationDelay = current
    ? getDeliberateConfirmationDelay(
        activationLatchRef.current,
        current,
        Date.now(),
      )
    : 0;
  const activationBlocked =
    current !== null &&
    (!Number.isFinite(activationDelay) || activationDelay > 0);

  const closeWith = useCallback((
    expectedRequest: WebDialogRequest,
    action: () => void,
    allowBeforeReady = false,
  ) => {
    if (queueRef.current[0] !== expectedRequest) return;
    const settledAt = Date.now();
    if (
      !trySettleDeliberateConfirmation(
        activationLatchRef.current,
        expectedRequest,
        settledAt,
        { allowBeforeReady },
      )
    ) {
      return;
    }
    const nextQueue = queueRef.current.slice(1);
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    try {
      action();
    } finally {
      const nextRequest = queueRef.current[0];
      if (nextRequest) {
        transitionDeliberateConfirmation(
          activationLatchRef.current,
          nextRequest,
          settledAt,
        );
      } else {
        resetDeliberateConfirmation(activationLatchRef.current);
      }
      setActivationEpoch((epoch) => epoch + 1);
    }
  }, []);

  useEffect(() => {
    if (
      !current ||
      !Number.isFinite(activationDelay) ||
      activationDelay <= 0
    ) {
      return;
    }
    const timer = setTimeout(
      () => setActivationEpoch((epoch) => epoch + 1),
      Math.max(1, activationDelay),
    );
    return () => clearTimeout(timer);
  }, [activationDelay, activationEpoch, current]);

  useEffect(() => {
    if (!current || Platform.OS !== "web") return;
    if (activationBlocked && current.cancelLabel == null) return;

    const focusTimer = setTimeout(() => {
      const initialFocusRef = current.cancelLabel != null
        ? cancelButtonRef
        : confirmButtonRef;
      initialFocusRef.current?.focus();
    }, 0);

    return () => clearTimeout(focusTimer);
  }, [activationBlocked, current]);

  useEffect(() => {
    if (current || !dialogSessionActiveRef.current) return;

    dialogSessionActiveRef.current = false;
    previouslyFocusedRef.current?.focus();
    previouslyFocusedRef.current = null;
  }, [current]);

  // Escape dismisses like every native web dialog: cancel when the dialog
  // has a cancel path, otherwise acknowledge (OK).
  useEffect(() => {
    if (Platform.OS !== "web" || !current || typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeWith(
          current,
          current.cancelLabel != null ? current.onCancel : current.onConfirm,
          current.cancelLabel != null,
        );
        return;
      }
      if (event.key === "Tab") {
        const focusableControls = [
          ...(current.cancelLabel != null && cancelButtonRef.current
            ? [cancelButtonRef.current]
            : []),
          ...(confirmButtonRef.current ? [confirmButtonRef.current] : []),
        ];
        const currentIndex = focusableControls.findIndex(
          (control) =>
            control === (document.activeElement as unknown as WebDialogControl),
        );
        const nextIndex = getNextWebDialogFocusIndex(
          currentIndex,
          focusableControls.length,
          event.shiftKey,
        );
        if (nextIndex >= 0) {
          event.preventDefault();
          focusableControls[nextIndex]?.focus();
        } else {
          event.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [activationBlocked, closeWith, current]);

  if (Platform.OS !== "web" || !current) return null;

  const confirmTone = current.destructive ? colors.rose : colors.primary;
  const confirmForeground = current.destructive
    ? colors.brandNavy
    : colors.primaryForeground;

  return (
    <View
      style={[s.backdrop, { backgroundColor: "rgba(9,17,32,0.55)" }]}
      accessibilityViewIsModal
      testID="web-dialog-host"
    >
      <View
        role="alertdialog"
        aria-modal={true}
        aria-labelledby="web-dialog-title"
        aria-describedby="web-dialog-message"
        accessibilityRole="alert"
        style={[
          s.card,
          {
            maxHeight: dialogLayout.maxCardHeight,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={s.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <Text
            nativeID="web-dialog-title"
            style={[s.title, { color: colors.foreground, fontFamily: "Fredoka_600SemiBold" }]}
          >
            {current.title}
          </Text>
          <Text
            nativeID="web-dialog-message"
            style={[s.message, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
          >
            {current.message}
          </Text>
          <View
            style={[
              s.buttonRow,
              dialogLayout.stackActions && s.buttonRowStacked,
            ]}
          >
            {current.cancelLabel != null ? (
              <Pressable
                ref={cancelButtonRef}
                accessibilityRole="button"
                accessibilityLabel={current.cancelLabel}
                onPress={() => closeWith(current, current.onCancel, true)}
                style={({ pressed }) => [
                  s.button,
                  dialogLayout.stackActions && s.buttonStacked,
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
              ref={confirmButtonRef}
              accessibilityRole="button"
              accessibilityLabel={current.confirmLabel}
              accessibilityState={{ disabled: activationBlocked }}
              disabled={activationBlocked}
              onPress={() => closeWith(current, current.onConfirm)}
              style={({ pressed }) => [
                s.button,
                dialogLayout.stackActions && s.buttonStacked,
                {
                  backgroundColor: confirmTone,
                  borderColor: confirmTone,
                  opacity: activationBlocked ? 0.55 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[s.buttonText, { color: confirmForeground, fontFamily: "Inter_700Bold" }]}>
                {current.confirmLabel}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
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
    overflow: "hidden",
    boxShadow: "0 18px 44px rgba(0, 0, 0, 0.3)",
  },
  cardContent: {
    padding: 18,
    gap: 8,
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
    flexDirection: "column",
    alignItems: "stretch",
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
  buttonStacked: {
    width: "100%",
  },
  buttonText: {
    fontSize: 14,
  },
});

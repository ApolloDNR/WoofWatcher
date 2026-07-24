import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import { useCare, type Entry } from "@/context/CareContext";
import { announce } from "@/lib/announce";
import {
  buildAloneTimeStartEntry,
  findOpenAloneTimeSession,
} from "@/lib/aloneTimeSession";
import { careXpForEntry } from "@/lib/careCareer";
import {
  buildQuickLogEntry,
  findRecentQuickLogDuplicate,
  QUICK_LOG_DEDUPE_WINDOW_MS,
} from "@/lib/quickLogEntry";
import {
  QUICK_LOG_ALONE_ACTION,
  QUICK_LOG_ACTIONS,
  resolveQuickLogIntent,
  type QuickLogAction,
} from "@/lib/quickLogPolicy";
import {
  createQuickLogFailureAnnouncementGuard,
  createQuickLogUndoGuard,
  deriveQuickLogFailure,
  quickLogFeedbackPersistenceCopy,
  resolveQuickLogEntry,
  runQuickLogUndo,
} from "@/lib/quickLogRuntime";
import {
  buildWalkSessionStartEntry,
  findOpenWalkSession,
} from "@/lib/walkSession";
import {
  armWalkRouteCapture,
  clearWalkRouteCaptureArming,
  walkRouteSessionKey,
} from "@/lib/walkRouteArming";

export interface QuickLogFeedback {
  id: string;
  action: QuickLogAction;
  entry: Omit<Entry, "id">;
  message: string;
}

export interface QuickLogControllerOptions {
  announceFailures?: boolean;
  onSaved?: (feedback: QuickLogFeedback) => void;
  onUndone?: (feedback: QuickLogFeedback) => void;
}

export interface QuickLogPressOptions {
  routineId?: string;
  routineLabel?: string;
}

function feedbackMessage(
  action: QuickLogAction,
  entry: Omit<Entry, "id">,
): string {
  if (action.type === "walk") {
    return "Walk started · care XP lands when you finish";
  }
  if (action.type === "alone") {
    return "Alone time started · return check-in stays open";
  }
  if (
    action.type === "meal" &&
    entry.details?.mealLifecycle === "outcome-pending"
  ) {
    return `Meal served · outcome stays open · +${careXpForEntry(entry)} care XP`;
  }
  return `${action.title} logged · +${careXpForEntry(entry)} care XP`;
}

export function useQuickLogController(
  options: QuickLogControllerOptions = {},
) {
  const router = useRouter();
  const {
    state,
    addEntry,
    deleteEntry,
    refreshError,
    storageWarning,
    syncRefreshError,
  } = useCare();
  const caregiver = state.caregivers[0]?.name ?? "you";
  const caregiverRole = state.caregivers.find(
    (person) => person.name === caregiver,
  )?.role;
  const openWalkSession = useMemo(
    () => findOpenWalkSession(state.entries),
    [state.entries],
  );
  const openAloneSession = useMemo(
    () => findOpenAloneTimeSession(state.entries),
    [state.entries],
  );
  const recentQuickSave = useRef<{ type: string; at: number } | null>(null);
  const failureAnnouncementGuard = useRef(
    createQuickLogFailureAnnouncementGuard(),
  ).current;
  const undoGuard = useRef(createQuickLogUndoGuard()).current;
  const [feedback, setFeedback] = useState<QuickLogFeedback | null>(null);
  const feedbackRef = useRef<QuickLogFeedback | null>(null);
  const [transientFailure, setTransientFailure] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  const commitFeedback = useCallback((next: QuickLogFeedback | null) => {
    feedbackRef.current = next;
    setFeedback(next);
  }, []);

  const resolveFeedbackEntry = useCallback(
    (current: QuickLogFeedback) =>
      resolveQuickLogEntry(state.entries, {
        id: current.id,
        type: current.entry.type,
        occurredAt: current.entry.occurredAt,
        caregiver: current.entry.caregiver,
      }),
    [state.entries],
  );

  const feedbackEntry = useMemo(
    () => (feedback ? resolveFeedbackEntry(feedback) : null),
    [feedback, resolveFeedbackEntry],
  );
  const activeFailure = useMemo(
    () =>
      deriveQuickLogFailure({
        feedbackEntry,
        refreshError,
        storageWarning,
        syncRefreshError,
        transientFailure,
      }),
    [
      feedbackEntry,
      refreshError,
      storageWarning,
      syncRefreshError,
      transientFailure,
    ],
  );

  useEffect(() => {
    const failureAnnouncement = failureAnnouncementGuard.next(
      options.announceFailures === false
        ? null
        : activeFailure?.message ?? null,
    );
    if (failureAnnouncement) announce(failureAnnouncement);
  }, [
    activeFailure?.message,
    failureAnnouncementGuard,
    options.announceFailures,
  ]);

  const openDetails = useCallback(
    (action: QuickLogAction) => {
      if (undoGuard.busy) return;
      if (Platform.OS !== "web") {
        void Haptics.selectionAsync().catch(() => undefined);
      }
      router.push(
        `/log?type=${action.type}&detail=1&intent=${Date.now()}` as never,
      );
    },
    [router, undoGuard],
  );

  const publishFeedback = useCallback(
    (
      action: QuickLogAction,
      id: string,
      entry: Omit<Entry, "id">,
    ) => {
      const next = {
        id,
        action,
        entry,
        message: feedbackMessage(action, entry),
      };
      setTransientFailure(null);
      commitFeedback(next);
      announce(`${next.message}. Undo available.`);
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => undefined);
      }
      options.onSaved?.(next);
    },
    [commitFeedback, options],
  );

  const isDuplicateTap = useCallback(
    (action: QuickLogAction, now: number) => {
      const previous = recentQuickSave.current;
      return Boolean(
        (previous &&
          previous.type === action.type &&
          now - previous.at <= QUICK_LOG_DEDUPE_WINDOW_MS) ||
          findRecentQuickLogDuplicate(
            state.entries,
            action.type,
            now,
          ),
      );
    },
    [state.entries],
  );

  const press = useCallback(
    (action: QuickLogAction, pressOptions?: QuickLogPressOptions) => {
      if (undoGuard.busy) return;
      if (storageWarning === "read-failed") {
        setTransientFailure(
          "Quick Log is paused because saved care data could not be read. Restart after reviewing the storage warning.",
        );
        return;
      }
      const intent = resolveQuickLogIntent(action, {
        hasOpenAlone: Boolean(openAloneSession),
        hasOpenWalk: Boolean(openWalkSession),
      });
      if (intent.kind === "details") {
        openDetails(action);
        return;
      }
      if (intent.kind === "open-walk") {
        announce("Walk already active. Opening the active walk log.");
        router.push(
          (openWalkSession?.id
            ? `/log?entry=${encodeURIComponent(openWalkSession.id)}`
            : `/log?type=walk&detail=1&intent=${Date.now()}`) as never,
        );
        return;
      }
      if (intent.kind === "open-alone") {
        announce("Alone Time is already active. Opening the return check-in.");
        router.push("/log?alone=active" as never);
        return;
      }

      const now = Date.now();
      if (isDuplicateTap(action, now)) return;
      recentQuickSave.current = { type: action.type, at: now };
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Light,
        ).catch(() => undefined);
      }

      try {
        const entry =
          intent.kind === "start-walk"
            ? (buildWalkSessionStartEntry({
                caregiver,
                now,
                routineId: pressOptions?.routineId,
                routineLabel: pressOptions?.routineLabel,
              }) as Omit<Entry, "id">)
            : intent.kind === "start-alone"
              ? (buildAloneTimeStartEntry({
                  caregiver,
                  petName: state.profile.name,
                  now,
                }) as Omit<Entry, "id">)
              : buildQuickLogEntry(
                  { type: action.type, title: action.title },
                  state,
                  { caregiver, caregiverRole, now },
                );
        const walkSessionKey =
          intent.kind === "start-walk"
            ? walkRouteSessionKey(entry)
            : null;
        const id = addEntry(entry);
        if (walkSessionKey) armWalkRouteCapture(walkSessionKey);
        publishFeedback(action, id, entry);
      } catch {
        if (intent.kind === "start-walk") {
          clearWalkRouteCaptureArming();
        }
        recentQuickSave.current = null;
        setTransientFailure(`${action.label} was not saved. Try again.`);
      }
    },
    [
      addEntry,
      caregiver,
      caregiverRole,
      isDuplicateTap,
      openDetails,
      openAloneSession,
      openWalkSession,
      publishFeedback,
      router,
      state,
      storageWarning,
      undoGuard,
    ],
  );

  const undo = useCallback(async () => {
    const current = feedbackRef.current;
    if (!current) return false;
    const savedEntry = resolveFeedbackEntry(current);
    return runQuickLogUndo({
      guard: undoGuard,
      feedbackId: current.id,
      entryId: savedEntry?.id ?? current.id,
      getCurrentFeedbackId: () => feedbackRef.current?.id ?? null,
      deleteEntry,
      onBusyChange: setUndoing,
      onRemoved: () => {
        if (current.action.type === "walk") {
          clearWalkRouteCaptureArming(
            walkRouteSessionKey(current.entry),
          );
        }
        commitFeedback(null);
        setTransientFailure(null);
        recentQuickSave.current = null;
        announce(`${current.action.title} undone.`);
        options.onUndone?.(current);
      },
      onFailure: setTransientFailure,
      failureMessage: `${current.action.label} could not be undone. Open Log History to review it.`,
    });
  }, [
    commitFeedback,
    deleteEntry,
    options,
    resolveFeedbackEntry,
    undoGuard,
  ]);

  const openFeedbackDetails = useCallback(() => {
    if (undoGuard.busy) return;
    const current = feedbackRef.current;
    if (!current) return;
    const savedEntry = resolveFeedbackEntry(current);
    router.push(
      (savedEntry?.id
        ? `/log?entry=${encodeURIComponent(savedEntry.id)}`
        : `/log?type=${current.action.type}&detail=1&intent=${Date.now()}`) as never,
    );
  }, [resolveFeedbackEntry, router, undoGuard]);

  const pressAlone = useCallback(
    () => press(QUICK_LOG_ALONE_ACTION),
    [press],
  );

  return {
    actions: QUICK_LOG_ACTIONS,
    aloneActive: Boolean(openAloneSession),
    clearFailure: () => setTransientFailure(null),
    failure: activeFailure?.message ?? null,
    feedback,
    feedbackPersistenceCopy: quickLogFeedbackPersistenceCopy(activeFailure),
    openDetails,
    openFeedbackDetails,
    press,
    pressAlone,
    undo,
    undoing,
  };
}

export type QuickLogController = ReturnType<typeof useQuickLogController>;

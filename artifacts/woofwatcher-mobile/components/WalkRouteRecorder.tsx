import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeCareEventType } from "@workspace/care-domain";

import { useCare, type Entry } from "@/context/CareContext";
import { useLocalDataReset } from "@/context/LocalDataResetContext";
import {
  cancelWalkRouteCapture,
  finishWalkRouteCapture,
  getWalkRouteCaptureSnapshot,
  startWalkRouteCapture,
  subscribeWalkRouteCapture,
  walkRouteLocalDataResetParticipant,
  type WalkRouteCaptureSnapshot,
} from "@/lib/walkRoute";
import { findOpenWalkSession } from "@/lib/walkSession";

/**
 * The route recorder follows the shared walk-session lifecycle instead of
 * individual buttons: every surface that starts a walk (Home quick log,
 * /log launcher, Adventure quests, Fast Log) creates the same
 * walkLifecycle="in-progress" entry, and every finish applies the same
 * completion patch. This bridge watches that lifecycle from the care state:
 *
 * - open walk appears  -> start capturing (this is also when the platform
 *   permission prompt shows, honestly tied to the walk starting)
 * - open walk goes away -> stop capturing; if the walk completed (not
 *   deleted/undone) and real movement was recorded, persist the simplified
 *   route into the entry's details. Local-first: the route lives in the
 *   care log entry like every other care detail.
 *
 * Sessions are keyed by walkStartedAt, which stays stable while an
 * optimistic temp entry id is swapped for its server id mid-walk.
 */

function walkSessionKey(entry: Entry | null): string | null {
  if (!entry) return null;
  const startedAt = entry.details?.walkStartedAt;
  if (typeof startedAt === "string" && startedAt) return startedAt;
  return entry.occurredAt || null;
}

/** Live recorder status for honest UI copy (never claims recording when idle). */
export function useWalkRouteCaptureStatus(): WalkRouteCaptureSnapshot {
  const [snapshot, setSnapshot] = useState(getWalkRouteCaptureSnapshot);
  useEffect(
    () => subscribeWalkRouteCapture(() => setSnapshot(getWalkRouteCaptureSnapshot())),
    [],
  );
  return snapshot;
}

export function WalkRouteRecorderBridge() {
  const { state, careMutationsBlocked, updateEntry, isLoaded } = useCare();
  const {
    attachRequiredParticipant,
    captureLocalDataIntent,
    isLocalDataIntentCurrent,
  } = useLocalDataReset();
  const openWalk = useMemo(() => findOpenWalkSession(state.entries), [state.entries]);
  const entriesRef = useRef(state.entries);
  entriesRef.current = state.entries;
  const activeKeyRef = useRef<string | null>(null);

  const sessionKey = isLoaded ? walkSessionKey(openWalk) : null;

  useEffect(
    () => attachRequiredParticipant(
      "walk-capture",
      walkRouteLocalDataResetParticipant,
    ),
    [attachRequiredParticipant],
  );

  useEffect(() => {
    if (!isLoaded) return;
    // A reset prepare barrier pauses the native/web watch without deleting
    // its captured points. Do not treat that temporary barrier as the walk
    // ending. If a peer cannot prepare, resume the same session once local
    // writes reopen; a successful reset clears it in the owner's commit.
    if (careMutationsBlocked) return;
    const previousKey = activeKeyRef.current;
    if (sessionKey === previousKey) {
      if (
        sessionKey &&
        getWalkRouteCaptureSnapshot().status === "paused"
      ) {
        const intent = captureLocalDataIntent();
        if (intent) {
          void startWalkRouteCapture(sessionKey, () =>
            isLocalDataIntentCurrent(intent),
          );
        }
      }
      return;
    }
    activeKeyRef.current = sessionKey;

    if (previousKey) {
      const result = finishWalkRouteCapture(previousKey);
      // Persist only when the walk actually completed; a deleted or undone
      // walk discards its capture.
      const finished = entriesRef.current.find((entry) => {
        if (normalizeCareEventType(entry.type, entry.details) !== "walk") return false;
        const details = entry.details ?? {};
        return (
          details.walkLifecycle === "completed" &&
          details.walkStartedAt === previousKey
        );
      });
      if (result && finished && !careMutationsBlocked) {
        updateEntry(finished.id, {
          details: {
            ...finished.details,
            route: result.points,
            routeDistanceM: result.distanceM,
          },
        });
      }
    }

    if (sessionKey && !careMutationsBlocked) {
      const intent = captureLocalDataIntent();
      if (intent) {
        void startWalkRouteCapture(sessionKey, () =>
          isLocalDataIntentCurrent(intent),
        );
      }
    }
  }, [
    captureLocalDataIntent,
    careMutationsBlocked,
    isLoaded,
    isLocalDataIntentCurrent,
    sessionKey,
    updateEntry,
  ]);

  // Never leave a location watch running after the app tree unmounts.
  useEffect(() => () => cancelWalkRouteCapture(), []);

  return null;
}

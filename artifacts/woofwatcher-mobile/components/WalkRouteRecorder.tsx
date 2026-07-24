import { useEffect, useMemo, useRef, useState } from "react";

import { useCare } from "@/context/CareContext";
import { useWoofAuth } from "@/lib/auth";
import {
  cancelWalkRouteCapture,
  finishWalkRouteCapture,
  getWalkRouteCaptureSnapshot,
  startWalkRouteCapture,
  subscribeWalkRouteCapture,
  type WalkRouteCaptureResult,
  type WalkRouteCaptureSnapshot,
} from "@/lib/walkRoute";
import {
  clearWalkRouteCaptureArming,
  findLocallyArmedWalkSession,
  findWalkSessionForArming,
  getWalkRouteCaptureArming,
  subscribeWalkRouteCaptureArming,
  walkRouteSessionKey,
  type WalkRouteCaptureArming,
} from "@/lib/walkRouteArming";

/**
 * Local start actions create a device-memory arming token keyed by
 * walkStartedAt. This bridge consumes that token; hydrated household state
 * alone can never prompt for location or start a watch.
 *
 * - matching locally armed walk appears -> start capturing
 * - matching walk goes away -> stop capturing; if the walk completed (not
 *   deleted/undone) and real movement was recorded, persist the simplified
 *   route into the entry's details. The route then follows that care entry's
 *   local/provider household sync and visibility boundary.
 *
 * Authenticated selection additionally requires caregiverUserId to match the
 * current user. The token and owner check are separate defenses.
 */

function useWalkRouteCaptureArming(): WalkRouteCaptureArming | null {
  const [arming, setArming] = useState(getWalkRouteCaptureArming);
  useEffect(
    () =>
      subscribeWalkRouteCaptureArming(() =>
        setArming(getWalkRouteCaptureArming()),
      ),
    [],
  );
  return arming;
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
  const { state, updateEntry, isLoaded } = useCare();
  const { isSignedIn, userId } = useWoofAuth();
  const arming = useWalkRouteCaptureArming();
  const ownerOptions = useMemo(
    () => ({
      isSignedIn: Boolean(isSignedIn),
      userId,
    }),
    [isSignedIn, userId],
  );
  const openWalk = useMemo(
    () =>
      findLocallyArmedWalkSession(state.entries, {
        ...ownerOptions,
        lifecycle: "in-progress",
      }),
    [arming, ownerOptions, state.entries],
  );
  const entriesRef = useRef(state.entries);
  entriesRef.current = state.entries;
  const activeKeyRef = useRef<string | null>(null);
  const pendingRouteAttachmentRef = useRef<{
    sessionKey: string;
    result: WalkRouteCaptureResult;
  } | null>(null);

  const sessionKey = isLoaded ? walkRouteSessionKey(openWalk) : null;

  useEffect(() => {
    if (!isLoaded) return;

    const armedEntry = arming
      ? entriesRef.current.find(
          (entry) => walkRouteSessionKey(entry) === arming.sessionKey,
        )
      : null;
    if (
      armedEntry &&
      ownerOptions.isSignedIn &&
      (!ownerOptions.userId ||
        armedEntry.caregiverUserId !== ownerOptions.userId)
    ) {
      cancelWalkRouteCapture();
      activeKeyRef.current = null;
      pendingRouteAttachmentRef.current = null;
      clearWalkRouteCaptureArming(arming?.sessionKey);
      return;
    }
    if (arming && !armedEntry) {
      cancelWalkRouteCapture();
      activeKeyRef.current = null;
      pendingRouteAttachmentRef.current = null;
      clearWalkRouteCaptureArming(arming.sessionKey);
      return;
    }

    const retryPendingRouteAttachment = () => {
      const pending = pendingRouteAttachmentRef.current;
      if (!pending) return;
      const finished = findWalkSessionForArming(
        entriesRef.current,
        { sessionKey: pending.sessionKey },
        {
          ...ownerOptions,
          lifecycle: "completed",
        },
      );
      // A conflicted row is read-only until the caregiver explicitly chooses
      // a version. Keep the finished capture intact and retry after that row
      // leaves conflict instead of silently discarding the recorded route.
      if (!finished || finished.syncStatus === "conflict") return;
      if (
        !updateEntry(finished.id, {
          details: {
            ...finished.details,
            route: pending.result.points,
            routeDistanceM: pending.result.distanceM,
          },
        })
      ) {
        return;
      }
      pendingRouteAttachmentRef.current = null;
      clearWalkRouteCaptureArming(pending.sessionKey);
    };

    retryPendingRouteAttachment();

    const previousKey = activeKeyRef.current;
    if (sessionKey === previousKey) return;
    activeKeyRef.current = sessionKey;

    if (previousKey) {
      const result = finishWalkRouteCapture(previousKey);
      // Persist only when the walk actually completed; a deleted or undone
      // walk discards its capture.
      const finished = findWalkSessionForArming(
        entriesRef.current,
        { sessionKey: previousKey },
        {
          ...ownerOptions,
          lifecycle: "completed",
        },
      );
      if (result && finished) {
        pendingRouteAttachmentRef.current = {
          sessionKey: previousKey,
          result,
        };
        retryPendingRouteAttachment();
      } else {
        pendingRouteAttachmentRef.current = null;
        clearWalkRouteCaptureArming(previousKey);
      }
    }

    if (sessionKey) void startWalkRouteCapture(sessionKey);
  }, [
    arming,
    sessionKey,
    isLoaded,
    ownerOptions,
    state.entries,
    updateEntry,
  ]);

  // Never leave a location watch running after the app tree unmounts.
  useEffect(
    () => () => {
      const activeKey = activeKeyRef.current;
      cancelWalkRouteCapture();
      pendingRouteAttachmentRef.current = null;
      clearWalkRouteCaptureArming(activeKey);
    },
    [],
  );

  return null;
}

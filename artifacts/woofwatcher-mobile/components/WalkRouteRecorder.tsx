import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizeCareEventType } from "@workspace/care-domain";

import { useCare, type Entry } from "@/context/CareContext";
import { useLocalDataReset } from "@/context/LocalDataResetContext";
import {
  cancelWalkRouteCapture,
  finishWalkRouteCapture,
  getWalkRouteCaptureSnapshot,
  retryRetainedWalkRouteStopHandles,
  startWalkRouteCapture,
  subscribeWalkRouteCapture,
  walkRouteLocalDataResetParticipant,
  type WalkRouteCaptureSnapshot,
} from "@/lib/walkRoute";
import {
  captureWalkRouteOperationAuthority,
  createWalkRouteRecorderAdmissionGate,
  isWalkRouteRecorderAuthorityCurrent,
  isWalkRouteRecorderIdentityAdmitted,
  planWalkRouteRecorderTransition,
  resolveWalkRouteRecorderIdentity,
} from "@/lib/walkRouteRecorderLifecycle";
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
    () =>
      subscribeWalkRouteCapture(() =>
        setSnapshot(getWalkRouteCaptureSnapshot()),
      ),
    [],
  );
  return snapshot;
}

export function WalkRouteRecorderBridge() {
  const {
    state,
    careMutationsBlocked,
    updateEntry,
    isLoaded,
    identityScopeKey,
    identityScopeStatus,
    initialSyncStatus,
    storageWarning,
    captureCareOperationPermit,
    isCareOperationPermitCurrent,
  } = useCare();
  const {
    attachRequiredParticipant,
    captureLocalDataIntent,
    isLocalDataIntentCurrent,
  } = useLocalDataReset();
  const openWalk = useMemo(
    () => findOpenWalkSession(state.entries),
    [state.entries],
  );
  const entriesRef = useRef(state.entries);
  entriesRef.current = state.entries;
  const activeKeyRef = useRef<string | null>(null);
  const activeIdentityRef = useRef<string | null>(null);
  const captureAdmissionGate = useMemo(
    () => createWalkRouteRecorderAdmissionGate(),
    [],
  );

  const captureAdmitted = isWalkRouteRecorderIdentityAdmitted({
    isLoaded,
    identityScopeState: identityScopeStatus.state,
    initialSyncSettled: initialSyncStatus.isSettled,
    storageWarning,
  });
  const sessionKey = captureAdmitted ? walkSessionKey(openWalk) : null;

  // Native callback authority belongs to committed layout only. A discarded
  // concurrent render cannot open or close the live recorder; identity is an
  // explicit dependency so A closes before the committed B setup reopens it.
  useLayoutEffect(
    () => captureAdmissionGate.commit(captureAdmitted),
    [captureAdmissionGate, captureAdmitted, identityScopeKey],
  );

  useEffect(
    () =>
      attachRequiredParticipant(
        "walk-capture",
        walkRouteLocalDataResetParticipant,
      ),
    [attachRequiredParticipant],
  );

  useEffect(() => {
    const carePermit = captureCareOperationPermit();
    const currentIdentityKey = resolveWalkRouteRecorderIdentity({
      isLoaded: captureAdmitted,
      identityScopeKey,
      carePermit,
    });
    const transition = planWalkRouteRecorderTransition({
      active: {
        identityKey: activeIdentityRef.current,
        sessionKey: activeKeyRef.current,
      },
      currentIdentityKey,
      currentSessionKey: sessionKey,
      captureStatus: getWalkRouteCaptureSnapshot().status,
      careMutationsBlocked,
    });
    activeIdentityRef.current = transition.next.identityKey;
    activeKeyRef.current = transition.next.sessionKey;

    if (transition.cancelCapture) {
      // This is intentionally synchronous: it revokes the route generation
      // before a stale A callback can run under B. Fail-once native stop
      // handles are retained and retried by the cancellation primitive.
      cancelWalkRouteCapture();
    }
    if (!currentIdentityKey) return;
    // A reset prepare barrier pauses the native/web watch without deleting
    // its captured points. Do not treat that temporary barrier as the walk
    // ending. If a peer cannot prepare, resume the same session once local
    // writes reopen; a successful reset clears it in the owner's commit.
    if (careMutationsBlocked) return;

    const captureAuthority = () =>
      captureWalkRouteOperationAuthority({
        isLoaded: captureAdmitted,
        identityScopeKey,
        captureCarePermit: captureCareOperationPermit,
        captureLocalDataIntent,
      });
    const isAuthorityCurrent = (
      authority: NonNullable<ReturnType<typeof captureAuthority>>,
    ) =>
      isWalkRouteRecorderAuthorityCurrent(authority, {
        isRecorderAdmitted: captureAdmissionGate.isAdmitted,
        isCarePermitCurrent: isCareOperationPermitCurrent,
        isLocalDataIntentCurrent,
      });

    if (transition.finishSessionKey) {
      const result = finishWalkRouteCapture(transition.finishSessionKey);
      // Persist only when the walk actually completed; a deleted or undone
      // walk discards its capture.
      const finished = entriesRef.current.find((entry) => {
        if (normalizeCareEventType(entry.type, entry.details) !== "walk")
          return false;
        const details = entry.details ?? {};
        return (
          details.walkLifecycle === "completed" &&
          details.walkStartedAt === transition.finishSessionKey
        );
      });
      const authority = captureAuthority();
      if (result && finished && authority && isAuthorityCurrent(authority)) {
        updateEntry(finished.id, {
          details: {
            ...finished.details,
            route: result.points,
            routeDistanceM: result.distanceM,
          },
        });
      }
    }

    if (transition.startSessionKey) {
      const authority = captureAuthority();
      if (!authority || authority.identityKey !== currentIdentityKey) return;
      void startWalkRouteCapture(transition.startSessionKey, () =>
        isAuthorityCurrent(authority),
      ).catch(() => {
        // A deferred A watch may resolve only after B is active. Its late stop
        // failure stays retained; retry it without touching B's active watch.
        retryRetainedWalkRouteStopHandles();
      });
    }
  }, [
    captureCareOperationPermit,
    captureAdmissionGate,
    captureLocalDataIntent,
    careMutationsBlocked,
    captureAdmitted,
    identityScopeKey,
    isCareOperationPermitCurrent,
    isLocalDataIntentCurrent,
    sessionKey,
    updateEntry,
  ]);

  // Never leave a location watch running after the app tree unmounts.
  useEffect(
    () => () => {
      activeIdentityRef.current = null;
      activeKeyRef.current = null;
      cancelWalkRouteCapture();
    },
    [],
  );

  return null;
}

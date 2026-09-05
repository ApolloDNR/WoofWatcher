import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deriveOnboardingStatus } from "@workspace/care-domain";
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { BoardCard, BoardPill, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { isClerkConfigured, useWoofAuth } from "@/lib/auth";
import { buildAuthSetupProofManifest } from "@/lib/authProviderProof";
import {
  applyBreedTemplateToAvatarConfig,
  deriveSetupTwinPlan,
} from "@/lib/breedTemplateMatch";
import { notifyDialog } from "@/lib/confirmDialog";
import {
  getKeyboardAvoidingVerticalOffset,
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
} from "@/lib/mobileLayout";
import {
  applySetupWizardDraft,
  buildSetupWizardConfirmation,
  createSetupWizardDraft,
  makeSetupWizardDraftDeviceOnly,
  type SetupWizardDraft,
  type SetupWizardHouseholdMode,
} from "@/lib/setupWizard";
import {
  INITIAL_SETUP_DRAFT_READINESS,
  isSetupInteractive,
  normalizeSetupActivePetId,
  reduceSetupDraftReadiness,
} from "@/lib/setupHydration";
import {
  createSetupCareDocumentFingerprint,
  createSetupCareSourceFingerprint,
  rebaseSetupDraft,
  type SetupDraftField,
  type SetupDraftRebaseResult,
} from "@/lib/setupDraftRebase";
import {
  createSetupSaveCoordinator,
  isSetupSaveFenceCurrent,
  type SetupSaveFenceState,
  type SetupSaveCoordinator,
} from "@/lib/setupSaveTransaction";
import { getConsumerSurfacePolicy } from "@/lib/consumerSurfacePolicy";
import { buildSetupHouseholdPlaceholder } from "@/lib/petIdentity";

const DISPLAY_SEMI = "Fredoka_600SemiBold";
// Storybook mockup: big warm serif for celebration titles (same face the
// board route headers use).
const TITLE_SERIF = "Fraunces_700Bold";

// Placeholders must read as hints, not as filled values: soften the muted
// foreground token with alpha so an empty form never looks complete while
// the progress card still says "0/4 ready".
const PLACEHOLDER_TEXT_ALPHA = "80";

type IoniconName = keyof typeof Ionicons.glyphMap;
type SetupSaveStatus =
  | "idle"
  | "saving"
  | "care-failed"
  | "avatar-failed"
  | "review-required";

interface SetupSuccessMoment extends SetupSaveFenceState {
  dogName: string;
  twinLine: string;
  templateLine: string;
}

// Section names as they read on this screen, keyed by onboarding step id, so
// the disabled save button can say exactly which cards still need attention.
const SETUP_SECTION_NAME_BY_STEP_ID: Record<string, string> = {
  "dog-profile": "Dog profile",
  "diet-profile": "Diet baseline",
  "starter-routine": "Starter routine",
  "household-caregiver": "Household caregiver",
};

const SETUP_FIELD_LABEL: Record<SetupDraftField, string> = {
  dogName: "dog name",
  breed: "breed",
  weight: "weight",
  weightUnit: "weight unit",
  careFocus: "care focus",
  caregiverName: "caregiver name",
  caregiverRole: "caregiver role",
  householdMode: "household mode",
  householdName: "household name",
  inviteCode: "invite code",
  primaryFood: "primary food",
  normalPortion: "normal portion",
  mealSchedule: "meal schedule",
  routineType: "routine type",
  routineLabel: "routine name",
  routineTime: "routine time",
};

function formatSectionList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

const ROUTINE_TYPES: { label: string; value: string; icon: IoniconName }[] = [
  { label: "Meal", value: "meal", icon: "restaurant-outline" },
  { label: "Walk", value: "walk", icon: "paw-outline" },
  { label: "Medication", value: "medication", icon: "medical-outline" },
  { label: "Care", value: "care", icon: "heart-outline" },
];

const HOUSEHOLD_MODES: {
  label: string;
  value: SetupWizardHouseholdMode;
  icon: IoniconName;
  detail: string;
}[] = [
  {
    label: "Create household",
    value: "create",
    icon: "home-outline",
    detail:
      "Start this dog's shared home base for routines, logs, reports, and invites later.",
  },
  {
    label: "Join by invite",
    value: "join",
    icon: "mail-open-outline",
    detail: "Have an invite code? Enter it to join an existing household.",
  },
  {
    label: "Local preview",
    value: "local",
    icon: "phone-portrait-outline",
    detail:
      "Keep everything on this device for now - you can connect an account later.",
  },
];

export default function SetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const consumerSurfacePolicy = getConsumerSurfacePolicy();
  const ownerOps = consumerSurfacePolicy.ownerOps;
  const {
    careScopeRevision,
    hydrationStatus: careHydrationStatus,
    retryHydration: retryCareHydration,
    state,
    updateCareDocDurably,
  } = useCare();
  const activePetId = normalizeSetupActivePetId(state.activePetId);
  const careSourceFingerprint = useMemo(
    () => createSetupCareSourceFingerprint(state),
    [state],
  );
  const careDocumentFingerprint = useMemo(
    () => createSetupCareDocumentFingerprint(state),
    [state],
  );
  const { isSignedIn } = useWoofAuth();
  const {
    avatarConfig,
    avatarConfigWritePending,
    getAvatarConfigWriteState,
    hasConfiguredAvatar,
    hydrationStatus: avatarHydrationStatus,
    retryHydration: retryAvatarHydration,
    saveAvatarConfigIfCurrent,
  } = useAvatar();
  const [draft, setDraft] = useState<SetupWizardDraft>(() => {
    const next = createSetupWizardDraft(state);
    return consumerSurfacePolicy.householdSetupModes
      ? next
      : makeSetupWizardDraftDeviceOnly(next);
  });
  const [draftReadiness, dispatchDraftReadiness] = useReducer(
    reduceSetupDraftReadiness,
    INITIAL_SETUP_DRAFT_READINESS,
  );
  const setupDraftBaseRef = useRef<SetupWizardDraft>({ ...draft });
  const setupLatestCareDraftRef = useRef<SetupWizardDraft>({ ...draft });
  const setupDraftDirtyFieldsRef = useRef<SetupDraftField[]>([]);
  const setupDraftBaseDocumentFingerprintRef = useRef(
    careDocumentFingerprint,
  );
  const [setupConflictFields, setSetupConflictFields] = useState<
    SetupDraftField[]
  >([]);
  // Confirm toggle for the breed-matched twin swap. hasConfiguredAvatar
  // already blocks the swap when the owner customized the twin, but it cannot
  // tell "never opened Avatar Studio" apart from "deliberately re-saved the
  // default shepherd", so the swap stays owner-confirmable here. Defaults ON.
  const [matchTwinToBreed, setMatchTwinToBreed] = useState(true);
  // Snapshot of the save celebration, captured at save time so the sheet
  // stays stable while care and avatar state update underneath it.
  const [successMoment, setSuccessMoment] = useState<SetupSuccessMoment | null>(
    null,
  );
  const [setupSaveStatus, setSetupSaveStatus] =
    useState<SetupSaveStatus>("idle");
  const setupSaveHandlingRef = useRef<symbol | null>(null);
  const acceptedCareSourceFingerprintRef = useRef<string | null>(null);
  const acceptedCareDocumentFingerprintRef = useRef<string | null>(null);
  const setupSaveScopeRef = useRef({
    careScopeRevision,
    activePetId,
    careSourceFingerprint,
    careDocumentFingerprint,
  });
  const currentSetupScopeRef = useRef({
    careScopeRevision,
    activePetId,
    careSourceFingerprint,
    careDocumentFingerprint,
  });
  // Match CareContext's synchronous scope mirroring: a stale Promise can
  // settle after a new render but before passive effects invalidate it.
  currentSetupScopeRef.current = {
    careScopeRevision,
    activePetId,
    careSourceFingerprint,
    careDocumentFingerprint,
  };
  const setupSaveCoordinatorRef =
    useRef<SetupSaveCoordinator<SetupSuccessMoment> | null>(null);
  if (!setupSaveCoordinatorRef.current) {
    setupSaveCoordinatorRef.current =
      createSetupSaveCoordinator<SetupSuccessMoment>();
  }
  const setupSaveCoordinator = setupSaveCoordinatorRef.current;

  useEffect(() => {
    const careScopeChanged =
      setupSaveScopeRef.current.careScopeRevision !== careScopeRevision;
    const activePetChanged =
      setupSaveScopeRef.current.activePetId !== activePetId;
    const careSourceChanged =
      setupSaveScopeRef.current.careSourceFingerprint !==
      careSourceFingerprint;
    if (!careScopeChanged && !activePetChanged && !careSourceChanged) return;
    setupSaveScopeRef.current = {
      careScopeRevision,
      activePetId,
      careSourceFingerprint,
      careDocumentFingerprint,
    };
    if (
      !careScopeChanged &&
      !activePetChanged &&
      (acceptedCareSourceFingerprintRef.current === careSourceFingerprint ||
        acceptedCareDocumentFingerprintRef.current ===
          careDocumentFingerprint)
    ) {
      acceptedCareSourceFingerprintRef.current = careSourceFingerprint;
      return;
    }
    setupSaveCoordinator.invalidate();
    acceptedCareSourceFingerprintRef.current = null;
    acceptedCareDocumentFingerprintRef.current = null;
    setupSaveHandlingRef.current = null;
    setSetupSaveStatus("idle");
    setSuccessMoment(null);
    if (careScopeChanged || activePetChanged) setSetupConflictFields([]);
  }, [
    activePetId,
    careDocumentFingerprint,
    careScopeRevision,
    careSourceFingerprint,
    setupSaveCoordinator,
  ]);

  useEffect(() => {
    if (careHydrationStatus === "ready" && avatarHydrationStatus === "ready") {
      return;
    }
    setupSaveCoordinator.invalidate();
    acceptedCareSourceFingerprintRef.current = null;
    acceptedCareDocumentFingerprintRef.current = null;
    setupSaveHandlingRef.current = null;
    setSetupSaveStatus("idle");
    setSuccessMoment(null);
    setSetupConflictFields([]);
  }, [avatarHydrationStatus, careHydrationStatus, setupSaveCoordinator]);

  useEffect(
    () => () => {
      setupSaveCoordinator.invalidate();
    },
    [setupSaveCoordinator],
  );

  useEffect(() => {
    if (careHydrationStatus !== "ready") {
      dispatchDraftReadiness({ type: "care-unavailable" });
      setupDraftDirtyFieldsRef.current = [];
      return;
    }

    const nextFromCare = createSetupWizardDraft(state);
    const next = consumerSurfacePolicy.householdSetupModes
      ? nextFromCare
      : makeSetupWizardDraftDeviceOnly(nextFromCare);
    const sameBoundScope =
      draftReadiness.boundCareScopeRevision === careScopeRevision &&
      draftReadiness.boundActivePetId === activePetId;

    if (
      sameBoundScope &&
      draftReadiness.boundCareSourceFingerprint === careSourceFingerprint
    ) {
      return;
    }

    if (draftReadiness.dirty && sameBoundScope) {
      if (
        acceptedCareSourceFingerprintRef.current === careSourceFingerprint
      ) {
        setupDraftBaseRef.current = { ...next };
        setupLatestCareDraftRef.current = { ...next };
        setupDraftDirtyFieldsRef.current = [];
        setupDraftBaseDocumentFingerprintRef.current =
          careDocumentFingerprint;
        setSetupConflictFields([]);
        setDraft(next);
        dispatchDraftReadiness({
          type: "draft-rebased",
          careSourceFingerprint,
          dirty: false,
        });
        return;
      }

      const rebased = rebaseSetupDraft({
        base: setupDraftBaseRef.current,
        draft,
        dirtyFields: setupDraftDirtyFieldsRef.current,
        latest: next,
      });
      setupDraftBaseRef.current = rebased.base;
      setupLatestCareDraftRef.current = { ...next };
      setupDraftDirtyFieldsRef.current = rebased.dirtyFields;
      setupDraftBaseDocumentFingerprintRef.current = careDocumentFingerprint;
      setDraft(rebased.draft);
      setSetupConflictFields(rebased.conflicts);
      setSetupSaveStatus("review-required");
      setSuccessMoment(null);
      dispatchDraftReadiness({
        type: "draft-rebased",
        careSourceFingerprint,
        dirty: rebased.dirtyFields.length > 0,
      });
      return;
    }

    setupDraftBaseRef.current = { ...next };
    setupLatestCareDraftRef.current = { ...next };
    setupDraftDirtyFieldsRef.current = [];
    setupDraftBaseDocumentFingerprintRef.current = careDocumentFingerprint;
    setSetupConflictFields([]);
    setDraft(next);
    dispatchDraftReadiness({
      type: "draft-bound",
      careScopeRevision,
      activePetId,
      careSourceFingerprint,
    });
  }, [
    activePetId,
    careDocumentFingerprint,
    careHydrationStatus,
    careScopeRevision,
    careSourceFingerprint,
    consumerSurfacePolicy.householdSetupModes,
    draftReadiness.boundActivePetId,
    draftReadiness.boundCareScopeRevision,
    draftReadiness.boundCareSourceFingerprint,
    draftReadiness.dirty,
    draft,
    state,
  ]);

  const preview = useMemo(
    () => applySetupWizardDraft(state, draft, state.updatedAt),
    [draft, state],
  );
  const onboarding = useMemo(
    () =>
      deriveOnboardingStatus({
        profile: preview.profile,
        dietProfile: preview.dietProfile,
        routines: preview.routines,
        caregivers: preview.caregivers,
      }),
    [preview],
  );
  const confirmation = useMemo(
    () =>
      buildSetupWizardConfirmation(preview, {
        isSignedIn: Boolean(isSignedIn),
        isClerkConfigured,
        consumerRelease: !consumerSurfacePolicy.householdSetupModes,
      }),
    [consumerSurfacePolicy.householdSetupModes, isSignedIn, preview],
  );
  const authSetupProofManifest = buildAuthSetupProofManifest(state.launchProviderProfile.authSetupProofEvidence ?? undefined);
  // Breed-matched pixel twin plan: previewed under the breed field so the
  // template swap on save is never a surprise.
  const twinPlan = useMemo(
    () =>
      deriveSetupTwinPlan({
        breed: draft.breed,
        dogName: preview.profile.name,
        currentTemplateId: avatarConfig.templateId,
        hasConfiguredAvatar,
        matchTwinToBreed,
      }),
    [
      avatarConfig.templateId,
      draft.breed,
      hasConfiguredAvatar,
      matchTwinToBreed,
      preview.profile.name,
    ],
  );

  const setupHydrated = isSetupInteractive({
    avatarHydrationStatus,
    careHydrationStatus,
    careScopeRevision,
    activePetId,
    careSourceFingerprint,
    draftReadiness,
  });
  const setupSaveLocked =
    setupSaveStatus === "saving" ||
    setupSaveStatus === "care-failed" ||
    setupSaveStatus === "avatar-failed" ||
    avatarConfigWritePending;

  const setField = (key: keyof SetupWizardDraft, value: string) => {
    if (!setupHydrated) return;
    if (setupSaveLocked) return;
    if (!setupDraftDirtyFieldsRef.current.includes(key)) {
      setupDraftDirtyFieldsRef.current = [
        ...setupDraftDirtyFieldsRef.current,
        key,
      ];
    }
    dispatchDraftReadiness({ type: "edited" });
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const keepReviewedSetupEdits = () => {
    if (!setupHydrated || setupSaveStatus !== "review-required") return;
    setupDraftBaseRef.current = { ...setupLatestCareDraftRef.current };
    setSetupConflictFields([]);
    setSetupSaveStatus("idle");
    void Haptics.selectionAsync().catch(() => {});
  };

  const useLatestSharedCareValues = () => {
    if (!setupHydrated || setupSaveStatus !== "review-required") return;
    const conflicts = new Set(setupConflictFields);
    setDraft((current) => {
      const next = { ...current };
      for (const field of conflicts) {
        next[field] = setupLatestCareDraftRef.current[field] as never;
      }
      return next;
    });
    setupDraftDirtyFieldsRef.current =
      setupDraftDirtyFieldsRef.current.filter(
        (field) => !conflicts.has(field),
      );
    setupDraftBaseRef.current = { ...setupLatestCareDraftRef.current };
    setSetupConflictFields([]);
    dispatchDraftReadiness({
      type: "draft-rebased",
      careSourceFingerprint,
      dirty: setupDraftDirtyFieldsRef.current.length > 0,
    });
    setSetupSaveStatus("idle");
    void Haptics.selectionAsync().catch(() => {});
  };

  const householdReady =
    draft.householdMode !== "join" || draft.inviteCode.trim().length >= 3;
  const canSave =
    setupHydrated &&
    !avatarConfigWritePending &&
    onboarding.isComplete &&
    householdReady &&
    setupSaveStatus === "idle";
  const setupLoadFailed =
    careHydrationStatus === "failed" || avatarHydrationStatus === "failed";
  const setupLoadFailureMessage =
    careHydrationStatus === "failed" && avatarHydrationStatus === "failed"
      ? "Your saved care details and care twin could not be read. Nothing has been replaced. Retry when this device's storage is available."
      : careHydrationStatus === "failed"
        ? "Your saved care details could not be read. Editing stays paused so temporary defaults cannot replace them."
        : "Your saved care twin could not be read. Editing stays paused so a temporary avatar cannot replace it.";

  const retrySetupHydration = () => {
    void Haptics.selectionAsync().catch(() => {});
    if (careHydrationStatus === "failed") retryCareHydration();
    if (avatarHydrationStatus === "failed") retryAvatarHydration();
  };

  // Which sections still block the save, in this screen's own words. Shown
  // under the CTA and echoed when a blocked save is tapped, so the disabled
  // state never reads as a dead button.
  const remainingSections = [
    ...onboarding.steps
      .filter((step) => !step.done)
      .map((step) => SETUP_SECTION_NAME_BY_STEP_ID[step.id] ?? step.title),
    ...(householdReady ? [] : ["the invite code"]),
  ];
  const saveBlockedMessage = avatarConfigWritePending
    ? "Wait for the current care twin update to finish before saving setup."
    : setupSaveStatus === "review-required"
      ? "Review the shared care changes below before saving."
      : remainingSections.length
        ? `Complete ${formatSectionList(remainingSections)} to save.`
        : "";

  const completeSetupSave = (moment: SetupSuccessMoment) => {
    setSetupSaveStatus("idle");
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    setSuccessMoment(moment);
  };

  const retireStaleSetupSave = () => {
    const currentScope = currentSetupScopeRef.current;
    if (isSetupSaveFenceCurrent({
      acceptedCareDocumentFingerprint:
        acceptedCareDocumentFingerprintRef.current,
      captured: setupSaveScopeRef.current,
      current: currentScope,
    })) {
      setupSaveScopeRef.current = currentScope;
      if (acceptedCareDocumentFingerprintRef.current !== null) {
        acceptedCareSourceFingerprintRef.current =
          currentScope.careSourceFingerprint;
      }
      return false;
    }
    setupSaveScopeRef.current = currentScope;
    setupSaveCoordinator.invalidate();
    acceptedCareSourceFingerprintRef.current = null;
    acceptedCareDocumentFingerprintRef.current = null;
    setupSaveHandlingRef.current = null;
    setSetupSaveStatus("idle");
    setSuccessMoment(null);
    return true;
  };

  const persistSetup = async () => {
    if (retireStaleSetupSave()) return;
    if (
      setupSaveHandlingRef.current ||
      setupSaveStatus === "avatar-failed" ||
      setupSaveStatus === "review-required"
    ) {
      return;
    }
    const avatarWriteStateAtSave = getAvatarConfigWriteState();
    if (avatarWriteStateAtSave.pending) return;
    let expectedAvatarConfigRevision = avatarWriteStateAtSave.revision;
    const saveDraft = { ...draft };
    const saveBaseDraft = { ...setupDraftBaseRef.current };
    const saveDirtyFields = [...setupDraftDirtyFieldsRef.current];
    const saveBaseDocumentFingerprint =
      setupDraftBaseDocumentFingerprintRef.current;
    const saveCareVersion = state.version;
    let acceptedCareSourceFingerprint: string | null = null;
    let acceptedCareDocumentFingerprint: string | null = null;
    const capturedSaveFence: SetupSaveFenceState = {
      careScopeRevision,
      activePetId,
      careSourceFingerprint,
      careDocumentFingerprint,
    };
    const sourceChangedDuringSaveRef: {
      current: SetupDraftRebaseResult | null;
    } = { current: null };
    const sourceChangedError = Symbol("setup-care-source-changed");
    const success: SetupSuccessMoment = {
      careScopeRevision,
      activePetId,
      careSourceFingerprint: "",
      careDocumentFingerprint: "",
      dogName: preview.profile.name,
      twinLine: twinPlan.successLine,
      templateLine: twinPlan.willSwapTemplate
        ? `Twin: ${twinPlan.resultTemplateLabel} - change anytime in Avatar Studio.`
        : twinPlan.previewLine,
    };
    const avatarConfigToSave = twinPlan.willSwapTemplate
      ? applyBreedTemplateToAvatarConfig(
          avatarConfig,
          twinPlan.resultTemplateId,
          preview.profile.name,
        )
      : null;
    const saveCapturedAvatarConfig = avatarConfigToSave
      ? async () => {
          const result = await saveAvatarConfigIfCurrent(
            avatarConfigToSave,
            expectedAvatarConfigRevision,
          );
          expectedAvatarConfigRevision = result.revision;
          if (result.status === "failed") throw result.error;
          return result.status === "saved";
        }
      : null;

    const saveToken = Symbol("setup-save");
    setupSaveHandlingRef.current = saveToken;
    setSetupSaveStatus("saving");
    try {
      const outcome = await setupSaveCoordinator.save({
        saveCare: async () => {
          try {
            return await updateCareDocDurably((doc) => {
              const latestFromCare = createSetupWizardDraft(doc);
              const latest = consumerSurfacePolicy.householdSetupModes
                ? latestFromCare
                : makeSetupWizardDraftDeviceOnly(latestFromCare);
              const rebased = rebaseSetupDraft({
                base: saveBaseDraft,
                draft: saveDraft,
                dirtyFields: saveDirtyFields,
                latest,
              });
              if (
                createSetupCareDocumentFingerprint(doc) !==
                  saveBaseDocumentFingerprint ||
                rebased.conflicts.length > 0
              ) {
                sourceChangedDuringSaveRef.current = rebased;
                throw sourceChangedError;
              }

              const acceptedDoc = applySetupWizardDraft(doc, rebased.draft);
              acceptedCareSourceFingerprint =
                createSetupCareSourceFingerprint({
                  ...acceptedDoc,
                  version: saveCareVersion,
                });
              acceptedCareDocumentFingerprint =
                createSetupCareDocumentFingerprint(acceptedDoc);
              acceptedCareSourceFingerprintRef.current =
                acceptedCareSourceFingerprint;
              acceptedCareDocumentFingerprintRef.current =
                acceptedCareDocumentFingerprint;
              success.careSourceFingerprint =
                acceptedCareSourceFingerprint;
              success.careDocumentFingerprint =
                acceptedCareDocumentFingerprint;
              currentSetupScopeRef.current = {
                careScopeRevision,
                activePetId,
                careSourceFingerprint: acceptedCareSourceFingerprint,
                careDocumentFingerprint: acceptedCareDocumentFingerprint,
              };
              setupSaveScopeRef.current = currentSetupScopeRef.current;
              return acceptedDoc;
            });
          } catch (error) {
            if (error === sourceChangedError) return false;
            throw error;
          }
        },
        ...(avatarConfigToSave
          ? {
              // This is the same durable path used by Avatar Studio. The
              // exact revision reservation happens synchronously at the
              // serialized write boundary, so a newer Studio edit always wins.
              saveAvatar: saveCapturedAvatarConfig!,
            }
          : {}),
        isCurrent: () =>
          isSetupSaveFenceCurrent({
            acceptedCareDocumentFingerprint,
            captured: capturedSaveFence,
            current: currentSetupScopeRef.current,
          }),
        success,
      });
      if (setupSaveHandlingRef.current !== saveToken) return;
      if (
        (outcome.status === "saved" ||
          outcome.status === "avatar-failed" ||
          outcome.status === "avatar-stale") &&
        !isSetupSaveFenceCurrent({
          acceptedCareDocumentFingerprint:
            outcome.success.careDocumentFingerprint,
          captured: outcome.success,
          current: currentSetupScopeRef.current,
        })
      ) {
        setupSaveCoordinator.invalidate();
        return;
      }
      if (outcome.status === "saved") {
        completeSetupSave(outcome.success);
      } else if (outcome.status === "avatar-stale") {
        completeSetupSave({
          ...outcome.success,
          twinLine: "Your newer care twin update was kept.",
          templateLine:
            "Care foundation saved - review the twin in Avatar Studio anytime.",
        });
      } else if (outcome.status === "avatar-failed") {
        setSetupSaveStatus("avatar-failed");
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
      } else if (outcome.status === "care-rejected") {
        setSetupSaveStatus(
          sourceChangedDuringSaveRef.current
            ? "review-required"
            : "care-failed",
        );
        if (sourceChangedDuringSaveRef.current) {
          setSetupConflictFields(sourceChangedDuringSaveRef.current.conflicts);
        }
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
      } else {
        setSetupSaveStatus("idle");
      }
    } catch {
      if (setupSaveHandlingRef.current !== saveToken) return;
      setSetupSaveStatus(
        setupSaveCoordinator.hasPendingAvatarRetry()
          ? "avatar-failed"
          : "care-failed",
      );
    } finally {
      if (setupSaveHandlingRef.current === saveToken) {
        setupSaveHandlingRef.current = null;
      }
    }
  };

  const saveSetup = () => {
    if (!setupHydrated) return;
    if (!canSave) {
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
      notifyDialog("Almost there", saveBlockedMessage);
      return;
    }
    void persistSetup();
  };

  const retrySetupAvatarSave = async () => {
    if (retireStaleSetupSave()) return;
    if (setupSaveHandlingRef.current) return;
    const saveToken = Symbol("setup-avatar-retry");
    setupSaveHandlingRef.current = saveToken;
    setSetupSaveStatus("saving");
    try {
      const outcome = await setupSaveCoordinator.retryAvatar();
      if (setupSaveHandlingRef.current !== saveToken) return;
      if (
        (outcome.status === "saved" ||
          outcome.status === "avatar-failed" ||
          outcome.status === "avatar-stale") &&
        !isSetupSaveFenceCurrent({
          acceptedCareDocumentFingerprint:
            outcome.success.careDocumentFingerprint,
          captured: outcome.success,
          current: currentSetupScopeRef.current,
        })
      ) {
        setupSaveCoordinator.invalidate();
        return;
      }
      if (outcome.status === "saved") {
        completeSetupSave(outcome.success);
      } else if (outcome.status === "avatar-stale") {
        completeSetupSave({
          ...outcome.success,
          twinLine: "Your newer care twin update was kept.",
          templateLine:
            "Care foundation saved - review the twin in Avatar Studio anytime.",
        });
      } else if (outcome.status === "avatar-failed") {
        setSetupSaveStatus("avatar-failed");
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
      } else {
        setSetupSaveStatus("idle");
      }
    } catch {
      if (setupSaveHandlingRef.current !== saveToken) return;
      setSetupSaveStatus(
        setupSaveCoordinator.hasPendingAvatarRetry() ? "avatar-failed" : "idle",
      );
    } finally {
      if (setupSaveHandlingRef.current === saveToken) {
        setupSaveHandlingRef.current = null;
      }
    }
  };

  const meetDog = () => {
    void Haptics.selectionAsync().catch(() => {});
    setSuccessMoment(null);
    router.replace("/(tabs)");
  };

  const reviewPlan = () => {
    void Haptics.selectionAsync().catch(() => {});
    setSuccessMoment(null);
    router.replace("/calendar");
  };

  const finishLater = () => {
    if (setupSaveStatus === "saving") return;
    void Haptics.selectionAsync().catch(() => {});
    router.replace("/(tabs)");
  };
  const openAuthSetupProofMission = () => {
    if (setupSaveStatus === "saving") return;
    void Haptics.selectionAsync().catch(() => {});
    router.push("/care-twin-qa?qaSurface=auth-setup-onboarding-proof" as never);
  };

  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "setup",
  });
  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const keyboardOffset = getKeyboardAvoidingVerticalOffset({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "setup",
  });
  const modalSheetBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  if (setupLoadFailed) {
    return (
      <View style={[s.loadingRoot, { backgroundColor: colors.background }]}>
        <View
          accessible
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          style={s.loadFailureGroup}
        >
          <BoardCard style={s.loadFailureCard}>
            <Ionicons
              accessible={false}
              color={colors.destructive}
              name="shield-checkmark-outline"
              size={28}
            />
            <Text
              style={[
                s.loadFailureTitle,
                { color: colors.foreground, fontFamily: TITLE_SERIF },
              ]}
            >
              Setup couldn't load safely
            </Text>
            <Text
              style={[
                s.loadingText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {setupLoadFailureMessage}
            </Text>
          </BoardCard>
        </View>
        <Pressable
          accessibilityHint="Tries again without changing your saved care data"
          accessibilityLabel="Retry loading setup"
          accessibilityRole="button"
          onPress={retrySetupHydration}
          style={({ pressed }) => [
            s.loadRetryButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
          ]}
        >
          <Ionicons
            accessible={false}
            color="#FFFFFF"
            name="refresh-outline"
            size={18}
          />
          <Text style={[s.loadRetryText, { fontFamily: DISPLAY_SEMI }]}>
            Retry loading setup
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!setupHydrated) {
    return (
      <View
        accessibilityLabel="Preparing care setup"
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        style={[s.loadingRoot, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator accessible={false} color={colors.primary} />
        <Text
          style={[
            s.loadingText,
            { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          Preparing your care setup...
        </Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={[s.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <KeyboardAwareScrollViewCompat
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: topPadding,
            paddingBottom: bottomPadding,
            paddingHorizontal: 20,
          }}
        >
          <BoardRouteHeader
            kicker="Care foundation"
            title="Set up WoofWatcher"
            subtitle="One clean setup pass gives Home, Log, Reports, Records, and WoofGuide the context they need."
            icon="sparkles-outline"
          />

          <BoardCard style={s.progressCard}>
            <BoardSectionHeader
              title="Setup progress"
              accessory={
                <BoardPill
                  label={`${onboarding.completedCount}/${onboarding.totalCount} ready`}
                  tone={colors.primary}
                />
              }
            />
            <View style={s.progressTop}>
              <View>
                <Text
                  style={[
                    s.progressValue,
                    { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  {onboarding.completedCount}/{onboarding.totalCount}
                </Text>
                <Text
                  style={[
                    s.progressLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Steps to confirm before saving
                </Text>
              </View>
              <View
                style={[
                  s.percentPill,
                  { backgroundColor: colors.primary + "16" },
                ]}
              >
                <Text
                  style={[
                    s.percentText,
                    { color: colors.primary, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {onboarding.percent}%
                </Text>
              </View>
            </View>
            <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  s.progressFill,
                  {
                    width: `${onboarding.percent}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
            <View style={s.stepGrid}>
              {onboarding.steps.map((step) => (
                <View key={step.id} style={s.stepItem}>
                  <Ionicons
                    name={step.done ? "checkmark-circle" : "ellipse-outline"}
                    size={15}
                    color={step.done ? colors.sage : colors.mutedForeground}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      s.stepText,
                      {
                        color: step.done
                          ? colors.foreground
                          : colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {(() => {
                      const t = step.title
                        .replace("Set up ", "")
                        .replace("Add ", "");
                      return t.charAt(0).toUpperCase() + t.slice(1);
                    })()}
                  </Text>
                </View>
              ))}
            </View>
          </BoardCard>

          <Section title="Dog profile" icon="paw-outline">
            <Field
              accessibilityLabel="Dog name"
              label="Name"
              value={draft.dogName}
              placeholder="Phoenix"
              editable={!setupSaveLocked}
              onChangeText={(value) => setField("dogName", value)}
            />
            <Field
              label="Breed or mix"
              value={draft.breed}
              placeholder="German Shepherd mix"
              editable={!setupSaveLocked}
              onChangeText={(value) => setField("breed", value)}
            />
            <View style={s.twinPreview}>
              <View style={s.twinLineRow}>
                <Ionicons
                  name="sparkles-outline"
                  size={14}
                  color={colors.copper}
                />
                <Text
                  style={[
                    s.twinLineText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {twinPlan.previewLine}
                </Text>
              </View>
              {twinPlan.swapAvailable ? (
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel="Match twin to breed on save"
                  aria-checked={matchTwinToBreed}
                  accessibilityState={{
                    checked: matchTwinToBreed,
                    disabled: setupSaveLocked,
                  }}
                  aria-disabled={setupSaveLocked}
                  disabled={setupSaveLocked}
                  onPress={() => {
                    if (setupSaveLocked) return;
                    void Haptics.selectionAsync().catch(() => {});
                    setMatchTwinToBreed((value) => !value);
                  }}
                  style={({ pressed }) => [
                    s.twinToggle,
                    {
                      backgroundColor: matchTwinToBreed
                        ? colors.primary + "14"
                        : colors.background,
                      borderColor: matchTwinToBreed
                        ? colors.primary
                        : colors.border,
                      opacity: pressed ? 0.76 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={matchTwinToBreed ? "checkbox" : "square-outline"}
                    size={17}
                    color={
                      matchTwinToBreed ? colors.primary : colors.mutedForeground
                    }
                  />
                  <Text
                    style={[
                      s.twinToggleText,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    Match twin to breed on save
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={s.twoCol}>
              <Field
                label="Weight"
                value={draft.weight}
                placeholder="68"
                keyboardType="decimal-pad"
                editable={!setupSaveLocked}
                onChangeText={(value) => setField("weight", value)}
              />
              <Field
                label="Unit"
                value={draft.weightUnit}
                placeholder="lb"
                editable={!setupSaveLocked}
                onChangeText={(value) => setField("weightUnit", value)}
              />
            </View>
            <Field
              label="Care focus"
              value={draft.careFocus}
              placeholder="Support anxious eating and steady routines"
              multiline
              editable={!setupSaveLocked}
              onChangeText={(value) => setField("careFocus", value)}
            />
          </Section>

          <Section title="Diet baseline" icon="restaurant-outline">
            <Field
              label="Food"
              value={draft.primaryFood}
              placeholder="Sensitive kibble"
              editable={!setupSaveLocked}
              onChangeText={(value) => setField("primaryFood", value)}
            />
            <Field
              label="Normal portion"
              value={draft.normalPortion}
              placeholder="1 cup"
              editable={!setupSaveLocked}
              onChangeText={(value) => setField("normalPortion", value)}
            />
            <Field
              label="Meal schedule"
              value={draft.mealSchedule}
              placeholder="7 AM and 6 PM"
              editable={!setupSaveLocked}
              onChangeText={(value) => setField("mealSchedule", value)}
            />
          </Section>

          <Section title="Starter routine" icon="calendar-outline">
            <Text
              style={[
                s.fieldLabel,
                { color: colors.mutedForeground, fontFamily: "Inter_700Bold" },
              ]}
            >
              TYPE
            </Text>
            <View style={s.typeRow}>
              {ROUTINE_TYPES.map((item) => {
                const selected = draft.routineType === item.value;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Routine type ${item.label}`}
                    accessibilityState={{
                      disabled: setupSaveLocked,
                      selected,
                    }}
                    aria-disabled={setupSaveLocked}
                    aria-selected={selected}
                    disabled={setupSaveLocked}
                    onPress={() => {
                      if (setupSaveLocked) return;
                      void Haptics.selectionAsync().catch(() => {});
                      setField("routineType", item.value);
                    }}
                    style={({ pressed }) => [
                      s.typePill,
                      {
                        backgroundColor: selected
                          ? colors.primary
                          : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={14}
                      color={selected ? "#fff" : colors.primary}
                    />
                    <Text
                      style={[
                        s.typeText,
                        {
                          color: selected ? "#fff" : colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Field
              label="Routine name"
              value={draft.routineLabel}
              placeholder="Breakfast"
              editable={!setupSaveLocked}
              onChangeText={(value) => setField("routineLabel", value)}
            />
            <Field
              label="Time"
              value={draft.routineTime}
              placeholder="7:30 AM"
              editable={!setupSaveLocked}
              onChangeText={(value) => setField("routineTime", value)}
            />
          </Section>

          {consumerSurfacePolicy.householdSetupModes ? (
            <Section title="Household path" icon="home-outline">
              <Text
                style={[
                  s.fieldLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                HOW SHOULD THIS CARE HOME START?
              </Text>
              <View style={s.modeStack}>
                {HOUSEHOLD_MODES.map((item) => {
                  const selected = draft.householdMode === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: setupSaveLocked,
                        selected,
                      }}
                      aria-disabled={setupSaveLocked}
                      aria-selected={selected}
                      accessibilityLabel={`${item.label}. ${item.detail}`}
                      disabled={setupSaveLocked}
                      onPress={() => {
                        if (setupSaveLocked) return;
                        void Haptics.selectionAsync().catch(() => {});
                        setField("householdMode", item.value);
                      }}
                      style={({ pressed }) => [
                        s.modeCard,
                        {
                          backgroundColor: selected
                            ? colors.primary + "14"
                            : colors.background,
                          borderColor: selected
                            ? colors.primary
                            : colors.border,
                          opacity: pressed ? 0.76 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.modeIcon,
                          {
                            backgroundColor: selected
                              ? colors.primary
                              : colors.primary + "16",
                          },
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={16}
                          color={selected ? "#fff" : colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            s.modeTitle,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {item.label}
                        </Text>
                        <Text
                          style={[
                            s.modeDetail,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {item.detail}
                        </Text>
                      </View>
                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={
                          selected ? colors.primary : colors.mutedForeground
                        }
                      />
                    </Pressable>
                  );
                })}
              </View>
              <Field
                label="Household name"
                value={draft.householdName}
                placeholder={buildSetupHouseholdPlaceholder(draft.dogName)}
                editable={!setupSaveLocked}
                onChangeText={(value) => setField("householdName", value)}
              />
              {draft.householdMode === "join" && (
                <Field
                  label="Invite code"
                  value={draft.inviteCode}
                  placeholder="WW-42"
                  autoCapitalize="characters"
                  editable={!setupSaveLocked}
                  onChangeText={(value) => setField("inviteCode", value)}
                />
              )}
            </Section>
          ) : (
            <Section title="Care storage" icon="phone-portrait-outline">
              <View
                style={[
                  s.boundaryBox,
                  {
                    backgroundColor: colors.sage + "14",
                    borderColor: colors.sage + "44",
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color={colors.sage}
                />
                <Text
                  style={[
                    s.boundaryText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Your dog's profile, routines, logs, and records are saved
                  privately on this device.
                </Text>
              </View>
              <Text
                style={[
                  s.modeDetail,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                Use Privacy &amp; Safety to export a backup before changing or
                resetting this device.
              </Text>
            </Section>
          )}

          <Section title="Household caregiver" icon="people-outline">
            <Field
              accessibilityLabel="Caregiver name"
              label="Name"
              value={draft.caregiverName}
              placeholder="Apollo"
              editable={!setupSaveLocked}
              onChangeText={(value) => setField("caregiverName", value)}
            />
            <Field
              label="Role"
              value={draft.caregiverRole}
              placeholder="Primary caregiver"
              editable={!setupSaveLocked}
              onChangeText={(value) => setField("caregiverRole", value)}
            />
          </Section>

          <BoardCard style={s.confirmationCard}>
            <BoardSectionHeader
              title="After save"
              accessory={<BoardPill label="Review" tone={colors.amber} />}
            />
            <Text
              style={[
                s.confirmationTitle,
                { color: colors.foreground, fontFamily: DISPLAY_SEMI },
              ]}
            >
              {confirmation.title}
            </Text>
            <Text
              style={[
                s.householdLabel,
                { color: colors.primary, fontFamily: "Inter_700Bold" },
              ]}
            >
              {confirmation.householdLabel}
            </Text>
            <Text
              style={[
                s.confirmationDetail,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {confirmation.detail}
            </Text>
            <View style={s.confirmationRows}>
              {confirmation.nextActions.map((item) => (
                <View key={item} style={s.confirmationRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={15}
                    color={colors.sage}
                  />
                  <Text
                    style={[
                      s.confirmationItem,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {item}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={[
                s.boundaryBox,
                {
                  backgroundColor: colors.amber + "18",
                  borderColor: colors.amber + "55",
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={15}
                color={colors.copper}
              />
              <Text
                style={[
                  s.boundaryText,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {confirmation.syncLabel} {confirmation.providerBoundary}
              </Text>
            </View>
          </BoardCard>

          {ownerOps ? (
            <BoardCard style={s.authSetupProofCard}>
              <BoardSectionHeader
                title="Auth/Setup proof manifest"
                accessory={
                  <BoardPill label="Native proof blocked" tone={colors.amber} />
                }
              />
              <View style={s.authSetupProofGrid}>
                {authSetupProofManifest.rows.map((row) => (
                  <View
                    key={row.label}
                    style={[
                      s.authSetupProofCell,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.authSetupProofLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_800ExtraBold",
                        },
                      ]}
                    >
                      {row.label}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        s.authSetupProofValue,
                        {
                          color:
                            row.status === "ready" ? colors.sage : colors.amber,
                          fontFamily: "Inter_800ExtraBold",
                        },
                      ]}
                    >
                      {row.value}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        s.authSetupProofDetail,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {row.detail}
                    </Text>
                  </View>
                ))}
              </View>
              {authSetupProofManifest.blockers.map((blocker) => (
                <Text
                  key={blocker}
                  numberOfLines={2}
                  style={[
                    s.authSetupProofBlocker,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  - {blocker}
                </Text>
              ))}
            </BoardCard>
          ) : null}

          <View style={s.actions}>
            <Pressable
              onPress={saveSetup}
              accessibilityRole="button"
              accessibilityLabel={
                setupSaveStatus === "saving"
                  ? "Saving foundation"
                  : setupSaveStatus === "care-failed"
                    ? "Care foundation was not saved; retry below"
                    : setupSaveStatus === "avatar-failed"
                      ? "Care saved; retry twin update below"
                      : setupSaveStatus === "review-required"
                        ? "Shared care changed; review below"
                      : householdReady
                        ? "Save foundation"
                        : "Add invite code"
              }
              accessibilityHint={
                setupSaveStatus === "care-failed"
                  ? "Use the retry button below to save the preserved setup draft"
                  : setupSaveStatus === "avatar-failed"
                    ? "Use the retry button below to finish the care twin update without saving care twice"
                    : setupSaveStatus === "review-required"
                      ? "Review and choose how to resolve the updated shared care values below"
                    : canSave
                      ? undefined
                      : saveBlockedMessage
              }
              accessibilityState={{
                disabled: !canSave || setupSaveStatus !== "idle",
                busy: setupSaveStatus === "saving",
              }}
              aria-disabled={!canSave || setupSaveStatus !== "idle"}
              disabled={setupSaveStatus !== "idle"}
              style={({ pressed }) => [
                s.saveBtn,
                {
                  backgroundColor:
                    canSave && setupSaveStatus === "idle"
                      ? colors.primary
                      : colors.border,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              {setupSaveStatus === "saving" ? (
                <ActivityIndicator
                  accessible={false}
                  color={colors.mutedForeground}
                  size="small"
                />
              ) : (
                <Ionicons
                  accessible={false}
                  name="checkmark-circle"
                  size={18}
                  color={
                    canSave && setupSaveStatus === "idle"
                      ? colors.primaryForeground
                      : colors.mutedForeground
                  }
                />
              )}
              <Text
                style={[
                  s.saveText,
                  {
                    color:
                      canSave && setupSaveStatus === "idle"
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                {setupSaveStatus === "saving"
                  ? "Saving foundation..."
                  : setupSaveStatus === "care-failed"
                    ? "Care foundation not saved"
                    : setupSaveStatus === "avatar-failed"
                      ? "Care foundation saved"
                      : setupSaveStatus === "review-required"
                        ? "Review shared care changes"
                      : householdReady
                        ? "Save foundation"
                        : "Add invite code"}
              </Text>
            </Pressable>
            {setupSaveStatus === "review-required" ? (
              <View
                style={[
                  s.partialSaveCard,
                  {
                    backgroundColor: colors.amber + "16",
                    borderColor: colors.amber + "66",
                  },
                ]}
              >
                <View
                  accessible
                  accessibilityLiveRegion="assertive"
                  accessibilityRole="alert"
                  style={s.partialSaveAlert}
                >
                  <Text
                    style={[
                      s.partialSaveTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    Shared care changed while you were editing
                  </Text>
                  <Text
                    style={[
                      s.partialSaveDetail,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {setupConflictFields.length
                      ? `Both versions changed ${formatSectionList(
                          setupConflictFields.map(
                            (field) => SETUP_FIELD_LABEL[field],
                          ),
                        )}. Your edits are still shown. Choose which values to keep before saving.`
                      : "Your edits were kept, and untouched fields now show the latest shared care. Review the refreshed setup before saving."}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Keep my reviewed setup edits"
                  accessibilityRole="button"
                  onPress={keepReviewedSetupEdits}
                  style={({ pressed }) => [
                    s.partialSaveRetry,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    accessible={false}
                    color={colors.primaryForeground}
                    name="checkmark-circle-outline"
                    size={17}
                  />
                  <Text
                    style={[
                      s.partialSaveRetryText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    Keep my reviewed edits
                  </Text>
                </Pressable>
                {setupConflictFields.length ? (
                  <Pressable
                    accessibilityLabel="Use latest shared care values"
                    accessibilityRole="button"
                    onPress={useLatestSharedCareValues}
                    style={({ pressed }) => [
                      s.reviewSecondaryButton,
                      {
                        borderColor: colors.border,
                        opacity: pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.partialSaveRetryText,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Use latest for conflicts
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {setupSaveStatus === "care-failed" ? (
              <View
                style={[
                  s.partialSaveCard,
                  {
                    backgroundColor: colors.destructive + "12",
                    borderColor: colors.destructive + "66",
                  },
                ]}
              >
                <View
                  accessible
                  accessibilityLiveRegion="assertive"
                  accessibilityRole="alert"
                  style={s.partialSaveAlert}
                >
                  <Text
                    style={[
                      s.partialSaveTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    Care foundation wasn't saved
                  </Text>
                  <Text
                    style={[
                      s.partialSaveDetail,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Your setup draft is still here, and no care twin update was
                    attempted. Resolve any access notice, then retry when saving
                    is available.
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Retry saving care foundation"
                  accessibilityRole="button"
                  onPress={() => {
                    void persistSetup();
                  }}
                  style={({ pressed }) => [
                    s.partialSaveRetry,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    accessible={false}
                    color={colors.primaryForeground}
                    name="refresh-outline"
                    size={17}
                  />
                  <Text
                    style={[
                      s.partialSaveRetryText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    Retry saving care
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {setupSaveStatus === "avatar-failed" ? (
              <View
                style={[
                  s.partialSaveCard,
                  {
                    backgroundColor: colors.amber + "16",
                    borderColor: colors.amber + "66",
                  },
                ]}
              >
                <View
                  accessible
                  accessibilityLiveRegion="assertive"
                  accessibilityRole="alert"
                  style={s.partialSaveAlert}
                >
                  <Text
                    style={[
                      s.partialSaveTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    Care saved; twin update needs attention
                  </Text>
                  <Text
                    style={[
                      s.partialSaveDetail,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Your care foundation is preserved. The new twin template was
                    not saved, so WoofWatcher is not claiming that change yet.
                    Retry only the twin update below.
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Retry care twin update"
                  accessibilityRole="button"
                  onPress={() => {
                    void retrySetupAvatarSave();
                  }}
                  style={({ pressed }) => [
                    s.partialSaveRetry,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    accessible={false}
                    color={colors.primaryForeground}
                    name="refresh-outline"
                    size={17}
                  />
                  <Text
                    style={[
                      s.partialSaveRetryText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    Retry twin update
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {!canSave && saveBlockedMessage ? (
              <Text
                aria-live="polite"
                style={[
                  s.saveHint,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {saveBlockedMessage}
              </Text>
            ) : null}
            <Pressable
              onPress={finishLater}
              accessibilityRole="button"
              accessibilityLabel="Finish setup later"
              accessibilityState={{ disabled: setupSaveStatus === "saving" }}
              disabled={setupSaveStatus === "saving"}
              style={({ pressed }) => [
                s.laterBtn,
                {
                  opacity:
                    setupSaveStatus === "saving" ? 0.5 : pressed ? 0.65 : 1,
                },
              ]}
            >
              <Text
                style={[
                  s.laterText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                Finish later
              </Text>
            </Pressable>
            {ownerOps ? (
              <Pressable
                onPress={openAuthSetupProofMission}
                accessibilityRole="button"
                accessibilityLabel="Open auth and setup proof mission"
                accessibilityState={{ disabled: setupSaveStatus === "saving" }}
                disabled={setupSaveStatus === "saving"}
                style={({ pressed }) => [
                  s.proofBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    opacity:
                      setupSaveStatus === "saving"
                        ? 0.5
                        : pressed
                          ? 0.72
                          : 1,
                  },
                ]}
              >
                <Ionicons
                  accessible={false}
                  name="shield-checkmark-outline"
                  size={15}
                  color={colors.copper}
                />
                <Text
                  style={[
                    s.proofText,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  Open setup proof
                </Text>
              </Pressable>
            ) : null}
          </View>
        </KeyboardAwareScrollViewCompat>
      </KeyboardAvoidingView>

      {/* Save celebration: an in-app board sheet instead of a native alert,
          so the success moment works on every platform and hands off to
          Today or Plan without governance copy. */}
      <Modal
        visible={successMoment !== null}
        transparent
        animationType="slide"
        onRequestClose={meetDog}
      >
        <Pressable accessible={false} style={s.sheetBackdrop} onPress={meetDog}>
          <Pressable
            accessible={false}
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
          >
            <BoardCard
              style={[s.sheetCard, { paddingBottom: modalSheetBottomPadding }]}
            >
              <View
                style={[s.sheetHandle, { backgroundColor: colors.border }]}
              />
              <View
                style={[
                  s.sheetBadge,
                  { backgroundColor: colors.primary + "16" },
                ]}
              >
                <Ionicons name="sparkles" size={26} color={colors.primary} />
              </View>
              <Text
                style={[
                  s.sheetKicker,
                  { color: colors.copper, fontFamily: DISPLAY_SEMI },
                ]}
              >
                Care foundation saved
              </Text>
              <Text
                style={[
                  s.sheetTitle,
                  { color: colors.foreground, fontFamily: TITLE_SERIF },
                ]}
              >
                {successMoment?.twinLine}
              </Text>
              <Text
                style={[
                  s.sheetTwinLine,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {successMoment?.templateLine}
              </Text>
              <View style={s.sheetBoundaryRow}>
                <Ionicons
                  name="lock-closed-outline"
                  size={13}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    s.sheetBoundaryText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  Everything stays on this device.
                </Text>
              </View>
              <Pressable
                onPress={meetDog}
                accessibilityRole="button"
                accessibilityLabel={`Meet ${successMoment?.dogName ?? "your dog"}`}
                style={({ pressed }) => [
                  s.saveBtn,
                  s.sheetPrimaryBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="paw"
                  size={17}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    s.saveText,
                    {
                      color: colors.primaryForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  Meet {successMoment?.dogName ?? "your dog"}
                </Text>
              </Pressable>
              <Pressable
                onPress={reviewPlan}
                accessibilityRole="button"
                accessibilityLabel="Review plan"
                style={({ pressed }) => [
                  s.sheetSecondaryBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Text
                  style={[
                    s.sheetSecondaryText,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  Review plan
                </Text>
              </Pressable>
            </BoardCard>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IoniconName;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <BoardCard style={s.section}>
      <View style={s.sectionHead}>
        <View
          style={[s.sectionIcon, { backgroundColor: colors.primary + "16" }]}
        >
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <Text
          style={[
            s.sectionTitle,
            { color: colors.foreground, fontFamily: DISPLAY_SEMI },
          ]}
        >
          {title}
        </Text>
      </View>
      <View style={s.sectionBody}>{children}</View>
    </BoardCard>
  );
}

function Field({
  accessibilityLabel,
  label,
  value,
  placeholder,
  onChangeText,
  editable = true,
  multiline = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: {
  accessibilityLabel?: string;
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={[
          s.fieldLabel,
          { color: colors.mutedForeground, fontFamily: "Inter_700Bold" },
        ]}
      >
        {label.toUpperCase()}
      </Text>
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !editable }}
        aria-disabled={!editable}
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground + PLACEHOLDER_TEXT_ALPHA}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        style={[
          s.field,
          multiline ? s.fieldMultiline : null,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
            fontFamily: multiline ? "Inter_400Regular" : "Inter_600SemiBold",
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  loadFailureGroup: { width: "100%", maxWidth: 440 },
  loadFailureCard: { alignItems: "center", gap: 10 },
  loadFailureTitle: { fontSize: 22, lineHeight: 28, textAlign: "center" },
  loadRetryButton: {
    width: "100%",
    maxWidth: 440,
    minHeight: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  loadRetryText: { color: "#FFFFFF", fontSize: 15 },
  scroll: { flex: 1 },
  progressCard: { marginBottom: 16 },
  progressTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressValue: { fontSize: 28 },
  progressLabel: { fontSize: 12, marginTop: 1 },
  percentPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 13 },
  percentText: { fontSize: 13 },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 14,
  },
  progressFill: { height: "100%", borderRadius: 4 },
  stepGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 14 },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    width: "47%",
  },
  stepText: { fontSize: 11.5 },
  section: { marginBottom: 14 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 18 },
  sectionBody: { marginTop: 12, gap: 11 },
  fieldLabel: { fontSize: 10.5, letterSpacing: 0.5, marginBottom: 7 },
  field: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  fieldMultiline: { minHeight: 76, textAlignVertical: "top" },
  twoCol: { flexDirection: "row", gap: 10 },
  twinPreview: { gap: 8, marginTop: -3 },
  twinLineRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  twinLineText: { flex: 1, fontSize: 11.5, lineHeight: 16 },
  twinToggle: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  twinToggleText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 2 },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  typeText: { fontSize: 12.5 },
  modeStack: { gap: 9, marginBottom: 2 },
  modeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modeIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  modeTitle: { fontSize: 13.5 },
  modeDetail: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  confirmationCard: { marginBottom: 14 },
  confirmationTitle: { fontSize: 19, marginTop: 10 },
  householdLabel: { fontSize: 12, marginTop: 2 },
  confirmationDetail: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  confirmationRows: { gap: 8, marginTop: 12 },
  confirmationRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  confirmationItem: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  boundaryBox: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 13,
  },
  boundaryText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  authSetupProofCard: { marginBottom: 14 },
  authSetupProofGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  authSetupProofCell: {
    width: "48.5%",
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 8,
    padding: 9,
  },
  authSetupProofLabel: {
    fontSize: 9,
    lineHeight: 12,
    textTransform: "uppercase",
  },
  authSetupProofValue: { fontSize: 11, lineHeight: 14, marginTop: 4 },
  authSetupProofDetail: { fontSize: 10, lineHeight: 14, marginTop: 4 },
  authSetupProofBlocker: { fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  actions: { gap: 12, marginTop: 8 },
  saveBtn: {
    height: 54,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveText: { fontSize: 15.5 },
  partialSaveCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    gap: 12,
  },
  partialSaveAlert: { gap: 5 },
  partialSaveTitle: { fontSize: 16, lineHeight: 21 },
  partialSaveDetail: { fontSize: 12.5, lineHeight: 18 },
  partialSaveRetry: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reviewSecondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  partialSaveRetryText: { fontSize: 14 },
  saveHint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: -4,
    paddingHorizontal: 8,
  },
  laterBtn: { height: 42, alignItems: "center", justifyContent: "center" },
  laterText: { fontSize: 14 },
  proofBtn: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  proofText: { fontSize: 12.5 },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(8, 20, 36, 0.45)",
  },
  sheetCard: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 14,
  },
  sheetBadge: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  sheetKicker: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
  },
  sheetTitle: {
    fontSize: 23,
    lineHeight: 29,
    textAlign: "center",
    marginTop: 5,
  },
  sheetTwinLine: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
  },
  sheetBoundaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 12,
  },
  sheetBoundaryText: { fontSize: 11.5, lineHeight: 16 },
  sheetPrimaryBtn: { marginTop: 18 },
  sheetSecondaryBtn: {
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  sheetSecondaryText: { fontSize: 13.5 },
});

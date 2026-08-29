import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { selectSharedCareEvidence } from "@workspace/care-domain";

import {
  BoardCard,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
} from "@/components/board/BoardPrimitives";
import { PressScale } from "@/components/motion/GameFeel";
import { LivingPhoenixRoom } from "@/components/LivingPhoenixRoom";
import AvatarSpriteProductionPanel from "@/components/owner/AvatarSpriteProductionPanel";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { useAppFileSystem } from "@/context/AppFileSystemContext";
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import {
  useActiveCurrentTime,
  useRouteMotionActive,
} from "@/hooks/useActiveCurrentTime";
import { useColors } from "@/hooks/useColors";
import { announce } from "@/lib/announce";
import { deriveAvatarMotion } from "@/lib/avatarMotion";
import {
  activateAvatarDraftExitConfirmationLatch,
  createAvatarDraftExitConfirmationLatch,
  invalidateAvatarDraftExitConfirmationLatch,
  registerAvatarDraftExitRequestHandler,
  requestAvatarDraftExit,
} from "@/lib/avatarDraftExitGuard";
import { collectCareAppOwnedFileReferences } from "@/lib/appOwnedFileReferences";
import {
  deriveAvatarPreviewAccessories,
  deriveAvatarPreviewMood,
  deriveAvatarPreviewMotion,
} from "@/lib/avatarPreviewModel";
import {
  AVATAR_ACCESSORIES,
  AVATAR_EMOTE_STATES,
  AVATAR_TEMPLATES,
  createDefaultAvatarConfig,
  deriveAvatarAccessoryFit,
  describeAvatarConfig,
  getAvatarTemplate,
  shouldSyncAvatarStudioDraftFromContext,
  summarizeAvatarAccessoryFits,
  type AvatarAccessoryOption,
  type AvatarEmoteState,
  type AvatarFaceMarkingId,
  type AvatarTemplateId,
  type PetAvatarConfig,
} from "@/lib/avatarStudio";
import {
  getAvatarTemplateAccessorySource,
  getAvatarTemplateBaseSource,
  getAvatarTemplateDisplaySource,
  getAvatarTemplateEmoteSource,
} from "@/lib/avatarTemplateAssets";
import {
  getAvatarTemplateSpritePreview,
  hasAvatarTemplateSpritePack,
} from "@/lib/avatarTemplateSpriteAssets";
import { CARE_TWIN_SPRITE_MANIFEST } from "@/lib/avatarLifeEngine";
import { getCareTwinSpriteAsset } from "@/lib/careTwinAssets";
import {
  getFloatingFeedbackBottomOffset,
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import { resolveConsumerPetName } from "@/lib/petIdentity";
import { pixelImageStyle } from "@/lib/pixelRendering";
import { releasePickedMediaReferences } from "@/lib/pickedMediaLocalDataActions";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";
import { confirmThroughSteps, notifyDialog } from "@/lib/confirmDialog";

const DISPLAY = "Fredoka_700Bold";
const PIXEL_ROOM_SOURCE = require("@/assets/avatar/rooms/phoenix-room-day-option-b.png");
const PIXEL_HEAD_SOURCE = require("@/assets/avatar/phoenix/approved/phoenix-main-head-v2-crisp.png");

type StudioTab = "reference" | "template" | "customize" | "emotes";
const HERO_TEMPLATE_SPRITE_SIZE = 256;

const COAT_SWATCHES = [
  "#1B1714",
  "#C99052",
  "#F1E2C7",
  "#5B412F",
  "#E7E0D3",
  "#2F2F31",
  "#A86B3D",
  "#FFFFFF",
];

const FACE_MARKINGS: { id: AvatarFaceMarkingId; label: string }[] = [
  { id: "mask", label: "Mask" },
  { id: "blaze", label: "Blaze" },
  { id: "muzzle", label: "Muzzle" },
  { id: "eyebrows", label: "Brows" },
  { id: "patch", label: "Patch" },
  { id: "none", label: "None" },
];

const EMOTE_ICON: Record<AvatarEmoteState, PixelIconName> = {
  happy: "mood_great",
  calm: "mood_good",
  excited: "happy",
  bored: "clock",
  hungry: "meal",
  anxious: "anxious",
  sleepy: "clock",
  proud: "heart",
  home_alone: "note",
  not_feeling_well: "health",
};

function emoteLabel(state: AvatarEmoteState): string {
  return state
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function updateConfig(
  config: PetAvatarConfig,
  patch: Partial<PetAvatarConfig>,
): PetAvatarConfig {
  return {
    ...config,
    ...patch,
    accessorySlots: {
      ...config.accessorySlots,
      ...(patch.accessorySlots ?? {}),
    },
  };
}

function templateColor(templateId: AvatarTemplateId): string {
  const palette: Record<AvatarTemplateId, string> = {
    shepherd: "#2E5846",
    retriever: "#D8A852",
    husky: "#A8CBE8",
    bully: "#C96358",
    doodle: "#C99052",
    terrier: "#6DA36F",
    hound: "#8C6A4A",
    dachshund: "#B46A35",
    spaniel: "#E07A2F",
    toy: "#C96358",
    slender: "#9DBAA7",
    // Slate blue for mixed: the accent stays readable without reintroducing
    // a dark navy chip into the parchment catalog.
    mixed: "#5B7FA6",
  };
  return palette[templateId];
}

export interface AvatarStudioScreenProps {
  surface: "standalone" | "tabbed";
  onBack: () => void;
  onOpenSpriteQa: () => void;
}

function confirmAvatarDraftDiscard(
  onConfirmed: () => void,
  onCancelled: () => void,
): void {
  confirmThroughSteps(
    [
      {
        title: "Discard unsaved avatar changes?",
        message:
          "Your Avatar Studio edits have not been saved. Leave without saving them?",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        destructive: true,
      },
    ],
    onConfirmed,
    onCancelled,
  );
}

function clearAvatarDraftDirty(dirtyRef: { current: boolean }): void {
  dirtyRef.current = false;
}

export default function AvatarStudioScreen({
  surface,
  onBack,
  onOpenSpriteQa,
}: AvatarStudioScreenProps) {
  const colors = useColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const largeTextHero = fontScale >= 1.5;
  const appFileSystem = useAppFileSystem();
  const { state } = useCare();
  const careStateRef = useRef(state);
  careStateRef.current = state;
  const {
    avatarConfig,
    hasCustomAvatar,
    isLoaded: avatarIsLoaded,
    saveAvatarConfig,
    resetAvatarConfig,
  } = useAvatar();

  const petName = resolveConsumerPetName(state.profile.name);
  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface,
  });
  const bottomPadding =
    surface === "tabbed"
      ? getTabbedRouteBottomPadding({
          platform: Platform.OS,
          bottomInset: insets.bottom,
        })
      : getStandaloneRouteBottomPadding({
          platform: Platform.OS,
          bottomInset: insets.bottom,
        });
  const toastBottom =
    surface === "tabbed"
      ? getFloatingFeedbackBottomOffset({
          platform: Platform.OS,
          bottomInset: insets.bottom,
          surface: "tabbed",
        })
      : insets.bottom + 22;

  const [activeTab, setActiveTab] = useState<StudioTab>("reference");
  const [draft, setDraft] = useState<PetAvatarConfig>(() => avatarConfig);
  const [previewEmote, setPreviewEmote] = useState<AvatarEmoteState>("happy");
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const sourceUriRef = useRef<string | null>(null);
  const avatarStudioMountedRef = useRef(true);
  const avatarPickerInFlightRef = useRef(false);
  const avatarPersistenceInFlightRef = useRef(false);
  const avatarDraftDirtyRef = useRef(false);
  const avatarDraftExitConfirmationLatchRef = useRef(
    createAvatarDraftExitConfirmationLatch(),
  );
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [avatarPhotoBusy, setAvatarPhotoBusy] = useState(false);
  const [avatarPersistenceBusy, setAvatarPersistenceBusy] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const now = useActiveCurrentTime();
  const routeMotionActive = useRouteMotionActive();
  const avatarEditorDisabled = !avatarIsLoaded || avatarPersistenceBusy;

  const requestAvatarStudioExit = useCallback(
    (exit: () => void) =>
      requestAvatarDraftExit({
        dirty: avatarDraftDirtyRef.current,
        persistenceInFlight: avatarPersistenceInFlightRef.current,
        confirmationLatch: avatarDraftExitConfirmationLatchRef.current,
        confirmDiscard: confirmAvatarDraftDiscard,
        markClean: () => clearAvatarDraftDirty(avatarDraftDirtyRef),
        exit,
      }),
    [],
  );

  // Tab scenes remain mounted when another primary tab is active. Own the
  // global replacement guard only while More/Avatar is focused, otherwise an
  // unrelated Plans or Health reselect could consume this draft's exit latch.
  useFocusEffect(
    useCallback(() => {
      const confirmationLatch = avatarDraftExitConfirmationLatchRef.current;
      activateAvatarDraftExitConfirmationLatch(confirmationLatch);
      const unregister = registerAvatarDraftExitRequestHandler(
        requestAvatarStudioExit,
      );
      return () => {
        unregister();
        invalidateAvatarDraftExitConfirmationLatch(confirmationLatch);
      };
    }, [requestAvatarStudioExit]),
  );

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (
          !avatarDraftDirtyRef.current &&
          !avatarPersistenceInFlightRef.current
        ) {
          return;
        }
        event.preventDefault();
        requestAvatarDraftExit({
          dirty: avatarDraftDirtyRef.current,
          persistenceInFlight: avatarPersistenceInFlightRef.current,
          confirmationLatch: avatarDraftExitConfirmationLatchRef.current,
          confirmDiscard: confirmAvatarDraftDiscard,
          markClean: () => clearAvatarDraftDirty(avatarDraftDirtyRef),
          exit: () => navigation.dispatch(event.data.action),
        });
      }),
    [navigation],
  );

  const templateLife = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (
      shouldSyncAvatarStudioDraftFromContext({
        draftDirty: avatarDraftDirtyRef.current,
        persistenceInFlight: avatarPersistenceInFlightRef.current,
      })
    ) {
      setDraft(avatarConfig);
    }
  }, [avatarConfig]);

  useEffect(() => {
    avatarStudioMountedRef.current = true;
    return () => {
      avatarStudioMountedRef.current = false;
      avatarPickerInFlightRef.current = false;
      avatarPersistenceInFlightRef.current = false;
      if (savedToastTimerRef.current) {
        clearTimeout(savedToastTimerRef.current);
        savedToastTimerRef.current = null;
      }
      const uri = sourceUriRef.current;
      sourceUriRef.current = null;
      if (!uri) return;
      void releasePickedMediaReferences({
        appFileSystem,
        uris: [uri],
        protectedUris: collectCareAppOwnedFileReferences({
          doc: careStateRef.current,
          entries: careStateRef.current.entries,
        }),
      });
    };
  }, [appFileSystem]);

  useEffect(() => {
    if (reduced || !routeMotionActive) return; // Static while reduced, blurred, or backgrounded.
    const lifeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(templateLife, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(templateLife, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    lifeLoop.start();

    return () => {
      lifeLoop.stop();
      templateLife.setValue(0);
    };
  }, [reduced, routeMotionActive, templateLife]);

  const selectedTemplate = getAvatarTemplate(draft.templateId);
  const faceMarkingLabel =
    FACE_MARKINGS.find((marking) => marking.id === draft.faceMarkingId)
      ?.label ?? draft.faceMarkingId;
  const liveTemplateCount = useMemo(
    () =>
      AVATAR_TEMPLATES.filter((template) =>
        hasAvatarTemplateSpritePack(template.id),
      ).length,
    [],
  );
  const selectedTemplateBase = getAvatarTemplateBaseSource(draft.templateId);
  const selectedTemplateEmote = getAvatarTemplateEmoteSource(
    draft.templateId,
    previewEmote,
  );
  const selectedTemplateStillSource =
    selectedTemplateEmote ?? selectedTemplateBase ?? PIXEL_HEAD_SOURCE;
  const previewAccessories = useMemo(
    () => deriveAvatarPreviewAccessories(draft),
    [draft],
  );
  const accessoryFitSummary = useMemo(
    () => summarizeAvatarAccessoryFits(draft.templateId),
    [draft.templateId],
  );
  const previewAccessoryLayers = useMemo(
    () =>
      previewAccessories.map((layer) => ({
        ...layer,
        source: getAvatarTemplateAccessorySource(draft.templateId, layer.id),
      })),
    [draft.templateId, previewAccessories],
  );
  const previewMood = useMemo(
    () => deriveAvatarPreviewMood(previewEmote),
    [previewEmote],
  );
  const previewMotion = useMemo(
    () => deriveAvatarPreviewMotion(draft.templateId, previewEmote),
    [draft.templateId, previewEmote],
  );
  const templateSpritePreview = useMemo(
    () => getAvatarTemplateSpritePreview(draft.templateId, previewEmote),
    [draft.templateId, previewEmote],
  );
  const careTwinPreviewTrack = previewMotion.spriteAction
    ? CARE_TWIN_SPRITE_MANIFEST[previewMotion.spriteAction]
    : null;
  const careTwinPreviewAsset = previewMotion.spriteAction
    ? getCareTwinSpriteAsset(previewMotion.spriteAction)
    : null;
  const previewSpriteTrack =
    templateSpritePreview?.track ?? careTwinPreviewTrack;
  const previewSpriteAsset =
    templateSpritePreview?.asset ?? careTwinPreviewAsset;
  const previewIsSprite = Boolean(previewSpriteTrack && previewSpriteAsset);
  const previewMotionLabel =
    templateSpritePreview?.label ?? previewMotion.label;
  const avatarSummary = describeAvatarConfig(draft);
  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const sharedEntries = useMemo(
    () => selectSharedCareEvidence(state.entries, now),
    [state.entries, now],
  );
  const avatarMotion = useMemo(
    () =>
      deriveAvatarMotion({
        entries: sharedEntries,
        routines: state.routines,
        caregivers: state.caregivers,
        petName,
        now,
        energy: status.energy,
      }),
    [
      sharedEntries,
      state.routines,
      state.caregivers,
      petName,
      now,
      status.energy,
    ],
  );
  const caregiver = state.caregivers[0]?.name ?? "you";
  const templateLift = templateLife.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });
  const templateScale = templateLife.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.018],
  });
  const heroSpeech =
    activeTab === "emotes"
      ? previewMood.copy
      : activeTab === "customize"
        ? "Make me yours."
        : "I'm ready!";

  const ensurePermission = async (camera: boolean) => {
    if (Platform.OS === "web") return true;
    const fn = camera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const res = await fn();
    return res.granted;
  };

  const pick = async (camera: boolean) => {
    if (avatarPickerInFlightRef.current) return;
    avatarPickerInFlightRef.current = true;
    setAvatarPhotoBusy(true);
    let operationIntent = appFileSystem.captureIntent();
    let permissionDenied = false;
    try {
      const intent = operationIntent;
      if (!intent) return;

      const protectedPick = await appFileSystem.runProtectedPicker(
        intent,
        async () => {
          const ok = await ensurePermission(camera);
          if (!ok) permissionDenied = true;
          if (
            !ok ||
            !avatarStudioMountedRef.current ||
            !appFileSystem.isIntentCurrent(intent)
          ) {
            return null;
          }
          return camera
            ? ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                quality: 0.86,
              })
            : ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                quality: 0.86,
              });
        },
      );
      if (protectedPick.status === "revoked") return;
      if (permissionDenied) {
        if (avatarStudioMountedRef.current) {
          notifyDialog(
            "Permission needed",
            camera
              ? "Allow camera access in device Settings to take a reference photo. Your avatar choices still work without one."
              : "Allow photo-library access in device Settings to choose a reference photo. Your avatar choices still work without one.",
          );
        }
        return;
      }
      const res = protectedPick.value;
      if (!res || res.canceled || !res.assets?.[0]?.uri) return;

      const nextUri = res.assets[0].uri;
      if (
        !avatarStudioMountedRef.current ||
        !appFileSystem.isIntentCurrent(intent)
      ) {
        await releasePickedMediaReferences({
          appFileSystem,
          uris: [nextUri],
        });
        return;
      }

      const previousUri = sourceUriRef.current;
      sourceUriRef.current = nextUri;
      setSourceUri(res.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (previousUri && previousUri !== nextUri) {
        const cleanup = await releasePickedMediaReferences({
          appFileSystem,
          uris: [previousUri],
          protectedUris: [
            nextUri,
            ...collectCareAppOwnedFileReferences({
              doc: careStateRef.current,
              entries: careStateRef.current.entries,
            }),
          ],
        });
        if (
          cleanup.status === "partial-failure" &&
          avatarStudioMountedRef.current
        ) {
          notifyDialog(
            "Photo cleanup incomplete",
            "The new reference photo is selected, but the previous temporary photo could not be removed. Privacy & Data reset will retry cleanup.",
          );
        }
      }
    } catch (error) {
      if (
        avatarStudioMountedRef.current &&
        (!operationIntent || appFileSystem.isIntentCurrent(operationIntent))
      ) {
        notifyDialog(
          "Photo unavailable",
          camera
            ? "WoofWatcher could not open the camera. Your avatar choices were not changed. Try again from device Settings or use Gallery."
            : "WoofWatcher could not open the photo library. Your avatar choices were not changed. Try again.",
        );
      }
    } finally {
      avatarPickerInFlightRef.current = false;
      operationIntent = null;
      if (avatarStudioMountedRef.current) setAvatarPhotoBusy(false);
    }
  };

  const removeReferencePhoto = async () => {
    if (avatarPickerInFlightRef.current) return;
    const uri = sourceUriRef.current;
    if (!uri) return;
    avatarPickerInFlightRef.current = true;
    setAvatarPhotoBusy(true);
    sourceUriRef.current = null;
    setSourceUri(null);
    try {
      const cleanup = await releasePickedMediaReferences({
        appFileSystem,
        uris: [uri],
        protectedUris: collectCareAppOwnedFileReferences({
          doc: careStateRef.current,
          entries: careStateRef.current.entries,
        }),
      });
      if (
        cleanup.status === "partial-failure" &&
        avatarStudioMountedRef.current
      ) {
        notifyDialog(
          "Photo cleanup incomplete",
          "The reference was removed from this screen, but its temporary local file could not be deleted. Privacy & Data reset will retry cleanup.",
        );
      }
    } finally {
      avatarPickerInFlightRef.current = false;
      if (avatarStudioMountedRef.current) setAvatarPhotoBusy(false);
    }
  };

  const selectTemplate = (templateId: AvatarTemplateId) => {
    if (!avatarIsLoaded || avatarPersistenceInFlightRef.current) return;
    avatarDraftDirtyRef.current = true;
    const template = getAvatarTemplate(templateId);
    Haptics.selectionAsync().catch(() => {});
    setDraft((current) =>
      updateConfig(current, {
        templateId,
        earTypeId: template.defaultEarTypeId,
        muzzleTypeId: template.defaultMuzzleTypeId,
        emotePackId: template.recommendedEmotePackId,
      }),
    );
  };

  const setAccessory = (item: AvatarAccessoryOption) => {
    if (!avatarIsLoaded || avatarPersistenceInFlightRef.current) return;
    avatarDraftDirtyRef.current = true;
    Haptics.selectionAsync().catch(() => {});
    setDraft((current) =>
      updateConfig(current, {
        accessorySlots: { [item.slot]: item.id },
        collarId:
          item.slot === "neck" && item.id.includes("collar")
            ? (item.id as PetAvatarConfig["collarId"])
            : current.collarId,
      }),
    );
  };

  const selectStudioTab = (tab: StudioTab) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveTab(tab);
  };

  const setCoatColor = (swatch: string, primary: boolean) => {
    if (!avatarIsLoaded || avatarPersistenceInFlightRef.current) return;
    avatarDraftDirtyRef.current = true;
    Haptics.selectionAsync().catch(() => {});
    setDraft((current) =>
      updateConfig(
        current,
        primary ? { coatSecondary: swatch } : { coatPrimary: swatch },
      ),
    );
  };

  const setFaceMarking = (marking: AvatarFaceMarkingId) => {
    if (!avatarIsLoaded || avatarPersistenceInFlightRef.current) return;
    avatarDraftDirtyRef.current = true;
    Haptics.selectionAsync().catch(() => {});
    setDraft((current) => updateConfig(current, { faceMarkingId: marking }));
  };

  const previewMoodState = (emote: AvatarEmoteState) => {
    Haptics.selectionAsync().catch(() => {});
    setPreviewEmote(emote);
  };

  const requestAvatarStudioBack = () => {
    requestAvatarDraftExit({
      dirty: avatarDraftDirtyRef.current,
      persistenceInFlight: avatarPersistenceInFlightRef.current,
      confirmationLatch: avatarDraftExitConfirmationLatchRef.current,
      confirmDiscard: confirmAvatarDraftDiscard,
      markClean: () => clearAvatarDraftDirty(avatarDraftDirtyRef),
      exit: onBack,
    });
  };

  const saveDraft = async () => {
    if (!avatarIsLoaded || avatarPersistenceInFlightRef.current) return;
    avatarPersistenceInFlightRef.current = true;
    setAvatarPersistenceBusy(true);
    try {
      await saveAvatarConfig({
        ...draft,
        petName,
        updatedAt: new Date().toISOString(),
      });
      if (!avatarStudioMountedRef.current) return;
      avatarDraftDirtyRef.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      const savedMessage = `${petName}'s care twin saved`;
      setSavedToast(savedMessage);
      announce(savedMessage);
      if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
      savedToastTimerRef.current = setTimeout(() => {
        if (avatarStudioMountedRef.current) setSavedToast(null);
        savedToastTimerRef.current = null;
      }, 1600);
    } catch {
      if (avatarStudioMountedRef.current) {
        notifyDialog(
          "Avatar not saved",
          "WoofWatcher kept your visible draft, but could not save it on this device. Try again before leaving Avatar Studio.",
        );
      }
    } finally {
      avatarPersistenceInFlightRef.current = false;
      if (avatarStudioMountedRef.current) setAvatarPersistenceBusy(false);
    }
  };

  const resetDraft = async () => {
    if (!avatarIsLoaded || avatarPersistenceInFlightRef.current) return;
    avatarPersistenceInFlightRef.current = true;
    setAvatarPersistenceBusy(true);
    const clean = createDefaultAvatarConfig(petName);
    try {
      await resetAvatarConfig(petName);
      if (!avatarStudioMountedRef.current) return;
      avatarDraftDirtyRef.current = false;
      setDraft(clean);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      if (avatarStudioMountedRef.current) {
        notifyDialog(
          "Avatar not reset",
          "WoofWatcher could not save the reset on this device, so your current draft is still shown. Try again.",
        );
      }
    } finally {
      avatarPersistenceInFlightRef.current = false;
      if (avatarStudioMountedRef.current) setAvatarPersistenceBusy(false);
    }
  };

  const renderAvatarStudioHeader = (onBack: () => void) => (
    <BoardRouteHeader
      kicker="Pixel Twin"
      title="Avatar Studio"
      subtitle={
        avatarIsLoaded
          ? "Choose a pixel twin, then customize."
          : "Loading saved avatar choices…"
      }
      back
      onBack={onBack}
      backDisabled={avatarPersistenceBusy}
      actionIcon="checkmark"
      actionLabel="Save avatar"
      onAction={saveDraft}
      actionDisabled={avatarEditorDisabled}
      plain
    />
  );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {renderAvatarStudioHeader(requestAvatarStudioBack)}

        <BoardCard
          padded={false}
          style={[s.heroPreview, !largeTextHero && s.heroPreviewFixedAspect]}
        >
          <View
            style={[
              s.liveRoomStage,
              largeTextHero ? s.liveRoomStageLargeText : s.liveRoomStageFixed,
            ]}
          >
            {selectedTemplateBase ? (
              <View style={s.templatePreviewStage}>
                <Image
                  source={PIXEL_ROOM_SOURCE}
                  style={[StyleSheet.absoluteFill, pixelImageStyle]}
                  contentFit="cover"
                  transition={220}
                />
                <View
                  style={[
                    s.templateMoodAura,
                    { backgroundColor: previewMood.auraColor },
                  ]}
                  pointerEvents="none"
                />
                {!previewIsSprite &&
                previewAccessoryLayers.some(
                  (layer) => layer.kind === "bed" && layer.source,
                ) ? (
                  previewAccessoryLayers
                    .filter((layer) => layer.kind === "bed" && layer.source)
                    .map((layer) => (
                      <Image
                        key={layer.id}
                        source={layer.source}
                        style={[s.templateAccessoryLayer, pixelImageStyle]}
                        contentFit="contain"
                        transition={150}
                        pointerEvents="none"
                      />
                    ))
                ) : !previewIsSprite &&
                  previewAccessories.some((layer) => layer.kind === "bed") ? (
                  <View
                    style={[
                      s.templateAccessoryBed,
                      {
                        backgroundColor:
                          previewAccessories.find(
                            (layer) => layer.kind === "bed",
                          )?.tone ?? colors.stone,
                      },
                    ]}
                    pointerEvents="none"
                  />
                ) : null}
                <LinearGradient
                  colors={["rgba(255,249,239,0.08)", "rgba(8,26,42,0.16)"]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={s.templatePixelFloor} pointerEvents="none" />
                <View style={s.templatePixelLines} pointerEvents="none" />
                <Animated.View
                  style={[
                    s.templateHeroDogWrap,
                    {
                      transform: [
                        { translateY: templateLift },
                        { scale: templateScale },
                      ],
                    },
                  ]}
                >
                  {previewIsSprite && previewSpriteTrack ? (
                    <View
                      testID="avatar-studio-pixel-sprite-viewport"
                      style={[
                        s.templateSpriteViewport,
                        {
                          backgroundColor: "rgba(247,242,232,0.12)",
                          borderColor: colors.forest,
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.templateSpriteGround,
                          {
                            backgroundColor: colors.sage,
                            borderColor: colors.forest,
                          },
                        ]}
                        pointerEvents="none"
                      />
                      <SpriteSheetPlayer
                        asset={previewSpriteAsset}
                        track={previewSpriteTrack}
                        width={HERO_TEMPLATE_SPRITE_SIZE}
                        height={HERO_TEMPLATE_SPRITE_SIZE}
                        style={s.templateHeroSprite}
                        testID="avatar-studio-live-sprite-preview"
                      />
                    </View>
                  ) : (
                    <>
                      <Image
                        source={selectedTemplateStillSource}
                        style={[s.templateHeroDog, pixelImageStyle]}
                        contentFit="contain"
                        // Hard cut, not a cross-dissolve: fading a shepherd
                        // into a dachshund (very different bodies) morphed
                        // one dog into another - "two different dogs, legs
                        // grow." Swapping cleanly reads as a new dog, not a
                        // creature mutating.
                        transition={0}
                      />
                      {previewAccessoryLayers.map((layer) => {
                        if (layer.kind !== "bed" && layer.source) {
                          return (
                            <Image
                              key={layer.id}
                              source={layer.source}
                              style={[
                                s.templateAccessoryLayer,
                                pixelImageStyle,
                              ]}
                              contentFit="contain"
                              transition={150}
                              pointerEvents="none"
                            />
                          );
                        }
                        switch (layer.kind) {
                          case "bandana":
                            return (
                              <View
                                key={layer.id}
                                style={[
                                  s.templateBandana,
                                  { backgroundColor: layer.tone },
                                ]}
                                pointerEvents="none"
                              />
                            );
                          case "collar":
                            return (
                              <View
                                key={layer.id}
                                style={[
                                  s.templateCollar,
                                  { borderColor: layer.tone },
                                ]}
                                pointerEvents="none"
                              />
                            );
                          case "hat":
                            return (
                              <View
                                key={layer.id}
                                style={[
                                  s.templateHatWrap,
                                  { borderBottomColor: layer.tone },
                                ]}
                                pointerEvents="none"
                              >
                                <View
                                  style={[
                                    s.templateHatPom,
                                    { backgroundColor: layer.tone },
                                  ]}
                                />
                              </View>
                            );
                          case "mask":
                            return (
                              <View
                                key={layer.id}
                                style={[
                                  s.templateMask,
                                  { backgroundColor: layer.tone },
                                ]}
                                pointerEvents="none"
                              />
                            );
                          case "vest":
                            return (
                              <View
                                key={layer.id}
                                style={[
                                  s.templateVest,
                                  { backgroundColor: layer.tone },
                                ]}
                                pointerEvents="none"
                              />
                            );
                          case "sparkles":
                            return (
                              <View
                                key={layer.id}
                                style={s.templateSparkleCluster}
                                pointerEvents="none"
                              >
                                <View
                                  style={[
                                    s.templateSparkle,
                                    s.templateSparkleOne,
                                    { backgroundColor: layer.tone },
                                  ]}
                                />
                                <View
                                  style={[
                                    s.templateSparkle,
                                    s.templateSparkleTwo,
                                    { backgroundColor: layer.tone },
                                  ]}
                                />
                                <View
                                  style={[
                                    s.templateSparkle,
                                    s.templateSparkleThree,
                                    { backgroundColor: layer.tone },
                                  ]}
                                />
                              </View>
                            );
                          default:
                            return null;
                        }
                      })}
                    </>
                  )}
                </Animated.View>
                <View
                  style={[
                    s.templateSpeech,
                    {
                      backgroundColor: colors.ivory,
                      borderColor: colors.forest,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.templateSpeechText,
                      { color: colors.forest, fontFamily: DISPLAY },
                    ]}
                  >
                    {heroSpeech}
                  </Text>
                </View>
              </View>
            ) : (
              <LivingPhoenixRoom
                mood={avatarMotion.avatarMood}
                motion={avatarMotion}
                speech={
                  activeTab === "emotes"
                    ? "Try my moods."
                    : activeTab === "customize"
                      ? "Make me yours."
                      : "I'm ready."
                }
                energy={status.energy}
                presenceLabel={`${petName} with ${caregiver}`}
                nextLabel={
                  activeTab === "reference"
                    ? "Use a photo as a visual reference"
                    : selectedTemplate.label
                }
                avatarConfig={draft}
              />
            )}
          </View>
          {!largeTextHero ? (
            <LinearGradient
              colors={["transparent", "rgba(8,26,42,0.84)"]}
              style={s.savedScrim}
              pointerEvents="none"
            />
          ) : null}
          <View
            style={[
              s.heroCopy,
              largeTextHero ? s.heroCopyLargeText : s.heroCopyFixed,
            ]}
          >
            <View style={[s.softPill, { backgroundColor: colors.amberSoft }]}>
              <Ionicons
                name="color-palette-outline"
                size={12}
                color={colors.amber}
              />
              <Text
                style={[
                  s.softPillText,
                  {
                    color: colors.amber,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                Chosen by you
              </Text>
            </View>
            <Text
              numberOfLines={largeTextHero ? undefined : 1}
              adjustsFontSizeToFit={!largeTextHero}
              style={[s.savedName, { fontFamily: DISPLAY }]}
            >
              {petName}'s Pixel Twin
            </Text>
            <Text
              numberOfLines={largeTextHero ? undefined : 1}
              adjustsFontSizeToFit={false}
              style={[s.savedSub, { fontFamily: "Inter_600SemiBold" }]}
            >
              {previewIsSprite
                ? "Ready to move and react."
                : "Ready to personalize and save."}
            </Text>
          </View>
        </BoardCard>

        <View style={s.tabRow}>
          {(
            [
              ["reference", "Reference"],
              ["template", "Template"],
              ["customize", "Customize"],
              ["emotes", "Emotes"],
            ] as const
          ).map(([key, label]) => {
            const active = activeTab === key;
            return (
              <PressScale
                key={key}
                accessibilityRole="button"
                aria-selected={active}
                accessibilityLabel={`Avatar Studio ${label}`}
                hitSlop={MOBILE_INLINE_HIT_SLOP}
                onPress={() => selectStudioTab(key)}
                haptic="none"
                containerStyle={s.tabLayout}
                style={[
                  s.tab,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.tabText,
                    {
                      color: active
                        ? colors.primaryForeground
                        : colors.foreground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  {label}
                </Text>
              </PressScale>
            );
          })}
        </View>

        {activeTab === "reference" ? (
          <BoardCard style={s.avatarBoard}>
            <BoardSectionHeader
              title="Photo reference"
              accessory={<BoardPill label="Local only" tone={colors.sage} />}
            />
            <Text
              style={[
                s.copy,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              Choose one photo to compare beside your pixel twin. WoofWatcher
              does not analyze it, choose a template, or change any avatar
              option.
            </Text>
            {sourceUri ? (
              <View style={s.referenceCompareRow}>
                <View style={[s.referencePane, { borderColor: colors.border }]}>
                  <Image
                    source={{ uri: sourceUri }}
                    accessibilityLabel="Selected reference photo"
                    style={s.referenceImage}
                    contentFit="cover"
                  />
                  <Text
                    style={[
                      s.referenceLabel,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Your photo
                  </Text>
                </View>
                <View style={[s.referencePane, { borderColor: colors.border }]}>
                  <Image
                    source={selectedTemplateStillSource}
                    accessibilityLabel="Current manual pixel twin"
                    style={[s.referenceImage, pixelImageStyle]}
                    contentFit="contain"
                  />
                  <Text
                    style={[
                      s.referenceLabel,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Current care twin
                  </Text>
                </View>
              </View>
            ) : (
              <View
                accessibilityLabel="No reference photo selected"
                style={[
                  s.referenceEmpty,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.copy,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  No photo selected. You can build and save every avatar choice
                  without one.
                </Text>
              </View>
            )}
            <View style={s.actionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose dog photo from gallery"
                accessibilityState={{ disabled: avatarPhotoBusy }}
                disabled={avatarPhotoBusy}
                onPress={() => void pick(false)}
                style={({ pressed }) => [
                  s.secondaryBtn,
                  {
                    borderColor: colors.border,
                    opacity: avatarPhotoBusy ? 0.5 : pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="images-outline"
                  size={18}
                  color={colors.foreground}
                />
                <Text
                  style={[
                    s.secondaryBtnText,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  Gallery
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take dog photo"
                accessibilityState={{ disabled: avatarPhotoBusy }}
                disabled={avatarPhotoBusy}
                onPress={() => void pick(true)}
                style={({ pressed }) => [
                  s.primaryBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: avatarPhotoBusy ? 0.5 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="camera"
                  size={18}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    s.primaryBtnText,
                    {
                      color: colors.primaryForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  Take photo
                </Text>
              </Pressable>
            </View>
            {sourceUri ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove reference photo"
                accessibilityState={{ disabled: avatarPhotoBusy }}
                disabled={avatarPhotoBusy}
                onPress={() => void removeReferencePhoto()}
                style={s.referenceRemoveButton}
              >
                <Text
                  style={[
                    s.referenceRemoveText,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  Remove photo
                </Text>
              </Pressable>
            ) : null}
          </BoardCard>
        ) : null}

        {activeTab === "template" ? (
          <>
            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader
                title="Choose base template"
                accessory={
                  <BoardPill
                    label={`${liveTemplateCount} animated`}
                    tone={colors.primary}
                  />
                }
              />
              <View style={s.templateGrid}>
                {AVATAR_TEMPLATES.map((template) => {
                  const active = draft.templateId === template.id;
                  const tone = templateColor(template.id);
                  const liveSprite = hasAvatarTemplateSpritePack(template.id);
                  return (
                    <PressScale
                      key={template.id}
                      accessibilityRole="button"
                      aria-selected={active}
                      accessibilityLabel={`Choose ${template.label} avatar template`}
                      accessibilityState={{ disabled: avatarEditorDisabled }}
                      disabled={avatarEditorDisabled}
                      onPress={() => selectTemplate(template.id)}
                      haptic="none"
                      scaleTo={0.97}
                      containerStyle={s.templateTileLayout}
                      style={[
                        s.templateTile,
                        {
                          backgroundColor: active
                            ? tone + "20"
                            : colors.background,
                          borderColor: active ? tone : colors.border,
                          opacity: avatarEditorDisabled ? 0.5 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.templateArtWrap,
                          {
                            backgroundColor: active
                              ? colors.ivory
                              : tone + "12",
                            borderColor: active ? tone : colors.border,
                          },
                        ]}
                      >
                        <Image
                          source={getAvatarTemplateDisplaySource(template.id)}
                          style={[s.templateArt, pixelImageStyle]}
                          contentFit="contain"
                          transition={140}
                        />
                        <View
                          style={[
                            s.templateLiveBadge,
                            {
                              backgroundColor: liveSprite
                                ? colors.primary
                                : colors.ivory,
                              borderColor: liveSprite
                                ? colors.primary
                                : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.templateLiveBadgeText,
                              {
                                color: liveSprite
                                  ? colors.primaryForeground
                                  : colors.mutedForeground,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                          >
                            {liveSprite ? "Animated" : "Classic"}
                          </Text>
                        </View>
                        {active ? (
                          <View
                            style={[s.templateCheck, { backgroundColor: tone }]}
                          >
                            <Ionicons
                              name="checkmark"
                              size={13}
                              color="#FFF9EF"
                            />
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          s.templateTitle,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {template.label}
                      </Text>
                      <Text
                        style={[
                          s.templateSub,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        {template.subtitle}
                      </Text>
                      <Text
                        style={[
                          s.templateSpriteNote,
                          {
                            color: liveSprite ? tone : colors.mutedForeground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {liveSprite
                          ? "Moves with care moments"
                          : "A calm, still style"}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </BoardCard>

            <AvatarSpriteProductionPanel
              templateId={draft.templateId}
              onOpenSpriteQa={onOpenSpriteQa}
            />
          </>
        ) : null}

        {activeTab === "customize" ? (
          <View>
            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader
                title="Coat colors"
                accessory={<BoardPill label="Editable" tone={colors.sage} />}
              />
              <View style={s.swatchGrid}>
                {COAT_SWATCHES.map((swatch) => {
                  const primary = draft.coatPrimary === swatch;
                  const secondary = draft.coatSecondary === swatch;
                  return (
                    <PressScale
                      key={swatch}
                      accessibilityRole="button"
                      aria-selected={primary || secondary}
                      accessibilityLabel={`Set coat color ${swatch}`}
                      accessibilityState={{ disabled: avatarEditorDisabled }}
                      disabled={avatarEditorDisabled}
                      accessibilityHint={
                        primary
                          ? "Double tap to set this as the secondary coat color."
                          : "Double tap to set this as the primary coat color."
                      }
                      hitSlop={MOBILE_INLINE_HIT_SLOP}
                      onPress={() => setCoatColor(swatch, primary)}
                      haptic="none"
                      scaleTo={0.92}
                      style={[
                        s.swatch,
                        {
                          backgroundColor: swatch,
                          borderColor: primary
                            ? colors.forest
                            : secondary
                              ? colors.amber
                              : colors.border,
                          borderWidth: primary || secondary ? 3 : 1,
                          opacity: avatarEditorDisabled ? 0.5 : 1,
                        },
                      ]}
                    >
                      <View />
                    </PressScale>
                  );
                })}
              </View>
              <Text
                style={[
                  s.swatchLegend,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                Tap a swatch for the primary coat, then tap it again for the
                secondary. Your color choices are saved with your dog's profile.
              </Text>
            </BoardCard>

            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader
                title="Face markings"
                accessory={
                  <BoardPill label={faceMarkingLabel} tone={colors.amber} />
                }
              />
              <View style={s.optionGrid}>
                {FACE_MARKINGS.map((marking) => {
                  const active = draft.faceMarkingId === marking.id;
                  return (
                    <PressScale
                      key={marking.id}
                      accessibilityRole="button"
                      aria-selected={active}
                      accessibilityLabel={`Set ${marking.label} face marking`}
                      accessibilityState={{ disabled: avatarEditorDisabled }}
                      disabled={avatarEditorDisabled}
                      accessibilityHint="Double tap to apply this marking to the pixel twin."
                      hitSlop={MOBILE_INLINE_HIT_SLOP}
                      onPress={() => setFaceMarking(marking.id)}
                      haptic="none"
                      style={[
                        s.optionPill,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                          opacity: avatarEditorDisabled ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.optionText,
                          {
                            color: active
                              ? colors.primaryForeground
                              : colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {marking.label}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
              <Text
                style={[
                  s.swatchLegend,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                Your marking choice is saved with your dog's profile.
              </Text>
            </BoardCard>

            <BoardCard style={s.avatarBoard}>
              <BoardSectionHeader
                title="Accessories"
                accessory={<BoardPill label="Placement" tone={colors.amber} />}
              />
              <View
                style={[
                  s.accessoryFitPanel,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.accessoryFitTitle,
                    {
                      color: colors.sage,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  How accessories fit
                </Text>
                <Text
                  style={[
                    s.accessoryFitSummary,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {accessoryFitSummary}
                </Text>
              </View>
              <View style={s.accessoryGrid}>
                {AVATAR_ACCESSORIES.map((item) => {
                  const active = Object.values(draft.accessorySlots).includes(
                    item.id,
                  );
                  const fit = deriveAvatarAccessoryFit(draft.templateId, item);
                  return (
                    <PressScale
                      key={item.id}
                      accessibilityRole="button"
                      aria-selected={active}
                      accessibilityLabel={`Set ${item.label} ${item.slot} accessory`}
                      accessibilityState={{ disabled: avatarEditorDisabled }}
                      disabled={avatarEditorDisabled}
                      onPress={() => setAccessory(item)}
                      haptic="none"
                      scaleTo={0.97}
                      containerStyle={s.accessoryTileLayout}
                      style={[
                        s.accessoryTile,
                        {
                          backgroundColor: active
                            ? item.tone + "20"
                            : colors.background,
                          borderColor: active ? item.tone : colors.border,
                          opacity: avatarEditorDisabled ? 0.5 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[s.accessoryDot, { backgroundColor: item.tone }]}
                      />
                      <Text
                        style={[
                          s.accessoryLabel,
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
                          s.accessorySlot,
                          {
                            color: colors.sage,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {item.slot}
                      </Text>
                      <Text
                        style={[
                          s.accessoryFitLabel,
                          {
                            color:
                              fit.status === "template-fitted"
                                ? colors.sage
                                : colors.amber,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {fit.label}
                      </Text>
                      <Text
                        style={[
                          s.accessoryFitHint,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {fit.placementHint}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </BoardCard>
          </View>
        ) : null}

        {activeTab === "emotes" ? (
          <BoardCard style={s.avatarBoard}>
            <BoardSectionHeader
              title="Mood set"
              accessory={
                <BoardPill
                  label={
                    draft.emotePackId === "phoenix-shepherd"
                      ? "Full mood set"
                      : "Starter"
                  }
                  tone={colors.primary}
                />
              }
            />
            <Text
              style={[
                s.copy,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              Choose a mood to see how your care twin looks. Animated moods
              move; classic moods use a hand-drawn pose.
            </Text>
            <View style={s.moodGrid}>
              {AVATAR_EMOTE_STATES.map((emote) => {
                const active = previewEmote === emote;
                const moodPreview = deriveAvatarPreviewMood(emote);
                const moodStill = getAvatarTemplateEmoteSource(
                  draft.templateId,
                  emote,
                );
                // Honest live/still: only moods that resolve to a real sprite
                // rig animate. The rest show a still pose - badge it so a
                // still mood never reads as a broken one.
                const chipIsLive = Boolean(
                  getAvatarTemplateSpritePreview(draft.templateId, emote) ||
                  deriveAvatarPreviewMotion(draft.templateId, emote)
                    .spriteAction,
                );
                return (
                  <PressScale
                    key={emote}
                    accessibilityRole="button"
                    aria-selected={active}
                    accessibilityLabel={`Preview ${emoteLabel(emote)} mood`}
                    accessibilityHint="Double tap to preview this care-twin mood."
                    hitSlop={MOBILE_INLINE_HIT_SLOP}
                    onPress={() => previewMoodState(emote)}
                    haptic="none"
                    scaleTo={0.94}
                    containerStyle={s.moodChip}
                    style={s.moodChipInner}
                  >
                    <View
                      style={[
                        s.moodThumbWrap,
                        {
                          borderColor: active
                            ? moodPreview.chipColor
                            : colors.border,
                          backgroundColor: active
                            ? moodPreview.auraColor
                            : colors.card,
                        },
                      ]}
                    >
                      <Image
                        source={moodStill ?? PIXEL_HEAD_SOURCE}
                        style={[s.moodThumb, pixelImageStyle]}
                        contentFit="contain"
                        transition={150}
                      />
                      <View
                        pointerEvents="none"
                        style={[
                          s.moodWash,
                          {
                            opacity: moodStill ? 0.24 : 1,
                            backgroundColor:
                              emote === "not_feeling_well"
                                ? "rgba(201,99,88,0.22)"
                                : emote === "anxious" || emote === "home_alone"
                                  ? "rgba(168,203,232,0.22)"
                                  : emote === "sleepy" || emote === "calm"
                                    ? "rgba(109,163,111,0.18)"
                                    : "rgba(216,168,82,0.12)",
                          },
                        ]}
                      />
                      <View
                        style={[s.emoteIcon, { backgroundColor: colors.ivory }]}
                      >
                        <PixelIcon name={EMOTE_ICON[emote]} size={18} />
                      </View>
                      <View
                        style={[
                          s.moodLiveBadge,
                          {
                            backgroundColor: chipIsLive
                              ? colors.primary
                              : colors.ivory,
                            borderColor: chipIsLive
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.moodLiveBadgeText,
                            {
                              color: chipIsLive
                                ? colors.primaryForeground
                                : colors.mutedForeground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {chipIsLive ? "Animated" : "Classic"}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        s.moodChipLabel,
                        {
                          color: active
                            ? colors.foreground
                            : colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {emoteLabel(emote)}
                    </Text>
                  </PressScale>
                );
              })}
            </View>
          </BoardCard>
        ) : null}

        <View style={s.actionRow}>
          <Pressable
            onPress={() => void resetDraft()}
            disabled={avatarEditorDisabled}
            accessibilityState={{ disabled: avatarEditorDisabled }}
            accessibilityRole="button"
            accessibilityLabel="Reset Avatar Studio draft"
            accessibilityHint="Restores the default pixel twin before saving."
            hitSlop={MOBILE_INLINE_HIT_SLOP}
            style={({ pressed }) => [
              s.secondaryBtn,
              {
                borderColor: colors.border,
                opacity: avatarEditorDisabled ? 0.5 : pressed ? 0.65 : 1,
              },
            ]}
          >
            <Ionicons name="refresh" size={18} color={colors.foreground} />
            <Text
              style={[
                s.secondaryBtnText,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              Reset
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void saveDraft()}
            disabled={avatarEditorDisabled}
            accessibilityState={{ disabled: avatarEditorDisabled }}
            accessibilityRole="button"
            accessibilityLabel="Save Avatar Studio draft"
            accessibilityHint="Saves the current pixel twin configuration locally."
            hitSlop={MOBILE_INLINE_HIT_SLOP}
            style={({ pressed }) => [
              s.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: avatarEditorDisabled ? 0.5 : pressed ? 0.82 : 1,
              },
            ]}
          >
            <Ionicons name="heart" size={18} color={colors.primaryForeground} />
            <Text
              style={[
                s.primaryBtnText,
                {
                  color: colors.primaryForeground,
                  fontFamily: "Inter_700Bold",
                },
              ]}
            >
              Save Avatar
            </Text>
          </Pressable>
        </View>

        {hasCustomAvatar ? (
          <BoardCard style={s.tipBoard} tone="soft">
            <Text
              style={[
                s.tipText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              Your saved mood images still work with these editable care-twin
              choices.
            </Text>
          </BoardCard>
        ) : (
          <BoardCard style={s.tipBoard} tone="soft">
            <Text
              style={[
                s.tipText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              Build your care twin with the choices above. A photo is optional
              and stays only on this screen while you compare.
            </Text>
          </BoardCard>
        )}
      </ScrollView>

      {savedToast ? (
        <View
          accessibilityLiveRegion="polite"
          aria-live="polite"
          style={[
            s.toast,
            { backgroundColor: colors.primary, bottom: toastBottom },
          ]}
        >
          <Text
            style={[
              s.toastText,
              { color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {savedToast}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  /* Mock-board soft pills: sageSoft/amberSoft chips with forest/amber text. */
  softPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    minHeight: 28,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  softPillText: {
    fontSize: 11,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  heroPreview: {
    overflow: "hidden",
    marginBottom: 10,
    backgroundColor: "#081424",
    position: "relative",
  },
  heroPreviewFixedAspect: {
    aspectRatio: 0.96,
  },
  liveRoomStage: {
    overflow: "hidden",
  },
  liveRoomStageFixed: {
    ...StyleSheet.absoluteFillObject,
  },
  liveRoomStageLargeText: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
  },
  templatePreviewStage: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: "#EDE7DC",
  },
  templatePixelFloor: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 68,
    height: 44,
    borderRadius: 2,
    backgroundColor: "rgba(109,163,111,0.22)",
    borderWidth: 2,
    borderColor: "rgba(8,20,36,0.18)",
    transform: [{ scaleX: 1.08 }, { skewX: "-8deg" }],
  },
  templatePixelLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    borderWidth: 2,
    borderColor: "#081424",
    margin: 10,
  },
  templateHeroDogWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 58,
    height: "76%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  templateHeroDog: {
    width: "100%",
    height: "100%",
  },
  templateSpriteViewport: {
    width: 272,
    height: 272,
    borderRadius: 3,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
    position: "relative",
  },
  templateSpriteGround: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 15,
    height: 26,
    borderRadius: 2,
    borderWidth: 2,
    opacity: 0.28,
    transform: [{ skewX: "-8deg" }],
  },
  templateHeroSprite: {
    marginBottom: 7,
  },
  templateAccessoryLayer: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  templateMoodAura: {
    position: "absolute",
    left: 40,
    right: 40,
    top: 24,
    bottom: 56,
    borderRadius: 120,
  },
  templateAccessoryBed: {
    position: "absolute",
    bottom: 28,
    left: "50%",
    marginLeft: -62,
    width: 124,
    height: 28,
    borderRadius: 18,
    opacity: 0.48,
  },
  templateBandana: {
    position: "absolute",
    top: 88,
    width: 48,
    height: 18,
    borderRadius: 10,
    opacity: 0.94,
  },
  templateCollar: {
    position: "absolute",
    top: 90,
    width: 44,
    height: 14,
    borderRadius: 9,
    borderWidth: 3,
    backgroundColor: "rgba(255,249,239,0.72)",
  },
  templateHatWrap: {
    position: "absolute",
    top: 2,
    left: "50%",
    marginLeft: -18,
    width: 0,
    height: 0,
    borderLeftWidth: 18,
    borderRightWidth: 18,
    borderBottomWidth: 28,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    transform: [{ rotate: "-6deg" }],
  },
  templateHatPom: {
    position: "absolute",
    top: -8,
    left: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  templateMask: {
    position: "absolute",
    top: 60,
    width: 56,
    height: 16,
    borderRadius: 10,
    opacity: 0.82,
  },
  templateVest: {
    position: "absolute",
    top: 98,
    width: 58,
    height: 38,
    borderRadius: 16,
    opacity: 0.76,
  },
  templateSparkleCluster: {
    position: "absolute",
    top: 40,
    right: 12,
    width: 42,
    height: 38,
  },
  templateSparkle: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 5,
    opacity: 0.92,
  },
  templateSparkleOne: { top: 4, right: 5 },
  templateSparkleTwo: { top: 14, left: 4 },
  templateSparkleThree: { bottom: 2, right: 14 },
  templateSpeech: {
    position: "absolute",
    left: 24,
    top: 24,
    maxWidth: "52%",
    borderRadius: 6,
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  templateSpeechText: { fontSize: 15, lineHeight: 19 },
  templateHeroHud: {
    position: "absolute",
    right: 12,
    bottom: 44,
    minWidth: 96,
    maxWidth: 142,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  templateHeroKicker: {
    fontSize: 8.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  templateHeroTitle: { fontSize: 17, lineHeight: 20 },
  templateHeroMood: { fontSize: 10, lineHeight: 13 },
  templateHeroFit: { fontSize: 8.8, lineHeight: 11, maxWidth: 126 },
  savedScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "24%",
  },
  heroCopy: {
    gap: 3,
  },
  heroCopyFixed: {
    position: "absolute",
    left: 14,
    width: "64%",
    bottom: 10,
  },
  heroCopyLargeText: {
    position: "relative",
    width: "100%",
    backgroundColor: "#081424",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  savedName: { color: "#FFF9EF", fontSize: 17.5, lineHeight: 20 },
  savedSub: { color: "rgba(255,249,239,0.82)", fontSize: 9.4, lineHeight: 12 },
  tabRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 10,
  },
  tabLayout: { flex: 1 },
  tab: {
    width: "100%",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 11.5 },
  avatarBoard: { marginBottom: 10 },
  copy: { fontSize: 13, lineHeight: 19 },
  referenceCompareRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  referencePane: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  referenceImage: { width: "100%", aspectRatio: 1, borderRadius: 6 },
  referenceLabel: { fontSize: 12, textAlign: "center" },
  referenceEmpty: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    justifyContent: "center",
    marginTop: 12,
  },
  referenceRemoveButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  referenceRemoveText: { fontSize: 14 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 12 },
  secondaryBtn: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtnText: { fontSize: 14 },
  primaryBtn: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: { fontSize: 14 },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  templateTileLayout: {
    flexBasis: "48%",
    flexGrow: 1,
  },
  templateTile: {
    width: "100%",
    minHeight: Math.max(178, MIN_MOBILE_TOUCH_TARGET),
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 7,
  },
  templateArtWrap: {
    width: "100%",
    aspectRatio: 1.26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  templateArt: {
    width: "92%",
    height: "92%",
  },
  templateCheck: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 23,
    height: 23,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF9EF",
  },
  templateLiveBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    minHeight: 22,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  templateLiveBadgeText: {
    fontSize: 9,
    textTransform: "uppercase",
  },
  templateTitle: { fontSize: 13.5 },
  templateSub: { fontSize: 11.5, lineHeight: 16 },
  templateSpriteNote: { fontSize: 10.5, lineHeight: 14, marginTop: "auto" },
  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  swatchLegend: { fontSize: 11.5, lineHeight: 15, marginTop: 8 },
  swatch: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
  },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionPill: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { fontSize: 12 },
  accessoryFitPanel: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  accessoryFitTitle: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  accessoryFitSummary: { fontSize: 12, lineHeight: 17 },
  accessoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  accessoryTileLayout: {
    flexBasis: "47.5%",
    flexGrow: 1,
  },
  accessoryTile: {
    width: "100%",
    minHeight: Math.max(126, MIN_MOBILE_TOUCH_TARGET),
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    justifyContent: "flex-start",
    gap: 5,
  },
  accessoryDot: { width: 18, height: 18, borderRadius: 5 },
  accessoryLabel: { fontSize: 12.5 },
  accessorySlot: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  accessoryFitLabel: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  accessoryFitHint: { fontSize: 10.5, lineHeight: 14 },
  moodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  moodChip: {
    width: "30.9%",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  moodChipInner: {
    width: "100%",
    alignItems: "center",
  },
  moodThumbWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 6,
    position: "relative",
  },
  moodThumb: { width: "100%", height: "100%" },
  moodWash: {
    ...StyleSheet.absoluteFillObject,
  },
  emoteIcon: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  moodLiveBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  moodLiveBadgeText: {
    fontSize: 8.5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  moodChipLabel: { fontSize: 10.5, textAlign: "center" },
  tipBoard: { marginTop: 2 },
  tipText: { fontSize: 12.5, lineHeight: 18, textAlign: "center" },
  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: { fontSize: 13 },
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetMe } from "@workspace/api-client-react";
import {
  buildCarePass,
  deriveAccessPassPlan,
  deriveHouseholdAccessPlan,
} from "@workspace/care-domain";

import {
  BoardActionButton,
  BoardCard,
  BoardMetricTile,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
  BoardSegmentTabs,
  BoardStatusPill,
} from "@/components/board/BoardPrimitives";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { BoardMedallion, type MedallionName } from "@/components/BoardMedallion";
import { PersonPortrait } from "@/components/PersonPortrait";
import { PressScale } from "@/components/motion/GameFeel";
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { getAvatarTemplate } from "@/lib/avatarStudio";
import { confirmThroughSteps, notifyDialog } from "@/lib/confirmDialog";
import { deriveCareCareer, deriveCareStreak } from "@/lib/careCareer";
import {
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import {
  addItem,
  cycleStatus,
  DEFAULT_SUPPLIES,
  inspectSuppliesStorage,
  isDefaultUntouched,
  isTravelBagReady,
  removeItem,
  renameItem,
  type SupplyGroup,
  type SupplyItem,
  type SupplyStatus,
} from "@/lib/packSupplies";
import {
  activateTravelBag,
  completeTravelBag,
  defaultTravelBag,
  inspectTravelBagStorage,
  redoTravelBag,
  renameTravelBag,
  reopenTravelBag,
  resetTravelItems,
  type TravelBagSession,
} from "@/lib/travelBag";
import {
  createPackWriteCoordinator,
  getPackStorageKey,
  inspectPackStateStorage,
  serializePackState,
  type PackStoredState,
  type PackWriteCoordinator,
} from "@/lib/packStorage";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";
import { resolvePetName } from "@/lib/petIdentity";
import { relativeTime } from "@/lib/time";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type HouseholdMemberSummary = {
  displayName?: string | null;
  email?: string | null;
  role?: string | null;
  isSelf?: boolean;
};

type PackSegment = "supplies" | "pets" | "people" | "access" | "carepass";

const PACK_SEGMENTS: readonly { key: PackSegment; label: string }[] = [
  { key: "supplies", label: "Supplies" },
  { key: "pets", label: "Pets" },
  { key: "people", label: "People" },
  { key: "access", label: "Access" },
  { key: "carepass", label: "Care Pass" },
];

// Device-local supplies checklist (the mockup Pack page's Essentials and
// Travel Bag boards). Keeps the "woofwatcher" key prefix so the privacy
// erase-all-data flow removes it with every other WoofWatcher key.
const LEGACY_PACK_SUPPLIES_KEY = "woofwatcher.packSupplies.v1";
const LEGACY_TRAVEL_BAG_KEY = "woofwatcher.travelBag.v1";

/** Mockup icon language for the starter items; custom items stay neutral. */
const SUPPLY_ICONS: Record<string, PixelIconName> = {
  "essentials-food": "meal",
  "essentials-treats": "treat",
  "essentials-medications": "medication",
  "essentials-poop-bags": "poo",
  "essentials-toys": "play",
  "travel-harness": "bond",
  "travel-leash": "walk",
  "travel-portable-bowl": "meal",
};

function supplyIcon(item: SupplyItem): PixelIconName {
  return SUPPLY_ICONS[item.id] ?? "note";
}

const SUPPLY_GROUP_TITLES: Record<SupplyGroup, string> = {
  essentials: "Essentials",
  travel: "Travel bag",
};

/**
 * Supplies status pill. BoardStatusPill (read-only primitive) has no rose
 * tone and no icon slot, so this clones its exact geometry and typography
 * and adds the two supply-specific looks: rose "Out" and the checkmarked
 * sage "Packed". Every word is the owner's own answer - no predictions.
 */
function SupplyStatusPill({ status }: { status: SupplyStatus }) {
  const colors = useColors();
  const look: Record<SupplyStatus, { label: string; bg: string; fg: string; icon?: IoniconName }> = {
    unconfirmed: { label: "Unconfirmed", bg: colors.muted, fg: colors.mutedForeground },
    plenty: { label: "Plenty", bg: colors.sageSoft, fg: colors.forest },
    low: { label: "Low", bg: colors.amberSoft, fg: colors.amber },
    out: { label: "Out", bg: colors.rose + "1C", fg: colors.rose },
    packed: { label: "Packed", bg: colors.sageSoft, fg: colors.forest, icon: "checkmark" },
    unpacked: { label: "Unpacked", bg: colors.muted, fg: colors.mutedForeground },
  };
  const swatch = look[status];
  return (
    <View style={[s.supplyPill, { backgroundColor: swatch.bg }]}>
      {swatch.icon ? <Ionicons name={swatch.icon} size={11} color={swatch.fg} /> : null}
      <Text style={[s.supplyPillText, { color: swatch.fg, fontFamily: "Inter_700Bold" }]}>
        {swatch.label}
      </Text>
    </View>
  );
}

/**
 * One checklist row: pixel icon chip, ink name, user-set status pill, and -
 * only once the owner has actually answered - an honest "Updated ..." line.
 * Tap cycles the status (springy PressScale with its built-in haptic);
 * long-press opens the inline rename/remove editor.
 */
function SupplyRow({
  item,
  now,
  onCycle,
  onEdit,
  last,
}: {
  item: SupplyItem;
  now: number;
  onCycle: (item: SupplyItem) => void;
  onEdit: (item: SupplyItem) => void;
  last?: boolean;
}) {
  const colors = useColors();
  const rel = item.updatedAt ? relativeTime(item.updatedAt, now) : null;
  const updatedLabel = rel ? (rel === "Just now" ? "Updated just now" : `Updated ${rel}`) : null;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${item.name}: ${item.status}${updatedLabel ? `. ${updatedLabel}` : ""}`}
      accessibilityHint="Tap to cycle the status. Long press to rename or remove."
      onPress={() => onCycle(item)}
      onLongPress={() => onEdit(item)}
      delayLongPress={350}
      scaleTo={0.97}
      style={[s.supplyRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
    >
      <View style={[s.linkChip, { backgroundColor: colors.secondary }]}>
        <PixelIcon name={supplyIcon(item)} size={20} />
      </View>
      <View style={s.linkCopy}>
        <Text
          numberOfLines={1}
          style={[s.supplyName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
        >
          {item.name}
        </Text>
        {updatedLabel ? (
          <Text
            numberOfLines={1}
            style={[s.supplyUpdated, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
          >
            {updatedLabel}
          </Text>
        ) : null}
      </View>
      <SupplyStatusPill status={item.status} />
    </PressScale>
  );
}

/**
 * Inline rename/remove editor, opened by long-pressing a row. confirmDialog
 * has no text-prompt utility (Alert has no cross-platform input), so rename
 * happens on this cream in-card editor; remove still confirms through the
 * themed destructive dialog.
 */
function SupplyEditCard({
  item,
  name,
  onChangeName,
  onSave,
  onRemove,
  onCancel,
}: {
  item: SupplyItem;
  name: string;
  onChangeName: (value: string) => void;
  onSave: () => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[s.supplyEditCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <TextInput
        value={name}
        onChangeText={onChangeName}
        placeholder="Item name"
        placeholderTextColor={colors.mutedForeground}
        autoFocus
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={onSave}
        accessibilityLabel={`Rename ${item.name}`}
        style={[
          s.supplyInput,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.foreground,
            fontFamily: "Inter_600SemiBold",
          },
        ]}
      />
      <View style={s.supplyEditActions}>
        <BoardActionButton
          label="Save"
          variant="primary"
          compact
          onPress={onSave}
          accessibilityLabel={`Save the new name for ${item.name}`}
        />
        <BoardActionButton
          label="Cancel"
          variant="soft"
          compact
          onPress={onCancel}
          accessibilityLabel="Cancel editing this item"
        />
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name} from the ${SUPPLY_GROUP_TITLES[item.group]} checklist`}
          onPress={onRemove}
          scaleTo={0.95}
          containerStyle={s.supplyRemoveLayout}
          style={[s.supplyRemoveButton, { backgroundColor: colors.rose + "14" }]}
        >
          <Ionicons name="trash-outline" size={14} color={colors.rose} />
          <Text style={[s.supplyRemoveText, { color: colors.rose, fontFamily: "Inter_700Bold" }]}>
            Remove
          </Text>
        </PressScale>
      </View>
    </View>
  );
}

/** Storybook-mockup link row: soft round icon chip, bold title, chevron. */
function PackLinkRow({
  icon,
  tone,
  title,
  detail,
  onPress,
  accessibilityLabel,
  last,
}: {
  icon: PixelIconName;
  tone: string;
  title: string;
  detail?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${detail ?? ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.linkRow,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <View style={[s.linkChip, { backgroundColor: tone + "16" }]}>
        <PixelIcon name={icon} size={20} />
      </View>
      <View style={s.linkCopy}>
        <Text
          numberOfLines={1}
          style={[s.linkTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
        >
          {title}
        </Text>
        {detail ? (
          <Text
            numberOfLines={1}
            style={[s.linkDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />
    </Pressable>
  );
}

/** Storybook-mockup quick info tile: soft icon chip, muted label, bold value. */
function PackInfoTile({
  icon,
  tone,
  label,
  value,
  onPress,
  accessibilityLabel,
}: {
  icon: MedallionName;
  tone: string;
  label: string;
  value: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        s.infoTile,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <BoardMedallion name={icon} size={34} />
      <Text
        numberOfLines={1}
        style={[s.infoTileLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[s.infoTileValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}
      >
        {value}
      </Text>
    </Pressable>
  );
}

/**
 * Idle breathe for the pet-card hero sprite: a slow ~3.5s scale pulse
 * (1.0 -> 1.012), mirroring the LivingPhoenixRoom breath pattern. The
 * amplitude stays tiny so the portrait reads alive without pulling focus, and
 * it holds completely still when the OS Reduce Motion setting is on.
 */
function BreathingPetSprite({
  source,
  accessibilityLabel,
}: {
  source: ImageSourcePropType;
  accessibilityLabel: string;
}) {
  const reduced = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduced) return; // Reduce Motion: hold the portrait still, no breathing loop
    breath.value = withRepeat(
      withTiming(1, { duration: 1750, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath, reduced]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.012 }],
  }));

  return (
    <Animated.Image
      source={source}
      style={[s.petAvatarImage, breathStyle]}
      resizeMode="cover"
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export default function PackScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    state,
    storageScope,
    isLoaded: careScopeLoaded,
    runDeviceOperation,
  } = useCare();
  const renderedPackStorageKey = storageScope
    ? getPackStorageKey(storageScope)
    : null;
  const renderedPackStorageKeyRef = useRef<string | null>(
    renderedPackStorageKey,
  );
  renderedPackStorageKeyRef.current = renderedPackStorageKey;
  const { avatarConfig, getAvatarSource } = useAvatar();
  const me = useGetMe();
  const now = Date.now();
  const [segment, setSegment] = useState<PackSegment>("supplies");

  // Supplies checklist: null until the stored list loads, so the starter
  // defaults never flash in over a user's saved answers (same pattern as
  // HOME_WELCOME_DISMISSED_KEY on Home).
  const [supplies, setSupplies] = useState<SupplyItem[] | null>(null);
  const suppliesRef = useRef<SupplyItem[] | null>(null);
  const [supplyStorageError, setSupplyStorageError] = useState<string | null>(
    null,
  );
  const [supplyReloadToken, setSupplyReloadToken] = useState(0);
  const supplyWriteInFlightRef = useRef(false);
  const packStorageKeyRef = useRef<string | null>(null);
  const packLifecycleGenerationRef = useRef(0);
  const packWriteCoordinatorRef = useRef<PackWriteCoordinator | null>(null);
  const [legacyPackCandidate, setLegacyPackCandidate] =
    useState<PackStoredState | null>(null);
  const [legacyPackReviewError, setLegacyPackReviewError] = useState<
    string | null
  >(null);
  const [editingSupplyId, setEditingSupplyId] = useState<string | null>(null);
  const [editSupplyName, setEditSupplyName] = useState("");
  const [addSupplyOpen, setAddSupplyOpen] = useState(false);
  const [addSupplyName, setAddSupplyName] = useState("");
  const [addSupplyGroup, setAddSupplyGroup] = useState<SupplyGroup>("essentials");
  const [travelBag, setTravelBag] = useState<TravelBagSession>(defaultTravelBag);
  const travelBagRef = useRef<TravelBagSession | null>(null);
  const [travelBagStorageReady, setTravelBagStorageReady] = useState(false);
  const [travelBagStorageError, setTravelBagStorageError] = useState<
    string | null
  >(null);
  const [travelBagReloadToken, setTravelBagReloadToken] = useState(0);
  const travelBagWriteInFlightRef = useRef(false);
  const [editingBagLabel, setEditingBagLabel] = useState(false);
  const [bagLabelDraft, setBagLabelDraft] = useState("");
  const isPackStorageCurrent = (storageKey: string, generation: number) =>
    packLifecycleGenerationRef.current === generation &&
    packStorageKeyRef.current === storageKey &&
    renderedPackStorageKeyRef.current === storageKey;

  useEffect(() => {
    const generation = packLifecycleGenerationRef.current + 1;
    packLifecycleGenerationRef.current = generation;
    let cancelled = false;
    setSupplyStorageError(null);
    setTravelBagStorageError(null);
    setSupplies(null);
    setTravelBag(defaultTravelBag());
    setTravelBagStorageReady(false);
    suppliesRef.current = null;
    travelBagRef.current = null;
    packStorageKeyRef.current = null;
    packWriteCoordinatorRef.current = null;
    setLegacyPackCandidate(null);
    setLegacyPackReviewError(null);

    if (!careScopeLoaded || !storageScope) {
      return () => {
        cancelled = true;
        if (packLifecycleGenerationRef.current === generation) {
          packLifecycleGenerationRef.current += 1;
        }
      };
    }

    const PACK_STATE_KEY = getPackStorageKey(storageScope);
    packStorageKeyRef.current = PACK_STATE_KEY;
    const isCurrentLifecycle = () =>
      !cancelled &&
      packLifecycleGenerationRef.current === generation &&
      packStorageKeyRef.current === PACK_STATE_KEY &&
      renderedPackStorageKeyRef.current === PACK_STATE_KEY;
    const applyLoadedState = (next: PackStoredState) => {
      if (!isCurrentLifecycle()) return;
      suppliesRef.current = next.supplies;
      travelBagRef.current = next.travelBag;
      packWriteCoordinatorRef.current = createPackWriteCoordinator(next);
      setSupplies(next.supplies);
      setTravelBag(next.travelBag);
      setTravelBagStorageReady(true);
    };

    void (async () => {
      const envelopeRaw = await AsyncStorage.getItem(PACK_STATE_KEY);
      if (!isCurrentLifecycle()) return;
      const envelope = inspectPackStateStorage(envelopeRaw);
      if (envelope.status === "invalid") {
        setSupplyStorageError(
          "Your saved Pack data could not be read. WoofWatcher kept the checklist and trip state untouched.",
        );
        setTravelBagStorageError(
          "Your saved Pack data could not be read. Retry before changing this travel bag.",
        );
        return;
      }

      if (envelope.status === "valid") {
        applyLoadedState(envelope.state);
        return;
      }

      // Older builds stored these globally and independently. Local mode can
      // adopt them directly. An authenticated account must never inherit those
      // ambiguous bytes automatically; it gets an explicit review/import
      // choice and the original keys remain untouched.
      const legacyValues = await AsyncStorage.multiGet([
        LEGACY_PACK_SUPPLIES_KEY,
        LEGACY_TRAVEL_BAG_KEY,
      ]);
      if (!isCurrentLifecycle()) return;
      const legacyByKey = new Map(legacyValues);
      const supplies = inspectSuppliesStorage(
        legacyByKey.get(LEGACY_PACK_SUPPLIES_KEY) ?? null,
      );
      const travelBag = inspectTravelBagStorage(
        legacyByKey.get(LEGACY_TRAVEL_BAG_KEY) ?? null,
      );

      if (storageScope.kind === "account") {
        const freshState: PackStoredState = {
          supplies: DEFAULT_SUPPLIES.map((item) => ({ ...item })),
          travelBag: defaultTravelBag(),
        };
        applyLoadedState(freshState);
        if (supplies.status === "valid" && travelBag.status === "valid") {
          setLegacyPackCandidate({
            supplies: supplies.items,
            travelBag: travelBag.session,
          });
        } else if (
          supplies.status !== "missing" ||
          travelBag.status !== "missing"
        ) {
          setLegacyPackReviewError(
            "Older device Pack data was found, but it is incomplete or unreadable. This account is using a separate checklist; the older data remains untouched.",
          );
        }
        return;
      }

      if (supplies.status === "invalid" || travelBag.status === "invalid") {
        if (supplies.status === "invalid") {
          setSupplyStorageError(
            "Your saved supplies could not be read. WoofWatcher kept that data untouched.",
          );
        }
        if (travelBag.status === "invalid") {
          setTravelBagStorageError(
            "Your saved travel bag could not be read. WoofWatcher kept that trip data untouched.",
          );
        }
        if (supplies.status !== "invalid") {
          setSupplyStorageError(
            "Pack is waiting for the saved travel bag to be recovered.",
          );
        }
        if (travelBag.status !== "invalid") {
          setTravelBagStorageError(
            "Pack is waiting for the saved supplies checklist to be recovered.",
          );
        }
        return;
      }

      applyLoadedState({
        supplies: supplies.items,
        travelBag: travelBag.session,
      });
    })().catch(() => {
      if (isCurrentLifecycle()) {
        setSupplyStorageError(
          "WoofWatcher could not load Pack data from this device. Your saved checklist was not replaced.",
        );
        setTravelBagStorageError(
          "WoofWatcher could not load Pack data from this device. Your saved trip was not replaced.",
        );
      }
    });
    return () => {
      cancelled = true;
      if (packLifecycleGenerationRef.current === generation) {
        packLifecycleGenerationRef.current += 1;
      }
    };
  }, [
    careScopeLoaded,
    storageScope,
    supplyReloadToken,
    travelBagReloadToken,
  ]);

  const household = me.data?.household;
  const members: HouseholdMemberSummary[] = me.data?.members ?? [];
  const myName = me.data?.user?.displayName?.trim() || "";

  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  const petName = resolvePetName(state.profile.name);

  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const careCareer = useMemo(() => deriveCareCareer(state.entries, now), [state.entries, now]);
  const careStreak = useMemo(() => deriveCareStreak(state.entries, now), [state.entries, now]);
  const avatarTemplate = useMemo(
    () => getAvatarTemplate(avatarConfig.templateId),
    [avatarConfig.templateId],
  );

  const householdAccess = useMemo(
    () =>
      deriveHouseholdAccessPlan({
        household: household ? { name: household.name } : null,
        canManageInvitations: members.some(
          (member) => member.isSelf && member.role === "owner",
        ),
        members,
        caregivers: state.caregivers,
        routines: state.routines,
      }),
    [household, members, state.caregivers, state.routines],
  );

  /* Same derivation the More console uses, so the Access tab shows the real
     pass counts instead of pointing at them. */
  const accessPassPlan = useMemo(
    () => deriveAccessPassPlan({ passes: state.accessPasses, petName, now }),
    [state.accessPasses, petName, now],
  );

  const carePass = useMemo(
    () =>
      buildCarePass({
        audience: "sitter",
        profile: { ...state.profile, name: petName },
        dietProfile: state.dietProfile,
        entries: state.entries,
        routines: state.routines,
        caregivers: state.caregivers,
        records: state.records,
        goals: state.goals,
        now,
      }),
    [
      state.profile,
      petName,
      state.dietProfile,
      state.entries,
      state.routines,
      state.caregivers,
      state.records,
      state.goals,
      now,
    ],
  );

  const savedReports = useMemo(
    () =>
      [...state.reportArtifacts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [state.reportArtifacts],
  );
  const latestReport = savedReports[0] ?? null;

  const memberTones = [colors.sage, colors.copper, colors.amber, colors.rose];
  const memberTone = (index: number) => memberTones[index % memberTones.length];
  // A pristine household (no synced members, no pending invites, no
  // routine-only owners) is a not-set-up-yet state, not a problem to review -
  // amber "Needs review" on an empty board reads as a false alarm.
  const accessNotSetUp =
    householdAccess.status === "needs-household" && householdAccess.people.length === 0;
  const accessTone =
    householdAccess.status === "ready"
      ? colors.sage
      : accessNotSetUp
        ? colors.mutedForeground
        : colors.amber;
  const petIdentityLine = [
    state.profile.breed,
    `${avatarTemplate.label} care twin${avatarConfig.scanAssisted ? " (scan-assisted)" : ""}`,
  ]
    .filter(Boolean)
    .join(" - ");
  // Only real profile fields: weight is the only sourced vitals field today.
  const weightCurrent = state.profile.weight?.current ?? 0;
  const weightLabel =
    weightCurrent > 0 ? `${weightCurrent} ${state.profile.weight?.unit || "lb"}` : "";
  const levelPercent = Math.round(careCareer.levelProgress * 100);

  const open = (route: string) => {
    Haptics.selectionAsync();
    router.push(route as never);
  };

  /**
   * Deep-link into a specific board on the ~4800px More page. More honors
   * `section` with an anchored scroll; the `focus` nonce re-triggers that
   * scroll when More is already mounted with the same section from a
   * previous visit.
   */
  const openMoreSection = (section: "household" | "access" | "care-pass" | "diet") => {
    Haptics.selectionAsync();
    router.push(`/more?section=${section}&focus=${Date.now()}` as never);
  };

  const changeSegment = (key: PackSegment) => {
    Haptics.selectionAsync();
    setSegment(key);
  };

  const essentialSupplies = useMemo(
    () => (supplies ?? []).filter((item) => item.group === "essentials"),
    [supplies],
  );
  const travelSupplies = useMemo(
    () => (supplies ?? []).filter((item) => item.group === "travel"),
    [supplies],
  );
  const restockCount = essentialSupplies.filter(
    (item) => item.status === "low" || item.status === "out",
  ).length;
  const unconfirmedSupplyCount = (supplies ?? []).filter(
    (item) => item.status === "unconfirmed",
  ).length;
  const essentialUnconfirmedCount = essentialSupplies.filter(
    (item) => item.status === "unconfirmed",
  ).length;
  const travelUnconfirmedCount = travelSupplies.filter(
    (item) => item.status === "unconfirmed",
  ).length;
  const packedCount = travelSupplies.filter((item) => item.status === "packed").length;
  const suppliesUntouched = supplies ? isDefaultUntouched(supplies) : false;

  // Phase-driven travel-bag chrome (packing -> active -> complete). Every
  // signal is real: the packed count is the checklist truth, "Active since"
  // and "Trip wrapped" read from the owner's own Activate/Complete taps.
  const travelAllPacked = isTravelBagReady(travelSupplies);
  const travelPill: { label: string; tone: string; icon?: "checkmark" } =
    travelBag.phase === "active" && travelAllPacked
      ? { label: "Active", tone: colors.sage, icon: "checkmark" }
      : travelBag.phase === "complete"
        ? { label: "Trip done", tone: colors.mutedForeground }
        : travelSupplies.length === 0
          ? { label: "Empty", tone: colors.mutedForeground }
          : travelUnconfirmedCount > 0
            ? {
                label: `${travelUnconfirmedCount} to confirm`,
                tone: colors.mutedForeground,
              }
            : travelBag.phase === "active"
              ? {
                  label: "Needs review",
                  tone: colors.amber,
                }
              : {
                  label: `${packedCount}/${travelSupplies.length} packed`,
                  tone: travelAllPacked ? colors.sage : colors.mutedForeground,
                  ...(travelAllPacked ? { icon: "checkmark" as const } : {}),
                };
  const travelCaption =
    travelBag.phase === "active" && travelAllPacked
      ? travelBag.activatedAt
        ? `Packed and out the door - active since ${relativeTime(travelBag.activatedAt, now)}.`
        : "Packed and out the door."
      : travelBag.phase === "active"
        ? travelUnconfirmedCount > 0
          ? `Trip is active, but ${travelUnconfirmedCount} item ${travelUnconfirmedCount === 1 ? "status needs" : "statuses need"} confirmation.`
          : `Trip is active with ${packedCount}/${travelSupplies.length} items packed. Review the missing gear.`
      : travelBag.phase === "complete"
        ? travelBag.completedAt
          ? `Trip wrapped ${relativeTime(travelBag.completedAt, now)} - redo to pack the next one.`
          : "Trip wrapped - redo to pack the next one."
        : travelUnconfirmedCount > 0
          ? "Confirm each item as you pack. Nothing is checked until you tap it."
        : packedCount === 0
          ? "Check your gear off, then activate the bag."
          : "Gear checked. Activate the bag when you're ready to go.";

  const persistLegacyPackDecision = async (
    decision: "import" | "keep-current",
  ): Promise<boolean> => {
    const coordinator = packWriteCoordinatorRef.current;
    const storageKey = packStorageKeyRef.current;
    const generation = packLifecycleGenerationRef.current;
    const candidate = legacyPackCandidate;
    if (
      !coordinator ||
      !storageKey ||
      !candidate ||
      !isPackStorageCurrent(storageKey, generation) ||
      supplyWriteInFlightRef.current ||
      travelBagWriteInFlightRef.current
    ) {
      return false;
    }

    supplyWriteInFlightRef.current = true;
    travelBagWriteInFlightRef.current = true;
    setSupplyStorageError(null);
    setTravelBagStorageError(null);
    try {
      const saved = await coordinator.enqueue(
        (current) => (decision === "import" ? candidate : current),
        async (next) => {
          if (!isPackStorageCurrent(storageKey, generation)) {
            throw new Error("stale-pack-lifecycle");
          }
          await runDeviceOperation(() =>
            AsyncStorage.setItem(storageKey, serializePackState(next)),
          );
          if (!isPackStorageCurrent(storageKey, generation)) {
            throw new Error("stale-pack-lifecycle");
          }
        },
      );
      if (!isPackStorageCurrent(storageKey, generation)) {
        return false;
      }
      suppliesRef.current = saved.supplies;
      travelBagRef.current = saved.travelBag;
      setSupplies(saved.supplies);
      setTravelBag(saved.travelBag);
      setLegacyPackCandidate(null);
      setLegacyPackReviewError(null);
      return true;
    } catch {
      if (!isPackStorageCurrent(storageKey, generation)) {
        return false;
      }
      setSupplyStorageError(
        "Your older Pack choice was not saved. No Pack data was replaced.",
      );
      setTravelBagStorageError(
        "Your older Pack choice was not saved. Retry after device storage is available.",
      );
      notifyDialog(
        "Pack choice not saved",
        "WoofWatcher left both the account Pack and older device data untouched. Try again when device storage is available.",
      );
      return false;
    } finally {
      supplyWriteInFlightRef.current = false;
      travelBagWriteInFlightRef.current = false;
    }
  };

  const importLegacyPack = () => {
    const candidate = legacyPackCandidate;
    if (!candidate) return;
    confirmThroughSteps(
      [
        {
          title: "Review older Pack data",
          message: `This device has an older ${candidate.supplies.length}-item checklist and a travel bag named “${candidate.travelBag.label}”. It was saved before Pack data was tied to an account.`,
          confirmLabel: "Continue",
        },
        {
          title: "Import into this household?",
          message:
            "Only continue if this older checklist belongs to the current household. The original device copy will remain untouched.",
          confirmLabel: "Import Pack",
        },
      ],
      () => {
        void persistLegacyPackDecision("import");
      },
    );
  };

  const keepCurrentPack = () => {
    confirmThroughSteps(
      [
        {
          title: "Keep this account's new Pack?",
          message:
            "WoofWatcher will keep the current account checklist separate. The older device copy will remain untouched.",
          confirmLabel: "Keep new Pack",
        },
      ],
      () => {
        void persistLegacyPackDecision("keep-current");
      },
    );
  };

  /** Commit device storage before presenting the checklist change as saved. */
  const commitSupplies = async (next: SupplyItem[]): Promise<boolean> => {
    if (legacyPackCandidate) {
      notifyDialog(
        "Choose your Pack first",
        "Review the older device Pack data, then import it or keep this account's new Pack before changing the checklist.",
      );
      return false;
    }
    const coordinator = packWriteCoordinatorRef.current;
    const storageKey = packStorageKeyRef.current;
    const generation = packLifecycleGenerationRef.current;
    if (
      !coordinator ||
      !storageKey ||
      !isPackStorageCurrent(storageKey, generation) ||
      !travelBagStorageReady ||
      supplyWriteInFlightRef.current
    ) {
      return false;
    }
    supplyWriteInFlightRef.current = true;
    setSupplyStorageError(null);
    try {
      const saved = await coordinator.enqueue(
        (current) => ({ ...current, supplies: next }),
        async (candidate) => {
          if (!isPackStorageCurrent(storageKey, generation)) {
            throw new Error("stale-pack-lifecycle");
          }
          await runDeviceOperation(() =>
            AsyncStorage.setItem(storageKey, serializePackState(candidate)),
          );
          if (!isPackStorageCurrent(storageKey, generation)) {
            throw new Error("stale-pack-lifecycle");
          }
        },
      );
      if (!isPackStorageCurrent(storageKey, generation)) {
        return false;
      }
      suppliesRef.current = saved.supplies;
      travelBagRef.current = saved.travelBag;
      setSupplies(saved.supplies);
      setTravelBag(saved.travelBag);
      return true;
    } catch {
      if (!isPackStorageCurrent(storageKey, generation)) {
        return false;
      }
      setSupplyStorageError(
        "That supplies change was not saved. Your previous list is still intact.",
      );
      notifyDialog(
        "Supplies not saved",
        "WoofWatcher kept your previous checklist. Try the change again after device storage is available.",
      );
      return false;
    } finally {
      supplyWriteInFlightRef.current = false;
    }
  };

  const commitTravelBag = async (
    next: TravelBagSession,
  ): Promise<boolean> => {
    if (legacyPackCandidate) {
      notifyDialog(
        "Choose your Pack first",
        "Review the older device Pack data, then import it or keep this account's new Pack before changing the travel bag.",
      );
      return false;
    }
    const coordinator = packWriteCoordinatorRef.current;
    const storageKey = packStorageKeyRef.current;
    const generation = packLifecycleGenerationRef.current;
    if (
      !coordinator ||
      !storageKey ||
      !isPackStorageCurrent(storageKey, generation) ||
      !travelBagStorageReady ||
      travelBagWriteInFlightRef.current
    ) {
      return false;
    }
    travelBagWriteInFlightRef.current = true;
    setTravelBagStorageError(null);
    try {
      const saved = await coordinator.enqueue(
        (current) => ({ ...current, travelBag: next }),
        async (candidate) => {
          if (!isPackStorageCurrent(storageKey, generation)) {
            throw new Error("stale-pack-lifecycle");
          }
          await runDeviceOperation(() =>
            AsyncStorage.setItem(storageKey, serializePackState(candidate)),
          );
          if (!isPackStorageCurrent(storageKey, generation)) {
            throw new Error("stale-pack-lifecycle");
          }
        },
      );
      if (!isPackStorageCurrent(storageKey, generation)) {
        return false;
      }
      suppliesRef.current = saved.supplies;
      travelBagRef.current = saved.travelBag;
      setSupplies(saved.supplies);
      setTravelBag(saved.travelBag);
      return true;
    } catch {
      if (!isPackStorageCurrent(storageKey, generation)) {
        return false;
      }
      setTravelBagStorageError(
        "That travel-bag change was not saved. Your previous trip state is still shown.",
      );
      notifyDialog(
        "Travel bag not saved",
        "WoofWatcher kept your previous trip state. Try again after device storage is available.",
      );
      return false;
    } finally {
      travelBagWriteInFlightRef.current = false;
    }
  };

  const activateBag = () => {
    if (!travelAllPacked) {
      notifyDialog(
        "Finish the checklist",
        "Confirm and pack every travel item before you activate the bag.",
      );
      return;
    }
    const next = activateTravelBag(travelBag, packedCount, new Date().toISOString());
    if (!next) {
      notifyDialog(
        "Pack something first",
        "Check at least one item off before you activate the bag - an empty bag isn't ready to go.",
      );
      return;
    }
    void commitTravelBag(next).then((saved) => {
      if (saved) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
    });
  };

  const completeBag = () => {
    void commitTravelBag(
      completeTravelBag(travelBag, new Date().toISOString()),
    ).then((saved) => {
      if (saved) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
    });
  };

  const reopenBag = () => {
    void commitTravelBag(reopenTravelBag(travelBag)).then((saved) => {
      if (saved) Haptics.selectionAsync().catch(() => {});
    });
  };

  const redoBag = () => {
    confirmThroughSteps(
      [
        {
          title: "Redo the bag?",
          message: "This unpacks every travel item so you can pack fresh for the next trip.",
          confirmLabel: "Redo bag",
        },
      ],
      () => {
        if (legacyPackCandidate) {
          notifyDialog(
            "Choose your Pack first",
            "Import the older device Pack or keep this account's new Pack before resetting the travel bag.",
          );
          return;
        }
        const coordinator = packWriteCoordinatorRef.current;
        const storageKey = packStorageKeyRef.current;
        const generation = packLifecycleGenerationRef.current;
        if (
          !coordinator ||
          !storageKey ||
          !isPackStorageCurrent(storageKey, generation)
        ) {
          return;
        }
        if (
          supplyWriteInFlightRef.current ||
          travelBagWriteInFlightRef.current
        ) {
          return;
        }
        supplyWriteInFlightRef.current = true;
        travelBagWriteInFlightRef.current = true;
        void coordinator.enqueue(
          (current) => ({
            supplies: resetTravelItems(current.supplies),
            travelBag: redoTravelBag(current.travelBag),
          }),
          async (candidate) => {
            if (!isPackStorageCurrent(storageKey, generation)) {
              throw new Error("stale-pack-lifecycle");
            }
            await runDeviceOperation(() =>
              AsyncStorage.setItem(
                storageKey,
                serializePackState(candidate),
              ),
            );
            if (!isPackStorageCurrent(storageKey, generation)) {
              throw new Error("stale-pack-lifecycle");
            }
          },
        )
          .then((saved) => {
            if (!isPackStorageCurrent(storageKey, generation)) {
              return;
            }
            suppliesRef.current = saved.supplies;
            travelBagRef.current = saved.travelBag;
            setSupplies(saved.supplies);
            setTravelBag(saved.travelBag);
            setSupplyStorageError(null);
            setTravelBagStorageError(null);
            Haptics.impactAsync(
              Haptics.ImpactFeedbackStyle.Medium,
            ).catch(() => {});
          })
          .catch(() => {
            if (!isPackStorageCurrent(storageKey, generation)) {
              return;
            }
            setSupplyStorageError(
              "The travel-bag reset was not saved. Review the checklist before trying again.",
            );
            setTravelBagStorageError(
              "The travel-bag reset was not saved. Your previous trip state is still shown.",
            );
            notifyDialog(
              "Travel bag not reset",
              "WoofWatcher kept the current screen unchanged because device storage did not confirm the reset.",
            );
          })
          .finally(() => {
            supplyWriteInFlightRef.current = false;
            travelBagWriteInFlightRef.current = false;
          });
      },
    );
  };

  const openBagLabelEditor = () => {
    Haptics.selectionAsync().catch(() => {});
    setBagLabelDraft(travelBag.label);
    setEditingBagLabel(true);
  };

  const saveBagLabel = async () => {
    if (await commitTravelBag(renameTravelBag(travelBag, bagLabelDraft))) {
      setEditingBagLabel(false);
      setBagLabelDraft("");
    }
  };

  const cycleSupply = (item: SupplyItem) => {
    if (!supplies) return;
    const stampedAt = new Date().toISOString();
    void commitSupplies(
      supplies.map((entry) =>
        entry.id === item.id
          ? { ...entry, status: cycleStatus(entry), updatedAt: stampedAt }
          : entry,
      ),
    );
  };

  const openSupplyEditor = (item: SupplyItem) => {
    Haptics.selectionAsync();
    setAddSupplyOpen(false);
    setEditingSupplyId(item.id);
    setEditSupplyName(item.name);
  };

  const closeSupplyEditor = () => {
    setEditingSupplyId(null);
    setEditSupplyName("");
  };

  const saveSupplyRename = async () => {
    if (!supplies || !editingSupplyId) return;
    const trimmed = editSupplyName.trim();
    if (!trimmed) {
      notifyDialog("Name needed", "Give this item a short name, or cancel the edit.");
      return;
    }
    const next = renameItem(supplies, editingSupplyId, editSupplyName);
    if (!next) {
      notifyDialog(
        "Already on the list",
        `"${trimmed}" is already in this group. Pick a different name.`,
      );
      return;
    }
    if (await commitSupplies(next)) closeSupplyEditor();
  };

  const removeSupply = (item: SupplyItem) => {
    confirmThroughSteps(
      [
        {
          title: `Remove ${item.name}?`,
          message: `This takes ${item.name} off the ${SUPPLY_GROUP_TITLES[item.group]} checklist. You can add it back any time.`,
          confirmLabel: "Remove",
          destructive: true,
        },
      ],
      () => {
        // The themed dialog resolves later, so read the current ref instead
        // of the list captured when the owner first opened it.
        const current = suppliesRef.current;
        if (!current) return;
        void commitSupplies(removeItem(current, item.id)).then((saved) => {
          if (saved) closeSupplyEditor();
        });
      },
    );
  };

  const openAddSupply = () => {
    closeSupplyEditor();
    setAddSupplyOpen(true);
  };

  const cancelAddSupply = () => {
    setAddSupplyOpen(false);
    setAddSupplyName("");
  };

  const saveSupplyAdd = async () => {
    if (!supplies) return;
    const trimmed = addSupplyName.trim();
    if (!trimmed) {
      notifyDialog("Name needed", "Give the new item a short name, like Water bottle or Towel.");
      return;
    }
    const next = addItem(supplies, addSupplyName, addSupplyGroup);
    if (!next) {
      notifyDialog(
        "Already on the list",
        `"${trimmed}" is already in ${SUPPLY_GROUP_TITLES[addSupplyGroup]}. Rename that item instead of doubling it.`,
      );
      return;
    }
    if (await commitSupplies(next)) {
      setAddSupplyName("");
      setAddSupplyOpen(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={{
          paddingTop: getRouteTopPadding({
            platform: Platform.OS,
            topInset: insets.top,
            surface: "tabbed",
          }),
          paddingBottom: bottomPadding,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <BoardRouteHeader
          kicker="Household"
          title="Pack"
          subtitle="Supplies, pets & people who share the care."
          icon="people-outline"
          back
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as never))}
          actionIcon="key-outline"
          actionLabel="Manage household from Pack"
          onAction={() => openMoreSection("household")}
          plain
          style={s.routeHeaderCompact}
        />

        {/* Five segments outgrow one 390pt row, so the chips scroll sideways
            at natural width instead of squeezing their labels into ellipses. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.segmentScroll}
          contentContainerStyle={s.segmentScrollContent}
        >
          <BoardSegmentTabs
            segments={PACK_SEGMENTS}
            active={segment}
            onChange={changeSegment}
            style={s.segmentTabsInline}
          />
        </ScrollView>

        {/* Supplies - the mockup Pack page's Essentials / Travel Bag boards.
            Every status is the owner's own answer; untouched defaults say so
            instead of pretending someone already checked the shelf. */}
        {segment === "supplies" && legacyPackCandidate ? (
          <BoardCard style={s.sectionCard} enter={0}>
            <BoardSectionHeader title="Older device Pack data found" />
            <Text
              style={[
                s.emptyCopy,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              This checklist was saved before Pack data was tied to an account.
              Review it before deciding whether it belongs to this household.
            </Text>
            <View style={s.supplyEditActions}>
              <BoardActionButton
                label="Review & import"
                icon="download-outline"
                variant="primary"
                compact
                onPress={importLegacyPack}
                accessibilityLabel="Review and import older device Pack data"
              />
              <BoardActionButton
                label="Keep new Pack"
                icon="shield-checkmark-outline"
                variant="soft"
                compact
                onPress={keepCurrentPack}
                accessibilityLabel="Keep this account's new Pack separate"
              />
            </View>
          </BoardCard>
        ) : null}
        {segment === "supplies" && legacyPackReviewError ? (
          <BoardCard style={s.sectionCard} enter={0}>
            <BoardSectionHeader title="Older Pack data kept separate" />
            <Text
              accessibilityRole="alert"
              style={[
                s.emptyCopy,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {legacyPackReviewError}
            </Text>
          </BoardCard>
        ) : null}
        {segment === "supplies" && supplyStorageError ? (
          <BoardCard style={s.sectionCard} enter={0}>
            <BoardSectionHeader title="Supplies need attention" />
            <Text
              accessibilityRole="alert"
              style={[
                s.emptyCopy,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {supplyStorageError}
            </Text>
            {!supplies ? (
              <BoardActionButton
                label="Retry loading supplies"
                icon="refresh-outline"
                variant="soft"
                onPress={() => setSupplyReloadToken((token) => token + 1)}
                accessibilityLabel="Retry loading supplies from this device"
              />
            ) : null}
          </BoardCard>
        ) : null}
        {segment === "supplies" && !supplies && !supplyStorageError ? (
          <BoardCard style={s.sectionCard} enter={0}>
            <BoardSectionHeader title="Opening supplies" />
            <Text
              style={[
                s.emptyCopy,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              Loading the checklist saved on this device…
            </Text>
          </BoardCard>
        ) : null}
        {segment === "supplies" && supplies ? (
          <>
            <BoardCard style={s.sectionCard} enter={0}>
              <BoardSectionHeader
                title="Essentials"
                accessory={
                  <BoardPill
                    label={
                      essentialSupplies.length === 0
                        ? "Empty"
                        : essentialUnconfirmedCount > 0
                          ? `${essentialUnconfirmedCount} to confirm`
                          : restockCount > 0
                            ? `${restockCount} to restock`
                            : "All plenty"
                    }
                    tone={
                      essentialSupplies.length === 0 || essentialUnconfirmedCount > 0
                        ? colors.mutedForeground
                        : restockCount > 0
                          ? colors.amber
                          : colors.sage
                    }
                  />
                }
              />
              {suppliesUntouched ? (
                <Text style={[s.suppliesHint, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Starter checklist - {unconfirmedSupplyCount} statuses still
                  need your confirmation. Tap a row to set one, or long-press
                  to rename or remove it.
                </Text>
              ) : null}
              {essentialSupplies.length === 0 ? (
                <Text style={[s.emptyCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Nothing tracked here yet. Add an item below.
                </Text>
              ) : (
                essentialSupplies.map((item, index) =>
                  editingSupplyId === item.id ? (
                    <SupplyEditCard
                      key={item.id}
                      item={item}
                      name={editSupplyName}
                      onChangeName={setEditSupplyName}
                      onSave={saveSupplyRename}
                      onRemove={() => removeSupply(item)}
                      onCancel={closeSupplyEditor}
                    />
                  ) : (
                    <SupplyRow
                      key={item.id}
                      item={item}
                      now={now}
                      onCycle={cycleSupply}
                      onEdit={openSupplyEditor}
                      last={index === essentialSupplies.length - 1}
                    />
                  ),
                )
              )}
            </BoardCard>

            {!travelBagStorageReady ? (
              <BoardCard style={s.sectionCard} enter={1}>
                <BoardSectionHeader title="Travel bag needs attention" />
                <Text
                  accessibilityRole={travelBagStorageError ? "alert" : undefined}
                  style={[
                    s.emptyCopy,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {travelBagStorageError ??
                    "Loading the travel bag saved on this device…"}
                </Text>
                {travelBagStorageError ? (
                  <BoardActionButton
                    label="Retry loading travel bag"
                    icon="refresh-outline"
                    variant="soft"
                    onPress={() =>
                      setTravelBagReloadToken((token) => token + 1)
                    }
                    accessibilityLabel="Retry loading the travel bag from this device"
                  />
                ) : null}
              </BoardCard>
            ) : (
            <BoardCard style={s.sectionCard} enter={1}>
              <BoardSectionHeader
                title={travelBag.label}
                accessory={
                  <BoardPill label={travelPill.label} icon={travelPill.icon} tone={travelPill.tone} />
                }
              />

              {editingBagLabel ? (
                <View style={s.supplyEditActions}>
                  <TextInput
                    value={bagLabelDraft}
                    onChangeText={setBagLabelDraft}
                    placeholder="Name this trip (Weekend, Vet visit...)"
                    placeholderTextColor={colors.mutedForeground}
                    autoFocus
                    maxLength={32}
                    returnKeyType="done"
                    onSubmitEditing={saveBagLabel}
                    accessibilityLabel="Name for this travel bag"
                    style={[
                      s.supplyInput,
                      {
                        flex: 1,
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  />
                  <BoardActionButton
                    label="Save"
                    icon="checkmark"
                    variant="primary"
                    compact
                    onPress={saveBagLabel}
                    accessibilityLabel="Save the travel bag name"
                  />
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Rename the travel bag. Currently ${travelBag.label}.`}
                  hitSlop={MOBILE_INLINE_HIT_SLOP}
                  onPress={openBagLabelEditor}
                  style={s.travelCaptionRow}
                >
                  <Text style={[s.emptyCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium", flex: 1 }]}>
                    {travelCaption}
                  </Text>
                  <Ionicons name="pencil" size={13} color={colors.mutedForeground} />
                </Pressable>
              )}

              {travelSupplies.length === 0 ? (
                <Text style={[s.emptyCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  Nothing tracked here yet. Add an item below.
                </Text>
              ) : (
                travelSupplies.map((item, index) =>
                  editingSupplyId === item.id ? (
                    <SupplyEditCard
                      key={item.id}
                      item={item}
                      name={editSupplyName}
                      onChangeName={setEditSupplyName}
                      onSave={saveSupplyRename}
                      onRemove={() => removeSupply(item)}
                      onCancel={closeSupplyEditor}
                    />
                  ) : (
                    <SupplyRow
                      key={item.id}
                      item={item}
                      now={now}
                      onCycle={cycleSupply}
                      onEdit={openSupplyEditor}
                      last={index === travelSupplies.length - 1}
                    />
                  ),
                )
              )}

              {travelSupplies.length > 0 || travelBag.phase !== "packing" ? (
                <View style={s.travelBagActions}>
                  {travelBag.phase === "packing" ? (
                    <BoardActionButton
                      label="Activate travel bag"
                      icon="bag-check-outline"
                      variant="primary"
                      onPress={activateBag}
                      disabled={!travelAllPacked}
                      accessibilityLabel="Activate the travel bag for this trip"
                    />
                  ) : travelBag.phase === "active" ? (
                    <>
                      <BoardActionButton
                        label="Trip complete"
                        icon="checkmark-done-outline"
                        variant="primary"
                        onPress={completeBag}
                        accessibilityLabel="Mark this trip complete"
                      />
                      <BoardActionButton
                        label="Back to packing"
                        variant="soft"
                        compact
                        onPress={reopenBag}
                        accessibilityLabel="Reopen the travel bag back to packing"
                      />
                    </>
                  ) : (
                    <BoardActionButton
                      label="Redo travel bag"
                      icon="refresh-outline"
                      variant="primary"
                      onPress={redoBag}
                      accessibilityLabel="Redo the travel bag and unpack every item for the next trip"
                    />
                  )}
                </View>
              ) : null}
            </BoardCard>
            )}

            {addSupplyOpen ? (
              /* Inline add flow: confirmDialog has no prompt-style utility,
                 so the mockup's "+ Add Item" opens this cream card instead
                 of a dead button. */
              <BoardCard style={s.sectionCard} enter={2}>
                <BoardSectionHeader title="Add item" />
                <View style={s.addGroupRow}>
                  {(
                    [
                      { key: "essentials", label: "Essentials" },
                      { key: "travel", label: "Travel bag" },
                    ] as const
                  ).map((option) => {
                    const active = addSupplyGroup === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        accessibilityRole="button"
                        accessibilityLabel={`Add to ${option.label}`}
                        aria-selected={active}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setAddSupplyGroup(option.key);
                        }}
                        style={({ pressed }) => [
                          s.addGroupChip,
                          {
                            backgroundColor: active
                              ? colors.primary
                              : pressed
                                ? colors.secondary
                                : colors.card,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.addGroupChipText,
                            {
                              color: active ? colors.primaryForeground : colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={addSupplyName}
                  onChangeText={setAddSupplyName}
                  placeholder="Item name (Water bottle, Towel...)"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={saveSupplyAdd}
                  accessibilityLabel={`Name for the new ${SUPPLY_GROUP_TITLES[addSupplyGroup]} item`}
                  style={[
                    s.supplyInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                />
                <View style={s.supplyEditActions}>
                  <BoardActionButton
                    label="Add to list"
                    icon="add"
                    variant="primary"
                    compact
                    onPress={saveSupplyAdd}
                    accessibilityLabel={`Add the new item to ${SUPPLY_GROUP_TITLES[addSupplyGroup]}`}
                  />
                  <BoardActionButton
                    label="Cancel"
                    variant="soft"
                    compact
                    onPress={cancelAddSupply}
                    accessibilityLabel="Cancel adding an item"
                  />
                </View>
              </BoardCard>
            ) : (
              <BoardActionButton
                label="Add item"
                icon="add"
                variant="soft"
                onPress={openAddSupply}
                accessibilityLabel="Add an item to the supplies checklist"
                style={s.addSupplyButton}
              />
            )}
          </>
        ) : null}

        {/* Pets */}
        {segment === "pets" ? (
          <BoardCard style={s.sectionCard}>
            {/* Mock-board pet card: big storybook portrait, name, breed,
                weight, and a live presence dot - every line real. */}
            <View style={[s.petHero, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[s.petAvatarFrame, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <BreathingPetSprite
                  source={getAvatarSource(status.mood)}
                  accessibilityLabel={`${petName} avatar`}
                />
              </View>
              <View style={s.petHeroCopy}>
                <Text style={[s.petName, { color: colors.foreground, fontFamily: DISPLAY }]}>{petName}</Text>
                {state.profile.breed ? (
                  <Text
                    numberOfLines={1}
                    style={[s.petIdentity, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                  >
                    {state.profile.breed}
                  </Text>
                ) : null}
                <Text
                  numberOfLines={1}
                  style={[s.petMeta, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
                >
                  {[weightLabel, careCareer.levelLabel].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <View
                accessibilityLabel={`${petName} care status: ${status.meta.label}`}
                style={s.petStatusChip}
              >
                <View
                  style={[
                    s.petPresenceDot,
                    {
                      backgroundColor:
                        status.mood === "unwell"
                          ? colors.rose
                          : status.mood === "anxious"
                            ? colors.amber
                            : colors.sage,
                    },
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[s.petStatusText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
                >
                  {status.meta.label}
                </Text>
              </View>
            </View>

            {state.pets
              .filter((pet) => pet.name && pet.name !== petName)
              .slice(0, 3)
              .map((pet) => (
                <View
                  key={pet.id}
                  style={[s.petHero, s.petHeroSecondary, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <View style={[s.petAvatarFrame, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Image
                      source={getAvatarSource("calm")}
                      style={s.petAvatarImage}
                      resizeMode="cover"
                      accessibilityLabel={`${pet.name} avatar`}
                    />
                  </View>
                  <View style={s.petHeroCopy}>
                    <Text style={[s.petName, { color: colors.foreground, fontFamily: DISPLAY }]}>{pet.name}</Text>
                    {pet.breed ? (
                      <Text
                        numberOfLines={1}
                        style={[s.petIdentity, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                      >
                        {pet.breed}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add Pet"
              accessibilityHint="WoofWatcher supports one pup per household today."
              onPress={() =>
                notifyDialog(
                  "Add Pet",
                  `WoofWatcher supports one pup per household today - multi-pet support is on the roadmap. For now, ${petName} has your full attention.`,
                )
              }
              style={({ pressed }) => [
                s.addPetRow,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="add" size={16} color={colors.mutedForeground} />
              <Text style={[s.addPetText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                Add Pet
              </Text>
            </Pressable>

            <View style={s.infoTiles}>
              <PackInfoTile
                icon="health"
                tone={colors.sage}
                label="Health Records"
                value={
                  state.records.length
                    ? `${state.records.length} saved`
                    : "None yet"
                }
                onPress={() => open("/records")}
                accessibilityLabel={`Open saved health records for ${petName}`}
              />
              <PackInfoTile
                icon="walk"
                tone={colors.copper}
                label="Sensitivities"
                value={
                  state.dietProfile.sensitivities?.trim() ||
                  state.dietProfile.avoid?.trim() ||
                  "None noted"
                }
                onPress={() => openMoreSection("diet")}
                accessibilityLabel={`Open diet sensitivities for ${petName} in More`}
              />
            </View>
            <View style={s.infoTiles}>
              <PackInfoTile
                icon="note"
                tone={colors.blue}
                label="Reports"
                value={
                  savedReports.length
                    ? `${savedReports.length} saved`
                    : "None yet"
                }
                onPress={() => open("/records")}
                accessibilityLabel={`Open shared reports for ${petName} in Records`}
              />
              <PackInfoTile
                icon="hunger"
                tone={colors.amber}
                label="Weight"
                value={weightLabel || "Not set"}
                onPress={() => openMoreSection("diet")}
                accessibilityLabel={`Open diet and weight details for ${petName} in More`}
              />
            </View>

            {/* People in the Pack preview, mirroring the mock's Pets page. */}
            <Text style={[s.peoplePreviewTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
              People in the Pack
            </Text>
            {householdAccess.people.length === 0 ? (
              <Text style={[s.emptyCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Add the first caregiver to build household access.
              </Text>
            ) : (
              householdAccess.people.slice(0, 4).map((person, index) => {
                const tone = memberTone(index);
                return (
                  <Pressable
                    key={`preview-${person.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${person.name}, ${person.role}. Open People.`}
                    onPress={() => changeSegment("people")}
                    style={({ pressed }) => [
                      s.personRow,
                      { opacity: pressed ? 0.72 : 1 },
                      index < Math.min(householdAccess.people.length, 4) - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <PersonPortrait name={person.name} size={40} />
                    <View style={s.personCopy}>
                      <Text
                        numberOfLines={1}
                        style={[s.personName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                      >
                        {person.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[s.personMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                      >
                        {person.role}
                      </Text>
                    </View>
                    <View
                      style={[
                        s.presenceDot,
                        { backgroundColor: person.needsInvite ? colors.amber : colors.sage },
                      ]}
                    />
                  </Pressable>
                );
              })
            )}

            {/* Own heading: without it these care-hub links visually caption
                under "People in the Pack", which reads as a labeling error. */}
            <Text style={[s.peoplePreviewTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI, marginTop: 16 }]}>
              {petName}'s care spaces
            </Text>
            <View style={[s.linkList, { borderTopColor: colors.border }]}>
              <PackLinkRow
                icon="health"
                tone={colors.sage}
                title="Health Watch"
                detail="Owner notes, no diagnosis"
                onPress={() => open("/health?tab=health")}
                accessibilityLabel={`Open Health Watch for ${petName}`}
              />
              <PackLinkRow
                icon="bile"
                tone={colors.amber}
                title="Bile Watch"
                detail="Yellow bile pattern log"
                onPress={() => open("/health?tab=bile")}
                accessibilityLabel={`Open Bile Watch for ${petName}`}
              />
              <PackLinkRow
                icon="note"
                tone={colors.blue}
                title="Records & reports"
                detail={
                  state.records.length
                    ? `${state.records.length} record${state.records.length === 1 ? "" : "s"} saved`
                    : "No records saved yet"
                }
                onPress={() => open("/records")}
                accessibilityLabel={`Open records and reports for ${petName}`}
              />
              <PackLinkRow
                icon="happy"
                tone={colors.copper}
                title="Avatar Studio"
                detail={`${avatarTemplate.label} template`}
                onPress={() => open("/portrait")}
                accessibilityLabel={`Open Avatar Studio for ${petName}`}
                last
              />
            </View>
          </BoardCard>
        ) : null}

        {/* People */}
        {segment === "people" ? (
          <BoardCard style={s.sectionCard}>
            <BoardSectionHeader
              title="People"
              accessory={
                <BoardPill
                  label={`${householdAccess.people.length} ${householdAccess.people.length === 1 ? "person" : "people"}`}
                  icon="people-outline"
                  tone={colors.sage}
                />
              }
            />

            {householdAccess.people.length === 0 ? (
              <Text style={[s.emptyCopy, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                Add the first caregiver to build household access.
              </Text>
            ) : (
              /* Full roster - every person, their sync state, their real log
                 count, and the routines actually assigned to them. */
              householdAccess.people.map((person, index) => {
                const logCount = state.entries.filter(
                  (entry) => entry.caregiver.trim().toLowerCase() === person.name.toLowerCase(),
                ).length;
                const isYou = Boolean(myName) && person.name.toLowerCase() === myName.toLowerCase();
                const routineLine =
                  person.routineCount > 0
                    ? `${person.routineCount === 1 ? "Routine" : "Routines"}: ${person.routineLabels
                        .slice(0, 2)
                        .join(", ")}${person.routineLabels.length > 2 ? ` +${person.routineLabels.length - 2}` : ""}`
                    : "";
                return (
                  <View
                    key={person.id}
                    style={[
                      s.personRow,
                      index < householdAccess.people.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <PersonPortrait name={person.name} size={40} />
                    <View style={s.personCopy}>
                      <View style={s.personNameLine}>
                        <Text
                          numberOfLines={1}
                          style={[s.personName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                        >
                          {person.name}
                        </Text>
                        {isYou ? (
                          <View style={[s.youBadge, { backgroundColor: colors.primary + "1A" }]}>
                            <Text style={[s.youBadgeText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                              You
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[s.personMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                      >
                        {person.role} - {person.needsInvite ? "Invite needed" : "Synced"}
                      </Text>
                      {routineLine ? (
                        <Text
                          numberOfLines={1}
                          style={[s.personMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                        >
                          {routineLine}
                        </Text>
                      ) : null}
                    </View>
                    <View style={s.personSide}>
                      <Text
                        style={[
                          s.personSideText,
                          {
                            color: person.needsInvite ? colors.amber : colors.mutedForeground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {person.needsInvite ? "Invite" : `${logCount} log${logCount === 1 ? "" : "s"}`}
                      </Text>
                      <View
                        accessibilityLabel={
                          person.needsInvite ? `${person.name} needs an invite` : `${person.name} is synced`
                        }
                        style={[
                          s.presenceDot,
                          { backgroundColor: person.needsInvite ? colors.amber : colors.sage },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            )}

            <BoardActionButton
              label="Manage household"
              icon="key-outline"
              variant="soft"
              onPress={() => openMoreSection("household")}
              accessibilityLabel="Open the Care Team section in More to manage the household"
              style={s.segmentAction}
            />
          </BoardCard>
        ) : null}

        {/* Access */}
        {segment === "access" ? (
          <BoardCard style={[s.sectionCard, { borderColor: accessTone + "44" }]}>
            <BoardSectionHeader
              title="Access"
              accessory={
                <BoardStatusPill
                  label={
                    householdAccess.status === "ready"
                      ? "Aligned"
                      : accessNotSetUp
                        ? "Not set up yet"
                        : "Needs review"
                  }
                  tone={
                    householdAccess.status === "ready" ? "done" : accessNotSetUp ? "neutral" : "due"
                  }
                />
              }
            />

            <Text style={[s.accessTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
              {householdAccess.householdName}
            </Text>
            <Text style={[s.accessSummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {householdAccess.summary}
            </Text>

            <View style={s.accessMetrics}>
              {[
                { label: "Synced", value: householdAccess.syncedMembers },
                { label: "Invites", value: householdAccess.localOnlyCaregivers },
                { label: "Routine-only", value: householdAccess.routineOnlyOwners },
              ].map((metric) => (
                <View key={metric.label} style={[s.accessMetric, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[s.accessMetricValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {metric.value}
                  </Text>
                  <Text style={[s.accessMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {metric.label}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[s.accessNext, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {householdAccess.nextStep}
            </Text>

            {/* Temporary helper passes: the same real counts the More console
                derives, surfaced here so Access reads as a full picture. */}
            <Text style={[s.accessSubheading, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
              Access Passes
            </Text>
            <View style={s.accessMetrics}>
              {[
                { label: "Active", value: accessPassPlan.activeCount },
                { label: "Upcoming", value: accessPassPlan.upcomingCount },
                { label: "Drafts", value: accessPassPlan.draftCount },
              ].map((metric) => (
                <View
                  key={`pass-${metric.label}`}
                  style={[s.accessMetric, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Text style={[s.accessMetricValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                    {metric.value}
                  </Text>
                  <Text style={[s.accessMetricLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {metric.label}
                  </Text>
                </View>
              ))}
            </View>
            {accessPassPlan.passes.length > 0 ? (
              accessPassPlan.passes.slice(0, 2).map((pass) => (
                <View key={pass.id} style={s.passRow}>
                  <View style={s.personCopy}>
                    <Text
                      numberOfLines={1}
                      style={[s.personName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                    >
                      {pass.holderName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[s.personMeta, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                    >
                      {pass.role} - {pass.timeLabel}
                    </Text>
                  </View>
                  <BoardStatusPill
                    label={pass.status}
                    tone={
                      pass.status === "active" ? "done" : pass.status === "upcoming" ? "upcoming" : "neutral"
                    }
                  />
                </View>
              ))
            ) : (
              <Text style={[s.accessPassEmpty, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {accessPassPlan.summary}
              </Text>
            )}

            <BoardActionButton
              label="Open household console"
              icon="key-outline"
              variant="soft"
              onPress={() => openMoreSection("access")}
              accessibilityLabel="Open the Household Access section in More"
              style={s.segmentAction}
            />
          </BoardCard>
        ) : null}

        {/* Care Pass */}
        {segment === "carepass" ? (
          <BoardCard style={s.sectionCard}>
            <BoardSectionHeader
              title="Care Pass"
              accessory={
                <BoardPill
                  label={savedReports.length ? `${savedReports.length} saved` : "No saved"}
                  icon="card-outline"
                  tone={colors.primary}
                />
              }
            />

            <Text style={[s.carePassSummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {carePass.summary}
            </Text>

            {/* Real section titles from the live pass, so "17 sections" has
                faces: identity, diet, routines, and the rest. */}
            <View
              accessibilityLabel={`Care Pass sections: ${carePass.sections
                .map((section) => section.title)
                .join(", ")}`}
              style={s.passSectionChips}
            >
              {carePass.sections.slice(0, 5).map((section) => (
                <View
                  key={section.title}
                  style={[s.passSectionChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                >
                  <Text
                    numberOfLines={1}
                    style={[s.passSectionChipText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                  >
                    {section.title}
                  </Text>
                </View>
              ))}
              {carePass.sections.length > 5 ? (
                <View style={[s.passSectionChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text
                    style={[s.passSectionChipText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}
                  >
                    +{carePass.sections.length - 5} more
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={s.metricStack}>
              <BoardMetricTile
                icon="note"
                label="Sections ready"
                value={String(carePass.sections.length)}
                detail="Built live from real care logs"
                tone={colors.copper}
              />
              <BoardMetricTile
                icon="clock"
                label="Reports saved"
                value={String(savedReports.length)}
                detail={latestReport ? `Latest: ${latestReport.title}` : "Share a Care Pass to start history"}
                tone={colors.sage}
              />
            </View>

            {latestReport ? (
              /* Freshness of the last built pass - title, age, and its saved
                 summary, straight from the report artifact. */
              <View style={[s.lastPassCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={s.lastPassHead}>
                  <Text style={[s.lastPassKicker, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>
                    Last built
                  </Text>
                  <Text style={[s.lastPassFreshness, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {relativeTime(latestReport.createdAt, now)}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[s.lastPassTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                >
                  {latestReport.title}
                </Text>
                {latestReport.summary ? (
                  <Text
                    numberOfLines={2}
                    style={[s.lastPassSummary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
                  >
                    {latestReport.summary}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <BoardActionButton
              label="Build & share Care Pass"
              icon="share-outline"
              variant="primary"
              onPress={() => openMoreSection("care-pass")}
              accessibilityLabel="Open the Care Pass builder in More Tools and Sharing"
              style={s.segmentAction}
            />

            <View style={[s.linkList, { borderTopColor: colors.border }]}>
              <PackLinkRow
                icon="note"
                tone={colors.blue}
                title="Report history"
                detail={
                  savedReports.length
                    ? `${savedReports.length} shared report${savedReports.length === 1 ? "" : "s"}`
                    : "Shared Care Passes appear in Records"
                }
                onPress={() => open("/records")}
                accessibilityLabel="Open report history in Records"
                last
              />
            </View>
          </BoardCard>
        ) : null}

        <View style={[s.boundaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.boundaryLabel, { color: colors.sage, fontFamily: "Inter_700Bold" }]}>Care boundary</Text>
          <Text style={[s.boundary, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {state.profile.vetBoundary}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  routeHeaderCompact: {
    marginBottom: 10,
  },
  segmentScroll: {
    flexGrow: 0,
    marginBottom: 2,
  },
  segmentScrollContent: {
    flexGrow: 1,
  },
  segmentTabsInline: {
    flex: 1,
    marginBottom: 0,
  },
  sectionCard: { marginTop: 10 },
  segmentAction: {
    marginTop: 12,
  },

  suppliesHint: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 4,
  },
  supplyRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  supplyName: {
    fontSize: 13,
  },
  supplyUpdated: {
    fontSize: 11,
    marginTop: 1,
  },
  supplyPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 999,
    minHeight: 24,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  supplyPillText: {
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  supplyEditCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginVertical: 6,
  },
  supplyInput: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
  },
  supplyEditActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  travelCaptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  travelBagActions: {
    gap: 8,
    marginTop: 12,
  },
  supplyRemoveLayout: {
    marginLeft: "auto",
  },
  supplyRemoveButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  supplyRemoveText: {
    fontSize: 12,
  },
  addGroupRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  addGroupChip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addGroupChipText: {
    fontSize: 12.5,
  },
  addSupplyButton: {
    marginTop: 10,
  },

  petHero: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  petHeroSecondary: {
    marginTop: 8,
  },
  petAvatarFrame: {
    width: 88,
    height: 88,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  petStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  petStatusText: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  petPresenceDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  addPetRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    marginTop: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  addPetText: {
    fontSize: 12.5,
  },
  peoplePreviewTitle: {
    fontSize: 15,
    marginTop: 14,
    marginBottom: 2,
  },
  petAvatarImage: {
    width: "100%",
    height: "100%",
  },
  petHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  petName: {
    fontSize: 21,
    lineHeight: 25,
  },
  petIdentity: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  petMeta: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  petLevelPill: {
    alignSelf: "flex-start",
  },
  xpBlock: {
    marginTop: 10,
  },
  levelTrack: {
    height: 9,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  levelFill: {
    height: "100%",
    borderRadius: 999,
  },
  levelMeta: {
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 4,
  },
  metricStack: {
    gap: 8,
    marginTop: 10,
  },
  infoTiles: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  infoTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  infoTileChip: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTileLabel: {
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: 0.2,
    marginTop: 7,
  },
  infoTileValue: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
  },
  linkList: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 2,
  },
  linkRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  linkChip: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  linkCopy: {
    flex: 1,
    minWidth: 0,
  },
  linkTitle: {
    fontSize: 13,
  },
  linkDetail: {
    fontSize: 11,
    marginTop: 1,
  },

  emptyCopy: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  personRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  personAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  personInitial: {
    fontSize: 14,
  },
  personCopy: {
    flex: 1,
    minWidth: 0,
  },
  personNameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  personName: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13.5,
  },
  youBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  youBadgeText: {
    fontSize: 9.5,
  },
  personMeta: {
    fontSize: 11.5,
    marginTop: 1,
  },
  personSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  personSideText: {
    fontSize: 10.5,
  },
  presenceDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },

  accessTitle: {
    fontSize: 16,
    lineHeight: 20,
  },
  accessSummary: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  accessMetrics: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  accessMetric: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  accessMetricValue: {
    fontSize: 17,
    lineHeight: 21,
  },
  accessMetricLabel: {
    fontSize: 10.5,
    marginTop: 2,
  },
  accessNext: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  accessSubheading: {
    fontSize: 15,
    marginTop: 14,
  },
  accessPassEmpty: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  passRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },

  carePassSummary: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  passSectionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  passSectionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  passSectionChipText: {
    fontSize: 11,
  },
  lastPassCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  lastPassHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  lastPassKicker: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  lastPassFreshness: {
    fontSize: 11,
  },
  lastPassTitle: {
    fontSize: 13.5,
    marginTop: 5,
  },
  lastPassSummary: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
  },

  boundaryCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
  },
  boundaryLabel: { fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase" },
  boundary: { fontSize: 12, lineHeight: 18, marginTop: 5 },
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
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
import { getGetMeQueryKey, useGetMe } from "@workspace/api-client-react";
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
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  BoardMedallion,
  type MedallionName,
} from "@/components/BoardMedallion";
import { PersonPortrait } from "@/components/PersonPortrait";
import { PressScale } from "@/components/motion/GameFeel";
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { isClerkEnabledForBuild, useWoofAuth } from "@/lib/auth";
import { announce } from "@/lib/announce";
import { getAvatarTemplate } from "@/lib/avatarStudio";
import { getConsumerSurfacePolicy } from "@/lib/consumerSurfacePolicy";
import { confirmThroughSteps, notifyDialog } from "@/lib/confirmDialog";
import { deriveCareCareer, deriveCareStreak } from "@/lib/careCareer";
import {
  getFormKeyboardScrollProps,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import {
  addItem,
  cycleStatus,
  isDefaultUntouched,
  removeItem,
  renameItem,
  type SupplyGroup,
  type SupplyItem,
  type SupplyStatus,
} from "@/lib/packSupplies";
import {
  createPackPersistence,
  getPackStorageWarningPresentation,
  registerPackPersistenceForOwnerWipe,
  type PackStorageWarning,
} from "@/lib/packPersistence";
import {
  activateTravelBag,
  completeTravelBag,
  defaultTravelBag,
  redoTravelBag,
  renameTravelBag,
  reopenTravelBag,
  resetTravelItems,
  type TravelBagSession,
} from "@/lib/travelBag";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";
import { resolvePetName } from "@/lib/petIdentity";
import { shareTextPayload } from "@/lib/shareText";
import { relativeTime } from "@/lib/time";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type HouseholdMemberSummary = {
  displayName?: string | null;
  email?: string | null;
  role?: string | null;
};

type PackSegment = "supplies" | "pets" | "people" | "access" | "carepass";
type PackStoreKind = "supplies" | "travelBag";

const PACK_SEGMENTS: readonly { key: PackSegment; label: string }[] = [
  { key: "supplies", label: "Supplies" },
  { key: "pets", label: "Pets" },
  { key: "people", label: "People" },
  { key: "access", label: "Access" },
  { key: "carepass", label: "Care Pass" },
];

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
  const look: Record<
    SupplyStatus,
    { label: string; bg: string; fg: string; icon?: IoniconName }
  > = {
    plenty: { label: "Plenty", bg: colors.sageSoft, fg: colors.forest },
    low: { label: "Low", bg: colors.amberSoft, fg: colors.amber },
    out: { label: "Out", bg: colors.rose + "1C", fg: colors.rose },
    packed: {
      label: "Packed",
      bg: colors.sageSoft,
      fg: colors.forest,
      icon: "checkmark",
    },
    unpacked: {
      label: "Unpacked",
      bg: colors.muted,
      fg: colors.mutedForeground,
    },
  };
  const swatch = look[status];
  return (
    <View style={[s.supplyPill, { backgroundColor: swatch.bg }]}>
      {swatch.icon ? (
        <Ionicons name={swatch.icon} size={11} color={swatch.fg} />
      ) : null}
      <Text
        style={[
          s.supplyPillText,
          { color: swatch.fg, fontFamily: "Inter_700Bold" },
        ]}
      >
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
  const updatedLabel = rel
    ? rel === "Just now"
      ? "Updated just now"
      : `Updated ${rel}`
    : null;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${item.name}: ${item.status}${updatedLabel ? `. ${updatedLabel}` : ""}`}
      accessibilityHint="Tap to cycle the status. Long press to rename or remove."
      onPress={() => onCycle(item)}
      onLongPress={() => onEdit(item)}
      delayLongPress={350}
      scaleTo={0.97}
      style={[
        s.supplyRow,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={[s.linkChip, { backgroundColor: colors.secondary }]}>
        <PixelIcon name={supplyIcon(item)} size={20} />
      </View>
      <View style={s.linkCopy}>
        <Text
          numberOfLines={1}
          style={[
            s.supplyName,
            { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {item.name}
        </Text>
        {updatedLabel ? (
          <Text
            numberOfLines={1}
            style={[
              s.supplyUpdated,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
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
    <View
      style={[
        s.supplyEditCard,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
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
          style={[
            s.supplyRemoveButton,
            { backgroundColor: colors.rose + "14" },
          ]}
        >
          <Ionicons name="trash-outline" size={14} color={colors.rose} />
          <Text
            style={[
              s.supplyRemoveText,
              { color: colors.rose, fontFamily: "Inter_700Bold" },
            ]}
          >
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
          style={[
            s.linkTitle,
            { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {title}
        </Text>
        {detail ? (
          <Text
            numberOfLines={1}
            style={[
              s.linkDetail,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={15}
        color={colors.mutedForeground}
      />
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
        style={[
          s.infoTileLabel,
          { color: colors.mutedForeground, fontFamily: "Inter_700Bold" },
        ]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          s.infoTileValue,
          { color: colors.foreground, fontFamily: DISPLAY_SEMI },
        ]}
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
function BreathingPetSprite({ source }: { source: ImageSourcePropType }) {
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
      accessible={false}
      source={source}
      style={[s.petAvatarImage, breathStyle]}
      resizeMode="cover"
    />
  );
}

export default function PackScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const { avatarConfig, getAvatarSource } = useAvatar();
  const { isSignedIn } = useWoofAuth();
  const consumerSurfacePolicy = getConsumerSurfacePolicy();
  const me = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled:
        consumerSurfacePolicy.householdProviderActions &&
        isClerkEnabledForBuild &&
        Boolean(isSignedIn),
    },
  });
  const now = Date.now();
  const [segment, setSegment] = useState<PackSegment>("supplies");
  const visiblePackSegments = consumerSurfacePolicy.householdProviderActions
    ? PACK_SEGMENTS
    : PACK_SEGMENTS.filter((item) => item.key !== "access");

  useEffect(() => {
    if (
      !consumerSurfacePolicy.householdProviderActions &&
      segment === "access"
    ) {
      setSegment("people");
    }
  }, [consumerSurfacePolicy.householdProviderActions, segment]);

  // Supplies checklist: null until the stored list loads, so the starter
  // defaults never flash in over a user's saved answers (same pattern as
  // HOME_WELCOME_DISMISSED_KEY on Home).
  const [supplies, setSupplies] = useState<SupplyItem[] | null>(null);
  const [editingSupplyId, setEditingSupplyId] = useState<string | null>(null);
  const [editSupplyName, setEditSupplyName] = useState("");
  const [addSupplyOpen, setAddSupplyOpen] = useState(false);
  const [addSupplyName, setAddSupplyName] = useState("");
  const [addSupplyGroup, setAddSupplyGroup] =
    useState<SupplyGroup>("essentials");
  const [travelBag, setTravelBag] =
    useState<TravelBagSession>(defaultTravelBag);
  const [editingBagLabel, setEditingBagLabel] = useState(false);
  const [bagLabelDraft, setBagLabelDraft] = useState("");
  const [packStorageWarning, setPackStorageWarning] =
    useState<PackStorageWarning | null>(null);
  const [packStorageRetrying, setPackStorageRetrying] = useState(false);
  const [packRecoveryCopy, setPackRecoveryCopy] = useState("");
  const [packPersistence] = useState(() => createPackPersistence(AsyncStorage));
  const suppliesRef = useRef<SupplyItem[] | null>(null);
  const travelBagRef = useRef(travelBag);
  const failedPackWritesRef = useRef(new Set<PackStoreKind>());
  const packWriteRevisionRef = useRef<Record<PackStoreKind, number>>({
    supplies: 0,
    travelBag: 0,
  });
  suppliesRef.current = supplies;
  travelBagRef.current = travelBag;

  useEffect(
    () => registerPackPersistenceForOwnerWipe(packPersistence),
    [packPersistence],
  );

  useEffect(() => {
    if (segment !== "supplies") setPackRecoveryCopy("");
  }, [segment]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") setPackRecoveryCopy("");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void packPersistence.hydrate().then((result) => {
      if (cancelled) return;
      packWriteRevisionRef.current.supplies += 1;
      packWriteRevisionRef.current.travelBag += 1;
      failedPackWritesRef.current.clear();
      if (result.status !== "ready") {
        suppliesRef.current = null;
        setSupplies(null);
        setPackStorageWarning(result.status);
        return;
      }
      suppliesRef.current = result.supplies;
      travelBagRef.current = result.travelBag;
      setSupplies(result.supplies);
      setTravelBag(result.travelBag);
      setPackStorageWarning(null);
    });
    return () => {
      cancelled = true;
    };
  }, [packPersistence]);

  useEffect(() => {
    if (!packStorageWarning) return;
    const warning = getPackStorageWarningPresentation(packStorageWarning);
    announce(`${warning.title}. ${warning.message}`);
  }, [packStorageWarning]);

  const household = me.data?.household;
  const members: HouseholdMemberSummary[] = me.data?.members ?? [];
  const myName = me.data?.user?.displayName?.trim() || "";

  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  const petName = resolvePetName(state.profile.name);

  const status = useMemo(() => derivePhoenixStatus(state, now), [state, now]);
  const careCareer = useMemo(
    () => deriveCareCareer(state.entries, now),
    [state.entries, now],
  );
  const careStreak = useMemo(
    () => deriveCareStreak(state.entries, now),
    [state.entries, now],
  );
  const avatarTemplate = useMemo(
    () => getAvatarTemplate(avatarConfig.templateId),
    [avatarConfig.templateId],
  );

  const householdAccess = useMemo(
    () =>
      deriveHouseholdAccessPlan({
        household: household
          ? { name: household.name, inviteCode: household.inviteCode }
          : null,
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
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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
    householdAccess.status === "needs-household" &&
    householdAccess.people.length === 0;
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
    weightCurrent > 0
      ? `${weightCurrent} ${state.profile.weight?.unit || "lb"}`
      : "";
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
  const openMoreSection = (
    section: "household" | "access" | "care-pass" | "diet",
  ) => {
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
  const packedCount = travelSupplies.filter(
    (item) => item.status === "packed",
  ).length;
  const suppliesUntouched = supplies ? isDefaultUntouched(supplies) : false;

  // Phase-driven travel-bag chrome (packing -> active -> complete). Every
  // signal is real: the packed count is the checklist truth, "Active since"
  // and "Trip wrapped" read from the owner's own Activate/Complete taps.
  const travelAllPacked =
    travelSupplies.length > 0 && packedCount === travelSupplies.length;
  const travelPill: { label: string; tone: string; icon?: "checkmark" } =
    travelBag.phase === "active"
      ? { label: "Active", tone: colors.sage, icon: "checkmark" }
      : travelBag.phase === "complete"
        ? { label: "Trip done", tone: colors.mutedForeground }
        : travelSupplies.length === 0
          ? { label: "Empty", tone: colors.mutedForeground }
          : {
              label: `${packedCount}/${travelSupplies.length} packed`,
              tone: travelAllPacked ? colors.sage : colors.mutedForeground,
              ...(travelAllPacked ? { icon: "checkmark" as const } : {}),
            };
  const travelCaption =
    travelBag.phase === "active"
      ? travelBag.activatedAt
        ? `Packed and out the door - active since ${relativeTime(travelBag.activatedAt, now)}.`
        : "Packed and out the door."
      : travelBag.phase === "complete"
        ? travelBag.completedAt
          ? `Trip wrapped ${relativeTime(travelBag.completedAt, now)} - redo to pack the next one.`
          : "Trip wrapped - redo to pack the next one."
        : packedCount === 0
          ? "Check your gear off, then activate the bag."
          : "Gear checked. Activate the bag when you're ready to go.";

  /**
   * Save every owner change in order and keep failures visible. Revisions
   * prevent an older write's eventual result from overriding the state of a
   * newer queued write.
   */
  const persistPackWrite = (
    kind: PackStoreKind,
    save: () => Promise<void>,
  ): Promise<boolean> => {
    const revision = ++packWriteRevisionRef.current[kind];
    return save().then(
      () => {
        if (packWriteRevisionRef.current[kind] === revision) {
          failedPackWritesRef.current.delete(kind);
          if (failedPackWritesRef.current.size === 0) {
            setPackStorageWarning((current) =>
              current === "save-failed" ? null : current,
            );
          }
        }
        return true;
      },
      () => {
        if (packWriteRevisionRef.current[kind] === revision) {
          failedPackWritesRef.current.add(kind);
          setPackStorageWarning((current) =>
            current === "read-failed" || current === "corrupt-data"
              ? current
              : "save-failed",
          );
        }
        return false;
      },
    );
  };

  const commitSupplies = (next: SupplyItem[]) => {
    suppliesRef.current = next;
    setSupplies(next);
    void persistPackWrite("supplies", () => packPersistence.saveSupplies(next));
  };

  const commitTravelBag = (next: TravelBagSession) => {
    travelBagRef.current = next;
    setTravelBag(next);
    void persistPackWrite("travelBag", () =>
      packPersistence.saveTravelBag(next),
    );
  };

  const retryPackStorage = async () => {
    if (packStorageRetrying || !packStorageWarning) return;
    setPackStorageRetrying(true);
    try {
      if (packStorageWarning !== "save-failed") {
        const result = await packPersistence.hydrate();
        packWriteRevisionRef.current.supplies += 1;
        packWriteRevisionRef.current.travelBag += 1;
        failedPackWritesRef.current.clear();
        if (result.status !== "ready") {
          suppliesRef.current = null;
          setSupplies(null);
          setPackStorageWarning(result.status);
          announce(
            result.status === "corrupt-data"
              ? "Pack data still needs recovery. Changes remain paused."
              : "Pack still couldn't load safely. Changes remain paused.",
          );
          return;
        }
        suppliesRef.current = result.supplies;
        travelBagRef.current = result.travelBag;
        setSupplies(result.supplies);
        setTravelBag(result.travelBag);
        setPackStorageWarning(null);
        announce("Pack loaded. Your saved checklist is available again.");
        return;
      }

      const failedKinds = [...failedPackWritesRef.current];
      await Promise.all(
        failedKinds.map((kind) => {
          if (kind === "supplies") {
            const current = suppliesRef.current;
            return current
              ? persistPackWrite(kind, () =>
                  packPersistence.saveSupplies(current),
                )
              : Promise.resolve(false);
          }
          const current = travelBagRef.current;
          return persistPackWrite(kind, () =>
            packPersistence.saveTravelBag(current),
          );
        }),
      );
      announce(
        failedPackWritesRef.current.size === 0
          ? "Pack changes saved."
          : "Pack changes still aren't saved. Please try again.",
      );
    } finally {
      setPackStorageRetrying(false);
    }
  };

  const recoverCorruptPack = () => {
    if (packStorageRetrying || packStorageWarning !== "corrupt-data") return;
    confirmThroughSteps(
      [
        {
          title: "Back up and reset Pack?",
          message:
            "WoofWatcher will preserve the unreadable Pack payloads in a recovery copy on this device, then replace Supplies and Travel Bag with fresh starter lists. This cannot restore the old checklist in the app.",
          confirmLabel: "Back up and reset",
          destructive: true,
        },
      ],
      () => {
        setPackStorageRetrying(true);
        void packPersistence
          .recoverCorruptData()
          .then((result) => {
            packWriteRevisionRef.current.supplies += 1;
            packWriteRevisionRef.current.travelBag += 1;
            failedPackWritesRef.current.clear();
            if (result.status !== "ready") {
              setPackStorageWarning("corrupt-data");
              announce(
                "Pack recovery could not finish. Changes remain paused; retry recovery before editing.",
              );
              return;
            }
            suppliesRef.current = result.supplies;
            travelBagRef.current = result.travelBag;
            setSupplies(result.supplies);
            setTravelBag(result.travelBag);
            setPackStorageWarning(null);
            announce(
              "Pack reset with fresh starter lists. The unreadable data was kept in a recovery copy on this device.",
            );
          })
          .finally(() => setPackStorageRetrying(false));
      },
    );
  };

  const exportPackRecoveryCopy = async () => {
    const result = await packPersistence.exportRecoveryCopy();
    if (result.status === "ready") {
      setPackRecoveryCopy(result.serialized);
      const shareOutcome = await shareTextPayload({
        message: result.serialized,
        title: "WoofWatcher Pack recovery copy",
      });
      announce(
        shareOutcome === "failed"
          ? "Sharing was unavailable. Recovery copy is shown below for manual copy. It contains private raw Pack data."
          : "Pack recovery copy shared or saved. A manual copy remains shown below. It contains private raw Pack data.",
      );
      return;
    }
    notifyDialog(
      "Recovery copy unavailable",
      result.status === "none"
        ? "There is no preserved corrupt Pack recovery copy on this device."
        : "WoofWatcher could not safely read the preserved recovery copy.",
    );
  };

  const restorePackRecoveryCopy = async () => {
    const result = await packPersistence.restoreRecoveryCopy(packRecoveryCopy);
    if (result.status === "restored" || result.status === "already-present") {
      setPackRecoveryCopy("");
      announce("Pack recovery copy preserved on this device.");
      notifyDialog(
        "Recovery copy preserved",
        "The imported copy is available for support or later export. It does not replace your active Supplies or Travel Bag.",
      );
      return;
    }
    notifyDialog(
      result.status === "conflict" ? "Recovery copy already exists" : "Recovery copy not restored",
      result.status === "conflict"
        ? "This device already has a different first recovery copy. WoofWatcher kept that original copy unchanged."
        : "Paste a complete WoofWatcher Pack recovery copy and try again.",
    );
  };

  const activateBag = () => {
    const currentSupplies = suppliesRef.current ?? [];
    const currentPackedCount = currentSupplies.filter(
      (item) => item.group === "travel" && item.status === "packed",
    ).length;
    const next = activateTravelBag(
      travelBagRef.current,
      currentPackedCount,
      new Date().toISOString(),
    );
    if (!next) {
      notifyDialog(
        "Pack something first",
        "Check at least one item off before you activate the bag - an empty bag isn't ready to go.",
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    commitTravelBag(next);
  };

  const completeBag = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    commitTravelBag(
      completeTravelBag(travelBagRef.current, new Date().toISOString()),
    );
  };

  const reopenBag = () => {
    Haptics.selectionAsync().catch(() => {});
    commitTravelBag(reopenTravelBag(travelBagRef.current));
  };

  const redoBag = () => {
    confirmThroughSteps(
      [
        {
          title: "Redo the bag?",
          message:
            "This unpacks every travel item so you can pack fresh for the next trip.",
          confirmLabel: "Redo bag",
        },
      ],
      () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        const currentSupplies = suppliesRef.current;
        if (currentSupplies) commitSupplies(resetTravelItems(currentSupplies));
        commitTravelBag(redoTravelBag(travelBagRef.current));
      },
    );
  };

  const openBagLabelEditor = () => {
    Haptics.selectionAsync().catch(() => {});
    setBagLabelDraft(travelBagRef.current.label);
    setEditingBagLabel(true);
  };

  const saveBagLabel = () => {
    commitTravelBag(renameTravelBag(travelBagRef.current, bagLabelDraft));
    setEditingBagLabel(false);
    setBagLabelDraft("");
  };

  const cycleSupply = (item: SupplyItem) => {
    const currentSupplies = suppliesRef.current;
    if (!currentSupplies) return;
    const stampedAt = new Date().toISOString();
    commitSupplies(
      currentSupplies.map((entry) =>
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

  const saveSupplyRename = () => {
    const currentSupplies = suppliesRef.current;
    if (!currentSupplies || !editingSupplyId) return;
    const trimmed = editSupplyName.trim();
    if (!trimmed) {
      notifyDialog(
        "Name needed",
        "Give this item a short name, or cancel the edit.",
      );
      return;
    }
    const next = renameItem(currentSupplies, editingSupplyId, editSupplyName);
    if (!next) {
      notifyDialog(
        "Already on the list",
        `"${trimmed}" is already in this group. Pick a different name.`,
      );
      return;
    }
    commitSupplies(next);
    closeSupplyEditor();
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
        // The themed dialog resolves later, so read the synchronously updated
        // ref rather than the list captured when the dialog opened.
        const currentSupplies = suppliesRef.current;
        if (currentSupplies) {
          commitSupplies(removeItem(currentSupplies, item.id));
        }
        closeSupplyEditor();
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

  const saveSupplyAdd = () => {
    const currentSupplies = suppliesRef.current;
    if (!currentSupplies) return;
    const trimmed = addSupplyName.trim();
    if (!trimmed) {
      notifyDialog(
        "Name needed",
        "Give the new item a short name, like Water bottle or Towel.",
      );
      return;
    }
    const next = addItem(currentSupplies, addSupplyName, addSupplyGroup);
    if (!next) {
      notifyDialog(
        "Already on the list",
        `"${trimmed}" is already in ${SUPPLY_GROUP_TITLES[addSupplyGroup]}. Rename that item instead of doubling it.`,
      );
      return;
    }
    commitSupplies(next);
    setAddSupplyName("");
    setAddSupplyOpen(false);
  };

  const packStorageWarningPresentation = packStorageWarning
    ? getPackStorageWarningPresentation(packStorageWarning)
    : null;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        {...getFormKeyboardScrollProps(Platform.OS)}
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
          actionIcon="key-outline"
          actionLabel="Manage household from Pack"
          onAction={() => openMoreSection("household")}
          plain
          style={s.routeHeaderCompact}
        />

        {packStorageWarningPresentation ? (
          <BoardCard
            style={[
              s.packStorageWarningCard,
              {
                backgroundColor: colors.amberSoft,
                borderColor: colors.amber + "66",
              },
            ]}
          >
            <View style={s.packStorageWarningRow}>
              <Ionicons
                accessible={false}
                name="warning-outline"
                size={19}
                color={colors.amber}
              />
              <Text
                accessibilityRole="alert"
                aria-live="assertive"
                selectable
                style={[
                  s.packStorageWarningText,
                  { color: colors.foreground, fontFamily: "Inter_500Medium" },
                ]}
              >
                <Text style={{ fontFamily: "Inter_700Bold" }}>
                  {packStorageWarningPresentation.title}
                </Text>
                {"\n"}
                {packStorageWarningPresentation.message}
              </Text>
            </View>
            <BoardActionButton
              label={
                packStorageRetrying
                  ? "Retrying..."
                  : packStorageWarningPresentation.retryLabel
              }
              icon="refresh-outline"
              variant="outline"
              compact
              disabled={packStorageRetrying}
              onPress={() => void retryPackStorage()}
              accessibilityLabel={
                packStorageRetrying
                  ? "Retrying Pack storage"
                  : packStorageWarningPresentation.retryLabel
              }
              style={s.packStorageRetryButton}
            />
            {packStorageWarningPresentation.recoveryLabel ? (
              <BoardActionButton
                label={packStorageWarningPresentation.recoveryLabel}
                icon="archive-outline"
                variant="outline"
                compact
                disabled={packStorageRetrying}
                onPress={recoverCorruptPack}
                accessibilityLabel={
                  packStorageWarningPresentation.recoveryLabel
                }
                style={s.packStorageRecoveryButton}
              />
            ) : null}
          </BoardCard>
        ) : null}

        {segment === "supplies" ? (
          <BoardCard style={s.packRecoveryCopyCard} tone="soft">
            <BoardSectionHeader
              title="Preserved Pack data"
            />
            <Text style={[s.packRecoveryCopyBoundary, { color: colors.mutedForeground }]}>Export the first unreadable Pack payload for safekeeping, or import a copy without changing your active lists. The export contains private raw Pack data.</Text>
            <BoardActionButton
              label="Export recovery copy"
              icon="share-outline"
              variant="outline"
              compact
              onPress={() => void exportPackRecoveryCopy()}
              accessibilityLabel="Export recovery copy"
            />
            <TextInput
              value={packRecoveryCopy}
              onChangeText={setPackRecoveryCopy}
              placeholder="Paste Pack recovery copy JSON"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              accessibilityLabel="Pack recovery copy JSON"
              style={[
                s.packRecoveryCopyInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            />
            {packRecoveryCopy ? (
              <BoardActionButton
                label="Clear recovery copy"
                icon="close-circle-outline"
                variant="soft"
                compact
                onPress={() => setPackRecoveryCopy("")}
                accessibilityLabel="Clear private Pack recovery copy from this screen"
              />
            ) : null}
            <BoardActionButton
              label="Restore recovery copy"
              icon="download-outline"
              variant="outline"
              compact
              disabled={!packRecoveryCopy.trim()}
              onPress={() => void restorePackRecoveryCopy()}
              accessibilityLabel="Restore recovery copy"
            />
            <Text style={[s.packRecoveryCopyBoundary, { color: colors.mutedForeground }]}>This preserves support evidence only and does not replace your active Supplies or Travel Bag.</Text>
          </BoardCard>
        ) : null}

        {/* Five segments outgrow one 390pt row, so the chips scroll sideways
            at natural width instead of squeezing their labels into ellipses. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.segmentScroll}
          contentContainerStyle={s.segmentScrollContent}
        >
          <BoardSegmentTabs
            segments={visiblePackSegments}
            active={segment}
            onChange={changeSegment}
            style={s.segmentTabsInline}
          />
        </ScrollView>

        {/* Supplies - the mockup Pack page's Essentials / Travel Bag boards.
            Every status is the owner's own answer; untouched defaults say so
            instead of pretending someone already checked the shelf. */}
        {segment === "supplies" &&
        !supplies &&
        !packStorageWarningPresentation ? (
          <BoardCard style={s.sectionCard} tone="soft">
            <Text
              aria-live="polite"
              style={[
                s.packStorageLoadingText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              Loading your saved Pack...
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
                        : suppliesUntouched
                          ? "Starter list"
                          : restockCount > 0
                            ? `${restockCount} to restock`
                            : "All plenty"
                    }
                    tone={
                      essentialSupplies.length === 0 || suppliesUntouched
                        ? colors.mutedForeground
                        : restockCount > 0
                          ? colors.amber
                          : colors.sage
                    }
                  />
                }
              />
              {suppliesUntouched ? (
                <Text
                  style={[
                    s.suppliesHint,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  Starter checklist - the statuses are yours to set. Tap a row
                  to update it, long-press to rename or remove.
                </Text>
              ) : null}
              {essentialSupplies.length === 0 ? (
                <Text
                  style={[
                    s.emptyCopy,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
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

            <BoardCard style={s.sectionCard} enter={1}>
              <BoardSectionHeader
                title={travelBag.label}
                accessory={
                  <BoardPill
                    label={travelPill.label}
                    icon={travelPill.icon}
                    tone={travelPill.tone}
                  />
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
                  <Text
                    style={[
                      s.emptyCopy,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                        flex: 1,
                      },
                    ]}
                  >
                    {travelCaption}
                  </Text>
                  <Ionicons
                    name="pencil"
                    size={13}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              )}

              {travelSupplies.length === 0 ? (
                <Text
                  style={[
                    s.emptyCopy,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
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
                      disabled={packedCount === 0}
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
                            borderColor: active
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.addGroupChipText,
                            {
                              color: active
                                ? colors.primaryForeground
                                : colors.foreground,
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
            <View
              style={[
                s.petHero,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  s.petAvatarFrame,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <BreathingPetSprite source={getAvatarSource(status.mood)} />
              </View>
              <View style={s.petHeroCopy}>
                <Text
                  style={[
                    s.petName,
                    { color: colors.foreground, fontFamily: DISPLAY },
                  ]}
                >
                  {petName}
                </Text>
                {state.profile.breed ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      s.petIdentity,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {state.profile.breed}
                  </Text>
                ) : null}
                <Text
                  numberOfLines={1}
                  style={[
                    s.petMeta,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {[weightLabel, careCareer.levelLabel]
                    .filter(Boolean)
                    .join(" · ")}
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
                  style={[
                    s.petStatusText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
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
                  style={[
                    s.petHero,
                    s.petHeroSecondary,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.petAvatarFrame,
                      {
                        backgroundColor: colors.secondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Image
                      accessible={false}
                      source={getAvatarSource("calm")}
                      style={s.petAvatarImage}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={s.petHeroCopy}>
                    <Text
                      style={[
                        s.petName,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {pet.name}
                    </Text>
                    {pet.breed ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          s.petIdentity,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
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
              <Text
                style={[
                  s.addPetText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
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
            <Text
              style={[
                s.peoplePreviewTitle,
                { color: colors.foreground, fontFamily: DISPLAY_SEMI },
              ]}
            >
              People in the Pack
            </Text>
            {householdAccess.people.length === 0 ? (
              <Text
                style={[
                  s.emptyCopy,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
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
                      index <
                        Math.min(householdAccess.people.length, 4) - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <PersonPortrait name={person.name} size={40} />
                    <View style={s.personCopy}>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.personName,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {person.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.personMeta,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        {person.role}
                      </Text>
                    </View>
                    <View
                      style={[
                        s.presenceDot,
                        {
                          backgroundColor:
                            consumerSurfacePolicy.householdProviderActions &&
                            person.needsInvite
                              ? colors.amber
                              : colors.sage,
                        },
                      ]}
                    />
                  </Pressable>
                );
              })
            )}

            {/* Own heading: without it these care-hub links visually caption
                under "People in the Pack", which reads as a labeling error. */}
            <Text
              style={[
                s.peoplePreviewTitle,
                {
                  color: colors.foreground,
                  fontFamily: DISPLAY_SEMI,
                  marginTop: 16,
                },
              ]}
            >
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
              <Text
                style={[
                  s.emptyCopy,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                Complete setup to add the first caregiver to this device.
              </Text>
            ) : (
              /* Full roster - every person, their sync state, their real log
                 count, and the routines actually assigned to them. */
              householdAccess.people.map((person, index) => {
                const logCount = state.entries.filter(
                  (entry) =>
                    entry.caregiver.trim().toLowerCase() ===
                    person.name.toLowerCase(),
                ).length;
                const isYou =
                  Boolean(myName) &&
                  person.name.toLowerCase() === myName.toLowerCase();
                const routineLine =
                  person.routineCount > 0
                    ? `${person.routineCount === 1 ? "Routine" : "Routines"}: ${person.routineLabels
                        .slice(0, 2)
                        .join(
                          ", ",
                        )}${person.routineLabels.length > 2 ? ` +${person.routineLabels.length - 2}` : ""}`
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
                          style={[
                            s.personName,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          {person.name}
                        </Text>
                        {isYou ? (
                          <View
                            style={[
                              s.youBadge,
                              { backgroundColor: colors.primary + "1A" },
                            ]}
                          >
                            <Text
                              style={[
                                s.youBadgeText,
                                {
                                  color: colors.primary,
                                  fontFamily: "Inter_700Bold",
                                },
                              ]}
                            >
                              You
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[
                          s.personMeta,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        {person.role} -{" "}
                        {consumerSurfacePolicy.householdProviderActions
                          ? person.needsInvite
                            ? "Invite needed"
                            : "Ready"
                          : "On this device"}
                      </Text>
                      {routineLine ? (
                        <Text
                          numberOfLines={1}
                          style={[
                            s.personMeta,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
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
                            color:
                              consumerSurfacePolicy.householdProviderActions &&
                              person.needsInvite
                                ? colors.amber
                                : colors.mutedForeground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {consumerSurfacePolicy.householdProviderActions &&
                        person.needsInvite
                          ? "Invite"
                          : `${logCount} log${logCount === 1 ? "" : "s"}`}
                      </Text>
                      <View
                        accessibilityLabel={
                          consumerSurfacePolicy.householdProviderActions &&
                          person.needsInvite
                            ? `${person.name} needs an invite`
                            : `${person.name} is saved on this device`
                        }
                        style={[
                          s.presenceDot,
                          {
                            backgroundColor:
                              consumerSurfacePolicy.householdProviderActions &&
                              person.needsInvite
                                ? colors.amber
                                : colors.sage,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            )}

            <BoardActionButton
              label={
                consumerSurfacePolicy.householdProviderActions
                  ? "Manage household"
                  : "Edit care team"
              }
              icon="key-outline"
              variant="soft"
              onPress={() =>
                consumerSurfacePolicy.householdProviderActions
                  ? openMoreSection("household")
                  : open("/setup")
              }
              accessibilityLabel={
                consumerSurfacePolicy.householdProviderActions
                  ? "Open the Care Team section in More to manage the household"
                  : "Open setup to edit the care team saved on this device"
              }
              style={s.segmentAction}
            />
          </BoardCard>
        ) : null}

        {/* Access */}
        {segment === "access" &&
        consumerSurfacePolicy.householdProviderActions ? (
          <BoardCard
            style={[s.sectionCard, { borderColor: accessTone + "44" }]}
          >
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
                    householdAccess.status === "ready"
                      ? "done"
                      : accessNotSetUp
                        ? "neutral"
                        : "due"
                  }
                />
              }
            />

            <Text
              style={[
                s.accessTitle,
                { color: colors.foreground, fontFamily: DISPLAY_SEMI },
              ]}
            >
              {householdAccess.householdName}
            </Text>
            <Text
              style={[
                s.accessSummary,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {householdAccess.summary}
            </Text>

            <View style={s.accessMetrics}>
              {[
                { label: "Ready", value: householdAccess.syncedMembers },
                {
                  label: "Invites",
                  value: householdAccess.localOnlyCaregivers,
                },
                {
                  label: "Routine-only",
                  value: householdAccess.routineOnlyOwners,
                },
              ].map((metric) => (
                <View
                  key={metric.label}
                  style={[
                    s.accessMetric,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.accessMetricValue,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {metric.value}
                  </Text>
                  <Text
                    style={[
                      s.accessMetricLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {metric.label}
                  </Text>
                </View>
              ))}
            </View>

            <Text
              style={[
                s.accessNext,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {householdAccess.nextStep}
            </Text>

            {householdAccess.inviteCode ? (
              <View
                accessibilityLabel={`Household invite code ${householdAccess.inviteCode}. Share it from the household console in More.`}
                style={[
                  s.inviteCodeRow,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="key-outline"
                  size={15}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    s.inviteCodeLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  INVITE CODE
                </Text>
                <Text
                  style={[
                    s.inviteCodeValue,
                    { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  {householdAccess.inviteCode}
                </Text>
              </View>
            ) : null}

            {/* Temporary helper passes: the same real counts the More console
                derives, surfaced here so Access reads as a full picture. */}
            <Text
              style={[
                s.accessSubheading,
                { color: colors.foreground, fontFamily: DISPLAY_SEMI },
              ]}
            >
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
                  style={[
                    s.accessMetric,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.accessMetricValue,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {metric.value}
                  </Text>
                  <Text
                    style={[
                      s.accessMetricLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
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
                      style={[
                        s.personName,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {pass.holderName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        s.personMeta,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {pass.role} - {pass.timeLabel}
                    </Text>
                  </View>
                  <BoardStatusPill
                    label={pass.status}
                    tone={
                      pass.status === "active"
                        ? "done"
                        : pass.status === "upcoming"
                          ? "upcoming"
                          : "neutral"
                    }
                  />
                </View>
              ))
            ) : (
              <Text
                style={[
                  s.accessPassEmpty,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
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
                  label={
                    savedReports.length
                      ? `${savedReports.length} saved`
                      : "No saved"
                  }
                  icon="card-outline"
                  tone={colors.primary}
                />
              }
            />

            <Text
              style={[
                s.carePassSummary,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
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
                  style={[
                    s.passSectionChip,
                    {
                      backgroundColor: colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      s.passSectionChipText,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {section.title}
                  </Text>
                </View>
              ))}
              {carePass.sections.length > 5 ? (
                <View
                  style={[
                    s.passSectionChip,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.passSectionChipText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
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
                detail={
                  latestReport
                    ? `Latest: ${latestReport.title}`
                    : "Share a Care Pass to start history"
                }
                tone={colors.sage}
              />
            </View>

            {latestReport ? (
              /* Freshness of the last built pass - title, age, and its saved
                 summary, straight from the report artifact. */
              <View
                style={[
                  s.lastPassCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={s.lastPassHead}>
                  <Text
                    style={[
                      s.lastPassKicker,
                      { color: colors.sage, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Last built
                  </Text>
                  <Text
                    style={[
                      s.lastPassFreshness,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {relativeTime(latestReport.createdAt, now)}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    s.lastPassTitle,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {latestReport.title}
                </Text>
                {latestReport.summary ? (
                  <Text
                    numberOfLines={2}
                    style={[
                      s.lastPassSummary,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
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

        <View
          style={[
            s.boundaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              s.boundaryLabel,
              { color: colors.sage, fontFamily: "Inter_700Bold" },
            ]}
          >
            Care boundary
          </Text>
          <Text
            style={[
              s.boundary,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {state.profile.vetBoundary}
          </Text>
        </View>
      </KeyboardAwareScrollViewCompat>
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
  packStorageWarningCard: {
    marginBottom: 10,
  },
  packStorageWarningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  packStorageWarningText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  packStorageRetryButton: {
    alignSelf: "flex-start",
    marginTop: 10,
  },
  packStorageRecoveryButton: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  packRecoveryCopyCard: {
    gap: 10,
  },
  packRecoveryCopyInput: {
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    lineHeight: 17,
  },
  packRecoveryCopyBoundary: {
    fontSize: 11,
    lineHeight: 16,
  },
  packStorageLoadingText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
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
  inviteCodeRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  inviteCodeLabel: {
    flex: 1,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  inviteCodeValue: {
    fontSize: 15,
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
  boundaryLabel: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  boundary: { fontSize: 12, lineHeight: 18, marginTop: 5 },
});

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMeQueryKey,
  useGetMe,
  useJoinHousehold,
  useUpdateHousehold,
  useUpdateMe,
} from "@workspace/api-client-react";
import {
  buildAccessPassDraft,
  deriveAccessPassPlan,
  deriveHouseholdAccessPlan,
  deriveHouseholdResponsibility,
  deriveMyCareToday,
  type AccessPassKind,
} from "@workspace/care-domain";

import {
  BoardCard,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
} from "@/components/board/BoardPrimitives";
import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { PressScale } from "@/components/motion/GameFeel";
import { useCare } from "@/context/CareContext";
import { useDevicePreferences } from "@/context/DevicePreferencesContext";
import { useColors } from "@/hooks/useColors";
import { isClerkEnabledForBuild, useWoofAuth } from "@/lib/auth";
import { getConsumerSurfacePolicy } from "@/lib/consumerSurfacePolicy";
import { confirmThroughSteps, notifyDialog } from "@/lib/confirmDialog";
import {
  buildCareTwinRosterDraft,
  deriveCareTwinRoster,
} from "@/lib/careTwinRoster";
import {
  CARE_READ_ONLY_MESSAGE,
  runAcceptedCareMutation,
} from "@/lib/careWriteProtection";
import {
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
  MOBILE_INLINE_HIT_SLOP,
} from "@/lib/mobileLayout";
import {
  addItem,
  cycleStatus,
  isDefaultUntouched,
  PACK_SUPPLIES_KEY,
  parseSupplies,
  removeItem,
  renameItem,
  serializeSupplies,
  type SupplyGroup,
  type SupplyItem,
  type SupplyStatus,
} from "@/lib/packSupplies";
import {
  activateTravelBag,
  completeTravelBag,
  defaultTravelBag,
  parseTravelBag,
  redoTravelBag,
  renameTravelBag,
  reopenTravelBag,
  resetTravelItems,
  serializeTravelBag,
  TRAVEL_BAG_KEY,
  type TravelBagSession,
} from "@/lib/travelBag";
import { resolvePetName } from "@/lib/petIdentity";
import type { CareTeamSection } from "@/lib/moreSectionRouting";
import { shareTextPayload } from "@/lib/shareText";
import { relativeTime } from "@/lib/time";
import { LocalDataResetInProgressError } from "@/lib/removableLocalDataStorage";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type HouseholdMemberSummary = {
  displayName?: string | null;
  email?: string | null;
  role?: string | null;
};

const CARE_TEAM_SECTIONS: readonly { key: CareTeamSection; label: string }[] = [
  { key: "care-team", label: "Care Team" },
  { key: "care-team-supplies", label: "Supplies & Travel" },
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

function CareSectionTabs({
  section,
  onChange,
}: {
  section: CareTeamSection;
  onChange: (next: CareTeamSection) => void;
}) {
  const colors = useColors();
  return (
    <View accessibilityRole="tablist" style={s.sectionTabs}>
      {CARE_TEAM_SECTIONS.map((item) => {
        const selected = item.key === section;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync();
              onChange(item.key);
            }}
            style={({ pressed }) => [
              s.sectionTab,
              {
                backgroundColor: selected ? colors.primary : colors.card,
                borderColor: selected ? colors.primary : colors.border,
                opacity: pressed ? 0.76 : 1,
              },
            ]}
          >
            <Text
              style={[
                s.sectionTabText,
                {
                  color: selected
                    ? colors.primaryForeground
                    : colors.foreground,
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
  );
}

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

function CareActionButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "soft" | "outline";
  icon?: IoniconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: React.ComponentProps<typeof PressScale>["containerStyle"];
}) {
  const colors = useColors();
  const background =
    variant === "primary"
      ? colors.primary
      : variant === "soft"
        ? colors.secondary
        : "transparent";
  const foreground =
    variant === "primary" ? colors.primaryForeground : colors.foreground;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.96}
      containerStyle={[s.touchAction, style]}
      style={[
        s.careActionButton,
        {
          backgroundColor: background,
          borderColor: variant === "outline" ? colors.border : background,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={foreground} /> : null}
      <Text
        style={[
          s.careActionButtonText,
          { color: foreground, fontFamily: "Inter_700Bold" },
        ]}
      >
        {label}
      </Text>
    </PressScale>
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
    <View
      style={[
        s.supplyRowShell,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${item.name}: ${item.status}${updatedLabel ? `. ${updatedLabel}` : ""}`}
        accessibilityHint="Tap to cycle the status. Use Edit to rename or remove."
        onPress={() => onCycle(item)}
        onLongPress={() => onEdit(item)}
        delayLongPress={350}
        scaleTo={0.97}
        containerStyle={s.supplyCycleControl}
        style={s.supplyRow}
      >
        <View style={[s.linkChip, { backgroundColor: colors.secondary }]}>
          <PixelIcon name={supplyIcon(item)} size={20} />
        </View>
        <View style={s.linkCopy}>
          <Text
            style={[
              s.supplyName,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {item.name}
          </Text>
          {updatedLabel ? (
            <Text
              style={[
                s.supplyUpdated,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {updatedLabel}
            </Text>
          ) : null}
        </View>
        <SupplyStatusPill status={item.status} />
      </PressScale>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.name}`}
        onPress={() => onEdit(item)}
        style={({ pressed }) => [
          s.supplyEditButton,
          { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name="create-outline" size={18} color={colors.primary} />
        <Text
          style={[
            s.supplyEditButtonText,
            { color: colors.primary, fontFamily: "Inter_700Bold" },
          ]}
        >
          Edit
        </Text>
      </Pressable>
    </View>
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
        <CareActionButton
          label="Save"
          variant="primary"
          onPress={onSave}
          accessibilityLabel={`Save the new name for ${item.name}`}
          style={s.touchAction}
        />
        <CareActionButton
          label="Cancel"
          variant="soft"
          onPress={onCancel}
          accessibilityLabel="Cancel editing this item"
          style={s.touchAction}
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

export interface CareTeamSuppliesScreenProps {
  section: CareTeamSection;
  itemId?: string;
  onBack: () => void;
}

export function CareTeamSuppliesScreen({
  section,
  onBack,
}: CareTeamSuppliesScreenProps): React.JSX.Element {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, careMutationsBlocked, refresh, updateCareDoc } = useCare();
  const { store } = useDevicePreferences();
  const { isSignedIn } = useWoofAuth();
  const consumerSurfacePolicy = getConsumerSurfacePolicy();
  const queryClient = useQueryClient();
  const me = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled:
        consumerSurfacePolicy.householdProviderActions &&
        isClerkEnabledForBuild &&
        Boolean(isSignedIn),
    },
  });
  const updateHousehold = useUpdateHousehold();
  const joinHousehold = useJoinHousehold();
  const updateMe = useUpdateMe();
  const now = Date.now();
  const showCareReadOnly = () =>
    notifyDialog("Update WoofWatcher", CARE_READ_ONLY_MESSAGE);

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
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [nameOpen, setNameOpen] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [petRosterOpen, setPetRosterOpen] = useState(false);
  const [petRosterName, setPetRosterName] = useState("");
  const [petRosterBreed, setPetRosterBreed] = useState("");
  const [accessPassOpen, setAccessPassOpen] = useState(false);
  const [accessPassName, setAccessPassName] = useState("");
  const [accessPassKind, setAccessPassKind] =
    useState<AccessPassKind>("sitter");

  useEffect(() => {
    let cancelled = false;
    void store
      .hydrate(PACK_SUPPLIES_KEY, {
        isCancelled: () => cancelled,
        apply: (raw) => setSupplies(parseSupplies(raw)),
      })
      .catch((error) => {
        if (cancelled || error instanceof LocalDataResetInProgressError) return;
        setSupplies(parseSupplies(null));
      });
    void store
      .hydrate(TRAVEL_BAG_KEY, {
        isCancelled: () => cancelled,
        apply: (raw) => setTravelBag(parseTravelBag(raw)),
      })
      .catch((error) => {
        if (cancelled || error instanceof LocalDataResetInProgressError) return;
        setTravelBag(defaultTravelBag());
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const household = me.data?.household;
  const members: HouseholdMemberSummary[] = me.data?.members ?? [];
  const myName = me.data?.user?.displayName?.trim() || "";

  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const modalSheetBottomPadding = getModalSheetBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  const petName = resolvePetName(state.profile.name);
  const currentHuman = myName || state.caregivers[0]?.name || "Apollo";
  const careTwinRoster = useMemo(() => deriveCareTwinRoster(state), [state]);
  const responsibilityCaregivers = useMemo(() => {
    const byName = new Map<string, { name: string; role: string }>();
    const add = (name: string, role: string) => {
      const cleaned = name.trim();
      if (!cleaned) return;
      const key = cleaned.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, { name: cleaned, role: role.trim() || "Caregiver" });
      }
    };
    state.caregivers.forEach((caregiver) =>
      add(caregiver.name, caregiver.role),
    );
    members.forEach((member) => {
      const name =
        member.displayName?.trim() || member.email?.split("@")[0] || "";
      add(name, member.role === "owner" ? "Owner" : "Caregiver");
    });
    return [...byName.values()];
  }, [members, state.caregivers]);
  const householdResponsibility = useMemo(
    () =>
      deriveHouseholdResponsibility({
        routines: state.routines,
        entries: state.entries,
        caregivers: responsibilityCaregivers,
        now,
      }),
    [now, responsibilityCaregivers, state.entries, state.routines],
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
  const myCareToday = useMemo(
    () =>
      deriveMyCareToday({
        personName: currentHuman,
        petName,
        routines: state.routines,
        entries: state.entries,
        now,
      }),
    [currentHuman, now, petName, state.entries, state.routines],
  );
  const accessTone =
    householdAccess.status === "needs-household" ||
    householdAccess.status === "needs-invites"
      ? colors.amber
      : householdAccess.status === "needs-roles"
        ? colors.copper
        : colors.sage;
  const responsibilityTone =
    householdResponsibility.status === "needs-care"
      ? colors.rose
      : householdResponsibility.status === "needs-assignment"
        ? colors.amber
        : householdResponsibility.status === "needs-setup"
          ? colors.primary
          : colors.sage;
  const careTeamName = consumerSurfacePolicy.householdProviderActions
    ? householdAccess.householdName
    : `${petName}'s Care Team`;
  const careTeamSummary = consumerSurfacePolicy.householdProviderActions
    ? householdAccess.summary
    : "Caregivers, assigned routines, and care logs organized on this device.";
  const refreshMe = () =>
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  const changeSection = (next: CareTeamSection) => {
    router.replace({ pathname: "/more", params: { section: next } });
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

  /** Save on every change, fire-and-forget like the Home welcome flag. */
  const commitSupplies = (next: SupplyItem[]) => {
    setSupplies(next);
    void store
      .save(PACK_SUPPLIES_KEY, serializeSupplies(next))
      .catch((error) => {
        if (error instanceof LocalDataResetInProgressError) return;
      });
  };

  const commitTravelBag = (next: TravelBagSession) => {
    setTravelBag(next);
    void store
      .save(TRAVEL_BAG_KEY, serializeTravelBag(next))
      .catch((error) => {
        if (error instanceof LocalDataResetInProgressError) return;
      });
  };

  const activateBag = () => {
    const next = activateTravelBag(
      travelBag,
      packedCount,
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
    commitTravelBag(completeTravelBag(travelBag, new Date().toISOString()));
  };

  const reopenBag = () => {
    Haptics.selectionAsync().catch(() => {});
    commitTravelBag(reopenTravelBag(travelBag));
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
        if (supplies) commitSupplies(resetTravelItems(supplies));
        commitTravelBag(redoTravelBag(travelBag));
      },
    );
  };

  const openBagLabelEditor = () => {
    Haptics.selectionAsync().catch(() => {});
    setBagLabelDraft(travelBag.label);
    setEditingBagLabel(true);
  };

  const saveBagLabel = () => {
    commitTravelBag(renameTravelBag(travelBag, bagLabelDraft));
    setEditingBagLabel(false);
    setBagLabelDraft("");
  };

  const cycleSupply = (item: SupplyItem) => {
    if (!supplies) return;
    const stampedAt = new Date().toISOString();
    commitSupplies(
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

  const saveSupplyRename = () => {
    if (!supplies || !editingSupplyId) return;
    const trimmed = editSupplyName.trim();
    if (!trimmed) {
      notifyDialog(
        "Name needed",
        "Give this item a short name, or cancel the edit.",
      );
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
        // Functional update: the themed dialog resolves later, so never
        // trust the list captured at press time.
        setSupplies((current) => {
          if (!current) return current;
          const next = removeItem(current, item.id);
          void store
            .save(PACK_SUPPLIES_KEY, serializeSupplies(next))
            .catch((error) => {
              if (error instanceof LocalDataResetInProgressError) return;
            });
          return next;
        });
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
    if (!supplies) return;
    const trimmed = addSupplyName.trim();
    if (!trimmed) {
      notifyDialog(
        "Name needed",
        "Give the new item a short name, like Water bottle or Towel.",
      );
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
    commitSupplies(next);
    setAddSupplyName("");
    setAddSupplyOpen(false);
  };

  const shareInvite = () => {
    if (!household) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void shareTextPayload({
      message: `Join our ${household.name} on WoofWatcher to help care for ${petName}. Invite code: ${household.inviteCode}`,
      title: "WoofWatcher invite",
    });
  };

  const openFuturePetSheet = () => {
    setPetRosterName("");
    setPetRosterBreed("");
    setPetRosterOpen(true);
  };

  const saveFuturePet = () => {
    if (careMutationsBlocked) {
      showCareReadOnly();
      return;
    }
    const draft = buildCareTwinRosterDraft({
      name: petRosterName,
      breed: petRosterBreed,
    });
    const updated = updateCareDoc((doc) => ({
      ...doc,
      activePetId: "primary",
      pets: [...(doc.pets ?? []), draft],
    }));
    const accepted = runAcceptedCareMutation(updated, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPetRosterOpen(false);
    });
    if (!accepted) showCareReadOnly();
  };

  const openAccessPassSheet = () => {
    setAccessPassName("");
    setAccessPassKind("sitter");
    setAccessPassOpen(true);
  };

  const saveAccessPassDraft = () => {
    if (careMutationsBlocked) {
      showCareReadOnly();
      return;
    }
    const draft = buildAccessPassDraft({
      holderName: accessPassName,
      kind: accessPassKind,
      petName,
    });
    const updated = updateCareDoc((doc) => ({
      ...doc,
      accessPasses: [...(doc.accessPasses ?? []), draft],
    }));
    const accepted = runAcceptedCareMutation(updated, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setAccessPassOpen(false);
    });
    if (!accepted) showCareReadOnly();
  };

  const shareAccessPassSummary = () => {
    const pass = accessPassPlan.passes[0];
    if (!pass) {
      notifyDialog(
        "Access Pass",
        "Create a local Access Pass draft before sharing helper instructions.",
      );
      return;
    }
    const message = [
      `WoofWatcher Access Pass draft for ${pass.petName}`,
      "",
      `Helper: ${pass.holderName}`,
      `Role: ${pass.role}`,
      `Status: ${pass.status}`,
      `Time: ${pass.timeLabel}`,
      "",
      "Allowed:",
      ...pass.permissions.map((permission) => `- ${permission}`),
      "",
      "Not allowed:",
      ...pass.blockedPermissions.map((permission) => `- ${permission}`),
      "",
      accessPassPlan.permissionBoundary,
      "Provider-backed sharing is not live yet; review this before granting real access.",
    ].join("\n");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void shareTextPayload({
      message,
      title: `WoofWatcher Access Pass - ${pass.holderName}`,
    });
  };

  const submitJoin = () => {
    const code = joinCode.trim();
    if (!code) return;
    joinHousehold.mutate(
      { data: { inviteCode: code } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setJoinOpen(false);
          setJoinCode("");
          refreshMe();
          refresh();
        },
        onError: () =>
          notifyDialog(
            "Couldn't join",
            "That invite code didn't match a household.",
          ),
      },
    );
  };

  const submitRename = () => {
    const name = renameValue.trim();
    if (!name) return;
    updateHousehold.mutate(
      { data: { name } },
      {
        onSuccess: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setRenameOpen(false);
          refreshMe();
        },
        onError: () => notifyDialog("Couldn't rename", "Please try again."),
      },
    );
  };

  const submitName = () => {
    const name = nameValue.trim();
    if (!name) return;
    updateMe.mutate(
      { data: { displayName: name } },
      {
        onSuccess: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setNameOpen(false);
          refreshMe();
        },
        onError: () =>
          notifyDialog("Couldn't update name", "Please try again."),
      },
    );
  };

  const memberColor = (index: number) => {
    const palette = [
      colors.primary,
      colors.copper,
      colors.sage,
      colors.amber,
      colors.rose,
    ];
    return palette[index % palette.length];
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to More"
          onPress={onBack}
          style={({ pressed }) => [
            s.backButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          <Text
            style={[
              s.backButtonText,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Back to More
          </Text>
        </Pressable>
        <BoardRouteHeader
          kicker="People & home"
          title="Care Team & Supplies"
          subtitle={`Keep ${petName}'s people, responsibilities, essentials, and travel gear clear.`}
          icon="people-outline"
          plain
          style={s.routeHeaderCompact}
        />
        <CareSectionTabs section={section} onChange={changeSection} />

        {/* Supplies - the mockup Pack page's Essentials / Travel Bag boards.
            Every status is the owner's own answer; untouched defaults say so
            instead of pretending someone already checked the shelf. */}
        {section === "care-team-supplies" && supplies ? (
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
                  to update it, or use its visible Edit button to rename or
                  remove it.
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
                  <CareActionButton
                    label="Save"
                    icon="checkmark"
                    variant="primary"
                    onPress={saveBagLabel}
                    accessibilityLabel="Save the travel bag name"
                    style={s.touchAction}
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
                    <CareActionButton
                      label="Activate travel bag"
                      icon="bag-check-outline"
                      variant="primary"
                      onPress={activateBag}
                      disabled={packedCount === 0}
                      accessibilityLabel="Activate the travel bag for this trip"
                      style={s.touchAction}
                    />
                  ) : travelBag.phase === "active" ? (
                    <>
                      <CareActionButton
                        label="Trip complete"
                        icon="checkmark-done-outline"
                        variant="primary"
                        onPress={completeBag}
                        accessibilityLabel="Mark this trip complete"
                        style={s.touchAction}
                      />
                      <CareActionButton
                        label="Back to packing"
                        variant="soft"
                        onPress={reopenBag}
                        accessibilityLabel="Reopen the travel bag back to packing"
                        style={s.touchAction}
                      />
                    </>
                  ) : (
                    <CareActionButton
                      label="Redo travel bag"
                      icon="refresh-outline"
                      variant="primary"
                      onPress={redoBag}
                      accessibilityLabel="Redo the travel bag and unpack every item for the next trip"
                      style={s.touchAction}
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
                  <CareActionButton
                    label="Add to list"
                    icon="add"
                    variant="primary"
                    onPress={saveSupplyAdd}
                    accessibilityLabel={`Add the new item to ${SUPPLY_GROUP_TITLES[addSupplyGroup]}`}
                    style={s.touchAction}
                  />
                  <CareActionButton
                    label="Cancel"
                    variant="soft"
                    onPress={cancelAddSupply}
                    accessibilityLabel="Cancel adding an item"
                    style={s.touchAction}
                  />
                </View>
              </BoardCard>
            ) : (
              <CareActionButton
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

        {section === "care-team" ? (
          <>
            <BoardCard style={s.sectionCard}>
              <BoardSectionHeader
                title="CareTwin Roster"
                accessory={
                  consumerSurfacePolicy.futureDogPlanning ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Add future dog to CareTwin roster"
                      onPress={() => {
                        Haptics.selectionAsync();
                        openFuturePetSheet();
                      }}
                      style={({ pressed }) => [
                        s.inlineAction,
                        { opacity: pressed ? 0.68 : 1 },
                      ]}
                    >
                      <Text
                        style={[
                          s.inlineActionText,
                          { color: colors.copper, fontFamily: "Inter_700Bold" },
                        ]}
                      >
                        Add future dog
                      </Text>
                    </Pressable>
                  ) : (
                    <BoardPill label="One dog" tone={colors.sage} />
                  )
                }
              />
              <Text
                style={[
                  s.bodyText,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {careTwinRoster.summary}
              </Text>
              <Text
                style={[
                  s.secondaryText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                {careTwinRoster.nextStep}
              </Text>
              <View style={s.metricGrid}>
                {[
                  ["Live", careTwinRoster.liveCount],
                  ["Future", careTwinRoster.futureCount],
                  ["Locked", careTwinRoster.providerGatedCount],
                ].map(([label, value]) => (
                  <View
                    key={String(label)}
                    style={[s.metric, { backgroundColor: colors.background }]}
                  >
                    <Text
                      style={[
                        s.metricValue,
                        { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                      ]}
                    >
                      {value}
                    </Text>
                    <Text
                      style={[
                        s.metricLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={s.rosterList}>
                {careTwinRoster.pets.map((pet) => {
                  const content = (
                    <>
                      <View
                        style={[
                          s.personAvatar,
                          {
                            backgroundColor: pet.isActive
                              ? colors.primary + "18"
                              : colors.amber + "18",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.personInitial,
                            {
                              color: pet.isActive
                                ? colors.primary
                                : colors.amber,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {pet.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={s.flexCopy}>
                        <Text
                          style={[
                            s.rowTitle,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {pet.name}
                        </Text>
                        <Text
                          style={[
                            s.secondaryText,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {pet.statusLabel} · {pet.breed} · {pet.weightLabel}
                        </Text>
                        <Text
                          style={[
                            s.secondaryText,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {pet.detail}
                        </Text>
                      </View>
                    </>
                  );
                  if (pet.canSwitch) {
                    return (
                      <View
                        key={pet.id}
                        accessibilityLabel={`${pet.name}. ${pet.statusLabel}. ${pet.detail}`}
                        style={s.rosterRow}
                      >
                        {content}
                      </View>
                    );
                  }
                  return (
                    <Pressable
                      key={pet.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${pet.name}. ${pet.statusLabel}. ${pet.detail}`}
                      onPress={() => {
                        Haptics.selectionAsync();
                        notifyDialog(
                          "Multi-dog switching is coming soon",
                          "This dog is saved as a planned slot. Separate logs, routines, records, and reports aren't ready yet - for now everything stays with your current dog on this device.",
                        );
                      }}
                      style={({ pressed }) => [
                        s.rosterRow,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      {content}
                    </Pressable>
                  );
                })}
              </View>
              {!consumerSurfacePolicy.futureDogPlanning ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Multi-dog care availability"
                  onPress={() =>
                    notifyDialog(
                      "One dog supported today",
                      `Separate care for another dog is not ready yet. For now, every log, routine, record, and report stays with ${petName}.`,
                    )
                  }
                  style={({ pressed }) => [
                    s.infoAction,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <View style={s.flexCopy}>
                    <Text
                      style={[
                        s.rowTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Multi-dog care
                    </Text>
                    <Text
                      style={[
                        s.secondaryText,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      One dog is supported today. See what is planned.
                    </Text>
                  </View>
                </Pressable>
              ) : null}
            </BoardCard>

            <BoardCard style={s.sectionCard}>
              <BoardSectionHeader
                title="Care Team"
                accessory={
                  consumerSurfacePolicy.householdProviderActions ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Rename care team"
                      disabled={!household}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setRenameValue(household?.name ?? "");
                        setRenameOpen(true);
                      }}
                      style={({ pressed }) => [
                        s.inlineAction,
                        { opacity: pressed || !household ? 0.55 : 1 },
                      ]}
                    >
                      <Text
                        style={[
                          s.inlineActionText,
                          { color: colors.copper, fontFamily: "Inter_700Bold" },
                        ]}
                      >
                        Rename
                      </Text>
                    </Pressable>
                  ) : (
                    <BoardPill label="On this device" tone={colors.sage} />
                  )
                }
              />
              <Text
                style={[
                  s.cardTitle,
                  { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                ]}
              >
                {careTeamName}
              </Text>
              <Text
                style={[
                  s.secondaryText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                {careTeamSummary}
              </Text>
              {consumerSurfacePolicy.householdProviderActions ? (
                <View
                  style={[
                    s.inviteBox,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={s.flexCopy}>
                    <Text
                      style={[
                        s.fieldLabel,
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
                        s.inviteCode,
                        { color: colors.foreground, fontFamily: DISPLAY },
                      ]}
                    >
                      {householdAccess.inviteCode || "—"}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Share household invite"
                    disabled={!householdAccess.canShareInvite}
                    onPress={shareInvite}
                    style={({ pressed }) => [
                      s.primaryInlineButton,
                      {
                        backgroundColor: colors.primary,
                        opacity:
                          pressed || !householdAccess.canShareInvite ? 0.55 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="share-outline"
                      size={18}
                      color={colors.primaryForeground}
                    />
                    <Text
                      style={[
                        s.primaryInlineText,
                        {
                          color: colors.primaryForeground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Invite
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={s.peopleList}>
                {householdAccess.people.length === 0 ? (
                  <Text
                    style={[
                      s.secondaryText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Complete setup to add the first caregiver to this device.
                  </Text>
                ) : (
                  householdAccess.people.map((person, index) => {
                    const tone = memberColor(index);
                    const logCount = state.entries.filter(
                      (entry) =>
                        entry.caregiver.trim().toLowerCase() ===
                        person.name.toLowerCase(),
                    ).length;
                    return (
                      <View key={person.id} style={s.personRow}>
                        <View
                          style={[
                            s.personAvatar,
                            { backgroundColor: tone + "18" },
                          ]}
                        >
                          <Text
                            style={[
                              s.personInitial,
                              { color: tone, fontFamily: "Inter_700Bold" },
                            ]}
                          >
                            {person.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={s.flexCopy}>
                          <Text
                            style={[
                              s.rowTitle,
                              {
                                color: colors.foreground,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                          >
                            {person.name}
                            {myName &&
                            person.name.toLowerCase() === myName.toLowerCase()
                              ? " · You"
                              : ""}
                          </Text>
                          <Text
                            style={[
                              s.secondaryText,
                              {
                                color: colors.mutedForeground,
                                fontFamily: "Inter_500Medium",
                              },
                            ]}
                          >
                            {person.role} ·{" "}
                            {consumerSurfacePolicy.householdProviderActions
                              ? person.needsInvite
                                ? "Invite needed"
                                : "Ready"
                              : "On this device"}{" "}
                            · {logCount} logs
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </BoardCard>

            {consumerSurfacePolicy.householdProviderActions ? (
              <>
                <BoardCard
                  style={[s.sectionCard, { borderColor: accessTone + "44" }]}
                >
                  <BoardSectionHeader
                    title="Household Access"
                    accessory={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Share household invite"
                        disabled={!householdAccess.canShareInvite}
                        onPress={shareInvite}
                        style={({ pressed }) => [
                          s.inlineAction,
                          {
                            opacity:
                              pressed || !householdAccess.canShareInvite
                                ? 0.55
                                : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.inlineActionText,
                            { color: accessTone, fontFamily: "Inter_700Bold" },
                          ]}
                        >
                          Invite
                        </Text>
                      </Pressable>
                    }
                  />
                  <Text
                    style={[
                      s.cardTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {householdAccess.status === "ready"
                      ? "Access is aligned"
                      : "Access needs review"}
                  </Text>
                  <Text
                    style={[
                      s.secondaryText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {householdAccess.summary}
                  </Text>
                  <View style={s.metricGrid}>
                    {[
                      ["Ready", householdAccess.syncedMembers],
                      ["Invites", householdAccess.localOnlyCaregivers],
                      ["Routine-only", householdAccess.routineOnlyOwners],
                    ].map(([label, value]) => (
                      <View
                        key={String(label)}
                        style={[
                          s.metric,
                          { backgroundColor: colors.background },
                        ]}
                      >
                        <Text
                          style={[
                            s.metricValue,
                            {
                              color: colors.foreground,
                              fontFamily: DISPLAY_SEMI,
                            },
                          ]}
                        >
                          {value}
                        </Text>
                        <Text
                          style={[
                            s.metricLabel,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text
                    style={[
                      s.secondaryText,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {householdAccess.nextStep}
                  </Text>
                  {householdAccess.people.length > 0 ? (
                    <View style={s.peopleList}>
                      {householdAccess.people.slice(0, 4).map((person) => (
                        <View key={`access-${person.id}`} style={s.passRow}>
                          <Text
                            style={[
                              s.rowTitle,
                              s.flexCopy,
                              {
                                color: colors.foreground,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                          >
                            {person.name}
                          </Text>
                          <Text
                            style={[
                              s.secondaryText,
                              s.permissionSummary,
                              {
                                color: colors.mutedForeground,
                                fontFamily: "Inter_500Medium",
                              },
                            ]}
                          >
                            {person.permissions.slice(0, 2).join(", ")}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </BoardCard>

                <BoardCard style={s.sectionCard}>
                  <BoardSectionHeader
                    title="Access Passes"
                    accessory={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Create Access Pass draft"
                        onPress={openAccessPassSheet}
                        style={s.inlineAction}
                      >
                        <Text
                          style={[
                            s.inlineActionText,
                            {
                              color: colors.primary,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          New pass
                        </Text>
                      </Pressable>
                    }
                  />
                  <Text
                    style={[
                      s.cardTitle,
                      { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                    ]}
                  >
                    {accessPassPlan.title}
                  </Text>
                  <Text
                    style={[
                      s.secondaryText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {accessPassPlan.summary}
                  </Text>
                  <View style={s.metricGrid}>
                    {[
                      ["Active", accessPassPlan.activeCount],
                      ["Upcoming", accessPassPlan.upcomingCount],
                      ["Drafts", accessPassPlan.draftCount],
                    ].map(([label, value]) => (
                      <View
                        key={String(label)}
                        style={[
                          s.metric,
                          { backgroundColor: colors.background },
                        ]}
                      >
                        <Text
                          style={[
                            s.metricValue,
                            {
                              color: colors.foreground,
                              fontFamily: DISPLAY_SEMI,
                            },
                          ]}
                        >
                          {value}
                        </Text>
                        <Text
                          style={[
                            s.metricLabel,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text
                    style={[
                      s.secondaryText,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {accessPassPlan.nextStep}
                  </Text>
                  <View
                    style={[
                      s.boundaryInline,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color={colors.sage}
                    />
                    <Text
                      style={[
                        s.secondaryText,
                        s.flexCopy,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {accessPassPlan.permissionBoundary}
                    </Text>
                  </View>
                  {accessPassPlan.passes.slice(0, 3).map((pass) => (
                    <View key={pass.id} style={s.passRow}>
                      <View style={s.flexCopy}>
                        <Text
                          style={[
                            s.rowTitle,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {pass.holderName}
                        </Text>
                        <Text
                          style={[
                            s.secondaryText,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {pass.role} · {pass.timeLabel}
                        </Text>
                      </View>
                      <BoardPill
                        label={pass.status}
                        tone={
                          pass.status === "active"
                            ? colors.sage
                            : colors.mutedForeground
                        }
                      />
                    </View>
                  ))}
                  <CareActionButton
                    label="Share Draft Summary"
                    icon="share-outline"
                    onPress={shareAccessPassSummary}
                    accessibilityLabel="Share Access Pass draft summary"
                    style={s.fullAction}
                  />
                </BoardCard>
              </>
            ) : null}

            <BoardCard
              style={[
                s.sectionCard,
                { borderColor: responsibilityTone + "44" },
              ]}
            >
              <BoardSectionHeader title="My Care Today" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open My Care Today in Plans"
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push("/calendar");
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}
              >
                <Text
                  style={[
                    s.cardTitle,
                    { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  {myCareToday.title}
                </Text>
                <Text
                  style={[
                    s.secondaryText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {myCareToday.summary}
                </Text>
                <View style={s.metricGrid}>
                  {[
                    ["Assigned", myCareToday.assignedCount],
                    ["Open", myCareToday.openCount],
                    ["Overdue", myCareToday.overdueCount],
                  ].map(([label, value]) => (
                    <View
                      key={String(label)}
                      style={[s.metric, { backgroundColor: colors.background }]}
                    >
                      <Text
                        style={[
                          s.metricValue,
                          {
                            color: colors.foreground,
                            fontFamily: DISPLAY_SEMI,
                          },
                        ]}
                      >
                        {value}
                      </Text>
                      <Text
                        style={[
                          s.metricLabel,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text
                  style={[
                    s.secondaryText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {myCareToday.nextStep}
                </Text>
                {myCareToday.items.slice(0, 3).map((item) => (
                  <View key={item.id} style={s.careItemRow}>
                    <Text
                      style={[
                        s.careItemTime,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {item.time}
                    </Text>
                    <Text
                      style={[
                        s.rowTitle,
                        s.flexCopy,
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
                        s.careItemStatus,
                        {
                          color:
                            item.status === "done"
                              ? colors.sage
                              : item.status === "overdue"
                                ? colors.rose
                                : colors.mutedForeground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                ))}
              </Pressable>
            </BoardCard>

            <BoardCard
              style={[
                s.sectionCard,
                { borderColor: responsibilityTone + "44" },
              ]}
            >
              <BoardSectionHeader title="Responsibility Center" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open routine board"
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push("/calendar");
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}
              >
                <Text
                  style={[
                    s.cardTitle,
                    { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  {householdResponsibility.title}
                </Text>
                <Text
                  style={[
                    s.secondaryText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {householdResponsibility.summary}
                </Text>
                <View style={s.metricGrid}>
                  {[
                    ["Open", householdResponsibility.openRoutines],
                    ["Overdue", householdResponsibility.overdueRoutines],
                    ["Unassigned", householdResponsibility.unassignedRoutines],
                  ].map(([label, value]) => (
                    <View
                      key={String(label)}
                      style={[s.metric, { backgroundColor: colors.background }]}
                    >
                      <Text
                        style={[
                          s.metricValue,
                          {
                            color: colors.foreground,
                            fontFamily: DISPLAY_SEMI,
                          },
                        ]}
                      >
                        {value}
                      </Text>
                      <Text
                        style={[
                          s.metricLabel,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text
                  style={[
                    s.secondaryText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {householdResponsibility.nextStep}
                </Text>
                {householdResponsibility.members.slice(0, 3).map((member) => (
                  <View key={member.name} style={s.passRow}>
                    <Text
                      style={[
                        s.rowTitle,
                        s.flexCopy,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {member.name}
                    </Text>
                    <Text
                      style={[
                        s.secondaryText,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {member.done}/{member.assigned} routines ·{" "}
                      {member.todayLogs} logs
                    </Text>
                  </View>
                ))}
              </Pressable>
            </BoardCard>

            {consumerSurfacePolicy.householdProviderActions ? (
              <BoardCard style={s.sectionCard}>
                <BoardSectionHeader title="Provider household actions" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit your display name"
                  onPress={() => {
                    Haptics.selectionAsync();
                    setNameValue(myName);
                    setNameOpen(true);
                  }}
                  style={({ pressed }) => [
                    s.infoAction,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons
                    name="person-circle-outline"
                    size={22}
                    color={colors.copper}
                  />
                  <View style={s.flexCopy}>
                    <Text
                      style={[
                        s.rowTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Your display name
                    </Text>
                    <Text
                      style={[
                        s.secondaryText,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {myName || "Set how you appear on logs"}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Join another household"
                  onPress={() => {
                    Haptics.selectionAsync();
                    setJoinCode("");
                    setJoinOpen(true);
                  }}
                  style={({ pressed }) => [
                    s.infoAction,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons
                    name="enter-outline"
                    size={22}
                    color={colors.sage}
                  />
                  <View style={s.flexCopy}>
                    <Text
                      style={[
                        s.rowTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      Join another household
                    </Text>
                    <Text
                      style={[
                        s.secondaryText,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      Enter an invite code from a family member
                    </Text>
                  </View>
                </Pressable>
              </BoardCard>
            ) : null}

            <BoardCard style={s.sectionCard}>
              <BoardSectionHeader title="Care handoffs" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Care Pass in Health"
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({
                    pathname: "/health",
                    params: { section: "care-pass" },
                  });
                }}
                style={({ pressed }) => [
                  s.infoAction,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color={colors.primary}
                />
                <View style={s.flexCopy}>
                  <Text
                    style={[
                      s.rowTitle,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Care Pass
                  </Text>
                  <Text
                    style={[
                      s.secondaryText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Build and share the complete Health-owned handoff.
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </BoardCard>
          </>
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
      </ScrollView>

      {consumerSurfacePolicy.householdProviderActions ? (
        <>
          <PromptModal
            visible={joinOpen}
            colors={colors}
            icon="enter-outline"
            title="Join a household"
            subtitle="Enter the invite code shared by a family member."
            placeholder="e.g. PHX-7QK2"
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
            confirmLabel="Join"
            loading={joinHousehold.isPending}
            onCancel={() => setJoinOpen(false)}
            onConfirm={submitJoin}
          />
          <PromptModal
            visible={renameOpen}
            colors={colors}
            icon="home-outline"
            title="Rename household"
            subtitle="Give your care team a name everyone recognizes."
            placeholder="The Phoenix Pack"
            value={renameValue}
            onChangeText={setRenameValue}
            confirmLabel="Save"
            loading={updateHousehold.isPending}
            onCancel={() => setRenameOpen(false)}
            onConfirm={submitRename}
          />
          <PromptModal
            visible={nameOpen}
            colors={colors}
            icon="person-circle-outline"
            title="Your display name"
            subtitle="This is how you'll appear on every care log."
            placeholder="Alex"
            value={nameValue}
            onChangeText={setNameValue}
            confirmLabel="Save"
            loading={updateMe.isPending}
            onCancel={() => setNameOpen(false)}
            onConfirm={submitName}
          />
        </>
      ) : null}

      {consumerSurfacePolicy.futureDogPlanning ? (
        <Modal
          visible={petRosterOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setPetRosterOpen(false)}
        >
          <Pressable
            style={[s.modalBackdrop, { justifyContent: "flex-end" }]}
            onPress={() => setPetRosterOpen(false)}
          >
            <Pressable
              style={[s.profileModal, { backgroundColor: colors.card }]}
              onPress={(event) => event.stopPropagation()}
            >
              <View
                style={{
                  paddingBottom: modalSheetBottomPadding,
                  paddingHorizontal: 22,
                }}
              >
                <View
                  style={[s.modalHandle, { backgroundColor: colors.border }]}
                />
                <Text
                  style={[
                    s.sheetTitle,
                    { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  Add future dog
                </Text>
                <Text
                  style={[
                    s.sheetSubtitle,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  This saves a planned slot for a future dog. Multi-dog logs,
                  routines, and records are coming soon - everything stays on
                  this device for now.
                </Text>
                <Text
                  style={[
                    s.profFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  NAME
                </Text>
                <TextInput
                  value={petRosterName}
                  onChangeText={setPetRosterName}
                  placeholder="e.g. London"
                  placeholderTextColor={colors.mutedForeground}
                  accessibilityLabel="Future dog name"
                  style={[
                    s.profField,
                    {
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                />
                <Text
                  style={[
                    s.profFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  BREED
                </Text>
                <TextInput
                  value={petRosterBreed}
                  onChangeText={setPetRosterBreed}
                  placeholder="e.g. Golden Retriever"
                  placeholderTextColor={colors.mutedForeground}
                  accessibilityLabel="Future dog breed"
                  style={[
                    s.profField,
                    {
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                />
                <Pressable
                  onPress={saveFuturePet}
                  accessibilityRole="button"
                  accessibilityLabel="Save future dog to CareTwin roster"
                  style={({ pressed }) => [
                    s.profSaveBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.profSaveBtnText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    Save planned slot
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {consumerSurfacePolicy.householdProviderActions ? (
        <Modal
          visible={accessPassOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setAccessPassOpen(false)}
        >
          <Pressable
            style={[s.modalBackdrop, { justifyContent: "flex-end" }]}
            onPress={() => setAccessPassOpen(false)}
          >
            <Pressable
              style={[s.profileModal, { backgroundColor: colors.card }]}
              onPress={(event) => event.stopPropagation()}
            >
              <View
                style={{
                  paddingBottom: modalSheetBottomPadding,
                  paddingHorizontal: 22,
                }}
              >
                <View
                  style={[s.modalHandle, { backgroundColor: colors.border }]}
                />
                <Text
                  style={[
                    s.sheetTitle,
                    { color: colors.foreground, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  Create Access Pass
                </Text>
                <Text
                  style={[
                    s.sheetSubtitle,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  Save helper permissions as a local draft. Remote sharing is
                  coming soon - passes stay on this device for now.
                </Text>
                <Text
                  style={[
                    s.profFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  HELPER NAME
                </Text>
                <TextInput
                  value={accessPassName}
                  onChangeText={setAccessPassName}
                  placeholder="e.g. Maya"
                  placeholderTextColor={colors.mutedForeground}
                  accessibilityLabel="Access Pass helper name"
                  style={[
                    s.profField,
                    {
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                />
                <Text
                  style={[
                    s.profFieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  ROLE
                </Text>
                <View style={s.passKindGrid}>
                  {(
                    [
                      { key: "sitter", label: "Sitter" },
                      { key: "trainer", label: "Trainer" },
                      { key: "vet", label: "Vet viewer" },
                      { key: "emergency", label: "Emergency" },
                    ] as const
                  ).map((kind) => {
                    const selected = accessPassKind === kind.key;
                    return (
                      <Pressable
                        key={kind.key}
                        onPress={() => setAccessPassKind(kind.key)}
                        accessibilityRole="button"
                        accessibilityLabel={`Set Access Pass role to ${kind.label}`}
                        accessibilityState={{ selected }}
                        style={[
                          s.passKind,
                          {
                            borderColor: selected
                              ? colors.primary
                              : colors.border,
                            backgroundColor: selected
                              ? colors.primary + "18"
                              : colors.background,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.passKindText,
                            {
                              color: selected
                                ? colors.primary
                                : colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {kind.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  onPress={saveAccessPassDraft}
                  accessibilityRole="button"
                  accessibilityLabel="Save Access Pass draft"
                  style={({ pressed }) => [
                    s.profSaveBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.profSaveBtnText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    Save Local Draft
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

function PromptModal({
  visible,
  colors,
  icon,
  title,
  subtitle,
  placeholder,
  value,
  onChangeText,
  confirmLabel,
  loading,
  autoCapitalize = "sentences",
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  colors: ReturnType<typeof useColors>;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  confirmLabel: string;
  loading?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={s.modalBackdrop} onPress={onCancel}>
        <Pressable
          style={[s.modalCard, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          <View
            style={[s.modalIcon, { backgroundColor: colors.primary + "1A" }]}
          >
            <Ionicons name={icon} size={22} color={colors.primary} />
          </View>
          <Text
            style={[
              s.modalTitle,
              { color: colors.foreground, fontFamily: DISPLAY_SEMI },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              s.modalSub,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {subtitle}
          </Text>
          <TextInput
            accessibilityLabel={title}
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
            value={value}
            onChangeText={onChangeText}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            style={[
              s.modalInput,
              {
                backgroundColor: colors.background,
                color: colors.foreground,
                borderColor: colors.border,
                fontFamily: "Inter_500Medium",
              },
            ]}
            returnKeyType="done"
            onSubmitEditing={onConfirm}
          />
          <View style={s.modalActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Cancel ${title}`}
              onPress={onCancel}
              style={({ pressed }) => [
                s.modalCancel,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text
                style={[
                  s.modalCancelText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              onPress={onConfirm}
              disabled={loading}
              style={({ pressed }) => [
                s.modalConfirm,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed || loading ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  s.modalConfirmText,
                  {
                    color: colors.primaryForeground,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                {loading ? "…" : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  backButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  backButtonText: { fontSize: 14, lineHeight: 18 },
  sectionTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 2,
  },
  sectionTab: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  sectionTabText: { fontSize: 14, lineHeight: 18, textAlign: "center" },
  routeHeaderCompact: {
    marginBottom: 10,
  },
  sectionCard: { marginTop: 10 },

  suppliesHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  supplyRowShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  supplyCycleControl: { flex: 1, minWidth: 0 },
  supplyRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  supplyName: {
    fontSize: 16,
  },
  supplyUpdated: {
    fontSize: 14,
    lineHeight: 18,
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
    fontSize: 14,
    letterSpacing: 0.2,
  },
  supplyEditButton: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  supplyEditButtonText: { fontSize: 14 },
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
    fontSize: 16,
  },
  supplyEditActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  travelCaptionRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
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
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  supplyRemoveText: {
    fontSize: 14,
  },
  addGroupRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  addGroupChip: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addGroupChipText: {
    fontSize: 14,
  },
  addSupplyButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    marginTop: 10,
  },
  touchAction: { minHeight: MIN_MOBILE_TOUCH_TARGET },
  careActionButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  careActionButtonText: {
    fontSize: 16,
    lineHeight: 21,
    textAlign: "center",
    flexShrink: 1,
  },

  inlineAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  inlineActionText: { fontSize: 14, lineHeight: 18 },
  bodyText: { fontSize: 16, lineHeight: 22 },
  secondaryText: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  cardTitle: { fontSize: 16, lineHeight: 22 },
  rowTitle: { fontSize: 16, lineHeight: 21 },
  flexCopy: { flex: 1, minWidth: 0 },
  rosterList: { borderTopWidth: 1, marginTop: 12 },
  rosterRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 12,
  },
  infoAction: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  inviteBox: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginTop: 12,
  },
  fieldLabel: { fontSize: 14, lineHeight: 18, letterSpacing: 0.5 },
  inviteCode: { fontSize: 16, lineHeight: 22, marginTop: 2 },
  primaryInlineButton: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
  },
  primaryInlineText: { fontSize: 14 },
  peopleList: { marginTop: 10 },
  metricGrid: { flexDirection: "row", gap: 8, marginTop: 12 },
  metric: {
    flex: 1,
    minHeight: 64,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  metricValue: { fontSize: 16, lineHeight: 21, textAlign: "center" },
  metricLabel: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 2,
  },
  boundaryInline: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 11,
    marginTop: 12,
  },
  fullAction: { marginTop: 12 },
  permissionSummary: { flexShrink: 1, textAlign: "right", marginTop: 0 },
  careItemRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    paddingVertical: 8,
    marginTop: 8,
  },
  careItemTime: { width: 68, fontSize: 14, lineHeight: 18 },
  careItemStatus: {
    width: 72,
    textAlign: "right",
    fontSize: 14,
    lineHeight: 18,
    textTransform: "capitalize",
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

  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
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
  passRow: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },

  passKindGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  passKind: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  passKindText: { fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,31,36,0.45)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  modalCard: {
    borderRadius: 26,
    padding: 24,
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 8,
  },
  modalIcon: {
    width: MIN_MOBILE_TOUCH_TARGET,
    height: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 19, letterSpacing: -0.2 },
  modalSub: { fontSize: 16, marginTop: 4, lineHeight: 22 },
  modalInput: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    marginTop: 16,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  modalCancel: {
    flex: 1,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: { fontSize: 16 },
  modalConfirm: {
    flex: 2,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: { fontSize: 16 },
  profileModal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
    paddingTop: 14,
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 20, marginBottom: 4, letterSpacing: -0.2 },
  sheetSubtitle: { fontSize: 16, lineHeight: 22, marginBottom: 2 },
  profFieldLabel: {
    fontSize: 14,
    letterSpacing: 0.6,
    marginBottom: 7,
    marginTop: 16,
  },
  profField: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  profSaveBtn: {
    marginTop: 24,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  profSaveBtnText: { fontSize: 16 },

  boundaryCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
  },
  boundaryLabel: {
    fontSize: 14,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  boundary: { fontSize: 14, lineHeight: 20, marginTop: 5 },
});

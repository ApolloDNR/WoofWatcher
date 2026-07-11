import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetMe } from "@workspace/api-client-react";
import { buildCarePass, deriveHouseholdAccessPlan } from "@workspace/care-domain";

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
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { getAvatarTemplate } from "@/lib/avatarStudio";
import { notifyDialog } from "@/lib/confirmDialog";
import { deriveCareCareer, deriveCareStreak } from "@/lib/careCareer";
import {
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";
import { resolvePetName } from "@/lib/petIdentity";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type HouseholdMemberSummary = {
  displayName?: string | null;
  email?: string | null;
  role?: string | null;
};

type PackSegment = "pets" | "people" | "access" | "carepass";

const PACK_SEGMENTS: readonly { key: PackSegment; label: string }[] = [
  { key: "pets", label: "Pets" },
  { key: "people", label: "People" },
  { key: "access", label: "Access" },
  { key: "carepass", label: "Care Pass" },
];

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
 * amplitude stays tiny so the portrait reads alive without pulling focus
 * (there is no app-wide reduced-motion setting yet, so subtle is the rule).
 */
function BreathingPetSprite({
  source,
  accessibilityLabel,
}: {
  source: ImageSourcePropType;
  accessibilityLabel: string;
}) {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 1750, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath]);

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
  const { state } = useCare();
  const { avatarConfig, getAvatarSource } = useAvatar();
  const me = useGetMe();
  const now = Date.now();
  const [segment, setSegment] = useState<PackSegment>("pets");

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
        household: household ? { name: household.name, inviteCode: household.inviteCode } : null,
        members,
        caregivers: state.caregivers,
        routines: state.routines,
      }),
    [household, members, state.caregivers, state.routines],
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

  const changeSegment = (key: PackSegment) => {
    Haptics.selectionAsync();
    setSegment(key);
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
      >
        <BoardRouteHeader
          kicker="Household"
          title="Pack"
          subtitle="Pets & people who share the care."
          icon="people-outline"
          actionIcon="key-outline"
          actionLabel="Manage household from Pack"
          onAction={() => open("/more?section=household")}
          plain
          style={s.routeHeaderCompact}
        />

        <BoardSegmentTabs segments={PACK_SEGMENTS} active={segment} onChange={changeSegment} style={s.segmentTabs} />

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
                onPress={() => open("/more?section=diet")}
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
                onPress={() => open("/more?section=diet")}
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
              householdAccess.people.slice(0, 5).map((person, index) => {
                const tone = memberTone(index);
                const logCount = state.entries.filter(
                  (entry) => entry.caregiver.trim().toLowerCase() === person.name.toLowerCase(),
                ).length;
                const isYou = Boolean(myName) && person.name.toLowerCase() === myName.toLowerCase();
                return (
                  <View
                    key={person.id}
                    style={[
                      s.personRow,
                      index < Math.min(householdAccess.people.length, 5) - 1 && {
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
              onPress={() => open("/more?section=household")}
              accessibilityLabel="Manage household in the More tab"
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

            <BoardActionButton
              label="Open household console"
              icon="key-outline"
              variant="soft"
              onPress={() => open("/more")}
              accessibilityLabel="Open the full Household Access console in More"
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

            <BoardActionButton
              label="Build & share Care Pass"
              icon="share-outline"
              variant="primary"
              onPress={() => open("/more")}
              accessibilityLabel="Build and share a Care Pass from More"
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
          <Text style={[s.boundaryLabel, { color: colors.copper, fontFamily: DISPLAY_SEMI }]}>CARE BOUNDARY</Text>
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
  segmentTabs: {
    marginBottom: 2,
  },
  sectionCard: { marginTop: 10 },
  segmentAction: {
    marginTop: 12,
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

  carePassSummary: {
    fontSize: 12.5,
    lineHeight: 18,
  },

  boundaryCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
  },
  boundaryLabel: { fontSize: 10.5, letterSpacing: 0.5 },
  boundary: { fontSize: 12, lineHeight: 18, marginTop: 5 },
});

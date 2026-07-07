import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetMe } from "@workspace/api-client-react";
import { buildCarePass, deriveHouseholdAccessPlan } from "@workspace/care-domain";

import {
  BoardCard,
  BoardMetricTile,
  BoardPill,
  BoardRouteHeader,
  BoardSectionHeader,
  CareRow,
} from "@/components/board/BoardPrimitives";
import { useAvatar } from "@/context/AvatarContext";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { getAvatarTemplate } from "@/lib/avatarStudio";
import { deriveCareCareer, deriveCareStreak } from "@/lib/careCareer";
import {
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";
import { derivePhoenixStatus } from "@/lib/phoenixStatus";

const DISPLAY = "Fredoka_700Bold";
const DISPLAY_SEMI = "Fredoka_600SemiBold";

type HouseholdMemberSummary = {
  displayName?: string | null;
  email?: string | null;
  role?: string | null;
};

export default function PackScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useCare();
  const { avatarConfig, getAvatarSource } = useAvatar();
  const me = useGetMe();
  const now = Date.now();

  const household = me.data?.household;
  const members: HouseholdMemberSummary[] = me.data?.members ?? [];
  const myName = me.data?.user?.displayName?.trim() || "";

  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  const petName =
    state.profile.name && state.profile.name !== "My Dog" ? state.profile.name : "Phoenix";

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
        profile: state.profile,
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
  const accessTone = householdAccess.status === "ready" ? colors.sage : colors.amber;
  const petIdentityLine = [
    state.profile.breed,
    `${avatarTemplate.label} care twin${avatarConfig.scanAssisted ? " (scan-assisted)" : ""}`,
  ]
    .filter(Boolean)
    .join(" - ");
  const levelPercent = Math.round(careCareer.levelProgress * 100);

  const open = (route: string) => {
    Haptics.selectionAsync();
    router.push(route as never);
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

        {/* Pets */}
        <BoardCard style={s.sectionCard}>
          <BoardSectionHeader
            title="Pets"
            accessory={<BoardPill label={careCareer.levelLabel} icon="paw-outline" tone={colors.copper} />}
          />

          <View style={[s.petHero, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[s.petAvatarFrame, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Image
                source={getAvatarSource(status.mood)}
                style={s.petAvatarImage}
                resizeMode="cover"
                accessibilityLabel={`${petName} avatar`}
              />
            </View>
            <View style={s.petHeroCopy}>
              <Text style={[s.petName, { color: colors.foreground, fontFamily: DISPLAY }]}>{petName}</Text>
              <Text style={[s.petIdentity, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {petIdentityLine}
              </Text>
              <View style={[s.levelTrack, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <View style={[s.levelFill, { width: `${levelPercent}%`, backgroundColor: colors.copper }]} />
              </View>
              <Text style={[s.levelMeta, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                {careCareer.levelXp.toLocaleString()} / {careCareer.levelSpanXp.toLocaleString()} XP toward Lv{" "}
                {careCareer.level + 1}
              </Text>
            </View>
          </View>

          <View style={s.metricStack}>
            <BoardMetricTile
              icon="energy"
              label="Care streak"
              value={careStreak > 0 ? `${careStreak} day${careStreak === 1 ? "" : "s"}` : "Start today"}
              detail="Consecutive days of logged care"
              tone={colors.amber}
            />
            <BoardMetricTile
              icon="note"
              label="Care XP today"
              value={`${careCareer.todayXp} XP`}
              detail="Earned only from real care logs"
              tone={colors.sage}
            />
          </View>

          <View style={[s.linkList, { borderTopColor: colors.border }]}>
            <CareRow
              icon="health"
              title="Health Watch"
              detail="Owner notes, no diagnosis"
              onPress={() => open("/health?tab=health")}
              accessibilityLabel={`Open Health Watch for ${petName}`}
            />
            <CareRow
              icon="bile"
              title="Bile Watch"
              detail="Yellow bile pattern log"
              onPress={() => open("/health?tab=bile")}
              accessibilityLabel={`Open Bile Watch for ${petName}`}
            />
            <CareRow
              icon="note"
              title="Records & reports"
              detail={
                state.records.length
                  ? `${state.records.length} record${state.records.length === 1 ? "" : "s"} saved`
                  : "No records saved yet"
              }
              onPress={() => open("/records")}
              accessibilityLabel={`Open records and reports for ${petName}`}
            />
            <CareRow
              icon="happy"
              title="Avatar Studio"
              detail={`${avatarTemplate.label} template`}
              onPress={() => open("/portrait")}
              accessibilityLabel={`Open Avatar Studio for ${petName}`}
            />
          </View>
        </BoardCard>

        {/* People */}
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
                  <View style={[s.personAvatar, { backgroundColor: tone + "1A" }]}>
                    <Text style={[s.personInitial, { color: tone, fontFamily: "Inter_700Bold" }]}>
                      {person.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
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
                  <View
                    style={[
                      s.personBadge,
                      { backgroundColor: person.needsInvite ? colors.amber + "18" : colors.background },
                    ]}
                  >
                    <Text
                      style={[
                        s.personBadgeText,
                        {
                          color: person.needsInvite ? colors.amber : colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {person.needsInvite ? "Invite" : `${logCount} log${logCount === 1 ? "" : "s"}`}
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          <View style={[s.linkList, { borderTopColor: colors.border }]}>
            <CareRow
              icon="bond"
              title="Manage household"
              detail="Care Team, invites, and roles"
              onPress={() => open("/more?section=household")}
              accessibilityLabel="Manage household in the More tab"
            />
          </View>
        </BoardCard>

        {/* Access */}
        <BoardCard style={[s.sectionCard, { borderColor: accessTone + "44" }]}>
          <BoardSectionHeader
            title="Access"
            accessory={
              <BoardPill
                label={householdAccess.status === "ready" ? "Aligned" : "Needs review"}
                icon="key-outline"
                tone={accessTone}
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
              <View key={metric.label} style={[s.accessMetric, { backgroundColor: colors.background }]}>
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

          <View style={[s.linkList, { borderTopColor: colors.border }]}>
            <CareRow
              icon="bond"
              title="Household Access console"
              detail="Invites, roles, and Access Passes"
              onPress={() => open("/more")}
              accessibilityLabel="Open the full Household Access console in More"
            />
          </View>
        </BoardCard>

        {/* Care Pass */}
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

          <View style={[s.linkList, { borderTopColor: colors.border }]}>
            <CareRow
              icon="heart"
              title="Build & share Care Pass"
              detail="Sitter, vet, trainer, and caregiver views"
              onPress={() => open("/more")}
              accessibilityLabel="Build and share a Care Pass from More"
            />
            <CareRow
              icon="note"
              title="Report history"
              detail={
                savedReports.length
                  ? `${savedReports.length} shared report${savedReports.length === 1 ? "" : "s"}`
                  : "Shared Care Passes appear in Records"
              }
              onPress={() => open("/records")}
              accessibilityLabel="Open report history in Records"
            />
          </View>
        </BoardCard>

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
  sectionCard: { marginTop: 10 },

  petHero: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 11,
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
  },
  petAvatarFrame: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
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
  levelTrack: {
    height: 9,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 8,
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
  linkList: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 2,
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
    borderRadius: 10,
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
  personBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  personBadgeText: {
    fontSize: 11,
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

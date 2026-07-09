import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { deriveOnboardingStatus } from "@workspace/care-domain";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { BoardCard, BoardPill, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { isClerkConfigured, useWoofAuth } from "@/lib/auth";
import { buildAuthSetupProofManifest } from "@/lib/authProviderProof";
import { isOwnerOpsBuild } from "@/lib/buildChannel";
import { notifyDialog } from "@/lib/confirmDialog";
import {
  getKeyboardAvoidingVerticalOffset,
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
} from "@/lib/mobileLayout";
import {
  applySetupWizardDraft,
  buildSetupWizardConfirmation,
  createSetupWizardDraft,
  type SetupWizardDraft,
  type SetupWizardHouseholdMode,
} from "@/lib/setupWizard";

const DISPLAY_SEMI = "Fredoka_600SemiBold";

type IoniconName = keyof typeof Ionicons.glyphMap;

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
    detail: "Start this dog's shared home base for routines, logs, reports, and invites later.",
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
    detail: "Keep everything on this device for now - you can connect an account later.",
  },
];

export default function SetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ownerOps = isOwnerOpsBuild();
  const { state, updateCareDoc, isLoaded } = useCare();
  const { isSignedIn } = useWoofAuth();
  const [draft, setDraft] = useState<SetupWizardDraft>(() => createSetupWizardDraft(state));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!isLoaded || dirty) return;
    setDraft(createSetupWizardDraft(state));
  }, [dirty, isLoaded, state]);

  const preview = useMemo(() => applySetupWizardDraft(state, draft, state.updatedAt), [draft, state]);
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
    () => buildSetupWizardConfirmation(preview, { isSignedIn: Boolean(isSignedIn), isClerkConfigured }),
    [isSignedIn, preview],
  );
  const authSetupProofManifest = buildAuthSetupProofManifest();

  const setField = (key: keyof SetupWizardDraft, value: string) => {
    setDirty(true);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const householdReady = draft.householdMode !== "join" || draft.inviteCode.trim().length >= 3;
  const canSave = onboarding.isComplete && householdReady;

  const saveSetup = () => {
    if (!canSave) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateCareDoc((doc) => applySetupWizardDraft(doc, draft));
    // Alert is a no-op on react-native-web, so the confirmation and the
    // hand-off to Today must both work without it.
    notifyDialog(
      "Care foundation saved",
      `${confirmation.detail}\n\n${confirmation.providerBoundary}`,
    );
    router.replace("/(tabs)");
  };

  const finishLater = () => {
    Haptics.selectionAsync();
    router.replace("/(tabs)");
  };
  const openAuthSetupProofMission = () => {
    Haptics.selectionAsync();
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

  return (
    <>
      <KeyboardAvoidingView
        style={[s.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding, paddingHorizontal: 20 }}
        >
          <BoardRouteHeader
            kicker="Care foundation"
            title="Set up WoofWatcher"
            subtitle="One clean setup pass gives Today, Log, Reports, Records, and WoofGuide the context they need."
            icon="sparkles-outline"
          />

          <BoardCard style={s.progressCard}>
            <BoardSectionHeader
              title="Setup progress"
              accessory={<BoardPill label={`${onboarding.completedCount}/${onboarding.totalCount} ready`} tone={colors.primary} />}
            />
            <View style={s.progressTop}>
              <View>
                <Text style={[s.progressValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {onboarding.completedCount}/{onboarding.totalCount}
                </Text>
                <Text style={[s.progressLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  Steps to confirm before saving
                </Text>
              </View>
              <View style={[s.percentPill, { backgroundColor: colors.primary + "16" }]}>
                <Text style={[s.percentText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{onboarding.percent}%</Text>
              </View>
            </View>
            <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[s.progressFill, { width: `${onboarding.percent}%`, backgroundColor: colors.primary }]} />
            </View>
            <View style={s.stepGrid}>
              {onboarding.steps.map((step) => (
                <View key={step.id} style={s.stepItem}>
                  <Ionicons
                    name={step.done ? "checkmark-circle" : "ellipse-outline"}
                    size={15}
                    color={step.done ? colors.sage : colors.mutedForeground}
                  />
                  <Text numberOfLines={1} style={[s.stepText, { color: step.done ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                    {(() => {
                      const t = step.title.replace("Set up ", "").replace("Add ", "");
                      return t.charAt(0).toUpperCase() + t.slice(1);
                    })()}
                  </Text>
                </View>
              ))}
            </View>
          </BoardCard>

          <Section title="Dog profile" icon="paw-outline">
            <Field label="Name" value={draft.dogName} placeholder="Phoenix" onChangeText={(value) => setField("dogName", value)} />
            <Field label="Breed or mix" value={draft.breed} placeholder="German Shepherd mix" onChangeText={(value) => setField("breed", value)} />
            <View style={s.twoCol}>
              <Field label="Weight" value={draft.weight} placeholder="68" keyboardType="decimal-pad" onChangeText={(value) => setField("weight", value)} />
              <Field label="Unit" value={draft.weightUnit} placeholder="lb" onChangeText={(value) => setField("weightUnit", value)} />
            </View>
            <Field
              label="Care focus"
              value={draft.careFocus}
              placeholder="Support anxious eating and steady routines"
              multiline
              onChangeText={(value) => setField("careFocus", value)}
            />
          </Section>

          <Section title="Diet baseline" icon="restaurant-outline">
            <Field label="Food" value={draft.primaryFood} placeholder="Sensitive kibble" onChangeText={(value) => setField("primaryFood", value)} />
            <Field label="Normal portion" value={draft.normalPortion} placeholder="1 cup" onChangeText={(value) => setField("normalPortion", value)} />
            <Field label="Meal schedule" value={draft.mealSchedule} placeholder="7 AM and 6 PM" onChangeText={(value) => setField("mealSchedule", value)} />
          </Section>

          <Section title="Starter routine" icon="calendar-outline">
            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>TYPE</Text>
            <View style={s.typeRow}>
              {ROUTINE_TYPES.map((item) => {
                const selected = draft.routineType === item.value;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Routine type ${item.label}`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setField("routineType", item.value);
                    }}
                    style={({ pressed }) => [
                      s.typePill,
                      {
                        backgroundColor: selected ? colors.primary : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Ionicons name={item.icon} size={14} color={selected ? "#fff" : colors.primary} />
                    <Text style={[s.typeText, { color: selected ? "#fff" : colors.foreground, fontFamily: "Inter_700Bold" }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field label="Routine name" value={draft.routineLabel} placeholder="Breakfast" onChangeText={(value) => setField("routineLabel", value)} />
            <Field label="Time" value={draft.routineTime} placeholder="7:30 AM" onChangeText={(value) => setField("routineTime", value)} />
          </Section>

          <Section title="Household path" icon="home-outline">
            <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>HOW SHOULD THIS CARE HOME START?</Text>
            <View style={s.modeStack}>
              {HOUSEHOLD_MODES.map((item) => {
                const selected = draft.householdMode === item.value;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${item.label}. ${item.detail}`}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setField("householdMode", item.value);
                    }}
                    style={({ pressed }) => [
                      s.modeCard,
                      {
                        backgroundColor: selected ? colors.primary + "14" : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                        opacity: pressed ? 0.76 : 1,
                      },
                    ]}
                  >
                    <View style={[s.modeIcon, { backgroundColor: selected ? colors.primary : colors.primary + "16" }]}>
                      <Ionicons name={item.icon} size={16} color={selected ? "#fff" : colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.modeTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{item.label}</Text>
                      <Text style={[s.modeDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{item.detail}</Text>
                    </View>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                  </Pressable>
                );
              })}
            </View>
            <Field
              label="Household name"
              value={draft.householdName}
              placeholder="Phoenix House"
              onChangeText={(value) => setField("householdName", value)}
            />
            {draft.householdMode === "join" && (
              <Field
                label="Invite code"
                value={draft.inviteCode}
                placeholder="WW-42"
                autoCapitalize="characters"
                onChangeText={(value) => setField("inviteCode", value)}
              />
            )}
          </Section>

          <Section title="Household caregiver" icon="people-outline">
            <Field label="Name" value={draft.caregiverName} placeholder="Apollo" onChangeText={(value) => setField("caregiverName", value)} />
            <Field label="Role" value={draft.caregiverRole} placeholder="Primary caregiver" onChangeText={(value) => setField("caregiverRole", value)} />
          </Section>

          <BoardCard style={s.confirmationCard}>
            <BoardSectionHeader
              title="After save"
              accessory={<BoardPill label="Review" tone={colors.amber} />}
            />
            <Text style={[s.confirmationTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{confirmation.title}</Text>
            <Text style={[s.householdLabel, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{confirmation.householdLabel}</Text>
            <Text style={[s.confirmationDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{confirmation.detail}</Text>
            <View style={s.confirmationRows}>
              {confirmation.nextActions.map((item) => (
                <View key={item} style={s.confirmationRow}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.sage} />
                  <Text style={[s.confirmationItem, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={[s.boundaryBox, { backgroundColor: colors.amber + "18", borderColor: colors.amber + "55" }]}>
              <Ionicons name="lock-closed-outline" size={15} color={colors.copper} />
              <Text style={[s.boundaryText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {confirmation.syncLabel} {confirmation.providerBoundary}
              </Text>
            </View>
          </BoardCard>

          {ownerOps ? (
          <BoardCard style={s.authSetupProofCard}>
            <BoardSectionHeader
              title="Auth/Setup proof manifest"
              accessory={<BoardPill label="Native proof blocked" tone={colors.amber} />}
            />
            <View style={s.authSetupProofGrid}>
              {authSetupProofManifest.rows.map((row) => (
                <View key={row.label} style={[s.authSetupProofCell, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[s.authSetupProofLabel, { color: colors.mutedForeground, fontFamily: "Inter_800ExtraBold" }]}>
                    {row.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      s.authSetupProofValue,
                      { color: row.status === "ready" ? colors.sage : colors.amber, fontFamily: "Inter_800ExtraBold" },
                    ]}
                  >
                    {row.value}
                  </Text>
                  <Text numberOfLines={2} style={[s.authSetupProofDetail, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    {row.detail}
                  </Text>
                </View>
              ))}
            </View>
            {authSetupProofManifest.blockers.map((blocker) => (
              <Text key={blocker} numberOfLines={2} style={[s.authSetupProofBlocker, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                - {blocker}
              </Text>
            ))}
          </BoardCard>
          ) : null}

          <View style={s.actions}>
            <Pressable
              onPress={saveSetup}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel={householdReady ? "Save foundation" : "Add invite code"}
              accessibilityState={{ disabled: !canSave }}
              style={({ pressed }) => [
                s.saveBtn,
                { backgroundColor: canSave ? colors.primary : colors.border, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={[s.saveText, { fontFamily: "Inter_700Bold" }]}>
                {householdReady ? "Save foundation" : "Add invite code"}
              </Text>
            </Pressable>
            <Pressable
              onPress={finishLater}
              accessibilityRole="button"
              accessibilityLabel="Finish setup later"
              style={({ pressed }) => [s.laterBtn, { opacity: pressed ? 0.65 : 1 }]}
            >
              <Text style={[s.laterText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>Finish later</Text>
            </Pressable>
            {ownerOps ? (
              <Pressable
                onPress={openAuthSetupProofMission}
                accessibilityRole="button"
                accessibilityLabel="Open auth and setup proof mission"
                style={({ pressed }) => [
                  s.proofBtn,
                  { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.copper} />
                <Text style={[s.proofText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Open setup proof</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
        <View style={[s.sectionIcon, { backgroundColor: colors.primary + "16" }]}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>{title}</Text>
      </View>
      <View style={s.sectionBody}>{children}</View>
    </BoardCard>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  multiline = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
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
  scroll: { flex: 1 },
  progressCard: { marginBottom: 16 },
  progressTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressValue: { fontSize: 28 },
  progressLabel: { fontSize: 12, marginTop: 1 },
  percentPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 13 },
  percentText: { fontSize: 13 },
  progressTrack: { height: 7, borderRadius: 4, overflow: "hidden", marginTop: 14 },
  progressFill: { height: "100%", borderRadius: 4 },
  stepGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 14 },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 5, width: "47%" },
  stepText: { fontSize: 11.5 },
  section: { marginBottom: 14 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 18 },
  sectionBody: { marginTop: 12, gap: 11 },
  fieldLabel: { fontSize: 10.5, letterSpacing: 0.5, marginBottom: 7 },
  field: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  fieldMultiline: { minHeight: 76, textAlignVertical: "top" },
  twoCol: { flexDirection: "row", gap: 10 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 2 },
  typePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  typeText: { fontSize: 12.5 },
  modeStack: { gap: 9, marginBottom: 2 },
  modeCard: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  modeIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  modeTitle: { fontSize: 13.5 },
  modeDetail: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  confirmationCard: { marginBottom: 14 },
  confirmationTitle: { fontSize: 19, marginTop: 10 },
  householdLabel: { fontSize: 12, marginTop: 2 },
  confirmationDetail: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  confirmationRows: { gap: 8, marginTop: 12 },
  confirmationRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  confirmationItem: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  boundaryBox: { borderWidth: 1, borderRadius: 15, padding: 11, flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 13 },
  boundaryText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  authSetupProofCard: { marginBottom: 14 },
  authSetupProofGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  authSetupProofCell: {
    width: "48.5%",
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 8,
    padding: 9,
  },
  authSetupProofLabel: { fontSize: 9, lineHeight: 12, textTransform: "uppercase" },
  authSetupProofValue: { fontSize: 11, lineHeight: 14, marginTop: 4 },
  authSetupProofDetail: { fontSize: 10, lineHeight: 14, marginTop: 4 },
  authSetupProofBlocker: { fontSize: 10.5, lineHeight: 15, marginTop: 8 },
  actions: { gap: 12, marginTop: 8 },
  saveBtn: { height: 54, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveText: { color: "#fff", fontSize: 15.5 },
  laterBtn: { height: 42, alignItems: "center", justifyContent: "center" },
  laterText: { fontSize: 14 },
  proofBtn: { minHeight: 42, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  proofText: { fontSize: 12.5 },
});

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
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
import { BoardCard, BoardRouteHeader, BoardSectionHeader } from "@/components/board/BoardPrimitives";
import { getStandaloneRouteBottomPadding } from "@/lib/mobileLayout";
import {
  applySetupWizardDraft,
  createSetupWizardDraft,
  type SetupWizardDraft,
} from "@/lib/setupWizard";

const DISPLAY_SEMI = "Fredoka_600SemiBold";

type IoniconName = keyof typeof Ionicons.glyphMap;

const ROUTINE_TYPES: { label: string; value: string; icon: IoniconName }[] = [
  { label: "Meal", value: "meal", icon: "restaurant-outline" },
  { label: "Walk", value: "walk", icon: "paw-outline" },
  { label: "Medication", value: "medication", icon: "medical-outline" },
  { label: "Care", value: "care", icon: "heart-outline" },
];

export default function SetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, updateCareDoc, isLoaded } = useCare();
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

  const setField = (key: keyof SetupWizardDraft, value: string) => {
    setDirty(true);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const canSave = onboarding.isComplete;

  const saveSetup = () => {
    if (!canSave) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateCareDoc((doc) => applySetupWizardDraft(doc, draft));
    router.replace("/(tabs)");
  };

  const finishLater = () => {
    Haptics.selectionAsync();
    router.replace("/(tabs)");
  };

  const topInset = Platform.OS === "web" ? 24 : insets.top;
  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  return (
    <>
      <Stack.Screen options={{ title: "Setup", headerBackTitle: "Today" }} />
      <KeyboardAvoidingView
        style={[s.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: topInset + 14, paddingBottom: bottomPadding, paddingHorizontal: 20 }}
        >
          <BoardRouteHeader
            kicker="Care foundation"
            title="Set up WoofWatcher"
            subtitle="One clean setup pass gives Today, Log, Reports, Records, and WoofGuide the context they need."
            icon="sparkles-outline"
          />

          <BoardCard style={s.progressCard}>
            <BoardSectionHeader title="Setup progress" action={`${onboarding.completedCount}/${onboarding.totalCount} ready`} />
            <View style={s.progressTop}>
              <View>
                <Text style={[s.progressValue, { color: colors.foreground, fontFamily: DISPLAY_SEMI }]}>
                  {onboarding.completedCount}/{onboarding.totalCount}
                </Text>
                <Text style={[s.progressLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                  Setup steps ready
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
                    {step.title.replace("Set up ", "").replace("Add ", "")}
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

          <Section title="Household caregiver" icon="people-outline">
            <Field label="Name" value={draft.caregiverName} placeholder="Apollo" onChangeText={(value) => setField("caregiverName", value)} />
            <Field label="Role" value={draft.caregiverRole} placeholder="Primary caregiver" onChangeText={(value) => setField("caregiverRole", value)} />
          </Section>

          <View style={s.actions}>
            <Pressable
              onPress={saveSetup}
              disabled={!canSave}
              style={({ pressed }) => [
                s.saveBtn,
                { backgroundColor: canSave ? colors.primary : colors.border, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={[s.saveText, { fontFamily: "Inter_700Bold" }]}>Save foundation</Text>
            </Pressable>
            <Pressable onPress={finishLater} style={({ pressed }) => [s.laterBtn, { opacity: pressed ? 0.65 : 1 }]}>
              <Text style={[s.laterText, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>Finish later</Text>
            </Pressable>
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
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "decimal-pad";
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
  actions: { gap: 12, marginTop: 8 },
  saveBtn: { height: 54, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveText: { color: "#fff", fontSize: 15.5 },
  laterBtn: { height: 42, alignItems: "center", justifyContent: "center" },
  laterText: { fontSize: 14 },
});

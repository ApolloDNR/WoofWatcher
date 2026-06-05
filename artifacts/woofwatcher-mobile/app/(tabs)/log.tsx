import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState, useCallback, useMemo } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCare, Entry } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import { EntryTypeIcon, entryTypeColor } from "@/components/EntryTypeIcon";

const ENTRY_TYPES = [
  "meal","walk","treat","park","potty","poop","pee","play","training","social","mood","alone","vomit","health","vet","weight","medication","note"
] as const;
type EntryType = (typeof ENTRY_TYPES)[number];

const TYPE_LABELS: Record<string, string> = {
  meal:"Meal",walk:"Walk",treat:"Treat",park:"Park",potty:"Potty",poop:"Poop",pee:"Pee",play:"Play",
  training:"Training",social:"Social",mood:"Mood",alone:"Alone",vomit:"Vomit",health:"Health",
  vet:"Vet",weight:"Weight",medication:"Meds",note:"Note",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function EntryItem({ entry, onDelete }: { entry: Entry; onDelete: (id: string, title: string) => void }) {
  const colors = useColors();
  const tc = entryTypeColor(entry.type, colors);
  return (
    <View style={[es.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}>
      <View style={[es.iconBg, { backgroundColor: tc + "1a" }]}>
        <EntryTypeIcon type={entry.type} size={20} color={tc} />
      </View>
      <View style={es.mid}>
        <Text style={[es.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{entry.title}</Text>
        <View style={es.meta}>
          <Text style={[es.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{entry.caregiver}</Text>
          <Text style={[es.dot, { color: colors.border }]}>·</Text>
          <Text style={[es.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{timeAgo(entry.occurredAt)}</Text>
          {entry.severity && entry.severity !== "normal" && (
            <>
              <Text style={[es.dot, { color: colors.border }]}>·</Text>
              <View style={[es.badge, { backgroundColor: entry.severity === "urgent" ? colors.rose + "22" : colors.amber + "22" }]}>
                <Text style={[es.badgeText, { color: entry.severity === "urgent" ? colors.rose : colors.amber, fontFamily: "Inter_600SemiBold" }]}>{entry.severity}</Text>
              </View>
            </>
          )}
        </View>
        {entry.note ? <Text numberOfLines={2} style={[es.note, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{entry.note}</Text> : null}
      </View>
      <Pressable onPress={() => onDelete(entry.id, entry.title)} hitSlop={15} style={es.delBtn}>
        <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}
const es = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-start", borderRadius: 20, borderWidth: 1, padding: 16, gap: 14, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  iconBg: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  mid: { flex: 1, paddingTop: 2 },
  title: { fontSize: 16, marginBottom: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaText: { fontSize: 13 },
  dot: { fontSize: 13 },
  note: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  delBtn: { padding: 4 }
});

export default function LogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, addEntry, deleteEntry } = useCare();
  const [selectedType, setSelectedType] = useState<EntryType>("meal");
  const [note, setNote] = useState("");
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const handleLog = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addEntry({
      type: selectedType,
      title: TYPE_LABELS[selectedType] || selectedType,
      caregiver: state.caregivers[0]?.name || "Caregiver",
      occurredAt: new Date().toISOString(),
      note: note.trim() || undefined,
      severity: "normal",
    });
    setNote("");
  }, [selectedType, note, addEntry, state.caregivers]);

  const handleDelete = useCallback((id: string, title: string) => {
    Alert.alert("Delete entry", `Remove "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); deleteEntry(id); } },
    ]);
  }, [deleteEntry]);

  const entries = useMemo(() => state.entries, [state.entries]);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topInset + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[s.screenTitle, { color: colors.foreground, fontFamily: "Inter_800ExtraBold" }]}>Log entry</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typePicker} style={s.typeScroll}>
          {ENTRY_TYPES.map((t) => {
            const active = selectedType === t;
            const tc = entryTypeColor(t, colors);
            return (
              <Pressable
                key={t}
                onPress={() => { setSelectedType(t); Haptics.selectionAsync(); }}
                style={[s.typeChip, { backgroundColor: active ? tc : colors.card, borderColor: active ? tc : colors.border }]}
              >
                <EntryTypeIcon type={t} size={16} color={active ? "#fff" : colors.foreground} />
                <Text style={[s.typeLabel, { color: active ? "#fff" : colors.foreground, fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium" }]}>
                  {TYPE_LABELS[t]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={s.inputRow}>
          <TextInput
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.mutedForeground}
            value={note}
            onChangeText={setNote}
            style={[s.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
            returnKeyType="done"
            onSubmitEditing={handleLog}
          />
          <Pressable onPress={handleLog} style={[s.logBtn, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === "web" ? 118 : 120 }}
        ListEmptyComponent={
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Ionicons name="clipboard-outline" size={32} color={colors.mutedForeground} />
            <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>No entries logged yet</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <EntryItem entry={item} onDelete={handleDelete} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1 },
  screenTitle: { fontSize: 28, marginBottom: 16, letterSpacing: -0.5 },
  typeScroll: { marginBottom: 16 },
  typePicker: { gap: 10, paddingRight: 20 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  typeLabel: { fontSize: 14 },
  inputRow: { flexDirection: "row", gap: 12 },
  input: { flex: 1, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  logBtn: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", shadowColor: "#2E5846", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  empty: { borderRadius: 20, borderWidth: 1, padding: 40, alignItems: "center", gap: 12, marginTop: 20 },
  emptyText: { fontSize: 15 },
});

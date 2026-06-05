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
    <View style={[es.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[es.iconBg, { backgroundColor: tc + "1a" }]}>
        <EntryTypeIcon type={entry.type} size={18} />
      </View>
      <View style={es.mid}>
        <Text style={[es.title, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{entry.title}</Text>
        <View style={es.meta}>
          <Text style={[es.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{entry.caregiver}</Text>
          <Text style={[es.dot, { color: colors.border }]}>·</Text>
          <Text style={[es.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{timeAgo(entry.occurredAt)}</Text>
          {entry.severity && entry.severity !== "normal" && (
            <>
              <Text style={[es.dot, { color: colors.border }]}>·</Text>
              <View style={[es.badge, { backgroundColor: entry.severity === "urgent" ? colors.rose + "22" : colors.amber + "22" }]}>
                <Text style={[es.badgeText, { color: entry.severity === "urgent" ? colors.rose : colors.amber, fontFamily: "Inter_500Medium" }]}>{entry.severity}</Text>
              </View>
            </>
          )}
        </View>
        {entry.note ? <Text numberOfLines={2} style={[es.note, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{entry.note}</Text> : null}
      </View>
      <Pressable onPress={() => onDelete(entry.id, entry.title)} hitSlop={10}>
        <Feather name="trash-2" size={15} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}
const es = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-start", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  iconBg: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", marginTop: 1 },
  mid: { flex: 1 },
  title: { fontSize: 14, marginBottom: 3 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  metaText: { fontSize: 12 },
  dot: { fontSize: 12 },
  note: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 11 },
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
        <Text style={[s.screenTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Log entry</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typePicker} style={s.typeScroll}>
          {ENTRY_TYPES.map((t) => {
            const active = selectedType === t;
            const tc = entryTypeColor(t, colors);
            return (
              <Pressable
                key={t}
                onPress={() => { setSelectedType(t); Haptics.selectionAsync(); }}
                style={[s.typeChip, { backgroundColor: active ? tc + "22" : colors.card, borderColor: active ? tc : colors.border }]}
              >
                <EntryTypeIcon type={t} size={15} color={active ? tc : colors.mutedForeground} />
                <Text style={[s.typeLabel, { color: active ? tc : colors.mutedForeground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
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
          <Pressable onPress={handleLog} style={[s.logBtn, { backgroundColor: entryTypeColor(selectedType, colors) }]}>
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: Platform.OS === "web" ? 118 : 100 }}
        ListEmptyComponent={
          <View style={[s.empty, { borderColor: colors.border }]}>
            <Feather name="clipboard" size={28} color={colors.mutedForeground} />
            <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>No entries logged yet</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        renderItem={({ item }) => <EntryItem entry={item} onDelete={handleDelete} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  screenTitle: { fontSize: 24, marginBottom: 14 },
  typeScroll: { marginBottom: 10 },
  typePicker: { gap: 6, paddingRight: 18 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  typeLabel: { fontSize: 12 },
  inputRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  logBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  empty: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 32, alignItems: "center", gap: 10, marginTop: 12 },
  emptyText: { fontSize: 14 },
});

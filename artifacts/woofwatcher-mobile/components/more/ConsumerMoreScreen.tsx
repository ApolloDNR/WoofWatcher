import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import {
  Redirect,
  type Href,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useDeferredValue, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BoardCard,
  BoardRouteHeader,
} from "@/components/board/BoardPrimitives";
import ConsumerMoreSectionRouter from "@/components/more/ConsumerMoreSectionRouter";
import { useColors } from "@/hooks/useColors";
import {
  executeMoreDirectoryDestination,
  MORE_DIRECTORY_GROUPS,
  searchMoreDirectory,
  type MoreDirectoryItem,
} from "@/lib/moreDirectory";
import {
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
  MIN_MOBILE_TOUCH_TARGET,
} from "@/lib/mobileLayout";
import { resolveMoreSectionRoute } from "@/lib/moreSectionRouting";

const ITEM_ICONS: Readonly<Record<string, keyof typeof Ionicons.glyphMap>> =
  Object.freeze({
    "dog-profile": "paw-outline",
    "avatar-studio": "color-palette-outline",
    "care-team": "people-outline",
    "supplies-travel": "bag-handle-outline",
    "story-progress": "book-outline",
    adventure: "map-outline",
    woofguide: "sparkles-outline",
    settings: "help-circle-outline",
    privacy: "shield-checkmark-outline",
    legal: "document-text-outline",
    "care-pass": "share-social-outline",
  });

export default function ConsumerMoreScreen() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const router = useRouter();
  const resolved = resolveMoreSectionRoute(params);
  const destination = resolved.destination;
  const redirectHref: Href = destination.params
    ? { pathname: destination.pathname, params: { ...destination.params } }
    : destination.pathname;

  if (destination.parent !== "more" || destination.replace) {
    return <Redirect href={redirectHref} />;
  }

  return (
    <ConsumerMoreSectionRouter
      section={resolved.section}
      itemId={resolved.itemId}
      entryId={resolved.entryId}
      walkId={resolved.walkId}
      prompt={resolved.prompt}
      legalDocument={resolved.legalDocument}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace("/more");
      }}
      renderRoot={() => <ConsumerMoreRoot />}
    />
  );
}

function ConsumerMoreRoot() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const results = useMemo(
    () => searchMoreDirectory(deferredQuery),
    [deferredQuery],
  );
  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const bottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  const openItem = (item: MoreDirectoryItem) => {
    void Haptics.selectionAsync().catch(() => {});
    executeMoreDirectoryDestination(item.destination, (route) =>
      router.push(route as never),
    );
  };

  const renderItem = (item: MoreDirectoryItem) => (
    <Pressable
      key={item.id}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityHint={item.detail}
      onPress={() => openItem(item)}
      style={({ pressed }) => [
        styles.destinationRow,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.secondary : colors.card,
        },
      ]}
    >
      <View
        style={[styles.destinationIcon, { backgroundColor: colors.secondary }]}
      >
        <Ionicons
          name={ITEM_ICONS[item.id] ?? "ellipse-outline"}
          size={20}
          color={colors.primary}
        />
      </View>
      <View style={styles.destinationCopy}>
        <Text
          style={[
            styles.destinationLabel,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {item.label}
        </Text>
        <Text
          style={[
            styles.destinationDetail,
            {
              color: colors.mutedForeground,
              fontFamily: "Inter_500Medium",
            },
          ]}
        >
          {item.detail}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.mutedForeground}
      />
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPadding, paddingBottom: bottomPadding },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BoardRouteHeader
          kicker="WOOFWATCHER"
          title="More"
          subtitle="Your dog's profile, care team, story, guidance, and privacy tools."
          plain
        />

        <BoardCard style={styles.directoryCard}>
          <View
            style={[
              styles.searchField,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Ionicons name="search" size={19} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Search More destinations"
              placeholder="Search More"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
              style={[
                styles.searchInput,
                { color: colors.foreground, fontFamily: "Inter_500Medium" },
              ]}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear More search"
                hitSlop={8}
                onPress={() => setQuery("")}
                style={({ pressed }) => [
                  styles.clearButton,
                  { opacity: pressed ? 0.58 : 1 },
                ]}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
            ) : null}
          </View>

          {normalizedQuery ? (
            <View style={styles.group}>
              <Text
                accessibilityRole="header"
                style={[
                  styles.groupTitle,
                  { color: colors.sage, fontFamily: "Inter_700Bold" },
                ]}
              >
                Search results
              </Text>
              {results.length ? (
                results.map(renderItem)
              ) : (
                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {`No destinations match “${normalizedQuery}”. Try care team, privacy, story, or vet report.`}
                </Text>
              )}
            </View>
          ) : (
            MORE_DIRECTORY_GROUPS.map((group) => (
              <View key={group.id} style={styles.group}>
                <Text
                  accessibilityRole="header"
                  style={[
                    styles.groupTitle,
                    { color: colors.sage, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {group.title}
                </Text>
                {group.items.map(renderItem)}
              </View>
            ))
          )}
        </BoardCard>

        <View
          accessible
          accessibilityLabel="Privacy note. Care details stay on this device unless you choose to share them."
          style={[
            styles.privacyNote,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Ionicons name="shield-checkmark" size={18} color={colors.sage} />
          <Text
            style={[
              styles.privacyText,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_500Medium",
              },
            ]}
          >
            Care details stay on this device unless you choose to share them.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: 16,
  },
  directoryCard: {
    padding: 14,
  },
  searchField: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 13,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: {
    minWidth: 0,
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
  },
  clearButton: {
    width: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  group: {
    marginTop: 17,
    gap: 8,
  },
  groupTitle: {
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  destinationRow: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  destinationIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  destinationCopy: {
    minWidth: 0,
    flex: 1,
  },
  destinationLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  destinationDetail: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 16,
  },
  emptyText: {
    paddingVertical: 20,
    paddingHorizontal: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  privacyNote: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  privacyText: {
    minWidth: 0,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});

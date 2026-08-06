import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BoardCard,
  BoardRouteHeader,
  BoardSegmentTabs,
} from "@/components/board/BoardPrimitives";
import { useColors } from "@/hooks/useColors";
import {
  PRIVACY_POLICY_MARKDOWN,
  TERMS_OF_SERVICE_MARKDOWN,
} from "@/lib/legalContent";
import {
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
} from "@/lib/mobileLayout";

type LegalDoc = "privacy" | "terms";

export interface LegalScreenProps {
  document?: "privacy" | "terms";
  onBack: () => void;
}

interface LegalBlock {
  kind: "h1" | "h2" | "h3" | "bullet" | "paragraph";
  text: string;
}

/** Line-based renderer for the two bundled legal documents: headings,
    bullets, and paragraphs only — no markdown dependency. */
function parseLegalMarkdown(markdown: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("### ")) {
      flush();
      blocks.push({ kind: "h3", text: line.slice(4) });
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h2", text: line.slice(3) });
    } else if (line.startsWith("# ")) {
      flush();
      blocks.push({ kind: "h1", text: line.slice(2) });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      flush();
      blocks.push({ kind: "bullet", text: line.slice(2) });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks.map((block) => ({
    ...block,
    text: block.text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1"),
  }));
}

export default function LegalScreen({ document, onBack }: LegalScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [doc, setDoc] = useState<LegalDoc>(
    document === "terms" ? "terms" : "privacy",
  );

  const blocks = useMemo(
    () =>
      parseLegalMarkdown(
        doc === "privacy" ? PRIVACY_POLICY_MARKDOWN : TERMS_OF_SERVICE_MARKDOWN,
      ),
    [doc],
  );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: getRouteTopPadding({
            platform: Platform.OS,
            topInset: insets.top,
            surface: "tabbed",
          }),
          paddingBottom: getTabbedRouteBottomPadding({
            platform: Platform.OS,
            bottomInset: insets.bottom,
          }),
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BoardRouteHeader
          back
          onBack={onBack}
          title="Privacy & Terms"
          subtitle="How WoofWatcher handles your household's care data."
          plain
        />
        <BoardSegmentTabs
          segments={[
            { key: "privacy" as LegalDoc, label: "Privacy policy" },
            { key: "terms" as LegalDoc, label: "Terms of service" },
          ]}
          active={doc}
          onChange={setDoc}
        />
        <BoardCard enter={0}>
          {blocks.map((block, index) => {
            if (block.kind === "h1") {
              return (
                <Text
                  key={`block-${index}`}
                  style={[s.h1, { color: colors.foreground, fontFamily: "Fraunces_700Bold" }]}
                >
                  {block.text}
                </Text>
              );
            }
            if (block.kind === "h2") {
              return (
                <Text
                  key={`block-${index}`}
                  style={[s.h2, { color: colors.foreground, fontFamily: "Fredoka_600SemiBold" }]}
                >
                  {block.text}
                </Text>
              );
            }
            if (block.kind === "h3") {
              return (
                <Text
                  key={`block-${index}`}
                  style={[s.h3, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                >
                  {block.text}
                </Text>
              );
            }
            if (block.kind === "bullet") {
              return (
                <View key={`block-${index}`} style={s.bulletRow}>
                  <View style={[s.bulletDot, { backgroundColor: colors.forest }]} />
                  <Text
                    style={[s.body, s.bulletText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                  >
                    {block.text}
                  </Text>
                </View>
              );
            }
            return (
              <Text
                key={`block-${index}`}
                style={[s.body, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
              >
                {block.text}
              </Text>
            );
          })}
        </BoardCard>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  h1: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 10,
  },
  h2: {
    fontSize: 16,
    lineHeight: 21,
    marginTop: 14,
    marginBottom: 6,
  },
  h3: {
    fontSize: 13.5,
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    lineHeight: 19.5,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
    paddingLeft: 2,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    marginBottom: 0,
  },
});

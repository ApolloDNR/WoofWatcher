import React, { type ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoardRouteHeader } from "@/components/board/BoardPrimitives";
import DietScreen from "@/components/health/DietScreen";
import RecordsScreen from "@/components/health/RecordsScreen";
import TrendsScreen from "@/components/health/TrendsScreen";
import { useColors } from "@/hooks/useColors";
import {
  HEALTH_SECTION_TARGETS,
  type HealthCoreSection,
} from "@/lib/healthSectionRouting";
import {
  getRouteTopPadding,
  getTabbedRouteBottomPadding,
} from "@/lib/mobileLayout";
import type { HealthSection } from "@/lib/navigationOwnership";

export interface HealthSectionRouterProps {
  section: HealthSection;
  entryId?: string;
  reportId?: string;
  onBack: () => void;
  renderCoreSection: (section: HealthCoreSection) => ReactNode;
}

export default function HealthSectionRouter({
  section,
  entryId,
  reportId,
  onBack,
  renderCoreSection,
}: HealthSectionRouterProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const contentTopPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "tabbed",
  });
  const contentBottomPadding = getTabbedRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const target = HEALTH_SECTION_TARGETS[section];

  if (target.kind === "core") {
    return renderCoreSection(target.section);
  }

  if (target.kind === "records") {
    const recordsIdentifiers =
      target.section === "records" ? { entryId, reportId } : {};
    return (
      <RecordsScreen
        section={target.section}
        onBack={onBack}
        {...recordsIdentifiers}
      />
    );
  }

  if (target.kind === "trends") {
    return (
      <TrendsScreen
        contentTopPadding={contentTopPadding}
        contentBottomPadding={contentBottomPadding}
        onBack={onBack}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: contentTopPadding,
          paddingBottom: contentBottomPadding,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BoardRouteHeader
          kicker="Health"
          title="Diet"
          subtitle="Food, portions, sensitivities, and owner notes"
          back
          onBack={onBack}
        />
        <DietScreen openDetails />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
});

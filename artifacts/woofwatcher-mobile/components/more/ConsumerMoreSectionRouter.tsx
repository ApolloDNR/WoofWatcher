import { useRouter } from "expo-router";
import React from "react";

import AdventureScreen from "@/components/more/AdventureScreen";
import AvatarStudioScreen from "@/components/more/AvatarStudioScreen";
import { CareTeamSuppliesScreen } from "@/components/more/CareTeamSuppliesScreen";
import ConsumerPrivacyDataScreen from "@/components/more/ConsumerPrivacyDataScreen";
import DogProfileScreen from "@/components/more/DogProfileScreen";
import LegalScreen from "@/components/more/LegalScreen";
import SettingsScreen from "@/components/more/SettingsScreen";
import StoryProgressScreen from "@/components/more/StoryProgressScreen";
import WoofGuideScreen from "@/components/more/WoofGuideScreen";
import type { MoreSection } from "@/lib/navigationOwnership";
import {
  MORE_SECTION_TARGETS,
  navigateToMoreSection,
} from "@/lib/moreSectionRouting";

export interface ConsumerMoreSectionRouterProps {
  section: MoreSection;
  itemId?: string;
  entryId?: string;
  walkId?: string;
  prompt?: string;
  legalDocument?: "privacy" | "terms";
  onBack: () => void;
  renderRoot: () => React.ReactNode;
}

const ignoreOwnerSpriteQa = () => {};

export default function ConsumerMoreSectionRouter({
  section,
  itemId,
  entryId,
  walkId,
  prompt,
  legalDocument,
  onBack,
  renderRoot,
}: ConsumerMoreSectionRouterProps) {
  const router = useRouter();
  const target = MORE_SECTION_TARGETS[section];

  function pushMore(nextSection: Exclude<MoreSection, "root">): void;
  function pushMore(
    nextSection: "legal",
    ownedParams: { doc: "privacy" | "terms" },
  ): void;
  function pushMore(
    nextSection: Exclude<MoreSection, "root">,
    ownedParams?: { doc: "privacy" | "terms" },
  ): void {
    navigateToMoreSection(
      (destination) => router.push(destination),
      nextSection,
      ownedParams,
    );
  }

  switch (target.kind) {
    case "dog-profile":
      return (
        <DogProfileScreen
          surface="tabbed"
          onBack={onBack}
          onOpenAvatarStudio={() => pushMore("avatar-studio")}
        />
      );
    case "avatar-studio":
      return (
        <AvatarStudioScreen
          surface="tabbed"
          onBack={onBack}
          onOpenSpriteQa={ignoreOwnerSpriteQa}
        />
      );
    case "care-team-supplies":
      return (
        <CareTeamSuppliesScreen
          section={target.section}
          itemId={itemId}
          onBack={onBack}
        />
      );
    case "story-progress":
      return (
        <StoryProgressScreen
          entryId={entryId}
          walkId={walkId}
          onBack={onBack}
          onOpenAdventure={() => pushMore("adventure")}
        />
      );
    case "adventure":
      return <AdventureScreen onBack={onBack} />;
    case "woofguide":
      return <WoofGuideScreen prompt={prompt} onBack={onBack} />;
    case "settings":
      return <SettingsScreen onBack={onBack} onOpenSection={pushMore} />;
    case "privacy":
      return (
        <ConsumerPrivacyDataScreen
          onBack={onBack}
          onOpenLegal={(document) =>
            pushMore("legal", { doc: document })
          }
        />
      );
    case "legal":
      return <LegalScreen document={legalDocument} onBack={onBack} />;
    case "root":
    default:
      return <>{renderRoot()}</>;
  }
}

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { useColors } from "@/hooks/useColors";

interface Props {
  type: string;
  size?: number;
  color?: string;
}

export function entryTypeColor(type: string, colors: ReturnType<typeof useColors>) {
  switch (type) {
    case "meal":
    case "treat":
    case "bedtime_snack":
      return colors.copper;
    case "walk":
    case "park":
    case "play":
    case "social":
      return colors.sage;
    case "training":
      return colors.amber;
    case "vomit":
    case "health":
    case "vet":
      return colors.rose;
    case "weight":
    case "medication":
      return colors.accent;
    default:
      return colors.mutedForeground;
  }
}

export function EntryTypeIcon({ type, size = 18, color }: Props) {
  const colors = useColors();
  const c = color || entryTypeColor(type, colors);

  switch (type) {
    case "meal":
      return <Ionicons name="restaurant" size={size} color={c} />;
    case "treat":
      return <MaterialCommunityIcons name="bone" size={size} color={c} />;
    case "walk":
      return <MaterialCommunityIcons name="walk" size={size} color={c} />;
    case "park":
      return <MaterialCommunityIcons name="tree" size={size} color={c} />;
    case "potty":
    case "pee":
      return <MaterialCommunityIcons name="water-outline" size={size} color={c} />;
    case "poop":
      return <MaterialCommunityIcons name="emoticon-poop-outline" size={size} color={c} />;
    case "play":
      return <MaterialCommunityIcons name="tennis-ball" size={size} color={c} />;
    case "training":
      return <MaterialCommunityIcons name="school" size={size} color={c} />;
    case "social":
      return <MaterialCommunityIcons name="account-group" size={size} color={c} />;
    case "mood":
      return <Ionicons name="happy-outline" size={size} color={c} />;
    case "alone":
      return <MaterialCommunityIcons name="home-account" size={size} color={c} />;
    case "vomit":
      return <Ionicons name="warning-outline" size={size} color={c} />;
    case "health":
      return <Ionicons name="medkit-outline" size={size} color={c} />;
    case "vet":
      return <MaterialCommunityIcons name="stethoscope" size={size} color={c} />;
    case "weight":
      return <MaterialCommunityIcons name="scale" size={size} color={c} />;
    case "medication":
      return <MaterialCommunityIcons name="pill" size={size} color={c} />;
    default:
      return <Ionicons name="document-text-outline" size={size} color={c} />;
  }
}

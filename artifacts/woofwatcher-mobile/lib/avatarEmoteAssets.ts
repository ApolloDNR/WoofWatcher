import type { ImageSourcePropType } from "react-native";

import type { AvatarEmoteState } from "@/lib/avatarStudio";

export interface PhoenixEmoteAsset {
  source: ImageSourcePropType;
  path: string;
  style: "pixellab-phoenix-emote";
  objectId: string;
  description: string;
}

export const PHOENIX_EMOTE_ASSETS: Record<AvatarEmoteState, PhoenixEmoteAsset> = {
  happy: {
    source: require("@/assets/avatar/phoenix/approved/emotes/happy.png"),
    path: "assets/avatar/phoenix/approved/emotes/happy.png",
    style: "pixellab-phoenix-emote",
    objectId: "existing-phoenix-proud-happy-v2",
    description: "Open, joyful Phoenix state for regular happy moments.",
  },
  calm: {
    source: require("@/assets/avatar/phoenix/approved/emotes/calm.png"),
    path: "assets/avatar/phoenix/approved/emotes/calm.png",
    style: "pixellab-phoenix-emote",
    objectId: "f690d72e-5efb-4931-ad76-d2f4a739ff87",
    description: "Settled Phoenix state with calm eyes and relaxed posture.",
  },
  excited: {
    source: require("@/assets/avatar/phoenix/approved/emotes/excited.png"),
    path: "assets/avatar/phoenix/approved/emotes/excited.png",
    style: "pixellab-phoenix-emote",
    objectId: "bfe8bee5-5fa8-415c-b63e-2d71faa9725e",
    description: "Playful excited Phoenix state with readable bounce posture.",
  },
  bored: {
    source: require("@/assets/avatar/phoenix/approved/emotes/bored.png"),
    path: "assets/avatar/phoenix/approved/emotes/bored.png",
    style: "pixellab-phoenix-emote",
    objectId: "b74aea82-806a-410c-acc5-1247cbde970c",
    description: "Chin-low waiting Phoenix state for bored or under-stimulated moments.",
  },
  hungry: {
    source: require("@/assets/avatar/phoenix/approved/emotes/hungry.png"),
    path: "assets/avatar/phoenix/approved/emotes/hungry.png",
    style: "pixellab-phoenix-emote",
    objectId: "2f1a7800-0414-44e7-94d0-fb986ca22343",
    description: "Food-cue Phoenix state with a clear hungry expression.",
  },
  anxious: {
    source: require("@/assets/avatar/phoenix/approved/emotes/anxious.png"),
    path: "assets/avatar/phoenix/approved/emotes/anxious.png",
    style: "pixellab-phoenix-emote",
    objectId: "existing-phoenix-home-alone-anxious-v2",
    description: "Soft anxious Phoenix state for watchful care moments.",
  },
  sleepy: {
    source: require("@/assets/avatar/phoenix/approved/emotes/sleepy.png"),
    path: "assets/avatar/phoenix/approved/emotes/sleepy.png",
    style: "pixellab-phoenix-emote",
    objectId: "existing-phoenix-sleep-rest-v2",
    description: "Resting Phoenix state for sleep and alone-time calm.",
  },
  proud: {
    source: require("@/assets/avatar/phoenix/approved/emotes/proud.png"),
    path: "assets/avatar/phoenix/approved/emotes/proud.png",
    style: "pixellab-phoenix-emote",
    objectId: "existing-phoenix-proud-happy-v2",
    description: "Proud Phoenix state for training wins and care streaks.",
  },
  home_alone: {
    source: require("@/assets/avatar/phoenix/approved/emotes/home-alone.png"),
    path: "assets/avatar/phoenix/approved/emotes/home-alone.png",
    style: "pixellab-phoenix-emote",
    objectId: "existing-phoenix-home-alone-anxious-v2",
    description: "Home-alone Phoenix state for manual household presence tracking.",
  },
  not_feeling_well: {
    source: require("@/assets/avatar/phoenix/approved/emotes/not-feeling-well.png"),
    path: "assets/avatar/phoenix/approved/emotes/not-feeling-well.png",
    style: "pixellab-phoenix-emote",
    objectId: "39e8b2d9-da66-496b-83c6-8755bcad7d23",
    description: "Low-energy Phoenix state for non-diagnostic health watch moments.",
  },
};

export function getPhoenixEmoteAsset(state: AvatarEmoteState): PhoenixEmoteAsset {
  return PHOENIX_EMOTE_ASSETS[state] ?? PHOENIX_EMOTE_ASSETS.happy;
}

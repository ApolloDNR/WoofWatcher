import type { ImageSourcePropType } from "react-native";

import {
  AVATAR_EMOTE_STATES,
  type AvatarEmotePackId,
  type AvatarEmoteState,
  type AvatarTemplateId,
} from "@/lib/avatarStudio";
import { AVATAR_TEMPLATE_BASE_ASSETS, getAvatarTemplateDisplaySource } from "@/lib/avatarTemplateAssets";

export type AvatarEmoteAssetStyle =
  | "pixellab-phoenix-emote"
  | "pixellab-retriever-emote"
  | "pixellab-husky-emote"
  | "template-base-emote-fallback";

export interface AvatarEmoteAsset {
  source: ImageSourcePropType;
  path: string;
  style: AvatarEmoteAssetStyle;
  objectId?: string;
  description: string;
  complete: boolean;
}

export type PhoenixEmoteAsset = AvatarEmoteAsset & {
  style: "pixellab-phoenix-emote";
  objectId: string;
  complete: true;
};

export const PHOENIX_EMOTE_ASSETS: Record<AvatarEmoteState, PhoenixEmoteAsset> = {
  happy: {
    source: require("@/assets/avatar/phoenix/approved/emotes/happy.png"),
    path: "assets/avatar/phoenix/approved/emotes/happy.png",
    style: "pixellab-phoenix-emote",
    objectId: "existing-phoenix-proud-happy-v2",
    description: "Open, joyful Phoenix state for regular happy moments.",
    complete: true,
  },
  calm: {
    source: require("@/assets/avatar/phoenix/approved/emotes/calm.png"),
    path: "assets/avatar/phoenix/approved/emotes/calm.png",
    style: "pixellab-phoenix-emote",
    objectId: "f690d72e-5efb-4931-ad76-d2f4a739ff87",
    description: "Settled Phoenix state with calm eyes and relaxed posture.",
    complete: true,
  },
  excited: {
    source: require("@/assets/avatar/phoenix/approved/emotes/excited.png"),
    path: "assets/avatar/phoenix/approved/emotes/excited.png",
    style: "pixellab-phoenix-emote",
    objectId: "bfe8bee5-5fa8-415c-b63e-2d71faa9725e",
    description: "Playful excited Phoenix state with readable bounce posture.",
    complete: true,
  },
  bored: {
    source: require("@/assets/avatar/phoenix/approved/emotes/bored.png"),
    path: "assets/avatar/phoenix/approved/emotes/bored.png",
    style: "pixellab-phoenix-emote",
    objectId: "b74aea82-806a-410c-acc5-1247cbde970c",
    description: "Chin-low waiting Phoenix state for bored or under-stimulated moments.",
    complete: true,
  },
  hungry: {
    source: require("@/assets/avatar/phoenix/approved/emotes/hungry.png"),
    path: "assets/avatar/phoenix/approved/emotes/hungry.png",
    style: "pixellab-phoenix-emote",
    objectId: "2f1a7800-0414-44e7-94d0-fb986ca22343",
    description: "Food-cue Phoenix state with a clear hungry expression.",
    complete: true,
  },
  anxious: {
    source: require("@/assets/avatar/phoenix/approved/emotes/anxious.png"),
    path: "assets/avatar/phoenix/approved/emotes/anxious.png",
    style: "pixellab-phoenix-emote",
    objectId: "existing-phoenix-home-alone-anxious-v2",
    description: "Soft anxious Phoenix state for watchful care moments.",
    complete: true,
  },
  sleepy: {
    source: require("@/assets/avatar/phoenix/approved/emotes/sleepy.png"),
    path: "assets/avatar/phoenix/approved/emotes/sleepy.png",
    style: "pixellab-phoenix-emote",
    objectId: "existing-phoenix-sleep-rest-v2",
    description: "Resting Phoenix state for sleep and alone-time calm.",
    complete: true,
  },
  proud: {
    source: require("@/assets/avatar/phoenix/approved/emotes/proud.png"),
    path: "assets/avatar/phoenix/approved/emotes/proud.png",
    style: "pixellab-phoenix-emote",
    objectId: "existing-phoenix-proud-happy-v2",
    description: "Proud Phoenix state for training wins and care streaks.",
    complete: true,
  },
  home_alone: {
    source: require("@/assets/avatar/phoenix/approved/emotes/home-alone.png"),
    path: "assets/avatar/phoenix/approved/emotes/home-alone.png",
    style: "pixellab-phoenix-emote",
    objectId: "existing-phoenix-home-alone-anxious-v2",
    description: "Home-alone Phoenix state for manual household presence tracking.",
    complete: true,
  },
  not_feeling_well: {
    source: require("@/assets/avatar/phoenix/approved/emotes/not-feeling-well.png"),
    path: "assets/avatar/phoenix/approved/emotes/not-feeling-well.png",
    style: "pixellab-phoenix-emote",
    objectId: "39e8b2d9-da66-496b-83c6-8755bcad7d23",
    description: "Low-energy Phoenix state for non-diagnostic health watch moments.",
    complete: true,
  },
};

export const RETRIEVER_STARTER_EMOTE_ASSETS: Partial<Record<AvatarEmoteState, AvatarEmoteAsset>> = {
  happy: {
    source: require("@/assets/avatar/templates/retriever/emotes/happy.png"),
    path: "assets/avatar/templates/retriever/emotes/happy.png",
    style: "pixellab-retriever-emote",
    objectId: "5e24a03f-73dc-4684-b4c3-ddc91f8db9f9",
    description: "Happy Retriever starter state for the first non-Phoenix avatar pack.",
    complete: true,
  },
  calm: {
    source: require("@/assets/avatar/templates/retriever/emotes/calm.png"),
    path: "assets/avatar/templates/retriever/emotes/calm.png",
    style: "pixellab-retriever-emote",
    objectId: "b5983708-e550-472f-9189-5ac9bec7d191",
    description: "Calm Retriever starter state for settled care moments.",
    complete: true,
  },
  excited: {
    source: require("@/assets/avatar/templates/retriever/emotes/excited.png"),
    path: "assets/avatar/templates/retriever/emotes/excited.png",
    style: "pixellab-retriever-emote",
    objectId: "e4aae138-1c54-4cf1-88c7-613dc62d1184",
    description: "Excited Retriever starter state for playful care moments.",
    complete: true,
  },
  bored: {
    source: require("@/assets/avatar/templates/retriever/emotes/bored.png"),
    path: "assets/avatar/templates/retriever/emotes/bored.png",
    style: "pixellab-retriever-emote",
    objectId: "e29b6096-6f06-4f14-80c8-aec1c839ee2d",
    description: "Bored Retriever starter state for under-stimulated moments.",
    complete: true,
  },
  hungry: {
    source: require("@/assets/avatar/templates/retriever/emotes/hungry.png"),
    path: "assets/avatar/templates/retriever/emotes/hungry.png",
    style: "pixellab-retriever-emote",
    objectId: "7afaace0-d865-4d94-ba17-b5a2b93a57a1",
    description: "Hungry Retriever starter state with a readable food cue.",
    complete: true,
  },
  anxious: {
    source: require("@/assets/avatar/templates/retriever/emotes/anxious.png"),
    path: "assets/avatar/templates/retriever/emotes/anxious.png",
    style: "pixellab-retriever-emote",
    objectId: "87bda871-3929-4378-ac3f-7ef1d98318d5",
    description: "Anxious Retriever starter state for watchful household moments.",
    complete: true,
  },
  sleepy: {
    source: require("@/assets/avatar/templates/retriever/emotes/sleepy.png"),
    path: "assets/avatar/templates/retriever/emotes/sleepy.png",
    style: "pixellab-retriever-emote",
    objectId: "2be863b6-a1b7-422b-ae26-cd82676cdc38",
    description: "Sleepy Retriever starter state for rest and quiet hours.",
    complete: true,
  },
  proud: {
    source: require("@/assets/avatar/templates/retriever/emotes/proud.png"),
    path: "assets/avatar/templates/retriever/emotes/proud.png",
    style: "pixellab-retriever-emote",
    objectId: "88e6bf65-fc70-4fc8-bc58-d70a0672e671",
    description: "Proud Retriever starter state for training wins and streaks.",
    complete: true,
  },
  home_alone: {
    source: require("@/assets/avatar/templates/retriever/emotes/home-alone.png"),
    path: "assets/avatar/templates/retriever/emotes/home-alone.png",
    style: "pixellab-retriever-emote",
    objectId: "52215717-34b7-4ebf-a354-2c628eb0559d",
    description: "Home-alone Retriever starter state for presence tracking.",
    complete: true,
  },
  not_feeling_well: {
    source: require("@/assets/avatar/templates/retriever/emotes/not-feeling-well.png"),
    path: "assets/avatar/templates/retriever/emotes/not-feeling-well.png",
    style: "pixellab-retriever-emote",
    objectId: "a48f574d-fb49-4198-ad9b-96ac47df7e5f",
    description: "Low-energy Retriever starter state for non-diagnostic health watch moments.",
    complete: true,
  },
};

export const HUSKY_STARTER_EMOTE_ASSETS: Partial<Record<AvatarEmoteState, AvatarEmoteAsset>> = {
  happy: {
    source: require("@/assets/avatar/templates/husky/emotes/happy.png"),
    path: "assets/avatar/templates/husky/emotes/happy.png",
    style: "pixellab-husky-emote",
    objectId: "43274fa6-510c-459c-8aab-7cc5f3a78d59",
    description: "Happy Husky starter state for the first spitz/working-body pack.",
    complete: true,
  },
  calm: {
    source: require("@/assets/avatar/templates/husky/emotes/calm.png"),
    path: "assets/avatar/templates/husky/emotes/calm.png",
    style: "pixellab-husky-emote",
    objectId: "151791e6-2aa1-45e9-9013-a743caa3349b",
    description: "Calm Husky starter state for settled care moments.",
    complete: true,
  },
  excited: {
    source: require("@/assets/avatar/templates/husky/emotes/excited.png"),
    path: "assets/avatar/templates/husky/emotes/excited.png",
    style: "pixellab-husky-emote",
    objectId: "01e04bc6-32b6-44bd-b97d-6201adc728f7",
    description: "Excited Husky starter state for playful care moments.",
    complete: true,
  },
  bored: {
    source: require("@/assets/avatar/templates/husky/emotes/bored.png"),
    path: "assets/avatar/templates/husky/emotes/bored.png",
    style: "pixellab-husky-emote",
    objectId: "a1b97cb6-1302-4dff-9981-4ce9b8550e82",
    description: "Bored Husky starter state for under-stimulated moments.",
    complete: true,
  },
  hungry: {
    source: require("@/assets/avatar/templates/husky/emotes/hungry.png"),
    path: "assets/avatar/templates/husky/emotes/hungry.png",
    style: "pixellab-husky-emote",
    objectId: "8dcfd8f2-d981-45a5-b8fd-a3f1424bdaef",
    description: "Hungry Husky starter state with a readable food cue.",
    complete: true,
  },
  anxious: {
    source: require("@/assets/avatar/templates/husky/emotes/anxious.png"),
    path: "assets/avatar/templates/husky/emotes/anxious.png",
    style: "pixellab-husky-emote",
    objectId: "10ecc873-2e40-413a-b5b7-7bbda2a86a9a",
    description: "Anxious Husky starter state for watchful household moments.",
    complete: true,
  },
  sleepy: {
    source: require("@/assets/avatar/templates/husky/emotes/sleepy.png"),
    path: "assets/avatar/templates/husky/emotes/sleepy.png",
    style: "pixellab-husky-emote",
    objectId: "ed674bb8-5594-4bb0-877b-132c6e1212d0",
    description: "Sleepy Husky starter state for rest and quiet hours.",
    complete: true,
  },
  proud: {
    source: require("@/assets/avatar/templates/husky/emotes/proud.png"),
    path: "assets/avatar/templates/husky/emotes/proud.png",
    style: "pixellab-husky-emote",
    objectId: "74fe802a-6f5a-4e3e-83a0-5e9de5c8f1cb",
    description: "Proud Husky starter state for training wins and streaks.",
    complete: true,
  },
  home_alone: {
    source: require("@/assets/avatar/templates/husky/emotes/home-alone.png"),
    path: "assets/avatar/templates/husky/emotes/home-alone.png",
    style: "pixellab-husky-emote",
    objectId: "aa79bc58-b3e2-4df5-9608-1556794bd5e7",
    description: "Home-alone Husky starter state for presence tracking.",
    complete: true,
  },
  not_feeling_well: {
    source: require("@/assets/avatar/templates/husky/emotes/not-feeling-well.png"),
    path: "assets/avatar/templates/husky/emotes/not-feeling-well.png",
    style: "pixellab-husky-emote",
    objectId: "3af5005a-8a5b-485a-8d3d-caeb67fdd927",
    description: "Low-energy Husky starter state for non-diagnostic health watch moments.",
    complete: true,
  },
};

const PACK_LABELS: Record<AvatarEmotePackId, string> = {
  "starter-care-twin": "Starter",
  "phoenix-shepherd": "Phoenix pack",
  "retriever-starter": "Retriever pack",
  "husky-starter": "Husky pack",
};

export function getPhoenixEmoteAsset(state: AvatarEmoteState): PhoenixEmoteAsset {
  return PHOENIX_EMOTE_ASSETS[state] ?? PHOENIX_EMOTE_ASSETS.happy;
}

export function getAvatarEmotePackLabel(packId: AvatarEmotePackId): string {
  return PACK_LABELS[packId] ?? PACK_LABELS["starter-care-twin"];
}

export function getAvatarEmoteAsset(
  avatar: { templateId: AvatarTemplateId; emotePackId: AvatarEmotePackId },
  state: AvatarEmoteState,
): AvatarEmoteAsset {
  if (avatar.emotePackId === "phoenix-shepherd") {
    return getPhoenixEmoteAsset(state);
  }

  if (avatar.emotePackId === "retriever-starter" && avatar.templateId === "retriever") {
    const retrieverAsset = RETRIEVER_STARTER_EMOTE_ASSETS[state];
    if (retrieverAsset) return retrieverAsset;
  }

  if (avatar.emotePackId === "husky-starter" && avatar.templateId === "husky") {
    const huskyAsset = HUSKY_STARTER_EMOTE_ASSETS[state];
    if (huskyAsset) return huskyAsset;
  }

  const templateAsset = AVATAR_TEMPLATE_BASE_ASSETS[avatar.templateId] ?? AVATAR_TEMPLATE_BASE_ASSETS.mixed;
  const label = state.replace(/_/g, " ");
  return {
    source: getAvatarTemplateDisplaySource(avatar.templateId),
    path: templateAsset.path,
    style: "template-base-emote-fallback",
    description: `Starter ${label} preview uses the selected template base until that emote is generated.`,
    complete: false,
  };
}

export function getCompletedAvatarEmoteCount(packId: AvatarEmotePackId): number {
  if (packId === "phoenix-shepherd") return AVATAR_EMOTE_STATES.length;
  if (packId === "retriever-starter") return Object.keys(RETRIEVER_STARTER_EMOTE_ASSETS).length;
  if (packId === "husky-starter") return Object.keys(HUSKY_STARTER_EMOTE_ASSETS).length;
  return 0;
}

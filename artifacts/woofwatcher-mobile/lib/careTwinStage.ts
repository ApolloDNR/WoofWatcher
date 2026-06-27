import type { AvatarRoomZone, CareTwinSpriteAction } from "./avatarLifeEngine";

export interface CareTwinStageFraming {
  zone: AvatarRoomZone;
  label: string;
  cropRule: string;
  hudClearanceRule: string;
  singleAvatarRule: string;
  mockupAccuracyRule: string;
  phoneQaHint: string;
}

const ACTION_STAGE_ZONE: Partial<Record<CareTwinSpriteAction, AvatarRoomZone>> = {
  "walk-loop": "door",
  "eat-loop": "bowl",
  "drink-loop": "bowl",
  "sleep-loop": "bed",
  "health-watch": "bed",
  "comfort-loop": "window",
};

const STAGE_FRAMING_BY_ZONE: Record<
  AvatarRoomZone,
  {
    label: string;
    cropRule: string;
    phoneQaHint: string;
  }
> = {
  rug: {
    label: "Rug stage framing",
    cropRule: "Keep Phoenix centered on the rug with head, paws, speech bubble, and bottom dock visible.",
    phoneQaHint: "Use a phone screenshot to confirm Phoenix reads as the main subject without clipping the room console.",
  },
  door: {
    label: "Door stage framing",
    cropRule: "Keep Phoenix on the left third near the door with head, paws, speech bubble, and bottom dock visible.",
    phoneQaHint: "Use a phone screenshot to confirm the walk-ready stance stays inside the room crop and away from the paw nav.",
  },
  bowl: {
    label: "Bowl stage framing",
    cropRule: "Keep Phoenix and the bowl readable together with head, paws, speech bubble, and bottom dock visible.",
    phoneQaHint: "Use a phone screenshot to confirm meal or hydration action reads clearly at small size.",
  },
  bed: {
    label: "Bed stage framing",
    cropRule: "Keep Phoenix tucked into the bed zone with head, paws, speech bubble, and bottom dock visible.",
    phoneQaHint: "Use a phone screenshot to confirm sleep or health-watch posture feels calm instead of hidden or cropped.",
  },
  window: {
    label: "Window stage framing",
    cropRule: "Keep Phoenix in the window-watch zone with head, paws, speech bubble, and bottom dock visible.",
    phoneQaHint: "Use a phone screenshot to confirm home-alone or comfort posture is emotionally clear without covering the face.",
  },
};

const HUD_CLEARANCE_RULE =
  "HUD, status meters, speech bubble, and bottom dock must not cover Phoenix's face, paws, or active care prop.";

const SINGLE_AVATAR_RULE =
  "Render the dogless room plus one single live sprite only; reject any baked-in second dog or duplicate avatar layer.";

const MOCKUP_ACCURACY_RULE =
  "Match the Option B hard-pixel neo-retro room: crisp pixel edges, cream HUD surfaces, navy frame, and readable care labels.";

export function zoneForSpriteAction(action: CareTwinSpriteAction, fallback: AvatarRoomZone): AvatarRoomZone {
  return ACTION_STAGE_ZONE[action] ?? fallback;
}

export function getCareTwinStageFraming(
  action: CareTwinSpriteAction,
  fallbackZone: AvatarRoomZone,
): CareTwinStageFraming {
  const zone = zoneForSpriteAction(action, fallbackZone);
  const zoneRule = STAGE_FRAMING_BY_ZONE[zone];

  return {
    zone,
    label: zoneRule.label,
    cropRule: zoneRule.cropRule,
    hudClearanceRule: HUD_CLEARANCE_RULE,
    singleAvatarRule: SINGLE_AVATAR_RULE,
    mockupAccuracyRule: MOCKUP_ACCURACY_RULE,
    phoneQaHint: zoneRule.phoneQaHint,
  };
}

export function describeCareTwinStageFraming(framing: CareTwinStageFraming): string {
  return `Stage framing: ${framing.label} | ${framing.cropRule} | ${framing.hudClearanceRule} | ${framing.singleAvatarRule} | ${framing.phoneQaHint}`;
}

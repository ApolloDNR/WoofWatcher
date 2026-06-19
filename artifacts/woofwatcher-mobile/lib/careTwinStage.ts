import type { AvatarRoomZone, CareTwinSpriteAction } from "./avatarLifeEngine";

const ACTION_STAGE_ZONE: Partial<Record<CareTwinSpriteAction, AvatarRoomZone>> = {
  "walk-loop": "door",
  "eat-loop": "bowl",
  "drink-loop": "bowl",
  "sleep-loop": "bed",
  "health-watch": "bed",
  "comfort-loop": "window",
};

export function zoneForSpriteAction(action: CareTwinSpriteAction, fallback: AvatarRoomZone): AvatarRoomZone {
  return ACTION_STAGE_ZONE[action] ?? fallback;
}

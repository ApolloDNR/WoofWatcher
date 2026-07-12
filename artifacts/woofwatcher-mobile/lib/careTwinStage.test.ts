import { test } from "node:test";
import assert from "node:assert/strict";

import { zoneForSpriteAction } from "./careTwinStage.ts";
import type { AvatarRoomZone, CareTwinSpriteAction } from "./avatarLifeEngine.ts";

test("anchors prop-based sprite actions to the matching room area", () => {
  const cases: Array<[CareTwinSpriteAction, AvatarRoomZone]> = [
    ["walk-loop", "door"],
    ["eat-loop", "bowl"],
    ["drink-loop", "bowl"],
    ["sleep-loop", "bed"],
    ["health-watch", "bed"],
    ["comfort-loop", "window"],
  ];

  for (const [action, zone] of cases) {
    assert.equal(zoneForSpriteAction(action, "rug"), zone);
  }
});

test("preserves plan zones for expressive idle and reward actions", () => {
  const actions: CareTwinSpriteAction[] = [
    "idle-breathe",
    "tail-wag",
    "ear-perk",
    "celebrate-hop",
    "bark-loop",
  ];

  for (const action of actions) {
    assert.equal(zoneForSpriteAction(action, "door"), "door");
    assert.equal(zoneForSpriteAction(action, "rug"), "rug");
  }
});

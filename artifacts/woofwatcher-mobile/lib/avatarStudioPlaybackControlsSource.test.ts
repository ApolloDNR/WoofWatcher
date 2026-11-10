import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("Avatar Studio provides an accessible return from a manual sprite playback to mood preview", () => {
  const source = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "portrait.tsx"),
    "utf8",
  );

  assert.match(source, /const returnToMoodPreview = \(\) => \{[\s\S]*?setPreviewSpriteAction\(null\)/);
  assert.match(source, /accessibilityLabel=\{previewPlayback\.returnAccessibilityLabel \?\? undefined\}/);
  assert.match(source, /\{previewPlayback\.returnLabel\}/);
  assert.match(source, /onPress=\{returnToMoodPreview\}/);
  assert.match(source, /import \{ announce \} from "@\/lib\/announce"/);
  assert.match(
    source,
    /setPreviewSpriteAction\(null\);\s*announce\(previewPlayback\.returnAnnouncement \?\? "Returned to the mood preview\. No avatar changes were saved\."\)/,
  );
  assert.match(
    source,
    /const nextPreviewPlayback = deriveAvatarStudioPreviewPlayback\([\s\S]*?action,[\s\S]*?\);\s*setPreviewSpriteAction\(action\);\s*announce\([\s\S]*?nextPreviewPlayback\.activationAnnouncement/,
  );
  assert.match(
    source,
    /const nextPreviewPlayback = deriveAvatarStudioPreviewPlayback\([\s\S]*?emote,[\s\S]*?null,[\s\S]*?\);\s*setPreviewSpriteAction\(null\);\s*setPreviewEmote\(emote\);\s*announce\([\s\S]*?nextPreviewPlayback\.activationAnnouncement/,
  );
});

import {
  AVATAR_TEMPLATES,
  type AvatarTemplate,
  type AvatarTemplateId,
} from "./avatarStudio.ts";
import {
  AVATAR_TEMPLATE_SPRITE_ASSETS,
  type AvatarTemplateSpriteAction,
  type AvatarTemplateSpritePackItem,
} from "./avatarTemplateSpriteAssets.ts";

export type AvatarSpriteProductionQaReadiness =
  | "ready-for-native-review"
  | "missing-live-pack";

export interface AvatarSpriteProductionQaAction {
  action: AvatarTemplateSpriteAction;
  label: string;
  expectedPath: string;
  frameCount: number;
  fps: number;
  anchor: AvatarTemplateSpritePackItem["track"]["anchor"];
  slotSize: number;
  notes: string;
}

export interface AvatarSpriteProductionQaTemplate {
  templateId: AvatarTemplateId;
  label: string;
  bodyClass: AvatarTemplate["bodyClass"];
  anchorNotes: string;
  readiness: AvatarSpriteProductionQaReadiness;
  spritePackReady: boolean;
  actions: AvatarSpriteProductionQaAction[];
  requiredChecks: string[];
  nativeReviewPrompt: string;
}

export interface AvatarSpriteProductionQaSummary {
  totalTemplates: number;
  liveTemplatePacks: number;
  totalSpriteSlots: number;
  missingTemplatePacks: string[];
  templates: AvatarSpriteProductionQaTemplate[];
  requiredChecks: string[];
  nativeBoundary: string;
  launchRisk: string;
}

export interface AvatarSpriteProductionTemplateReview {
  template: AvatarSpriteProductionQaTemplate;
  headline: string;
  actionSummary: string;
  proofStatusLabel: string;
  gameFeelChecks: string[];
  nativeProofStatus: string;
}

const SPRITE_ACTION_ORDER: AvatarTemplateSpriteAction[] = ["idle-tail-wag", "walk-loop"];

export const AVATAR_SPRITE_PRODUCTION_REQUIRED_CHECKS = [
  "Confirm the dog is a crisp hard-pixel sprite, not a softened portrait or scaled screenshot.",
  "Confirm exactly one dog is visible; no duplicate sprite, second avatar, or dog baked into the room art.",
  "Confirm the bottom-center anchor keeps paws, shadow, tail, ears, and accessory overlays inside the phone crop.",
  "Confirm the idle loop reads as breathing or tail-wag motion without frame jitter, scale jump, or identity drift.",
  "Confirm the walk gait feels like a video-game loop: stable paws, clear silhouette, no sliding, no clipped stride.",
  "Confirm collar, bandana, hat, mask, vest, room, and FX overlays do not cover the face or fight the live sprite.",
  "Attach iOS and Android screenshots before calling any template proof-backed for launch or store capture.",
] as const;

function actionForSpritePack(
  item: AvatarTemplateSpritePackItem,
): AvatarSpriteProductionQaAction {
  return {
    action: item.action,
    label: item.label,
    expectedPath: item.track.requiredAsset,
    frameCount: item.track.frameCount,
    fps: item.track.fps,
    anchor: item.track.anchor,
    slotSize: item.track.slotSize,
    notes: item.track.notes,
  };
}

function actionsForTemplate(templateId: AvatarTemplateId): AvatarSpriteProductionQaAction[] {
  const pack = AVATAR_TEMPLATE_SPRITE_ASSETS[templateId] ?? {};
  return SPRITE_ACTION_ORDER.flatMap((action) => {
    const item = pack[action];
    return item ? [actionForSpritePack(item)] : [];
  });
}

function buildTemplateQa(template: AvatarTemplate): AvatarSpriteProductionQaTemplate {
  const actions = actionsForTemplate(template.id);
  const spritePackReady = SPRITE_ACTION_ORDER.every((action) =>
    Boolean(AVATAR_TEMPLATE_SPRITE_ASSETS[template.id]?.[action]),
  );

  return {
    templateId: template.id,
    label: template.label,
    bodyClass: template.bodyClass,
    anchorNotes: template.anchorNotes,
    readiness: spritePackReady ? "ready-for-native-review" : "missing-live-pack",
    spritePackReady,
    actions,
    requiredChecks: [...AVATAR_SPRITE_PRODUCTION_REQUIRED_CHECKS],
    nativeReviewPrompt: spritePackReady
      ? `${template.label} has a registered idle and walk sprite pack. Review crop, gait, anchor, and overlay fit on iOS and Android before launch approval.`
      : `${template.label} is missing a complete idle and walk sprite pack. Keep it out of launch-store claims until the PixelLab pack is produced and reviewed.`,
  };
}

export function buildAvatarSpriteProductionQaSummary(): AvatarSpriteProductionQaSummary {
  const templates = AVATAR_TEMPLATES.map(buildTemplateQa);
  const liveTemplatePacks = templates.filter((template) => template.spritePackReady).length;

  return {
    totalTemplates: templates.length,
    liveTemplatePacks,
    totalSpriteSlots: templates.reduce((total, template) => total + template.actions.length, 0),
    missingTemplatePacks: templates
      .filter((template) => !template.spritePackReady)
      .map((template) => template.label),
    templates,
    requiredChecks: [...AVATAR_SPRITE_PRODUCTION_REQUIRED_CHECKS],
    nativeBoundary:
      "Local sprite metadata only. iOS and Android screenshots plus human gait/crop review are still required before native QA, store screenshots, or public launch approval.",
    launchRisk:
      "If sprite gait, phone-size crop, duplicate-avatar behavior, or overlay fit is not reviewed on real devices, the care twin can feel less like a premium video-game avatar and more like a pasted prototype.",
  };
}

export function buildAvatarSpriteProductionTemplateReview(
  templateId: AvatarTemplateId,
): AvatarSpriteProductionTemplateReview {
  const summary = buildAvatarSpriteProductionQaSummary();
  const template = summary.templates.find((item) => item.templateId === templateId);
  if (!template) {
    throw new Error(`Unknown avatar template for production QA: ${templateId}`);
  }

  return {
    template,
    headline: `${template.label}: ${template.actions.length}/${SPRITE_ACTION_ORDER.length} animations live`,
    actionSummary: template.actions
      .map((action) => `${action.label}: ${action.frameCount} frames at ${action.fps} fps`)
      .join("; "),
    proofStatusLabel: template.spritePackReady
      ? "Ready for native review"
      : "Sprite pack missing",
    gameFeelChecks: summary.requiredChecks.slice(0, 4),
    nativeProofStatus: summary.nativeBoundary,
  };
}

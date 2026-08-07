import {
  getAvatarTemplate,
  type AvatarTemplateId,
  type PetAvatarConfig,
} from "./avatarStudio.ts";
import { resolvePetName } from "./petIdentity.ts";

/**
 * Maps free-text breed input ("Dachshund", "golden mix", "GSD") to the
 * nearest of the 12 Avatar Studio template ids so the pixel care twin can
 * follow the Setup dog profile instead of always staying the default
 * shepherd.
 *
 * Matching is a first-match-wins ordered keyword table. Order matters:
 * - dachshund/doodle run before retriever and shepherd so "labradoodle" and
 *   "sheepadoodle" land on doodle, not on their parent-breed keywords.
 * - slender (sighthounds) runs before hound so "greyhound", "deerhound",
 *   and "wolfhound" are not captured by the generic "hound" keyword.
 * - bully runs before terrier so "staffordshire terrier", "bull terrier",
 *   and "boston terrier" land on the compact bully body.
 * - "pit" uses a word boundary so "spitz" never trips the bully rule.
 * Anything unmatched falls back to the neutral "mixed" template.
 */

export interface BreedTemplateMatch {
  templateId: AvatarTemplateId;
  /** Human label from the Avatar Studio template catalog, e.g. "Dachshund". */
  templateLabel: string;
  /** The keyword that decided the match, or null on the mixed fallback. */
  matchedKeyword: string | null;
  source: "keyword" | "fallback";
}

interface BreedTemplateRule {
  templateId: AvatarTemplateId;
  pattern: RegExp;
}

// First match wins; see ordering notes above.
const BREED_TEMPLATE_RULES: readonly BreedTemplateRule[] = [
  {
    templateId: "dachshund",
    pattern: /dachshund|doxie|wiener|weiner|sausage dog|teckel/,
  },
  {
    templateId: "doodle",
    pattern: /doodle|poodle|cockapoo|maltipoo|cavapoo/,
  },
  {
    templateId: "husky",
    pattern: /husky|malamute|spitz|samoyed|akita|shiba|eskimo/,
  },
  {
    templateId: "shepherd",
    pattern:
      /german shepherd|\bgsd\b|alsatian|shepherd|malinois|sheepdog|collie|heeler|cattle dog/,
  },
  {
    templateId: "retriever",
    pattern: /retriever|golden|labrador|goldador|\blab\b/,
  },
  {
    templateId: "slender",
    pattern:
      /greyhound|whippet|saluki|borzoi|sighthound|deerhound|wolfhound|lurcher|vizsla|weimaraner|pointer|dalmatian|doberman|great dane/,
  },
  {
    templateId: "hound",
    pattern: /beagle|basset|bloodhound|coonhound|foxhound|harrier|hound/,
  },
  {
    templateId: "bully",
    pattern:
      /pit ?bull|pittie|\bpit\b|bulldog|bully|staffy|staffordshire|amstaff|frenchie|boston|boxer|mastiff|cane corso|rottweiler|rottie|\bpug\b|bull terrier/,
  },
  {
    templateId: "terrier",
    pattern:
      /terrier|yorkie|yorkshire|schnauzer|westie|scottie|jack russell|airedale|cairn/,
  },
  {
    templateId: "spaniel",
    pattern: /spaniel|cocker|cavalier|springer|brittany|setter/,
  },
  {
    templateId: "toy",
    pattern:
      /chihuahua|pomeranian|\bpom\b|maltese|shih ?tzu|papillon|pekingese|havanese|bichon|lhasa|\btoy\b|teacup/,
  },
  {
    templateId: "mixed",
    pattern: /\bmix(?:ed)?\b|mutt|rescue|unknown/,
  },
];

function normalizeBreedText(breed: string): string {
  return String(breed ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchBreedToTemplate(breed: string): BreedTemplateMatch {
  const normalized = normalizeBreedText(breed);

  if (normalized) {
    for (const rule of BREED_TEMPLATE_RULES) {
      const matched = normalized.match(rule.pattern)?.[0];
      if (matched) {
        return {
          templateId: rule.templateId,
          templateLabel: getAvatarTemplate(rule.templateId).label,
          matchedKeyword: matched.trim(),
          source: "keyword",
        };
      }
    }
  }

  return {
    templateId: "mixed",
    templateLabel: getAvatarTemplate("mixed").label,
    matchedKeyword: null,
    source: "fallback",
  };
}

/**
 * Decides whether Setup may swap the avatar template for the typed breed,
 * and produces the honest copy for the twin preview line and success moment.
 *
 * Safety rules, in order:
 * 1. If the owner already customized the twin in Avatar Studio
 *    (hasConfiguredAvatar - scan-assisted, non-default template, or any
 *    non-default collar/marking/coat), Setup NEVER overrides that choice.
 * 2. hasConfiguredAvatar cannot distinguish "never opened Avatar Studio"
 *    from "opened it and deliberately re-saved the default shepherd", so
 *    the swap is also gated behind an explicit matchTwinToBreed confirm
 *    toggle in the save flow that defaults ON.
 * 3. A blank breed teaches us nothing, so it never swaps (even though the
 *    matcher itself falls back to "mixed" for unrecognized text).
 */
export interface SetupTwinPlanInput {
  breed: string;
  dogName: string;
  currentTemplateId: AvatarTemplateId;
  hasConfiguredAvatar: boolean;
  matchTwinToBreed: boolean;
}

export interface SetupTwinPlan {
  /** Match for the typed breed, or null when the breed field is blank. */
  match: BreedTemplateMatch | null;
  /** True when a breed-driven swap is possible (before the toggle gate). */
  swapAvailable: boolean;
  /** True when saving Setup should actually apply the matched template. */
  willSwapTemplate: boolean;
  /** Template that will be live after save (matched or kept current). */
  resultTemplateId: AvatarTemplateId;
  resultTemplateLabel: string;
  /** Small always-visible line under the breed field, never a surprise. */
  previewLine: string;
  /** Celebration line for the save success moment. */
  successLine: string;
}

export function deriveSetupTwinPlan(input: SetupTwinPlanInput): SetupTwinPlan {
  const currentLabel = getAvatarTemplate(input.currentTemplateId).label;
  const breedText = normalizeBreedText(input.breed);
  const match = breedText ? matchBreedToTemplate(input.breed) : null;
  const dogName = resolvePetName(input.dogName);

  const swapAvailable =
    !input.hasConfiguredAvatar &&
    match !== null &&
    match.templateId !== input.currentTemplateId;
  const willSwapTemplate = swapAvailable && input.matchTwinToBreed;

  const resultTemplateId = willSwapTemplate
    ? match!.templateId
    : input.currentTemplateId;
  const resultTemplateLabel = willSwapTemplate ? match!.templateLabel : currentLabel;

  const previewLine = input.hasConfiguredAvatar
    ? `Twin: ${currentLabel} - your Avatar Studio pick stays.`
    : willSwapTemplate
      ? `Twin: ${match!.templateLabel} - change anytime in Avatar Studio.`
      : `Twin: ${currentLabel} - change in Avatar Studio.`;

  const successLine = `${dogName}'s twin is ready - a ${resultTemplateLabel}.`;

  return {
    match,
    swapAvailable,
    willSwapTemplate,
    resultTemplateId,
    resultTemplateLabel,
    previewLine,
    successLine,
  };
}

/**
 * Applies a matched template to an avatar config with the exact same patch
 * Avatar Studio's template picker applies when the owner taps a template
 * (templateId plus that template's default ears, muzzle, and emote pack;
 * everything else - coat, collar, markings, accessories - is preserved).
 * Persist the result through AvatarContext.saveAvatarConfig, the same
 * state path portrait.tsx uses, so normalization and storage stay shared.
 */
export function applyBreedTemplateToAvatarConfig(
  config: PetAvatarConfig,
  templateId: AvatarTemplateId,
  petName: string,
): PetAvatarConfig {
  const template = getAvatarTemplate(templateId);
  return {
    ...config,
    petName: resolvePetName(petName, config.petName),
    templateId: template.id,
    earTypeId: template.defaultEarTypeId,
    muzzleTypeId: template.defaultMuzzleTypeId,
    emotePackId: template.recommendedEmotePackId,
  };
}

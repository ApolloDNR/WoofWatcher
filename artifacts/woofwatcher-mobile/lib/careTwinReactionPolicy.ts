import {
  normalizeCareEventType,
  type CareEventDetails,
  type CareEventType,
} from "../../../lib/care-domain/src/index.ts";

import type { CareTwinSpriteAction } from "./avatarLifeEngine.ts";
import {
  buildPetPossessiveName,
  resolveConsumerPetName,
} from "./petIdentity.ts";

export type CareTwinReactionToneRole = "care" | "reward" | "hydration" | "health" | "soft";

export type CareTwinReactionIcon =
  | "meal"
  | "walk"
  | "pee"
  | "bile"
  | "training"
  | "treat"
  | "play"
  | "medication"
  | "health"
  | "heart"
  | "note";

export interface CareTwinLogReactionInput {
  type: CareEventType | string;
  label: string;
  title?: string | null;
  mood?: string | null;
  severity?: string | null;
  petName?: string | null;
  details?: CareEventDetails | Record<string, unknown> | null;
}

export interface CareTwinLogReactionPlan {
  icon: CareTwinReactionIcon;
  label: string;
  detail: string;
  spriteAction: CareTwinSpriteAction;
  toneRole: CareTwinReactionToneRole;
}

function detailValue(details: CareTwinLogReactionInput["details"], key: string): unknown {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  return (details as Record<string, unknown>)[key];
}

function isPendingMeal(details: CareTwinLogReactionInput["details"]): boolean {
  const lifecycle = String(detailValue(details, "mealLifecycle") ?? "");
  const completion = String(detailValue(details, "mealCompletion") ?? "");
  return lifecycle === "outcome-pending" || completion === "served" || completion === "grazing";
}

export function describeCareTwinReactionForLog(input: CareTwinLogReactionInput): CareTwinLogReactionPlan {
  const type = normalizeCareEventType(input.type, input.details as CareEventDetails);
  const petName = resolveConsumerPetName(input.petName);
  const sentencePetName = petName.charAt(0).toUpperCase() + petName.slice(1);
  const possessivePetName = buildPetPossessiveName(input.petName);

  if (type === "meal") {
    return {
      icon: "meal",
      label: isPendingMeal(input.details) ? "Meal served" : "Meal logged",
      detail: isPendingMeal(input.details)
        ? petName === "your dog"
          ? "Outcome stays open so the household can update what your dog actually ate."
          : `Outcome stays open so the household can update what ${petName} actually ate.`
        : "Diet progress and the household timeline stay connected.",
      spriteAction: "eat-loop",
      toneRole: "care",
    };
  }

  if (type === "walk") {
    const started = detailValue(input.details, "walkStartedAt");
    return {
      icon: "walk",
      label: started ? "Walk started" : "Walk logged",
      detail: started
        ? `${sentencePetName} walks in the room; finish in Log with route, distance, and social notes.`
        : "Activity progress updates without spawning a second avatar.",
      spriteAction: "walk-loop",
      toneRole: "reward",
    };
  }

  if (type === "water") {
    return {
      icon: "bile",
      label: "Water refreshed",
      detail: "Hydration updates the shared care record.",
      spriteAction: "drink-loop",
      toneRole: "hydration",
    };
  }

  if (type === "potty") {
    return {
      icon: "pee",
      label: "Potty noted",
      detail: "Bathroom attempt logged without pretending pee or poop happened.",
      spriteAction: "ear-perk",
      toneRole: "care",
    };
  }

  if (type === "training") {
    return {
      icon: "training",
      label: "Training win",
      detail: `A real practice moment adds progress to ${possessivePetName} story.`,
      spriteAction: "celebrate-hop",
      toneRole: "reward",
    };
  }

  if (type === "treat") {
    return {
      icon: "treat",
      label: "Treat logged",
      detail: "Tiny celebration, still tied to the real care timeline.",
      spriteAction: "celebrate-hop",
      toneRole: "reward",
    };
  }

  if (type === "play") {
    return {
      icon: "play",
      label: "Play logged",
      detail: `Bond and energy context update on ${possessivePetName} care twin.`,
      spriteAction: "tail-wag",
      toneRole: "reward",
    };
  }

  if (type === "medication") {
    return {
      icon: "medication",
      label: "Medication logged",
      detail: "Medication context stays reviewable for the household.",
      spriteAction: "comfort-loop",
      toneRole: "health",
    };
  }

  if (type === "vomit" || type === "symptom") {
    return {
      icon: "health",
      label: "Health Watch updated",
      detail: "Health Watch records the pattern calmly for owner or vet review.",
      spriteAction: "health-watch",
      toneRole: "health",
    };
  }

  if (type === "incident") {
    return {
      icon: "health",
      label: "Incident noted",
      detail: "Safety context is saved for owner, trainer, or vet review.",
      spriteAction: "comfort-loop",
      toneRole: "health",
    };
  }

  if (type === "mood") {
    const mood = String(input.mood ?? input.title ?? input.label).toLowerCase();
    const needsComfort = mood.includes("anx") || mood.includes("rough") || mood.includes("sad") || mood.includes("unwell");
    return {
      icon: needsComfort ? "heart" : "play",
      label: needsComfort ? "Mood check-in" : "Mood logged",
      detail: needsComfort
        ? `${sentencePetName} stays gentle while the household gets context.`
        : `Mood context updates ${possessivePetName} care twin.`,
      spriteAction: needsComfort ? "comfort-loop" : "tail-wag",
      toneRole: needsComfort ? "soft" : "reward",
    };
  }

  return {
    icon: "note",
    label: `${input.label} logged`,
    detail: `Care context updates ${possessivePetName} room.`,
    spriteAction: "tail-wag",
    toneRole: input.severity === "alert" ? "health" : "soft",
  };
}

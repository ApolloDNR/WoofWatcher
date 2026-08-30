import type {
  GenerationPermit,
  GenerationPermitAuthority,
} from "./generationPermit.ts";

const localDataIntentBrand: unique symbol = Symbol("local-data-intent-brand");

export interface LocalDataIntent {
  readonly [localDataIntentBrand]: true;
}

export interface LocalDataIntentAuthority {
  capture(): LocalDataIntent | null;
  isCurrent(intent: LocalDataIntent): boolean;
}

export type LocalDataIntentInteractionResult<T> =
  | { status: "complete"; intent: LocalDataIntent; value: T }
  | { status: "revoked" };

export function createLocalDataIntentAuthority(input: {
  generationAuthority: GenerationPermitAuthority;
  isAdmissionOpen(): boolean;
}): LocalDataIntentAuthority {
  const permitsByIntent = new WeakMap<object, GenerationPermit>();

  const authority: LocalDataIntentAuthority = {
    capture() {
      if (!input.isAdmissionOpen()) return null;
      const permit = input.generationAuthority.capture();
      if (
        !input.isAdmissionOpen() ||
        !input.generationAuthority.isValid(permit)
      ) {
        return null;
      }
      const intent = Object.freeze({}) as LocalDataIntent;
      permitsByIntent.set(intent, permit);
      return intent;
    },
    isCurrent(intent) {
      if (
        typeof intent !== "object" ||
        intent === null ||
        !input.isAdmissionOpen()
      ) {
        return false;
      }
      const permit = permitsByIntent.get(intent as object);
      return permit !== undefined && input.generationAuthority.isValid(permit);
    },
  };

  return Object.freeze(authority);
}

export async function runWithLocalDataIntent<T>(
  authority: LocalDataIntentAuthority,
  interact: () => Promise<T>,
): Promise<LocalDataIntentInteractionResult<T>> {
  const intent = authority.capture();
  if (!intent) return { status: "revoked" };

  const value = await interact();
  if (!authority.isCurrent(intent)) return { status: "revoked" };
  return { status: "complete", intent, value };
}

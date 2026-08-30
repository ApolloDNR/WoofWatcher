const generationPermitBrand: unique symbol = Symbol("generation-permit-brand");

export interface GenerationPermit {
  readonly [generationPermitBrand]: true;
}

export interface GenerationPermitAuthority {
  capture(): GenerationPermit;
  isValid(permit: GenerationPermit): boolean;
  invalidate(): void;
}

export function createGenerationPermitAuthority(): GenerationPermitAuthority {
  let generation = 0;
  const issuedPermits = new WeakMap<object, number>();

  return {
    capture() {
      const permit = Object.freeze({}) as GenerationPermit;
      issuedPermits.set(permit, generation);
      return permit;
    },
    isValid(permit) {
      return (
        typeof permit === "object" &&
        permit !== null &&
        issuedPermits.get(permit as object) === generation
      );
    },
    invalidate() {
      generation += 1;
    },
  };
}

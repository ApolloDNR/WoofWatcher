export const PRODUCTION_CAPABILITY_SOURCE =
  "artifacts/woofwatcher-mobile/eas.json#build.production.env";

export const STORE_CAPABILITY_ENV = Object.freeze({
  pushTokenRegistration: "EXPO_PUBLIC_STORE_PUSH_TOKEN_REGISTRATION",
  cloudDocumentUpload: "EXPO_PUBLIC_STORE_CLOUD_DOCUMENT_UPLOAD",
});

const CAPABILITY_STATES = new Set(["disabled", "enabled"]);

export function validateProductionPrivacyCapabilities({ eas, metadata }) {
  const issues = [];
  const privacy = metadata?.privacy;
  const productionEnv = eas?.build?.production?.env;

  if (privacy?.productionCapabilitySource !== PRODUCTION_CAPABILITY_SOURCE) {
    issues.push(
      `Privacy metadata must reference ${PRODUCTION_CAPABILITY_SOURCE} as its production capability source`,
    );
  }

  if (productionEnv?.EXPO_PUBLIC_BUILD_PROFILE !== "production") {
    issues.push("EAS production capability declarations require the explicit production build profile");
  }

  for (const [label, envName] of Object.entries(STORE_CAPABILITY_ENV)) {
    const state = productionEnv?.[envName];
    if (!CAPABILITY_STATES.has(state)) {
      issues.push(`${envName} must be declared as enabled or disabled; got ${String(state)}`);
      continue;
    }
    if (privacy?.nutritionLabel === "DATA_NOT_COLLECTED" && state !== "disabled") {
      issues.push(
        `DATA_NOT_COLLECTED is invalid while production ${label} is ${state} (${envName})`,
      );
    }
  }

  return issues;
}

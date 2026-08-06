export type PrimaryTab = "home" | "log" | "plans" | "health" | "more";

export type HealthSection =
  | "overview"
  | "health-watch"
  | "bile-watch"
  | "medications"
  | "diet"
  | "trends"
  | "records"
  | "dog-id"
  | "care-pass";

export type MoreSection =
  | "root"
  | "dog-profile"
  | "avatar-studio"
  | "care-team"
  | "care-team-supplies"
  | "story-progress"
  | "adventure"
  | "woofguide"
  | "settings"
  | "privacy"
  | "legal";

export interface CanonicalDestination {
  parent: PrimaryTab;
  pathname: "/" | "/log" | "/calendar" | "/health" | "/more" | "/fastlog";
  params?: Readonly<Record<string, string>>;
  replace: boolean;
}

type IncomingParams = Readonly<Record<string, string | string[] | undefined>>;
type DestinationPathname = CanonicalDestination["pathname"];

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const NON_PRINTABLE_PROMPT_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
const NON_PRINTABLE_JOIN_NEIGHBOR_PATTERN = /[\p{C}\s]/u;
const CONTEXTUAL_JOIN_CONTROLS = new Set(["\u200c", "\u200d"]);

const HEALTH_SECTIONS = new Set<HealthSection>([
  "overview",
  "health-watch",
  "bile-watch",
  "medications",
  "diet",
  "trends",
  "records",
  "dog-id",
  "care-pass",
]);

const MORE_SECTIONS = new Set<MoreSection>([
  "root",
  "dog-profile",
  "avatar-studio",
  "care-team",
  "care-team-supplies",
  "story-progress",
  "adventure",
  "woofguide",
  "settings",
  "privacy",
  "legal",
]);

const PRIMARY_PATHS: Readonly<
  Record<
    string,
    Readonly<{ parent: PrimaryTab; pathname: DestinationPathname }>
  >
> = {
  "/": { parent: "home", pathname: "/" },
  "/log": { parent: "log", pathname: "/log" },
  "/fastlog": { parent: "log", pathname: "/fastlog" },
  "/calendar": { parent: "plans", pathname: "/calendar" },
};

const LEGACY_HEALTH_TABS: Readonly<Record<string, HealthSection>> = {
  health: "overview",
  bile: "bile-watch",
};

type LegacyMoreSectionDestination =
  | Readonly<{ parent: "health"; section: HealthSection }>
  | Readonly<{
      parent: "more";
      section: Exclude<MoreSection, "root">;
    }>;

const LEGACY_MORE_SECTIONS: Readonly<
  Record<string, LegacyMoreSectionDestination>
> = {
  diet: { parent: "health", section: "diet" },
  "care-pass": { parent: "health", section: "care-pass" },
  carepass: { parent: "health", section: "care-pass" },
  household: { parent: "more", section: "care-team" },
  access: { parent: "more", section: "care-team" },
  career: { parent: "more", section: "story-progress" },
};

const LEGACY_MORE_PATHS: Readonly<
  Record<string, Exclude<MoreSection, "root">>
> = {
  "/profile": "dog-profile",
  "/portrait": "avatar-studio",
  "/adventure": "adventure",
  "/privacy": "privacy",
};

function ownValue<T>(
  record: Readonly<Record<string, T>>,
  key: string,
): T | undefined {
  return Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined;
}

function ownScalarParam(
  params: IncomingParams | undefined,
  key: string,
): string | undefined {
  if (!params || !Object.prototype.hasOwnProperty.call(params, key)) {
    return undefined;
  }

  const value: unknown = params[key];
  if (typeof value === "string") return value;
  if (
    Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, 0) &&
    typeof value[0] === "string"
  ) {
    return value[0];
  }
  return undefined;
}

function isPrintablePrompt(prompt: string): boolean {
  const codePoints = [...prompt];
  if (codePoints.length === 0 || codePoints.length > 280) return false;

  for (let index = 0; index < codePoints.length; index += 1) {
    const codePoint = codePoints[index];
    if (CONTEXTUAL_JOIN_CONTROLS.has(codePoint)) {
      const previous = codePoints[index - 1];
      const next = codePoints[index + 1];
      if (
        !previous ||
        !next ||
        NON_PRINTABLE_JOIN_NEIGHBOR_PATTERN.test(previous) ||
        NON_PRINTABLE_JOIN_NEIGHBOR_PATTERN.test(next)
      ) {
        return false;
      }
      continue;
    }

    if (NON_PRINTABLE_PROMPT_PATTERN.test(codePoint)) return false;
  }

  return true;
}

function isHealthSection(value: string): value is HealthSection {
  return HEALTH_SECTIONS.has(value as HealthSection);
}

function isMoreSection(value: string): value is MoreSection {
  return MORE_SECTIONS.has(value as MoreSection);
}

function validatedIdentifier(
  params: IncomingParams | undefined,
  key: string,
): string | undefined {
  const value = ownScalarParam(params, key);
  return value && IDENTIFIER_PATTERN.test(value) ? value : undefined;
}

function validatedIdentifiers(
  params: IncomingParams | undefined,
  keys: readonly string[],
): Record<string, string> {
  const validated: Record<string, string> = {};
  for (const key of keys) {
    const value = validatedIdentifier(params, key);
    if (value) validated[key] = value;
  }
  return validated;
}

function destination(
  parent: PrimaryTab,
  pathname: DestinationPathname,
  replace: boolean,
  params?: Readonly<Record<string, string>>,
): CanonicalDestination {
  if (params && Object.keys(params).length > 0) {
    return { parent, pathname, params, replace };
  }
  return { parent, pathname, replace };
}

function healthSectionDestination(
  section: HealthSection,
  replace: boolean,
  params?: Readonly<Record<string, string>>,
): CanonicalDestination {
  return destination("health", "/health", replace, { section, ...params });
}

function moreSectionDestination(
  section: Exclude<MoreSection, "root">,
  replace: boolean,
  params?: Readonly<Record<string, string>>,
): CanonicalDestination {
  return destination("more", "/more", replace, { section, ...params });
}

function resolveHealth(
  params: IncomingParams | undefined,
): CanonicalDestination {
  const section = ownScalarParam(params, "section");
  if (section !== undefined) {
    return isHealthSection(section)
      ? healthSectionDestination(section, false)
      : destination("health", "/health", true);
  }

  const legacyTab = ownScalarParam(params, "tab");
  if (legacyTab !== undefined) {
    const mapped = ownValue(LEGACY_HEALTH_TABS, legacyTab);
    return mapped
      ? healthSectionDestination(mapped, true)
      : destination("health", "/health", true);
  }

  return destination("health", "/health", false);
}

function resolveMore(params: IncomingParams | undefined): CanonicalDestination {
  const section = ownScalarParam(params, "section");
  if (section === undefined) return destination("more", "/more", false);

  if (isMoreSection(section)) {
    return section === "root"
      ? destination("more", "/more", false)
      : moreSectionDestination(section, false);
  }

  const legacy = ownValue(LEGACY_MORE_SECTIONS, section);
  if (!legacy) return destination("more", "/more", true);
  return legacy.parent === "health"
    ? healthSectionDestination(legacy.section, true)
    : moreSectionDestination(legacy.section, true);
}

export function resolveCanonicalDestination(input: {
  pathname: string;
  params?: IncomingParams;
}): CanonicalDestination {
  const primary = ownValue(PRIMARY_PATHS, input.pathname);
  if (primary) return destination(primary.parent, primary.pathname, false);

  if (input.pathname === "/health") return resolveHealth(input.params);
  if (input.pathname === "/more") return resolveMore(input.params);

  if (input.pathname === "/reminders") {
    return destination(
      "plans",
      "/calendar",
      true,
      validatedIdentifiers(input.params, ["item"]),
    );
  }

  if (input.pathname === "/records") {
    return healthSectionDestination(
      "records",
      true,
      validatedIdentifiers(input.params, ["entry", "report"]),
    );
  }

  if (input.pathname === "/pack") {
    return moreSectionDestination(
      "care-team-supplies",
      true,
      validatedIdentifiers(input.params, ["item"]),
    );
  }

  if (input.pathname === "/story") {
    return moreSectionDestination(
      "story-progress",
      true,
      validatedIdentifiers(input.params, ["entry", "walk"]),
    );
  }

  if (input.pathname === "/woofguide") {
    const prompt = ownScalarParam(input.params, "prompt");
    const validatedPrompt =
      prompt && isPrintablePrompt(prompt) ? { prompt } : undefined;
    return moreSectionDestination("woofguide", true, validatedPrompt);
  }

  if (input.pathname === "/legal") {
    const doc = ownScalarParam(input.params, "doc");
    const validatedDoc =
      doc === "privacy" || doc === "terms" ? { doc } : undefined;
    return moreSectionDestination("legal", true, validatedDoc);
  }

  const legacyMoreSection = ownValue(LEGACY_MORE_PATHS, input.pathname);
  if (legacyMoreSection) {
    return moreSectionDestination(legacyMoreSection, true);
  }

  return destination("home", "/", true);
}

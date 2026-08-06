import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = existsSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile"),
)
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();
const COMPONENT_PATH = join(
  MOBILE_ROOT,
  "components",
  "more",
  "DogProfileScreen.tsx",
);
const PROFILE_ROUTE_PATH = join(MOBILE_ROOT, "app", "profile.tsx");
const MORE_PATH = join(MOBILE_ROOT, "app", "(tabs)", "more.tsx");

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function callCount(source: string, name: string): number {
  return source.match(new RegExp(`\\b${name}\\(`, "g"))?.length ?? 0;
}

test("moves Dog Profile into one dual-surface owner with the required parent seams", () => {
  assert.equal(
    existsSync(COMPONENT_PATH),
    true,
    "DogProfileScreen.tsx must exist before the compatibility route delegates",
  );
  const component = read(COMPONENT_PATH);

  assert.match(component, /export interface DogProfileScreenProps\s*\{/);
  assert.match(component, /surface:\s*"standalone"\s*\|\s*"tabbed"/);
  assert.match(component, /onBack:\s*\(\)\s*=>\s*void/);
  assert.match(component, /onOpenAvatarStudio:\s*\(\)\s*=>\s*void/);
  assert.match(
    component,
    /export default function DogProfileScreen\(\{\s*surface,\s*onBack,\s*onOpenAvatarStudio,?\s*\}:\s*DogProfileScreenProps\)/,
  );
  assert.match(component, /HERO_PARK_DAY/);
  assert.match(component, /HERO_PARK_NIGHT/);
  assert.match(component, /const AVATAR_SIZE = 112/);
  assert.equal(component.match(/<LinearGradient\b/g)?.length ?? 0, 2);
  assert.match(component, /function useBreath\(\)/);
  assert.match(component, /cancelAnimation\(breath\)/);
  assert.match(component, /derivePhoenixStatus/);
  assert.match(component, /resolvePetName/);
  assert.match(component, /getAvatarSource\(status\.mood\)/);
  assert.match(component, /getRouteTopPadding/);
  assert.match(component, /getStandaloneRouteBottomPadding/);
  assert.match(component, /getTabbedRouteBottomPadding/);
  assert.match(component, /surface,?\s*\}/);
  assert.doesNotMatch(component, /useLocalSearchParams|router\.(?:push|replace)|"\/setup"|"\/profile"|"\/portrait"/);
});

test("owns one guarded, accepted profile write including care focus and background", () => {
  const component = read(COMPONENT_PATH);

  for (const anchor of [
    "careMutationsBlocked",
    "validateProfileWeightDraft",
    "CARE_READ_ONLY_MESSAGE",
    "updateCareDoc",
    "runAcceptedCareMutation",
  ]) {
    assert.match(component, new RegExp(`\\b${anchor}\\b`), `${anchor} must move with the editor`);
  }
  assert.equal(callCount(component, "updateCareDoc"), 1);
  assert.equal(callCount(component, "runAcceptedCareMutation"), 1);

  const validation = component.indexOf("validateProfileWeightDraft(pWeight)");
  const guard = component.indexOf("if (careMutationsBlocked)", validation);
  const write = component.indexOf("updateCareDoc((doc)", guard);
  const accepted = component.indexOf("runAcceptedCareMutation(updated", write);
  assert.ok(validation >= 0 && guard > validation && write > guard && accepted > write);
  const acceptedCallback = component.slice(accepted, accepted + 500);
  assert.match(acceptedCallback, /Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)/);
  assert.match(acceptedCallback, /setProfileOpen\(false\)/);
  assert.match(component, /if \(!accepted\) showCareReadOnly\(\)/);

  for (const stateName of [
    "pName",
    "pBreed",
    "pWeight",
    "pWeightError",
    "pWeightUnit",
    "pFocus",
    "pBackground",
    "pMicrochip",
    "pPrimaryVet",
    "pEmergencyContact",
    "pInsuranceProvider",
    "pInsurancePolicy",
    "profileOpen",
  ]) {
    assert.match(component, new RegExp(`\\b${stateName}\\b`), `${stateName} must be component-owned`);
  }
  assert.match(component, /const name = pName\.trim\(\) \|\| "Phoenix"/);
  assert.match(component, /\.\.\.doc\.profile/);
  assert.match(component, /\.\.\.doc\.profile\.weight/);
  assert.match(component, /publicLabel:\s*name/);
  assert.match(component, /breed:\s*pBreed\.trim\(\)/);
  assert.match(component, /careFocus:\s*pFocus\.trim\(\)/);
  assert.match(component, /background:\s*pBackground\.trim\(\)/);
  assert.match(component, /microchipNumber:\s*pMicrochip\.trim\(\)/);
  assert.match(component, /primaryVet:\s*pPrimaryVet\.trim\(\)/);
  assert.match(component, /emergencyContact:\s*pEmergencyContact\.trim\(\)/);
  assert.match(component, /insuranceProvider:\s*pInsuranceProvider\.trim\(\)/);
  assert.match(component, /insurancePolicy:\s*pInsurancePolicy\.trim\(\)/);
});

test("keeps truthful facts and routes every supported edit into the one editor", () => {
  const component = read(COMPONENT_PATH);

  assert.match(component, /label:\s*"Care Focus"/);
  assert.match(component, /profile\.careFocus\?\.trim\(\) \|\| "Not on file"/);
  assert.match(component, /setPFocus\(profile\.careFocus/);
  assert.match(component, /setPBackground\(profile\.background/);
  assert.match(component, /onOpenAvatarStudio/);
  assert.match(component, /accessibilityLabel=\{`Edit \$\{petName\}'s profile`\}/);
  assert.match(component, /onPress=\{openProfileEdit\}/);
  assert.equal(component.match(/onPress:\s*openProfileEdit/g)?.length ?? 0, 7);
  assert.equal(component.match(/onPress=\{openProfileEdit\}/g)?.length ?? 0, 2);
  assert.match(component, /title=\{`About \$\{petName\}`\}/);
  assert.match(component, /className|style=\{s\.aboutBody\}/);

  const birthday = component.match(/\{[\s\S]{0,120}label:\s*"Birthday"[\s\S]{0,220}\}/)?.[0] ?? "";
  const sex = component.match(/\{[\s\S]{0,120}label:\s*"Sex"[\s\S]{0,220}\}/)?.[0] ?? "";
  for (const [label, block] of [["Birthday", birthday], ["Sex", sex]] as const) {
    assert.match(block, /value:\s*"Not on file"/, `${label} must stay truthful`);
    assert.match(block, /detail:\s*"Not tracked yet"/, `${label} must explain the empty value`);
    assert.doesNotMatch(block, /onPress|hint:/, `${label} must not pretend to be editable`);
  }
  assert.match(component, /onPress\?:\s*\(\)\s*=>\s*void/);
  assert.match(component, /if \(onPress\)/);
  assert.match(component, /accessibilityRole="text"/);
  assert.match(component, /\{onPress \? \([\s\S]{0,120}<Ionicons name="chevron-forward"/);
  for (const inputLabel of [
    "Dog name",
    "Dog breed",
    "Current weight",
    "Care focus",
    "Dog background and about",
    "Microchip number",
    "Primary veterinarian",
    "Emergency contact",
    "Insurance provider",
    "Insurance policy number",
  ]) {
    assert.match(
      component,
      new RegExp(`accessibilityLabel="${inputLabel}"`),
      `${inputLabel} input must stay explicitly labeled`,
    );
  }
  assert.match(component, /<Modal[\s\S]*onRequestClose=\{\(\) => setProfileOpen\(false\)\}/);
  assert.match(component, /onPress=\{\(e\) => e\.stopPropagation\(\)\}/);
  assert.match(component, /bounces=\{false\}/);
  assert.match(component, /getModalSheetBottomPadding/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /accessibilityState=\{\{ selected:/);
  assert.match(component, /accessibilityLabel="Save dog profile"/);
});

test("removes More's duplicate profile editor but keeps one truthful summary link", () => {
  const more = read(MORE_PATH);

  assert.match(more, /profileCard/);
  assert.match(more, /accessibilityLabel="Open dog profile"/);
  assert.match(more, /router\.push\("\/profile"/);
  assert.equal(callCount(more, "updateCareDoc"), 1);
  assert.equal(callCount(more, "runAcceptedCareMutation"), 1);
  for (const forbidden of [
    "profileOpen",
    "openProfileEdit",
    "saveProfile",
    "pName",
    "pBreed",
    "pWeight",
    "pFocus",
    "pMicrochip",
    "pPrimaryVet",
    "pEmergencyContact",
    "pInsuranceProvider",
    "pInsurancePolicy",
    "validateProfileWeightDraft",
  ]) {
    assert.doesNotMatch(more, new RegExp(`\\b${forbidden}\\b`), `${forbidden} must leave More`);
  }
  assert.doesNotMatch(more, />Dog Profile<|CARE FOCUS \(OPTIONAL\)|MICROCHIP NUMBER|EMERGENCY CONTACT/);
});

test("keeps Profile as one small standalone compatibility delegate", () => {
  const route = read(PROFILE_ROUTE_PATH);

  assert.ok(route.length <= 1_400, `Profile delegate should stay small, received ${route.length} chars`);
  assert.match(route, /import \{ useRouter \} from "expo-router"/);
  assert.match(route, /import DogProfileScreen from "@\/components\/more\/DogProfileScreen"/);
  assert.equal(route.match(/<DogProfileScreen\b/g)?.length ?? 0, 1);
  assert.match(route, /surface="standalone"/);
  assert.match(route, /if \(router\.canGoBack\(\)\)/);
  assert.match(route, /router\.back\(\)/);
  assert.match(route, /router\.replace\("\/"\)/);
  assert.match(route, /onBack=\{handleBack\}/);
  assert.match(route, /onOpenAvatarStudio=\{\(\) => router\.push\("\/portrait"\)\}/);
  assert.doesNotMatch(route, /useCare|useAvatar|derivePhoenixStatus|HERO_PARK|Modal|StyleSheet|updateCareDoc/);
});

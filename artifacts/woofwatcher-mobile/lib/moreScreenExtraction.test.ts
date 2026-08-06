import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = existsSync(join(process.cwd(), "artifacts", "woofwatcher-mobile"))
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();
const read = (...parts: string[]) => {
  const path = join(MOBILE_ROOT, ...parts);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};
const owner = (name: string) => read("components", "more", `${name}.tsx`);
const calls = (source: string, name: string) => source.match(new RegExp(`\\b${name}\\(`, "g"))?.length ?? 0;

test("extracts Adventure as the tabbed owner without moving its accepted writes", () => {
  const source = owner("AdventureScreen");
  assert.match(source, /export interface AdventureScreenProps\s*{\s*onBack:\s*\(\)\s*=>\s*void;\s*}/);
  assert.equal(source.match(/<ScrollView\b/g)?.length ?? 0, 1);
  assert.match(source, /accessibilityLabel="Back to More"/);
  assert.match(source, /onPress=\{onBack\}/);
  assert.match(source, /surface:\s*"tabbed"/);
  assert.match(source, /getTabbedRouteBottomPadding/);
  assert.doesNotMatch(source, /Stack\.Screen|useLocalSearchParams|getStandaloneRouteBottomPadding/);
  assert.deepEqual([calls(source, "addEntry"), calls(source, "deleteEntry"), calls(source, "updateCareDoc")], [2, 1, 1]);
});

test("extracts WoofGuide as a prompt-injected tabbed owner", () => {
  const source = owner("WoofGuideScreen");
  assert.match(source, /export interface WoofGuideScreenProps\s*{[\s\S]*prompt\?:\s*string;[\s\S]*onBack:\s*\(\)\s*=>\s*void/);
  assert.equal(source.match(/<FlatList\b/g)?.length ?? 0, 1);
  assert.match(source, /<BoardRouteHeader[\s\S]{0,180}back[\s\S]{0,180}onBack=\{onBack\}[\s\S]{0,180}title="WoofGuide"/);
  assert.match(source, /surface:\s*"tabbed"/);
  assert.match(source, /getKeyboardAvoidingVerticalOffset/);
  assert.match(source, /getTabbedRouteBottomPadding/);
  assert.doesNotMatch(source, /useLocalSearchParams|surface:\s*"standalone"|getStandaloneRouteBottomPadding|getDockedComposerBottomPadding/);
  assert.deepEqual([calls(source, "addEntry"), calls(source, "updateCareDoc")], [1, 1]);
});

test("extracts Privacy and Legal as typed tabbed owners", () => {
  const privacy = owner("PrivacyDataScreen");
  assert.match(privacy, /export interface PrivacyDataScreenProps/);
  assert.match(privacy, /onOpenLegal:\s*\(document:\s*"privacy"\s*\|\s*"terms"\)\s*=>\s*void/);
  assert.match(privacy, /accessibilityLabel="Close Privacy and Safety"/);
  assert.match(privacy, /onPress=\{onBack\}/);
  assert.match(privacy, /getTabbedRouteBottomPadding/);
  assert.equal(calls(privacy, "updateCareDoc"), 1);
  assert.equal(calls(privacy, "runAcceptedCareMutation"), 1);
  assert.doesNotMatch(privacy, /useLocalSearchParams|getStandaloneRouteBottomPadding|router\.(?:push|replace)\("\/legal/);
  assert.match(privacy, /router\.push\("\/care-twin-qa\?qaSurface=support-legal-readiness-proof" as never\)/);

  const legal = owner("LegalScreen");
  assert.match(legal, /export interface LegalScreenProps/);
  assert.match(legal, /document\?:\s*"privacy"\s*\|\s*"terms"/);
  assert.equal(legal.match(/<BoardRouteHeader\b/g)?.length ?? 0, 1);
  assert.equal(legal.match(/<ScrollView\b/g)?.length ?? 0, 1);
  assert.match(legal, /document === "terms" \? "terms" : "privacy"/);
  assert.match(legal, /surface:\s*"tabbed"/);
  assert.match(legal, /getTabbedRouteBottomPadding/);
  assert.doesNotMatch(legal, /useLocalSearchParams/);
});

test("keeps Settings truthful and non-mutating", () => {
  const settings = owner("SettingsScreen");
  assert.match(settings, /export interface SettingsScreenProps\s*{\s*onBack:\s*\(\)\s*=>\s*void;\s*onOpenSection:\s*\(section:\s*Exclude<MoreSection,\s*"root">\)\s*=>\s*void;\s*}/);
  for (const copy of [
    "Home shows what is happening now.",
    "Log records care and supports corrections.",
    "Plans schedules care.",
    "Health keeps trends and shareable records.",
    "More manages your dog, people, and privacy.",
  ]) assert.ok(settings.includes(copy), copy);
  for (const section of ["dog-profile", "avatar-studio", "privacy"] as const) assert.ok(settings.includes(`onOpenSection("${section}")`));
  assert.equal(settings.match(/onOpenSection\("/g)?.length ?? 0, 3);
  assert.match(settings, /<BoardRouteHeader[\s\S]{0,180}back[\s\S]{0,180}onBack=\{onBack\}/);
  assert.doesNotMatch(settings, /Switch|AsyncStorage|useCare|useMutation|updateCareDoc|router\.|"\/setup"|"\/health"|onboarding/i);
});

test("reduces every moved legacy route to a resolver Redirect", () => {
  for (const route of ["adventure", "woofguide", "privacy", "legal"]) {
    const source = read("app", `${route}.tsx`);
    assert.match(source, /useLocalSearchParams/);
    assert.match(source, /resolveCanonicalDestination/);
    assert.match(source, /<Redirect\s+href=\{redirectHref\}\s*\/>/);
    assert.doesNotMatch(source, /useCare|useAvatar|useState|StyleSheet|ScrollView|updateCareDoc|addEntry|deleteEntry/);
  }
});

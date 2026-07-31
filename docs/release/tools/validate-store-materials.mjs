import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  STORE_CAPABILITY_ENV,
  validateProductionPrivacyCapabilities,
} from "./release-capability-policy.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const strictSubmission = process.argv.includes("--submission");
const errors = [];
const blockers = [];

function read(relativePath) {
  return fs.readFileSync(path.join(REPO, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function block(condition, message) {
  if (!condition) blockers.push(message);
}

function markdownSection(markdown, heading) {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  if (start < 0) return "";
  const bodyStart = markdown.indexOf("\n", start) + 1;
  const next = markdown.indexOf("\n## ", bodyStart);
  return markdown.slice(bodyStart, next < 0 ? markdown.length : next).trim();
}

function firstContentLine(section) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("("));
}

function pngInfo(relativePath) {
  const fullPath = path.join(REPO, relativePath);
  check(fs.existsSync(fullPath), `Missing store asset: ${relativePath}`);
  if (!fs.existsSync(fullPath)) return null;
  const bytes = fs.readFileSync(fullPath);
  check(
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    `${relativePath} is not a PNG`,
  );
  if (bytes.length < 26) return null;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

function validateOpaquePng(relativePath, width, height) {
  const info = pngInfo(relativePath);
  if (!info) return;
  check(
    info.width === width && info.height === height,
    `${relativePath} is ${info.width}x${info.height}; expected ${width}x${height}`,
  );
  check(info.bitDepth === 8, `${relativePath} must be 8-bit PNG`);
  check(
    info.colorType !== 4 && info.colorType !== 6,
    `${relativePath} has an alpha channel; store screenshots/feature art must be opaque`,
  );
}

const app = readJson("artifacts/woofwatcher-mobile/app.json").expo;
const mobilePackage = readJson("artifacts/woofwatcher-mobile/package.json");
const eas = readJson("artifacts/woofwatcher-mobile/eas.json");
const metadata = readJson("docs/release/APP_STORE_CONNECT_METADATA.json");
const listing = read("docs/release/STORE_LISTING.md");
const privacy = read("docs/legal/PRIVACY_POLICY.md");
const terms = read("docs/legal/TERMS_OF_SERVICE.md");
const generator = read("docs/release/tools/store-pack.mjs");
const screenshotReadme = read("docs/release/store-screenshots/README.md");

check(app.name === metadata.appRecord.name, "Expo name and App Store name differ");
check(app.version === metadata.version.versionString, "Expo and App Store versions differ");
check(app.ios?.buildNumber === metadata.version.initialBuildNumber, "Initial iOS build number differs");
check(app.ios?.bundleIdentifier === metadata.appRecord.bundleId, "iOS bundle ID differs");
check(app.ios?.supportsTablet === false, "iOS v1 must remain phone-only");
check(app.ios?.config?.usesNonExemptEncryption === false, "Export-compliance flag is missing");
check(app.ios?.privacyManifests?.NSPrivacyTracking === false, "Privacy manifest tracking must be false");
check(
  Array.isArray(app.ios?.privacyManifests?.NSPrivacyCollectedDataTypes) &&
    app.ios.privacyManifests.NSPrivacyCollectedDataTypes.length === 0,
  "Privacy manifest must declare no collected data types",
);
check(
  mobilePackage.expo?.autolinking?.exclude?.includes("@clerk/expo"),
  "Free local-first v1 must not autolink the dormant Clerk native SDK",
);

const locationPlugin = app.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-location",
);
const imagePickerPlugin = app.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-image-picker",
);
check(Boolean(imagePickerPlugin), "expo-image-picker permission configuration is missing");
check(
  imagePickerPlugin?.[1]?.microphonePermission === false,
  "Photo/camera picking must not add an unused microphone permission",
);
check(Boolean(locationPlugin), "expo-location permission configuration is missing");
check(
  /route stays in your care log on this device/i.test(
    locationPlugin?.[1]?.locationWhenInUsePermission ?? "",
  ),
  "Foreground-location prompt must say where the route stays",
);
check(
  locationPlugin?.[1]?.locationAlwaysAndWhenInUsePermission === false &&
    locationPlugin?.[1]?.locationAlwaysPermission === false &&
    locationPlugin?.[1]?.isIosBackgroundLocationEnabled === false,
  "iOS always/background location permissions must stay disabled",
);
check(
  locationPlugin?.[1]?.isAndroidForegroundServiceEnabled === false &&
  locationPlugin?.[1]?.isAndroidBackgroundLocationEnabled === false,
  "Android background and location foreground-service permissions must stay disabled",
);
check(
  app.android?.blockedPermissions?.includes("android.permission.RECORD_AUDIO"),
  "Android must block the unused microphone permission",
);
check(
  !app.android?.blockedPermissions?.includes(
    "android.permission.READ_EXTERNAL_STORAGE",
  ) &&
    !app.android?.blockedPermissions?.includes(
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ),
  "Android must retain Expo ImagePicker's legacy photo permissions for older-OS compatibility",
);

check(eas.cli?.version === ">= 16.0.1", "EAS CLI floor must be >= 16.0.1");
check(eas.cli?.appVersionSource === "remote", "EAS appVersionSource must be remote");
check(eas.build?.production?.autoIncrement === true, "Production build must auto-increment");
check(Boolean(eas.submit?.production?.ios), "iOS submit profile is missing");

check(metadata.appRecord.price === "FREE", "v1 store price must be FREE");
check(metadata.version.releaseOption === "MANUAL", "First public release must be manual");
check(metadata.review.demoAccountRequired === false, "Free local v1 must not require demo credentials");
check(metadata.privacy.nutritionLabel === "DATA_NOT_COLLECTED", "Privacy label drifted");
for (const issue of validateProductionPrivacyCapabilities({ eas, metadata })) {
  errors.push(issue);
}
check(
  /provider-backed push notifications/i.test(metadata.privacy.condition) &&
    /cloud document storage/i.test(metadata.privacy.condition),
  "Data Not Collected condition must fail closed for provider-backed push and cloud document storage",
);
check(
  metadata.ageRating.calculationPolicy === "USE_APP_STORE_CONNECT_CALCULATED_RATINGS",
  "Apple age ratings must use App Store Connect's OS- and region-specific calculation",
);
check(
  metadata.ageRating.healthOrWellnessTopics === true &&
    metadata.ageRating.medicalOrTreatmentInformation === "INFREQUENT",
  "Apple medical/wellness questionnaire answers drifted",
);
check(
  metadata.ageRating.unrestrictedWebAccess === false &&
    metadata.ageRating.socialMedia === false &&
    metadata.ageRating.userGeneratedContent === false &&
    metadata.ageRating.messagingOrChat === false &&
    metadata.ageRating.advertising === false &&
    metadata.ageRating.gambling === false &&
    metadata.ageRating.contests === "NONE",
  "Apple capability/content questionnaire answers drifted",
);
check(
  !Object.hasOwn(metadata.ageRating, "expectedGlobalRating"),
  "Do not enforce one Apple age rating across OS versions and regions",
);

const subtitle = metadata.version.subtitle;
const keywords = metadata.version.keywords;
check([...subtitle].length <= 30, `Subtitle is ${[...subtitle].length} characters; max is 30`);
check(Buffer.byteLength(keywords, "utf8") <= 100, `Keywords are ${Buffer.byteLength(keywords, "utf8")} bytes; max is 100`);
check(!keywords.includes(", "), "Apple keywords must not contain spaces after commas");
check(new Set(keywords.split(",")).size === keywords.split(",").length, "Apple keywords contain duplicates");

const fullDescription = markdownSection(
  listing,
  "Full description (App Store and Play, shared base)",
);
const playShortDescription = firstContentLine(
  markdownSection(listing, "Google Play short description (80 characters max)"),
);
const applePrivacyLabel = markdownSection(listing, "Apple privacy nutrition label");
check(fullDescription.length > 0, "Full store description section is missing");
check(fullDescription.length <= 4000, `Full description is ${fullDescription.length} characters; max is 4000`);
check(Boolean(playShortDescription), "Google Play short description is missing");
check(
  [...(playShortDescription ?? "")].length <= 80,
  `Google Play short description is ${[...(playShortDescription ?? "")].length} characters; max is 80`,
);
check(listing.includes(keywords), "Machine-readable keywords and STORE_LISTING.md differ");
check(!/claude\.ai\/code\/artifact/i.test(listing), "Private Claude artifact URL remains in listing");
check(
  /provider-backed push/i.test(applePrivacyLabel) &&
    /cloud document storage/i.test(applePrivacyLabel),
  "Apple privacy-label guidance must fail closed for provider-backed push and cloud document storage",
);
check(!/Routines the whole|pack can follow/i.test(generator), "Screenshot generator still implies shared sync");
check(!/06-health/i.test(generator), "Screenshot generator still captures the unexplained Health Score");
check(/externalRequests/.test(generator), "Screenshot generator no longer audits remote requests");
check(
  /EXPO_PUBLIC_BUILD_PROFILE=production/.test(screenshotReadme),
  "Store screenshot instructions must build the explicit production profile",
);
check(
  /owner-only Pack Access is visible/.test(generator),
  "Screenshot generator must reject internal/owner-ops bundles",
);
check(
  /server\.listen\(0,\s*"127\.0\.0\.1"/.test(generator),
  "Screenshot capture server must bind to loopback",
);
check(
  /path\.resolve\(ROOT,\s*relativeUrlPath\)/.test(generator) &&
    /fp\.startsWith\(`\$\{ROOT\}\$\{path\.sep\}`\)/.test(generator),
  "Screenshot capture server must contain decoded request paths beneath ROOT",
);

for (const legal of [
  ["Privacy policy", privacy],
  ["Terms", terms],
]) {
  check(legal[1].includes("Pegasus Dreamscapes Corp"), `${legal[0]} has the wrong publisher`);
  check(legal[1].includes("apollo@pegasusdreamscapes.com"), `${legal[0]} has the wrong support contact`);
}
check(
  /map provider/i.test(privacy) && /not sent|not transmitted/i.test(privacy),
  "Privacy policy must explain local route rendering",
);

const screenshots = [
  "01-today.png",
  "02-fastlog.png",
  "03-plan.png",
  "04-story.png",
  "05-pack.png",
  "06-carepass.png",
];
for (const file of screenshots) {
  validateOpaquePng(`docs/release/store-screenshots/ios-6.9/${file}`, 1290, 2796);
  validateOpaquePng(`docs/release/store-screenshots/play-phone/${file}`, 1080, 1920);
}
validateOpaquePng("docs/release/store-screenshots/play-feature-graphic.png", 1024, 500);

const playIcon = pngInfo("docs/release/store-screenshots/play-icon-512.png");
if (playIcon) {
  check(
    playIcon.width === 512 && playIcon.height === 512,
    `Play icon is ${playIcon.width}x${playIcon.height}; expected 512x512`,
  );
  check(playIcon.bitDepth === 8, "Play icon must be 8-bit PNG");
  check(playIcon.colorType === 6, "Play icon must be 32-bit RGBA PNG");
}

check(
  !fs.existsSync(path.join(REPO, "docs/release/store-screenshots/ios-6.7")),
  "Retired ios-6.7 screenshot directory still exists",
);
check(
  !fs.existsSync(path.join(REPO, "docs/release/store-screenshots/play-phone/06-health.png")),
  "Retired Health screenshot still exists",
);

block(metadata.urls.verifiedPublic, "Publish and verify the privacy/support/terms URLs");
block(Boolean(metadata.review.phone), "Add the App Review contact phone");
block(Boolean(metadata.ownerInputs.appStoreConnectAppleId), "Record the App Store Connect Apple ID");
block(Boolean(metadata.ownerInputs.appleTeamId), "Record the Apple Team ID");
block(Boolean(metadata.ownerInputs.easProjectId), "Run eas init and record the EAS project ID");
block(metadata.ownerInputs.legalEffectiveDateConfirmed, "Confirm the legal effective date");
block(metadata.ownerInputs.governingLawConfirmed, "Confirm governing law");
block(metadata.ownerInputs.contentRightsConfirmed, "Confirm rights to all shipped art/fonts");
block(metadata.nativeProof.signedTestFlightBuildInstalled, "Install the signed TestFlight build");
block(metadata.nativeProof.physicalIPhoneMatrixPassed, "Pass the physical-iPhone QA matrix");
block(metadata.nativeProof.apolloApprovedExactBuild, "Apollo must approve the exact release build");

if (errors.length > 0) {
  console.error(`STORE MATERIALS FAILED (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("STORE MATERIALS PASS");
console.log(`- Subtitle: ${[...subtitle].length}/30 characters`);
console.log(`- Keywords: ${Buffer.byteLength(keywords, "utf8")}/100 bytes`);
console.log(`- Description: ${fullDescription.length}/4000 characters`);
console.log(`- iPhone screenshots: ${screenshots.length} at 1290x2796, opaque`);
console.log(`- Play screenshots: ${screenshots.length} at 1080x1920, opaque`);
console.log("- Feature graphic: 1024x500, opaque");
console.log("- Play icon: 512x512, RGBA");
console.log(
  `- Store privacy capabilities: push-token registration ${eas.build.production.env[STORE_CAPABILITY_ENV.pushTokenRegistration]}; cloud document upload ${eas.build.production.env[STORE_CAPABILITY_ENV.cloudDocumentUpload]}`,
);

if (blockers.length > 0) {
  console.log(`OWNER/NATIVE BLOCKERS (${blockers.length})`);
  for (const item of blockers) console.log(`- ${item}`);
}

if (strictSubmission && blockers.length > 0) process.exit(2);

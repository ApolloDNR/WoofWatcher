import type { QaScreenshotEvidence } from "./qaScreenshotEvidence.ts";
import { qaScreenshotEvidenceNames } from "./qaScreenshotEvidence.ts";
import { buildAvatarSpriteProductionQaSummary } from "./avatarSpriteProductionQa.ts";
import type { StoreSubmissionPacket, StoreScreenshotChecklistItem } from "./storeSubmissionPacket.ts";

export type MobileReleaseQaReviewStatus = "unreviewed" | "pass" | "needs-review";

export interface MobileReleaseQaRouteCheck {
  label: string;
  route: string;
  expected: string;
  proof?: string;
  requiredNativePlatforms?: readonly ("ios" | "android")[];
}

export interface MobileReleaseQaSurface {
  id: string;
  title: string;
  route: string;
  priority: "launch-critical" | "release-polish";
  goal: string;
  devicePrompt: string;
  setupSteps: readonly string[];
  verificationSteps: readonly string[];
  acceptanceCriteria: readonly string[];
  failureEscalation: string;
  requiredEvidence: readonly string[];
  launchRisk: string;
  routeChecklist?: readonly MobileReleaseQaRouteCheck[];
}

export interface MobileReleaseQaReview {
  surfaceId: string;
  status: MobileReleaseQaReviewStatus;
  note?: string;
  screenshotEvidence?: readonly QaScreenshotEvidence[];
}

export interface MobileReleaseQaSummary {
  total: number;
  passed: number;
  passedWithRequiredProof: number;
  passPendingProof: number;
  needsReview: number;
  unreviewed: number;
  requiredScreenshots: number;
  requiredIosScreenshots: number;
  requiredAndroidScreenshots: number;
  requiredAnyScreenshots: number;
  attachedScreenshots: number;
  attachedIosScreenshots: number;
  attachedAndroidScreenshots: number;
  attachedOtherScreenshots: number;
  missingScreenshots: number;
  missingIosScreenshots: number;
  missingAndroidScreenshots: number;
  missingAnyScreenshots: number;
}

export type RouteVisualProofManifestStatus = "ready" | "blocked";

export interface RouteVisualProofManifestInput {
  surface?: MobileReleaseQaSurface;
  evidence?: readonly QaScreenshotEvidence[];
  note?: string;
}

export interface RouteVisualProofManifestRow {
  label: string;
  route: string;
  expected: string;
  iosStatus: string;
  androidStatus: string;
  proof: string;
}

export interface RouteVisualProofManifest {
  title: "Route visual proof manifest";
  status: RouteVisualProofManifestStatus;
  statusLabel: "Native visual proof complete" | "Native proof blocked";
  requiredIosScreenshots: number;
  requiredAndroidScreenshots: number;
  attachedIosScreenshots: number;
  attachedAndroidScreenshots: number;
  rows: RouteVisualProofManifestRow[];
  blockers: string[];
  webPreviewBoundary: string;
}

const AVATAR_SPRITE_PRODUCTION_QA = buildAvatarSpriteProductionQaSummary();

export const MOBILE_RELEASE_QA_SURFACES: readonly MobileReleaseQaSurface[] = [
  {
    id: "phoenix-home",
    title: "Phoenix Home",
    route: "/",
    priority: "launch-critical",
    goal: "Prove the first screen answers where Phoenix is, how she feels, what is next, and what can be logged quickly.",
    devicePrompt:
      "Check header safe area, bottom-nav clearance, one main Phoenix sprite, room crop, quick-log response, long-press Studio handoff, and Next Up reachability on iOS and Android.",
    setupSteps: [
      "Use a local preview household with Phoenix sample care data.",
      "Start from the Home tab with no modal or bottom sheet covering the room.",
    ],
    verificationSteps: [
      "Open Phoenix Home from the Home tab and confirm header, date, bell, and profile controls sit below the safe area.",
      "Confirm Phoenix Home answers presence, feeling, next care, and quick logging without scrolling past the main room.",
      "Tap one safe quick-log tile and confirm the main Phoenix sprite reacts without spawning a second avatar.",
      "Long press the main Phoenix room and confirm it opens Avatar Studio, then return to Home without losing the current care context.",
      "Scroll to Next Up and confirm the floating paw nav does not cover the next action or quick-log controls.",
    ],
    acceptanceCriteria: [
      "Header controls, room crop, status strip, quick-log actions, and Next Up stay readable on both platforms.",
      "The main Phoenix sprite reacts without a second avatar, duplicate sprite, or pasted-on overlay.",
      "A long press opens Avatar Studio from the main dog target while a normal tap still feels like care-twin feedback.",
      "The floating paw nav never hides the next action, quick-log controls, or visible care status.",
    ],
    failureEscalation:
      "Mark Needs tune if there is safe-area clipping, duplicate avatar behavior, hidden controls, unreadable status copy, broken long-press-to-Studio routing, or a room crop that weakens the premium first impression.",
    requiredEvidence: [
      "iOS screenshot of Phoenix Home above the fold.",
      "Android screenshot of Phoenix Home above the fold.",
      "Note from one quick-log tap confirming the main sprite reacts without spawning a second avatar.",
      "Note confirming long-press-to-Studio opens Avatar Studio from the main dog target on at least one native platform.",
    ],
    launchRisk:
      "If Home fails, the app reads as a prototype instead of a trustworthy daily dog-care command center.",
  },
  {
    id: "home-mission-deck",
    title: "Home Mission Deck",
    route: "/",
    priority: "launch-critical",
    goal: "Prove the care-RPG mission deck fits the first screen and routes open care loops to real workflows.",
    devicePrompt:
      "On small iOS and Android phones, confirm the compact mission deck stays readable above the floating paw nav, has no text overflow, and routes pending meal, walk/alone, Adventure, Health, and Care Pass rows correctly.",
    setupSteps: [
      "Use a local preview household with Phoenix sample care data.",
      "Create a meal served with outcome pending from Quick Log or Log before capture.",
      "Start a walk or Alone Time session before route-testing the active-care mission row.",
      "Leave Adventure, Health, and Care Pass local preview data visible; do not mark provider-gated work as live.",
    ],
    verificationSteps: [
      "Open Phoenix Home on a compact phone width and scroll to the mission deck under the status tiles.",
      "Confirm at least three mission rows are readable, reachable, and clear of the floating paw nav.",
      "Tap the pending meal mission and confirm it lands in the Meal Log or meal outcome update flow.",
      "Tap the walk or alone-time mission when available and confirm it lands in the active Log workflow.",
      "Tap Adventure, Health, and Care Pass mission rows and confirm they route to Adventure, Health, and Records.",
    ],
    acceptanceCriteria: [
      "No mission row is hidden behind the floating paw nav or clipped by the phone viewport.",
      "The pending meal, active care, Adventure, Health, and Care Pass rows remain readable and tappable.",
      "Every mission row routes to the named care workflow and returns without creating a dead end.",
    ],
    failureEscalation:
      "Mark Needs tune and note the first blocked row or overflow if any mission is clipped, unreachable, unreadable, or routed to the wrong workflow.",
    requiredEvidence: [
      "iOS screenshot of the compact Home mission deck with at least three mission rows visible.",
      "Android screenshot of the compact Home mission deck with the floating paw nav visible.",
      "Note confirming pending meal routes to Meal Log, active walk or alone-time routes to Log, Adventure routes to Adventure, Health routes to Health, and Care Pass routes to Records.",
    ],
    launchRisk:
      "If the mission deck overflows, hides behind the paw nav, or routes to dead ends, the flagship Home screen loses the planned premium care-command feel.",
  },
  {
    id: "owner-preview-core-loop",
    title: "Owner Preview Core Loop",
    route: "/",
    priority: "launch-critical",
    goal: "Prove a real owner can move through the main beta loop without dead ends: Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, and Care Pass.",
    devicePrompt:
      "Run the bottom-nav owner preview on iOS and Android: log one safe care event, inspect tomorrow's plan, review Health Watch, open Launch Readiness from More, open Adventure Mode, and confirm records/Care Pass/Avatar Studio remain reachable.",
    setupSteps: [
      "Use local preview data with no private real household details visible.",
      "Start on Home with the floating paw navigation visible.",
      "Keep provider, payment, storage, AI, and store gates in their truthful blocked or staged state.",
    ],
    verificationSteps: [
      "Open Home, Log, Plans, Health, and More in order from the bottom navigation.",
      "In Log, quick-log one safe care event or open the detail sheet, then undo or leave a QA note if you do not want to persist it.",
      "In Plans, confirm upcoming care rows are readable and the add/edit flow is reachable without covering the paw nav.",
      "In Health, confirm Health Watch and Bile Watch, plus the Review packet, Vet-share checklist, and Draft vet questions action stay non-diagnostic and readable on the phone.",
      "Open Adventure Mode from More or Home and confirm private care quests, proof rows, and the memory shelf are reachable without implying public maps or cloud sharing.",
      "In More, open Launch Readiness, Records, Avatar Studio, and Care Pass/Reports paths and confirm no route is a dead end.",
      "In Records, confirm Care Pass Report History storage status says Saved on this device, or Ready to upload only after provider-approved storage; never provider-backed upload unless the provider gate is actually closed.",
    ],
    acceptanceCriteria: [
      "The bottom-nav loop never hides the active action, gets stuck behind a modal, or routes to a blank screen.",
      "Quick Log, Plans, Health, More, Adventure Mode, Records, Avatar Studio, and Care Pass each expose a clear next action.",
      "Launch Readiness keeps internal beta, provider setup, store approval, payments, AI, and storage boundaries truthful.",
      "Care Pass Report History shows Saved on this device, or Ready to upload only after provider-approved storage, without implying cloud-backed storage before upload rules exist.",
    ],
    failureEscalation:
      "Mark Needs tune if any core route is confusing, clipped by the paw nav, blocked by keyboard/modal overlap, missing a next action, Adventure Mode becomes a dead end, or claims provider/store/payment/AI/storage readiness that is not actually configured.",
    requiredEvidence: [
      "iOS screenshot of Quick Log or Log after opening the owner preview loop.",
      "Android screenshot of Launch Readiness from More after completing the owner preview loop.",
      "Note confirming Home, Log, Plans, Health, More, Adventure Mode, Records, Avatar Studio, and Care Pass were reachable without dead ends.",
      "QA note confirming Care Pass Report History storage status stayed truthful.",
    ],
    routeChecklist: [
      {
        label: "Home",
        route: "/",
        expected: "Confirm Phoenix status, next care, quick actions, long-press-to-Studio, and floating paw navigation are readable.",
      },
      {
        label: "Log",
        route: "/log",
        expected: "Quick-log one safe care event or open the detail sheet without keyboard or modal blocking.",
        proof: "iOS Quick Log or Log screenshot.",
      },
      {
        label: "Plans",
        route: "/calendar",
        expected: "Inspect upcoming care rows and confirm add/edit plan controls stay reachable.",
      },
      {
        label: "Health",
        route: "/health",
        expected: "Review Health Watch and Bile Watch copy for readable, non-diagnostic language.",
      },
      {
        label: "More",
        route: "/more",
        expected: "Open Launch Readiness and confirm beta/public launch boundaries stay truthful.",
        proof: "Android Launch Readiness screenshot.",
      },
      {
        label: "Adventure",
        route: "/adventure",
        expected: "Confirm private care quests, proof rows, XP, and memory shelf are reachable without claiming public maps or cloud sharing.",
      },
      {
        label: "Records",
        route: "/records",
        expected: "Confirm records, dog ID, trend sections, and report history expose clear next actions.",
      },
      {
        label: "Avatar Studio",
        route: "/portrait",
        expected: "Confirm the PixelLab-backed care twin path is reachable and labeled truthfully.",
      },
      {
        label: "Care Pass",
        route: "/records",
        expected: "Confirm sitter/vet/trainer handoff previews are reachable from Records or More and Report History storage status stays truthful.",
        proof: "Care Pass Report History storage status note or screenshot.",
      },
    ],
    launchRisk:
      "If this loop is not proven, WoofWatcher may look polished in isolated screens while still failing the real owner beta journey.",
  },
  {
    id: "auth-setup-onboarding-proof",
    title: "Auth And Setup Onboarding Proof",
    route: "/sign-in",
    priority: "launch-critical",
    goal:
      "Prove the account gateway and first-run setup are phone-ready while provider-backed auth and household creation stay blocked unless real providers are configured.",
    devicePrompt:
      "On iOS and Android, capture the Auth gateway and Setup local-preview path, confirming provider-backed auth stays blocked and local setup does not claim cross-device household creation.",
    setupSteps: [
      "Confirm Clerk production credentials are not configured unless Apollo has provided structured Clerk, redirect/deep-link, household membership, and auth launch proof files.",
      "Use Local preview household setup data with no private household details visible.",
      "Keep provider-backed auth, household creation, invite delivery, and cross-device sync labels in their truthful blocked or local-preview state.",
    ],
    verificationSteps: [
      "Open /sign-in and confirm the account gateway renders the WoofWatcher CareTwin gateway, local-preview status, and provider-boundary copy without blanking the page.",
      "Open /setup and select Local preview household setup, then confirm save/finish-later controls stay reachable on a phone viewport.",
      "Confirm Create household and Join by invite copy does not claim provider-backed household creation, invite acceptance, or cross-device sync unless real providers are configured.",
      "Return to More or Home without losing the local preview setup state.",
    ],
    acceptanceCriteria: [
      "Auth gateway and Setup are readable, tappable, and clear of safe-area, keyboard, and floating navigation issues on iOS and Android.",
      "provider-backed auth, household creation, invite delivery, and cross-device sync remain explicitly blocked or local-preview unless structured provider proof files exist.",
      "Local preview setup can be saved or deferred without a dead end.",
    ],
    failureEscalation:
      "Mark Needs tune if Auth or Setup clips, blanks, traps the keyboard, hides save controls, claims cross-device account sync, or says provider-backed household creation/invite delivery is ready without structured provider proof files.",
    requiredEvidence: [
      "iOS screenshot of Auth gateway showing local-preview/provider-boundary copy.",
      "Android screenshot of Setup showing Local preview household setup and reachable save controls.",
      "Structured auth provider proof files for Clerk production app, redirect/deep-link URLs, household membership policy, and Apollo auth launch approval/no-launch boundary.",
    ],
    routeChecklist: [
      {
        label: "Auth gateway",
        route: "/sign-in",
        expected:
          "Confirm the account gateway renders CareTwin branding, local-preview status, and provider-boundary copy without blanking.",
        proof: "iOS + Android native screenshot required.",
        requiredNativePlatforms: ["ios", "android"],
      },
      {
        label: "First-run setup",
        route: "/setup",
        expected:
          "Confirm Local preview setup, Create household, and Join by invite stay truthful about provider-backed household creation and invite delivery.",
        proof: "iOS + Android native screenshot plus local preview setup note.",
        requiredNativePlatforms: ["ios", "android"],
      },
    ],
    launchRisk:
      "If account entry or setup overclaims provider sync, the beta starts with a trust breach before the owner reaches real dog care.",
  },
  {
    id: "records-local-file-handoff",
    title: "Records Local File Handoff",
    route: "/records",
    priority: "launch-critical",
    goal: "Prove the Records handoff path creates and shares Care Pass Report History local HTML plus Dog ID local HTML and SVG artifacts without claiming PDF, PNG, or provider storage.",
    devicePrompt:
      "On real iOS and Android, run Records share flows for Care Pass Report History and Dog ID. Capture share sheet behavior, Android content URI handoff, saved-file names, and fallback copy.",
    setupSteps: [
      "Use local preview household data and keep provider, payment, storage, AI, and store gates truthful.",
      "Open Records with at least one Care Pass Report History artifact available under WoofWatcherReports.",
      "Open Dog ID with the local HTML credential and SVG image source actions available under WoofWatcherCredentials.",
    ],
    verificationSteps: [
      "Open Records and confirm Care Pass Report History storage status says Saved on this device, or Ready to upload only after provider-approved storage.",
      "Share or print the Care Pass Report History artifact and confirm the Printable HTML local file, file name, file size, and local PDF/native-proof boundary are visible.",
      "Share the Dog ID local HTML credential and confirm it saves under WoofWatcherCredentials before opening the native share sheet.",
      "Share the Dog ID SVG image source and confirm it saves under WoofWatcherCredentials with image/svg+xml behavior, not an HTML fallback filename.",
      "On Android, confirm at least one Records local file handoff uses the Android content URI when available.",
      "On either platform, force or note the fallback copy path if local file sharing is unavailable, and confirm it names the local-only boundary.",
    ],
    acceptanceCriteria: [
      "Care Pass Report History shows Saved on this device, or Ready to upload only after provider-approved storage, and names the Printable HTML local file with PDF pending copy.",
      "Dog ID can share a local HTML credential file and SVG image source from WoofWatcherCredentials.",
      "Android content URI behavior and fallback copy are captured instead of guessed.",
      "Generated PDF/PNG proof is handled by Report Binary Export Proof, and Records never claims provider-backed storage, native artifact proof, or cloud sync unless those gates are actually closed.",
    ],
    failureEscalation:
      "Mark Needs tune if Records hides the saved file name, misses the Android content URI path, loses fallback copy, claims provider-backed storage, or implies PNG/PDF export is complete.",
    requiredEvidence: [
      "iOS screenshot of Care Pass Report History showing local HTML storage status.",
      "Android screenshot of Dog ID local HTML or SVG share sheet.",
      "Note confirming WoofWatcherReports saved Printable HTML local file name, file size, and local PDF/native-proof boundary.",
      "Note confirming WoofWatcherCredentials saved local HTML credential and SVG image source, Android content URI behavior, fallback copy, and generated PDF/PNG proof remains separate.",
    ],
    routeChecklist: [
      {
        label: "Care Pass Report History local HTML",
        route: "/records",
        expected:
          "Confirm WoofWatcherReports contains the printable Care Pass HTML file, file size, storage status, and PDF pending copy.",
        proof: "iOS + Android share-sheet proof plus saved-file name or Mission note.",
      },
      {
        label: "Dog ID local HTML credential",
        route: "/records",
        expected:
          "Confirm WoofWatcherCredentials contains the printable Dog ID local HTML credential before the native share sheet opens.",
        proof: "Android content URI or saved-file proof plus fallback copy note.",
      },
      {
        label: "Dog ID SVG image source",
        route: "/records",
        expected:
          "Confirm the SVG image source saves with image/svg+xml behavior and keeps generated PDF/PNG proof separate.",
        proof: "SVG image source share proof and Mission note naming the generated PDF/PNG proof boundary.",
      },
    ],
    launchRisk:
      "If this proof is missing, the beta handoff cannot claim Records export proof even though the local HTML and SVG source actions exist.",
  },
  {
    id: "report-binary-export-proof",
    title: "Report Binary Export Proof",
    route: "/more",
    priority: "launch-critical",
    goal:
      "Prove local Care Pass PDF and Dog ID PNG bytes, native share/reopen behavior, structured provider storage evidence, and native artifact evidence before binary export readiness can be claimed.",
    devicePrompt:
      "In Records and Provider Launch Setup on iOS and Android, collect local PDF/PNG artifact proof, native share/reopen evidence, structured provider storage proof, and generated artifact evidence.",
    setupSteps: [
      "Use local preview data; PDF/PNG actions can generate local bytes, but readiness stays blocked until native share/reopen and provider proof exists.",
      "Open More, then Provider Launch Setup, and inspect the Records and media storage gate.",
      "Open Records Report History and run the generated Care Pass PDF action from a saved artifact.",
      "Open Dog ID and run the generated Dog ID PNG action while retaining the HTML/SVG source fallbacks.",
    ],
    verificationSteps: [
      "Open Provider Launch Setup and confirm Records and media storage shows the Report binary export proof packet.",
      "Confirm the packet names Care Pass PDF, Dog ID PNG, structured provider storage proof, and iOS/Android artifact proof.",
      "In Records, verify the Care Pass Report History Binary proof manifest shows the local PDF file name, file size, MIME proof, and native share/reopen blocker.",
      "In Records, verify Dog ID shows local HTML/SVG source plus local PNG file name, file size, MIME proof, and native share/reopen blocker.",
      "Capture or attach a structured provider storage proof file for report PDFs, credential PNG/SVG/HTML, and QA evidence before clearing the storage gate.",
    ],
    acceptanceCriteria: [
      "No PDF/PNG readiness is claimed until native share/reopen proof, structured provider storage proof, and generated artifact proof are attached.",
      "Care Pass PDF proof includes iOS and Android generated artifact evidence, file name, file size, MIME proof, share/reopen proof, and no HTML-only fallback in the PDF action.",
      "Dog ID PNG proof includes iOS and Android generated artifact evidence, file name, file size, MIME proof, share/reopen proof, and SVG source retained as fallback.",
      "Provider storage proof covers file name or URI, MIME, byte size, bucket names, household-scoped signed upload/download, retention, export, deletion, QA evidence storage, and approval booleans.",
    ],
    failureEscalation:
      "Mark Needs tune if the app treats HTML-only fallback as PDF proof, treats SVG source as PNG proof, hides file name/size/MIME evidence, or implies provider storage is ready without a structured signed upload/download proof file.",
    requiredEvidence: [
      "iOS screenshot of Provider Launch Setup showing the Report binary export proof packet.",
      "Android screenshot of generated PDF and PNG artifact proof or the still-pending proof packet.",
      "Note confirming local Care Pass PDF bytes and local Dog ID PNG bytes were generated before native proof was evaluated.",
      "Structured provider storage proof file naming file or URI, MIME, byte size, bucket names, signed upload/download, household scope, retention, export, deletion, QA evidence storage, and approval booleans.",
    ],
    routeChecklist: [
      {
        label: "Provider Launch Setup storage gate",
        route: "/more",
        expected:
          "Confirm Records and media storage lists the Report binary export proof packet before binary readiness can be claimed.",
        proof: "Structured provider storage proof file.",
      },
      {
        label: "Care Pass PDF artifact proof",
        route: "/records",
        expected:
          "Confirm Care Pass Report History has a generated PDF file name, file size, MIME proof, and share/reopen proof before leaving PDF pending state.",
        proof: "iOS and Android generated PDF proof.",
      },
      {
        label: "Dog ID PNG artifact proof",
        route: "/records",
        expected:
          "Confirm Dog ID has a generated PNG file name, file size, MIME proof, share/reopen proof, and retained SVG source before leaving PNG pending state.",
        proof: "iOS and Android generated PNG proof.",
      },
    ],
    launchRisk:
      "If this proof is skipped, binary export readiness can be claimed from local HTML/SVG sources instead of real PDF/PNG artifacts.",
  },
  {
    id: "care-entry-provider-sync-proof",
    title: "Care-entry Provider Sync Proof",
    route: "/more",
    priority: "launch-critical",
    goal:
      "Prove structured Supabase project, migration/backfill, active-household RLS, retention/export/deletion, dependency build, and mobile sign-off files exist before incremental care-entry sync is enabled.",
    devicePrompt:
      "In Provider Launch Setup on iOS and Android, collect structured Household database sync proof files for Supabase project setup, migration/backfill, cursor and tombstone RLS, retention/export/deletion, dependency build, and mobile full-refresh sign-off.",
    setupSteps: [
      "Use local preview data and keep Household database sync marked open unless provider proof is actually attached.",
      "Open More, then Provider Launch Setup, and inspect the Household database sync gate.",
      "Keep mobile care-entry refresh in full-refresh mode until every provider proof item and native QA sign-off exists.",
    ],
    verificationSteps: [
      "Confirm Household database sync lists the Care-entry provider sync proof packet.",
      "Confirm the packet requires structured Supabase project id proof with environment, deployment target, database host, owner, production confirmation, MIME, and byte size.",
      "Confirm migration/backfill proof for care_entries.updated_at and care_entry_tombstones includes migration ids, applied timestamp, backfill row count, backfill timestamp, existing-rows-backfilled, MIME, and byte size.",
      "Confirm active-household RLS proof files are required for /care-entries?updatedSince= and /care-entries/tombstones?updatedSince= with policy names, active-household claim, denied cross-household reads, verified booleans, MIME, and byte size.",
      "Confirm backup, retention/export/deletion policy, dependency-complete build proof, and mobile full-refresh sign-off are structured files with row-specific approvals before incremental adoption.",
      "Capture the Provider Launch Setup state on iOS and Android without marking the database gate ready unless the real proof artifacts are attached.",
    ],
    acceptanceCriteria: [
      "incremental sync stays blocked until structured Supabase project id, migration/backfill, cursor RLS, tombstone RLS, retention/export/deletion, dependency build proof, and mobile sign-off files are attached.",
      "The database gate names care_entries.updated_at, care_entry_tombstones, /care-entries?updatedSince=, and /care-entries/tombstones?updatedSince=.",
      "Retention/export/deletion proof is listed beside the migration and RLS proof with privacy and export/deletion approvals, not treated as optional follow-up.",
      "Provider Launch Setup does not imply cross-device sync is ready from local schema, API contract coverage, generic URLs, or free-form notes alone.",
    ],
    failureEscalation:
      "Mark Needs tune if the database gate hides migration/backfill, skips cursor or tombstone RLS proof, omits structured retention/export/deletion policy, allows incremental sync without structured native sign-off, or implies provider sync is ready from source code alone.",
    requiredEvidence: [
      "iOS screenshot of Provider Launch Setup showing the Household database sync proof packet.",
      "Android screenshot of Provider Launch Setup showing Household database sync still blocked or fully evidenced.",
      "Structured Supabase project id, migration/backfill, and active-household RLS proof files with file names or URIs, MIME, byte size, backfill row count, denied cross-household reads, and verified booleans.",
      "Structured retention/export/deletion, dependency-complete build, and mobile full-refresh sign-off files with policy references, CI URL and run id, native QA reference, rollback plan, row-specific approvals, MIME, and byte size before enabling incremental sync.",
    ],
    routeChecklist: [
      {
        label: "Provider Launch Setup database gate",
        route: "/more",
        expected:
          "Confirm Household database sync lists the Care-entry provider sync proof packet and stays open until proof is attached.",
        proof: "Provider Launch Setup screenshot plus structured migration/backfill, RLS, retention, dependency-build, and mobile sign-off files.",
      },
      {
        label: "Care-entry cursor route",
        route: "/care-entries?updatedSince=",
        expected:
          "Confirm /care-entries?updatedSince= has active-household RLS proof before incremental cursor reads are trusted.",
        proof: "Supabase active-household RLS cursor proof.",
      },
      {
        label: "Care-entry tombstone route",
        route: "/care-entries/tombstones?updatedSince=",
        expected:
          "Confirm /care-entries/tombstones?updatedSince= has tombstone RLS proof and retention/export/deletion policy before delete sync is trusted.",
        proof: "Supabase tombstone RLS proof and structured retention/export/deletion policy file.",
      },
    ],
    launchRisk:
      "If this proof is skipped, incremental sync can leak stale, missing, deleted, or cross-household care-entry state before the provider database is ready.",
  },
  {
    id: "woofguide-ai-provider-proof",
    title: "WoofGuide AI Provider Proof",
    route: "/more",
    priority: "launch-critical",
    goal:
      "Prove the OpenAI key location, approved model policy, source/citation rules, owner-review write gate, veterinary safety boundary, and fallback handling with structured proof files before live AI can be enabled.",
    devicePrompt:
      "In Provider Launch Setup and WoofGuide on iOS and Android, collect the WoofGuide AI provider proof packet without treating deterministic drafts or local fallback state as provider-backed AI.",
    setupSteps: [
      "Use local preview data and keep WoofGuide AI marked open unless structured proof files for OpenAI key storage, approved model policy, source rules, owner-review writes, safety, and fallback handling are attached.",
      "Open More, then Provider Launch Setup, and inspect the WoofGuide AI gate.",
      "Open WoofGuide and confirm deterministic/fallback owner-reviewed drafts remain visible until the provider policy is approved.",
      "Keep automatic care-log writes, record mutation, diagnosis, and treatment advice blocked unless owner review, audit, and veterinary-boundary proof exists.",
    ],
    verificationSteps: [
      "Confirm WoofGuide AI lists the WoofGuide AI provider proof packet.",
      "Confirm OpenAI key location, secret storage, environment scope, rotation owner, no local placeholders, MIME, and byte size are required before live AI can be claimed.",
      "Confirm approved model policy, prompt policy, data retention stance, source/citation rules, source freshness rules, MIME, and byte size are required for every AI-assisted answer.",
      "Confirm owner-review write gate proof with no automatic care-log writes and no direct record mutation is required before any AI suggestion can affect saved care data, care logs, records, reports, or routines.",
      "Confirm veterinary safety boundary, diagnosis/treatment refusal examples, emergency escalation language, fallback/incident handling, rate-limit behavior, provider-error behavior, rollback plan, support handoff, MIME, and byte size are required before marking WoofGuide AI ready.",
    ],
    acceptanceCriteria: [
      "live AI stays blocked until structured proof files cover OpenAI key storage, approved model policy, source/citation behavior, owner-review write gate, veterinary safety boundary, and fallback handling.",
      "WoofGuide never treats deterministic local drafts, static prompt copy, or owner-staged provider rows as provider-backed AI.",
      "permission-aware writes stay owner-reviewed and audited before any AI suggestion can alter saved care data.",
      "medical and behavior-safety answers stay non-diagnostic, cite local evidence boundaries, and escalate urgent or concerning symptoms to veterinary care.",
    ],
    failureEscalation:
      "Mark Needs tune if WoofGuide implies provider-backed AI is active from local fallback text, hides citation or owner-review rules, suggests automatic writes, or weakens veterinary safety boundaries.",
    requiredEvidence: [
      "iOS screenshot of Provider Launch Setup showing the WoofGuide AI provider proof packet.",
      "Android screenshot of WoofGuide showing deterministic or provider-backed state with owner-review and safety boundary copy.",
      "Structured OpenAI secret storage proof file with OpenAI key location, secret storage, environment scope, rotation owner, local-placeholder exclusion, MIME, and byte size.",
      "Structured model-policy, source/citation, owner-review write-gate, veterinary-safety, and fallback/incident handling proof files with row-specific approvals, MIME, and byte size.",
    ],
    routeChecklist: [
      {
        label: "Provider Launch Setup WoofGuide AI gate",
        route: "/more",
        expected:
          "Confirm WoofGuide AI lists the WoofGuide AI provider proof packet and stays open until structured provider, safety, and policy proof files are attached.",
        proof: "Provider Launch Setup screenshot plus WoofGuide AI provider proof packet structured file note.",
      },
      {
        label: "WoofGuide model and key policy",
        route: "/woofguide",
        expected:
          "Confirm OpenAI key location, secret storage, approved model id, prompt policy, data retention stance, MIME, and byte size are present before live AI appears ready.",
        proof: "OpenAI key location secret storage and approved model-policy proof files.",
      },
      {
        label: "Source citations and owner-reviewed writes",
        route: "/woofguide",
        expected:
          "Confirm source/citation rules, source freshness boundaries, owner-review write gate, permission-aware writes, audit copy, MIME, and byte size are proven before AI suggestions can change saved care data.",
        proof: "source/citation and owner-review write gate proof files.",
      },
      {
        label: "Veterinary safety and fallback handling",
        route: "/woofguide",
        expected:
          "Confirm veterinary safety boundary, diagnosis/treatment refusal examples, emergency escalation copy, fallback behavior, rate limits, provider-error behavior, incident handling, rollback plan, support handoff, MIME, and byte size are approved before WoofGuide AI is marked ready.",
        proof: "veterinary safety boundary and fallback/incident handling proof files.",
      },
    ],
    launchRisk:
      "If this proof is skipped, live AI can be enabled without provider key controls, model policy, citation rules, owner-reviewed write gates, veterinary safety proof, fallback handling, or support incident evidence.",
  },
  {
    id: "push-notifications-proof",
    title: "Push Notifications Proof",
    route: "/more",
    priority: "launch-critical",
    goal:
      "Prove the Expo push project config, APNs credentials, Firebase/FCM credentials, permission copy, quiet hours, opt-out behavior, and delivery QA exist before reminder notifications are claimed.",
    devicePrompt:
      "In Provider Launch Setup and Reminder Center on iOS and Android, collect the Push notifications proof packet for Expo, APNs, Firebase/FCM, permission prompts, quiet hours, opt-out behavior, delivery QA, and fallback recovery.",
    setupSteps: [
      "Use local preview data and keep Push notifications marked open unless real Expo, APNs, and Firebase/FCM provider proof is attached.",
      "Open More, then Provider Launch Setup, and inspect the Push notifications gate.",
      "Open Calendar Reminder Center with quiet hours and opt-out preferences visible before attempting any delivery proof.",
      "Keep reminder delivery in blocked or in-app-only language until every provider credential, permission, and native delivery proof item exists.",
    ],
    verificationSteps: [
      "Confirm Push notifications lists the Push notifications proof packet.",
      "Confirm the packet requires Expo push project config, Expo push project id, EAS project linkage, and push token registration.",
      "Confirm APNs credentials and iOS APNs delivery proof are required before iOS delivery is trusted.",
      "Confirm Firebase/FCM credentials and Android FCM delivery proof are required before Android delivery is trusted.",
      "Confirm permission prompt copy, notification preferences, quiet hours, opt-out behavior, platform/provider-named delivery QA, and missed notification fallback are required before reminder delivery can be claimed.",
      "Capture the Provider Launch Setup and Reminder Center states on iOS and Android without marking Push notifications ready unless the real proof artifacts are attached.",
    ],
    acceptanceCriteria: [
      "reminder delivery stays blocked until Expo push project id, APNs credentials, Firebase/FCM credentials, permission prompt copy, quiet hours, opt-out behavior, delivery QA, and fallback proof are attached.",
      "iOS proof includes APNs credentials, production entitlement environment, device token registration, a platform/provider-named delivered notification artifact, permission preference, quiet-hours or opt-out proof, and fallback copy.",
      "Android proof includes Firebase/FCM credentials, notification channel behavior, token registration, a platform/provider-named delivered notification artifact, permission preference, quiet-hours or opt-out proof, and fallback copy.",
      "Quiet hours and opt-out behavior prove disabled notifications stay off, while missed reminders remain recoverable from Reminder Center.",
    ],
    failureEscalation:
      "Mark Needs tune if the app claims reminders are delivered from local Reminder Center state, hides permission or opt-out copy, skips APNs or Firebase/FCM proof, ignores quiet hours, or lacks missed notification fallback.",
    requiredEvidence: [
      "iOS screenshot of Provider Launch Setup showing the Push notifications proof packet.",
      "Android screenshot of Provider Launch Setup showing Push notifications still blocked or fully evidenced.",
      "Note confirming Expo push project id, EAS project linkage, push token registration, APNs credentials, iOS APNs delivery proof, Firebase/FCM credentials, and Android FCM delivery proof.",
      "Note confirming native delivery files or URIs include ios-apns and android-fcm naming, image MIME, byte size, token registration, delivered reminder, permission prompt copy, notification preferences, quiet hours, opt-out behavior, delivery QA, and missed notification fallback before enabling reminder delivery.",
    ],
    routeChecklist: [
      {
        label: "Provider Launch Setup push gate",
        route: "/more",
        expected:
          "Confirm Push notifications lists the Push notifications proof packet and stays open until provider proof is attached.",
        proof: "Provider Launch Setup screenshot plus Expo push project id, APNs, and Firebase/FCM proof note.",
      },
      {
        label: "iOS APNs registration and delivery",
        route: "/calendar",
        expected:
          "Confirm iOS reminder delivery has APNs credentials, device token registration, ios-apns-named delivered notification proof, permission preference, quiet-hours or opt-out proof, and fallback copy.",
        proof: "APNs credentials, iOS device token proof, ios-apns delivered notification file or URI, permission/quiet-hours proof, and fallback note.",
      },
      {
        label: "Android FCM registration and delivery",
        route: "/calendar",
        expected:
          "Confirm Android reminder delivery has Firebase/FCM credentials, notification channel behavior, token registration, android-fcm-named delivered notification proof, permission preference, quiet-hours or opt-out proof, and fallback copy.",
        proof: "Firebase/FCM credentials, android-fcm delivered notification file or URI, notification channel note, permission/quiet-hours proof, and fallback note.",
      },
      {
        label: "Permission, quiet hours, and opt-out behavior",
        route: "/calendar",
        expected:
          "Confirm permission prompt copy, notification preferences, quiet hours, opt-out behavior, and missed notification fallback are visible before Push notifications is marked ready.",
        proof: "Permission copy, quiet hours and opt-out proof, disabled-notification proof, and missed notification fallback note.",
      },
    ],
    launchRisk:
      "If this proof is skipped, missed medication or care reminders can be marketed as push-backed even though APNs, Firebase/FCM, permissions, quiet hours, and fallback behavior were never proven.",
  },
  {
    id: "payments-provider-proof",
    title: "Payments Provider Proof",
    route: "/more",
    priority: "launch-critical",
    goal:
      "Prove the Plus and Family product ids, billing path, iOS App Store and Android Google Play sandbox receipt and restore tests, entitlement mapping, refund/support policy, and checkout gate exist before paid checkout can be enabled.",
    devicePrompt:
      "In Provider Launch Setup and Premium on iOS and Android, collect the WoofWatcher Plus payments proof packet without enabling money movement or treating local preview state as paid.",
    setupSteps: [
      "Use local preview data and keep Plus payments marked open unless real store or Stripe provider proof is attached.",
      "Open More, then Provider Launch Setup, and inspect the Plus payments gate.",
      "Open Premium and confirm checkout stays disabled until product ids, billing path, iOS App Store and Android Google Play sandbox receipts, restore purchases, support/refund terms, and Apollo approval are attached.",
      "Keep every paid feature preview truthful: local entitlement previews do not count as active paid subscriptions.",
    ],
    verificationSteps: [
      "Confirm Plus payments lists the WoofWatcher Plus payments proof packet.",
      "Confirm Product catalog proof requires Plus and Family product ids, public price, currency, trial or intro offer decision, and Apollo-approved tier packaging.",
      "Confirm Billing path decision proof names App Store, Google Play, and Stripe or web checkout policy before any checkout surface is enabled.",
      "Confirm Sandbox receipt proof requires iOS App Store and Android Google Play JSON receipt evidence with platform/store naming, product id, transaction id, byte size, purchase, renewal, cancel, refund, expired receipt, and restorePurchaseConfirmed.",
      "Confirm Entitlement mapping proof covers Plus and Family feature gates, receipt-to-entitlement mapping, household role access, cancellation, and expiration downgrade.",
      "Confirm Refund and support policy plus checkout gate proof are visible before marking Plus payments ready.",
    ],
    acceptanceCriteria: [
      "paid checkout stays blocked until product catalog, billing path, iOS App Store and Android Google Play sandbox receipts, restore purchases, entitlement mapping, refund/support policy, and Apollo approval are attached.",
      "Premium and Provider Launch Setup never treat local preview state, owner-staged provider rows, or static plan copy as active paid entitlement proof.",
      "restore purchases, cancellation, refund, expiration downgrade, household role access rules, and platform/store-specific receipt files are named before the payments gate can close.",
      "No screen initiates money movement, store checkout, Stripe checkout, or subscription enforcement until the provider proof is real.",
    ],
    failureEscalation:
      "Mark Needs tune if the app enables money movement, hides iOS App Store or Android Google Play sandbox receipt or restore-purchase proof, implies Plus or Family is active from local preview state, or closes the payments gate without refund/support and Apollo approval.",
    requiredEvidence: [
      "iOS screenshot of Provider Launch Setup showing the Plus payments proof packet.",
      "Android screenshot of Provider Launch Setup showing Plus payments still blocked or fully evidenced.",
      "Note confirming Plus and Family product ids, price/currency, trial decision, App Store/Google Play/Stripe or web billing path, and Apollo tier approval.",
      "Note confirming iOS App Store and Android Google Play sandbox purchase, renewal, cancel, refund, expired receipt proof, restorePurchaseConfirmed, entitlement mapping, refund/support policy, and checkout stays disabled until approval.",
    ],
    routeChecklist: [
      {
        label: "Provider Launch Setup payments gate",
        route: "/more",
        expected:
          "Confirm Plus payments lists the WoofWatcher Plus payments proof packet and stays open until provider proof is attached.",
        proof: "Provider Launch Setup screenshot plus Plus and Family product ids, billing path, and Apollo approval note.",
      },
      {
        label: "Product catalog and billing path",
        route: "/premium",
        expected:
          "Confirm Plus and Family product ids, price/currency, trial decision, App Store/Google Play/Stripe or web billing path, and tier packaging are approved before checkout appears.",
        proof: "Plus and Family product ids, price/currency, billing path, and trial decision proof.",
      },
      {
        label: "Sandbox receipts and restore purchases",
        route: "/premium",
        expected:
          "Confirm purchase, renewal, cancel, refund, expired receipt, restore purchases, and receipt-to-entitlement behavior are proven with separate iOS App Store and Android Google Play JSON receipt evidence.",
        proof: "iOS App Store and Android Google Play sandbox receipt proof, restore purchases proof, and cancellation/expiration downgrade note.",
      },
      {
        label: "Entitlements, refunds, and checkout gate",
        route: "/premium",
        expected:
          "Confirm Plus and Family feature gates, household access rules, refund/support terms, and checkout stays disabled until Apollo approval are all visible.",
        proof: "entitlement mapping, refund/support policy, household role access, and checkout stays disabled proof.",
      },
    ],
    launchRisk:
      "If this proof is skipped, paid checkout can be enabled without product, receipt, entitlement, refund, restore-purchase, or approval evidence.",
  },
  {
    id: "store-accounts-proof",
    title: "Store Accounts Proof",
    route: "/more",
    priority: "launch-critical",
    goal:
      "Prove platform/store-named Apple Developer team id, App Store Connect app record, Google Play package record, bundle ids, reviewer access, screenshots/metadata ownership, and release role approval files before store submission can be claimed.",
    devicePrompt:
      "In Provider Launch Setup on iOS and Android, collect the Apple and Google store accounts proof packet without treating local preview state, draft metadata, or generic approval notes as App Review or Play review readiness.",
    setupSteps: [
      "Use local preview data and keep Apple and Google store accounts marked open unless real developer account and store console proof is attached.",
      "Open More, then Provider Launch Setup, and inspect the Apple and Google store accounts gate.",
      "Confirm store submission stays blocked until Apple Developer, App Store Connect, Google Play Console, reviewer access, screenshots/metadata ownership, and release role approval are proven by named proof files.",
    ],
    verificationSteps: [
      "Confirm Apple and Google store accounts lists the Apple and Google store accounts proof packet.",
      "Confirm Apple Developer team id and App Store Connect app record proof require an iOS App Store Connect proof file with MIME, byte size, role, bundle id, and paid-program status before iOS submission readiness is claimed.",
      "Confirm Google Play package record proof requires an Android Google Play proof file with MIME, byte size, package name, Play Console app id, admin role, test track, and Play app signing before Android submission readiness is claimed.",
      "Confirm bundle ids, signing ownership, reviewer access notes, screenshots/metadata ownership, and release role approval require platform/store-named proof files before marking store accounts ready.",
    ],
    acceptanceCriteria: [
      "store submission stays blocked until platform/store-named Apple Developer, App Store Connect, Google Play package, bundle id/signing, reviewer access, screenshots/metadata/privacy, and Apollo release approval proof files are attached.",
      "Provider Launch Setup never treats local-draft rows, owner-staged rows, or static store copy as App Review or Play review readiness.",
      "screenshots/metadata ownership and reviewer access remain visible, and generic approval notes stay blocked, before store accounts can close.",
    ],
    failureEscalation:
      "Mark Needs tune if the app implies App Review or Play review can start without platform/store-named Apple Developer, App Store Connect, Google Play package, reviewer access, metadata ownership, and release role proof files.",
    requiredEvidence: [
      "iOS screenshot of Provider Launch Setup showing the Apple and Google store accounts proof packet.",
      "Android screenshot of Provider Launch Setup showing Apple and Google store accounts still blocked or fully evidenced.",
      "Note confirming iOS App Store Connect developer proof file includes Apple Developer team id, App Store Connect app record, role, bundle id, paid-program status, MIME, and byte size.",
      "Note confirming Android Google Play package proof file includes Google Play package record, package name, Play Console app id, admin role, test track, app signing, MIME, and byte size.",
      "Note confirming shared platform/store-named bundle/signing, reviewer access, metadata/privacy, and Apollo release approval proof files; store submission stays blocked until approval.",
    ],
    routeChecklist: [
      {
        label: "Provider Launch Setup store accounts gate",
        route: "/more",
        expected:
          "Confirm Apple and Google store accounts lists the Apple and Google store accounts proof packet and stays open until platform/store-named provider proof files are attached.",
        proof: "Provider Launch Setup screenshot plus Apple and Google store accounts proof packet file note.",
      },
      {
        label: "Apple Developer and App Store Connect",
        route: "/more",
        expected:
          "Confirm Apple Developer team id, App Store Connect app record, bundle id/signing ownership, and reviewer access require named iOS/App Store Connect proof before iOS submission appears ready.",
        proof: "iOS App Store Connect developer account proof with Apple Developer team id, App Store Connect app record, bundle/signing, reviewer access, MIME, and byte size.",
      },
      {
        label: "Google Play package and release access",
        route: "/more",
        expected:
          "Confirm Google Play package record, Android signing ownership, test track access, and release role approval require named Android/Google Play proof before Android submission appears ready.",
        proof: "Android Google Play package proof with Google Play package record, package name, Play Console app id, signing, test track, release role, MIME, and byte size.",
      },
      {
        label: "Reviewer access, metadata, and release roles",
        route: "/more",
        expected:
          "Confirm reviewer access/test credentials, screenshots/metadata ownership, privacy labels, support URL, age rating, release roles, Apollo approval, and no-submit boundary are proven before store submission is claimed.",
        proof: "platform/store-named reviewer access, metadata/privacy, Apollo release approval, and no-submit boundary proof files.",
      },
    ],
    launchRisk:
      "If this proof is skipped, store submission can be claimed without developer account ownership, package records, reviewer access, metadata ownership, or release role approval.",
  },
  {
    id: "account-deletion-proof",
    title: "Account Deletion Proof",
    route: "/more",
    priority: "launch-critical",
    goal:
      "Prove the self-serve deletion route, reauthentication gate, export-before-delete warning, data/object deletion receipt, audit trail, recovery window, and legal/store approval with structured proof files before destructive account deletion can be enabled.",
    devicePrompt:
      "In Provider Launch Setup on iOS and Android, collect the Self-serve account deletion proof packet without treating manual request copy, local preview state, or owner-staged provider rows as destructive deletion readiness.",
    setupSteps: [
      "Use local preview data and keep Self-serve account deletion marked open unless the real deletion route, provider data deletion, audit, and legal/store proof are attached.",
      "Open More, then Provider Launch Setup, and inspect the Self-serve account deletion gate.",
      "Confirm destructive deletion stays blocked until reauthentication, export-before-delete, data/object deletion receipt, audit trail, recovery window, support escalation, and legal/store approval are proven with structured proof files.",
    ],
    verificationSteps: [
      "Confirm Self-serve account deletion lists the Self-serve account deletion proof packet.",
      "Confirm the deletion route requires reauthentication, active-household scope, destructive-action confirmation copy, and cannot delete provider data from local preview state.",
      "Confirm export-before-delete warning, owner data export link, data/object deletion receipt, audit trail, support receipt, and request id are required before destructive deletion is claimed.",
      "Confirm recovery-window policy, cancel deletion behavior, irreversible-deletion timestamp, post-window support limits, privacy language, and App Store or Play Store approval remain visible before marking deletion ready.",
    ],
    acceptanceCriteria: [
      "destructive deletion stays blocked until structured proof files are attached for self-serve deletion route/reauthentication, export-before-delete, data/object deletion receipt, audit trail/support receipt, recovery window/cancellation, and legal/store approval.",
      "Provider Launch Setup never treats manual deletion request copy, local-draft rows, owner-staged rows, or privacy copy as provider-backed deletion readiness.",
      "legal/store approval and recovery-window policy remain visible before account deletion can close.",
    ],
    failureEscalation:
      "Mark Needs tune if the app implies App Store, Play Store, or privacy deletion compliance is ready without a self-serve deletion route, reauthentication, export-before-delete, provider data/object deletion receipt, audit trail, recovery window, support receipt, and legal/store proof.",
    requiredEvidence: [
      "iOS screenshot of Provider Launch Setup showing the Self-serve account deletion proof packet.",
      "Android screenshot of Provider Launch Setup showing Self-serve account deletion still blocked or fully evidenced.",
      "Deletion route/auth proof file with self-serve route, reauthentication, active-household scope, destructive-action confirmation copy, local-preview boundary, MIME, and byte size.",
      "export-before-delete, data/object deletion receipt, audit/support receipt, recovery/cancellation, and legal/store proof files with row-specific fields, MIME, byte size, and Apollo approval.",
    ],
    routeChecklist: [
      {
        label: "Provider Launch Setup account deletion gate",
        route: "/more",
        expected:
          "Confirm Self-serve account deletion lists the Self-serve account deletion proof packet and stays open until structured provider/legal/store proof files are attached.",
        proof: "Provider Launch Setup screenshot plus Self-serve account deletion proof packet structured proof files.",
      },
      {
        label: "Deletion route and reauthentication",
        route: "/more",
        expected:
          "Confirm self-serve deletion route, reauthentication requirement, active-household scope, destructive-action confirmation copy, and local-preview boundary are proven before deletion readiness appears ready.",
        proof: "deletion-route/auth proof file with self-serve deletion route, reauthentication, active-household scope, destructive-action confirmation, MIME, and byte size.",
      },
      {
        label: "Export, deletion receipt, and audit trail",
        route: "/more",
        expected:
          "Confirm export-before-delete warning, owner data export link, provider data/object deletion receipt, audit trail, support receipt, and request id are proven before destructive deletion appears ready.",
        proof: "export-before-delete, data/object deletion receipt, and audit/support receipt proof files with request id, deletion receipt id, provider deletion coverage, MIME, and byte size.",
      },
      {
        label: "Recovery window, support, and store approval",
        route: "/more",
        expected:
          "Confirm recovery-window policy, cancel deletion behavior, irreversible-deletion timestamp, support limits, privacy language, and legal/store approval are proven before deletion compliance is claimed.",
        proof: "recovery/cancellation proof file with recovery-window policy plus legal/store approval proof file with policy references, store compliance review, support terms, Apollo approval, MIME, and byte size.",
      },
    ],
    launchRisk:
      "If this proof is skipped, destructive account deletion can be enabled or store deletion compliance can be claimed without route, auth, export, provider deletion, audit, recovery, legal, or store approval evidence.",
  },
  {
    id: "support-legal-readiness-proof",
    title: "Support Legal Readiness Proof",
    route: "/privacy",
    priority: "launch-critical",
    goal:
      "Prove the support inbox, privacy policy and terms links, refund and subscription policy, veterinary and emergency boundary, account deletion escalation, incident response owner, and Apollo approval before public launch can be claimed.",
    devicePrompt:
      "In Privacy & Safety on iOS and Android, collect the support/legal readiness packet without treating local owner-reviewed checkboxes, policy drafts, or share text as legal or store approval.",
    setupSteps: [
      "Open Privacy & Safety, then Launch support profile, and confirm support email, privacy policy URL, terms URL, and policy approvals are staged from real owner or provider decisions.",
      "Use Share support runbook to produce the support packet and keep public launch blocked until every blocker is closed with Apollo approval.",
      "Confirm local draft or owner-reviewed support profile state does not approve legal, store, provider, refund, or veterinary-boundary readiness by itself.",
    ],
    verificationSteps: [
      "Confirm Privacy & Safety shows the support inbox, privacy policy link, terms link, refund/subscription policy, veterinary boundary, deletion escalation, and incident response owner.",
      "Confirm the support runbook says WoofWatcher is not veterinary advice, diagnosis, treatment, or emergency triage.",
      "Confirm deletion escalation, account export, and support receipt expectations stay visible before public accounts or destructive deletion are claimed.",
      "Confirm public launch stays blocked until support, legal/privacy, refund/subscription, veterinary-boundary, incident response, and Apollo approval evidence is attached.",
    ],
    acceptanceCriteria: [
      "public launch stays blocked until support inbox, privacy policy, terms, refund/subscription policy, veterinary boundary, deletion escalation, incident response owner, and Apollo approval are attached.",
      "Privacy & Safety never treats local support profile drafts or owner-reviewed rows as final legal, store, provider, refund, or veterinary approval.",
      "Support runbook share text keeps emergency/veterinary boundaries visible before AI, payments, uploads, public accounts, or store review are claimed ready.",
    ],
    failureEscalation:
      "Mark Needs tune if the app implies legal, support, refund, or veterinary-boundary approval without support inbox, privacy policy, terms, refund/subscription policy, deletion escalation, incident response owner, and Apollo approval evidence.",
    requiredEvidence: [
      "iOS screenshot of Privacy & Safety support runbook showing support inbox, privacy policy, terms, and blockers.",
      "Android screenshot of Privacy & Safety support runbook showing refund and subscription policy plus veterinary boundary.",
      "Shared support runbook text showing not veterinary advice, emergency escalation, deletion escalation, incident response owner, and public launch blockers.",
      "Structured support/legal proof files for support inbox, privacy policy and terms, refund/subscription, veterinary boundary and emergency language, deletion escalation, incident response, and Apollo approval/no-launch boundary with MIME, byte size, and row-specific approvals.",
    ],
    routeChecklist: [
      {
        label: "Privacy & Safety support runbook",
        route: "/privacy",
        expected:
          "Confirm Privacy & Safety shows support inbox, privacy policy and terms links, refund/subscription policy, veterinary boundary, deletion escalation, and incident response owner before launch readiness is claimed.",
        proof:
          "Support inbox, privacy/terms, refund/subscription, veterinary/emergency boundary, deletion escalation, and incident response proof files with MIME, byte size, owner fields, and row-specific approvals.",
      },
      {
        label: "Launch support profile",
        route: "/privacy",
        expected:
          "Confirm Launch support profile keeps local draft, owner-reviewed, and provider-approved states distinct and does not treat staged links as legal or store approval.",
        proof:
          "Launch support profile screenshot plus structured Apollo launch approval/no-launch-boundary proof file; staged support links do not count without proof-file fields.",
      },
      {
        label: "Share support runbook",
        route: "/privacy",
        expected:
          "Confirm Share support runbook produces a packet with emergency boundaries, not-veterinary-advice language, deletion escalation, incident response owner, and public launch blockers.",
        proof:
          "Shared support runbook text plus structured proof files for veterinary/emergency boundary, deletion escalation, incident response owner, Apollo approval, MIME, and byte size.",
      },
    ],
    launchRisk:
      "If this proof is skipped, public launch, payments, uploads, AI, store review, or destructive deletion can be claimed without legal, support, refund, or veterinary-boundary approval.",
  },
  {
    id: "route-visual-consistency",
    title: "Route Visual Consistency",
    route: "/more",
    priority: "launch-critical",
    goal: "Prove the main mobile routes feel like one planned premium neo-retro app instead of separate prototypes.",
    devicePrompt:
      "Run Home, Log, Plans, Health, Records, and More on a small iOS and Android phone. Check the same screen recipe on each route: pixel stage, command board, primary action, safe bottom nav, and no overlapping text.",
    setupSteps: [
      "Use the current Option B visual direction: navy shell, cream HUD panels, copper accents, pixel Phoenix, and short operational labels.",
      "Start with local preview data only and keep provider, payment, AI, storage, and native proof gates truthful.",
      "Open the route through bottom navigation or a visible command row, not through a hidden debug path.",
      "Name or save each screenshot with the route label and platform before attaching it so the proof manifest can match Home-iOS through More-Android evidence.",
    ],
    verificationSteps: [
      "Open Home and confirm Phoenix Room, Care Status, Today Command, and Today's Missions read as one first-screen command center.",
      "Open Log and confirm Quick Log Flow, action tiles, and the detail dock do not fight for the same visual priority.",
      "Open Plans and confirm Today's Missions leads before the detailed schedule.",
      "Open Health and confirm Health Watch keeps calm non-diagnostic copy with no duplicate metric rails or clipped rows.",
      "Open Records and confirm Vault Command gives owners clean exits before the dense evidence sections.",
      "Open More and confirm Command Directory gives a simple map before launch, household, roster, and provider panels.",
      "On each route, check header spacing, card spacing, bottom-nav clearance, text wrapping, and one obvious next action.",
    ],
    acceptanceCriteria: [
      "Every core route starts with one clear pixel or command stage and one practical command board.",
      "Home, Log, Plans, Health, Records, and More use the same board anatomy, compact section headers, and route-to-route spacing rhythm.",
      "No first-screen text, card, sprite, tab, or bottom navigation element overlaps on a compact phone.",
      "Each route exposes a real next action that opens a care workflow, QA workflow, record, report, or route with no dead end.",
    ],
    failureEscalation:
      "Mark Needs tune for the first route with crowded hierarchy, clipped copy, duplicate avatar behavior, hidden primary action, bottom-nav overlap, or a visual style that drifts away from the Option B pixel app boards.",
    requiredEvidence: [
      "iOS screenshot of Home route top.",
      "Android screenshot of Home route top.",
      "iOS screenshot of Log route top.",
      "Android screenshot of Log route top.",
      "iOS screenshot of Plans route top.",
      "Android screenshot of Plans route top.",
      "iOS screenshot of Health route top.",
      "Android screenshot of Health route top.",
      "iOS screenshot of Records route top.",
      "Android screenshot of Records route top.",
      "iOS screenshot of More route top.",
      "Android screenshot of More route top.",
      "Route-named file names or URIs for every attachment, such as Home-iOS, Home-Android, Log-iOS, Log-Android, Plans-iOS, Plans-Android, Health-iOS, Health-Android, Records-iOS, Records-Android, More-iOS, and More-Android.",
      "Note listing the first route with overlap, confusing hierarchy, or mockup drift, or confirming no route-to-route design break was found.",
    ],
    routeChecklist: [
      {
        label: "Home",
        route: "/",
        expected:
          "Phoenix Room, Care Status, Today Command, Today's Missions, and Quick Log read as one planned first screen.",
        requiredNativePlatforms: ["ios", "android"],
      },
      {
        label: "Log",
        route: "/log",
        expected:
          "Quick Log Flow leads with tap and long-press actions, then the detail dock supports richer logs without taking over the route.",
        requiredNativePlatforms: ["ios", "android"],
      },
      {
        label: "Plans",
        route: "/calendar",
        expected:
          "Today's Missions gives the owner the next responsibility before Mission Schedule shows the full day.",
        requiredNativePlatforms: ["ios", "android"],
      },
      {
        label: "Health",
        route: "/health",
        expected:
          "Health Watch stays calm, non-diagnostic, readable, and free of duplicate metric rails or clipped review rows.",
        requiredNativePlatforms: ["ios", "android"],
      },
      {
        label: "Records",
        route: "/records",
        expected:
          "Vault Command gives clean exits for Dog ID, Record Vault, Care Pass, and Reports before dense record evidence.",
        requiredNativePlatforms: ["ios", "android"],
      },
      {
        label: "More",
        route: "/more",
        expected:
          "Command Directory maps the app before launch QA, household, provider setup, roster, tools, and diet panels.",
        requiredNativePlatforms: ["ios", "android"],
      },
    ],
    launchRisk:
      "If this pass is skipped, the app can have strong individual features but still feel visually crowded, confusing, or unplanned in an App Store preview.",
  },
  {
    id: "care-twin-state-lab",
    title: "Care Twin State Lab",
    route: "/care-twin-qa",
    priority: "launch-critical",
    goal: "Review every registered Phoenix room/sprite state through production LivingPhoenixRoom assets.",
    devicePrompt:
      "Run the 12-state matrix, mark Pass or Needs tune, add notes for crop, scale, loop timing, gait, and touch response, then share the QA summary.",
    setupSteps: [
      "Open an internal/development build where /care-twin-qa is available.",
      "Confirm the PixelLab asset verifier has passed for the current build before reviewing sprite quality.",
    ],
    verificationSteps: [
      "Open /care-twin-qa and review every care-twin scenario through the production LivingPhoenixRoom renderer.",
      "Tap the room in happy, rest, health-watch, and home-alone states and confirm the reaction fits the state.",
      "Mark each state Pass or Needs tune and note crop, scale, loop timing, gait, or touch-response issues.",
      "Attach iOS and Android screenshots for the required states before treating the matrix as release-reviewed.",
    ],
    acceptanceCriteria: [
      "Every state renders one layered Phoenix in the correct room variant with readable motion recipe copy.",
      "Tap reactions match the care state: playful when happy, calm when resting or on Health Watch.",
      "Loop timing, scale, crop, and gait are acceptable on phone-sized iOS and Android screens.",
    ],
    failureEscalation:
      "Mark Needs tune for any duplicate sprite, wrong room, awkward gait, clipped crop, unreadable HUD, or reaction that conflicts with the current care state.",
    requiredEvidence: [
      "iOS screenshot of happy idle.",
      "iOS screenshot of Health Watch state.",
      "Android screenshot of bedtime/sleep state.",
      "Shared text QA report from the native share sheet.",
    ],
    launchRisk:
      "If this pass is skipped, weak animation, stage crop, or room/sprite scale issues can ship unnoticed.",
  },
  {
    id: "avatar-studio",
    title: "Avatar Studio",
    route: "/portrait",
    priority: "launch-critical",
    goal: "Prove PixelLab-backed templates feel like intentional live care twins and unfinished states remain truthful.",
    devicePrompt:
      "Switch at least Shepherd, Retriever, Husky, Bully, Doodle, and Mixed Breed; verify live/still badges, thumbnail crispness, and no oversized overlays.",
    setupSteps: [
      "Use the current PixelLab template pack and approved Option B Phoenix runtime family.",
      "Start from Avatar Studio with no unsaved scan/import sheet covering the live stage.",
    ],
    verificationSteps: [
      "Open Avatar Studio and inspect the live Phoenix/Shepherd stage before switching templates.",
      "Switch Shepherd, Retriever, Husky, Bully, Doodle, and Mixed Breed templates and check live/still readiness badges.",
      "Confirm thumbnails render as crisp pixel assets and no still or accessory overlay covers the live sprite stage.",
      "Note any gait, crop, accessory alignment, or template identity issue before final asset approval.",
    ],
    acceptanceCriteria: [
      "Avatar Studio shows one clear care twin stage with truthful live or still readiness labels.",
      "Template thumbnails and emotes stay crisp, dog-specific, and visually distinct from Phoenix when appropriate.",
      "Accessories and still previews do not cover or compete with a live sprite stage.",
    ],
    failureEscalation:
      "Mark Needs tune for blurry art, wrong-dog fallback, oversized overlays, misleading live labels, or any template whose identity drifts from the selected breed/body type.",
    requiredEvidence: [
      "iOS screenshot with a live template selected.",
      "Android screenshot with a non-Phoenix template selected.",
      "Note any template whose gait, crop, or accessory alignment needs production polish.",
    ],
    launchRisk:
      "Avatar Studio is the product hook; fake readiness or blurry assets will break the care-twin promise.",
  },
  {
    id: "avatar-sprite-production-review",
    title: "Avatar Sprite Production Review",
    route: "/portrait",
    priority: "launch-critical",
    goal: `Review ${AVATAR_SPRITE_PRODUCTION_QA.liveTemplatePacks}/${AVATAR_SPRITE_PRODUCTION_QA.totalTemplates} PixelLab live template sprite packs for phone-size crop, gait, anchor stability, and game feel.`,
    devicePrompt:
      "Open Avatar Studio on iOS and Android, switch through every live template, and inspect idle plus walk loops as real game sprites before store screenshots or launch approval.",
    setupSteps: [
      `Confirm PixelLab asset verification passed and ${AVATAR_SPRITE_PRODUCTION_QA.totalSpriteSlots} registered template sprite slots are packaged.`,
      `Review these templates: ${AVATAR_SPRITE_PRODUCTION_QA.templates.map((template) => template.label).join(", ")}.`,
      "Start with Shepherd/Phoenix, then switch to Retriever, Husky/Spitz, Bully, Doodle, Terrier, Hound, Dachshund, Spaniel, Toy Breed, Slender, and Mixed Breed without covering the live stage.",
      "Keep unfinished provider, store, and native proof gates visible; do not treat local sprite metadata as screenshot proof.",
    ],
    verificationSteps: [
      "For each template, inspect the idle-tail-wag loop and the walk-loop at phone size.",
      ...AVATAR_SPRITE_PRODUCTION_QA.requiredChecks,
      "Mark Needs tune for the first weak gait, clipped crop, blurred sprite, duplicate avatar, or overlay collision and write the template name in the QA note.",
    ],
    acceptanceCriteria: [
      `${AVATAR_SPRITE_PRODUCTION_QA.liveTemplatePacks}/${AVATAR_SPRITE_PRODUCTION_QA.totalTemplates} launch templates expose both idle and walk sprite slots before native review.`,
      "Every template reads as a crisp pixel care twin on a small phone, not a softened still portrait.",
      "Idle, walk, and overlay behavior stays stable inside the Avatar Studio stage with one visible dog.",
      "The QA card remains Pass pending proof until iOS and Android screenshots plus the required gait/crop note are attached.",
    ],
    failureEscalation:
      "Mark Needs tune if any template has weak gait, identity drift, duplicate avatar behavior, cropped paws/tail/ears, blurred pixel scaling, unreadable phone-size silhouette, or an accessory overlay covering the face.",
    requiredEvidence: [
      "iOS screenshot of Avatar Studio with Shepherd/Phoenix live sprite.",
      "Android screenshot of Avatar Studio with a non-Phoenix live template selected.",
      "Note listing any weak gait, crop, duplicate-avatar, or accessory overlay issue by template.",
    ],
    routeChecklist: [
      {
        label: "Avatar Studio sprite stage",
        route: "/portrait",
        expected:
          "Switch through every live template and confirm crisp pixel scaling, one dog, visible idle/walk motion, and truthful Template-fitted or Pack pending labels.",
        proof:
          "Attach iOS and Android Avatar Studio screenshots plus a gait/crop note before marking proof-backed.",
      },
      {
        label: "Care Twin State Lab",
        route: "/care-twin-qa?qaSurface=care-twin-state-lab",
        expected:
          "Review the Phoenix state matrix after Avatar Studio so Home care-twin reactions and template sprite quality stay aligned.",
        proof:
          "Attach state-matrix screenshots separately; Avatar Studio proof does not replace care-twin state proof.",
      },
    ],
    launchRisk: AVATAR_SPRITE_PRODUCTION_QA.launchRisk,
  },
  {
    id: "incident-composer",
    title: "Incident Composer",
    route: "/log?type=incident&detail=1&intent=incident-composer",
    priority: "launch-critical",
    goal: "Confirm behavior-safety events can be logged with trigger, exposure, injury/action, follow-up, notes, and household visibility.",
    devicePrompt:
      "Open the Incident detail flow from Log, verify all fields fit in a phone bottom sheet, and confirm safety copy stays factual and non-diagnostic.",
    setupSteps: [
      "Use local preview data and prepare a non-real incident draft for QA only.",
      "Do not save sensitive real incident details while capturing shared QA screenshots.",
    ],
    verificationSteps: [
      "Open Log with the Incident detail flow and confirm it starts in a detail-first safety composer.",
      "Fill trigger, exposure, injury/action, follow-up, note, trust, and household visibility fields without keyboard overlap.",
      "Confirm medication or emergency-style language is not used and behavior wording stays factual and non-diagnostic.",
      "Save or cancel the draft and confirm the user can return to the prior route without losing navigation context.",
    ],
    acceptanceCriteria: [
      "Incident fields fit in the phone sheet and stay reachable with the keyboard open.",
      "The composer collects trigger, exposure, injury/action, follow-up, notes, trust, and visibility without medical or behavior diagnosis.",
      "Save, cancel, and back navigation preserve context and never strand the tester.",
    ],
    failureEscalation:
      "Mark Needs tune if keyboard overlap blocks a required field, language sounds diagnostic, trust/visibility is unclear, or navigation loses the tester after save or cancel.",
    requiredEvidence: [
      "iOS screenshot of the Incident detail composer.",
      "Android screenshot of the Incident detail composer.",
      "Note whether all fields can be completed without keyboard or bottom-nav overlap.",
    ],
    launchRisk:
      "If incident logging is clumsy, owners will skip the details that make trainer/vet handoffs useful.",
  },
  {
    id: "records-incident-watch",
    title: "Records Incident Watch",
    route: "/records",
    priority: "launch-critical",
    goal: "Confirm Incident Watch turns logged events into trend signal, follow-up tasks, trainer goals, and safe handoff language.",
    devicePrompt:
      "Review Records on a small phone screen, tap Incident Watch follow-up rows, and verify routes go to the Incident composer or trainer Care Pass preview.",
    setupSteps: [
      "Use a local preview household with at least one household-visible incident or altercation log.",
      "If Incident Watch is empty, create a QA-only incident draft first and keep screenshots free of private details.",
    ],
    verificationSteps: [
      "Open Records and locate Incident Watch trend signal, follow-up tasks, and trainer goal cards.",
      "Tap an Incident Watch follow-up row and confirm it opens the Incident composer when follow-up detail is needed.",
      "Tap trainer handoff or goal action and confirm it opens the trainer Care Pass preview rather than a dead end.",
      "Confirm every Incident Watch sentence stays factual, owner-reviewed, and non-diagnostic.",
    ],
    acceptanceCriteria: [
      "Incident Watch trend, follow-up, and trainer goal sections are readable on a small phone.",
      "Follow-up rows route to the Incident composer or trainer Care Pass preview with no dead recommendations.",
      "Every sentence stays factual, owner-reviewed, and non-diagnostic.",
    ],
    failureEscalation:
      "Mark Needs tune if a follow-up row is dead, a trainer handoff is missing, copy sounds diagnostic, or the section is too dense to scan on a phone.",
    requiredEvidence: [
      "iOS screenshot of Records Incident Watch.",
      "Android screenshot after tapping a follow-up row or trainer goal.",
      "Note any dead recommendation or unclear non-diagnostic boundary.",
    ],
    launchRisk:
      "If follow-up rows do not route to real workflows, Incident Watch becomes decorative instead of operational.",
  },
  {
    id: "trainer-care-pass",
    title: "Trainer Care Pass",
    route: "/records",
    priority: "release-polish",
    goal: "Verify trainer handoff output includes Incident Watch trend, owner follow-ups, and goal ideas without diagnosing behavior.",
    devicePrompt:
      "Preview or share the trainer Care Pass from Records, then verify incident trend/follow-up/goal lines are readable and factual.",
    setupSteps: [
      "Use Records with visible Incident Watch evidence or local preview sample data.",
      "Keep trainer handoff screenshots free of private contact details and real addresses.",
    ],
    verificationSteps: [
      "Open Records and preview the Trainer Care Pass.",
      "Confirm Incident Watch trend, owner follow-up, and trainer goal lines are included in the handoff.",
      "Share or preview the report text and confirm it remains factual, non-diagnostic, and readable on a phone.",
    ],
    acceptanceCriteria: [
      "Trainer Care Pass includes Incident Watch trend, owner follow-up, and goal context.",
      "The report remains readable, factual, and non-diagnostic when previewed or shared from a phone.",
      "Private contacts or addresses are not exposed in screenshots or share text.",
    ],
    failureEscalation:
      "Mark Needs tune if Incident Watch context is missing, report text clips, the share path is unclear, or private household details appear.",
    requiredEvidence: [
      "Screenshot of trainer Care Pass preview with Incident Watch.",
      "Shared text report snippet showing incident trend and follow-up lines.",
    ],
    launchRisk:
      "If trainer handoff language is vague, the feature loses the premium report value that supports Family/Pro packaging.",
  },
];

function slugForQaId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function routeForStoreScreenshot(screen: string): string {
  const normalized = screen.toLowerCase();
  if (normalized.includes("phoenix") || normalized.includes("home")) return "/";
  if (normalized.includes("quick log") || normalized.includes("log")) return "/log";
  if (normalized.includes("plans") || normalized.includes("schedule")) return "/calendar";
  if (normalized.includes("health")) return "/health";
  if (normalized.includes("care pass")) return "/records";
  if (normalized.includes("avatar")) return "/portrait";
  if (normalized.includes("privacy") || normalized.includes("launch gates")) return "/privacy";
  return "/care-twin-qa";
}

function storeScreenshotEvidenceFor(item: StoreScreenshotChecklistItem): string[] {
  const evidence = [
    `iOS screenshot for store packet: ${item.screen}.`,
    `Android screenshot for store packet: ${item.screen}.`,
    `Store note: ${item.requirement}`,
  ];

  if (isAvatarStudioStoreScreen(item)) {
    evidence.push("Avatar Studio Template overlay readiness panel with Template-fitted and Pack pending labels visible.");
  }

  if (isHealthWatchStoreScreen(item)) {
    evidence.push("Health Watch Review packet with Vet-share checklist and Draft vet questions visible.");
  }

  if (item.status === "blocked") {
    evidence.push("Screenshot or note showing why this store claim remains blocked before submission.");
  }

  return evidence;
}

function storeScreenshotRouteChecklistFor(
  item: StoreScreenshotChecklistItem,
  route: string,
): readonly MobileReleaseQaRouteCheck[] {
  const expected = [
    `Frame ${item.screen} for the store requirement: ${item.requirement}`,
    "Use demo-safe data and keep provider, payment, AI, storage, and store approval boundaries visible when they are not complete.",
  ];

  if (isAvatarStudioStoreScreen(item)) {
    expected.push("Keep Template-fitted and Pack pending readiness labels visible so the PixelLab overlay truth is clear.");
  }

  if (isHealthWatchStoreScreen(item)) {
    expected.push("Keep the Review packet, Vet-share checklist, Draft vet questions, and Not veterinary advice boundary visible.");
  }

  if (item.status === "blocked") {
    expected.push("Keep the blocked launch gate visible or write a blocker note instead of staging a misleading finished screenshot.");
  }

  return [
    {
      label: `${item.screen} store frame`,
      route,
      expected: expected.join(" "),
      proof:
        item.status === "blocked"
          ? `Attach iOS and Android store screenshots or a blocker note for ${item.screen}; include a store note explaining the blocker.`
          : `Attach iOS and Android store screenshots for ${item.screen}; include a store note confirming the screenshot stayed provider-safe.`,
    },
  ];
}

function storeScreenshotVerificationStepsFor(
  item: StoreScreenshotChecklistItem,
  route: string,
): string[] {
  const steps = [
    `Open ${route} and frame ${item.screen} for an App Store and Play Store safe screenshot.`,
    `Verify the screen proves this requirement: ${item.requirement}`,
    "Do not show private household data, real contact details, tokens, or credentials.",
    "Confirm the screenshot does not claim live AI, cloud storage, payments, push, or store approval unless that provider gate is actually closed.",
  ];

  if (isAvatarStudioStoreScreen(item)) {
    steps.push("Confirm Template-fitted labels are visible for Shepherd/Phoenix overlays.");
    steps.push("Confirm Pack pending labels stay visible for accessories or templates whose overlay packs are not finished.");
  }

  if (isHealthWatchStoreScreen(item)) {
    steps.push("Confirm the Review packet is visible with the Vet-share checklist.");
    steps.push("Confirm Draft vet questions is visible and the boundary still says Not veterinary advice.");
  }

  if (item.status === "blocked") {
    steps.push("If the screen is blocked, capture the visible blocker or write a note instead of staging a misleading store screenshot.");
  }

  return steps;
}

function storeScreenshotSetupStepsFor(item: StoreScreenshotChecklistItem): string[] {
  const steps = [
    "Use demo-safe or scrubbed household data before capturing any store-facing image.",
    "Set the screen to a realistic launch state without hiding unfinished provider, payment, AI, or storage gates.",
  ];

  if (isAvatarStudioStoreScreen(item)) {
    steps.push("Open Customize and keep Template overlay readiness visible before capturing the store screenshot.");
  }

  if (isHealthWatchStoreScreen(item)) {
    steps.push("Open Health and keep Review packet visible before capturing the store screenshot.");
  }

  if (item.status === "blocked") {
    steps.push("Leave the blocker visible or capture a blocker note instead of staging a misleading finished screen.");
  }

  return steps;
}

function storeScreenshotAcceptanceCriteriaFor(item: StoreScreenshotChecklistItem): string[] {
  const criteria = [
    "No private household data, real contact details, tokens, credentials, or personal addresses appear in the image.",
    "No provider claim appears unless the matching gate is actually closed in Launch Readiness.",
    `The screenshot truthfully supports the store requirement: ${item.requirement}`,
  ];

  if (isAvatarStudioStoreScreen(item)) {
    criteria.push("Avatar Studio screenshot preserves overlay-fit truth instead of implying every accessory pack is finished.");
  }

  if (isHealthWatchStoreScreen(item)) {
    criteria.push("Health Review Packet shows owner prompts, vet-share checklist, and Not veterinary advice boundary.");
  }

  if (item.status === "blocked") {
    criteria.push("Blocked screens show the blocker or blocker note instead of pretending the launch gate is complete.");
  }

  return criteria;
}

function storeScreenshotFailureEscalationFor(item: StoreScreenshotChecklistItem): string {
  if (isAvatarStudioStoreScreen(item)) {
    return `Mark Needs tune if ${item.screen} hides Template overlay readiness, blurs the pixel avatar, or implies unfinished accessory packs are store-ready.`;
  }

  if (isHealthWatchStoreScreen(item)) {
    return `Mark Needs tune if ${item.screen} hides the Review packet, omits the Vet-share checklist, loses Draft vet questions, or sounds like medical certainty.`;
  }

  if (item.status === "blocked") {
    return `Mark Needs tune and do not stage a fake finished screenshot if ${item.screen} still has provider, legal, payment, AI, storage, or store approval blockers.`;
  }

  return `Mark Needs tune if ${item.screen} exposes private data, overclaims provider readiness, crops poorly, or fails to prove the store screenshot requirement.`;
}

function isAvatarStudioStoreScreen(item: StoreScreenshotChecklistItem): boolean {
  return item.screen.toLowerCase() === "avatar studio";
}

function isHealthWatchStoreScreen(item: StoreScreenshotChecklistItem): boolean {
  return item.screen.toLowerCase() === "health watch";
}

export function buildStoreSubmissionScreenshotQaSurfaces(
  packet: StoreSubmissionPacket,
): readonly MobileReleaseQaSurface[] {
  return packet.screenshotChecklist.map((item) => {
    const blocked = item.status === "blocked";
    const route = routeForStoreScreenshot(item.screen);
    return {
      id: `store-${slugForQaId(item.screen)}`,
      title: `Store: ${item.screen}`,
      route,
      priority: blocked ? "launch-critical" : "release-polish",
      goal: `Capture store-ready ${item.screen} evidence for ${packet.title}.`,
      devicePrompt: `${item.requirement} Use App Store and Play Store safe frames, avoid private household data, and keep unfinished provider claims out of the screenshot.`,
      setupSteps: storeScreenshotSetupStepsFor(item),
      verificationSteps: storeScreenshotVerificationStepsFor(item, route),
      acceptanceCriteria: storeScreenshotAcceptanceCriteriaFor(item),
      failureEscalation: storeScreenshotFailureEscalationFor(item),
      requiredEvidence: storeScreenshotEvidenceFor(item),
      routeChecklist: storeScreenshotRouteChecklistFor(item, route),
      launchRisk: blocked
        ? `Store checklist marks ${item.screen} as blocked; do not submit until the blocker is closed and re-captured.`
        : `If ${item.screen} is missing, the store listing cannot show the product promise with truthful visual proof.`,
    };
  });
}

function reviewFor(
  reviews: readonly MobileReleaseQaReview[],
  surfaceId: string,
): MobileReleaseQaReview {
  return reviews.find((review) => review.surfaceId === surfaceId) ?? {
    surfaceId,
    status: "unreviewed",
  };
}

function screenshotRequirementPlatform(value: string): "ios" | "android" | "any" | null {
  const normalized = value.toLowerCase();
  if (!normalized.includes("screenshot")) return null;
  if (normalized.includes("ios screenshot")) return "ios";
  if (normalized.includes("android screenshot")) return "android";
  return "any";
}

function evidenceRequiresNote(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("note ") || normalized.startsWith("note:") || normalized.includes("note confirming");
}

export function mobileReleaseQaRouteProofLabel(routeCheck: MobileReleaseQaRouteCheck): string | null {
  const platforms = routeCheck.requiredNativePlatforms ?? [];
  if (!platforms.length) return routeCheck.proof ?? null;

  const platformLabel = platforms.map((platform) => (platform === "ios" ? "iOS" : "Android")).join(" + ");
  const proof = routeCheck.proof ? ` ${routeCheck.proof}` : "";
  return `${platformLabel} native screenshot required.${proof}`;
}

function routeVisualSurfaceForManifest(surface: MobileReleaseQaSurface | undefined): MobileReleaseQaSurface {
  return surface ?? listMobileReleaseQaSurfaces().find((item) => item.id === "route-visual-consistency") ?? {
    id: "route-visual-consistency",
    title: "Route Visual Consistency",
    route: "/more",
    priority: "launch-critical",
    goal: "Prove route visual consistency.",
    devicePrompt: "Capture native route proof.",
    setupSteps: [],
    verificationSteps: [],
    acceptanceCriteria: [],
    failureEscalation: "Mark Needs tune for visual drift.",
    requiredEvidence: [],
    launchRisk: "Route visual proof is required before launch.",
    routeChecklist: [],
  };
}

function routeVisualEvidenceForRoute(
  evidence: readonly QaScreenshotEvidence[],
  routeCheck: MobileReleaseQaRouteCheck,
  targetPlatform: "ios" | "android",
): QaScreenshotEvidence | undefined {
  const routeSlug = slugForQaId(routeCheck.label);
  return evidence.find((item) => {
    if (item.targetPlatform !== targetPlatform) return false;
    const evidenceLabel = slugForQaId(`${item.fileName} ${item.uri}`);
    return evidenceLabel.includes(routeSlug);
  });
}

export function buildRouteVisualProofManifest(
  input: RouteVisualProofManifestInput = {},
): RouteVisualProofManifest {
  const surface = routeVisualSurfaceForManifest(input.surface);
  const routeChecks = surface.routeChecklist ?? [];
  const evidence = input.evidence ?? [];
  const attachedIosScreenshots = evidence.filter((item) => item.targetPlatform === "ios").length;
  const attachedAndroidScreenshots = evidence.filter((item) => item.targetPlatform === "android").length;
  const rows = routeChecks.map((routeCheck) => {
    const iosEvidence = routeVisualEvidenceForRoute(evidence, routeCheck, "ios");
    const androidEvidence = routeVisualEvidenceForRoute(evidence, routeCheck, "android");
    return {
      label: routeCheck.label,
      route: routeCheck.route,
      expected: routeCheck.expected,
      iosStatus: iosEvidence
        ? `iOS ${routeCheck.label} screenshot attached: ${iosEvidence.fileName}`
        : `iOS ${routeCheck.label} screenshot pending`,
      androidStatus: androidEvidence
        ? `Android ${routeCheck.label} screenshot attached: ${androidEvidence.fileName}`
        : `Android ${routeCheck.label} screenshot pending`,
      proof: mobileReleaseQaRouteProofLabel(routeCheck) ?? "Native visual proof required.",
    };
  });
  const noteReady = Boolean(input.note?.trim());
  const blockers = rows.flatMap((row) => [
    ...(row.iosStatus.includes("pending") ? [`${row.label}: ${row.iosStatus}`] : []),
    ...(row.androidStatus.includes("pending") ? [`${row.label}: ${row.androidStatus}`] : []),
  ]);
  if (!noteReady) {
    blockers.push("QA note pending: list the first overlap, confusing hierarchy, mockup drift, or confirm no route-to-route design break was found.");
  }

  return {
    title: "Route visual proof manifest",
    status: blockers.length ? "blocked" : "ready",
    statusLabel: blockers.length ? "Native proof blocked" : "Native visual proof complete",
    requiredIosScreenshots: routeChecks.length,
    requiredAndroidScreenshots: routeChecks.length,
    attachedIosScreenshots,
    attachedAndroidScreenshots,
    rows,
    blockers,
    webPreviewBoundary:
      "Web preview route proof can catch shell regressions, but it does not replace native iOS/Android route screenshots, safe-area review, touch proof, or Apollo visual sign-off.",
  };
}

function pluralLabel(value: number, label: string): string {
  return `${value} ${label}${value === 1 ? "" : "s"}`;
}

export function mobileReleaseQaMissingEvidenceForSurface(
  surface: MobileReleaseQaSurface,
  review: MobileReleaseQaReview,
): string[] {
  const requiredPlatforms = surface.requiredEvidence
    .map(screenshotRequirementPlatform)
    .filter((platform): platform is "ios" | "android" | "any" => !!platform);
  const requiredIos = requiredPlatforms.filter((platform) => platform === "ios").length;
  const requiredAndroid = requiredPlatforms.filter((platform) => platform === "android").length;
  const requiredAny = requiredPlatforms.filter((platform) => platform === "any").length;
  const evidence = review.screenshotEvidence ?? [];
  const requiresNote = surface.requiredEvidence.some(evidenceRequiresNote);
  const hasNote = Boolean(review.note?.trim());
  const attachedIos = evidence.filter((item) => item.targetPlatform === "ios").length;
  const attachedAndroid = evidence.filter((item) => item.targetPlatform === "android").length;
  const platformSpecificUsed = Math.min(requiredIos, attachedIos) + Math.min(requiredAndroid, attachedAndroid);
  const flexibleAvailable = Math.max(0, evidence.length - platformSpecificUsed);
  const missingIos = Math.max(0, requiredIos - attachedIos);
  const missingAndroid = Math.max(0, requiredAndroid - attachedAndroid);
  const missingAny = Math.max(0, requiredAny - flexibleAvailable);
  const missing: string[] = [];

  if (missingIos > 0) missing.push(`Attach ${pluralLabel(missingIos, "iOS screenshot")} for ${surface.title}.`);
  if (missingAndroid > 0) {
    missing.push(`Attach ${pluralLabel(missingAndroid, "Android screenshot")} for ${surface.title}.`);
  }
  if (missingAny > 0) missing.push(`Attach ${pluralLabel(missingAny, "screenshot")} for ${surface.title}.`);
  if (requiresNote && !hasNote) missing.push(`Add QA note for ${surface.title}.`);

  if (!missing.length && review.status === "unreviewed") {
    missing.push(`Mark Pass or Needs tune for ${surface.title}.`);
  }
  if (!missing.length && review.status === "needs-review") {
    missing.push(`Resolve Needs tune notes for ${surface.title}.`);
  }

  return missing;
}

export function listMobileReleaseQaSurfaces(): readonly MobileReleaseQaSurface[] {
  return MOBILE_RELEASE_QA_SURFACES;
}

export function mobileReleaseQaStatusLabel(status: MobileReleaseQaReviewStatus): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "needs-review":
      return "Needs tune";
    default:
      return "Unreviewed";
  }
}

export function mobileReleaseQaReviewStatusLabel(
  surface: MobileReleaseQaSurface,
  review: MobileReleaseQaReview,
): string {
  if (review.status === "pass" && mobileReleaseQaMissingEvidenceForSurface(surface, review).length > 0) {
    return "Pass pending proof";
  }

  return mobileReleaseQaStatusLabel(review.status);
}

export function summarizeMobileReleaseQaReviews(
  surfaces: readonly MobileReleaseQaSurface[],
  reviews: readonly MobileReleaseQaReview[],
): MobileReleaseQaSummary {
  const surfaceReviews = surfaces.map((surface) => ({
    surface,
    review: reviewFor(reviews, surface.id),
  }));
  const statuses = surfaceReviews.map(({ review }) => review.status);
  const passed = statuses.filter((status) => status === "pass").length;
  const passPendingProof = surfaceReviews.filter(
    ({ surface, review }) =>
      review.status === "pass" && mobileReleaseQaMissingEvidenceForSurface(surface, review).length > 0,
  ).length;
  const needsReview = statuses.filter((status) => status === "needs-review").length;
  const requiredScreenshotPlatforms = surfaces.flatMap((surface) =>
    surface.requiredEvidence
      .map(screenshotRequirementPlatform)
      .filter((platform): platform is "ios" | "android" | "any" => !!platform),
  );
  const requiredScreenshots = requiredScreenshotPlatforms.length;
  const requiredIosScreenshots = requiredScreenshotPlatforms.filter((platform) => platform === "ios").length;
  const requiredAndroidScreenshots = requiredScreenshotPlatforms.filter((platform) => platform === "android").length;
  const requiredAnyScreenshots = requiredScreenshotPlatforms.filter((platform) => platform === "any").length;
  const screenshotEvidence = surfaces.flatMap((surface) => reviewFor(reviews, surface.id).screenshotEvidence ?? []);
  const attachedScreenshots = screenshotEvidence.length;
  const attachedIosScreenshots = screenshotEvidence.filter((item) => item.targetPlatform === "ios").length;
  const attachedAndroidScreenshots = screenshotEvidence.filter((item) => item.targetPlatform === "android").length;
  const attachedOtherScreenshots = screenshotEvidence.filter(
    (item) => item.targetPlatform !== "ios" && item.targetPlatform !== "android",
  ).length;
  const missingIosScreenshots = Math.max(0, requiredIosScreenshots - attachedIosScreenshots);
  const missingAndroidScreenshots = Math.max(0, requiredAndroidScreenshots - attachedAndroidScreenshots);
  const platformSurplusScreenshots =
    Math.max(0, attachedIosScreenshots - requiredIosScreenshots) +
    Math.max(0, attachedAndroidScreenshots - requiredAndroidScreenshots) +
    attachedOtherScreenshots;
  const missingAnyScreenshots = Math.max(0, requiredAnyScreenshots - platformSurplusScreenshots);

  return {
    total: surfaces.length,
    passed,
    passedWithRequiredProof: passed - passPendingProof,
    passPendingProof,
    needsReview,
    unreviewed: Math.max(0, surfaces.length - passed - needsReview),
    requiredScreenshots,
    requiredIosScreenshots,
    requiredAndroidScreenshots,
    requiredAnyScreenshots,
    attachedScreenshots,
    attachedIosScreenshots,
    attachedAndroidScreenshots,
    attachedOtherScreenshots,
    missingScreenshots: missingIosScreenshots + missingAndroidScreenshots + missingAnyScreenshots,
    missingIosScreenshots,
    missingAndroidScreenshots,
    missingAnyScreenshots,
  };
}

export function mobileReleaseQaScreenshotEvidenceComplete(summary: MobileReleaseQaSummary): boolean {
  return (
    summary.missingIosScreenshots === 0 &&
    summary.missingAndroidScreenshots === 0 &&
    summary.missingAnyScreenshots === 0
  );
}

export function mobileReleaseQaFlexibleScreenshotSlotsSatisfied(summary: MobileReleaseQaSummary): number {
  return Math.min(summary.requiredAnyScreenshots, Math.max(0, summary.requiredAnyScreenshots - summary.missingAnyScreenshots));
}

export function formatMobileReleaseQaPlatformEvidence(summary: MobileReleaseQaSummary): string {
  return `iOS ${summary.attachedIosScreenshots}/${summary.requiredIosScreenshots}, Android ${summary.attachedAndroidScreenshots}/${summary.requiredAndroidScreenshots}, flexible ${mobileReleaseQaFlexibleScreenshotSlotsSatisfied(summary)}/${summary.requiredAnyScreenshots}`;
}

export function formatMobileReleaseQaMissingEvidence(summary: MobileReleaseQaSummary): string {
  const missing = [
    summary.missingIosScreenshots > 0 ? `${summary.missingIosScreenshots} iOS` : "",
    summary.missingAndroidScreenshots > 0 ? `${summary.missingAndroidScreenshots} Android` : "",
    summary.missingAnyScreenshots > 0 ? `${summary.missingAnyScreenshots} flexible` : "",
  ].filter(Boolean);

  return missing.length ? `Missing ${missing.join(", ")}` : "All required platform evidence attached";
}

export function buildMobileReleaseQaShareText(
  surfaces: readonly MobileReleaseQaSurface[],
  reviews: readonly MobileReleaseQaReview[],
  reviewedAtIso = new Date().toISOString(),
): string {
  const summary = summarizeMobileReleaseQaReviews(surfaces, reviews);
  const lines = [
    "WoofWatcher Mobile Release QA",
    `Reviewed: ${reviewedAtIso}`,
    `Summary: ${summary.passed}/${summary.total} passed, ${summary.passedWithRequiredProof} proof-backed pass, ${summary.passPendingProof} pass pending proof, ${summary.needsReview} needs tune, ${summary.unreviewed} unreviewed.`,
    `Required screenshot slots: ${summary.requiredScreenshots}.`,
    `Screenshot evidence: ${summary.attachedScreenshots} attached, ${summary.missingScreenshots} still missing.`,
    `Platform evidence: ${formatMobileReleaseQaPlatformEvidence(summary)}.`,
    `Evidence gap: ${formatMobileReleaseQaMissingEvidence(summary)}.`,
    "",
    "Workflow notes:",
  ];

  for (const surface of surfaces) {
    const review = reviewFor(reviews, surface.id);
    const note = review.note?.trim();
    const missingEvidence = mobileReleaseQaMissingEvidenceForSurface(surface, review);

    lines.push(
      `- ${surface.title}: ${mobileReleaseQaReviewStatusLabel(surface, review)} | route=${surface.route} | priority=${surface.priority}`,
    );
    lines.push(`  Goal: ${surface.goal}`);
    lines.push(`  Setup: ${surface.setupSteps.join(" ")}`);
    lines.push(`  Steps: ${surface.verificationSteps.join(" ")}`);
    lines.push(`  Pass criteria: ${surface.acceptanceCriteria.join(" ")}`);
    lines.push(`  Needs tune if: ${surface.failureEscalation}`);

    if (surface.routeChecklist?.length) {
      lines.push("  Route checklist:");
      for (const routeCheck of surface.routeChecklist) {
        const routeProof = mobileReleaseQaRouteProofLabel(routeCheck);
        lines.push(`    - ${routeCheck.label}: ${routeCheck.route} | ${routeCheck.expected}`);
        if (routeProof) lines.push(`      Proof: ${routeProof}`);
      }
    }

    if (missingEvidence.length && review.status === "pass") {
      lines.push(`  Missing proof: ${missingEvidence.join(" ")}`);
    }

    if (note) {
      lines.push(`  Note: ${note}`);
    }

    if (review.screenshotEvidence?.length) {
      lines.push(`  Screenshots: ${qaScreenshotEvidenceNames(review.screenshotEvidence)}`);
    }
  }

  lines.push(
    "",
    "Launch boundary: this report is a device-session checklist. It does not replace attached iOS/Android screenshots or human review before release approval.",
  );

  return lines.join("\n");
}

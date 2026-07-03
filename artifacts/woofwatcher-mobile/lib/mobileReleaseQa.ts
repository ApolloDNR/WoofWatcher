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
      "In Records, confirm Care Pass Report History storage status says Saved on this device or Ready to upload, not provider-backed upload unless the provider gate is actually closed.",
    ],
    acceptanceCriteria: [
      "The bottom-nav loop never hides the active action, gets stuck behind a modal, or routes to a blank screen.",
      "Quick Log, Plans, Health, More, Adventure Mode, Records, Avatar Studio, and Care Pass each expose a clear next action.",
      "Launch Readiness keeps internal beta, provider setup, store approval, payments, AI, and storage boundaries truthful.",
      "Care Pass Report History shows Saved on this device or Ready to upload without implying cloud-backed storage before upload rules exist.",
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
      "Open Records and confirm Care Pass Report History storage status says Saved on this device or Ready to upload.",
      "Share or print the Care Pass Report History artifact and confirm the Printable HTML local file, file name, file size, and PDF pending copy are visible.",
      "Share the Dog ID local HTML credential and confirm it saves under WoofWatcherCredentials before opening the native share sheet.",
      "Share the Dog ID SVG image source and confirm it saves under WoofWatcherCredentials with image/svg+xml behavior, not an HTML fallback filename.",
      "On Android, confirm at least one Records local file handoff uses the Android content URI when available.",
      "On either platform, force or note the fallback copy path if local file sharing is unavailable, and confirm it names the local-only boundary.",
    ],
    acceptanceCriteria: [
      "Care Pass Report History shows Saved on this device or Ready to upload and names the Printable HTML local file with PDF pending copy.",
      "Dog ID can share a local HTML credential file and SVG image source from WoofWatcherCredentials.",
      "Android content URI behavior and fallback copy are captured instead of guessed.",
      "PNG/PDF export stays pending, and Records never claims provider-backed storage, generated PDF, credential PNG/PDF, or cloud sync unless those gates are actually closed.",
    ],
    failureEscalation:
      "Mark Needs tune if Records hides the saved file name, misses the Android content URI path, loses fallback copy, claims provider-backed storage, or implies PNG/PDF export is complete.",
    requiredEvidence: [
      "iOS screenshot of Care Pass Report History showing local HTML storage status.",
      "Android screenshot of Dog ID local HTML or SVG share sheet.",
      "Note confirming WoofWatcherReports saved Printable HTML local file name, file size, and PDF pending copy.",
      "Note confirming WoofWatcherCredentials saved local HTML credential and SVG image source, Android content URI behavior, fallback copy, and PNG/PDF export stays pending.",
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
          "Confirm the SVG image source saves with image/svg+xml behavior and keeps PNG/PDF pending copy visible.",
        proof: "SVG image source share proof and Mission note naming the PNG/PDF boundary.",
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
      "Prove the approved Care Pass PDF generator, Dog ID PNG renderer, provider storage policy, and native artifact evidence exist before binary export readiness can be claimed.",
    devicePrompt:
      "In Provider Launch Setup on iOS and Android, collect the Records/media storage proof packet for approved PDF/PNG generators, provider storage, and generated artifact evidence.",
    setupSteps: [
      "Use local preview data and keep PDF/PNG actions pending until the generator and provider proof exists.",
      "Open More, then Provider Launch Setup, and inspect the Records and media storage gate.",
      "Confirm the PDF path names an approved generator such as expo-print or provider renderer before any PDF action is considered ready.",
      "Confirm the PNG path names an approved renderer such as react-native-view-shot or server renderer before any Dog ID PNG action is considered ready.",
    ],
    verificationSteps: [
      "Open Provider Launch Setup and confirm Records and media storage shows the Report binary export proof packet.",
      "Confirm the packet names Care Pass PDF, Dog ID PNG, provider storage policy, and iOS/Android artifact proof.",
      "In Records, verify the Care Pass Report History still shows Printable HTML/PDF pending unless generated PDF file name, file size, MIME proof, and share/reopen proof exist.",
      "In Records, verify Dog ID still shows local HTML/SVG source and PNG pending unless generated PNG file name, file size, MIME proof, and share/reopen proof exist.",
      "Capture or attach the provider storage policy for report PDFs, credential PNG/SVG/HTML, and QA evidence before clearing the storage gate.",
    ],
    acceptanceCriteria: [
      "No PDF/PNG readiness is claimed until approved generator choice, provider storage policy, and generated artifact proof are attached.",
      "Care Pass PDF proof includes iOS and Android generated artifact evidence, file name, file size, MIME proof, share/reopen proof, and no HTML-only fallback in the PDF action.",
      "Dog ID PNG proof includes iOS and Android generated artifact evidence, file name, file size, MIME proof, share/reopen proof, and SVG source retained as fallback.",
      "Provider storage proof covers household-scoped signed upload/download, retention, export, deletion, and QA evidence storage.",
    ],
    failureEscalation:
      "Mark Needs tune if the app treats HTML-only fallback as PDF proof, treats SVG source as PNG proof, hides file name/size/MIME evidence, or implies provider storage is ready without signed upload/download policy.",
    requiredEvidence: [
      "iOS screenshot of Provider Launch Setup showing the Report binary export proof packet.",
      "Android screenshot of generated PDF and PNG artifact proof or the still-pending proof packet.",
      "Note confirming approved Care Pass PDF generator and approved Dog ID PNG renderer choices.",
      "Note confirming provider storage policy for report PDFs, credential PNG/SVG/HTML, and QA evidence.",
    ],
    routeChecklist: [
      {
        label: "Provider Launch Setup storage gate",
        route: "/more",
        expected:
          "Confirm Records and media storage lists the Report binary export proof packet before binary readiness can be claimed.",
        proof: "Provider-approved generator and storage policy note.",
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

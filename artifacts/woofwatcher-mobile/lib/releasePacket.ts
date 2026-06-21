import type {
  LaunchReadinessPlan,
  LaunchReadinessTile,
  LaunchReadinessTileStatus,
} from "./launchReadiness.ts";

export interface ReleasePacketOptions {
  appName?: string;
  buildName?: string;
  generatedAtIso?: string;
}

export interface ReleasePacketGateRow {
  label: string;
  value: string;
  detail: string;
  status: LaunchReadinessTileStatus;
  statusLabel: string;
}

export interface ReleasePacket {
  title: string;
  buildName: string;
  generatedAtIso: string;
  generatedAtLabel: string;
  readinessScore: number;
  statusBadge: string;
  storeLaunchReady: boolean;
  verdictLabel: string;
  ownerSummary: string;
  gateRows: ReleasePacketGateRow[];
  blockers: string[];
  nextActions: string[];
  ownerApprovalChecklist: string[];
  handoffNotes: string[];
}

function normalizeGeneratedAt(input: string | undefined): string {
  const parsed = input ? new Date(input) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function formatDateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function tileStatusLabel(status: LaunchReadinessTileStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "local":
      return "Local preview";
    case "review":
      return "Needs review";
    default:
      return "Blocked";
  }
}

function tileScore(status: LaunchReadinessTileStatus): number {
  switch (status) {
    case "ready":
      return 1;
    case "local":
      return 0.62;
    case "review":
      return 0.42;
    default:
      return 0.16;
  }
}

function estimateReadinessScore(plan: LaunchReadinessPlan): number {
  if (plan.storeLaunchReady) return 100;
  if (!plan.tiles.length) return 0;
  const weighted = plan.tiles.reduce((sum, tile) => sum + tileScore(tile.status), 0) / plan.tiles.length;
  const blockerPenalty = Math.min(18, Math.max(0, plan.blockers.length - 3) * 2);
  return Math.max(5, Math.min(94, Math.round(weighted * 100) - blockerPenalty));
}

function toGateRow(tile: LaunchReadinessTile): ReleasePacketGateRow {
  return {
    label: tile.label,
    value: tile.value,
    detail: tile.detail,
    status: tile.status,
    statusLabel: tileStatusLabel(tile.status),
  };
}

function buildOwnerApprovalChecklist(plan: LaunchReadinessPlan): string[] {
  if (plan.storeLaunchReady) {
    return [
      "Ready: Apple and Google store accounts confirmed.",
      "Approved: privacy/legal language and support runbook are complete.",
      "Enabled: account deletion, push notifications, payments, AI, and storage gates are configured.",
      "Complete: native iOS and Android QA evidence is attached.",
    ];
  }

  const checklist = [
    "Apple and Google store account setup must be confirmed by Apollo before submission.",
    "Privacy/legal approval must be completed before subscriptions or public release.",
    "Support and incident-response runbook must be approved before launch.",
    "Self-serve account deletion and export behavior must be approved before public accounts.",
  ];

  if (plan.blockers.some((blocker) => /AI provider/i.test(blocker))) {
    checklist.push("WoofGuide AI provider keys, model policy, and health boundary copy still need approval.");
  }
  if (plan.blockers.some((blocker) => /Payments/i.test(blocker))) {
    checklist.push("Payments stay disabled until subscription, refund, support, and app-store obligations are closed.");
  }
  if (plan.blockers.some((blocker) => /Native iOS\/Android/i.test(blocker))) {
    checklist.push("Real iOS and Android screenshots must be captured in the Mobile Release QA cockpit.");
  }

  return checklist;
}

function buildHandoffNotes(plan: LaunchReadinessPlan, buildName: string): string[] {
  const notes = [
    `Build scope: ${buildName}.`,
    "No App Store or Play Store submission is approved by this packet.",
    "Provider-backed auth, database, storage, AI, push, and payments must stay truthful until credentials and policies are configured.",
    "Care logs, Health Watch, Bile Watch, records, reports, and privacy exports remain local-first unless provider sync is explicitly enabled.",
  ];

  if (plan.storeLaunchReady) {
    notes[1] = "App Store and Play Store submission can be prepared after final owner sign-off.";
  }

  return notes;
}

export function buildReleasePacket(
  plan: LaunchReadinessPlan,
  options: ReleasePacketOptions = {},
): ReleasePacket {
  const appName = options.appName?.trim() || "WoofWatcher";
  const buildName = options.buildName?.trim() || "local mobile preview";
  const generatedAtIso = normalizeGeneratedAt(options.generatedAtIso);
  const verdictLabel = plan.storeLaunchReady ? "Ready for release submission" : "Not ready for public launch";
  const ownerSummary = plan.storeLaunchReady
    ? `${appName} has cleared the current launch-readiness gates. Prepare the store submission packet and complete final owner sign-off.`
    : `${appName} is hardened for internal review, but public launch still needs the open gates below closed and owner-approved.`;

  return {
    title: `${appName} Release Packet`,
    buildName,
    generatedAtIso,
    generatedAtLabel: formatDateLabel(generatedAtIso),
    readinessScore: estimateReadinessScore(plan),
    statusBadge: plan.badgeLabel,
    storeLaunchReady: plan.storeLaunchReady,
    verdictLabel,
    ownerSummary,
    gateRows: plan.tiles.map(toGateRow),
    blockers: [...plan.blockers],
    nextActions: [...plan.nextActions],
    ownerApprovalChecklist: buildOwnerApprovalChecklist(plan),
    handoffNotes: buildHandoffNotes(plan, buildName),
  };
}

function formatList(items: readonly string[], fallback: string): string {
  if (!items.length) return `- ${fallback}`;
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildReleasePacketShareText(packet: ReleasePacket): string {
  const gateLines = packet.gateRows.map((row) => `- ${row.label}: ${row.statusLabel} - ${row.value}`);

  return [
    packet.title,
    `Build: ${packet.buildName}`,
    `Generated: ${packet.generatedAtLabel}`,
    `Verdict: ${packet.verdictLabel}`,
    `Readiness score: ${packet.readinessScore}%`,
    "",
    packet.ownerSummary,
    "",
    "Launch gates:",
    gateLines.join("\n"),
    "",
    "Open blockers:",
    formatList(packet.blockers, "No launch blockers in this packet."),
    "",
    "Next actions:",
    formatList(packet.nextActions, "Prepare App Store and Play Store release submission packet."),
    "",
    "Owner approvals:",
    formatList(packet.ownerApprovalChecklist, "Final owner sign-off required."),
    "",
    "Handoff notes:",
    formatList(packet.handoffNotes, "Keep public-release claims truthful until store submission is approved."),
  ].join("\n");
}

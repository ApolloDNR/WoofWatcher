export type QuickLogFieldFlowItem = {
  id: "skill" | "nextPractice" | "trigger" | "exposure" | "injury" | "action" | "followUp";
  accessibilityLabel: string;
  returnKeyType: "next" | "done";
};

const TRAINING_QUICK_LOG_FIELD_FLOW: QuickLogFieldFlowItem[] = [
  {
    id: "skill",
    accessibilityLabel: "Training skill or cue",
    returnKeyType: "next",
  },
  {
    id: "nextPractice",
    accessibilityLabel: "Training next practice",
    returnKeyType: "done",
  },
];

const INCIDENT_QUICK_LOG_FIELD_FLOW: QuickLogFieldFlowItem[] = [
  {
    id: "trigger",
    accessibilityLabel: "Incident trigger or context",
    returnKeyType: "next",
  },
  {
    id: "exposure",
    accessibilityLabel: "Who or what was involved in the incident",
    returnKeyType: "next",
  },
  {
    id: "injury",
    accessibilityLabel: "Incident injury check",
    returnKeyType: "next",
  },
  {
    id: "action",
    accessibilityLabel: "Action taken after the incident",
    returnKeyType: "next",
  },
  {
    id: "followUp",
    accessibilityLabel: "Incident follow-up",
    returnKeyType: "done",
  },
];

export function getTrainingQuickLogFieldFlow(): QuickLogFieldFlowItem[] {
  return TRAINING_QUICK_LOG_FIELD_FLOW.map((field) => ({ ...field }));
}

export function getIncidentQuickLogFieldFlow(): QuickLogFieldFlowItem[] {
  return INCIDENT_QUICK_LOG_FIELD_FLOW.map((field) => ({ ...field }));
}

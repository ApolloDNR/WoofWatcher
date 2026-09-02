export type QuickLogFieldFlowItem = {
  id: "servedAmount" | "expectedPortion" | "eatenAmount" | "dose" | "medicationNote" | "skill" | "nextPractice" | "aloneTrigger" | "recoveryMinutes" | "calmingSupport" | "trigger" | "exposure" | "injury" | "action" | "followUp" | "condition" | "products" | "nextDue";
  accessibilityLabel: string;
  returnKeyType: "next" | "done";
};

const ALONE_QUICK_LOG_FIELD_FLOW: QuickLogFieldFlowItem[] = [
  { id: "aloneTrigger", accessibilityLabel: "Alone Time trigger or context", returnKeyType: "next" },
  { id: "recoveryMinutes", accessibilityLabel: "Alone Time recovery minutes", returnKeyType: "next" },
  { id: "calmingSupport", accessibilityLabel: "Alone Time calming support", returnKeyType: "done" },
];

const MEDICATION_QUICK_LOG_FIELD_FLOW: QuickLogFieldFlowItem[] = [
  {
    id: "dose",
    accessibilityLabel: "Medication dose",
    returnKeyType: "next",
  },
  {
    id: "medicationNote",
    accessibilityLabel: "Medication side effects, refill note, or unusual context",
    returnKeyType: "done",
  },
];

const MEAL_QUICK_LOG_FIELD_FLOW: QuickLogFieldFlowItem[] = [
  {
    id: "servedAmount",
    accessibilityLabel: "Meal served amount",
    returnKeyType: "next",
  },
  {
    id: "expectedPortion",
    accessibilityLabel: "Meal expected portion",
    returnKeyType: "next",
  },
  {
    id: "eatenAmount",
    accessibilityLabel: "Meal eaten amount",
    returnKeyType: "done",
  },
];

const GROOMING_QUICK_LOG_FIELD_FLOW: QuickLogFieldFlowItem[] = [
  {
    id: "condition",
    accessibilityLabel: "Grooming coat or skin note",
    returnKeyType: "next",
  },
  {
    id: "products",
    accessibilityLabel: "Grooming products used",
    returnKeyType: "next",
  },
  {
    id: "nextDue",
    accessibilityLabel: "Grooming next due date",
    returnKeyType: "done",
  },
];

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

export function getAloneQuickLogFieldFlow(): QuickLogFieldFlowItem[] {
  return ALONE_QUICK_LOG_FIELD_FLOW.map((field) => ({ ...field }));
}

export function getMealQuickLogFieldFlow(): QuickLogFieldFlowItem[] {
  return MEAL_QUICK_LOG_FIELD_FLOW.map((field) => ({ ...field }));
}

export function getMedicationQuickLogFieldFlow(): QuickLogFieldFlowItem[] {
  return MEDICATION_QUICK_LOG_FIELD_FLOW.map((field) => ({ ...field }));
}

export function getIncidentQuickLogFieldFlow(): QuickLogFieldFlowItem[] {
  return INCIDENT_QUICK_LOG_FIELD_FLOW.map((field) => ({ ...field }));
}

export function getGroomingQuickLogFieldFlow(): QuickLogFieldFlowItem[] {
  return GROOMING_QUICK_LOG_FIELD_FLOW.map((field) => ({ ...field }));
}

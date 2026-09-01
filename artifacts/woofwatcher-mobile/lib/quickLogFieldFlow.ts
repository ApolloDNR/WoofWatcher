export type QuickLogFieldFlowItem = {
  id: "skill" | "nextPractice";
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

export function getTrainingQuickLogFieldFlow(): QuickLogFieldFlowItem[] {
  return TRAINING_QUICK_LOG_FIELD_FLOW.map((field) => ({ ...field }));
}

import { canonicalFastLogRoute } from "./canonicalRouteBuilders.ts";

export type PrimaryTabTaskId =
  | "fast-log"
  | "fast-log-from-log"
  | "log-history";

export interface PrimaryTabTaskEffects {
  navigate: (route: string) => void;
  selectLogView: (view: "history") => void;
}

export type NextPlanVisibleControlInput =
  | Readonly<{
      kind: "add";
      title: string;
      detail: string;
      actionLabel: string;
    }>
  | Readonly<{
      kind: "edit";
      title: string;
      detail: string;
      actionLabel: string;
      routineId: string;
    }>
  | Readonly<{
      kind: "status";
      title: string;
      detail: string;
      actionLabel: string;
    }>;

export interface NextPlanVisibleControl {
  id: "next-plan";
  eyebrow: "Next Mission";
  title: string;
  detail: string;
  actionLabel: string;
  visibleTapCount: 1;
  onPress: () => void;
}

export interface NextPlanVisibleControlEffects {
  addRoutine: () => void;
  editRoutine: (routineId: string) => void;
}

export interface HealthLogDetailDestination {
  pathname: "/log";
  params: Readonly<{ type: string; detail: "1" }>;
}

export interface HealthStatusControlSource {
  label: string;
  status: string;
  detail: string;
  routeType: string;
  actionLabel: string;
}

export function buildNextPlanVisibleControl(
  input: NextPlanVisibleControlInput,
  effects: NextPlanVisibleControlEffects,
): NextPlanVisibleControl {
  return {
    id: "next-plan",
    eyebrow: "Next Mission",
    title: input.title,
    detail: input.detail,
    actionLabel: input.actionLabel,
    visibleTapCount: 1,
    onPress: () => {
      if (input.kind === "add") {
        effects.addRoutine();
        return;
      }
      if (input.kind === "edit") effects.editRoutine(input.routineId);
    },
  };
}

export function buildVisibleHealthStatusControls<T extends HealthStatusControlSource>(
  rows: readonly T[],
  effects: {
    openLogDetail: (destination: HealthLogDetailDestination) => void;
  },
): Array<T & { visibleTapCount: 1; onPress: () => void }> {
  return rows.slice(0, 4).map((row) => ({
    ...row,
    visibleTapCount: 1,
    onPress: () => effects.openLogDetail({
      pathname: "/log",
      params: { type: row.routeType, detail: "1" },
    }),
  }));
}

export function executePrimaryTabTaskPath(
  id: PrimaryTabTaskId,
  effects: PrimaryTabTaskEffects,
): void {
  if (id === "fast-log" || id === "fast-log-from-log") {
    effects.navigate(canonicalFastLogRoute());
    return;
  }
  effects.selectLogView("history");
}

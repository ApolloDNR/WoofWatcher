import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

const MOBILE_ROOT = existsSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile"),
)
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();
const LOG_PATH = join(MOBILE_ROOT, "app", "(tabs)", "log.tsx");

type ComposerIntent = {
  revision: number;
  type: string;
  preset: Record<string, string> | null;
};

type ComposerIntentSource =
  | { kind: "route"; type: string }
  | {
      kind: "launcher";
      type: string;
      preset?: Record<string, string>;
    };

type LogTypeConfig = {
  type: string;
  groups?: Array<{
    key: string;
    noDefault?: boolean;
    options: Array<{ id: string }>;
  }>;
};

type LauncherAction = {
  label: string;
  type: string;
  preset?: Record<string, string>;
};

function readLogSourceFile(): ts.SourceFile {
  const source = readFileSync(LOG_PATH, "utf8");
  return ts.createSourceFile(
    LOG_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function loadStandaloneFunction<T>(name: string): T {
  const sourceFile = readLogSourceFile();
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );

  assert.ok(declaration, `Log must expose executable ${name} behavior`);
  const compiled = ts.transpileModule(declaration.getText(sourceFile), {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return Function(`"use strict"; ${compiled}; return ${name};`)() as T;
}

function loadLogTypeConfig(type: "mood" | "symptom"): LogTypeConfig {
  const sourceFile = readLogSourceFile();
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.VariableStatement =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (item) => ts.isIdentifier(item.name) && item.name.text === "LOG_TYPES",
      ),
  );
  assert.ok(declaration, "expected LOG_TYPES declaration");
  const logTypes = declaration.declarationList.declarations.find(
    (item) => ts.isIdentifier(item.name) && item.name.text === "LOG_TYPES",
  );
  assert.ok(
    logTypes?.initializer && ts.isArrayLiteralExpression(logTypes.initializer),
  );
  const config = logTypes.initializer.elements.find((element) => {
    if (!ts.isObjectLiteralExpression(element)) return false;
    const typeProperty = element.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === "type",
    );
    return (
      typeProperty &&
      ts.isStringLiteral(typeProperty.initializer) &&
      typeProperty.initializer.text === type
    );
  });
  assert.ok(config, `expected ${type} LOG_TYPES config`);
  const compiled = ts.transpileModule(
    `const config = ${config.getText(sourceFile)};`,
    {
      compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;

  return Function(
    `"use strict"; ${compiled}; return config;`,
  )() as LogTypeConfig;
}

function loadLauncherAction(label: "Anxious" | "Vomit"): LauncherAction {
  const sourceFile = readLogSourceFile();
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.VariableStatement =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (item) =>
          ts.isIdentifier(item.name) && item.name.text === "LAUNCHER_ACTIONS",
      ),
  );
  assert.ok(declaration, "expected LAUNCHER_ACTIONS declaration");
  const actions = declaration.declarationList.declarations.find(
    (item) =>
      ts.isIdentifier(item.name) && item.name.text === "LAUNCHER_ACTIONS",
  );
  assert.ok(
    actions?.initializer && ts.isArrayLiteralExpression(actions.initializer),
  );
  const action = actions.initializer.elements.find((element) => {
    if (!ts.isObjectLiteralExpression(element)) return false;
    const labelProperty = element.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === "label",
    );
    return (
      labelProperty &&
      ts.isStringLiteral(labelProperty.initializer) &&
      labelProperty.initializer.text === label
    );
  });
  assert.ok(action, `expected ${label} launcher action`);
  const compiled = ts.transpileModule(
    `const action = ${action.getText(sourceFile)};`,
    {
      compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;

  return Function(
    `"use strict"; ${compiled}; return action;`,
  )() as LauncherAction;
}

function loadAdvanceLogComposerIntent(): (
  current: ComposerIntent,
  source: ComposerIntentSource,
) => ComposerIntent {
  return loadStandaloneFunction("advanceLogComposerIntent") as (
    current: ComposerIntent,
    source: ComposerIntentSource,
  ) => ComposerIntent;
}

test("generic mood and symptom composers initialize with genuinely neutral choices", () => {
  const initialize = loadStandaloneFunction<
    (
      config: LogTypeConfig | undefined,
      preset: Record<string, string> | null,
    ) => Record<string, string>
  >("initializeLogComposerChoices");
  const mood = loadLogTypeConfig("mood");
  const symptom = loadLogTypeConfig("symptom");
  const anxious = loadLauncherAction("Anxious");
  const vomit = loadLauncherAction("Vomit");

  assert.deepEqual(initialize(mood, null), {});
  assert.deepEqual(initialize(symptom, null), {});
  assert.deepEqual(initialize(mood, anxious.preset ?? null), {
    mood: "anxious",
  });
  assert.deepEqual(initialize(symptom, vomit.preset ?? null), {
    what: "vomit",
    severity: "watch",
  });
});

test("composer validation requires mood evidence and blocks severity-only symptom logs", () => {
  const validate = loadStandaloneFunction<
    (
      type: string,
      choices: Record<string, string>,
    ) => { label: string; message: string } | null
  >("getLogComposerValidationIssue");

  assert.equal(validate("mood", {})?.label, "Mood or energy");
  assert.equal(validate("mood", { mood: "calm" }), null);
  assert.equal(validate("mood", { energyLevel: "steady" }), null);
  assert.equal(
    validate("symptom", { severity: "watch" })?.label,
    "What happened?",
  );
  assert.equal(validate("symptom", { what: "itching" }), null);
});

test("generic mood and symptom route intents start clean while explicit launcher intents keep their presets", () => {
  const advance = loadAdvanceLogComposerIntent();
  const anxious = loadLauncherAction("Anxious");
  const vomit = loadLauncherAction("Vomit");
  const abandonedMood: ComposerIntent = {
    revision: 12,
    type: "mood",
    preset: { mood: "anxious", moodTone: "rough" },
  };

  const genericMood = advance(abandonedMood, {
    kind: "route",
    type: "mood",
  });
  assert.deepEqual(genericMood, {
    revision: 13,
    type: "mood",
    preset: null,
  });

  const anxiousLauncher = advance(genericMood, {
    kind: "launcher",
    type: anxious.type,
    preset: anxious.preset,
  });
  assert.deepEqual(anxiousLauncher, {
    revision: 14,
    type: "mood",
    preset: { mood: "anxious" },
  });

  const genericSymptom = advance(anxiousLauncher, {
    kind: "route",
    type: "symptom",
  });
  assert.deepEqual(genericSymptom, {
    revision: 15,
    type: "symptom",
    preset: null,
  });

  const vomitLauncher = advance(genericSymptom, {
    kind: "launcher",
    type: vomit.type,
    preset: vomit.preset,
  });
  assert.deepEqual(vomitLauncher, {
    revision: 16,
    type: "symptom",
    preset: { what: "vomit", severity: "watch" },
  });
});

test("a new same-type route intent advances the composer revision and discards the previous preset", () => {
  const advance = loadAdvanceLogComposerIntent();
  const first = advance(
    { revision: 4, type: "symptom", preset: null },
    {
      kind: "launcher",
      type: "symptom",
      preset: { what: "vomit", severity: "watch" },
    },
  );
  const second = advance(first, { kind: "route", type: "symptom" });

  assert.equal(second.type, "symptom");
  assert.equal(second.revision, first.revision + 1);
  assert.equal(second.preset, null);
});

test("keeps the top-level Log tab header root-like and lets its instruction wrap", () => {
  const source = readFileSync(LOG_PATH, "utf8");
  const header = source.match(/<BoardRouteHeader[\s\S]*?\/>/)?.[0] ?? "";

  assert.match(header, /title="Log"/);
  assert.doesNotMatch(header, /\bback(?:\s|=)/);
  assert.doesNotMatch(header, /\bonBack=/);
  assert.match(source, /<Text\s+style=\{\[\s*s\.quickLogActionSub,/);
  assert.doesNotMatch(source, /<Text\s+numberOfLines=\{1\}\s+style=\{\[\s*s\.quickLogActionSub,/);
});

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? collectTsxFiles(path)
      : path.endsWith(".tsx")
        ? [path]
        : [];
  });
}

function collectTextInputOpeningTags(source: string): Array<{
  input: string;
  index: number;
}> {
  const inputs: Array<{ input: string; index: number }> = [];
  for (const match of source.matchAll(/(?<![\w$.])<TextInput\b/g)) {
    const start = match.index;
    let braceDepth = 0;
    let quote: '"' | "'" | "`" | null = null;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "{") braceDepth += 1;
      else if (char === "}") braceDepth -= 1;
      else if (char === ">" && braceDepth === 0) {
        inputs.push({ input: source.slice(start, index + 1), index: start });
        break;
      }
    }
  }
  return inputs;
}

function hasStableProgrammaticName(input: string): boolean {
  const attribute = input.match(/\baccessibilityLabel\s*=\s*/);
  if (!attribute || attribute.index === undefined) return false;
  const valueStart = attribute.index + attribute[0].length;
  const opening = input[valueStart];
  if (opening === '"' || opening === "'") {
    const closing = input.indexOf(opening, valueStart + 1);
    if (closing < 0) return false;
    return input.slice(valueStart + 1, closing).trim().length > 0;
  }
  if (opening !== "{") return false;

  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;
  let end = -1;
  for (let index = valueStart; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  if (end < 0) return false;

  const expression = input.slice(valueStart + 1, end).trim();
  if (!expression) return false;
  if (/^(?:undefined|null|void\s+0)$/.test(expression)) return false;
  if (/^false$/.test(expression)) return false;
  if (/^(?:"\s*"|'\s*'|`\s*`)$/.test(expression)) return false;
  if (/&&/.test(expression)) return false;
  if (/\|\|\s*(?:false|null|undefined|void\s+0|"\s*"|'\s*'|`\s*`)/.test(expression)) return false;
  if (/\?\?\s*(?:false|null|undefined|void\s+0|"\s*"|'\s*'|`\s*`)/.test(expression)) return false;
  if (/(^|[^?])\?(?!\?)\s*(?:false|null|undefined|void\s+0|"\s*"|'\s*'|`\s*`)/.test(expression)) return false;
  if (/(^|[^?])\?(?!\?)/.test(expression) && /:\s*(?:false|null|undefined|void\s+0|"\s*"|'\s*'|`\s*`)/.test(expression)) return false;
  return true;
}

test("the TextInput-name check rejects missing, empty, and conditionally false labels", () => {
  for (const input of [
    "<TextInput />",
    '<TextInput accessibilityLabel="" />',
    '<TextInput accessibilityLabel="   " />',
    "<TextInput accessibilityLabel={undefined} />",
    "<TextInput accessibilityLabel={null} />",
    "<TextInput accessibilityLabel={false} />",
    ' <TextInput accessibilityLabel={""} />',
    '<TextInput accessibilityLabel={enabled && "Dog name"} />',
    '<TextInput accessibilityLabel={enabled ? "Dog name" : false} />',
    '<TextInput accessibilityLabel={enabled ? false : "Dog name"} />',
    '<TextInput accessibilityLabel={enabled ? "" : "Dog name"} />',
    '<TextInput accessibilityLabel={label || ""} />',
    '<TextInput accessibilityLabel={label ?? undefined} />',
    '<TextInput accessibilityLabel={`Weight in ${unit || ""}`} />',
  ]) {
    assert.equal(hasStableProgrammaticName(input), false, input);
  }
  for (const input of [
    '<TextInput accessibilityLabel="Dog name" />',
    "<TextInput accessibilityLabel={field.label} />",
    "<TextInput accessibilityLabel={`Weight in ${unit}`} />",
    '<TextInput accessibilityLabel={isDog ? "Dog name" : "Pet name"} />',
  ]) {
    assert.equal(hasStableProgrammaticName(input), true, input);
  }
});

test("the TextInput scan covers compact and non-self-closing JSX forms", () => {
  const inputs = collectTextInputOpeningTags(`
    const ref = useRef<TextInput>(null);
    <TextInput/>
    <TextInput accessibilityLabel="Dog name"></TextInput>
  `);

  assert.equal(inputs.length, 2);
  assert.equal(hasStableProgrammaticName(inputs[0].input), false);
  assert.equal(hasStableProgrammaticName(inputs[1].input), true);
});

test("every direct mobile TextInput has a stable programmatic name", () => {
  const failures: string[] = [];
  const files = [
    ...collectTsxFiles(join(MOBILE_ROOT, "app")),
    ...collectTsxFiles(join(MOBILE_ROOT, "components")),
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of collectTextInputOpeningTags(source)) {
      if (hasStableProgrammaticName(match.input)) continue;
      const line = source.slice(0, match.index).split("\n").length;
      failures.push(`${file.slice(MOBILE_ROOT.length + 1)}:${line}`);
    }
  }

  assert.deepEqual(failures, []);
});

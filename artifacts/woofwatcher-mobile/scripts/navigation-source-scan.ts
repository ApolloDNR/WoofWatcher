import ts from "typescript";

// Node-only migration guard. Keep the TypeScript compiler out of app runtime imports.
export interface NavigationSourceScan {
  readonly directFastLogLaunchCount: number;
  readonly dynamicRouterCallCount: number;
  readonly staticRouterCallCount: number;
}

type RouteMethod = "dismissTo" | "navigate" | "push" | "replace";
type RouteMethodBinding = RouteMethod | "ambiguous";

interface NavigationBindings {
  readonly hookNames: Set<string>;
  readonly linkNames: Set<string>;
  readonly namespaceNames: Set<string>;
  readonly routerMethodNames: Map<string, RouteMethodBinding>;
  readonly routerObjectNames: Set<string>;
  hasNavigationImport: boolean;
}

interface NavigationSourceAnalysis {
  readonly hasNavigationUsage: boolean;
  readonly scan: NavigationSourceScan;
}

const ROUTE_METHODS = new Set<RouteMethod>([
  "dismissTo",
  "navigate",
  "push",
  "replace",
]);

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function cookedLiteralValue(expression: ts.Expression): string | null {
  const unwrapped = unwrapExpression(expression);
  return ts.isStringLiteral(unwrapped) ||
    ts.isNoSubstitutionTemplateLiteral(unwrapped)
    ? unwrapped.text
    : null;
}

function staticPropertyName(name: ts.PropertyName): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text;
  }
  return null;
}

function memberName(expression: ts.Expression): string | null {
  const unwrapped = unwrapExpression(expression);
  if (ts.isPropertyAccessExpression(unwrapped)) {
    return unwrapped.name.text;
  }
  if (ts.isElementAccessExpression(unwrapped) && unwrapped.argumentExpression) {
    return cookedLiteralValue(unwrapped.argumentExpression);
  }
  return null;
}

function memberReceiver(expression: ts.Expression): ts.Expression | null {
  const unwrapped = unwrapExpression(expression);
  return ts.isPropertyAccessExpression(unwrapped) ||
    ts.isElementAccessExpression(unwrapped)
    ? unwrapped.expression
    : null;
}

function namespaceMember(
  expression: ts.Expression,
  namespaces: ReadonlySet<string>,
  expectedMember: string,
): boolean {
  const receiver = memberReceiver(expression);
  const name = memberName(expression);
  if (!receiver || name !== expectedMember) return false;
  const unwrappedReceiver = unwrapExpression(receiver);
  return (
    ts.isIdentifier(unwrappedReceiver) && namespaces.has(unwrappedReceiver.text)
  );
}

function isHookExpression(
  expression: ts.Expression,
  bindings: NavigationBindings,
): boolean {
  const unwrapped = unwrapExpression(expression);
  return (
    (ts.isIdentifier(unwrapped) && bindings.hookNames.has(unwrapped.text)) ||
    namespaceMember(unwrapped, bindings.namespaceNames, "useRouter")
  );
}

function isHookCall(
  expression: ts.Expression,
  bindings: NavigationBindings,
): boolean {
  const unwrapped = unwrapExpression(expression);
  return (
    ts.isCallExpression(unwrapped) &&
    isHookExpression(unwrapped.expression, bindings)
  );
}

function isRouterObjectExpression(
  expression: ts.Expression,
  bindings: NavigationBindings,
): boolean {
  const unwrapped = unwrapExpression(expression);
  return (
    (ts.isIdentifier(unwrapped) &&
      bindings.routerObjectNames.has(unwrapped.text)) ||
    namespaceMember(unwrapped, bindings.namespaceNames, "router") ||
    isHookCall(unwrapped, bindings)
  );
}

function isLinkExpression(
  expression: ts.Expression,
  bindings: NavigationBindings,
): boolean {
  const unwrapped = unwrapExpression(expression);
  return (
    (ts.isIdentifier(unwrapped) && bindings.linkNames.has(unwrapped.text)) ||
    namespaceMember(unwrapped, bindings.namespaceNames, "Link")
  );
}

function routeMethodFromMember(
  expression: ts.Expression,
  bindings: NavigationBindings,
): RouteMethodBinding | null {
  const receiver = memberReceiver(expression);
  if (!receiver || !isRouterObjectExpression(receiver, bindings)) return null;
  const name = memberName(expression);
  if (name === null) return "ambiguous";
  return ROUTE_METHODS.has(name as RouteMethod) ? (name as RouteMethod) : null;
}

function routeMethodFromExpression(
  expression: ts.Expression,
  bindings: NavigationBindings,
): RouteMethodBinding | null {
  const unwrapped = unwrapExpression(expression);
  if (ts.isIdentifier(unwrapped)) {
    return bindings.routerMethodNames.get(unwrapped.text) ?? null;
  }
  return routeMethodFromMember(unwrapped, bindings);
}

function addRouterMethodBinding(
  bindings: NavigationBindings,
  name: string,
  method: RouteMethodBinding,
): boolean {
  const current = bindings.routerMethodNames.get(name);
  if (current === "ambiguous" || current === method) return false;
  const next = current === undefined ? method : "ambiguous";
  bindings.routerMethodNames.set(name, next);
  return true;
}

function addNamedBinding(
  bindings: NavigationBindings,
  name: ts.BindingName,
  initializer: ts.Expression,
): boolean {
  if (ts.isIdentifier(name)) {
    if (isRouterObjectExpression(initializer, bindings)) {
      if (bindings.routerObjectNames.has(name.text)) return false;
      bindings.routerObjectNames.add(name.text);
      return true;
    }

    const routeMethod = routeMethodFromExpression(initializer, bindings);
    if (routeMethod) {
      return addRouterMethodBinding(bindings, name.text, routeMethod);
    }

    if (isLinkExpression(initializer, bindings)) {
      if (bindings.linkNames.has(name.text)) return false;
      bindings.linkNames.add(name.text);
      return true;
    }
    return false;
  }

  if (
    !ts.isObjectBindingPattern(name) ||
    !isRouterObjectExpression(initializer, bindings)
  ) {
    return false;
  }
  let changed = false;
  for (const element of name.elements) {
    if (element.dotDotDotToken) {
      if (
        ts.isIdentifier(element.name) &&
        !bindings.routerObjectNames.has(element.name.text)
      ) {
        bindings.routerObjectNames.add(element.name.text);
        changed = true;
      }
      continue;
    }
    if (!ts.isIdentifier(element.name)) continue;
    const property = element.propertyName
      ? staticPropertyName(element.propertyName)
      : element.name.text;
    const method =
      property && ROUTE_METHODS.has(property as RouteMethod)
        ? (property as RouteMethod)
        : "ambiguous";
    changed =
      addRouterMethodBinding(bindings, element.name.text, method) || changed;
  }
  return changed;
}

function collectNavigationBindings(
  sourceFile: ts.SourceFile,
): NavigationBindings {
  const bindings: NavigationBindings = {
    hookNames: new Set(["useRouter"]),
    linkNames: new Set(["Link"]),
    namespaceNames: new Set(),
    routerMethodNames: new Map(),
    routerObjectNames: new Set(["router"]),
    hasNavigationImport: false,
  };

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "expo-router" ||
      !statement.importClause
    ) {
      continue;
    }
    const namedBindings = statement.importClause.namedBindings;
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      bindings.namespaceNames.add(namedBindings.name.text);
      continue;
    }
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;
    for (const element of namedBindings.elements) {
      const importedName = (element.propertyName ?? element.name).text;
      if (importedName === "useRouter") {
        bindings.hookNames.add(element.name.text);
        bindings.hasNavigationImport = true;
      } else if (importedName === "router") {
        bindings.routerObjectNames.add(element.name.text);
        bindings.hasNavigationImport = true;
      } else if (importedName === "Link") {
        bindings.linkNames.add(element.name.text);
        bindings.hasNavigationImport = true;
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        changed =
          addNamedBinding(bindings, node.name, node.initializer) || changed;
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left)
      ) {
        changed = addNamedBinding(bindings, node.left, node.right) || changed;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return bindings;
}

function staticPathFromObject(
  object: ts.ObjectLiteralExpression,
): string | null {
  let pathname: ts.Expression | null = null;
  for (const property of object.properties) {
    if (
      ts.isSpreadAssignment(property) ||
      (property.name && ts.isComputedPropertyName(property.name))
    ) {
      return null;
    }
    if (!property.name || staticPropertyName(property.name) !== "pathname") {
      continue;
    }
    if (pathname || !ts.isPropertyAssignment(property)) return null;
    pathname = property.initializer;
  }
  return pathname ? cookedLiteralValue(pathname) : null;
}

interface StaticNavigationTarget {
  readonly path: string;
}

function isUnambiguouslyExternalHref(path: string): boolean {
  if (path.startsWith(".")) return false;
  return (
    /^([\w\d_+.-]+:)?\/\//u.test(path) ||
    /^(https?|mailto|tel|sms|geo|maps|market|itmss?|itms-apps|content|file):/u.test(
      path,
    )
  );
}

function internalHrefNeedsRuntimeResolution(path: string): boolean {
  if (isUnambiguouslyExternalHref(path)) return false;
  const [pathname] = path.split(/[?#]/u, 1);
  return (
    !pathname.startsWith("/") ||
    /[\u0000-\u0020\u007f]/u.test(path) ||
    pathname.includes("\\") ||
    pathname.includes("%") ||
    pathname.includes("[") ||
    pathname.includes("]") ||
    pathname.includes("//") ||
    (pathname.length > 1 && pathname.endsWith("/")) ||
    /(?:^|\/)\.{1,2}(?:\/|$)/u.test(pathname)
  );
}

function staticTargetFromLiteral(path: string): StaticNavigationTarget | null {
  // expo-router@6.0.24 linkTo checks shouldLinkExternally before segment and
  // path-parser normalization. Internal values that need either runtime stage
  // stay dynamic so the pinned dynamic debt fails closed.
  return internalHrefNeedsRuntimeResolution(path) ? null : { path };
}

function staticTargetFromHref(
  expression: ts.Expression,
): StaticNavigationTarget | null {
  const literal = cookedLiteralValue(expression);
  if (literal !== null) return staticTargetFromLiteral(literal);
  const unwrapped = unwrapExpression(expression);
  if (!ts.isObjectLiteralExpression(unwrapped)) return null;
  const pathname = staticPathFromObject(unwrapped);
  return pathname === null ? null : staticTargetFromLiteral(pathname);
}

function isDirectFastLogTarget(target: StaticNavigationTarget): boolean {
  const [pathname] = target.path.split(/[?#]/u, 1);
  return pathname === "/fastlog";
}

function jsxTagIsLink(
  tagName: ts.JsxTagNameExpression,
  bindings: NavigationBindings,
): boolean {
  if (ts.isIdentifier(tagName)) return bindings.linkNames.has(tagName.text);
  return (
    ts.isPropertyAccessExpression(tagName) &&
    ts.isIdentifier(tagName.expression) &&
    bindings.namespaceNames.has(tagName.expression.text) &&
    tagName.name.text === "Link"
  );
}

function staticTargetFromLinkAttributes(
  attributes: ts.JsxAttributes,
): StaticNavigationTarget | null {
  let href: ts.JsxAttribute | null = null;
  for (const property of attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) return null;
    const propertyName = ts.isIdentifier(property.name)
      ? property.name.text
      : null;
    if (propertyName !== "href" || href !== null) {
      if (propertyName === "href") return null;
      continue;
    }
    href = property;
  }
  if (!href?.initializer) return null;
  if (ts.isStringLiteral(href.initializer)) {
    return href.initializer.text.includes("&")
      ? null
      : staticTargetFromLiteral(href.initializer.text);
  }
  if (!ts.isJsxExpression(href.initializer) || !href.initializer.expression) {
    return null;
  }
  return staticTargetFromHref(href.initializer.expression);
}

function parseNavigationSource(
  source: string,
  fileName: string,
): ts.SourceFile {
  const normalizedFileName = fileName.toLowerCase();
  const scriptKind = normalizedFileName.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : normalizedFileName.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : normalizedFileName.endsWith(".js") ||
          normalizedFileName.endsWith(".mjs") ||
          normalizedFileName.endsWith(".cjs")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const parseDiagnostics = (
    sourceFile as ts.SourceFile & {
      readonly parseDiagnostics?: readonly ts.DiagnosticWithLocation[];
    }
  ).parseDiagnostics;
  if (parseDiagnostics?.length) {
    const diagnostic = parseDiagnostics[0];
    const message = ts.flattenDiagnosticMessageText(
      diagnostic?.messageText ?? "Unknown TypeScript parse error",
      "\n",
    );
    throw new SyntaxError(
      `Navigation source is not valid TypeScript/TSX: ${message}`,
    );
  }
  return sourceFile;
}

function analyzeNavigationSource(
  source: string,
  fileName: string,
): NavigationSourceAnalysis {
  const sourceFile = parseNavigationSource(source, fileName);
  const bindings = collectNavigationBindings(sourceFile);
  let directFastLogLaunchCount = 0;
  let dynamicRouterCallCount = 0;
  let staticRouterCallCount = 0;
  let hasNavigationUsage = bindings.hasNavigationImport;

  const classifyHref = (expression: ts.Expression | undefined): void => {
    if (!expression) {
      dynamicRouterCallCount += 1;
      return;
    }
    const target = staticTargetFromHref(expression);
    if (target === null) {
      dynamicRouterCallCount += 1;
      return;
    }
    staticRouterCallCount += 1;
    if (isDirectFastLogTarget(target)) directFastLogLaunchCount += 1;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (isHookExpression(node.expression, bindings)) {
        hasNavigationUsage = true;
      }
      const routeMethod = routeMethodFromExpression(node.expression, bindings);
      if (routeMethod) {
        hasNavigationUsage = true;
        if (routeMethod === "ambiguous") {
          dynamicRouterCallCount += 1;
        } else {
          classifyHref(node.arguments[0]);
        }
      } else {
        const receiver = memberReceiver(node.expression);
        if (receiver && isRouterObjectExpression(receiver, bindings)) {
          hasNavigationUsage = true;
        }
      }
    } else if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      jsxTagIsLink(node.tagName, bindings)
    ) {
      hasNavigationUsage = true;
      const target = staticTargetFromLinkAttributes(node.attributes);
      if (target === null) {
        dynamicRouterCallCount += 1;
      } else {
        staticRouterCallCount += 1;
        if (isDirectFastLogTarget(target)) directFastLogLaunchCount += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return {
    hasNavigationUsage,
    scan: {
      directFastLogLaunchCount,
      dynamicRouterCallCount,
      staticRouterCallCount,
    },
  };
}

export function scanNavigationSource(
  source: string,
  fileName = "navigation-source.tsx",
): NavigationSourceScan {
  return analyzeNavigationSource(source, fileName).scan;
}

export function hasNavigationSource(
  source: string,
  fileName = "navigation-source.tsx",
): boolean {
  return analyzeNavigationSource(source, fileName).hasNavigationUsage;
}

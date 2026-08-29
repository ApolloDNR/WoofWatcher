const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

function uniq(paths) {
  return [...new Set(paths.filter(Boolean))];
}

function realpathIfExists(target) {
  try {
    return fs.existsSync(target) ? fs.realpathSync(target) : null;
  } catch {
    return null;
  }
}

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const config = getDefaultConfig(projectRoot);
const buildProfile = (process.env.EXPO_PUBLIC_BUILD_PROFILE || "")
  .trim()
  .toLowerCase();
const isConsumerBundle =
  process.env.EXPO_PUBLIC_CONSUMER_PREVIEW === "1" ||
  ["candidate", "production", "store"].includes(buildProfile);
const ownerOpsUnavailableRoute = path.join(
  projectRoot,
  "components",
  "owner",
  "OwnerOpsUnavailableRoute.tsx",
);
const avatarSpriteProductionPanelUnavailable = path.join(
  projectRoot,
  "components",
  "owner",
  "AvatarSpriteProductionPanelUnavailable.tsx",
);
const recordsConsumerProviderRuntime = path.join(
  projectRoot,
  "lib",
  "recordsConsumerProviderRuntime.ts",
);
const consumerMoreScreen = path.join(
  projectRoot,
  "components",
  "more",
  "ConsumerMoreScreen.tsx",
);
const ownerOpsBundleAliases = new Set([
  "@/components/owner/CareTwinQaScreen",
  path.join(projectRoot, "components", "owner", "CareTwinQaScreen"),
  path.join(projectRoot, "components", "owner", "CareTwinQaScreen.tsx"),
]);
const avatarSpriteProductionPanelAliases = new Set([
  "@/components/owner/AvatarSpriteProductionPanel",
  path.join(projectRoot, "components", "owner", "AvatarSpriteProductionPanel"),
  path.join(
    projectRoot,
    "components",
    "owner",
    "AvatarSpriteProductionPanel.tsx",
  ),
]);
const recordsOwnerProviderRuntimeAliases = new Set([
  "@/lib/recordsOwnerProviderRuntime",
  path.join(projectRoot, "lib", "recordsOwnerProviderRuntime"),
  path.join(projectRoot, "lib", "recordsOwnerProviderRuntime.ts"),
]);

const linkedMobileNodeModules = realpathIfExists(
  path.join(projectRoot, "node_modules"),
);
const linkedWorkspaceNodeModules = linkedMobileNodeModules
  ? realpathIfExists(
      path.resolve(linkedMobileNodeModules, "..", "..", "..", "node_modules"),
    )
  : null;
const singleInstancePackages = [
  "react",
  "react-dom",
  "react-native",
  "expo",
  "expo-router",
  "@react-navigation/native",
  "@react-navigation/native-stack",
  "@react-navigation/bottom-tabs",
  "react-native-safe-area-context",
  "react-native-gesture-handler",
  "react-native-screens",
];

function resolvePackageRoot(packageName) {
  try {
    const packageJson = require.resolve(
      path.join(packageName, "package.json"),
      {
        paths: [projectRoot],
      },
    );
    return fs.realpathSync(path.dirname(packageJson));
  } catch {
    return null;
  }
}

const runtimeAliases = Object.fromEntries(
  singleInstancePackages
    .map((packageName) => [packageName, resolvePackageRoot(packageName)])
    .filter(([, packageRoot]) => Boolean(packageRoot)),
);
function resolveRuntimeAlias(moduleName) {
  for (const [packageName, packageRoot] of Object.entries(runtimeAliases)) {
    if (moduleName === packageName) return packageRoot;
    if (moduleName.startsWith(`${packageName}/`)) {
      return path.join(packageRoot, moduleName.slice(packageName.length + 1));
    }
  }
  return null;
}

const workspaceAliases = {
  "@workspace/api-client-react": path.join(
    workspaceRoot,
    "lib",
    "api-client-react",
  ),
  "@workspace/care-domain": path.join(workspaceRoot, "lib", "care-domain"),
};

function resolveOwnerOpsBundleAlias(moduleName) {
  if (!isConsumerBundle) return null;
  const normalizedModuleName = moduleName.replaceAll("\\", "/");
  if (
    normalizedModuleName === "./(tabs)/more.tsx" ||
    normalizedModuleName === "app/(tabs)/more.tsx" ||
    normalizedModuleName.endsWith("/app/(tabs)/more.tsx")
  ) {
    return consumerMoreScreen;
  }
  if (avatarSpriteProductionPanelAliases.has(moduleName)) {
    return avatarSpriteProductionPanelUnavailable;
  }
  if (recordsOwnerProviderRuntimeAliases.has(moduleName)) {
    return recordsConsumerProviderRuntime;
  }
  return ownerOpsBundleAliases.has(moduleName)
    ? ownerOpsUnavailableRoute
    : null;
}

// This automation worktree reuses a junctioned node_modules folder from the
// primary woofwatcher checkout. Metro needs the real pnpm store roots too, or
// Expo web export can fail to resolve expo-router through the symlink target.
config.watchFolders = uniq([
  ...(config.watchFolders ?? []),
  ...Object.values(workspaceAliases),
  linkedMobileNodeModules,
  linkedWorkspaceNodeModules,
]);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  ...runtimeAliases,
  ...workspaceAliases,
};

const metroResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const aliasedModuleName =
    resolveOwnerOpsBundleAlias(moduleName) ??
    resolveRuntimeAlias(moduleName) ??
    moduleName;
  const resolveRequest = metroResolveRequest ?? context.resolveRequest;
  return resolveRequest(context, aliasedModuleName, platform);
};

config.resolver.nodeModulesPaths = uniq([
  ...(config.resolver.nodeModulesPaths ?? []),
  linkedMobileNodeModules,
  linkedWorkspaceNodeModules,
]);

module.exports = config;

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

const linkedMobileNodeModules = realpathIfExists(path.join(projectRoot, "node_modules"));
const linkedWorkspaceNodeModules = linkedMobileNodeModules
  ? realpathIfExists(path.resolve(linkedMobileNodeModules, "..", "..", "..", "node_modules"))
  : null;
const workspaceAliases = {
  "@workspace/api-client-react": path.join(workspaceRoot, "lib", "api-client-react"),
  "@workspace/care-domain": path.join(workspaceRoot, "lib", "care-domain"),
};

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
  ...workspaceAliases,
};

config.resolver.nodeModulesPaths = uniq([
  ...(config.resolver.nodeModulesPaths ?? []),
  linkedMobileNodeModules,
  linkedWorkspaceNodeModules,
]);

module.exports = config;

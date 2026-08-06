const manifest = require("../lib/universalNavigationManifest.json");

function uniqueRoutes(routes) {
  return Object.freeze([...new Set(routes)]);
}

const UNIVERSAL_NAVIGATION_QA_ROUTES = uniqueRoutes([
  ...manifest.primaryTabs.map((item) => item.route),
  ...manifest.canonicalChildren.map((item) => item.route),
  ...manifest.legacyRedirects.map((item) => item.route),
  ...manifest.legacyAliases.map((item) => item.route),
]);

function buildUniversalNavigationQaRoutes(supplementalRoutes) {
  return uniqueRoutes([
    ...UNIVERSAL_NAVIGATION_QA_ROUTES,
    ...supplementalRoutes,
  ]);
}

module.exports = {
  UNIVERSAL_NAVIGATION_MANIFEST: manifest,
  UNIVERSAL_NAVIGATION_QA_ROUTES,
  buildUniversalNavigationQaRoutes,
};

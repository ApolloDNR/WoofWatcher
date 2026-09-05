process.env.EXPO_PUBLIC_CONSUMER_PREVIEW = "1";

console.log(
  "[consumer-preview] Rebuilding a fresh consumer bundle before starting the preview.",
);

require("./smoke-web-export.js");
require("./serve-smoke-preview.js");

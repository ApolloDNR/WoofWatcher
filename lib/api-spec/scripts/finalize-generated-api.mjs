// Run only after Orval exits so its cleaners and formatters cannot race the
// security hardening or the curated public compatibility barrel.
await import("./harden-generated-household-client.mjs");
await import("./restore-api-client-react-index.mjs");
await import("./restore-api-zod-index.mjs");

---
name: Paid-AI endpoint pitfalls
description: Two durable, non-obvious traps when adding a backend endpoint that calls a paid AI integration (image stylization, LLMs, etc.).
---

# Adding a backend endpoint backed by a paid AI integration

## Never throw at module load when an integration env var is missing
**Rule:** construct AI clients lazily (inside the handler / a guarded factory) and have
the client module export an `isConfigured()` check; the route should return 503 when the
integration is absent — never `throw` at import time.
**Why:** routers are usually mounted unconditionally, so a top-level `throw` in the client
module crashes the *entire* server at startup, taking down unrelated routes (health,
other features). A code review rejected exactly this regression here.
**How to apply:** any time a module reads `*_API_KEY` / `*_BASE_URL` at the top level and
throws — move it behind a function that callers invoke at request time.

## Base64 image uploads need a raised body-parser limit
**Rule:** any endpoint accepting a base64 image must raise `express.json({ limit })`
(e.g. 15mb) and the client should downscale before upload.
**Why:** the default is 100kb, so phone photos are rejected and the Replit proxy returns
an **HTML** error page — the client sees `SyntaxError: Unexpected token '<' ... not valid
JSON`, which masquerades as a routing bug but is really payload-too-large.

## Cost protection for unauthenticated paid endpoints
An exposed endpoint hitting a paid model is a cost-exhaustion vector. Add a per-IP +
global in-memory rate limit (429) and an upstream client timeout. If real auth lands
later, switch to user/session-scoped quotas.

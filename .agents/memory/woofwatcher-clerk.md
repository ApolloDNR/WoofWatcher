---
name: WoofWatcher Clerk auth setup
description: Replit-managed Clerk is provisioned; dev preview intentionally skips the sign-in gate
---

Clerk is **Replit-managed** (provisioned via `setupClerkWhitelabelAuth`; keys live in secrets — never point the user at dashboard.clerk.com or ask for keys). The mobile app switches auth backends at `lib/auth.ts` (`useWoofAuth = isClerkConfigured ? useClerkAuth : useLocalAuth`).

**Why this matters:** In the root layout, `__DEV__` intentionally skips the sign-in redirect so the web preview/simulator is reviewable without logging in on every reload. Production builds enforce the gate. Do NOT "fix" the preview being accessible while signed out, and do NOT treat `pk_test` keys or "development keys" console warnings as problems — both are expected in development.

Signed-out 401s in the browser console come from Clerk's dev FAPI session checks, not the api-server — they are normal, not bugs.

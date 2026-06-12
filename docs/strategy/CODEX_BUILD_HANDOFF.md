# Codex Build Handoff

Date: 2026-06-12

## Mission

Upgrade WoofWatcher toward v1.5 without rebuilding from scratch.

Preserve:
- Existing local-first PWA architecture.
- Mobile care-domain behavior.
- localStorage.
- Backup/import.
- Reports.
- Health Watch and Bile Watch.
- Records.
- Assistant routing.

## Current Surfaces

- `artifacts/woofwatcher-mobile`: canonical mobile app.
- `artifacts/woofwatcher`: local-first PWA/dashboard and strong demo surface.
- `lib/care-domain`: shared care rules and behavior tests.
- `artifacts/api-server`: API surface for provider-backed sync.

## Immediate Build Priority

1. Keep CI green.
2. Mirror this v1.5 direction into docs.
3. Upgrade the PWA app shell and navigation because Apollo explicitly called out the local-first PWA architecture.
4. Keep mobile navigation aligned with v1.5: Home, Log, Plans, Health, More.
5. Continue in coherent commits: shell, Phoenix Home, Quick Log v2, Household Pulse, Health/Bile, Diet/Care Pass, WoofGuide/Avatar, Timeline/Records polish.

## Implementation Rules

- Do not introduce large dependencies unless they replace a meaningful amount of complexity.
- Do not add external API keys.
- Do not claim live AI if `OPENAI_API_KEY` is missing.
- Keep data local-first unless cloud sync is explicitly implemented.
- If cloud sync is not implemented, UI can be ready for it but must use truthful local/mock state.
- Health copy must use language like "Pattern noticed", "Worth watching", "Consider sharing with your vet", and "Not veterinary advice".
- Forbidden health language: diagnoses, treatment claims, medical certainty.

## Verification

Run the focused test command when possible:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts lib\care-domain\test\*.test.ts
```

Run full CI locally only when dependencies are installed:

```powershell
pnpm run build:ci
```

Always check GitHub Actions after pushing main.


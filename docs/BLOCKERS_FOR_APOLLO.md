# Blockers For Apollo

## Product Decisions

- Confirm launch target: Expo preview, TestFlight, App Store, web dashboard, or staged launch.
- Confirm subscription packaging and exact paid tiers.
- Confirm whether WoofWatcher should support multiple dogs before paid launch.
- Confirm whether Figma is the canonical visual design source.

## Accounts And Secrets

- Clerk production configuration.
- Database/Supabase production configuration.
- Storage provider for records and generated reports.
- Document upload/storage rules for real record files; local metadata and reminders exist, but production file storage is not approved/configured.
- AI provider key and model policy.
- Expo/EAS/App Store accounts.
- Vercel/API deployment target if applicable.

## Development Environment

- Local Windows shell currently lacks `pnpm`, `npm`, `corepack`, and `node_modules`, so `pnpm run typecheck` cannot run locally even though zero-install Node behavior tests pass.

## Legal, Privacy, And Safety

- Privacy policy for pet health notes, documents, AI usage, and household sharing.
- Terms and support scope before subscriptions.
- Data export and account deletion policy.
- Veterinary disclaimer language.
- Document storage access rules.

## External Source Notes

The Apollo shared thread was reachable via approved network fetch on 2026-06-08. Standard unauthenticated web tooling did not render the conversation directly; extraction used embedded share-page data.

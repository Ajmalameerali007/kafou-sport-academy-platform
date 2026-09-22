# Foundation setup and handover

## Environments

Dedicated Supabase `kafou-staging`, project `cwdazidovxqeevmpicng`, organization **Ajmalameerali555's Org**, Mumbai `ap-south-1`. This is synthetic staging, not approved production residency. Existing projects were not reused. The Sites URL remains owner-only:
https://kafou-sport-academy.ajazx800.chatgpt.site

Supabase is the single database/Auth source. The unused D1 integration and Drizzle examples/dependencies have been removed. Versioned SQL is in `supabase/migrations`; generated public-schema types are in `lib/platform/database.types.ts`. Seven labels are provisional preferences, not real venue confirmations. No staff, schedules or customer records are seeded into hosted staging by the migrations.

## Local repeatable environment

Requires Node 22+, Docker, Supabase CLI and dependencies (`npm ci`). This project uses isolated local project `kafou-local`, API **56321**, PostgreSQL **56322**, captured email **56324**. Do not stop/reset other projects.

1. `supabase start -x studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector`
2. `supabase db reset --local` — destroys only this local synthetic database; never add `--linked` for this verification.
3. Copy `.env.example` to ignored `.env.local`; use the local credentials from `supabase status`, set `APP_URL=http://localhost:3100`, random `RATE_LIMIT_SECRET`, and `AUTH_EMAIL_ENABLED=true` for Mailpit.
4. `mkdir -p outputs/foundation` then `supabase status -o json > outputs/foundation/local-keys.json`; keep that file private.
5. `node scripts/seed-foundation-test.mjs` — rejects non-local URLs and creates five synthetic fixture accounts. Its test-only password is in the test source, never a production credential.
6. `npm run dev -- --port 3100` for development. For the production Worker: `npm run build`, then `node scripts/preview-foundation.mjs` (port 3101).
7. `npm test`, `npm run typecheck`, `npm run lint`, `supabase test db tests/database`, `BASE_URL=http://127.0.0.1:3101 npx playwright test --workers=1`.

The preview script temporarily places local environment values beside the Worker configuration and removes them on exit. Never archive `.env`, `.dev.vars`, ignored outputs, screenshots containing real data or local fixture credentials. Hosting credentials must remain server runtime secrets.

## Hosted authentication

Hosted email delivery has **not** been verified. Both provider public signup and `AUTH_EMAIL_ENABLED` are disabled on staging until SMTP (or explicitly supported test delivery) is configured. Login for explicitly provisioned verified staging accounts remains possible. The local captured-email suite exercises actual provider signup, verification, recovery/reset and invitation flows; it does not prove external inbox delivery.

Before enabling hosted account creation: configure SMTP and sender, confirm the Sites origin and `/auth/confirm**` redirect allowlist, enable provider email signup with confirmations, and test a supported recipient. Set `AUTH_EMAIL_ENABLED=true` only after that test. Keep anonymous sign-in, SMS signup and phone MFA disabled. Minimum password length is 12, TOTP MFA enabled, refresh rotation enabled. No real family intake without approved privacy/consent, production data and recovery/backup procedures.

Runtime keys: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, APP_URL, RATE_LIMIT_SECRET, KAFOU_STAGING=true, AUTH_EMAIL_ENABLED. Never expose the secret key in public/client-prefixed variables. Sites owner access and academy accounts are separate authorization layers.

## First super administrator

No first-signup administrator rule exists. The owner must supply an explicitly chosen, existing **verified account email**. With server-only staging credentials configured in a private environment file:

`node --env-file=.env.staging.local scripts/bootstrap-admin.mjs verified-owner@example.com`

The command refuses unverified/nonexistent accounts and refuses another bootstrap once a super administrator exists. Sign in, enroll an authenticator under Security and verify its code. AAL2 is required before any super-administrator workspace or privilege changes. Do not share the service key or fixture credentials with users.

Subsequent staff are invited by an MFA-verified super administrator, with an explicit role and branch scope. Invitations expire after 24 hours; accepted links cannot be reused. The recipient creates a password before logging in. Existing registered users can receive explicit staff access from Team; an invitation to an already registered address is rejected rather than silently granting privileges.

Recovery of a lost administrator authenticator is a controlled owner/provider administration procedure, not an automatic bypass. Confirm this runbook and production backup restoration before go-live.

## Important boundaries

- Family linkage is explicit. Email/phone matches never establish guardianship. A staff-created family has no online guardian until a separately verified association is implemented/authorized.
- Prospective child information remains in enquiries until explicit staff conversion. A selected existing child is reused, never duplicated into a new family.
- Initial reviewed levels are editable per sport by head office, with an audit trail. Assessment-driven progression/history/certificates are later phases.
- Consent choices use staging version `staging-v1`; this is not approved legal text or consent for live intake.
- Workspaces support paginated records and truthful empty states, not production analytics.
- SMTP, production hosting/residency, operational branches/venues/sports, pricing, scheduling, backups and recovery approval remain outstanding.

## Security advisor review

Supabase's advisor flags callable SECURITY DEFINER functions. These are intentional bounded projections/commands: anonymous callers receive only branch preferences/confirmed locations; authenticated domain RPCs recheck live roles, ownership, branch permissions and MFA inside the transaction. Direct table mutations are not granted. See [Supabase's advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Foreign-key indexes and statement-level auth policy lookups were added following the performance review. Unused-index notices are expected for empty staging and are not grounds to remove authorization-supporting indexes.

Worker secrets are loaded as runtime bindings; local verification follows [Cloudflare environment guidance](https://developers.cloudflare.com/workers/local-development/environment-variables/).

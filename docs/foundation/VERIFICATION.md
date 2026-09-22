# Phase 1 verification evidence — 20 September 2026

Executed against isolated local Supabase and the compiled Cloudflare Worker. Records and email recipients were synthetic.

| Check | Actual result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, no lint errors |
| `npm test` | 9 passed |
| `supabase db reset --local --yes` | Six migrations and provisional-label seed replayed from an empty database |
| `supabase test db tests/database` | 43 passed across four SQL files |
| `npm run build` | Pass; Vinext reports its existing static-route classification limitation |
| `BASE_URL=http://127.0.0.1:3101 npx playwright test --workers=1 --reporter=line` | 33 passed, 0 failed, 27.5 seconds |
| Bundle scan for configured server secrets | Pass; no secret values in compiled modules/client assets |
| Supabase staging migration apply | Six migrations applied; versioned source filenames aligned with remote history |
| Security review | Three findings reproduced, repaired and regression-tested |
| Supabase performance advisor | Foreign-key/policy warnings resolved; only unused indexes on empty staging remain |

Detailed local logs: `outputs/foundation/worker-all-final.log`, `db-acceptance.log`, `replay-final.log`, `build-final.log`, `types-acceptance.log`, `lint-acceptance.log`, `unit-acceptance.log`. These ignored files are evidence, not runtime assets; some test traces include synthetic authentication data and must not be publicly shared.

Coverage includes cross-family and cross-branch reads/writes, forged role metadata, direct privilege escalation, live suspension/revocation, combined-role MFA bypass prevention, append-only audit, per-sport independent levels, safe existing-child conversion, invitation expiry/replay, atomic enquiry rollback and idempotency. API/browser checks include concurrent retries, changed-key conflicts, cookie refresh, HttpOnly sessions, same-origin rejection, signup/verification, recovery/reset, signout, real MFA, staff invitation/password setup, parent child records and direct protected routes.

Public regression covers supplied media, sport motion accessibility, trigger teardown, resize/reduced-motion transitions, navigation/history, English/Arabic, field retention, empty/provisional locations and automated WCAG checks. Tested browser widths include 320, 390, 590, 768, 1024, 1440 and short landscape; these are desktop browser emulations, not physical-device performance measurements. Family form was also visually inspected in the in-app browser.

Hosted email delivery is unverified and deliberately disabled. No real messages, payments, WhatsApp events, confirmed bookings or customer migrations were performed. The first hosted super administrator remains unassigned pending the owner's explicitly supplied verified account. Private hosted smoke evidence is recorded in the delivery notes after deployment.

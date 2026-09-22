# KAFOU Phase 2.5 — Portal productization

Date: 20 September 2026

## Delivered

A shared operational design system across `/account`, `/admin` (Admin and Head Office), `/sales`, `/branch`, `/coach` and `/parent`: dark navigation, command search (Cmd/Ctrl K), branch scope where applicable, account/security menu, quick actions, sourced attention center, readable statuses, skeletons, empty states and success feedback. Existing public routes and cinematic motion are retained.

- Management and reception: sourced daily metrics, session timeline, branch comparisons, attendance and conversion attention items.
- Sales: searchable/filterable board or list, due follow-ups, lead profile/timeline and new-lead drawers.
- Sessions: date filters, roster drawer, one-click attendance exceptions, Mark All Present and existing finalized attendance lock.
- Parent: athlete cards with independent sport levels, child details, actual participation-based upcoming schedule, family editing and existing trial/enrollment flows.
- Coach: focused day view and compact, assigned read-only sessions/rosters; existing permissions remain authoritative.
- Bilingual English/Arabic with RTL, keyboard focus restoration, dismissal protection for unsaved drawer changes and reduced-motion support.

## Scope integrity

No API handlers, SQL migrations, RLS policies, authorization rules or business command implementations changed. No new dashboards imply supported payments, renewals, assessments, make-up booking or certificates. No new synthetic data was added to hosted staging. Local automated tests use isolated synthetic records.

Search covers currently loaded permitted records. Dashboard counts describe loaded scope; partial results offer Load more records. The action center derives operational reminders from these records; it is not a notification delivery service.

## Source map

New: `app/portal.css`; `components/platform/portal-shell.tsx`, `portal-dashboard.tsx`, `portal-ui.tsx`; `lib/platform/portal-model.ts`; `tests/portal-model.test.ts`; `tests/e2e/portal.spec.ts`; this report and `PLAN.md`.

Updated: `app/layout.tsx`, `app/globals.css`; `components/platform/workspace.tsx`, `operations.tsx`; `lib/platform/arabic.ts`; existing auth-email, platform and operations browser tests. No dependencies added.

## Verification evidence

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — 17 passed, 0 failed.
- `npm run test:db` — 78 passed across 8 files.
- `npm run build` — passed (existing Vinext route classification informational notice remains).
- `BASE_URL=http://127.0.0.1:3101 npm run test:e2e -- --workers=1` — 42 passed, 0 failed, 38.4 seconds.
- `git diff --check` — passed.

Browser coverage includes authenticated roles, MFA gate, local captured-email signup/recovery/invitation flows, permission isolation, last-place booking concurrency, connected trial → roster → attendance → conversion → persistent enrollment, unsaved changes, navigation history, search focus, automated WCAG A/AA checks, Arabic/RTL and public motion regressions. Responsive checks cover 320, 390, 590, 768, 1024 and 1440 widths, with public short-landscape coverage. These are Chromium desktop emulation results, not physical-device performance certification.

Independent review identified three important issues; all were fixed and covered: filtered branch editor safety, parent upcoming schedule participation, and unsaved drawer dismissal. Browser QA also corrected a low-contrast pipeline count and a test selector that confused identical class names across dated sessions. Repeated local runs hit persistent rate limits; only isolated local test limit counters were cleared, without changing application limits.

Screenshots: `outputs/phase2.5/head-office.png`, `parent-desktop.png`, `parent-arabic-mobile.png`, `sales-pipeline.png`, `coach-mobile.png`. Test report: `outputs/playwright-report/index.html`.

## Release and remaining dependencies

Target: existing owner-only KAFOU Sites preview, retaining its staging backend and audience. This is an operational UX release, not a production academy activation. Hosted SMTP/recovery delivery, confirmed operational records, approved intake/consent copy and future modules retain the Phase 2 limitations. No real email, payment, WhatsApp or customer intake activation is included.

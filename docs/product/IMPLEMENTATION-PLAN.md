# Connected KAFOU platform — implementation ledger

Authority: user's Connected Production Platform / Final Codex Build Brief, 20 September 2026. Existing checkout codex/kafou-public, baseline ac9ef030c660fb08a1c5789cfa9c32f27f278492. Existing hosted target verified read-only: kafou-staging/cwdazidovxqeevmpicng, ap-south-1, nine migrations. No uncommitted work at entry.

## Design and decisions

Extend the existing PostgreSQL transaction/RLS and same-origin service architecture. Preserve auth, MFA, public site and current role URLs. Keep current-record permission checks and the academy-wide advisory lock until concurrency evidence supports changing it. Modules have distinct records and commands, never one generic mutable status record.

This is an architectural expansion. The user's detailed brief supplies the accepted product direction, constraints, dependency sequence and authorization to build. This document makes implementation decisions reviewable; repeated approval of already specified requirements is unnecessary. Review schema/security and each cross-role slice before hosted application. No production resources or provider activation.

Synthetic policy defaults: AED minor units; monthly definition with configurable session allowance; no automatic financial privileges for Head Office or Branch; explicit grants required. Published assessments require Head Office/Owner review. Makeup is same sport/branch/level with 30-day synthetic expiry; excused absence eligible, absent requires configured policy. Package and entitlement acceptance is explicit. No installments. No promotion silently reassigns classes. Renewal reminder 7 days, labelled synthetic. External channels disabled.

## File/interface ownership

Shared core: root owns common migration, API integration, lib/platform/product.ts, components/platform/product-shared.tsx, workspace/shell integration and design tokens. Modules own isolated migrations, command validator, module UI and module tests. Do not edit existing migrations. No hosted writes by delegated implementers; root applies reviewed migrations in order.

Common module contract:

- SQL dispatcher: private.<domain>_command(p_action text,p_data jsonb) returns jsonb, security definer set search_path='', explicit private.require_access/private.active/private.mfa_ready and record ownership. RPC public.product_command delegates with actor+idempotency key transaction guard.
- Domains: commercial, academy, development, community. New table select access requires RLS; no authenticated direct table mutations. Revoke function PUBLIC/anon execute; public RPC alone exposed.
- Shared helpers: private.product_can(permission text,branch uuid default null), private.emit_product_event(kind text,entity uuid,family uuid,branch uuid,title text,body text,href text) returns uuid. Emit only minimum family-safe data; no drafts/internal notes.
- Validator module exports <domain>Schema (Zod discriminated union actions) and <domain>Tables readonly names. Command action prefix matches domain (`commercial.*`, `academy.*`, `development.*`, `community.*`).
- UI module exports <Domain>Panel({account,data,refresh,section}) using ProductProps from product-shared. Product data Record<string, Record<string,unknown>[]>, refreshed from GET /api/product. `productCommand(action,data,key?)` returns shared ServiceResult.
- UI shared ProductForm({title,action,fields,initial?,onSaved})/ProductNotice; fields have name,label,type?,required?,options? where options {value,label}; native labels, busy/error handling. Dedicated modules may use bespoke controls for rich workflows.
- Tests isolated SQL transactions; no resets or mutation of shared hosted fixtures. Tests/functions do not log credentials.

## Dependency-ordered tasks

1. Baseline and feature matrix; core permission grants, event/outbox/notification records, idempotent product RPC. Create shared typed adapters and form components. Verification: authorization denies, retries return original, payload mismatch conflicts, no unavailable-as-empty responses.
2. Commercial slice: packages, memberships, immutable entitlement ledger, invoices/lines, allocations/offline receipts, adjustments/refunds, renewals, compensation review. Explicit financial permissions. No fake provider settlement. Tests exact minor units, duplicate payments, ownership, ledger reconciliation, credit authority.
3. Academy operations: makeup credits/booking, cancellation effects, correction history, waitlist/rescheduling/transfer/occurrence management and independent coach completion. Tests same-branch eligibility, capacity races, correction compensation, duplicate credits, cancellation release. Retain baseline trial/enrollment paths.
4. Development slice: versioned criteria, assigned coach drafts/submission/review/publication, personal bests, level history, actual authorized PDF certificates and reports. Test draft privacy, unassigned coach denial, publication visibility, immutable history and certificate access.
5. Shared family/community: guardian scoped invitations/revocation, emergency/contact data, notifications, tickets/messages, consent documents, shift handover, engagement review and provider activation register. No live sends. Preserve Sales isolation.
6. Integrate distinct role navigation and functional forms/screens; new palette/fonts and mobile subnavigation. Explicit refresh after commands and permitted polling for cross-portal updates. Parent child selector scopes every child-specific view. Arabic/RTL and accessible drawers.
7. Synthetic seed additions guarded by exact project/local-only environment, non-destructive, repeatable. Cross-portal browser walkthrough and screenshots. New and baseline unit/database/API/concurrency/browser tests; security review and fixes.
8. Migration/readiness: actual export-dependent tooling with sample schema/dry-run only until export supplied; setup/operator/backup/restore/rollback runbooks and activation checklist. Mark verified vs blocked accurately. Apply reviewed additive migrations to verified staging, deploy same owner-only preview, hosted smoke exact revision. Update matrix and delivery record.

## Progress

- Inspection: existing role permissions, family claims, operations transactions, API/service boundaries, nine migrations and staging identity verified.
- Supabase changelog fetched; current RLS guidance reviewed. No relevant API change for chosen SQL/RLS approach; do not modify locked realtime schema.
- Entry-state gaps identified before implementation: package_state was pending_configuration and membership/finance/progress/makeup backends were absent. The connected source now separates attendance finalization from delivery completion and adds the domain records/commands; remaining feature and provider limits are recorded in FEATURE-MATRIX.md.

- Earlier local database verification (20 September 2026, 01:05 UTC): all **24 migrations**, **23 SQL suites / 781 assertions**, the one-off event last-place race and both trial-versus-makeup contention orders passed. Exact source hashes and zero replay drift are recorded in REPLAY-EVIDENCE.md. Local CLI advisors: 0 WARN/ERROR, 158 INFO; function lint: seven unused-variable warnings, no errors.
- Independent security corrections verified include entitlement-aware session moves, explicit family unlink denial, cached-command revocation, linked-trial notices, financial target scope, active membership configuration, current guardian consent and guardian-link provenance.
- Separate actual full local synthetic backup/restore: **131 tables / 2,529 rows**, identical ordered row fingerprints and sequence positions, source unchanged; disposable destination and restricted temporary dump removed. Hosted/PITR and Storage-byte recovery remain unverified.
- Release coordinator reports the **15 additive product migrations applied to owner-only staging** (24 total versions). Native hosted advisor results differ: **17 WARN instances across three rules** (2 anonymous + 14 authenticated definer-RPC callability, plus leaked-password protection), **210 INFO instances across two rules** (207 unused indexes, 3 intentional private no-policy tables). Bounded source review found intentional narrow/explicitly guarded RPCs; leaked-password protection remains an activation prerequisite. See the per-RPC evidence review; do not describe hosted diagnostics as zero-warning.
- Provider activation remains separate: no actual Mindbody export/import/reversal, real external delivery, online payment settlement, real operational owner, approved operational/legal policy or production activation is established by the local checks. Final hosted/browser/artifact acceptance is owned by the release coordinator and must retain its exact revision evidence.

- Final additive-source replay at 01:47 UTC: **29 migrations / 28 SQL suites / 939 assertions passed**, with all three actual event/trial/makeup races, zero source drift and disposable cleanup. Local CLI advisors: 0 WARN/ERROR, 173 INFO (170 unused indexes, 3 private no-policy tables); lint remains seven unused-variable warnings/no errors. The prior 131-table/2,529-row restore is historical and predates these last five migrations. See updated exact hashes in REPLAY-EVIDENCE.md.

- Hosted follow-up at approximately 01:52 UTC: release coordinator confirmed the five remaining additive migrations applied, bringing owner-only staging to **29 versions (9 baseline + 20 product)**. The 01:15 native advisor report and 01:17–01:18 six-account RPC walkthrough remain historical snapshots; final compiled hosted acceptance is a separate release check.

- Incremental scheduler slice: private system-only durable jobs for due broadcasts, active synthetic seven-day reminders and expired-offer staff review; append-only approval/run/effect attribution, live authority/consent checks, bounded continuation and retry exhaustion. Actual local cron/concurrency proof and four status-service unit tests added. Hosted activation requires a genuine owner AAL2 approval and reviewed exact-project pg_cron installation; migration installs neither. See JOBS.md and the incremental REPLAY-EVIDENCE entry before updating combined totals.

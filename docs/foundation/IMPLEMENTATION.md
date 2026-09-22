# Operational foundation implementation ledger

Approved scope: Supabase staging, real email/password auth, database RLS, essential admin/sales/branch/family interfaces, enquiry persistence. Preserve public design and Arabic. No scheduling, finance, actual bookings or real family intake.

Base: 251087555489c445b39141793b1edfa032988116 on codex/kafou-public.
Backend: kafou-staging, cwdazidovxqeevmpicng, ap-south-1, existing owner organization.

Tasks: 1 database/RLS/tests; 2 cookie auth and account context; 3 transactional domain APIs; 4 essential bilingual screens; 5 public integration; 6 verification and owner-only release.
Pre-flight: Auth roles become assignments; existing UI single-role result retains primary role plus roles list. Trial returns requested, never booked. Provisional branch slugs remain URL-compatible and map to database IDs.
Ruling: User explicitly approved Supabase and implementation plan; use external KAFOU auth in addition to Sites preview gate, not Sites identity as academy authorization.
Ruling: Retain active feature checkout; clean branch at start and no concurrent edits.
Ruling: Source reference and evidence will be kept in this tracked ledger rather than per-task generated briefs; the user-provided plan is authoritative.

Task 1–5 implemented: PostgreSQL/RLS, transactional commands, cookie auth/MFA, essential bilingual workspaces and persisted enquiries. SQL generated types and API/service boundaries are in place.
Review: Independent whole-branch reviewer found parent-role revocation, existing-child conversion duplication and reviewed-level update defects. All three reproduced with failing pgTAP tests, fixed, and covered in the passing 43-check database suite.
Ruling: Hosted signup is disabled at provider and API until actual SMTP/test-recipient delivery is verified. Local captured email proves code paths only. Owner email remains required before administrator bootstrap; no account was arbitrarily promoted.
Ruling: Migration filenames match the remote Supabase migration versions. Local full replay uses the same SQL and synthetic seed.
Ruling: Record pages are capped at 200 per response with explicit load-more controls; no fabricated metrics or silent full-dataset claim.
Verification to date: 9 unit tests; 43 database checks; 31 browser journeys on development; 9 focused production Worker tests including invite, TOTP, recovery, refresh and concurrent idempotency. Final full Worker regression and hosted smoke checks follow.
Final local acceptance: production Worker full browser suite 33/33, PostgreSQL authorization suite 43/43, unit tests 9/9, typecheck/lint/build green. No server secrets found in compiled artifacts. Local captured email verified; hosted SMTP remains disabled and unverified. Using finishing-a-development-branch workflow with the user's already-selected private Sites release destination; no merge or PR is required.

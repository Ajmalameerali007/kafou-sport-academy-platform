# Phase 2 verification

Local production Worker uses isolated Supabase and Mailpit. Fixtures use synthetic records only. No emails have been sent to the six requested example.com identities.

- TypeScript: passed.
- ESLint: passed.
- Unit/service/contracts: 12 passed.
- PostgreSQL: 78 passed across eight pgTAP files, including inherited Phase 1 isolation checks.
- New browser journeys: connected booking → roster → attendance → conversion → fresh parent login; signed guest capability isolation; role/Arabic interfaces; two simultaneous last-place requests (one 200, one 409, one roster row).
- Independent review: five Important findings; corrected with regression coverage. Five initial regression assertions failed before fixes and passed afterward. Additional tests verify family offer recipient binding, preserved child identity, one-use acceptance and frozen trial identity.
- Attendance test advances a local synthetic session clock through service fixture setup. There is no production UI/API to bypass session start or change finalized attendance.
- Full Worker regression: 38/38 passed against the compiled production Worker in 31.7 seconds. Three new migrations replayed alongside the six foundation migrations from an empty local database. The earlier stale assertions and selector were corrected, then the full suite passed.
- Physical device performance, SMTP delivery, real operational owner and actual KAFOU timetable remain unverified. Browser checks are desktop/mobile emulation.

## Decisions and limits

The source preserves public motion and the three-step enquiry. A saved enquiry remains distinct from booking; booking produces a separate TRI reference only after commit. Provisional branch preferences cannot host bookable sessions. The two DEMO branches and their venues/timetables are clearly synthetic.

A single academy advisory mutex serializes operational writes in staging, with row locks protecting capacity and identity. This favors correctness over high write throughput. Read queries remain concurrent. Sessions snapshot capacity and date; the class definition is not silently rewritten underneath them.

No-show attendance creates a missed trial history and a follow-up lead; make-up evaluation events do not award credit or expose a booking UI. Package setup is pending rather than a fabricated paid membership.

Reported age is not an invented DOB. Eligibility checks its uncertainty conservatively; a staff exception requires a reason. Family access offers are explicitly bound to a verified parent ID and require that parent's acceptance; they never infer identity from contact information.


## Database advisor review

Public sanitized projections and authenticated transactional commands intentionally use guarded SECURITY DEFINER functions; advisor notices were reviewed against their explicit grants and authorization checks. See [Supabase guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Two missing private claim foreign-key indexes were added. Unused indexes are expected on small staging data. The provider reports leaked-password protection disabled; this remains a production activation item ([guidance](https://supabase.com/docs/guides/database/database-linter?lint=auth_leaked_password_protection)). No claim of production security acceptance is made.

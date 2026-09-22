# Scheduling and journey API

Same-origin JSON, secure cookie session, no-store responses and persistent rate limiting extend the Phase 1 API. All mutations use POST. Results retain `{ok,data}` / `{ok:false,code,message}`. `conflict` (409) includes stale/full/cancelled/finalized operations. Server validation and database authorization are both enforced.

- GET `/api/workspace`: existing records plus sport_levels, age_groups, academy_classes, class_sessions, trial_bookings, enrollments, session_roster, operation_events, coach_directory and coach_sessions. Existing pagination applies to tables. Coach projection is limited to the previous 7 and next 30 days, max 100 sessions.
- GET `/api/availability?enquiry=<UUID>`: sanitized eligible future sessions within 90 days, max 100. Requires enquiry access or its signed guest capability. Returns dates, class name, level, venue and live remaining capacity, never rosters.
- POST `/api/enquiries`: unchanged idempotent durable enquiry. Anonymous success also issues a short-lived capability for availability and booking.
- POST `/api/operations`: `{action,data}` validated by `lib/platform/operations.ts`.

Actions: `level.save`, `age.save`, `class.create`, `class.status`, `sessions.generate`, `lead.create`, `enquiry.level`, `trial.book`, `trial.cancel`, `session.cancel`, `attendance.finalize`, `trial.convert`, `family.claim`, `family.link`, `family.offer`, `family.accept`.

Booking payload: `{enquiry_id,session_id,override_reason?}`. Retry of the same current booking returns its original reference; a different session conflicts until cancellation. Capacity is locked and rechecked inside the transaction. Manual override cannot bypass branch, sport, capacity, past/cancelled sessions or unauthorized access.

Attendance: `{session_id,entries:[{id,attendance}]}`. Every active roster ID must occur exactly once. Status is present/absent/late/excused, distinct from trial/enrollment participation. Finalization is allowed from session start, locks subsequent normal changes, writes audit and absence/make-up-evaluation events. No make-up credit is automatically awarded.

Conversion: `{id:<trial booking>,class_id,override_reason?}`. Requires attended trial. Original lead, enquiry and trial remain. Creates active enrollment and upcoming roster entries, with `package_state=pending_configuration`. No invoice, membership price, payment or finance state is invented.

Classes are recurring definitions in Asia/Dubai; sessions are actual occurrences. Generation is bounded to 90 days and idempotent on class/date. It checks coach and venue overlaps. Pausing a class stops new allocations; cancel existing sessions explicitly when required.


Family offer/accept: staff with authorized family access issues an offer for an explicitly supplied, verified parent user ID. The response is a 24-hour random code; the same authenticated parent accepts it. The offer preserves the original child/enrollment and is consumed once. Parent-generated child-link sharing codes use a distinct purpose and cannot be used to grant guardianship. Booked/attended child associations are frozen; new child linking must happen before booking.

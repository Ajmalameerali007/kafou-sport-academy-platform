# Same-origin API

All responses use `Cache-Control: private, no-store`. Mutations require an exact allowed `Origin` and JSON, enforce a 24 KB body limit, and validate server-side. Cookie sessions are HttpOnly, SameSite=Lax and Secure on HTTPS. No browser database credentials are needed.

Results are `{ok:true,data}` or `{ok:false,code,message}`. Errors distinguish validation, unauthenticated, forbidden, conflict, rate_limited, not_found and unavailable. HTTP status matches the result. API messages never expose raw database errors.

| Method /api endpoint | Purpose |
|---|---|
| GET branches | Active, database-backed provisional enquiry preferences |
| GET locations | Confirmed active branches with recorded venues; excludes provisional labels |
| GET auth/session | Live account status, roles, permitted branch IDs, assurance level, destination |
| GET auth/mfa | User's enrolled factors |
| GET children | Signed-in parent's own guardian-linked children; empty for guests |
| GET workspace?offset=0 | RLS-filtered essential workspace data; stable pages of 200 per table, pagination metadata |
| POST auth/signup | name, mobile, email, password, confirmPassword; parent only, email verification required |
| POST auth/login | identifier (email only), password, remember |
| POST auth/forgot | email; enumeration-safe confirmation |
| POST auth/confirm | PKCE code, verified token hash/type, or provider-issued invite callback tokens |
| POST auth/reset | password, confirmPassword; requires authenticated session, then signs out all refresh sessions |
| POST auth/logout | Ends current browser session |
| POST auth/mfa/enroll | Starts TOTP enrollment |
| POST auth/mfa/verify | factorId, six-digit code |
| POST enquiries | Trial preferences and optional authorized childId; required UUID Idempotency-Key header |
| POST commands | `{action,data}`; typed domain commands below |
| POST staff/invite | email, staff role, branch_ids; super admin with AAL2 only |

Command DTOs are defined in `lib/platform/contracts.ts`. Supported actions: family.create/update, child.save/sport, consent.record, lead.note/update/convert, branch.save/sports, venue.save, staff.access, invitation.accept. Operations remain transactionally enforced in PostgreSQL even when called outside the website.

An enquiry atomically creates lead, prospective child information, enquiry reference and activity. The reference appears only after commit. Repeated identical keys return the original result; changed payloads or actors conflict. Similar contacts set `duplicate_review` without merging people. Exact DOB remains nullable; reported age and capture date are stored independently.

Conversion is explicit and audited. A selected existing child retains its authorized family link. A prospect creates a new child only after staff action. This does not add a guardian by email/phone, create enrollment, reserve a class or mark conversion revenue. Cross-branch linking needs head-office resolution.

The only exposed pipeline stages are new, contacted, interested, trial_offered and lost. Lost requires a reason. Follow-up timestamps are stored in UTC and displayed in the browser's timezone. Scheduling, bookings, payments and membership conversion are not implemented.

Staging APIs accept synthetic records only. Hosted signup/recovery/invitations stay unavailable until `AUTH_EMAIL_ENABLED=true` and hosted delivery has actually been verified. The frontend gate is not a substitute for provider Auth configuration; see setup instructions before real intake.

# Phase 2 access matrix

All decisions use current active profile, protected role assignments, branch grants and the existing Super Admin AAL2 requirement. Selecting a workspace does not grant permissions. Direct writes to operational tables are denied to authenticated clients; commands recheck permissions inside PostgreSQL transactions.

| Capability | Super Admin (MFA) | Head Office | Branch | Sales | Coach | Parent | Guest |
|---|---|---|---|---|---|---|---|
| Branch/venue/sport/level/class configuration | All | All | No | No | No | No | No |
| Staff/security management | Yes | No | No | No | No | No | No |
| Lead routing, notes, follow-ups | All | All | Assigned branch | Assigned branch | No | No | No |
| Eligible trial booking | All | All | Assigned branch | Assigned branch | No | Own enquiry | Own signed enquiry capability |
| Eligibility override | All | All | Assigned branch, reason required | No | No | No | No |
| Attendance/finalization/conversion | All | All | Assigned branch | No | No | No | No |
| Families/children | All | All | Explicit branch links | No | Assigned roster names only | Own guardian links | No |
| Enrollments/trial status | All | All | Assigned branch | Trials only | Own session projection | Own child/enquiry | Booking response only |

Coach projection contains session dates/status, class name, student name and participation kind only. It exposes no guardian contact, financial information or unrelated children. Permission revocation is checked on every read.

Guest cookie: a one-hour HMAC capability issued only after successful anonymous enquiry persistence. HttpOnly, Secure on HTTPS, SameSite Strict, /api scope. It authorizes that enquiry only; possession does not authorize family lookup or claiming an account. The elevated guest RPC is service-role-only; the HTTP server verifies the signed capability before using it.

Existing-family linking uses an authenticated parent's single-use, 24-hour random code plus the explicitly selected child. Staff must be authorized for the enquiry branch. Phone/email matching is never a linking mechanism.

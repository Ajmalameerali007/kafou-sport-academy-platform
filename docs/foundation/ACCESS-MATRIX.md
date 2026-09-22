# KAFOU Phase 1 access matrix

Every request uses Supabase user-scoped access. PostgreSQL RLS checks current profiles, role assignments and branch permissions, not editable metadata or a selected workspace. Database commands recheck authorization inside their transaction. A suspension denies access immediately; role/branch revocations apply without renewing the JWT.

| Capability | Parent | Coach | Sales | Branch | Admin | Super admin |
|---|---|---|---|---|---|---|
| Own account/security | Yes | Yes | Yes | Yes | Yes | MFA required |
| Family/children | Own guardian-linked family | None unless also parent | None unless also parent | Explicitly branch-linked families | All academy families | All, after MFA |
| Sport interest | Own child | No | No | Linked child | Yes; reviewed level | Yes; reviewed level |
| Enquiries | Own submissions | Own submissions if also parent | Assigned branches | Assigned branches | All | All, after MFA |
| Lead notes, follow-up, early stages | No | No | Assigned branches | Assigned branches | All | All, after MFA |
| Explicit enquiry→family linking | No | No | No | Assigned branch and authorized target family | All | All, after MFA |
| Branch/venue/sports configuration | No | No | No | No | Yes | Yes, after MFA |
| Staff privileges/invitations/suspension | No | No | No | No | No | Yes, after MFA |
| Audit history | No | No | No | No | Yes | Yes, after MFA |

Roles are additive. Switching workspaces never changes permissions. A coach-only account cannot access students. Removing parent access revokes guardian-based access even if historical guardian links remain. Super administrator MFA cannot be bypassed by holding another role.

Anonymous users can read sanitized active branch preferences and confirmed-location projections; they cannot read academy/family records or call the submission RPC directly. The same-origin enquiry endpoint validates and rate-limits guest submissions before a narrowly scoped service-role RPC. Authenticated submissions also have a database rate limit.

Public signup creates parent access only. Invited staff retain parent access as an independent workspace until an authorized super administrator explicitly changes their assignments. An invitation authorizes one verified Auth user, expires after 24 hours and cannot be replayed. No family is claimed by matching a phone/email.

Audit and consent records reject updates/deletes, including service-role SQL. Audit entries include actor, operation, entity/ID and redacted before/after values. Bootstrap/service operations have no human session actor and are identified as administrative setup in the setup evidence; ordinary staff changes carry the authenticated actor. Names, contacts, notes, passwords and tokens are excluded from audit snapshots.

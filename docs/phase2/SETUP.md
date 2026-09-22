# Staging operation and activation

This extends `kafou-staging` (Mumbai), not a production academy environment. Existing Sites access remains owner-only. No real email, payment or live-family activation is included.

## Demo accounts

The explicitly authorized addresses are admin.kafou@example.com, headoffice.kafou@example.com, branch.kafou@example.com, sales.kafou@example.com, coach.kafou@example.com and parent.kafou@example.com. Use the shared demo password supplied by the owner; it is not committed in the seed script or client bundle. Super Admin must enroll and verify an authenticator. There is no MFA bypass or public staff signup.

`KAFOU_DEMO_PASSWORD=<private value> node scripts/seed-operations-demo.mjs` seeds local fixtures. `--hosted --confirm-synthetic-staging` targets only the exact existing staging project. The script refuses an existing unmarked account and never sends mail. Hosted keys are read from the ignored private server key file; no key is bundled.

Profiles, families, children, branches, classes and seeded leads carry explicit synthetic markers. Synthetic locations/classes also include DEMO labels. Branch and coach access is limited to DEMO Dubai. Sales has only sales role, and Head Office has admin without super_admin. The parent family has two children with independent swimming/football levels. These are fixture configurations, not confirmed KAFOU facilities, timetables, capacities or achievement claims.

The hosted staging seed is a separate operator command; it is never part of database migration or production build. A production environment must start separately with approved operational data, private credentials and no demo seeding.

## Walkthrough

1. Head Office configures confirmed branch, venue, available sports, age group and sport-specific entry level; creates a recurring class with an authorized coach.
2. Generate dated sessions for a date range. Open their capacity and roster.
3. Sales creates a lead and its child enquiry, routes it within authorized branches, records follow-up and notes.
4. Parent may create a family/children. For a staff-origin enquiry, parent generates a sharing code and gives reception the code and chosen child reference. Reception explicitly links it. No automatic matching by email/mobile occurs.
5. Set a reviewed starting level if experience is uncertain. Check eligible sessions and book a free trial; the reference appears after commit.
6. Branch opens the roster once the session starts, marks all present, sets exceptions and finalizes.
7. Convert the attended trial to a compatible class. Refresh or sign in again as parent to see the persisted active enrollment. Commercial package setup remains pending.

## Email and owner activation

The requested demo Super Admin is explicitly authorized synthetic access. It is not a real operational owner identity. SMTP credentials/verified sender were not supplied; hosted recovery/invitation delivery remains disabled. Local Mailpit tests exercise those code paths without sending real emails. Real owner bootstrap and real SMTP remain separate activation tasks and must not be reported complete.


One current synthetic trial is seeded for an immediate attendance/conversion walkthrough, in addition to future recurring sessions. It is explicitly a demo fixture, not an actual KAFOU booking. A synthetic active enrollment provides assigned coach roster data. Hosted QA may have already converted the current fixture; create a new lead/trial for a fresh journey.

For staff-created families that later need a parent account, reception uses Families → Give a verified parent family access, enters that parent's account reference, and shares the returned code. The parent accepts it in Trials. This grants access to the existing family; it does not create duplicate children or infer identity from an email match.

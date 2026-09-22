# KAFOU portal productization

Goal: turn the existing six role experiences into a calm, coherent operational product while retaining all Phase 1/2 commands, RLS, sessions and tested invariants.

Source: the user's attached Portal Productization / UX Enhancement brief, interpreted alongside the locked Phase 2 exclusions. Authorization to build is explicit; proceed inline without another approval cycle.

Design: navy sidebar, white command bar, warm gray canvas, green accents, clear status language, 32px page headings, 14–16px body, compact forms, responsive cards. One shared shell; distinct management/sales/branch/coach/family home views. Use Radix dialogs for accessible drawers and command search. No new dependencies.

## Tasks
1. Tested pure data projections: Dubai-date metrics, scheduled occupancy, alerts, permitted-record search and branch filtering. Honest pagination scope; no invented financial/progression data.
2. Shared shell: role navigation, branch selector, keyboard command search, action center, account menu, quick actions, responsive sidebar, URL section state, loading and feedback. Workspace selector styled as a useful launch page.
3. Operational UX: sourced dashboards, sales pipeline/search/filter, lead profile drawer, session roster drawer, parent athlete cards and schedule, streamlined existing form presentation. Keep underlying commands intact and unsupported modules absent.
4. Responsive/RTL/a11y and full business regression. Independent final review with fixes. Publish same owner-only Sites preview and record delivery evidence.

## Verification
Unit tests for projections and filtering; browser tests for search, dialog focus, branch scope, pipeline, parent data, RTL/mobile and existing journeys. TypeScript, lint, production build, inherited database tests. Review partial datasets, no results, revoked/limited roles, UTC/Dubai boundaries, dialog dismissal and pending edits.

## Rulings
- Use existing staging data rather than expand synthetic records solely for visual density; the brief's final scope explicitly requests existing real staging data. Sparse states must remain usable.
- Omit unsupported revenue/payments/renewals/progression charts and actions; absence must not masquerade as zero or completed work.
- Display New/Contacted/Trial Booked/Trial Attended/Converted/Lost, matching the existing authoritative pipeline. Do not add Interested to the database.
- Alerts are derived operational attention items, not a fabricated notification-delivery service. Search explicitly covers loaded permitted records; no new API or authorization changes.

## Progress
- Baseline verified: clean codex/kafou-public, Phase 2 commit 01faa7e. Existing shell/forms inspected.

- Implemented shared shell, role-specific dashboards, pipeline, accessible drawers, athlete profiles, session tools, responsive styling and Arabic text.
- Independent review completed. Fixed all three important findings: branch editor scoping, participation-only family schedules, and guarded unsaved drawer edits. Regression coverage added for each.
- Final accessibility pass darkened pipeline counts. Local browser tests select sessions by stable record ID so repeated synthetic test runs cannot finalize a different session with the same class name.
- No API handlers, SQL migrations, RLS policies, permissions or business commands were changed.
- Final validation passed: TypeScript, lint, build, 17 unit tests, 78 database tests and all 42 browser journeys. Desktop/mobile and Arabic screenshots inspected. Ready for existing owner-only staging release.

# KAFOU connected daily operations — local handover

Date: 22 September 2026. This is a local implementation and evidence report, not a hosted release or full-platform acceptance.

## Exact identity and preservation

- Checkout: `/Users/viova/Documents/ChatGPT/SPORTS K`, branch `codex/kafou-public`.
- Base commit: `ac9ef030c660fb08a1c5789cfa9c32f27f278492`; existing uncommitted work is part of this build.
- Final source fingerprint: `0aa1254ba09f74dee0e320987df19a081006f4b9983003bc5f213f46196bb6cd`. `/api/release` matches the built manifest.
- Application: http://127.0.0.1:3101. Active database: `kafou-local`, PostgreSQL `127.0.0.1:56322`.
- Preserved source archive, before-file hashes, Git diff/status and private database dump are in `outputs/daily-operations-2026-09-22/`. Do not publish that directory wholesale: it contains a private database backup.
- No baseline source files were deleted. Existing data was not reset or reseeded. Historical invoices, memberships, attendance and payments were preserved. New synthetic expense/salary/shift/arrival/delivery records and permission audit entries were added for acceptance.
- Three additive migrations: `20260922130000_daily_operations`, `20260922140000_daily_workflow_corrections`, `20260922143000_daily_delivery_status`. Exact stored SQL equals each local migration; see `schema-equivalence.json`.
- Destructive fixture setup/rollback tests ran only in disposable database `kafou_stabilization_20260921`.

## What is implemented and where

| Workspace | Daily navigation and working entry points |
|---|---|
| Central Admin `/admin` | Overview, Branches, People, Programmes, Accounts, Reports, Settings. Branch directory opens the selected branch while preserving Owner identity. People retains coach/user management; Programmes retains classes, levels and packages. |
| Branch `/branch?branch=…` | Today, Customers, Admissions, Schedule, Attendance, Memberships, Accounts. Persistent branch identity; customer collection and expense submission retain scope. |
| Coach `/coach` | Today, My sessions, My students, Progress, My work. Clock in, open assigned session, take attendance, start delivery and complete the session through the shared register. |
| Accounts `/accounts` | Accounts overview, Collections, Expenses, Staff pay, Reports. Access requires Owner or explicit global Accounts capabilities. These grants do not confer configuration or user-management rights. Existing collection/report capabilities remain separately enforced. |
| Staff My work | Own shifts and pay, with central reviewed corrections available to authorized timekeeping users. |
| Parent `/parent` | Existing Home, Schedule, Progress, Family, Membership, Support preserved. Parent sees its own finalized student records; no staff register/photo access. |

Shared Today queries cover the requested UAE date on the server, with paginated sessions and complete counts. Existing calendar/customer, eligibility, package, membership, customer-payment, progress and coach compensation services are reused.

### Check-in and delivery

Staff shifts, student arrivals and coaching delivery are separate persisted records. One open shift per employee is enforced. Server time records clock-in/out; no claim of verified physical location. An old open shift requires reviewed correction; it does not deduct salary.

Student Check in writes a unique arrival and Present to the shared draft. Retry is idempotent; conflicting staff decisions are not overwritten. Manual/photo-assisted Present/Late finalization records an attestation, not an inferred photographic arrival time. Finalized attendance stays locked under existing correction rules.

Assigned coaches clock in before starting delivery. Authorized branch cover requires a reason. Complete session remains distinct from Finish attendance and uses the existing eligible coach earnings pipeline. A discovered status conflict between finalized attendance and delivery start was fixed with migration 143000. Reassignment correction is audited and revision checked.

### Expenses and employee pay

Expenses: draft → submitted → approved/rejected → part-paid/paid. Branch submits; Owner/explicit Accounts approves and records already-paid funds. Expense evidence currently uses a receipt/evidence reference field.

Employee salary agreements have effective dates and explicit branch/central allocations. Monthly obligations snapshot the agreement. Partial-month amounts require an explicit reviewed amount, reason and allocations; there is no automatic proration, overtime, deduction or statutory payroll calculation. Coaches remain on the existing compensation ledger and cannot receive duplicate employee salary obligations.

Payouts reduce outstanding liability without creating a second cost. Explicit allocations reconcile to the obligation and each cost-centre balance. Reversal appends a compensating record, preserves the original payout and requires a reason. No bank transfer or payment-provider action occurs.

## Actual verification and reconciliation

- `npm test`: 152 passed, zero failed.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed. The build tool emits its existing informational route-classification notice; build completion alone is not workflow acceptance.
- 18 relevant PostgreSQL suites: 582 assertions passed. Includes new daily operations plus attendance/photos, coach earnings/settlement, central management, customer journey, invoices, sibling allocation, complete reporting, stabilization, security and development.
- Existing Playwright attendance/stabilization regressions: 5 passed. They verify shared finalized rosters, Parent denial, Arabic mobile roster, sibling membership scope and compact package catalogue.
- Current route/role audit: 43 views across Owner, Head Office, Branch, Sales, Coach, Parent and Owner Accounts, with actual authenticated sessions. This is route/loading coverage, not proof that every action in each view was exercised.
- Responsive scan: 40 rendered combinations, four role homes × English/Arabic × 1440/1280/768/390/360px. No measured page-wide horizontal overflow or page exceptions. Financial drawers also inspected at 1440px and Arabic 360px after animations settled. These are browser emulations, not physical iPhone tests.
- Separate explicit Accounts grant was exercised with an ordinary Sales-role synthetic account; Accounts access worked and removal affected the open view. Test grant was revoked afterward.

| Executed browser slice | Observed result |
|---|---|
| Branch expense → Owner approval → partial payout → reversal | AED100 cost; AED40 payout left AED60 due. Reversal restored AED100 due and retained both original/reversal entries. |
| Employee agreement → monthly obligation → approval → allocated payout | AED1,000 approved cost, AED400 central payout, AED600 remaining Dubai liability. Coach and Parent payout attempts denied. |
| Coach clock-in → start → complete → clock-out | Completed shared delivery persisted; repeat completion left attendance unchanged; clock-out independent. |
| Coach agreement → earning → approval → recorded payout | Authenticated Owner configured a synthetic AED50 one-day agreement for the completed delivery date; one earning, repeated accrual returned the same ID, AED50 recorded payout, zero remaining. No employee salary was generated. |
| Branch student arrival → Coach canonical draft | One arrival persisted, Present shared draft, retry produced no second arrival. |
| Revoked attendance capability | Open Coach controls disabled and subsequent write returned403. Grant restored after test. |
| Parent | Correct child’s finalized Present record read; staff register/photo scope denied. |

Measured local timings: branch expense submission→Owner visible98ms; payout→Branch visible797ms; delivery response→Branch visible1802ms; revocation request→disabled451ms. Arrival commit→Coach API read105ms is **API observation**, not a measured visible-screen latency. These samples do not establish a production SLA or prove every cross-session path meets two seconds.

Financial, arrival and delivery recordings were captured during the implementation, before the final wording/detail-layout polish. Final runtime identity, screenshots, readonly financial checks and regression results are separately recorded; do not describe every earlier recording as originating from the final frozen build.

## Defects corrected

| Cause | Correction | Evidence |
|---|---|---|
| Fragmented task navigation | Role-specific primary groups and contextual secondary destinations | Role audit and before/after images |
| Today selected from an incomplete loaded batch | Server date query, totals and pagination | Daily SQL; rendered Today |
| Arrival, attendance and delivery conflated | Separate commands/tables, shared register, explicit completion | Arrival/delivery recordings; domain assertions |
| Attendance completed status blocked delivery | Narrow additive predicate correction, duplicate legacy button removed | Failing regression retained; corrected SQL/browser pass |
| Index-keyed allocation inputs lost values after removal | Stable controlled allocation rows | Actual salary form removal assertion |
| Payout reversal inaccessible | Authorized reversal action and compensating ledger entries | Expense reversal browser results |
| Revoked form could retain prior record snapshot | Current visibility/capability gates; fresh denied state | Static final review; open-view revocation tests |
| Reassigned delivery / partial salary / old open shift had no review path | Audited corrections, explicit partial-month amount, reviewed clock correction | New domain cases |
| Payout details ran together; Arabic payout label implied only coaches | Labeled payout cards, visible period/balance, generic Arabic label with correct dictionary precedence | Final English/Arabic financial screenshots |

## Remaining limitations and acceptance gaps

1. A single uninterrupted **new customer** browser journey from enquiry through trial, admission, payment, attendance, assessment, make-up and renewal has **not** been completed on this final build. Current evidence comprises authenticated operational slices and database journey/domain tests. Full office rehearsal remains open; test counts are not its substitute.
2. The new Accounts summary groups approved costs by the selected cost period and settlements allocated against those costs. An independent payout-date cash-flow report is not added; the interface explains this distinction.
3. Expense evidence is a recorded reference; a dedicated new expense-file upload/review flow is not implemented. Existing private document facilities are preserved.
4. The 43-view audit is narrower than every secondary form/action across the whole platform. Keyboard use, zoom, all long-record/empty/error combinations, continuous load and every synchronization edge are not exhaustively certified.
5. An intermediate repeat login sweep hit the existing authentication rate limit (429); it was not reset or bypassed. The final sweep reused existing sessions where available and subsequently passed all 43 views; see `frozen-role-audit.json`.
6. No new physical-device camera/attendance tests or real-child recognition validation. Existing local recognition work is retained but its previous model evidence is not rerun here.
7. No hosted verification or deployment. Payment Gateway, WhatsApp, AI calling and unrelated integrations remain inactive. Internal notifications and recorded payouts are not external delivery or money movement.
8. Launch salaries, prices, cancellation/proration/tax/consent policies remain client decisions. This build does not invent them.

## Evidence and changed files

Open `outputs/daily-operations-2026-09-22/index.html` for before/after images and recorded role segments. Exact results: `final-sql-results.json`, `final-role-audit.json`, `responsive.json`, `salary-browser.json`, `delivery-browser.json`, `arrival-browser.json`, `accounts-access.json`, `revocation-browser.json`, `coach-accounts.json`, `runtime-release.json` and command logs. Expense success results are retained in `finance-browser-failure.json`: that run passed the financial slice and stopped later on a salary-field selector; the resumed salary run passed separately. Initial test-script failures are retained rather than relabeled as passes.

Material source changes are listed in `source-changes.json`: shared workspace/shell, daily workspace, attendance and academy integration, Branch finance, grant UI, drawer unsaved-state handling, Arabic dictionaries, API route, daily schemas/server bridge, Accounts route, three additive migrations and focused domain/navigation tests. No unrelated public website redesign.

### Operational separation added after the original handover

The shell now routes **Student check-in**, **Attendance**, and **Staff attendance** as distinct destinations. The Student check-in screen can create a signed, branch-scoped synthetic rehearsal session and roster so staff can test an arrival immediately, even when the timetable has no available session. Arrival, attendance finalization, staff clocking and coach delivery remain separate persisted workflows. Staff attendance also exposes supervised photo consent, independent approval and local face verification for clock actions; the manual clock remains the fallback and hosted biometric activation is outside this local rehearsal.

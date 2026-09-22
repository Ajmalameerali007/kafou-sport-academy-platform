# Central configuration and branch operations

Authorized by the 21 September operational-structure correction. Local implementation only; existing data and functions retained. Source and database backup: outputs/branch-operations-2026-09-21/.

Central administration owns Branches, Coaches, Users and Packages. Opening a branch establishes a URL-persisted workspace, with Customers / Admissions, Classes / Attendance / Progress, and Memberships / Finance / Reports. Exiting returns to central administration. Branch actors receive only permitted branch choices. Branch context must travel with reads, navigation, reporting and normal transaction entry; RLS remains authoritative.

The package catalogue owns product identity. Branch offers are immutable versions of the existing commercial package contract. Editing creates an offer revision; purchased memberships retain the old contract. Disabling stops new purchases/renewals, not entitlement use. Historical versions cannot be re-enabled through an old action. Explicit reacceptance is required for changed terms.

Coach management connects identity, branch/sport/venue assignments, availability and classes to dated agreements. Existing accrual/approval/settlement records remain the financial ledger. Completed delivery creates pending earnings only when an applicable agreement exists. Per-session and hourly earnings use actual delivery; monthly agreements accrue after a complete configured calendar month. Cancellation is unpaid; substitute eligibility is explicitly selected. Approved amounts never recalculate. Suspension preserves history and flags future assignments.

Finance separates invoices, receipts, exceptions and coach payouts. Invoice payment inherits family/branch/invoice and submits through the existing atomic payment command. Complete server summaries are separate from paginated detail rows. Outstanding balances are labelled current; period collections and coach payments use the selected date range. Payouts settle liabilities and are not added to earned expense again.

Acceptance: create branch/configure accounts and coaches; branch-only package availability; branch customer/payment separation; completed-work earnings/approval/payment; disable without losing history; consolidated totals without duplication. Each needs UI evidence plus server permission/transaction regression, not a page-load claim.

> Subsequent completion update: see [COMPLETION-VERIFICATION.md](COMPLETION-VERIFICATION.md). A private local synthetic executor now exists; this document below records the earlier dry-run baseline. Operational cutover conversion and actual export validation remain incomplete.

# Mindbody migration planning and reconciliation

Status on 20 September 2026: **local dry-run capability implemented and tested with synthetic fixtures; actual export validation, database import, batch reversal and client reconciliation are blocked**. No Mindbody export, account-specific column specification, financial control report or approved target mapping has been supplied. This tool does not download Mindbody data, create accounts, grant guardianship, write SQL, create bookings, post receipts or activate memberships.

## What runs

From the repository root, with an existing private directory containing the source files and manifest:

```sh
node --import tsx scripts/migration/cli.ts --manifest /private/export/manifest.json --out /private/export/plan-001.json
node --import tsx scripts/migration/cli.ts --manifest /private/export/manifest.json --out /private/export/plan-002.json --previous /private/export/plan-001.json
node --import tsx --test tests/migration.test.ts
```

Replace these example paths with authorized local paths. No source files or database credentials are provided by the example. Node and the repository's installed `tsx` dependency are required. `--help` prints syntax. There is no `--apply`, `--import`, hosted target, network request or database client. Reports are created exclusively with owner read/write permissions (`0600`); existing files cannot be overwritten. Keep the containing directory private too. Exit 0 means validated dry run; exit 2 means a report with blocking exceptions; exit 1 means malformed input, a bound exceeded or report creation failure.

Even an exception-free report has `readyForImport: false`. It is evidence for review, never an import receipt or proof of destination compatibility. Current target branch/package UUIDs are only syntax-checked offline; a future authorized database preflight must verify organization, branch, package terms, sport, validity and permissions.

## Required source inventory and mapping decisions

Before processing a real export, record the source account, export timestamp/time zone, export options, operator, secure storage location and immutable original checksums. Obtain independently generated row counts and monetary control totals from the source owner. Preserve original exports; normalization is a separately reviewed transformation with its own revision and evidence. Never fill missing identifiers, birth dates, family relationships, acceptance, consents, outstanding debt or session balances with invented values.

The supplied CSV/JSON is a **normalized interchange contract**, not a claim that Mindbody exports these headers. Actual export schemas vary and have not been inspected. The approved mapping must explain each source column, relationship and exclusion, including whether source client IDs describe guardians, children or independent customers. Family grouping must be explicit and source-backed. Contact similarity never authorizes a merge, account claim or family access. When source identifiers exceed the accepted format, preserve the original privately and obtain an approved one-to-one mapping; do not strip characters or renumber automatically.

The source owner and academy operator must explicitly resolve branch/package meanings, membership validity and remaining-session definitions, cancelled/expired memberships, duplicate profiles, shared contact details, debt versus credit sign, refunds, voided transactions, and the cutover time zone. Convert timestamps to UTC using an approved transformation. Preserve the unmodified original and transformation provenance outside the report. `cutoverDate` is the first target operating date, supplied explicitly; financial history must predate it.

## Manifest contract (version 1)

The manifest is a strict JSON object. Unknown properties, duplicate JSON keys, repeated entity files, ambiguous column maps and unsupported entities are rejected.

| Field             | Required value/meaning                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`         | `1`                                                                                                                                                                                           |
| `sourceSystem`    | `"mindbody"`                                                                                                                                                                                  |
| `sourceAccountId` | Stable source account identifier; never an email or secret                                                                                                                                    |
| `datasetId`       | Stable identifier for this migration scope; retain it across dry-run revisions                                                                                                                |
| `snapshotId`      | Identifier of the supplied export snapshot                                                                                                                                                    |
| `mappingVersion`  | Reviewed normalization/column mapping revision                                                                                                                                                |
| `exportedAt`      | Explicit UTC timestamp, for example `2026-09-01T00:00:00Z`                                                                                                                                    |
| `currency`        | `"AED"`; other currencies are explicitly unsupported by this version                                                                                                                          |
| `cutoverDate`     | Valid ISO date `YYYY-MM-DD`                                                                                                                                                                   |
| `targetMappings`  | `{ "branches": { "source-branch-id": "verified-target-uuid" }, "packages": { "source-package-id": "verified-target-uuid" } }`; real UUID mappings must be supplied and independently reviewed |
| `files`           | One entry per included supported entity; `families` required, `children` required if memberships are included                                                                                 |

Each file entry has `entity`, `path`, `format` (`csv` or `json`), `columns`, `ignoredColumns`, `expectedRows`, and, for financial files only, `expectedMinor`. Paths are relative to the manifest directory, cannot escape it, and cannot point to symlinks. Source IDs are strings of 1–128 characters, starting with a letter/digit and then letters/digits, `.`, `_`, `:`, or `-`. JSON numbers are not accepted as source IDs or financial values.

`columns` maps canonical field names to exact supplied source headers. Every required canonical field must be mapped once; one input column cannot supply multiple canonical fields. Every input column must be mapped or listed in `ignoredColumns` with a meaningful explanation of at least ten characters. Example of column-map syntax only: `{"source_id":"Client ID","name":"Family Name"}`. These headers are hypothetical until an actual export is reviewed. An empty export still needs valid mapped CSV headers.

`expectedRows` is the original logical record count, excluding CSV headers. `expectedMinor` is a signed base-10 integer **string** supplied from the independently reviewed financial control; it must not be generated from the very rows being checked. Opening-balance and payment-history controls are separate.

## Normalized entities

All source values are strings. A JSON file is an array of flat objects. CSV supports UTF-8 BOM, quoted commas, escaped quotes and quoted multiline fields; malformed quoting, duplicate headers and uneven records are rejected. Required names must be nonempty and bounded. Dates must exist on the calendar. No missing value is inferred from another record.

| Entity             | Required canonical fields                                                                                                       | Optional fields   | Intended future handling                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `families`         | `source_id`, `name`                                                                                                             | `email`, `mobile` | Proposed family reference only; no Auth or guardian creation                                           |
| `children`         | `source_id`, `family_source_id`, `name`, `dob`                                                                                  | None              | Explicit source family reference; DOB before cutover                                                   |
| `memberships`      | `source_id`, `child_source_id`, `branch_source_id`, `package_source_id`, `starts_on`, `ends_on`, `remaining_sessions`, `status` | None              | Snapshot for reviewed migration design; not an accepted package, invoice, payment or entitlement grant |
| `opening_balances` | `source_id`, `family_source_id`, `as_of`, `amount`, `currency`                                                                  | None              | One family/currency opening snapshot, dated the day immediately before cutover                         |
| `payment_history`  | `source_id`, `family_source_id`, `occurred_at`, `amount`, `currency`, `kind`, `method`                                          | `reference`       | Historical reference only; never replay as a new payment/receipt or allocate to current invoices       |

Membership `status` is `active`, `expired` or `cancelled`; `remaining_sessions` is an explicit nonnegative integer string up to six digits; end date cannot precede start. This does not yet verify overlap, accepted package terms or entitlement policy against a destination database. Payment `kind` is `payment` or `refund`, with a strictly positive magnitude; the kind supplies its sign for history reconciliation. Method is `cash`, `card`, `bank_transfer` or `other`; it is source history and proves no provider settlement. Unsupported transaction types, gift cards, invoices, tax details, ledger adjustments, attendance, bookings, schedule recurrence, attachments and consent history need a separately reviewed extension, never a lossy substitution into these entities.

Money accepts exact decimal strings with zero, one or two fractional digits. It uses integer arithmetic: `"10.01"` becomes `"1001"` minor units; refunds subtract in the historical control. Floating-point JSON numbers, exponents, grouping commas, whitespace, leading plus, leading zeroes and extra decimals are rejected. Opening debt is positive, credit negative; source-owner approval of this convention is required. The parser preserves supported signed 64-bit amounts exactly, but amounts beyond the current commercial per-command limit of 1,000,000,000 minor units are held as `target_money_limit`. No rounding, splitting, currency conversion or financial posting occurs.

**Opening balance plus historical payments must never be summed into a target receivable or revenue total.** The balance already describes the cutover position; history explains past events. Each has its own row count, expected total, actual validated total and exact difference. Invalid rows remain exceptions even if the partial validated sum happens to match the control.

## Review report and repeat safety

The report contains source file SHA-256 digests, mapping fingerprint, source scope, source IDs, proposed deterministic target UUIDs, normalized row fingerprints, resolved reference UUIDs, separate reconciliation controls, exceptions and a comparison to the previous dry run. It excludes names, contact values, DOB, source free text and per-row amounts. Source IDs, links, hashes and aggregate balances can still be sensitive; the report is not safe for public sharing. Hashes are consistency checks, not encryption or signed evidence.

Proposed target IDs are stable for `(sourceSystem, sourceAccountId, datasetId, entity, source_id)`. Row edits and new snapshots do not create a different proposed identity. The same source files/mappings/controls produce the same `planId`. A repeated dry run labels rows unchanged, added, changed or removed **relative to the prior plan**, never relative to imported database state. Changed/missing rows and changed mapping revisions block reconciliation; no overwrite, delete or reversal is inferred. A different source account, dataset or cutover cannot be compared as the same scope. Previous report integrity is checked before comparison. Retain prior reports rather than editing them to clear exceptions.

Every exception is blocking. Resolve it in the source or approved transformation and produce a new manifest/report, preserving the earlier artifact and an operator decision log. Duplicate source IDs are never collapsed. Shared normalized email/mobile flags a possible duplicate and retains distinct identities. Missing/ambiguous family/child references and absent branch/package maps remain unresolved. Record explicit review of legitimate shared contacts and extend the exception-resolution workflow before importing; there is currently no override flag.

Limits: 256 KiB manifest; five entity files; 10 MiB per source file; 25 MiB total source bytes; 25,000 rows per file; 50,000 total rows; 4,000 characters per field; 100 CSV columns; 32 MiB report; JSON nesting at most 20. Larger datasets require a reviewed streaming/batch design with cross-batch duplicate and reference reconciliation. Arbitrarily splitting related exports to bypass limits loses safety and is not supported.

## Remaining import and reversal acceptance

Actual application requires a separate authorized implementation and rehearsal. It must persist an immutable batch with source hashes, mapping revision, approved exceptions, reviewer, source-ID/target-ID links and an import receipt. Uniqueness must be enforced in PostgreSQL; matching source IDs must be no-ops on exact replay and reject changed payloads. Validate current target permissions, guardian linking, commercial package semantics and all references inside controlled transactions. Reconcile row counts, family/child identities, membership units and each financial category before and after import with the source owner.

A reversal must identify only that batch's records and dependencies. If records have been used or subsequently modified, stop for review; do not delete unrelated families, payments, bookings or audit history. Financial corrections require approved compensating records, not deletion of posted history. Rehearse apply → exact replay → changed-source rejection → own-batch reversal → reconciliation in an isolated restored environment before considering cutover. **None of those database import/reversal steps has been implemented or tested by this tool.** A dry-run report cannot establish them.

Evidence for this delivery: `tests/migration.test.ts` exercises synthetic CSV/JSON, exact signed money, control mismatches, explicit mappings, duplicate IDs/contact review, reference failures, invalid dates, missing/changed rows, report integrity, file/row bounds, privacy of report fields, exclusive output and absent apply mode. See [OPERATIONS.md](OPERATIONS.md) for restore/rollback gates and [ACTIVATION-REGISTER.md](ACTIVATION-REGISTER.md) for owner/provider blockers.

## Local synthetic execution

Use `node --import tsx scripts/migration/execute-local.ts --confirm-synthetic-fixture --action apply --manifest /private/synthetic/manifest.json --review "Approved synthetic review reference" --out /private/new-evidence.json`. `resume` uses the same manifest; `reconcile` and `reverse` take `--batch <exact planId>`. Every output is exclusive and owner-readable. The named local Docker container is hard-coded; no hosted target flag exists.

The executor writes families/children and separate private membership, opening-balance and payment-history snapshots according to existing planner intents. It grants no guardianship and does not activate packages or turn imported historical payments into fresh collections. Reversal retains its manifest/run history, refuses changed rows and downstream activity, and relies on foreign keys to stop unrelated dependent deletion atomically. Never disable these checks or erase later transactions to force a reversal. The controlled operational activation of legacy balances/entitlements remains a separate unfinished cutover adapter awaiting actual mapping and approval.

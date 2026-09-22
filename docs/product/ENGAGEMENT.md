# Challenges, non-cash rewards and referrals

## Implemented journey

Head Office/Owner with `engagement.configure` creates and explicitly publishes immutable reward rules, challenge definitions and referral campaigns. Each rule states its purpose, description, fixed unit and quantity. Supported reward units are badge, star and point; there are no currency, payment-provider, cash-payout or implicit financial-credit fields. Rule revisions are distinct numbered records. Published rules cannot be overwritten.

Challenges accept either a required count of finalized present/late sessions or a target against one exact versioned sport metric. The database validates sport/level, numeric range, unit and higher/lower direction. Eligibility requires a current active enrollment in the challenge branch and sport, plus the configured sport level where applicable. Families enroll only their own child; coaches act only for currently assigned athletes; authorized engagement staff may assist. Joining twice returns the original entry.

Completion requests collect source IDs from real finalized attendance or published measured results within the challenge period. Request bodies cannot invent completion evidence. The claim window ends 30 days after the challenge end. Existing evidence within the published period may count even if recorded before the athlete joined. Authorized independent review revalidates evidence, and reward grant revalidates it again. Submitted/rejected reviews remain internal. Grant publishes the completion to the family and appends a reward ledger entry. Duplicate grant requests return the existing grant. Reversals append the exact opposite quantity, once, retaining the original issue and family-facing reason. Later attendance corrections do not automatically reverse an already issued reward; an authorized review/reversal is required.

Recognition rewards refer to existing approved `community` recognition nominations, preserving that nomination and its independent review. No parallel nomination model was created.

Each referral campaign uses the explicit `first_fully_paid_membership` rule. An authenticated guardian obtains an opaque family code; another authenticated guardian records the code for their own family before any membership exists. The database rejects the same family, families sharing a guardian, duplicate referred families and membership-before-referral claims. Partial payments, discounts and credit approval do not satisfy the qualification: net allocated payment must cover the original positive first-membership invoice. The qualifying membership must be created after referral entry and before campaign expiry. Qualification review and grant are separate authorized commands. A referrer sees their own non-cash reward, never the referred family's identity or payment record. Different people/accounts without a shared guardian still require human anti-abuse review; no identity-matching claim is made.

## Monthly report generation

`engagement.report.generate` lets a currently assigned coach create a versioned development-report draft from 1–30 already-published assessments for that child, sport and Dubai calendar month. It calculates real best values grouped by criteria version/unit/direction and counts finalized attended sessions within the coach's current assignments. The summary contains factual counts and values, not inferred narrative or invented percentages. `engagement.report.edit` lets that author edit a draft or returned summary; submitted and published reports are locked. Existing development submission, independent review and publication controls remain mandatory. Generated prose is English; coaches may write the final summary in Arabic before review.

## API and UI contracts

- Migration: `20260919235818_product_engagement.sql`, after shared/commercial/development/academy/community.
- Dispatcher: `private.engagement_command(text,jsonb)` is not callable by authenticated clients. Root adds it to `public.product_command` and the existing same-origin API.
- Validator/data exports: `engagementSchema`, `engagementTables` in `lib/platform/engagement.ts`.
- UI: `EngagementPanel(ProductProps)` in `components/platform/engagement-panel.tsx`. Root loads the exported tables plus permitted branches/families/children, sport levels, development criteria/session projection and existing recognition nominations. Root adds a navigation entry and merges `engagementArabic` into `useLocale`.
- Permissions: `engagement.configure`, `engagement.review`, `engagement.grant`. Each requires current Head Office role plus explicit branch/global grant, or shared Owner AAL2 authority.
- RLS: parent sees published rules, their enrollment status, published completions and their reward ledger. Internal qualification/review records are hidden. Coach entry/completion visibility rechecks current assigned-athlete scope. No direct authenticated table mutations.
- All writes use the shared academy transaction lock. Unique constraints additionally enforce child/challenge enrollment, referred-family qualification, source grant and reversal identity.
- No leaderboard, public child profile, external message or provider send is implemented or implied.

## Evidence

At handoff: **49 engagement database assertions passed** through the real public product RPC, in a rolled-back local transaction. Coverage includes draft privacy, eligibility/assignment boundaries, evidence validation, independent review, duplicate enrollment/grant/reversal behavior, ledger reconciliation, self-referral rejection, partial/full payment qualification, referred-family privacy, metric target validation, factual report generation/editing, submitted-report locks and published rule/ledger immutability.

**Four focused unit tests passed**, and the full repository unit suite passed **33/33** for challenge windows/rules, non-cash reward validation, opaque referral inputs and reversal-aware balances. Full TypeScript and scoped ESLint passed after implementation. The integration owner must verify the rendered role journeys, responsive/RTL UI, private API behavior and final combined revision. No browser or hosted verification is claimed here.

The migration was applied **only to the existing local database** with `docker exec ... psql -1`, preserving all existing data. The CLI's `db query --file` first rejected multiple SQL commands; the transaction-based psql fallback succeeded. No migration-history entry, hosted write, seed or reset was made by this implementer. The engagement command function was then reloaded locally after adding report draft editing; source and local function agree.

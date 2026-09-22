# Migration replay and local recovery evidence

## Verified result

**PASS: all 29 versioned migrations replayed from empty application schemas; 939 pgTAP assertions across 28 frozen SQL suites passed.** Three actual capacity races passed. The isolated local CLI advisors reported no WARN/ERROR findings; the separately recorded hosted native advisor report has 17 WARN finding instances, reviewed below. Function lint reported no errors and seven unused-variable warnings. The replay had no source drift and its disposable database was dropped.

An earlier, separately dated **full local synthetic database backup/restore passed**: 131 tables and 2,529 rows across `public`, `private`, `auth` and `storage` matched ordered row-set SHA-256 fingerprints and sequence positions. Source fingerprints were unchanged before dump, after dump and at completion. The private temporary data dump was deleted and the restored database dropped. That 01:05 UTC restore predates the five latest migrations; it remains valid historical evidence for its exact 131-table snapshot, not a restore test of the new compensation/target tables.

These establish two different results: empty application-schema source replay, and exact recovery of local synthetic database rows/schema. They do not establish hosted migration deployment, hosted backup/PITR recovery, provider/Auth configuration, cluster globals, Worker boot against the restored database, actual Storage object-byte recovery, external delivery or customer import/reversal.

| Evidence                    | Value                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Replay UTC                  | `2026-09-20T01:47:31.493Z` to `2026-09-20T01:47:45.478Z`                                                           |
| Replay database             | `kafou_replay_1789868851492_51944` (dropped)                                                                       |
| Restore UTC                 | `2026-09-20T01:05:56.675Z` to `2026-09-20T01:05:58.690Z`                                                           |
| Restore database            | `kafou_restore_1789866356673_46474` (dropped)                                                                      |
| Local container / source    | `supabase_db_kafou-local` / `postgres`                                                                             |
| PostgreSQL / CLI            | PostgreSQL 17.6 aarch64 / Supabase CLI 2.108.0                                                                     |
| Checkout HEAD during replay | `ac9ef030c660fb08a1c5789cfa9c32f27f278492`; uncommitted source identified by individual hashes below               |
| Before migration replay     | 0 application relations, 0 Auth users, 0 Storage objects                                                           |
| Post-race disposable rows   | 12 synthetic Auth users, 4 families, 6 children, 11 branches, 0 Storage objects; all dropped with database         |
| Replay runner SHA-256       | `1dbda1fd9a8cec1ab191d680e576eee670428c81a5ed57cc3683143ea431fbb8`                                                 |
| Restore runner SHA-256      | `67ee5d51709bf7c1b6e2c96eb81e6e780b4be62c749dd2358e69fcc262729124`                                                 |
| Full local dump SHA-256     | `28fee36f4f8bc841ec26de571bb17b5343f25a46f7ffd5d883cb33c5f58b9902`; dump deleted, not a retained recovery artifact |

Private ignored artifacts are `outputs/migration-replay/2026-09-20T01-47-31-492Z/` and `outputs/local-restore/2026-09-20T01-05-56-674Z/`. They retain frozen source, redacted verification logs and count/hash evidence. They are not public client download links. Raw data dump contents, credentials and connection URLs were not printed. The full dump existed only in a mode-0600 file inside a mode-0700 temporary directory and was deleted after the rehearsal.

## Reproduce source replay

```sh
node scripts/verify-migrations.mjs
```

The runner fixes the local container and loopback port. It generates a guarded `kafou_replay_<timestamp>_<pid>` database, snapshots migrations/tests/seed, and always attempts to drop only that generated database in `finally`. It never resets the running database, changes cluster roles, targets a hosted project or repoints a running service.

Actual command equivalents (`REPLAY_DB` and `SNAPSHOT` are generated paths/names; the connection URL is kept private in process memory):

```sh
docker exec supabase_db_kafou-local pg_dump -U postgres -d postgres --schema-only --no-owner
docker exec supabase_db_kafou-local createdb -U postgres "$REPLAY_DB"
docker exec -i supabase_db_kafou-local psql -X -U supabase_admin -d "$REPLAY_DB" -v ON_ERROR_STOP=1 -1 -At
```

The schema-only infrastructure dump is supplied through stdin. No rows are copied. Supabase's local superuser is used for privileged infrastructure settings. In the disposable database only, the runner then drops `private` and `public` with `CASCADE`, recreates pristine `public` and its standard usage/create grants, and verifies `0|0|0` application relations/Auth users/Storage objects. Dropping these schemas removes copied custom Auth triggers and Storage policies that depend on application functions; migrations must recreate their dependencies.

Every captured migration is applied in filename order, each atomically, using `psql -X -U postgres -d "$REPLAY_DB" -v ON_ERROR_STOP=1 -1 -At`. The captured seed creates the organization and seven provisional branch labels. A disposable private Storage **metadata-only** fixture follows: bucket `kafou-private-documents`, public=false, limit 524288 bytes, PDF/PNG/JPEG MIME types. It matches the captured operator configuration script and uploads no file bytes. Then:

```sh
supabase test db --db-url "$KAFOU_LOCAL_REPLAY_URL" "$SNAPSHOT/tests"
supabase db advisors --db-url "$KAFOU_LOCAL_REPLAY_URL" --type all --level info --fail-on error --output json
supabase db lint --db-url "$KAFOU_LOCAL_REPLAY_URL" --schema public,private --level warning --fail-on error --output json
python3 "$SNAPSHOT/verify-schedule-capacity.py" "$REPLAY_DB"
docker exec supabase_db_kafou-local dropdb -U postgres "$REPLAY_DB"
```

All checks returned exit 0. pgTAP reported `Files=28, Tests=939`, `All tests successful`, `Result: PASS`. Ordinary pgTAP fixtures roll back. Additional synthetic rows are committed only inside the disposable database for the races, then removed by dropping that database.

## Actual concurrency evidence

| Race                                                       | Observed outcome                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Two parents, final one-off event place                     | Exactly one commit and one capacity rejection; one active registration, one batch and one consent                              |
| Trial first, makeup competing for same final session place | Second connection observed waiting on shared advisory lock; trial commits; makeup reports `Session full`; one occupied seat    |
| Makeup first, trial competing for same final session place | Second connection observed waiting on shared advisory lock; makeup commits; trial reports `Session is full`; one occupied seat |

The first trial was cancelled through its real command before reversing the competition order. Final cross-type state: one reserved makeup, zero live trials, one live roster and the makeup credit reserved. Event race logs and cross-type race logs are separate. These small synthetic transactions establish contention correctness for the tested cases, not throughput or production load performance.

Race fixture SHA-256: `9d8a8ab190ad784fe1a7726b6b3924f398b9c40b9cf5a71ffe1c507fc6366785`. Race runner SHA-256: `57dbfb6fca63051883ab5cb47cf9de84e2a24ff86a7f21db06d653f48c38b1ad`. Both files are copied into the immutable run directory. The Python runner accepts only guarded disposable replay database names.

## Diagnostics and resolved defects

Final isolated local CLI advisors: **0 ERROR, 0 WARN, 173 INFO**. The informational findings are 170 unused indexes (expected on a freshly replayed, tiny synthetic workload) and three intended private RLS tables without client policies (`private.guardian_offers`, `private.guardian_link_origins`, `private.product_requests`). Full FK index coverage is tested; no unindexed-FK finding remains. Do not remove safety/lookup indexes based only on fresh-database usage statistics.

Function lint: **seven unused-variable warnings across five functions, no errors**. Variables: `public.operations_command.result`; `public.guest_trial.result/original_claims`; `private.foundation_command.bid`; `private.commercial_roster_event.key`; `private.commercial_command.p/result`. The substantive volatility contract and text-to-JSONB initializer diagnostics were corrected by the additive hardening migration. The six per-row Auth policy expressions and duplicate permissive session-change policies were corrected without changing their access union. Certificate/safety projections use invoker views over narrow explicitly authorized functions; no definer-view diagnostic remains.

Independent review reproduced and then verified these corrections in versioned regression tests: direct session moves now cannot bypass the entitlement-aware `schedule.move` boundary; explicit family unlinking removes makeup read/booking access; family-link changes invalidate cached RPC authorization; current linked-trial guardians receive time-change notices. The final replay covers exact family/branch financial scope, active confirmed branch/sport/level membership validation, guardian-link provenance and current-guardian consent regressions. It also verified that commands record the post-command access revision so a successful event registration's new family-branch link does not break its exact retry.

Earlier runs exposed a missing disposable Storage bucket fixture, a session-trigger alias collision, a training-guidance fixture column typo and the event retry regression. Those red runs are retained privately as diagnostic history. The 939-assertion snapshot above supersedes their partial results and the earlier 528-, 709- and 781-assertion snapshots; no apply/order/test/race failure remains in this snapshot.

## Hosted native advisor follow-up (20 September 2026)

After the release coordinator applied the 15 reviewed additive product migrations to owner-only `kafou-staging` (`cwdazidovxqeevmpicng`; 24 total versions), its native advisors reported **17 WARN finding instances across three warning rules, and 210 INFO instances across two informational rules**. The saved native tool response was read from private `outputs/product/hosted-advisors-2026-09-20.json` (SHA-256 `4c975f2127ff3fc7f005911dc3493ae89e3d5c35226b03c74b919cecc7681e1e`); security findings were observed at `2026-09-20T01:15:26.860Z`, index findings at `2026-09-20T01:15:23.971Z`. This bounded follow-up reviewed that saved result, source and read-only local function catalogs, and performed no hosted writes. Hosted application assigned the 15 product migrations new version timestamps (`20260920011339` through `20260920011508`); the exact hashes below identify the local replay filenames, not those hosted migration IDs. Native hosted rules and local CLI 2.108.0 diagnostics differ. The local zero-WARN result above must not be described as a zero-warning hosted security report.

- **2 anonymous definer-callability warnings:** `branch_preferences`, `confirmed_locations`.
- **14 authenticated definer-callability warnings:** `academy_command`, `branch_preferences`, `coach_attendance_sessions`, `coach_directory`, `coach_sessions`, `confirmed_locations`, `development_sessions`, `family_schedule`, `makeup_availability`, `operations_command`, `product_command`, `staff_directory`, `submit_enquiry`, `trial_availability`. The two public catalogs appear in both categories; these are 14 unique functions, not 16.
- **1 leaked-password-protection warning:** unresolved provider/Auth activation setting. Real owner and public-account activation require an approved setting and verified password-rejection/recovery flows; do not mark this remediated from SQL tests.
- **210 INFO:** 207 unused indexes and three private RLS tables with no client policies (`guardian_offers`, `guardian_link_origins`, `product_requests`). The private tables are accessed through guarded commands and intentionally lack client row policies. Synthetic workload index usage is not a reason to drop FK/lookup safeguards.

All 14 reviewed RPCs fix `search_path=''`. Effective local catalog checks confirmed anonymous execution only for the two catalogs, and authenticated execution for the listed functions. `SECURITY DEFINER` bypasses caller RLS, so explicit checks inside the function and its callees are the authorization boundary; an authenticated grant alone is insufficient. The review found no additional concrete authorization defect in these warnings. Their exposed status is intentional and remains visible in the report, rather than being suppressed or called repaired.

| RPC                         | Reviewed boundary and disposition                                                                                                                                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `branch_preferences`        | Intentional public read: active branch ID, slug, bilingual name, area and provisional flag only. No families, roster, contact or staff data. See foundation migration.                                                                                                                                                                 |
| `confirmed_locations`       | Intentional public read: active, non-provisional branches with a venue; branch ID/name/area and sports only. No private venue/contact/roster fields. See foundation boundaries migration.                                                                                                                                              |
| `staff_directory`           | Authenticated narrow read: active Sales/Branch staff IDs/names and permitted branch IDs, filtered by current `branch_access`; no contact details.                                                                                                                                                                                      |
| `coach_directory`           | Head Office only (`head_office`, including owner AAL2): active coach IDs/names and branch assignments; no contact details.                                                                                                                                                                                                             |
| `coach_sessions`            | Current coach role plus current assigned/substitute notice access; obtains the already guarded development projection. Cancelled-session notices omit students.                                                                                                                                                                        |
| `development_sessions`      | Current assigned/substitute coach or explicit Head Office review/publish permission; each student is an eligible current roster child. Bounded time window/200 sessions; cancelled or notice-only access gives an empty student list.                                                                                                  |
| `coach_attendance_sessions` | Current assigned/substitute coach plus explicit branch-scoped `attendance.finalize` permission. Minimal current roster IDs/names/kind/attendance; no guardian contacts, finance or private notes.                                                                                                                                      |
| `family_schedule`           | Active parent and MFA boundary; current family ownership or the caller's still-unlinked enquiry. Each nested participant is separately filtered, so a shared session does not reveal other families.                                                                                                                                   |
| `trial_availability`        | Exact enquiry authorization before read: current branch access or eligible parent submitter/current guardian. Only eligible future slot metadata and remaining capacity; no roster identities.                                                                                                                                         |
| `makeup_availability`       | Exact credit child/branch authorization, including current guardian or explicitly linked branch family; valid unexpired credit and eligible same-scope slots. No roster identities.                                                                                                                                                    |
| `submit_enquiry`            | Active authenticated actor (or separately granted server service role); caller-owned child if supplied, actor-bound idempotency and input/rate limits. Intentionally accepts an enquiry without a staff privilege/MFA requirement; it creates no booking, family claim or privilege and returns only its own request reference/status. |
| `academy_command`           | Public wrapper delegates to inaccessible `private.foundation_command`, which checks active actor/MFA and action-specific family/branch ownership; only AAL2 Super Admin manages staff roles/invitations. Booked-lead changes have an additional wrapper guard.                                                                         |
| `operations_command`        | Active actor/MFA, action-specific branch/Head Office/enquiry/claim checks, verified-user claim acceptance, transactional locks/capacity and guarded internal helpers. No general SQL or arbitrary-table dispatch.                                                                                                                      |
| `product_command`           | Active actor/MFA, fixed domain dispatch with per-target grants/ownership, current access-revision cache checks, post-command access hash and transaction serialization. Only AAL2 Super Admin changes grants; direct unreconciled session moves are rejected.                                                                          |

Source references: [foundation](../../supabase/migrations/20260919202722_foundation.sql), [catalog boundaries](../../supabase/migrations/20260919204128_foundation_boundaries.sql), [enquiry access](../../supabase/migrations/20260919210048_foundation_access.sql), [foundation command guards](../../supabase/migrations/20260919210049_foundation_review_fixes.sql), [scheduling](../../supabase/migrations/20260919215239_scheduling_core.sql), [coach directory](../../supabase/migrations/20260919215251_scheduling_access.sql), [product dispatcher](../../supabase/migrations/20260919233807_product_shared_core.sql), [development authorization](../../supabase/migrations/20260919233935_product_development.sql), [makeup/substitutes](../../supabase/migrations/20260919234250_product_academy.sql), [family/development projections](../../supabase/migrations/20260920001904_product_communications_revised.sql), [current access revision](../../supabase/migrations/20260920001906_product_policy_validation.sql), [optional coach attendance](../../supabase/migrations/20260920004925_product_coach_attendance.sql). The earlier 781 local assertions, now retained in the 939-assertion replay, include ownership, branch unlinking, cache revocation, financial scope, current guardians and coach permission regressions; they do not substitute for a fresh hosted runtime acceptance pass.

The latest replay also covers the additive invoker search/targeted coach projection, narrowly scoped coach emergency contacts, training-target lifecycle, recorded compensation settlement/reversal, and restored signed-cookie guest trial capability. The guest capability remains service-role-only, limited to unsubmitted/unlinked enquiries, and ends when a verified child is linked. All new suites passed without changing baseline migration files.

## Exact frozen source hashes

| Migration (version order)                             | SHA-256                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `20260919202722_foundation.sql`                       | `f6327b7dde5f643f3a22307caab36359bac24cd0afcd0aef4ad347098842fdef` |
| `20260919204128_foundation_boundaries.sql`            | `117e7492d82979bb7f60b7f21356350ee8db9d7108c2da60061f10e24e8527a5` |
| `20260919210046_foundation_hardening.sql`             | `146d1721c98db3e9a5908c0006c9bdffae9b9baa2c6882fa79dc6cf688e8845e` |
| `20260919210048_foundation_access.sql`                | `db3e4cb36eec9974bca4f97655529f8125d8e3aafa036170f20ef02ec8c4823e` |
| `20260919210049_foundation_review_fixes.sql`          | `6ae322688339037577c041db8525146d24de6b7331d230b7a2e27298170518fa` |
| `20260919210254_foundation_indexes.sql`               | `d8f499e7fcda6d757aedbd4cdfc8f5fdfa16540fcdda72d5da1e8af363690f1e` |
| `20260919215239_scheduling_core.sql`                  | `d303bf5f49c3babebadd3555b64c7f2e7ce3101ec779d60c4107a9f6486cb074` |
| `20260919215251_scheduling_access.sql`                | `88d59906cd0d07d7dfbc9d61ca740c4ac267fc400b5b18d77f9449fba895f0c3` |
| `20260919215359_scheduling_claim_indexes.sql`         | `6474f1edf7f814e78324ce3bacc67836bead385b69ce5186f27eebbda63aa757` |
| `20260919233807_product_shared_core.sql`              | `0c8044e9820e54592169f7269805c410217dc6110abb2dd67189f862c1f2c933` |
| `20260919233857_product_commercial.sql`               | `8a03aea1a33726abbfe26bcdf09c5116544dabe45be7f6b8e6054847932e3c19` |
| `20260919233935_product_development.sql`              | `c485a936f180c7812c3840be7fd253e597eb942c8656987cbe82677670d66194` |
| `20260919234250_product_academy.sql`                  | `43dc0d65f8ab8e99e8592fdc3cfaa259d80c949ff4219dab87456fff877c2b61` |
| `20260919235028_product_community.sql`                | `17b406a10445684bfde3a2b0acd5d0b46de562976e6cc94f001be2d4f8e77ff8` |
| `20260919235818_product_engagement.sql`               | `cd2cf7feb273a8192db73636b4a7f91f380eb83b31d904621b449c2610c8cc49` |
| `20260920001903_product_operations_revised.sql`       | `2e71980cf13718ec022d850f483555814cc50c01ed0dda6b568945ccd2420171` |
| `20260920001904_product_communications_revised.sql`   | `0b33033ed719abf2eff1644353f54e2e2937e3a7cf12dc6a0381779f083106ae` |
| `20260920001905_product_private_files.sql`            | `f2d7b1589a85eb6b29163aca44aaccee621c8bf2ef902df37d674ab429233252` |
| `20260920001906_product_policy_validation.sql`        | `78d4fc9ccaa1fbe4e3360393dea3ef5589e4df66733876e572cef6e62621430c` |
| `20260920003441_product_advisor_hardening.sql`        | `ff8703e4e7107803ef6bafb71a4044f70869d42a4fd91a13660f4489d59f8015` |
| `20260920003746_product_development_history.sql`      | `9e96ff32310d86c07807ef54fd527e0440202c0ff07ece021f110358d73ed31f` |
| `20260920003857_product_events.sql`                   | `d6b49991255dceb6d8d3950bdb7f1471e2aaa9b441599c14f05ee0859fbf76da` |
| `20260920004427_product_training_guidance.sql`        | `584918047adbf5167477ebbc0e2781d46c37d95cd4a622a560d56a23e03de6a7` |
| `20260920004925_product_coach_attendance.sql`         | `a4015a95c4aa2919d84701b4d91bcb81b5b9a757b5eb9c2749c7009e7adb68d5` |
| `20260920012510_product_workspace_search.sql`         | `0140d2c411c0bbc538343c92076e8aa279ac0ca058b5c479f593dc8baab55d4b` |
| `20260920012626_product_coach_emergency.sql`          | `c4f8189f236a68b29d5a0f6c54dc4da6e0659041ce2856244c27aae86628f9f8` |
| `20260920012833_product_compensation_settlements.sql` | `e93109d4db131606f1e83dd53ee68548bf2ec6c7ca33967f227ffa531042b8a8` |
| `20260920013226_product_training_targets.sql`         | `65200b55c28419642de21272b7bc5b113d845466171ed462498df1ec1e417d3a` |
| `20260920014110_product_guest_trial_capability.sql`   | `bb7171e193ad477549539c13fcde8d0ba6cedbbd23aee158b6376590cc30eee7` |

| SQL suite                      | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `academy-product.sql`          | `7983868989f053851c76f546f962d2e91e969d94b6f121f2f785ddfa6217bad2` |
| `advisor-hardening.sql`        | `a225a0254ce81da3de031c4da7ee14f0a951b92f4b55cdb44cadf951afc057f4` |
| `age-allocation.sql`           | `eb53b7c80fb7857db3f9da49da42de7f79060a1b8c9d2be67929c0a6fa5b8a74` |
| `boundaries.sql`               | `43700b4ca3078fff4f2075827004e1afad02a0821665077f1c9dee18a0d17221` |
| `coach-attendance.sql`         | `b658126898e93c8f87c499b2bf92cf04c411172a1e20cff1b0fe21d487fd6bd5` |
| `coach-emergency.sql`          | `3830fa25f117f59efd7ae4204b6c3d6580efd5059339fdad27c2a53f36e0bc78` |
| `commercial-scope.sql`         | `6453cc6fb9e6fe7b5cff82f5f45b509ed1ea0c496f6132589db124bb7c895d67` |
| `commercial.sql`               | `f695bf9294876deb840967e659ecc391c86a4d4489ab89737150de027ed497a5` |
| `communications.sql`           | `bda7740f6235bd231c48c21e73ae35c6c178dcbf2976a7a284b454e3031a887c` |
| `community-product.sql`        | `92d09bd2778d501a6121f986b1067dba14ced657c48955753c8590ea47d39035` |
| `compensation-settlements.sql` | `c96b8cd1a42cd8112c3ab1a1df4cfe08ea798c4c8801f3a516b6e4fcf69c3785` |
| `development.sql`              | `32bb9c05f27ff0863d36d834890c4600d02d92a30abdce00b160837636b2d2e6` |
| `engagement.sql`               | `30b110a29e4af01a8d85542e2847c664dcb6a56c32a04eeb58cb1ca210d82645` |
| `events.sql`                   | `58eeecc02b7c10e45eba9f47a0395c7bbbf13412a07b501bfe940d9864b8a869` |
| `files.sql`                    | `2ffecbed39614ee63e552838f754b028fc5c1ba8d3b9cd3d5e663513cabe4db7` |
| `foundation.sql`               | `b5c7a204930d8bd0da45431ca9400ffd79fc22432f34f06591bbdbf5e9e2cb4e` |
| `guardian-provenance.sql`      | `ee60f3bd1ac8bbfc75b850724c37a508620eb69c75ea0db335e271710c769dbc` |
| `guest-trial-capability.sql`   | `edaa8d63c1ea0e1487e2a3d7babc486cd5df66f006f543e1e30f91002cad8380` |
| `journey.sql`                  | `7e9e14a5bd06e55ba71b02f9d00894d7a64076804be84fd5578da0611c87ac2b` |
| `operations-review.sql`        | `72fd6cc0faaf42fe3afe42f739b255111b8937880716b3aba030d5cc5755cdf9` |
| `privileges.sql`               | `b4efa6cd296d779ca6562687eb51690afe0e72527370431a1aeb466539e1c475` |
| `product-core.sql`             | `17ab5a352b7bda3ce9c6a5fcf4eb8dbb5342415ae62714e43d2876f163b06a87` |
| `schedule-extension.sql`       | `bac6e7ac8a6aab653146c1d78e4640bc26d3b8007863f06c12e053372352732d` |
| `scheduling.sql`               | `42fa9dad12a3be0c5cd01ff17c678e414819925b04e94a2851c0d00e14703184` |
| `search.sql`                   | `d2aa59633cd7b0b1593e32ad123a71f258beee5a7973db544f2c2cb39a2b29b1` |
| `security.sql`                 | `e92750fb8f148b3fe2ce8aa5b8e3acd00e95f90b4ccffb7e058763bea1e7759d` |
| `training-guidance.sql`        | `428ab49a251d5b07dfe5f9419f03c5e40a33ed04376c1b99d84f3199999068ef` |
| `training-targets.sql`         | `d29594db333d4f5797fd56c1923db3bb5eb475543b1bc55115c60b86a99ae781` |

Seed SHA-256: `5b600b4df404cb81c839361058e93d1d091e1abc834edefcfc5bed78a10c3230`. Bucket-configuration source SHA-256: `8b674bd582e19110ff8971fef86001b586236ba4e0cc07e9283bd24173e542f6`. Infrastructure schema-only dump SHA-256: `f61b262910ae188dcd628f3d24f894bc568160e230b5234c4749f5a212d2c62d`.

The native hosted advisor snapshot above records the earlier 24-version hosted state at 01:15 UTC. At approximately 01:52 UTC on 20 September 2026, the release coordinator confirmed successful native hosted application of the five later migrations: workspace search, coach emergency contacts, compensation settlements, training targets and guest trial capability. Owner-only staging now has **29 applied migration versions (9 baseline + 20 product)**. This application update does not refresh the older native advisor counts or establish hosted UI/HTTP acceptance; the coordinator retains the native apply/version record. No hosted writes were performed by this reviewer.

## Reproduce full local restore

```sh
node scripts/verify-local-restore.mjs
```

The runner fingerprints all regular/partitioned tables in the four named schemas, takes a full `pg_dump -U postgres -d postgres --no-owner`, verifies that source rows did not change during the dump, creates a guarded `kafou_restore_<timestamp>_<pid>` database and restores through `psql -X -U supabase_admin -v ON_ERROR_STOP=1`. It compares each table's count and sorted JSON row-set SHA-256, plus every source/restored sequence position, then verifies the source remained unchanged. It stores only counts/hashes in evidence, deletes the restricted temporary data dump, and drops the destination. The recorded pass covers 131 tables and 2,529 rows with exact matches.

No Storage service or Worker was pointed at this restored database. Storage rows are metadata only; matching their hashes does not restore bucket object bytes. The rehearsal is not an encrypted retained hosted backup, a production recovery-time objective, or a deployment rollback drill. Those broader gates, real owner/MFA recovery, source-export reconciliation and provider activation remain in [OPERATIONS.md](OPERATIONS.md), [MIGRATION.md](MIGRATION.md) and [ACTIVATION-REGISTER.md](ACTIVATION-REGISTER.md).

Any subsequent migration/test change requires a new replay and hash record. These results do not claim that uncommitted files remained unchanged after the recorded run finished.

## Durable scheduler incremental verification · 20 September 2026 02:21 UTC

This is additional local evidence after the historical 29-migration/939-assertion snapshot above, not a replacement combined replay or a hosted cron claim. New migration `20260920020648_product_durable_jobs.sql` SHA-256: `00fd8af2ec150413ab78243de98e48431bdb071e6840b408fce8aeb264fab551`. Owned module/test/operator-script hashes: `outputs/jobs/2026-09-20T02-21-47-324Z/source-manifest.json`.

- `supabase test db tests/database/durable-jobs.sql`: **67/67 assertions pass**. The initial pre-implementation regression was red (worker absent), recorded in `/tmp/kafou-jobs-red.log`. Current tests include real SQL exception injection, rollback/retry/backoff/exhaustion, exact issuer/MFA/synthetic branch guard, original creator/current guardian/consent revocation, active-only seven-day reminders, immutable attribution, expiry staff queue and 205-recipient bounded continuation.
- `npx tsx --test tests/jobs.test.ts`: **4/4 pass**; typecheck and scoped ESLint pass. Security UI is integrated, but this entry does not claim a new compiled browser acceptance run.
- `node scripts/jobs/verify-local.mjs`: **11/11 actual checks pass**, source hash unchanged, in disposable database `kafou_jobs_1789870907324_55454`. Two separate real connections proved shared-lock contention/no duplicate effect. Temporary local pg_cron executed two successful five-second intervals; exactly one notification resulted, all external attempts remained zero, and events used a null human actor with durable job attribution.
- Exact provider-run timestamps/statuses and cleanup: `outputs/jobs/2026-09-20T02-21-47-324Z/evidence.json`. The temporary cron job and extension were removed and the disposable database was dropped. The failed initial bootstrap (private-table ownership after schema restore) was corrected to use the local `supabase_admin` schema owner; it was not counted as successful execution.
- Scheduler functions have no lint errors. Whole-database lint/advisors were checked during concurrent camp work; that agent was notified of its then-current ambiguity/policy warning and is resolving its own snapshot. Final whole-branch replay/advisors still require all agents' source freeze.

The migration creates no controls, cron extension or scheduled job. Runtime requires owner-approved synthetic scope; hosted approval must come from a real current owner AAL2 token for the exact project and is not fabricated by test fixtures. [JOBS.md](JOBS.md) contains the guarded activation, observation, pause and restore boundaries. No hosted scheduler writes, enablement, autonomous execution, external delivery or charges were performed by this verification.

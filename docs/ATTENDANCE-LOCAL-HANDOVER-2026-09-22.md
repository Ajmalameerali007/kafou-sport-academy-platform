KAFOU attendance — local implementation handover · 22 September 2026

The existing application now has one shared Coach/Branch attendance register with real local photo matching against approved, consented synthetic references. This is local attendance-slice verification, not hosted release or real-child recognition approval.

**Exact release identity**

- Checkout: `/Users/viova/Documents/ChatGPT/SPORTS K`; branch `codex/kafou-public`.
- Base commit: `ac9ef030c660fb08a1c5789cfa9c32f27f278492`. Existing and new work remains uncommitted; the commit alone is not this build.
- Running source SHA-256: `5f8053dcbd233eeb165263ca7b53d2172f90932a0a37a113fe7bc8f3e2fc96c2`.
- Public/private schema DDL fingerprint: `703b25dda5e5e8d60cac55df1e88ea7003d9e6d8b462318dcd478484e83b54d4`. Scope excludes owner/ACL declarations and random pg_dump restriction tokens; it is not a customer-data fingerprint.
- App: http://127.0.0.1:3101. Database: `kafou-local`, PostgreSQL `127.0.0.1:56322`.
- Authenticated `/api/release` matches the source manifest, every manifest input was rehashed, and all five new migration SQL bodies match the local migration ledger. [Identity evidence](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/release-identity.json>).

**Where to use it**

Coach: Coach Today → Take attendance; Assigned sessions → Take attendance/View attendance; selected dated session. Branch: Branch Today, Schedule/session details, or Attendance → selected dated session. Owner uses the same Attendance register and retains existing correction controls. Parent uses Schedule → History for their own finalized records.

[Open the verified session](http://127.0.0.1:3101/admin?view=Attendance&recordKind=session&record=9a32120f-0f4a-428b-8ffc-3db92017ebb8) using an authorized account. A Coach or Branch account can open the same identifier in its own workspace. Permissions remain account-specific.

**What changed and how it was verified**

| Area / original cause | Repair | Evidence |
| --- | --- | --- |
| Staff dated-session links used a coach-only hydration RPC | RLS-protected staff occurrence/class hydration, with the coach projection retained for coaches | Actual Branch and Coach drawers; hydration regression |
| Marks were local React state and roster completeness depended on loaded workspace records | Complete authorized session RPC; shared persisted revisioned draft; one canonical finalization path | Branch save → Coach view; 127 relevant SQL assertions across seven files |
| Hidden/unclear attendance entry points and bulk overwrite risk | Visible actions, roster counts/types, private reference thumbnails, manual states, bulk unmarked-only, undo unsaved work, sticky Finish | Desktop/mobile captures; actual manual/camera/photo journey |
| Processing could race with staff edits or a stale Finish click | Revision/token checks, explicit conflict recovery, processing lock, and wait for the committed revision before re-enabling Finish | Before-fix race log; final browser journey; concurrent-edit rehearsal |
| Upload did not perform identification | OpenCV YuNet + SFace per-face embeddings, roster-only candidate set, quality/threshold/margin rejection | Different generated reference/session photographs and unknown/poor-quality scenes |
| Consent and reference lifecycle | Separate guardian opt-in, staff approval, versioned references, withdrawal, private deletion, 30-day reference expiry | Actual parent withdrawal → blocked automatic finalization → manual confirmation → new approved reference |
| Retried saves/finalizations and changed recognition scope | Cached successes preserve current authorization; only fresh writes change provenance; photo receipts include reference-scope fingerprint | Successful-finish retry after withdrawal; repeated photo and newly approved reference regressions |
| Queued work could outlive permissions | Before-inference worker recheck, plus result acceptance checks; one worker, bounded durable local queue, retry/expiry | Worker authorization SQL tests; queue restart/retry/cleanup tests; genuine integrated processing |
| Locked attendance needed a recovery path | Audited correction requests; authorized staff use existing reasoned correction controls and can mark requests reviewed | Idempotent finalized-register request SQL checks; visible shared UI |
| Downstream duplication risk | Existing finalization/entitlement/make-up logic reused; in-app event/outbox emitted transactionally; delivery remains separate | Final session has one reserve and one consume, zero coach accrual, no delivered timestamp |

**Connected journey and measurements**

Separate authenticated Coach, Branch, Owner and Parent browser contexts were used. Branch saved a Late draft and Coach saw it. Earlier two-student runs preserved Late while a strong photo match filled the other student. The final run explicitly cleared its one synthetic draft mark, captured/stopped the Chromium test camera, uploaded two group photographs, automatically populated the eligible student as Present, and finalized through Coach. The other visible people stayed unidentified because they were outside that roster. Parent and Branch received the same finalized record.

Final foreground local measurements: shared draft 795 ms; finalized Branch register 1,301 ms. These are measured from the server transaction timestamp returned by the successful call and include response/render delay. Both meet the chosen two-second local target. Parent and Owner consistency was verified; their separate visible-update latency was not measured. Recognition processing time is separate from synchronization.

A real concurrent-edit rehearsal preserved Branch's unsaved decision, disabled a stale save, and required explicit review of the newer Coach draft. Grant revocation removed an already-open Coach view and the subsequent server write returned 403. Parents were denied both staff register and photo-scope endpoints. Approved reference thumbnails were decoded successfully in Coach and Branch browser regressions.

Repeated tests exhausted one original eight-session synthetic membership. A subsequent two-student finalization correctly failed and rolled back; no balance, price, membership terms or attendance history was reset to force success. The last successful run used the other child's remaining entitlement. Exhausted and unfinished synthetic rehearsal records are preserved. The UI now reports the precise “No remaining session entitlement” error. [Rejection evidence](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/exhausted-rejection.json>).

**Recognition result and boundary**

Engine: OpenCV 4.13.0, YuNet `2023mar`, SFace `2021dec`; binaries are checksum-pinned. Acceptance threshold 0.60 cosine similarity, next-candidate separation 0.12. One-face reference validation and quality rejection are active. Ambiguous candidate-template tests reject rather than guess.

Seven distinct synthetic session scenes contained ten known face appearances: eight correct strong matches, two missed/unclear faces in the deliberately poor-quality group, zero false accepts, and one unknown bystander rejected. Repeated group files and the two `session-03.jpg` copies are explicitly excluded from those independent-scene counts. The partially obscured test face was accepted; occlusion is not guaranteed to be rejected. Recognition-only times on this small local set were 6.8–26.7 ms. These results do not establish accuracy for children, swimmers or twins.

The assets were created with the built-in image-generation tool. Private asset folder: [Synthetic test photographs](</Users/viova/Documents/ChatGPT/SPORTS K/test-assets/attendance-recognition>). The exact generation tool input/prompt is [saved privately](</Users/viova/Documents/ChatGPT/SPORTS K/test-assets/attendance-recognition/GENERATION-PROMPT.private.txt>); scene provenance and duplicates are in `MANIFEST.private.json`. No real KAFOU photographs, scraped faces or customer biometric data were used. Git ignore and public-path 404 checks cover the fixture directory and private inference storage.

OpenCV's official [SFace model folder license](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/LICENSE) labels the material Apache-2.0, and YuNet's folder uses MIT. Commercial pretrained-weight/training-data clearance remains unresolved for this release; see the [upstream licensing question](https://github.com/opencv/opencv_zoo/issues/313). The local experiment has no purchased recognition provider or per-image service API charge. Local CPU/storage and image-generation compute are separate costs. Real-child activation remains disabled pending approval, appropriate consent and representative validation.

**Current verification**

| Command / scenario | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass; no errors or warnings |
| `npm test` | 148 passed |
| `npm run build` | Pass; framework reports its existing static route-classification limitation |
| `npm run local:verify` | Pass; local app/auth/database reachable, 62 migration files in manifest |
| Seven relevant SQL files against disposable `kafou_stabilization_20260921` | 127 assertions passed, rolled back fixtures |
| `test_jobs.py` | 3 queue-plumbing tests passed; these are not recognition-accuracy evidence |
| `test_engine.py` | 3 actual installed-model tests passed |
| `BASE_URL=http://127.0.0.1:3101 ATTENDANCE_REHEARSAL_SESSION=… npx playwright test tests/e2e/attendance-workspace.spec.ts --workers=1` with private test credentials injected | 3 passed |
| Connected journey, concurrency, consent and focused screenshot scripts | Passed; details in evidence JSON/logs |
| English widths 1440 / 1280 / 768 / 390 / 360; Arabic mobile 390 and 360 | No page-wide horizontal overflow in the tested routes; representative screenshots inspected |

SQL command used per file: `docker exec -i supabase_db_kafou-local psql -U supabase_admin -d kafou_stabilization_20260921 -v ON_ERROR_STOP=1 < tests/database/<file>.sql`. Files: attendance-workspace, attendance-photos, attendance-photo-finalization, attendance-photo-scope, attendance-worker, coach-attendance and compensation-settlements. Destructive/regression fixtures stayed in the disposable clone. Active-database writes were reviewed additive migrations, explicit synthetic rehearsal records and actual authorized account actions.

**Evidence and updated files**

- [Before Coach](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/before-coach.png>) · [Before Branch](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/before-branch.png>).
- [Final Coach desktop](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/coach-final-desktop.png>) · [Final mobile Arabic](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/coach-final-arabic-390.png>) · [Parent history](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/parent-history-390.png>).
- [Coach recording of the connected rehearsal](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/connected-recording/page@16e9a7112dd2a44a528c07800bd42e18.webm>); other role recordings are indexed in [the recording manifest](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/recording-manifest.json>).
- [Final browser measurements](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/browser-final.log>) · [Cross-role checks](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/acceptance-results.json>) · [Consent/deletion checks](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/consent-results.json>) · [Canonical business effects](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/business-effects.json>).
- [Recognition scores and scene-level results](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/recognition-evaluation-final.json>) · [Database test results](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/database-results.json>) · [All changed/added files and preservation comparison](</Users/viova/Documents/ChatGPT/SPORTS K/outputs/attendance-2026-09-22/preservation-comparison.json>).

Main implementation: `attendance-workspace.tsx`, `attendance-photos.tsx`, `attendance-server.ts`, `attendance-photos-server.ts`, `scripts/attendance/`, attendance styling/translations, shared session hydration, API routes, Coach/Branch entry points and private parent reference enrollment. Five additive migrations: `20260922083000_attendance_workspace`, `20260922090000_attendance_photo_local`, `20260922101500_attendance_photo_limits`, `20260922103000_attendance_replay_scope`, `20260922110000_attendance_worker_recheck`.

The initial source snapshot captured 572 files; none were removed. Source-before archive/patch and a private database backup remain in the evidence directory. No reset/reseed, discarded changes, membership-price changes, historical financial deletion, Site replacement or deployment was performed. Existing user work remains in the checkout.

**Remaining / operating notes**

Physical iPhone/Android camera behavior is unverified; the camera test used Chromium's emulated camera stream. HEIC has a clear export-to-JPEG fallback rather than native conversion. The full platform, unrelated historical test suites and hosted deployment were not re-certified by this attendance pass.

The local processor must be running for photo features; manual attendance remains available when it is unavailable. Group inputs are cleared after successful processing; pending/failed jobs and results expire after five minutes while the worker runs or on restart. Consent withdrawal invalidates access immediately and removes private reference files; other reference copies expire after 30 days. Stopping the worker pauses physical scheduled cleanup until restart. No photos/templates enter parent attendance responses.

Payment Gateway, WhatsApp, AI calls, social publishing and RFID remain inactive. In-app events are not external messages, offline accounting is not money transfer, and the local camera test is not physical-device certification. Hosted behavior and real-child recognition remain unverified.

For local service setup, model hashes, retention details and reproducible commands see [the processor README](</Users/viova/Documents/ChatGPT/SPORTS K/scripts/attendance/README.md>).

## 22 September extension: separate check-in rehearsal and staff face clocking

The operational shell now exposes three separate destinations: **Student check-in**, **Attendance**, and **Staff attendance**. Student check-in records the arrival event and updates the shared attendance draft; attendance finalization remains a separate reviewed action. Staff attendance records clock-in/out and delivery records remain separate from both.

Student check-in includes **Create test check-in session**. In the local synthetic runtime an authorized staff user chooses a permitted base class and the signed server command creates or reuses an open session, trial enquiry, trial booking and roster for the selected branch. This keeps the test path real and auditable while allowing a check-in rehearsal when no scheduled session exists. The action is branch-scoped, synthetic-only and capped at ten rehearsals per base class per Dubai day.

Staff attendance includes a consented staff-photo workflow. A synthetic staff member can add a clear reference photo; a different authorized branch manager or administrator must approve it. A later clock action submits a fresh photo to the loopback OpenCV YuNet/SFace worker, requires exactly one matching face and writes only the signed clock action, hash and processing receipt to the database. Raw photos and embeddings remain in the local worker, references expire after 30 days, withdrawal removes access, and manual clocking remains available. This is a supervised local rehearsal with no liveness detection and is not real-child or hosted biometric approval.

Current local verification after this extension: `npm run typecheck`, `npm run lint`, `npm run build`, Python attendance `py_compile`, and `node --import tsx --test tests/*.test.ts` (157 passed). Browser verification created a `CHECK-IN TEST · DEMO · badminton beginners` session, opened the separate register and recorded a trial learner as checked in while attendance stayed a draft. The local preview is served at `http://127.0.0.1:3101`; PostgreSQL is exposed separately on `127.0.0.1:56322`.

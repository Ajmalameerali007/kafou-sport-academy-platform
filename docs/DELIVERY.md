# KAFOU — cutout, Arabic and simplified booking delivery

19 September 2026 · SPORTS K · `codex/kafou-public` · existing owner-only Sites preview.

## Result

The four newly supplied transparent images replace Karate, Badminton, the Programs composition and the Player of the Week recognition image. Pale typographic/vector backgrounds, correct subject containment, responsive placement and scoped GSAP choreography extend the existing bright editorial design. No new image generation was used.

English/Arabic is available throughout the public site, authentication, trial, role placeholders and not-found page. Noto Sans Arabic is self-hosted. RTL layout, directional controls, translated alt text/validation/service notices and language persistence are included. Switching language retains form entries.

## Files created

- `components/kafou/{home,auth-page,trial-page,not-found-page,locale,booking-locations}.tsx`
- `lib/kafou/{arabic,branches,server-locale}.ts`
- `tests/e2e/polish.spec.ts`
- `docs/POLISH.md`, `docs/Noto-Sans-Arabic-LICENSE.txt`
- Four original alpha PNGs in `docs/source-assets/kafou-cutouts/`
- Twelve responsive WebP derivatives in `public/images/campaign/`
- Three Noto Sans Arabic font files in `public/fonts/`

## Files modified

Public/auth/trial/role/not-found pages and root layout; public stylesheet; KAFOU header, branding, hero, sports, programs, journey, motivation, editorial, motion, shared image/form, auth/access and trial components; media manifest; typed trial draft and validation; package manifest/lock; service and journey tests; asset/motion/delivery documentation.

## Routes

Existing routes retained: `/`, `/trial?sport=…&branch=…`, `/auth?view=login|signup|forgot`, `/parent`, `/coach`, `/sales`, `/branch`, `/admin`, branded 404. Existing homepage anchors remain. No new public API or operational dashboard was added.

## GSAP

Hero photo-mask/headline entrance and restrained perspective remain. The sports narrative retains its three-viewport desktop pin, uniform vertical scene wipes and counter-moving images. Caption children reveal with a controlled stagger; each sport uses a matching background word/linework depth plane. Programs has one reserved Flip composition; recognition uses the selected foreground and shared reveal. Background words/arcs move subtly with scrolling. Journey retains its measured SVG path and single Flip marker. Trial steps have a short 12px entrance. Component-owned cleanup, synchronized desktop Lenis, touch/short-screen native flow and reduced motion remain.

## Authentication and trial

Unified parent/student Login/Create Account/Forgot Password is translated and retains URL history, remember-me, password visibility, labelled errors and restricted staff access context. Roles still come only from the future authenticated backend.

Trial is shortened to **Choose → Your family → Review**. Required: sport, parent name, mobile, child name and age. Optional: branch preference, email, experience. Full DOB/family registration is deferred. Home selections prefill the enquiry; back/edit and language switching preserve in-memory values. Reload clears private data. Services explicitly report unavailable and never simulate success.

## Locations and schedule

Owner authorized provisional Dubai, Sharjah, Ajman and numbered labels. Seven working choices: Dubai, Sharjah, Ajman, DXB 2, DXB 3, SHJ 2, AJM 2. They are kept separate from confirmed location data and submitted only as preferences. Exact venue/sport availability and upcoming class dates/times remain unconfirmed and are clearly labelled. No false pins, timetables, capacities or confirmed bookings are displayed.

## Pending live activation

No credentials were needed for this phase. Live use needs authentication/trial API configuration, recovery-email setup, approved branch names/addresses/sports, real schedules/capacity, contacts and legal content. Operational dashboards remain outside this phase.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed, no code errors/warnings.
- `npm test` — **5 passed**.
- `node /Users/viova/.codex/plugins/cache/openai-curated-remote/sites/0.1.65/scripts/build-site.mjs` — production build passed (`npm run build` internally).
- `npm start -- --port 3101` — local production Worker started successfully.
- `BASE_URL=http://127.0.0.1:3101 npm run test:e2e` — **24 passed in 14.8s**.
- Automated WCAG A/AA checks on home/login/signup/recovery/trial in English and Arabic — zero violations.
- English/Arabic viewport checks at 320, 390, 590, 768, 1024 and 1440; short landscape checks; no document overflow.
- Production Arabic scan across eleven route variants — no unexpected English UI strings or runtime errors; KAFOU wordmark intentionally retained.
- Sports forward/backward active-scene access, pin teardown, rapid resizing, reduced motion, navigation history, optional form data, invalid age, matching passwords, all supplied cutout sources and no-storage behavior passed.

Visual evidence is in `outputs/polish-*.png` and `outputs/qa/`; browser test report is in `outputs/playwright-report/`. Testing used desktop Chromium/device-size emulation, not physical devices or Safari/Firefox performance profiling. Existing Vinext route-classification notices, Node DEP0205 and the Playwright NO_COLOR environment notice remain toolchain messages, not site runtime failures.

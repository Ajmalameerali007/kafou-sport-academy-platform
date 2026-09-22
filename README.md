# KAFOU Sport Academy

Cinematic public website, progressive trial enquiry and unified account access. Built with the Sites React/TypeScript starter (Vinext/Vite), GSAP 3, ScrollTrigger, Flip and desktop-only Lenis.

## Run

Requires Node.js 22.13+ and npm.

```sh
npm ci
npm run dev -- --port 3100
```

## Verify the production worker

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start -- --port 3101
# In a second terminal:
BASE_URL=http://127.0.0.1:3101 npm run test:e2e
```

Install Playwright Chromium if needed with `npx playwright install chromium`. Browser tests use synthetic data, stored only in test memory. Reports and screenshots are ignored under `outputs/`.

## Scope and integrations

The home page contains all public sections, linked by anchors. `/auth` keeps login, parent signup and recovery within one shell. `/trial` reviews preferences in six steps. Role routes are empty access placeholders, not dashboards.

`lib/kafou/services.ts` contains typed provider boundaries. The default adapters deliberately return unavailable responses and no confirmed locations. No personal data is sent, persisted or logged. Public signup has no role field. A future backend must authorize roles and sessions on the server; the client route map only selects destinations.

Native cross-page links avoid an upstream Vinext beta client-router/prefetch failure found in production QA. Auth view history uses the browser History API and handles back/forward. The existing framework, Worker deployment and server rendering remain intact.

Before live activation, provide the academy-approved locations/sport availability, authentication and trial API contracts, session/role authorization, recovery-email configuration, privacy/terms copy, contacts/social URLs and approved brand master. No credentials are needed to run this preview.

See [delivery report](docs/DELIVERY.md), [motion references](docs/MOTION.md) and [asset licenses](docs/ASSETS.md).

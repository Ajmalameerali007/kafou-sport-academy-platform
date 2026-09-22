# Portal Assistant and DigitalOcean Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a safe bilingual chat/voice assistant to every portal, replace the public hero image with silent looping video, and package the application for verified DigitalOcean deployment.

**Architecture:** A shared assistant dock calls server-owned streaming text and short-lived WebRTC voice endpoints. Role policy and bounded tool adapters reuse existing portal reads and commands; no model receives direct database access. The public hero uses H.264 video plus poster fallback, and DigitalOcean runs a production Node container with runtime secrets.

**Tech Stack:** React/TypeScript, Vinext/Vite, Supabase, GSAP/ScrollTrigger, OpenAI Responses API streaming, OpenAI Realtime WebRTC, Docker, DigitalOcean App Platform or Droplet.

**Spec:** `docs/superpowers/specs/2026-09-22-portal-assistant-digitalocean-design.md`

## Global Constraints

- Keep the permanent OpenAI key server-side in ignored/runtime secrets; never expose it to browser code, logs, tests, or committed files.
- Reuse existing role, branch, family, attendance, membership, invoice, and support permissions.
- Require explicit confirmation for every assistant mutation.
- Keep assistant context minimal and never persist transcript/audio/biometric data in browser storage.
- Preserve reduced-motion behavior, Arabic RTL, and manual workflow fallbacks.
- Do not call DigitalOcean deployed until provider success and HTTPS/browser verification are complete.

## Review Focus

- A parent must never receive staff or another family’s data: assistant context and tools are filtered by live account scope.
- A model-generated mutation must not execute from prose alone: confirmation cards must gate existing commands.
- A stream or voice session can fail mid-turn: the UI must preserve the conversation and offer retry/manual support.
- HEVC/MOV and autoplay restrictions vary by browser: H.264, muted, poster, `playsInline`, and reduced-motion fallback must work.
- DigitalOcean runtime must not depend on Wrangler-local behavior: container health and `PORT` handling must be explicit.

### Task 1: Video asset and hero motion

**Files:**
- Create: `public/video/kafou-hero.mp4`, `public/video/kafou-hero-poster.webp`
- Modify: `components/kafou/hero.tsx`, `app/globals.css`, `components/kafou/motion.tsx`
- Test: `tests/public-hero-video.test.ts`

- [ ] Transcode the supplied MOV to silent browser-safe H.264 MP4 and extract a poster frame.
- [ ] Render the video with autoplay/mute/loop/inline attributes and poster fallback.
- [ ] Adapt GSAP entrance and ScrollTrigger selectors to the video wrapper; disable scrub under reduced motion.
- [ ] Test markup attributes, public asset paths, and reduced-motion CSS.

### Task 2: Assistant policy and context

**Files:**
- Create: `lib/platform/assistant-policy.ts`, `lib/platform/assistant-context.ts`, `lib/platform/assistant-tools.ts`
- Create: `tests/assistant-policy.test.ts`, `tests/assistant-context.test.ts`

- [ ] Define role/branch/child scopes and allowed read/mutation tool metadata.
- [ ] Build bounded context from authenticated route/account data without raw-row or secret leakage.
- [ ] Define confirmation-required tool contracts and denial messages.
- [ ] Test parent/coach/branch/admin boundaries and mutation confirmation requirements.

### Task 3: Streaming chat endpoint and dock

**Files:**
- Create: `lib/platform/assistant-server.ts`, `components/platform/assistant-dock.tsx`, `app/assistant.css`
- Modify: `app/api/[...path]/route.ts`, `components/platform/portal-shell.tsx`, `components/kafou/header.tsx`
- Test: `tests/assistant-server.test.ts`, `tests/e2e/assistant.spec.ts`

- [ ] Add server-only OpenAI client construction from `OPENAI_API_KEY` and Responses API SSE streaming.
- [ ] Add route validation, rate limits, context assembly, tool dispatch, confirmation tokens, and actionable failure states.
- [ ] Mount the dock in public and protected shells with role-aware suggestions, Arabic/RTL support, keyboard controls, retry, clear, and reduced motion.
- [ ] Verify streaming, no-key/offline behavior, denied tools, and confirmed mutation flow.

### Task 4: Realtime voice

**Files:**
- Create: `lib/platform/assistant-realtime-server.ts`, `components/platform/assistant-voice.tsx`
- Modify: `app/api/[...path]/route.ts`, `components/platform/assistant-dock.tsx`, `app/assistant.css`
- Test: `tests/assistant-realtime.test.ts`, `tests/e2e/assistant-voice.spec.ts`

- [ ] Create a short-lived Realtime WebRTC session server-side with the same policy/context as chat.
- [ ] Add explicit microphone start, mute, stop, reconnect, and unsupported-browser states.
- [ ] Never send the permanent key to the browser; preserve chat fallback.
- [ ] Verify session response shape, permission denial, cleanup, and reduced-motion-safe UI.

### Task 5: DigitalOcean container and deployment

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker/healthcheck.mjs`, `docs/DIGITALOCEAN-DEPLOYMENT.md`
- Modify: `package.json`, `scripts/run-framework.mjs`, `next.config.ts`
- Test: `tests/container-config.test.ts`, `scripts/verify-digitalocean.mjs`

- [ ] Build a production Node image with non-root runtime, `PORT` support, health endpoint, and no secret baking.
- [ ] Add DigitalOcean App Platform specification or Droplet run instructions using runtime secrets.
- [ ] Run local container build/health smoke test and authenticated staging checks.
- [ ] Deploy only after DigitalOcean credentials/project/domain are available; verify HTTPS, assistant chat, voice token, and video playback.

### Task 6: Final verification and handoff

**Files:**
- Modify: `docs/ATTENDANCE-LOCAL-HANDOVER-2026-09-22.md`, `docs/DAILY-OPERATIONS-LOCAL-HANDOVER-2026-09-22.md`

- [ ] Run typecheck, lint, unit tests, build, container health, and focused browser tests.
- [ ] Check English/Arabic, public/portal role boundaries, mobile layout, reduced motion, and assistant offline behavior.
- [ ] Record the actual DigitalOcean URL and deployment status only after provider success.

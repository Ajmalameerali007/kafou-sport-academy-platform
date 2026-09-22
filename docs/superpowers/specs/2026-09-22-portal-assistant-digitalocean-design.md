# Portal Assistant and DigitalOcean Delivery Design

## Outcome

KAFOU gets one consistent assistant experience across the public site and authenticated role portals. The assistant is context-aware, bilingual, chat-first, and voice-capable, while all business mutations remain behind existing permissioned commands and explicit user confirmation. The public home hero uses the supplied academy video as silent, looping, autoplay media with a poster and reduced-motion fallback.

## Users and context

The assistant changes its safe vocabulary and available tools by role: public visitor, parent, student, coach, branch, sales, accounts, admin, and super admin. Context is assembled server-side from the current authenticated account, active branch/child/session scope, current route, and a small set of authorized read projections. Raw database rows, secrets, biometric material, full family records, and unrestricted administrative data are never sent to the model.

## Architecture

`AssistantDock` is a shared client component mounted by the public shell and protected portal shell. Text requests go to a server-only assistant endpoint that streams Responses API output as SSE. The server owns the OpenAI client, role policy, context builder, tool allowlist, rate limit, and audit metadata. Read tools return bounded projections. A write request produces a structured confirmation card and calls the existing domain command only after the user confirms.

Voice uses a separate server endpoint that creates a short-lived Realtime WebRTC session. The browser never receives the permanent API key. Voice shares the same role policy and tool restrictions as text, starts only after an explicit microphone action, and exposes a visible stop/mute state. If voice is unavailable, chat remains fully usable.

Conversation state is session-scoped and memory-minimal. The browser keeps only the current display state; no transcript, audio, identity, or assistant output is persisted in local storage. OpenAI requests use storage-minimizing settings where supported. Provider failures, rate limits, missing permissions, and stale context produce actionable UI states rather than invented answers.

## Assistant UX

The dock has collapsed, expanded, loading, streaming, voice-active, confirmation, error, and offline states. Suggested prompts are role-specific and route-aware. Messages support English and Arabic, RTL layout, keyboard navigation, reduced motion, readable timestamps, copy, retry, and clear session controls. The assistant explains when it can answer, when it needs confirmation, and when a staff member must take over.

## Public hero media and motion

The supplied MOV is transcoded to silent H.264 MP4 and a poster frame. The hero renders a `<video>` with `autoPlay`, `muted`, `loop`, `playsInline`, and `preload="metadata"`; it falls back to the poster image. Existing GSAP entrance choreography is adapted from the image selector to the video wrapper, and the hero video receives a restrained ScrollTrigger scale/translate handoff. `prefers-reduced-motion` disables scrub motion and allows a static poster fallback.

## DigitalOcean delivery

The application is packaged as a production Node container for DigitalOcean App Platform or a Droplet using the same image. Build-time output is produced by the existing Vinext build; runtime starts a production server on `PORT` and exposes `/healthz`. Supabase URL/keys, `OPENAI_API_KEY`, `APP_URL`, rate-limit secrets, and auth settings are runtime secrets only. Deployment is staging-first: build, container smoke test, authenticated assistant checks, voice-token check, public video check, then production promotion only when the DigitalOcean project and domain are available.

## Verification

Unit tests cover role policy, context minimization, tool authorization, confirmation requirements, stream error states, and assistant request validation. Browser checks cover public hero autoplay/mute/loop, reduced-motion poster behavior, English/Arabic assistant layout, protected portal context, denied tools, streaming output, and voice permission/stop states. Build, lint, typecheck, container health, and DigitalOcean deployment status must pass before claiming the deployment is live.

## Explicit boundaries

The assistant is not an autonomous operator. It cannot finalize attendance, alter memberships, approve payments, change permissions, send external messages, or perform biometric actions without the existing role permission and a user confirmation. DigitalOcean deployment is not complete until an actual provider deployment succeeds and the public HTTPS URL is verified.

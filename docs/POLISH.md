# KAFOU — cutout, Arabic and booking refinement

19 September 2026. Builds on the bright editorial revision without replacing the framework or activating a backend.

## Artwork and motion

The four supplied 23:03 transparent PNGs are preserved in `docs/source-assets/kafou-cutouts/`. Suffix 1 is badminton, 2 karate, 3 agility and 4 celebration. Three responsive WebP widths per image retain the alpha channel. Karate and badminton now use these foregrounds on all breakpoints, with contained equipment/subjects. Programs uses the agility foreground in its shared Flip composition; recognition starts with the high-five foreground and switches through sport concepts. Existing swimming/football desktop cutouts and mobile original-photo fallback remain.

Sport chapters use the existing three-viewport pin, consistent wipes and counter-motion. Caption items now enter in a controlled stagger. Pale background words and restrained vector arcs form a separate depth plane. Programs/recognition vector and typographic backgrounds have scoped scroll motion. Forms use a brief 12px step entrance with no scroll interception. Reduced motion keeps complete content visible and removes motion. Existing lifecycle cleanup and reading-position safeguards remain.

## Booking and branch scope

The trial enquiry is three steps: Choose → Your family → Review. Required fields are sport, parent name, mobile, child name and child age. Branch preference, email and experience are optional; DOB is deferred. Inputs remain in memory, including when switching language. Personal data never enters cookies/storage/query strings.

The owner supplied a seven-branch count and authorized provisional labels starting with Dubai, Sharjah, Ajman, DXB 2. The working list is Dubai, Sharjah, Ajman, DXB 2, DXB 3, SHJ 2, AJM 2. These are explicitly provisional preferences, not confirmed venue records. They live outside `LocationService`; `locationId` stays null. Homepage sport/branch selections carry into `/trial?sport=…&branch=…`. The upcoming-classes panel honestly states dates and times are still to be confirmed. No capacity, dates or booking confirmation are fabricated.

## Arabic

A shared translation catalog covers public content, navigation, authentication, trial steps, validation, service responses, role placeholders, not-found and alt text. Self-hosted Noto Sans Arabic supports appropriate line spacing and no negative letter spacing. RTL mirrors interface flow while retaining image orientation. Arabic age digits normalize to numeric age. Radix tabs/radio controls receive direction explicitly.

Language is a preference cookie only. Switching language updates React context without resetting form fields. Server requests derive HTML language/direction from that cookie. Page-local client trees keep the locale provider inside Vinext's page boundary; placing it around the server page slot caused an observed SSR/context mismatch and was corrected. Native route navigation and auth URL/history behavior remain.

## Pending live information

Approved branch names, addresses, sports per branch, actual class times/capacity, operational booking and authentication endpoints, recovery configuration, contacts and legal content remain needed for activation. This revision does not build dashboards or enable live submissions.

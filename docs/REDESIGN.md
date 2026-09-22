# Bright editorial redesign — approved plan and execution ledger

Approved scope: replace all rendered photography with the nine supplied campaign images, rebuild public/form styling around white/charcoal/green and DM Sans, strengthen hero and four-sport chapters, preserve routes/services/forms and owner-only Sites audience.

Mapping by source filename suffix: 1 stadium hero/CTA; 2 swimming; 3 football; 4 karate; 5 badminton; 6 coaching/why/trial; 7 programs; 8 parents/journey/auth; 9 recognition.

Baseline: 18e8e80 on codex/kafou-public, clean working tree. Existing feature branch and same site reused; no stack rebuild or backend activation. User approved implementation and private deployment.

Tasks: (1) media and hero/sports, (2) all remaining sections/forms and consolidated CSS, (3) scoped motion, (4) browser QA/review/release.

Ruling: preserve tested service behavior and validate visual changes through browser journeys/screenshots rather than implementation-mirroring unit tests. New media integration regression must first fail on the old site. Original campaign files retained under docs/source-assets, not served publicly.

Completed: all nine originals are assigned, WebP sources and typed manifest are shared across public/auth/trial views, old served photographs and condensed fonts removed, CSS consolidated. Desktop/tablet/mobile hero and closing invitation protect the athlete from copy overlap. Family crops and compact tablet/mobile form banners protect both faces.

Visual QA found a sports stacking-context defect after conversion to masked scene wipes. Scene isolation now keeps each caption above its own image and below subsequent chapters; the regression checks the actual topmost clickable caption, not only ARIA state. Hydration-ready navigation prevents lost initial mobile-menu clicks. Lazy-media integrity tests explicitly load off-screen assets.

User steering: after reviewing the redesign, the owner explicitly requested selective background removal and extra cinematic polish. This supersedes the earlier restriction against cutout derivatives. Swimming and Football now use transparent extractions with restrained water/pitch linework on suitable desktop displays; touch, tablet and short screens retain the full original photos. Other photographs remain intact. The derivatives use built-in image editing, not invented stock replacements.

Review: fresh-context reviewer found no actionable regressions in Flip selections, rapid interruptions, responsive cleanup or mobile overflow. Subsequent screenshot review corrected tablet headline overlap, caption stacking and family-photo framing. Final release results are recorded in DELIVERY.md.

Final verification: typecheck/lint/build exit 0; 4 service tests and 20 production Playwright tests passed. Direct section hash links are resolved once after motion/font layout initialization; the owned animation frame is cancelled on unmount. Private release follows the existing Sites project and unchanged owner-only audience.

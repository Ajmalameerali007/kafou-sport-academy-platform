# Motion responsibilities and source references

All animation logic is written for KAFOU components. No Codrops demo bundles, imagery, branding or typography are shipped.

- Hero: conceptual motion from https://github.com/codrops/ScrollTextMotion, using semantic line masks rather than scramble effects; 1.05s power3 reveal with 0.11s stagger. Photograph depth inspired by https://github.com/codrops/RotatingOnScrollAnimations, limited to 2 degrees rather than demo rotation extremes.
- Sports: https://github.com/codrops/StickySections is the architecture reference. One pinned scene on wide, tall, fine-pointer displays; native stacked scenes otherwise. Image/container counter-movement adapted from https://github.com/codrops/SlideshowAnimations/blob/main/js/demo1/slideshow.js . No Observer scroll interception or carousel UI.
- Journey: https://github.com/codrops/OnScrollPathAnimations provides scroll/path inspiration (its actual source morphs path geometry). KAFOU draws its own measured SVG stroke. https://github.com/codrops/OneElementScroll supplies the Flip.fit waypoint architecture. The marker never moves keyboard focus.
- Programs and recognition: https://github.com/codrops/ScrollBasedLayoutAnimations informs compact/expanded Flip transitions. Interactive selections animate one measured composition, not multiple floating cards. Native buttons and tabs remain usable by keyboard.
- https://github.com/darkroomengineering/lenis uses autoRaf:false, scroll -> ScrollTrigger.update, GSAP ticker -> lenis.raf(time*1000). One loop only. Disabled on touch, short windows and reduced motion; absent on form routes.

Component-scoped gsap.context/matchMedia cleanup removes timelines, listeners and smooth scrolling. Font readiness, lazy image loads and ScrollTrigger refresh remeasure geometry. No global trigger kill. Default HTML content remains visible without motion; reduced motion has no pins or scrubbed transformations.

## Bright editorial revision

Hero photo opens through a 1.35s inset mask and settles from scale 1.075; line masks, copy and controls overlap the entrance so navigation never waits. The photo has at most 2° perspective on suitable displays. Mobile uses a dedicated lower photo composition with no text over the athlete.

Desktop sports pin starts below the 88px header and lasts three viewport heights. Each subsequent chapter wipes vertically with the same 0.8 timeline-unit mask, counter-moving image crop and 0.65-unit copy entrance. Only the active scene is exposed to keyboard/assistive technology. Touch, short landscape and reduced motion retain natural chapter flow. Scene accessibility is synchronized on refresh as well as animation updates.

Programs reserve the composition height while GSAP Flip transitions its crop footprint. Journey SVG coordinates and Flip marker waypoints are remeasured after layout changes. The recognition photograph uses a controlled reveal and selected concepts share one transition language. Media-query teardown preserves the nearest reading section and removes owned pin state.


Final owner-requested polish: Swimming and Football gain transparent foreground derivatives over muted light scenes. Their background words and sport linework move independently in the same sports timeline, while the athlete shifts only 32px through depth. Original photos return through native picture sources on touch/short/mobile layouts. SVG water rings/pitch arc stay decorative and inaccessible to focus. The other two sports retain full photography. Scene isolation prevents earlier captions from painting over a later chapter. No additional animation loop or unowned trigger is introduced.

## Supplied-cutout and Arabic refinement

All four sport chapters now have selective foreground compositions on desktop; the newest Karate/Badminton foregrounds also remain on mobile. Sport-copy children reveal at 0.045 stagger over a 0.55 unit entrance. Programs and recognition use the supplied alpha artwork over pale words and SVG arcs: their background planes translate/rotate subtly in route-scoped scrubbed timelines. No new animation loop is introduced. Selection transitions remain component-scoped Flip. Trial steps use a 0.32s, 12px reveal, disabled under reduced motion. Changing language preserves live inputs and remeasures after Arabic font layout resolves.

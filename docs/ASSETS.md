# KAFOU campaign media

All nine photographs are supplied by the owner for this redesign. They are illustrative campaign compositions, not verification of facilities, staff, students or awarded achievements. No third-party stock is rendered. The owner subsequently requested two background-extracted derivatives; see below.

Original PNGs (1672 × 941) are preserved under `docs/source-assets/kafou-campaign/`, outside the served directory. The same-named WebP variants in `public/images/campaign/` are 640, 1000 and 1672 pixels wide, quality 83, with no upscaling. The typed manifest `lib/kafou/media.ts` defines sources, dimensions, accessible descriptions and desktop/mobile focal positions; `CampaignImage` applies them throughout.

| Supplied filename suffix | Internal ID | Placement |
| --- | --- | --- |
| (1) | stadium | Hero and closing invitation |
| (2) | swimming | Swimming chapter and level progression concept |
| (3) | football | Football chapter and trial selection |
| (4) | karate | Karate chapter and discipline concept |
| (5) | badminton | Badminton chapter, skills concept and after-school composition |
| (6) | coaching | Why KAFOU, trial introduction, kindergarten selection |
| (7) | agility | Programs default and sports-day composition |
| (8) | family | Journey and authentication introduction |
| (9) | celebration | Motivation default and fun-day composition |

DM Sans Latin weights 400–800 are self-hosted from Fontsource; its OFL is retained here. Old Barlow files, stock photographs and the cutout hero were removed from public assets. The brand is a plain typographic KAFOU wordmark with no invented emblem. No remote media requests are required.

## Selective cutouts requested in the final polish

`docs/source-assets/kafou-cutouts/{swimming,football}.png` preserve the alpha PNG outputs produced by the built-in image-editing tool. `public/images/campaign/{swimming,football}-cutout-{640,1000,1672}.webp` retain transparency at quality 87 / alpha quality 100. Only wide, tall fine-pointer displays use these derivatives. Responsive `<picture>` sources restore the full owner photograph on touch, tablet, mobile and short screens. Their purpose is editorial depth, not verification of a real athlete or achievement.

Prompt set (background-extraction): Swimming: remove indoor pool/building/lights/lanes and distant/defocused water; preserve swimmer, goggles, cap branding, shoulders/arms and naturally connected water splash; transparent alpha with delicate droplets; no new objects, text or anatomy. Football: remove stadium/sky/lights/people/fence and grass plane; retain the main player, exact strike pose, equipment/branding, football and a small existing turf spray; natural transparent edges; no new objects, shadows or anatomy. Both prompts explicitly requested faithful extraction rather than a new photograph. Final outputs were visually inspected and alpha verified before use.

## Supplied transparent artwork — 23:03 revision

The owner supplied four additional RGBA originals: badminton (1), karate (2), agility (3), celebration/high-five (4). These are copied unchanged to `docs/source-assets/kafou-cutouts/`; the served 640/1000/1672px WebPs use quality 88 and alpha quality 100, with no upscaling. Karate/badminton sport chapters, Programs and recognition now use these new foregrounds. All preserve the original subject orientation. No new media was generated in this revision. Self-hosted Noto Sans Arabic 400/600/700 is licensed under the OFL; see `Noto-Sans-Arabic-LICENSE.txt`.

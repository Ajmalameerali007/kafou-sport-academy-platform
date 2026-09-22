export type MediaId =
  | "stadium"
  | "swimming"
  | "football"
  | "karate"
  | "badminton"
  | "coaching"
  | "agility"
  | "family"
  | "celebration";
export interface CampaignMedia {
  id: MediaId;
  src: string;
  srcSet: string;
  width: number;
  height: number;
  alt: string;
  desktopPosition: string;
  mobilePosition: string;
  cutout?: { src: string; srcSet: string; width: number; height: number };
}
const descriptions: Record<MediaId, [string, string, string]> = {
  stadium: [
    "KAFOU campaign: a young player looking across a floodlit pitch",
    "50% 50%",
    "53% 50%",
  ],
  swimming: [
    "KAFOU campaign: a young swimmer moving through the water",
    "50% 50%",
    "50% 50%",
  ],
  football: [
    "KAFOU campaign: a young footballer striking the ball",
    "50% 50%",
    "53% 50%",
  ],
  karate: [
    "KAFOU campaign: a young karate athlete practising a punch",
    "50% 48%",
    "50% 45%",
  ],
  badminton: [
    "KAFOU campaign: a badminton player preparing to strike a shuttle",
    "65% 48%",
    "52% 45%",
  ],
  coaching: [
    "KAFOU campaign: a coach helping a young player prepare for training",
    "48% 50%",
    "48% 50%",
  ],
  agility: [
    "KAFOU campaign: a young athlete practising agility between cones",
    "52% 50%",
    "53% 50%",
  ],
  family: [
    "KAFOU campaign: parents encouraging children from the sideline",
    "85% 45%",
    "68% 45%",
  ],
  celebration: [
    "KAFOU campaign: a coach and young player sharing a high-five",
    "50% 50%",
    "52% 50%",
  ],
};
export const media = Object.fromEntries(
  Object.entries(descriptions).map(
    ([id, [alt, desktopPosition, mobilePosition]]) => [
      id,
      {
        id,
        alt,
        desktopPosition,
        mobilePosition,
        width: 1672,
        height: 941,
        src: `/images/campaign/${id}-1672.webp`,
        srcSet: [640, 1000, 1672]
          .map((w) => `/images/campaign/${id}-${w}.webp ${w}w`)
          .join(", "),
      },
    ],
  ),
) as Record<MediaId, CampaignMedia>;

// Original photos remain available; selected sections opt into owner-supplied transparent artwork.
for (const id of [
  "swimming",
  "football",
  "karate",
  "badminton",
  "agility",
  "celebration",
] as const) {
  media[id].cutout = {
    src: `/images/campaign/${id}-cutout-1672.webp`,
    srcSet: [640, 1000, 1672]
      .map((w) => `/images/campaign/${id}-cutout-${w}.webp ${w}w`)
      .join(", "),
    width: 1672,
    height: 941,
  };
}

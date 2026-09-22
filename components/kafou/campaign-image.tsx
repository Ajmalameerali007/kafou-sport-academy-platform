"use client";
import { useLocale } from "./locale";
import type { CSSProperties } from "react";
import { media, type MediaId } from "@/lib/kafou/media";
export function CampaignImage({
  asset,
  className = "",
  imageClassName = "",
  sizes = "100vw",
  priority = false,
  decorative = false,
  cutout = false,
}: {
  asset: MediaId;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
  decorative?: boolean;
  cutout?: boolean;
}) {
  const { t } = useLocale();
  const image = media[asset];
  const foreground = cutout ? image.cutout : undefined;
  const source = foreground ?? image;
  return (
    <picture
      className={`campaign-image ${className}`}
      data-media={asset}
      data-cutout={foreground ? "true" : undefined}
      style={
        {
          "--media-position": image.desktopPosition,
          "--media-mobile-position": image.mobilePosition,
        } as CSSProperties
      }
    >
      {foreground && (asset === "swimming" || asset === "football") && (
        <source
          media="(max-width:1099px), (max-height:699px), (hover:none), (pointer:coarse)"
          srcSet={image.srcSet}
          sizes={sizes}
        />
      )}
      <img
        className={imageClassName}
        src={source.src}
        srcSet={source.srcSet}
        sizes={sizes}
        width={source.width}
        height={source.height}
        alt={decorative ? "" : t(image.alt)}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
      />
    </picture>
  );
}

"use client";
import { useLocale } from "./locale";
import Link from "@/components/kafou/site-link";
export function Hero() {
  const { t } = useLocale();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-visual">
        <div className="hero-media-frame" aria-hidden="true">
          <video
            className="hero-athletes hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/video/kafou-hero-poster.jpg"
          >
            <source src="/video/kafou-hero.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="hero-shade" />
      </div>
      <div className="hero-content">
        <p className="eyebrow hero-enter">{t("A stronger start in life.")}</p>
        <h1 id="hero-title">
          <span className="headline-mask">
            <span>{t("Stronger kids.")}</span>
          </span>
          <span className="headline-mask">
            <span>{t("Brighter futures.")}</span>
          </span>
        </h1>
        <p className="hero-description hero-enter">
          {t("Big potential. Every child.")}
          <br />
          {t("Discover the sport that brings it to life.")}
        </p>
        <div className="hero-buttons hero-enter">
          <Link href="/trial" className="button button-green">
            {t("Book a free trial")}
            <span aria-hidden="true">↗</span>
          </Link>
          <Link href="#sports" className="hero-explore">
            {t("Explore our sports")}
            <span aria-hidden="true">↓</span>
          </Link>
        </div>
      </div>
      <div className="hero-bottom">
        <span>{t("Made for their next chapter.")}</span>
        <a href="#sports" aria-label={t("Scroll to sports")}>
          {t("Discover KAFOU")}
          <span aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  );
}

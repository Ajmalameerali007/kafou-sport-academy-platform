"use client";
import { useLocale } from "./locale";
import Link from "@/components/kafou/site-link";
import { sports } from "@/lib/kafou/content";
import { CampaignImage } from "./campaign-image";
export function SportsExperience() {
  const { t } = useLocale();
  return (
    <section
      id="sports"
      className="sports-section"
      aria-labelledby="sports-heading"
    >
      <div className="section-intro container">
        <p className="eyebrow reveal">{t("01 — Find their sport")}</p>
        <div className="intro-grid">
          <h2 id="sports-heading" className="reveal">
            {t("Four sports.")}
            <br />
            <span className="muted-heading">
              {t("A world of possibility.")}
            </span>
          </h2>
          <p className="body-copy reveal">
            {t("The first splash. The perfect pass. The focus. The feeling.")}
            <br />
            {t("Help them find their thing.")}
          </p>
        </div>
        <div className="sport-index" aria-label={t("Our sports")}>
          {sports.map((s) => (
            <span key={s.id}>
              <small>{s.number}</small>
              {t(s.name)}
              <span aria-hidden="true">↗</span>
            </span>
          ))}
        </div>
      </div>
      <div className="sports-stage">
        {sports.map((s) => (
          <article
            key={s.id}
            className={`sport-scene sport-${s.id} sport-with-cutout`}
            aria-labelledby={`sport-${s.id}`}
          >
            <div className="sport-image-wrap">
              {
                <div className="sport-atmosphere" aria-hidden="true">
                  <span className="sport-backword">
                    {t(
                      {
                        swimming: "FLOW.",
                        football: "PLAY.",
                        karate: "FOCUS.",
                        badminton: "RISE.",
                      }[s.id],
                    )}
                  </span>
                  <svg
                    className="sport-linework"
                    viewBox="0 0 1000 800"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {s.id === "swimming" ? (
                      <>
                        <ellipse cx="500" cy="545" rx="390" ry="90" />
                        <ellipse cx="500" cy="545" rx="460" ry="135" />
                      </>
                    ) : (
                      <>
                        <circle cx="510" cy="420" r="285" />
                        <path d="M180 740H880" />
                      </>
                    )}
                  </svg>
                  <span className="sport-scene-caption">
                    {t(
                      s.id === "swimming"
                        ? "Find confidence in the water."
                        : s.id === "football"
                          ? "Every touch. A new possibility."
                          : s.id === "karate"
                            ? "Strength starts within."
                            : "Find a rhythm of your own.",
                    )}
                  </span>
                </div>
              }

              <CampaignImage
                asset={s.id}
                cutout
                imageClassName="sport-image"
                sizes="100vw"
              />
            </div>
            <div className="sport-copy">
              <div className="sport-top">
                <span className="eyebrow">{t(s.tag)}</span>
                <span className="sport-number">
                  {s.number}
                  <small> / 04</small>
                </span>
              </div>
              <h3 id={`sport-${s.id}`} className="display">
                {t(s.name)}
              </h3>
              <p className="sport-headline">{t(s.headline)}</p>
              <p className="sport-description">{t(s.description)}</p>
              <Link
                href={`/trial?sport=${s.id}`}
                className="button button-green"
              >
                {t(`Try ${s.name.toLowerCase()}`)}
                <span aria-hidden="true">↗</span>
              </Link>
              <p className="sport-focus">{t(s.focus)}</p>
              <div className="sport-track" aria-hidden="true">
                <span style={{ width: `${Number(s.number) * 25}%` }} />
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="photo-note container">
        {t("KAFOU campaign imagery is illustrative.")}
      </p>
    </section>
  );
}

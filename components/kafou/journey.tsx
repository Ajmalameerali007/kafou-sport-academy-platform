"use client";
import { useLocale } from "./locale";
import { CampaignImage } from "./campaign-image";
import { journey } from "@/lib/kafou/content";
export function Journey() {
  const { t } = useLocale();
  return (
    <section
      id="journey"
      className="journey-section section-pad"
      aria-labelledby="journey-heading"
    >
      <div className="container">
        <div className="section-top">
          <p className="eyebrow reveal">{t("04 — One step at a time")}</p>
          <span className="section-note">{t("The KAFOU journey")}</span>
        </div>
        <div className="intro-grid">
          <h2 id="journey-heading" className="reveal">
            {t("From “let’s try”")}
            <br />
            {t("to “I can.”")}
          </h2>
          <p className="body-copy reveal">
            {t("A clear path. At their own pace.")}
            <br />
            {t("We see the potential. They discover it.")}
          </p>
        </div>
        <div className="journey-layout">
          <div className="journey-family reveal">
            <CampaignImage
              asset="family"
              sizes="(min-width:1100px) 95vw, (min-width:761px) 1200px, 100vw"
            />
            <p>{t("A journey for the whole family.")}</p>
          </div>
          <div className="journey-track">
            <svg
              viewBox="0 0 1000 220"
              preserveAspectRatio="none"
              className="journey-svg"
              aria-hidden="true"
            >
              <path
                d="M80 45H420Q500 45 500 110T580 175H920"
                className="journey-base"
              />
              <path
                d="M80 45H420Q500 45 500 110T580 175H920"
                className="journey-path"
              />
            </svg>
            <span className="journey-marker" aria-hidden="true" />
            <ol className="journey-list">
              {journey.map(([title, copy], i) => (
                <li key={t(title)} className={`journey-step journey-step-${i}`}>
                  <div className="waypoint" aria-hidden="true">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3>{t(title)}</h3>
                  <p>{t(copy)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

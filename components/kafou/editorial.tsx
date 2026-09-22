"use client";
import { useLocale } from "./locale";
import { CampaignImage } from "./campaign-image";
import Link from "@/components/kafou/site-link";
import { Brand } from "./brand";
export { BookingLocations as Locations } from "./booking-locations";
export function WhyKafou() {
  const { t } = useLocale();
  return (
    <section
      id="about"
      className="why-section section-pad"
      aria-labelledby="why-heading"
    >
      <div className="container why-layout">
        <div className="why-photo reveal">
          <CampaignImage
            asset="coaching"
            sizes="(min-width:1100px) 95vw, (min-width:761px) 1200px, 100vw"
          />
          <span>{t("More than coaching.")}</span>
        </div>
        <div>
          <div className="why-heading">
            <p className="eyebrow reveal">{t("03 — The bigger picture")}</p>
            <h2 id="why-heading" className="reveal">
              {t("Sport is the start.")}
              <br />
              <span className="muted-heading">
                {t("Character is the goal.")}
              </span>
            </h2>
            <p className="body-copy reveal">
              {t(
                "A good training session stays with a child long after it ends.",
              )}
              <br />
              {t("That is the difference we want to make.")}
            </p>
          </div>
          <div className="values-grid">
            {[
              [
                "01",
                "Skills for sport.",
                "Coaching that helps children understand movement, build technique and enjoy the process.",
              ],
              [
                "02",
                "Confidence for life.",
                "Room to try, learn and try again. Progress that starts with believing in themselves.",
              ],
              [
                "03",
                "A journey together.",
                "A family-focused approach with a clear path from first steps to the next challenge.",
              ],
            ].map(([n, title, text]) => (
              <article className="value-item reveal" key={n}>
                <span className="value-number">
                  {n}
                  <span aria-hidden="true">↗</span>
                </span>
                <h3>{t(title)}</h3>
                <p>{t(text)}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
export function TrialCTA() {
  const { t } = useLocale();
  return (
    <section className="trial-cta" aria-labelledby="cta-heading">
      <div className="cta-photo">
        <CampaignImage asset="stadium" sizes="100vw" />
      </div>
      <div className="container cta-content">
        <p className="eyebrow reveal">
          {t("Their first step starts with you.")}
        </p>
        <h2 id="cta-heading" className="reveal">
          {t("Start their")}
          <br />
          {t("next chapter.")}
        </h2>
        <p>{t("One new sport. A whole new world of possibility.")}</p>
        <Link href="/trial" className="button button-green">
          {t("Book a free trial")}
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
export function PublicFooter() {
  const { t } = useLocale();
  return (
    <footer className="public-footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Brand dark />
            <p>
              {t("More than sport.")}
              <br />
              {t("A stronger start in life.")}
            </p>
          </div>
          <nav aria-label={t("Footer sports")}>
            <span className="eyebrow">{t("Find their sport")}</span>
            {["Swimming", "Football", "Karate", "Badminton"].map((s) => (
              <Link key={t(s)} href={`/trial?sport=${s.toLowerCase()}`}>
                {t(s)}
              </Link>
            ))}
          </nav>
          <nav aria-label={t("Footer academy")}>
            <span className="eyebrow">{t("The academy")}</span>
            <Link href="/#programs">{t("Programs")}</Link>
            <Link href="/#about">{t("Why KAFOU")}</Link>
            <Link href="/#journey">{t("The journey")}</Link>
            <Link href="/#locations">{t("Locations")}</Link>
          </nav>
          <div className="footer-join">
            <p>
              {t("A little courage.")}
              <br />
              {t("A new beginning.")}
            </p>
            <Link href="/trial" className="text-link">
              {t("Book a free trial")}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/auth">{t("Parent / Student & staff login ↗")}</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()}
            {t("KAFOU Sport Academy")}
          </span>
          <span>{t("SWIMMING · FOOTBALL · KARATE · BADMINTON")}</span>
          <a href="#main-content">{t("Back to top ↑")}</a>
        </div>
      </div>
    </footer>
  );
}

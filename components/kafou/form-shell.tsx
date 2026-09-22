"use client";
import { useLocale } from "./locale";
import { LanguageSwitch } from "./locale";
import { CampaignImage } from "./campaign-image";
import Link from "@/components/kafou/site-link";
import { Brand } from "./brand";
export function FormShell({
  children,
  kind = "auth",
}: {
  children: React.ReactNode;
  kind?: "auth" | "trial";
}) {
  const { t } = useLocale();
  return (
    <div className={`form-shell ${kind}-shell`}>
      <aside className="form-story">
        <Brand />
        <CampaignImage
          asset={kind === "trial" ? "coaching" : "family"}
          priority
          sizes="(min-width:1100px) 95vw, (min-width:761px) 1200px, 100vw"
        />
        <div className="form-story-copy">
          <p className="eyebrow">{t("A stronger start. Together.")}</p>
          <h2>
            {t(
              kind === "trial"
                ? "A little courage. A new beginning."
                : "Their journey. Your front-row seat.",
            )}
          </h2>
          <p>{t("Every step means more when we take it together.")}</p>
        </div>
        <div className="form-story-footer">
          {t("SWIMMING · FOOTBALL · KARATE · BADMINTON")}
        </div>
      </aside>
      <div className="form-content">
        <header className="form-header">
          <Link href="/" className="back-link">
            <span aria-hidden="true">←</span>
            {t("Back to the academy")}
          </Link>
          <LanguageSwitch />
          <span className="form-header-label">
            {t("KAFOU /")}
            {t(kind === "trial" ? "YOUR FIRST STEP" : "WELCOME")}
          </span>
        </header>
        <main id="main-content" className="form-main">
          <noscript>
            <p className="service-notice">
              {t(
                "Please enable JavaScript to use account access and trial registration. No details are collected while JavaScript is disabled.",
              )}
            </p>
          </noscript>
          {children}
        </main>
        <footer className="form-footer">
          {t("KAFOU Sport Academy")}
          <span>{t("Stronger kids. Brighter futures.")}</span>
        </footer>
      </div>
    </div>
  );
}

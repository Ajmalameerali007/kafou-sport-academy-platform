"use client";
import {
  LocaleProvider,
  type Locale,
  useLocale,
} from "@/components/kafou/locale";
import Link from "@/components/kafou/site-link";
import { Brand } from "@/components/kafou/brand";
export function NotFoundPage({ locale }: { locale: Locale }) {
  return (
    <LocaleProvider locale={locale}>
      <NotFoundContent />
    </LocaleProvider>
  );
}
function NotFoundContent() {
  const { t } = useLocale();
  return (
    <main id="main-content" className="access-message">
      <Brand dark />
      <p className="eyebrow">{t("404 / A LITTLE OFF TRACK")}</p>
      <h1>
        {t("LET’S FIND YOUR")}
        <br />
        {t("WAY BACK.")}
      </h1>
      <p>
        {t(
          "This page isn’t part of the journey. There’s plenty to discover at the academy.",
        )}
      </p>
      <Link href="/" className="button button-dark">
        {t("Back to KAFOU")} <span aria-hidden="true">↗</span>
      </Link>
    </main>
  );
}

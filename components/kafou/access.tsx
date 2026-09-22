"use client";
import { LocaleProvider, type Locale, useLocale } from "./locale";
import Link from "@/components/kafou/site-link";
import { Brand } from "./brand";
export function AccessPlaceholder({
  role,
  locale,
}: {
  role: string;
  locale: Locale;
}) {
  return (
    <LocaleProvider locale={locale}>
      <AccessContent role={role} />
    </LocaleProvider>
  );
}
function AccessContent({ role }: { role: string }) {
  const { t } = useLocale();
  return (
    <main id="main-content" className="access-message">
      <Brand dark />
      <p className="eyebrow">
        {t(role)} / {t("ACCESS")}
      </p>
      <h1>
        {t("YOUR NEXT CHAPTER")}
        <br />
        {t("IS TAKING SHAPE.")}
      </h1>
      <p>
        {t(
          "This portal is not available in the public preview. No account session or operational information is shown here.",
        )}
      </p>
      <Link href="/auth" className="button button-dark">
        {t("Go to account access")}
        <span aria-hidden="true">↗</span>
      </Link>
      <Link href="/" className="button">
        {t("Back to the academy")}
        <span aria-hidden="true">↗</span>
      </Link>
    </main>
  );
}

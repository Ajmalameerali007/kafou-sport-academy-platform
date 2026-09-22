"use client";
import { createContext, useContext, useLayoutEffect, useState } from "react";
import { useHydrated } from "@/lib/kafou/use-hydrated";
import { platformArabic } from "@/lib/platform/arabic";
import { arabic } from "@/lib/kafou/arabic";
export type Locale = "en" | "ar";
const LocaleContext = createContext<{
  locale: Locale;
  change: (next: Locale) => void;
}>({ locale: "en", change: () => {} });
export function LocaleProvider({
  locale: initialLocale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState(initialLocale);
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) window.dispatchEvent(new Event("resize"));
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  const change = (next: Locale) => {
    document.cookie = `kafou-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setLocale(next);
  };
  return (
    <LocaleContext.Provider value={{ locale, change }}>
      <a className="skip-link" href="#main-content">
        {locale === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}
      </a>
      {children}
    </LocaleContext.Provider>
  );
}
export function useLocale() {
  const { locale, change } = useContext(LocaleContext);
  const t = (value: string) =>
    locale === "ar" ? (platformArabic[value] ?? arabic[value] ?? value) : value;
  return {
    locale,
    change,
    t,
    dir: locale === "ar" ? ("rtl" as const) : ("ltr" as const),
  };
}
export function LanguageSwitch() {
  const { locale, change } = useLocale();
  const ready = useHydrated();
  return (
    <button
      type="button"
      className="language-switch"
      disabled={!ready}
      lang={locale === "en" ? "ar" : "en"}
      aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"}
      onClick={() => change(locale === "en" ? "ar" : "en")}
    >
      {locale === "en" ? "العربية" : "EN"}
    </button>
  );
}

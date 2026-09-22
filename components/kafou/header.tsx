"use client";
import { useLocale } from "./locale";
import { LanguageSwitch } from "./locale";
import Link from "@/components/kafou/site-link";
import { useEffect, useState } from "react";
import { Brand } from "./brand";
import { useHydrated } from "@/lib/kafou/use-hydrated";
export function PublicHeader() {
  const { t } = useLocale();
  const ready = useHydrated();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 35);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return (
    <header className={`public-header ${scrolled ? "is-scrolled" : ""}`}>
      <Brand />
      <nav className="desktop-nav" aria-label={t("Main navigation")}>
        <Link href="/#sports">{t("Sports")}</Link>
        <Link href="/#programs">{t("Programs")}</Link>
        <Link href="/#locations">{t("Locations")}</Link>
        <Link href="/#about">{t("About us")}</Link>
      </nav>
      <div className="header-actions">
        <LanguageSwitch />
        <Link className="login-link" href="/auth">
          {t("Log in")}
          <span aria-hidden="true">↗</span>
        </Link>
        <Link className="button button-green button-small" href="/trial">
          {t("Free trial")}
          <span aria-hidden="true">↗</span>
        </Link>
        <button
          className="menu-toggle"
          disabled={!ready}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(!open)}
          aria-label={t(open ? "Close navigation" : "Open navigation")}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          className="mobile-nav"
          aria-label={t("Mobile navigation")}
        >
          {[
            ["Sports", "/#sports"],
            ["Programs", "/#programs"],
            ["Locations", "/#locations"],
            ["About us", "/#about"],
            ["Log in", "/auth"],
          ].map(([label, url]) => (
            <Link key={t(label)} href={url} onClick={() => setOpen(false)}>
              {t(label)}
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

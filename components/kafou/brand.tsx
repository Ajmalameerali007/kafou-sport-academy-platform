"use client";
import { useLocale } from "./locale";
import Link from "@/components/kafou/site-link";
export function Brand({ dark = false }: { dark?: boolean }) {
  const { t } = useLocale();
  return (
    <Link
      href="/"
      className={`brand ${dark ? "brand-dark" : ""}`}
      aria-label={t("KAFOU Sport Academy home")}
    >
      <span className="brand-name">{t("KAFOU")}</span>
      <small>{t("SPORT ACADEMY")}</small>
    </Link>
  );
}

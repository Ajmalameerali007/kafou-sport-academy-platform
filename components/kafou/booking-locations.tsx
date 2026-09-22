"use client";
import { useHydrated } from "@/lib/kafou/use-hydrated";
import { useState } from "react";
import { CalendarDays, MapPin, ArrowUpRight } from "lucide-react";
import { useLocale } from "./locale";
import { sports } from "@/lib/kafou/content";
import { useBranchPreferences } from "@/lib/kafou/branches";
import Link from "./site-link";
export function BookingLocations() {
  const { t, dir } = useLocale();
  const ready = useHydrated();
  const { branches: branchPreferences, error } = useBranchPreferences();
  const [sport, setSport] = useState("swimming");
  const [branch, setBranch] = useState("dubai");
  const selected = branchPreferences.find((b) => b.slug === branch);
  return (
    <section
      id="locations"
      className="booking-section section-pad"
      aria-labelledby="locations-heading"
    >
      <div className="container">
        <div className="section-top">
          <p className="eyebrow reveal">{t("06 — A place to begin")}</p>
          <span className="branch-count">
            {branchPreferences.length
              ? `${branchPreferences.length} ${t("branch preferences")}`
              : t("Branch preferences")}
          </span>
        </div>
        <div className="booking-layout">
          <div className="booking-story reveal">
            <h2 id="locations-heading">
              {t("Their next chapter.")}
              <br />
              <span className="muted-heading">{t("Closer to home.")}</span>
            </h2>
            <p className="body-copy">
              {t("Find a sport they love, in a place that works for you.")}
            </p>
            <div className="booking-cities">
              <span>{t("Dubai")}</span>
              <span>{t("Sharjah")}</span>
              <span>{t("Ajman")}</span>
            </div>
            <p className="booking-footnote">
              {t(
                "Branch labels are provisional. Exact venues and sports availability will be confirmed before booking.",
              )}
            </p>
          </div>
          <div className="booking-panel reveal">
            <div className="booking-panel-top">
              <span className="eyebrow">{t("Make the first move")}</span>
              <ArrowUpRight aria-hidden="true" size={26} />
            </div>
            {error && <p role="status">{t(error)}</p>}
            <div className="booking-selectors">
              <div className="field">
                <label htmlFor="home-sport">{t("Sport")}</label>
                <select
                  id="home-sport"
                  disabled={!ready}
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                >
                  {sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {t(s.name)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="home-branch">{t("Preferred branch")}</label>
                <select
                  id="home-branch"
                  disabled={!ready || !branchPreferences.length}
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  {branchPreferences.map((b) => (
                    <option key={b.id} value={b.slug}>
                      {dir === "rtl" && b.name_ar ? b.name_ar : t(b.name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="booking-place">
              <MapPin size={18} aria-hidden="true" />
              <strong>
                {dir === "rtl" && selected?.name_ar
                  ? selected.name_ar
                  : t(selected?.name || "Choose a branch")}
              </strong>
              <span>{t(selected?.area || "")}</span>
            </div>
            <div className="schedule-preview">
              <CalendarDays size={28} strokeWidth={1.3} aria-hidden="true" />
              <div>
                <h3>{t("Upcoming classes")}</h3>
                <p>{t("The new timetable is being prepared.")}</p>
                <span className="schedule-status">
                  {t("Dates & times to be confirmed")}
                </span>
              </div>
            </div>
            <Link
              href={`/trial?sport=${sport}&branch=${branch}`}
              className="button button-dark"
            >
              {t("Start a free trial")}
              <ArrowUpRight size={20} aria-hidden="true" />
            </Link>
            <p className="booking-panel-note">
              {t("Three simple steps. No payment details.")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

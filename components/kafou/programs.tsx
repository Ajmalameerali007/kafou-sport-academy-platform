"use client";
import { useLocale } from "./locale";
import { useHydrated } from "@/lib/kafou/use-hydrated";
import { useRef, useState, useLayoutEffect } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { CampaignImage } from "./campaign-image";
import { programs } from "@/lib/kafou/content";
gsap.registerPlugin(Flip);
export function Programs() {
  const { t } = useLocale();
  const ready = useHydrated();
  const [active, setActive] = useState(0);
  const root = useRef<HTMLElement>(null);
  const previous = useRef<ReturnType<typeof Flip.getState> | null>(null);
  useLayoutEffect(() => {
    if (!previous.current || !root.current) return;
    const ctx = gsap.context(() => {
      Flip.from(previous.current!, {
        duration: 0.65,
        ease: "power3.inOut",
        scale: true,
      });
      gsap.from(".program-preview img", {
        opacity: 0.6,
        scale: 1.04,
        duration: 0.7,
        ease: "power2.out",
      });
    }, root);
    previous.current = null;
    return () => ctx.revert();
  }, [active]);
  function select(index: number) {
    if (index === active) return;
    if (
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      root.current
    )
      previous.current = Flip.getState(
        root.current.querySelector(".program-photo")!,
      );
    setActive(index);
  }

  return (
    <section
      className="programs container section-pad"
      id="programs"
      ref={root}
      aria-labelledby="programs-heading"
    >
      <div className="section-top">
        <p className="eyebrow reveal">{t("02 — Beyond the everyday")}</p>
        <span className="section-note">{t("More ways to move")}</span>
      </div>
      <div className="programs-layout">
        <div>
          <h2 id="programs-heading" className="reveal">
            {t("Good energy.")}
            <br />
            {t("Great experiences.")}
          </h2>
          <p className="body-copy reveal">
            {t("From after-school discoveries to holiday adventures.")}
            <br />
            {t("Make room for a little more movement.")}
          </p>
          <div className="program-list" aria-label={t("Explore programs")}>
            {programs.map((p, i) => (
              <button
                key={t(p.name)}
                type="button"
                disabled={!ready}
                onClick={() => select(i)}
                onMouseEnter={() => {
                  if (window.matchMedia("(hover: hover)").matches) select(i);
                }}
                aria-expanded={active === i}
                aria-controls="program-preview"
                className={active === i ? "active" : ""}
              >
                <span className="program-list-number">0{i + 1}</span>
                <span>{t(p.name)}</span>
                <span aria-hidden="true">{active === i ? "↗" : "+"}</span>
              </button>
            ))}
          </div>
        </div>
        <div
          id="program-preview"
          className={`program-preview program-position-${active % 2}`}
        >
          <div className="program-photo cutout-composition">
            <span className="composition-word" aria-hidden="true">
              {t("MOVE.")}
            </span>
            <svg
              className="composition-orbit"
              viewBox="0 0 600 600"
              aria-hidden="true"
            >
              <ellipse cx="300" cy="350" rx="250" ry="190" />
            </svg>
            <CampaignImage
              asset="agility"
              cutout
              sizes="(min-width:1100px) 95vw, (min-width:761px) 1200px, 100vw"
            />
          </div>
          <div className="program-caption" aria-live="polite">
            <span className="eyebrow">{t(programs[active].label)}</span>
            <p>{t(programs[active].text)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";
import { useLocale } from "./locale";
import { useRef, useState, useLayoutEffect } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { CampaignImage } from "./campaign-image";
import { concepts } from "@/lib/kafou/content";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function ProgressMotivation() {
  const { t, dir } = useLocale();
  const [value, setValue] = useState("0");
  const root = useRef<HTMLElement>(null);
  const state = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const concept = concepts[Number(value)];
  useLayoutEffect(() => {
    if (!state.current || !root.current) return;
    const ctx = gsap.context(() => {
      Flip.from(state.current!, {
        duration: 0.65,
        ease: "power3.inOut",
        scale: true,
      });
      gsap.from(".motivation-image img", {
        opacity: 0,
        y: 24,
        scale: 0.96,
        duration: 0.6,
      });
    }, root);
    state.current = null;
    return () => ctx.revert();
  }, [value]);
  function change(next: string) {
    if (
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      root.current
    )
      state.current = Flip.getState(
        root.current.querySelector(".recognition-seal")!,
      );
    setValue(next);
  }
  return (
    <section
      id="progress"
      ref={root}
      className="motivation-section section-pad"
      aria-labelledby="motivation-heading"
    >
      <div className="container">
        <div className="section-top">
          <p className="eyebrow reveal">{t("05 — Celebrate the becoming")}</p>
          <span className="concept-label">{t("PROGRAM CONCEPTS")}</span>
        </div>
        <div className="intro-grid">
          <h2 id="motivation-heading" className="reveal">
            {t("Every session")}
            <br />
            {t("builds")}{" "}
            <span className="muted-heading">{t("something.")}</span>
          </h2>
          <p className="body-copy reveal">
            {t("Not just better athletes. More confident people.")}
            <br />
            {t(
              "A vision for recognising effort, celebrating growth and making progress visible.",
            )}
          </p>
        </div>
        <Tabs
          dir={dir}
          value={value}
          onValueChange={change}
          className="motivation-tabs"
        >
          <TabsList variant="line" aria-label={t("Progress concepts")}>
            {concepts.map((c, i) => (
              <TabsTrigger value={String(i)} key={t(c.sport)}>
                {t(c.sport)}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={value}>
            <div className="motivation-layout">
              <div className="motivation-image cutout-composition">
                <span className="composition-word" aria-hidden="true">
                  {t("GROW.")}
                </span>
                <svg
                  className="composition-orbit"
                  viewBox="0 0 600 600"
                  aria-hidden="true"
                >
                  <circle cx="300" cy="300" r="225" />
                </svg>
                <CampaignImage
                  asset={concept.mediaId}
                  cutout
                  sizes="(min-width:1100px) 55vw, 90vw"
                />
                <span className="motivation-photo-label">
                  {t("The effort is the achievement.")}
                </span>
              </div>
              <div className="recognition">
                <div
                  className={`recognition-seal seal-${value}`}
                  data-flip-id="recognition"
                >
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <circle cx="50" cy="50" r="47" />
                    <circle cx="50" cy="50" r="38" strokeDasharray="1 6" />
                    <path d="m50 24 6 18 19 1-15 12 5 19-15-11-15 11 5-19-15-12 19-1z" />
                  </svg>
                </div>
                <p className="eyebrow">
                  {t(concept.sport)} {t("/ RECOGNITION")}
                </p>
                <h3 className="display">{t(concept.title)}</h3>
                <p>{t(concept.copy)}</p>
                <div className="concept-footnote">
                  {t("A preview of how progress could be celebrated.")}
                  <br />
                  {t("Illustrative concept, not an awarded achievement.")}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

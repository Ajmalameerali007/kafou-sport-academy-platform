"use client";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
gsap.registerPlugin(ScrollTrigger, Flip);
// GSAP emits lifecycle events around matchMedia reversion; its bundled typings omit them.
const mediaEvents = gsap as typeof gsap & {
  addEventListener(
    type: "matchMediaInit" | "matchMedia",
    callback: () => void,
  ): void;
  removeEventListener(
    type: "matchMediaInit" | "matchMedia",
    callback: () => void,
  ): void;
};

/** One scoped motion owner; see docs/MOTION.md for source responsibilities. */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    let disposed = false;
    let currentLenis: Lenis | undefined;
    let restoreFrame = 0;
    let fragmentFrame = 0;
    let settleFrame = 0;
    const initialHash = window.location.hash;
    let anchor: { element: HTMLElement; offset: number } | undefined;
    let readingPosition: typeof anchor;
    // ScrollTrigger's matchMediaInit listener runs before ours and can already
    // revert pins/reset scroll. Keep the reading anchor from the last real scroll.
    const samplePosition = () => {
      if (disposed || anchor) return;
      if (window.scrollY < 50) {
        readingPosition = undefined;
        return;
      }
      const candidates = Array.from(
        el.querySelectorAll<HTMLElement>("section[id], .sports-stage"),
      );
      const element = candidates
        .filter((item) => item.getBoundingClientRect().bottom > 0)
        .sort(
          (a, b) =>
            Math.abs(a.getBoundingClientRect().top) -
            Math.abs(b.getBoundingClientRect().top),
        )[0];
      if (element)
        readingPosition = {
          element,
          offset: element.getBoundingClientRect().top,
        };
    };
    const rememberPosition = () => {
      if (disposed || anchor) return;
      anchor = readingPosition;
    };
    window.addEventListener("scroll", samplePosition, { passive: true });
    samplePosition();
    const restorePosition = () => {
      if (disposed) return;
      cancelAnimationFrame(restoreFrame);
      cancelAnimationFrame(settleFrame);
      restoreFrame = requestAnimationFrame(() => {
        settleFrame = requestAnimationFrame(() => {
          if (disposed) return;
          if (anchor) {
            // MatchMedia already refreshed the pins. Wait for layout to settle,
            // then synchronize Lenis limits before restoring the reading anchor.
            currentLenis?.resize();
            const position =
              window.scrollY +
              anchor.element.getBoundingClientRect().top -
              anchor.offset;
            window.scrollTo({
              top: Math.max(0, position),
              behavior: "instant",
            });
            currentLenis?.scrollTo(Math.max(0, position), { immediate: true });
            readingPosition = {
              element: anchor.element,
              offset: anchor.element.getBoundingClientRect().top,
            };
          }
          anchor = undefined;
          ScrollTrigger.update();
        });
      });
    };
    mediaEvents.addEventListener("matchMediaInit", rememberPosition);
    mediaEvents.addEventListener("matchMedia", restorePosition);
    mm.add(
      {
        all: "all",
        desktop:
          "(min-width: 1100px) and (min-height: 700px) and (hover: hover) and (pointer: fine)",
        tablet: "(min-width: 761px) and (max-width: 1099px)",
        reduce: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        const { desktop, tablet, reduce } = context.conditions!;
        let lenis: Lenis | undefined;
        let tick: ((time: number) => void) | undefined;
        const track = el.querySelector<HTMLElement>(".journey-track")!;
        const svg = el.querySelector<SVGSVGElement>(".journey-svg")!;
        const path = el.querySelector<SVGPathElement>(".journey-path")!;
        const base = el.querySelector<SVGPathElement>(".journey-base")!;
        const steps = gsap.utils.toArray<HTMLElement>(".journey-step", el);
        const points = steps.map((s) =>
          s.querySelector<HTMLElement>(".waypoint")!,
        );
        let markerTimeline: gsap.core.Timeline | undefined;
        let markerTweens: gsap.core.Tween[] = [];
        const updateJourneyGeometry = () => {
          const bounds = track.getBoundingClientRect();
          const coords = points.map((p) => {
            const r = p.getBoundingClientRect();
            return {
              x: r.left - bounds.left + r.width / 2,
              y: r.top - bounds.top + r.height / 2,
            };
          });
          const d = coords
            .map((p, i) => {
              if (!i) return `M${p.x} ${p.y}`;
              const prev = coords[i - 1];
              const mid = (prev.x + p.x) / 2;
              return prev.y === p.y || prev.x === p.x
                ? `L${p.x} ${p.y}`
                : `C${mid} ${prev.y} ${mid} ${p.y} ${p.x} ${p.y}`;
            })
            .join(" ");
          svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
          path.setAttribute("d", d);
          base.setAttribute("d", d);
          if (markerTimeline) {
            markerTweens.forEach((t) => t.kill());
            markerTweens = [];
            markerTimeline.clear();
            const marker = el.querySelector<HTMLElement>(".journey-marker")!;
            gsap.set(marker, { clearProps: "transform,width,height" });
            points.forEach((point, i) => {
              const tween = Flip.fit(marker, Flip.getState(point), {
                duration: 1,
                ease: "none",
                scale: true,
              }) as gsap.core.Tween;
              markerTweens.push(tween);
              markerTimeline!.add(tween, i);
            });
          }
        };
        updateJourneyGeometry();
        if (!reduce && desktop) {
          lenis = new Lenis({
            lerp: 0.14,
            smoothWheel: true,
            autoRaf: false,
            anchors: { offset: -90 },
          });
          currentLenis = lenis;
          lenis.on("scroll", ScrollTrigger.update);
          tick = (time) => lenis!.raf(time * 1000);
          gsap.ticker.add(tick);
        }
        const ctx = gsap.context(() => {
          if (reduce) return;
          // Each chapter owns a timeline inside this route-scoped context.
          const heroEntrance = gsap.timeline({
            defaults: { ease: "power3.out" },
          });
          heroEntrance
            .from(
              ".hero-visual",
              { clipPath: "inset(0% 0% 12% 0%)", duration: 1.35 },
              0,
            )
            .from(
              ".headline-mask > span",
              {
                yPercent: 108,
                rotationX: 12,
                transformPerspective: 1000,
                duration: 1.05,
                stagger: 0.11,
              },
              0.15,
            )
            .from(
              ".hero-enter",
              { y: 18, opacity: 0, duration: 0.7, stagger: 0.1 },
              0.45,
            )
            .from(
              ".hero-athletes",
              { scale: 1.075, opacity: 0, duration: 1.35 },
              0.15,
            );
          if (desktop || tablet) {
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: ".hero",
                  start: "top top",
                  end: "bottom top",
                  scrub: 0.6,
                },
              })
              .to(
                ".hero-athletes",
                {
                  yPercent: 8,
                  scale: 1.045,
                  rotationY: desktop ? -2 : 0,
                  ease: "none",
                },
                0,
              )
              .to(".hero-content", { y: 45, opacity: 0.6, ease: "none" }, 0);
          }
          gsap.utils.toArray<HTMLElement>(".reveal", el).forEach((item) =>
            gsap.from(item, {
              y: 24,
              opacity: 0,
              duration: 0.75,
              ease: "power2.out",
              scrollTrigger: { trigger: item, start: "top 92%", once: true },
            }),
          );
          const stage = el.querySelector<HTMLElement>(".sports-stage")!;
          const scenes = gsap.utils.toArray<HTMLElement>(".sport-scene", stage);
          if (desktop) {
            stage.classList.add("sports-enhanced");
            gsap.set(scenes.slice(1), { clipPath: "inset(100% 0% 0% 0%)" });
            let active = -1;
            const updateActive = (index: number) => {
              if (active === index) return;
              active = index;
              scenes.forEach((scene, i) => {
                scene.inert = i !== index;
                scene.setAttribute("aria-hidden", String(i !== index));
              });
            };
            updateActive(0);
            const timeline = gsap.timeline({
              scrollTrigger: {
                id: "kafou-sports",
                onRefresh: (self) =>
                  updateActive(
                    Math.min(
                      3,
                      Math.max(
                        0,
                        Math.floor((self.animation?.time() || 0) - 0.4),
                      ),
                    ),
                  ),
                trigger: stage,
                start: "top 88px",
                end: () => "+=" + window.innerHeight * 3,
                pin: true,
                scrub: 0.65,
                invalidateOnRefresh: true,
              },
            });
            timeline.eventCallback("onUpdate", () =>
              updateActive(
                Math.min(3, Math.max(0, Math.floor(timeline.time() - 0.4))),
              ),
            );
            scenes.forEach((scene, i) => {
              const photo = scene.querySelector(".sport-image");
              const atmosphere = scene.querySelector(".sport-atmosphere");
              if (atmosphere) {
                timeline.fromTo(
                  atmosphere.querySelector(".sport-backword"),
                  { x: 28 },
                  { x: -18, duration: 1.35, ease: "none" },
                  i,
                );
                timeline.fromTo(
                  atmosphere.querySelector(".sport-linework"),
                  { scale: 0.92, y: 25 },
                  { scale: 1.08, y: -12, duration: 1.4, ease: "none" },
                  i,
                );
                timeline.fromTo(
                  photo,
                  { y: 20 },
                  { y: -12, duration: 1.4, ease: "none" },
                  i,
                );
              }
              if (i > 0)
                timeline
                  .to(
                    scene,
                    {
                      clipPath: "inset(0% 0% 0% 0%)",
                      duration: 0.8,
                      ease: "power2.inOut",
                    },
                    i,
                  )
                  .fromTo(
                    photo,
                    { yPercent: -9, scale: 1.13 },
                    {
                      yPercent: 0,
                      scale: 1.035,
                      duration: 0.8,
                      ease: "power2.inOut",
                    },
                    i,
                  )
                  .from(
                    scene.querySelectorAll(".sport-copy > :not(.sport-track)"),
                    {
                      y: 32,
                      opacity: 0,
                      duration: 0.55,
                      stagger: 0.045,
                      ease: "power3.out",
                    },
                    i + 0.1,
                  );
              timeline.to(
                photo,
                {
                  scale: 1.055,
                  rotationY: i % 2 ? 1 : -1,
                  duration: 0.6,
                  ease: "none",
                },
                i + 0.8,
              );
            });
            timeline.to({}, { duration: 0.25 });
          } else
            scenes.forEach((scene) =>
              gsap.from(scene.querySelector(".sport-image"), {
                scale: 1.06,
                duration: 1.1,
                ease: "power2.out",
                scrollTrigger: { trigger: scene, start: "top 85%", once: true },
              }),
            );
          const photo = el.querySelector<HTMLElement>(".program-photo")!;
          if (desktop)
            gsap.from(photo, {
              clipPath: "inset(8% 5% 8% 5%)",
              scale: 0.95,
              duration: 1.1,
              ease: "power3.out",
              scrollTrigger: {
                trigger: ".programs",
                start: "top 65%",
                once: true,
              },
            });
          if (desktop) {
            el.querySelectorAll<HTMLElement>(".cutout-composition").forEach(
              (composition) => {
                gsap
                  .timeline({
                    scrollTrigger: {
                      trigger: composition,
                      start: "top bottom",
                      end: "bottom top",
                      scrub: 0.6,
                    },
                  })
                  .fromTo(
                    composition.querySelector(".composition-word"),
                    { y: 18 },
                    { y: -24, ease: "none" },
                    0,
                  )
                  .fromTo(
                    composition.querySelector(".composition-orbit"),
                    { rotation: -8, scale: 0.94 },
                    { rotation: 8, scale: 1.05, ease: "none" },
                    0,
                  );
              },
            );
          }
          gsap.from(".motivation-image", {
            clipPath: "inset(0% 0% 16% 0%)",
            y: 24,
            duration: 1.05,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ".motivation-image",
              start: "top 85%",
              once: true,
            },
          });
          gsap.fromTo(
            path,
            {
              strokeDasharray: () => path.getTotalLength(),
              strokeDashoffset: () => path.getTotalLength(),
            },
            {
              strokeDashoffset: 0,
              ease: "none",
              scrollTrigger: {
                trigger: track,
                start: "top 75%",
                end: "bottom 35%",
                scrub: 0.35,
                invalidateOnRefresh: true,
              },
            },
          );
          steps.forEach((step) =>
            gsap.from(step, {
              opacity: 0.3,
              duration: 0.5,
              scrollTrigger: {
                trigger: step,
                start: "top 80%",
                toggleActions: "play none none reverse",
              },
            }),
          );
          if (desktop) {
            gsap.set(".journey-marker", { opacity: 1 });
            markerTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: track,
                start: "top 75%",
                end: "bottom 35%",
                scrub: 0.4,
              },
            });
            updateJourneyGeometry();
          }
        }, el);
        // Re-measure the one-marker Flip states and SVG on refresh, including orientation changes.
        const measure = () => ctx.add(updateJourneyGeometry);
        ScrollTrigger.addEventListener("refreshInit", measure);
        return () => {
          ScrollTrigger.removeEventListener("refreshInit", measure);
          if (tick) gsap.ticker.remove(tick);
          lenis?.off("scroll", ScrollTrigger.update);
          lenis?.destroy();
          currentLenis = undefined;
          markerTweens.forEach((t) => t.kill());
          ctx.revert();
          el.querySelector<HTMLElement>(".journey-marker")?.removeAttribute(
            "style",
          );
          el.querySelector(".sports-stage")?.classList.remove(
            "sports-enhanced",
          );
          el.querySelectorAll<HTMLElement>(".sport-scene").forEach((s) => {
            s.inert = false;
            s.removeAttribute("aria-hidden");
          });
        };
      },
      el,
    );
    const refresh = () => {
      if (!disposed) ScrollTrigger.refresh();
    };
    void document.fonts.ready.then(() => {
      refresh();
      // Native fragment scrolling can precede hydration and the sports pin spacer.
      // Resolve the original deep link once, after the final document measurements.
      if (!initialHash || disposed || window.location.hash !== initialHash)
        return;
      let id: string;
      try {
        id = decodeURIComponent(initialHash.slice(1));
      } catch {
        return;
      }
      const target = document.getElementById(id);
      if (!target || !el.contains(target)) return;
      fragmentFrame = requestAnimationFrame(() => {
        if (disposed || window.location.hash !== initialHash) return;
        const position =
          window.scrollY + target.getBoundingClientRect().top - 90;
        window.scrollTo({ top: position, behavior: "instant" });
        currentLenis?.scrollTo(position, { immediate: true });
        ScrollTrigger.update();
      });
    });
    const imgs = Array.from(el.querySelectorAll("img"));
    imgs.forEach((img) =>
      img.addEventListener("load", refresh, { once: true }),
    );
    return () => {
      disposed = true;
      cancelAnimationFrame(restoreFrame);
      cancelAnimationFrame(fragmentFrame);
      cancelAnimationFrame(settleFrame);
      window.removeEventListener("scroll", samplePosition);
      mediaEvents.removeEventListener("matchMediaInit", rememberPosition);
      mediaEvents.removeEventListener("matchMedia", restorePosition);
      imgs.forEach((img) => img.removeEventListener("load", refresh));
      mm.revert();
    };
  }, []);
  return <div ref={root}>{children}</div>;
}

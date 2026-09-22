"use client";
import { LocaleProvider, type Locale } from "./locale";
import { PublicHeader } from "@/components/kafou/header";
import { Hero } from "@/components/kafou/hero";
import { SportsExperience } from "@/components/kafou/sports";
import { Programs } from "@/components/kafou/programs";
import {
  WhyKafou,
  Locations,
  TrialCTA,
  PublicFooter,
} from "@/components/kafou/editorial";
import { Journey } from "@/components/kafou/journey";
import { ProgressMotivation } from "@/components/kafou/motivation";
import { MotionRoot } from "@/components/kafou/motion";
export function PublicHome({ locale }: { locale: Locale }) {
  return (
    <LocaleProvider locale={locale}>
      <PublicHeader />
      <MotionRoot>
        <main id="main-content">
          <Hero />
          <SportsExperience />
          <Programs />
          <WhyKafou />
          <Journey />
          <ProgressMotivation />
          <Locations />
          <TrialCTA />
        </main>
        <PublicFooter />
      </MotionRoot>
    </LocaleProvider>
  );
}

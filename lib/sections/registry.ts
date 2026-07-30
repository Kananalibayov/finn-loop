import type { SectionType } from "../site-model.ts";
import { aboutNarrative } from "./about/narrative.ts";
import { aboutSplit } from "./about/split.ts";
import { contactSplit } from "./contact/split.ts";
import { contactStacked } from "./contact/stacked.ts";
import { ctaBanner } from "./cta/banner.ts";
import { ctaCentered } from "./cta/centered.ts";
import { featuresAlternating } from "./features/alternating.ts";
import { featuresGrid } from "./features/grid.ts";
import { galleryColumns } from "./gallery/columns.ts";
import { galleryGrid } from "./gallery/grid.ts";
import { heroCentered } from "./hero/centered.ts";
import { heroSplit } from "./hero/split.ts";
import { logosGrid } from "./logos/grid.ts";
import { logosStrip } from "./logos/strip.ts";
import { pricingCards } from "./pricing/cards.ts";
import { pricingTable } from "./pricing/table.ts";
import { servicesGrid } from "./services/grid.ts";
import { servicesList } from "./services/list.ts";
import { statsGrid } from "./stats/grid.ts";
import { statsRow } from "./stats/row.ts";
import { stepsNumbered } from "./steps/numbered.ts";
import { stepsTimeline } from "./steps/timeline.ts";
import { teamGrid } from "./team/grid.ts";
import { teamRows } from "./team/rows.ts";
import { testimonialsCards } from "./testimonials/cards.ts";
import { testimonialsSingle } from "./testimonials/single.ts";
import { REGISTRY_VERSION, type SectionRenderer } from "./types.ts";

const REGISTRY: Partial<Record<SectionType, Record<string, SectionRenderer<unknown>>>> = {
  hero: {
    split: heroSplit as SectionRenderer<unknown>,
    centered: heroCentered as SectionRenderer<unknown>,
  },
  services: {
    grid: servicesGrid as SectionRenderer<unknown>,
    list: servicesList as SectionRenderer<unknown>,
  },
  features: {
    grid: featuresGrid as SectionRenderer<unknown>,
    alternating: featuresAlternating as SectionRenderer<unknown>,
  },
  contact: {
    stacked: contactStacked as SectionRenderer<unknown>,
    split: contactSplit as SectionRenderer<unknown>,
  },
  cta: {
    banner: ctaBanner as SectionRenderer<unknown>,
    centered: ctaCentered as SectionRenderer<unknown>,
  },
  gallery: {
    grid: galleryGrid as SectionRenderer<unknown>,
    columns: galleryColumns as SectionRenderer<unknown>,
  },
  about: {
    narrative: aboutNarrative as SectionRenderer<unknown>,
    split: aboutSplit as SectionRenderer<unknown>,
  },
  testimonials: {
    cards: testimonialsCards as SectionRenderer<unknown>,
    single: testimonialsSingle as SectionRenderer<unknown>,
  },
  team: {
    grid: teamGrid as SectionRenderer<unknown>,
    rows: teamRows as SectionRenderer<unknown>,
  },
  logos: {
    strip: logosStrip as SectionRenderer<unknown>,
    grid: logosGrid as SectionRenderer<unknown>,
  },
  pricing: {
    cards: pricingCards as SectionRenderer<unknown>,
    table: pricingTable as SectionRenderer<unknown>,
  },
  stats: {
    row: statsRow as SectionRenderer<unknown>,
    grid: statsGrid as SectionRenderer<unknown>,
  },
  steps: {
    numbered: stepsNumbered as SectionRenderer<unknown>,
    timeline: stepsTimeline as SectionRenderer<unknown>,
  },
};

export function sectionInstanceId(type: SectionType, variant: string, index: number): string {
  if (index < 0) throw new RangeError("section index must be non-negative");
  return `${type}-${variant}-v${REGISTRY_VERSION}-${index}`;
}

export function getRenderer(
  type: SectionType,
  variant: string,
): SectionRenderer<never> | null {
  return (REGISTRY[type]?.[variant] as SectionRenderer<never> | undefined) ?? null;
}

export function listVariants(type: SectionType): string[] {
  return Object.keys(REGISTRY[type] ?? {});
}

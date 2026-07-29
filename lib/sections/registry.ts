import type { SectionType } from "../site-model.ts";
import { testimonialsCards } from "./testimonials/cards.ts";
import { testimonialsSingle } from "./testimonials/single.ts";
import { heroCentered } from "./hero/centered.ts";
import { heroSplit } from "./hero/split.ts";
import { REGISTRY_VERSION, type SectionRenderer } from "./types.ts";

const REGISTRY: Partial<Record<SectionType, Record<string, SectionRenderer<unknown>>>> = {
  hero: {
    split: heroSplit as SectionRenderer<unknown>,
    centered: heroCentered as SectionRenderer<unknown>,
  },
  testimonials: {
    cards: testimonialsCards as SectionRenderer<unknown>,
    single: testimonialsSingle as SectionRenderer<unknown>,
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

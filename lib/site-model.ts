// Phase 1 — the SiteModel: the single source of truth for a site.
//
// NORTH-STAR.md §5: one structured model, many renderers. LLMs never emit
// markup — only {section_id, variant, slot_values} plus a token document.
// Every field below holds a token value, a primitive, or a flat list; no
// field may carry HTML, CSS, or markup of any kind (Invariant 1/6).
//
// This file is purely additive (issue #139). It does NOT migrate the legacy
// GeneratedPage/Theme shapes in lib/types.ts or lib/themes.ts — those coexist
// until a later roadmap item.

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

/** The seven colour roles a renderer needs; each is a token value like "#0a5". */
export interface ColorTokens {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}

export interface FontTokens {
  heading: string;
  body: string;
}

/**
 * DesignTokens — the deterministic visual contract (NORTH-STAR §7):
 * layout, spacing, type scale and colour live here, never in a prompt.
 * Sizes/radii are token values (e.g. "1.25rem", "8px"), never CSS declarations.
 */
export interface DesignTokens {
  color: ColorTokens;
  font: FontTokens;
  typeScale: string;
  spacingUnit: string;
  radius: string;
  shadow: string;
  containerMax: string;
}

/** Where an image comes from. wpMediaId is set once it is uploaded to the WP target. */
export interface MediaRef {
  kind: "upload" | "stock" | "generated";
  url: string;
  alt: string;
  width: number;
  height: number;
  wpMediaId?: number;
}

/** Tone-of-voice guidance passed to the writer; free-form strings, never markup. */
export interface Voice {
  tone: string;
  doNotSay?: string[];
}

export interface Brand {
  tokens: DesignTokens;
  logo?: MediaRef;
  voice: Voice;
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
}

export interface HoursEntry {
  days: string;
  time: string;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  x?: string;
  youtube?: string;
}

export interface Location {
  name?: string;
  address: string;
  phone?: string;
}

export interface SiteMeta {
  businessName: string;
  contact: ContactInfo;
  hours: HoursEntry[];
  social: SocialLinks;
  locations: Location[];
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export interface NavItem {
  label: string;
  href: string;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** The canonical set of section types the registry can render (NORTH-STAR §5). */
export const SECTION_TYPES = [
  "hero",
  "services",
  "features",
  "about",
  "testimonials",
  "gallery",
  "faq",
  "cta",
  "contact",
  "team",
  "pricing",
  "stats",
  "logos",
  "steps",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

/**
 * Per-type content shapes. Only the slots a hand-designed layout needs; every
 * field is a primitive, a string array, or an array of flat objects — never
 * markup (Invariant 6). A CTA is a {label, href} pair, not an <a> string.
 */
export interface CtaLink {
  label: string;
  href: string;
}

export interface HeroContent {
  heading: string;
  subheading?: string;
  cta?: CtaLink;
}

export interface ServiceItem {
  title: string;
  description?: string;
  price?: string;
}

export interface ServicesContent {
  heading?: string;
  items: ServiceItem[];
}

export interface FeatureItem {
  title: string;
  description?: string;
}

export interface FeaturesContent {
  heading?: string;
  items: FeatureItem[];
}

export interface AboutContent {
  heading: string;
  body: string[];
  cta?: CtaLink;
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
}

export interface TestimonialsContent {
  heading?: string;
  items: TestimonialItem[];
}

export interface GalleryContent {
  heading?: string;
  images: MediaRef[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqContent {
  heading?: string;
  items: FaqItem[];
}

export interface CtaContent {
  heading: string;
  subheading?: string;
  cta: CtaLink;
}

export interface ContactContent {
  heading?: string;
  body?: string[];
  showForm: boolean;
}

export interface TeamMember {
  name: string;
  role?: string;
  bio?: string;
  photo?: MediaRef;
}

export interface TeamContent {
  heading?: string;
  members: TeamMember[];
}

export interface PricingPlan {
  name: string;
  price: string;
  period?: string;
  features: string[];
  cta?: CtaLink;
}

export interface PricingContent {
  heading?: string;
  plans: PricingPlan[];
}

export interface StatItem {
  value: string;
  label: string;
}

export interface StatsContent {
  heading?: string;
  items: StatItem[];
}

export interface LogosContent {
  heading?: string;
  images: MediaRef[];
}

export interface StepItem {
  title: string;
  description?: string;
}

export interface StepsContent {
  heading?: string;
  items: StepItem[];
}

/**
 * Discriminated on `type`: narrowing `section.type` narrows `section.content`.
 */
export type SectionContent =
  | { type: "hero"; content: HeroContent }
  | { type: "services"; content: ServicesContent }
  | { type: "features"; content: FeaturesContent }
  | { type: "about"; content: AboutContent }
  | { type: "testimonials"; content: TestimonialsContent }
  | { type: "gallery"; content: GalleryContent }
  | { type: "faq"; content: FaqContent }
  | { type: "cta"; content: CtaContent }
  | { type: "contact"; content: ContactContent }
  | { type: "team"; content: TeamContent }
  | { type: "pricing"; content: PricingContent }
  | { type: "stats"; content: StatsContent }
  | { type: "logos"; content: LogosContent }
  | { type: "steps"; content: StepsContent };

export type Section = SectionContent & {
  variant: string;
  media?: MediaRef[];
};

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/** A JSON-LD node, kept as an opaque record — schema is validated downstream. */
export type SchemaNode = Record<string, unknown>;

export interface SeoMeta {
  title: string;
  description: string;
  schema: SchemaNode[];
}

export interface Page {
  slug: string;
  title: string;
  seo: SeoMeta;
  sections: Section[];
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

export interface SiteModel {
  version: 1;
  brand: Brand;
  meta: SiteMeta;
  nav: NavItem[];
  pages: Page[];
}

// ---------------------------------------------------------------------------
// Type guard — fails closed, never throws
// ---------------------------------------------------------------------------

const COLOR_KEYS: readonly (keyof ColorTokens)[] = [
  "primary",
  "accent",
  "bg",
  "surface",
  "text",
  "muted",
  "border",
];

const FONT_KEYS: readonly (keyof FontTokens)[] = ["heading", "body"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}

/**
 * Returns true only for a structurally valid SiteModel. Returns false — never
 * throws — on any malformed input including null, arrays, and primitives.
 */
export function isSiteModel(value: unknown): value is SiteModel {
  if (!isObject(value)) return false;
  if (value.version !== 1) return false;

  const brand = value.brand;
  if (!isObject(brand)) return false;

  const tokens = brand.tokens;
  if (!isObject(tokens)) return false;

  const color = (tokens as Record<string, unknown>).color;
  if (!isStringRecord(color)) return false;
  for (const k of COLOR_KEYS) {
    if (typeof color[k] !== "string") return false;
  }

  const font = (tokens as Record<string, unknown>).font;
  if (!isStringRecord(font)) return false;
  for (const k of FONT_KEYS) {
    if (typeof font[k] !== "string") return false;
  }

  if (!isObject(brand.voice)) return false;

  const meta = value.meta;
  if (!isObject(meta) || typeof meta.businessName !== "string") return false;

  if (!Array.isArray(value.nav)) return false;
  for (const n of value.nav) {
    if (!isObject(n) || typeof n.label !== "string" || typeof n.href !== "string") {
      return false;
    }
  }

  if (!Array.isArray(value.pages)) return false;
  for (const p of value.pages) {
    if (!isObject(p)) return false;
    if (typeof p.slug !== "string" || typeof p.title !== "string") return false;
    if (!isObject(p.seo)) return false;
    if (!Array.isArray(p.sections)) return false;
    for (const s of p.sections) {
      if (!isObject(s)) return false;
      if (typeof s.variant !== "string") return false;
      if (
        typeof s.type !== "string" ||
        !(SECTION_TYPES as readonly string[]).includes(s.type)
      ) {
        return false;
      }
    }
  }

  return true;
}

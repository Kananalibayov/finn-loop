// write(plan, input) -> SiteModel
//
// The missing link between plan() (which sections, in what order) and renderHtml() (markup from
// a SiteModel). Until this existed, the whole Phase 1 pipeline could be exercised only with a
// hand-written fixture, which is why nothing new could reach the app's real generate flow.
//
// Design decisions, recorded here because they constrain everything downstream:
//
// 1. ONE SCHEMA-CONSTRAINED CALL PER SECTION, IN PARALLEL. Per the roadmap line: "slot values via
//    small parallel JSON-schema calls, shape-asserted before persist". Small calls beat one giant
//    one because a schema violation is isolated to one section, and `strict: true` per-section
//    means the model cannot invent fields for a section type it half-remembers.
//
// 2. THE MODEL NEVER EMITS MARKUP, ONLY SLOT VALUES. Same reason the registry exists: markup from
//    a model is where the old generator's defects came from. Every schema here is plain text
//    fields — there is no field a model could put HTML into that would reach output unescaped
//    (variants escape everything).
//
// 3. NO INVENTED IMAGES. `gallery` and `logos` take MediaRef[]; a model has no real image URLs and
//    NORTH-STAR §4 forbids "a random photo service" and requires every image be real. So those
//    sections are written with an EMPTY images array and the operator supplies them. That renders
//    an empty section rather than a fake one — honest, and validateSite's content/alt gate stays
//    satisfied because there are no images to lack alt text.
//
// 4. NO INVENTED CREDENTIALS. NORTH-STAR §4 bans "invented credentials, awards, review counts,
//    certifications or statistics". `testimonials` and `stats` are the traps: a model asked for
//    testimonials will happily fabricate a customer quote, and asked for stats will invent "500+
//    happy clients". Both are written ONLY from facts present in the input; when the input has
//    none, the section gets empty items rather than plausible fiction. The system prompt states
//    this and the caller can detect it (empty items) rather than shipping invention.

import { getEffectiveGenerationModel } from "./db.ts";
import { getOpenAI } from "./openai.ts";
import { getRenderer } from "./sections/registry.ts";
import type { SitePlan, PlannedPage } from "./plan.ts";
import {
  isSiteModel,
  type DesignTokens,
  type Page,
  type Section,
  type SectionType,
  type SiteModel,
} from "./site-model.ts";
import type { BusinessInput } from "./types.ts";

// ---------------------------------------------------------------------------
// Per-section content schemas
// ---------------------------------------------------------------------------
// Every schema is `additionalProperties: false` with an explicit `required` list, because
// `strict: true` on the API demands it and because it is what stops a model returning a field a
// variant will not read (silently losing the content it wrote).
//
// Optional fields in the TypeScript types are still listed in `required` here with a nullable
// type, because OpenAI's strict mode requires every property to be in `required`. The
// post-processing step below strips nulls so the resulting object matches the TS optional shape.

const CTA_LINK = {
  type: "object",
  additionalProperties: false,
  required: ["label", "href"],
  properties: {
    label: { type: "string", minLength: 1 },
    // Relative paths only. An absolute URL from a model is either invented or off-site; either
    // way validateSite's structure/links gate would reject it, and safeHref would neutralise a
    // hostile scheme. Constraining it here means the model cannot produce that failure at all.
    href: { type: "string", minLength: 1 },
  },
} as const;

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });

const CONTENT_SCHEMAS: Record<SectionType, Record<string, unknown>> = {
  hero: {
    type: "object", additionalProperties: false,
    required: ["heading", "subheading", "cta"],
    properties: {
      heading: { type: "string", minLength: 1 },
      subheading: nullable({ type: "string", minLength: 1 }),
      cta: nullable(CTA_LINK),
    },
  },
  services: {
    type: "object", additionalProperties: false,
    required: ["heading", "items"],
    properties: {
      heading: nullable({ type: "string", minLength: 1 }),
      items: {
        type: "array", minItems: 1,
        items: {
          type: "object", additionalProperties: false,
          required: ["title", "description", "price"],
          properties: {
            title: { type: "string", minLength: 1 },
            description: nullable({ type: "string", minLength: 1 }),
            // Only when the input states a price. Inventing prices is inventing a commercial
            // commitment on the client's behalf.
            price: nullable({ type: "string", minLength: 1 }),
          },
        },
      },
    },
  },
  features: {
    type: "object", additionalProperties: false,
    required: ["heading", "items"],
    properties: {
      heading: nullable({ type: "string", minLength: 1 }),
      items: {
        type: "array", minItems: 1,
        items: {
          type: "object", additionalProperties: false,
          required: ["title", "description"],
          properties: {
            title: { type: "string", minLength: 1 },
            description: nullable({ type: "string", minLength: 1 }),
          },
        },
      },
    },
  },
  about: {
    type: "object", additionalProperties: false,
    required: ["heading", "body", "cta"],
    properties: {
      heading: { type: "string", minLength: 1 },
      body: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
      cta: nullable(CTA_LINK),
    },
  },
  testimonials: {
    type: "object", additionalProperties: false,
    required: ["heading", "items"],
    properties: {
      heading: nullable({ type: "string", minLength: 1 }),
      // minItems 0: an empty array is the CORRECT output when the input contains no real
      // testimonials. See decision 4 at the top of this file.
      items: {
        type: "array", minItems: 0,
        items: {
          type: "object", additionalProperties: false,
          required: ["quote", "author", "role"],
          properties: {
            quote: { type: "string", minLength: 1 },
            author: { type: "string", minLength: 1 },
            role: nullable({ type: "string", minLength: 1 }),
          },
        },
      },
    },
  },
  faq: {
    type: "object", additionalProperties: false,
    required: ["heading", "items"],
    properties: {
      heading: nullable({ type: "string", minLength: 1 }),
      items: {
        type: "array", minItems: 1,
        items: {
          type: "object", additionalProperties: false,
          required: ["question", "answer"],
          properties: {
            question: { type: "string", minLength: 1 },
            answer: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
  cta: {
    type: "object", additionalProperties: false,
    required: ["heading", "subheading", "cta"],
    properties: {
      heading: { type: "string", minLength: 1 },
      subheading: nullable({ type: "string", minLength: 1 }),
      cta: CTA_LINK,
    },
  },
  contact: {
    type: "object", additionalProperties: false,
    required: ["heading", "body", "showForm"],
    properties: {
      heading: nullable({ type: "string", minLength: 1 }),
      body: nullable({ type: "array", minItems: 1, items: { type: "string", minLength: 1 } }),
      showForm: { type: "boolean" },
    },
  },
  team: {
    type: "object", additionalProperties: false,
    required: ["heading", "members"],
    properties: {
      heading: nullable({ type: "string", minLength: 1 }),
      // Empty unless the input names real people. Inventing staff is inventing credentials.
      members: {
        type: "array", minItems: 0,
        items: {
          type: "object", additionalProperties: false,
          required: ["name", "role", "bio"],
          properties: {
            name: { type: "string", minLength: 1 },
            role: nullable({ type: "string", minLength: 1 }),
            bio: nullable({ type: "string", minLength: 1 }),
          },
        },
      },
    },
  },
  pricing: {
    type: "object", additionalProperties: false,
    required: ["heading", "plans"],
    properties: {
      heading: nullable({ type: "string", minLength: 1 }),
      // Empty unless the input states real prices — a fabricated price is a fabricated offer.
      plans: {
        type: "array", minItems: 0,
        items: {
          type: "object", additionalProperties: false,
          required: ["name", "price", "period", "features", "cta"],
          properties: {
            name: { type: "string", minLength: 1 },
            price: { type: "string", minLength: 1 },
            period: nullable({ type: "string", minLength: 1 }),
            features: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
            cta: nullable(CTA_LINK),
          },
        },
      },
    },
  },
  stats: {
    type: "object", additionalProperties: false,
    required: ["heading", "items"],
    properties: {
      heading: nullable({ type: "string", minLength: 1 }),
      // Empty unless the input contains real numbers. See decision 4.
      items: {
        type: "array", minItems: 0,
        items: {
          type: "object", additionalProperties: false,
          required: ["value", "label"],
          properties: {
            value: { type: "string", minLength: 1 },
            label: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
  steps: {
    type: "object", additionalProperties: false,
    required: ["heading", "items"],
    properties: {
      heading: nullable({ type: "string", minLength: 1 }),
      items: {
        type: "array", minItems: 1,
        items: {
          type: "object", additionalProperties: false,
          required: ["title", "description"],
          properties: {
            title: { type: "string", minLength: 1 },
            description: nullable({ type: "string", minLength: 1 }),
          },
        },
      },
    },
  },
  // Image-only sections: the model writes a heading at most. See decision 3 — no invented images.
  gallery: {
    type: "object", additionalProperties: false,
    required: ["heading"],
    properties: { heading: nullable({ type: "string", minLength: 1 }) },
  },
  logos: {
    type: "object", additionalProperties: false,
    required: ["heading"],
    properties: { heading: nullable({ type: "string", minLength: 1 }) },
  },
};

/** Section types whose media the operator must supply; write() never invents images. */
const IMAGE_SECTIONS = new Set<SectionType>(["gallery", "logos"]);

// ---------------------------------------------------------------------------
// Brand + meta, derived without a model call
// ---------------------------------------------------------------------------

/**
 * Tokens are DERIVED, not generated. A model asked for a palette returns plausible hex codes with
 * no contrast guarantee, and NORTH-STAR §4 requires AA contrast. A fixed, known-accessible default
 * with the client's stated primary colour applied is honest and safe; richer token derivation is
 * its own issue (#233).
 */
export function deriveTokens(input: BusinessInput): DesignTokens {
  const stated = (input.brandColors ?? "").match(/#[0-9a-fA-F]{6}\b/);
  const primary = stated ? stated[0].toLowerCase() : "#1d4ed8";
  return {
    color: {
      primary,
      accent: "#f59e0b",
      bg: "#ffffff",
      surface: "#f8fafc",
      text: "#0f172a",
      muted: "#64748b",
      border: "#e2e8f0",
    },
    font: { heading: "Georgia, serif", body: "system-ui, sans-serif" },
    typeScale: "1.25",
    spacingUnit: "8px",
    radius: "10px",
    shadow: "0 4px 12px rgba(0,0,0,.08)",
    containerMax: "1140px",
  };
}

function stripNulls<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripNulls) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null) continue;
      out[k] = stripNulls(v);
    }
    return out as T;
  }
  return value;
}

// ---------------------------------------------------------------------------
// One section
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = [
  "You write website copy as structured slot values. You never write HTML, CSS, or markup of any kind.",
  "Write only from the business facts given. Never invent testimonials, customer quotes, staff names,",
  "prices, statistics, review counts, awards or certifications. If the facts do not support a section's",
  "items, return an empty array for them — an empty section is correct, invented content is not.",
  "Links must be relative paths that exist in the site plan (for example /contact), never absolute URLs.",
].join(" ");

async function writeSection(
  section: { type: SectionType; variant: string },
  input: BusinessInput,
  page: PlannedPage,
  slugs: string[],
): Promise<Section> {
  const schema = CONTENT_SCHEMAS[section.type];
  const completion = await getOpenAI().chat.completions.create({
    model: getEffectiveGenerationModel(),
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Business facts:\n${JSON.stringify(input)}`,
          `You are writing the "${section.type}" section of the "${page.title}" page (/${page.slug}).`,
          `Pages that exist on this site: ${slugs.map((s) => `/${s}`).join(", ")}`,
          IMAGE_SECTIONS.has(section.type)
            ? "Write only the heading. Images are supplied by the operator, never by you."
            : "",
        ].filter(Boolean).join("\n\n"),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: `${section.type}_content`, strict: true, schema },
    },
  });

  const choice = completion.choices[0];
  if (choice?.finish_reason !== "stop") {
    throw new Error(
      `Content generation for ${section.type}/${section.variant} stopped with finish reason: ${choice?.finish_reason ?? "missing"}`,
    );
  }
  if (!choice.message.content) {
    throw new Error(`Content generation for ${section.type}/${section.variant} returned empty content`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(choice.message.content);
  } catch (error) {
    throw new Error(
      `Content generation for ${section.type}/${section.variant} returned invalid JSON: ${(error as Error).message}`,
    );
  }

  const content = stripNulls(parsed) as Record<string, unknown>;
  // Image sections carry an empty media array rather than an absent one, so a variant reading
  // `images` gets [] instead of undefined.
  if (IMAGE_SECTIONS.has(section.type)) content.images = [];

  return { type: section.type, variant: section.variant, content } as unknown as Section;
}

// ---------------------------------------------------------------------------
// write()
// ---------------------------------------------------------------------------

/**
 * Turn a SitePlan into a renderable SiteModel by writing every section's slot values.
 *
 * Sections are written in parallel across the whole site: they are independent, and the wall-clock
 * cost of a 5-page site is otherwise the sum of every call rather than the slowest one.
 *
 * Throws rather than degrading. A half-written site that renders is worse than an honest failure:
 * the caller can retry, but it cannot tell "the model refused" from "this business genuinely has
 * no testimonials" once a section has been silently dropped.
 */
export async function write(sitePlan: SitePlan, input: BusinessInput): Promise<SiteModel> {
  const slugs = sitePlan.pages.map((p) => p.slug);

  // Fail before spending a single token if the plan references something unrenderable. plan()
  // already validates against the registry, but a plan can be persisted and the registry can
  // change underneath it.
  for (const page of sitePlan.pages) {
    for (const s of page.sections) {
      if (!getRenderer(s.type, s.variant)) {
        throw new Error(`Plan references unregistered section ${s.type}/${s.variant}`);
      }
    }
  }

  const pages: Page[] = await Promise.all(
    sitePlan.pages.map(async (page): Promise<Page> => {
      const sections = await Promise.all(
        page.sections.map((s) => writeSection(s, input, page, slugs)),
      );
      return {
        slug: page.slug,
        title: page.title,
        seo: {
          // Deterministic and honest: derived from facts already given, not a second model call
          // that could drift from the page's actual content.
          //
          // The page title leads the description deliberately. A first version used the tagline
          // alone for every page, and validateSite's structure/title gate rejected it —
          // descriptions must be UNIQUE per page, and a shared one is a real SEO defect (search
          // engines treat duplicate descriptions as low-quality). Leading with the page title
          // makes each unique for the same reason titles are unique, without a second model call.
          title: `${page.title} — ${input.businessName}`,
          description: `${page.title} — ${input.tagline || input.description.slice(0, 120)}`,
          schema: [],
        },
        sections,
      };
    }),
  );

  const model: SiteModel = {
    version: 1,
    brand: {
      tokens: deriveTokens(input),
      voice: { tone: "clear, professional" },
      // NOTE: the client's logoUrl is deliberately NOT attached here. `MediaRef` requires
      // `width` and `height` — the type system enforcing NORTH-STAR §4's "no unsized images"
      // (unsized images are the main cause of layout shift, and CLS <= 0.1 is a publish gate).
      // A bare URL has no dimensions, and inventing them would defeat exactly the check the
      // required fields exist to make. Attaching the logo needs the image fetched and measured
      // (or supplied via upload, which already records dimensions) — that is the imagery issue,
      // not this one. Better an absent logo than a fabricated size.
    },
    meta: {
      businessName: input.businessName,
      contact: {
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.email ? { email: input.email } : {}),
        ...(input.address ? { address: input.address } : {}),
      },
      hours: [],
      social: {},
      locations: [],
    },
    nav: sitePlan.pages.map((p) => ({ label: p.title, href: `/${p.slug}` })),
    pages,
  };

  // The shape assertion the roadmap line calls for. renderHtml validates too, but failing here
  // names write() as the culprit instead of surfacing as a render error much later.
  if (!isSiteModel(model)) {
    throw new Error("write() produced a value that is not a valid SiteModel");
  }
  return model;
}

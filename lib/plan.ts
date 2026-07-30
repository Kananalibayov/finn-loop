import { getEffectiveGenerationModel } from "./db.ts";
import { getOpenAI } from "./openai.ts";
import { listVariants } from "./sections/registry.ts";
import { SECTION_TYPES, type SectionType } from "./site-model.ts";
import type { BusinessInput } from "./types.ts";

export interface PlannedSection {
  type: SectionType;
  variant: string;
}

export interface PlannedPage {
  slug: string;
  title: string;
  sections: PlannedSection[];
}

export interface SitePlan {
  version: 1;
  template: string;
  reasoning: string;
  pages: PlannedPage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSitePlan(value: unknown): value is SitePlan {
  if (!isRecord(value) || value.version !== 1 || typeof value.template !== "string" ||
    !value.template.trim() || typeof value.reasoning !== "string" || !value.reasoning.trim() ||
    !Array.isArray(value.pages) || value.pages.length === 0) return false;
  return value.pages.every((page) => {
    if (!isRecord(page) || typeof page.slug !== "string" || !page.slug.trim() ||
      typeof page.title !== "string" || !page.title.trim() || !Array.isArray(page.sections) ||
      page.sections.length === 0) return false;
    return page.sections.every((section) => isRecord(section) &&
      typeof section.type === "string" && (SECTION_TYPES as readonly string[]).includes(section.type) &&
      typeof section.variant === "string" && listVariants(section.type as SectionType).includes(section.variant));
  });
}

const SITE_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["version", "template", "reasoning", "pages"],
  properties: {
    version: { type: "integer", enum: [1] },
    template: { type: "string", minLength: 1 },
    reasoning: { type: "string", minLength: 1 },
    pages: {
      type: "array", minItems: 1,
      items: {
        type: "object", additionalProperties: false,
        required: ["slug", "title", "sections"],
        properties: {
          slug: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          sections: {
            type: "array", minItems: 1,
            items: {
              type: "object", additionalProperties: false,
              required: ["type", "variant"],
              properties: { type: { type: "string", enum: SECTION_TYPES }, variant: { type: "string", minLength: 1 } },
            },
          },
        },
      },
    },
  },
} as const;

export async function plan(input: BusinessInput): Promise<SitePlan> {
  const catalog = SECTION_TYPES.flatMap((type) => listVariants(type).map((variant) => `${type}/${variant}`));
  const completion = await getOpenAI().chat.completions.create({
    model: getEffectiveGenerationModel(),
    temperature: 0.3,
    messages: [
      { role: "system", content: "Plan a website from business facts. Return only a structured site plan using registered section variants; never emit HTML." },
      { role: "user", content: `Business facts:\n${JSON.stringify(input)}\n\nRegistered sections:\n${catalog.join(", ")}` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "site_plan", strict: true, schema: SITE_PLAN_SCHEMA } },
  });
  const choice = completion.choices[0];
  if (choice?.finish_reason !== "stop") throw new Error(`Site plan generation stopped with finish reason: ${choice?.finish_reason ?? "missing"}`);
  if (!choice.message.content) throw new Error("Site plan generation returned empty content");
  let parsed: unknown;
  try { parsed = JSON.parse(choice.message.content); } catch (error) {
    throw new Error(`Site plan generation returned invalid JSON: ${(error as Error).message}`);
  }
  if (!isSitePlan(parsed)) throw new Error("Site plan generation returned an invalid or unrenderable plan");
  return parsed;
}

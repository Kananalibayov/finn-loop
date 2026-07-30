// The Phase 1 pipeline, end to end, in the running app.
//
// plan() -> write() -> renderHtml() -> validateSite()
//
// This is the first route that actually GENERATES a site with the new architecture rather than
// rendering a hand-written fixture. The model chooses vetted section variants (plan), writes slot
// values into them (write), the registry renders real markup and one stylesheet (renderHtml), and
// eight blocking quality gates judge the result (validateSite).
//
// What it deliberately is NOT: the migration. `/api/generate` and the old generator are untouched,
// nothing here is wired into the existing project/delivery flow, and nothing is persisted. It
// exists so the new engine can be exercised and judged in the app instead of only in tests —
// which was the honest gap: every piece was built, merged and green while no route called any of
// it.
//
// Two deliberate properties:
//
//  * `validateSite` is BLOCKING here, exactly as NORTH-STAR §4 requires: "Nothing publishes
//    unless every gate above passes." A site that fails the gates returns 422 with the reasons
//    rather than 200 with a warning. Reporting a bad site as success is the defect class this
//    whole architecture exists to remove.
//  * The stylesheet is inlined for preview only. Real delivery serves it as /style.css, which is
//    what renderHtml emits; a single standalone response has nowhere to serve that file from.
//    Identical bytes, different delivery mechanism.

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, requireRole } from "@/lib/auth";
import { plan } from "@/lib/plan";
import { write } from "@/lib/write";
import { renderHtml } from "@/lib/render/render-html";
import { validateSite } from "@/lib/validate/validate";
import type { BusinessInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Used by GET so the pipeline can be exercised from a browser address bar with no request body.
 * Deliberately mundane facts — the point is to see the pipeline work, not to showcase copy.
 */
const DEMO_INPUT: BusinessInput = {
  businessName: "Riverside Plumbing Co.",
  tagline: "Licensed plumbers, on call 24/7",
  description:
    "A family-run plumbing company serving the riverside area for fifteen years. Emergency callouts, water heater installation and repair, drain cleaning and full repiping.",
  services: ["Emergency repair", "Water heaters", "Drain cleaning", "Pipe replacement"],
  phone: "555-0100",
  email: "hello@riverside.example",
  address: "1 Main Street, Riverside",
};

function isBusinessInput(value: unknown): value is BusinessInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.businessName === "string" && v.businessName.trim().length > 0 &&
    typeof v.tagline === "string" &&
    typeof v.description === "string" &&
    Array.isArray(v.services) && v.services.every((s) => typeof s === "string") &&
    typeof v.phone === "string" && typeof v.email === "string" && typeof v.address === "string"
  );
}

async function runPipeline(input: BusinessInput, wantedSlug: string | null) {
  const sitePlan = await plan(input);
  const model = await write(sitePlan, input);
  const site = renderHtml(model);
  const report = validateSite(model, site);
  const page = wantedSlug ? site.pages.find((p) => p.slug === wantedSlug) : site.pages[0];
  return { sitePlan, model, site, report, page };
}

/** Inline the stylesheet and point nav at this route, so the generated site is browsable here. */
function asStandalonePage(html: string, stylesheet: string, slugs: string[], first: string): string {
  let out = html.replace('<link rel="stylesheet" href="/style.css">', `<style>${stylesheet}</style>`);
  for (const slug of slugs) {
    out = out.replaceAll(`href="/${slug}"`, `href="/api/generate-v2?page=${encodeURIComponent(slug)}"`);
  }
  return out.replaceAll('href="/"', `href="/api/generate-v2?page=${encodeURIComponent(first)}"`);
}

/**
 * GET — generate the demo site and show it. Costs real model calls (one plan call plus one per
 * section), so it is not free to refresh; that is inherent to generation, not an oversight.
 */
export async function GET(req: NextRequest) {
  const session = await requireRole(req.cookies.get(COOKIE_NAME)?.value, "editor");
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 403 });

  const wantedSlug = req.nextUrl.searchParams.get("page");
  const wantsJson = req.nextUrl.searchParams.get("format") === "json";

  let result: Awaited<ReturnType<typeof runPipeline>>;
  try {
    result = await runPipeline(DEMO_INPUT, wantedSlug);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Surfaced, not swallowed: plan/write throw deliberately on a refusal, a truncated
    // completion, invalid JSON or an unrenderable plan. Those messages are the useful signal —
    // hiding them behind a generic 500 would defeat the point of this route.
    console.error("[generate-v2] pipeline failed:", message);
    return NextResponse.json({ error: "Generation failed.", detail: message }, { status: 500 });
  }

  const { sitePlan, site, report, page } = result;

  if (wantsJson) {
    return NextResponse.json({
      ok: report.ok,
      violations: report.violations,
      plan: { template: sitePlan.template, reasoning: sitePlan.reasoning },
      pages: site.pages.map((p) => p.slug),
      sections: sitePlan.pages.map((p) => ({ slug: p.slug, sections: p.sections.map((s) => `${s.type}/${s.variant}`) })),
      stylesheetBytes: site.stylesheet.length,
    });
  }

  // NORTH-STAR §4: a failing gate holds the page as a draft and surfaces the reason. It never
  // publishes with a warning.
  if (!report.ok) {
    return NextResponse.json(
      {
        error: "Generated site failed the quality gates and was not returned.",
        violations: report.violations,
      },
      { status: 422 },
    );
  }

  if (!page) {
    return NextResponse.json(
      { error: `No page "${wantedSlug}".`, available: site.pages.map((p) => p.slug) },
      { status: 404 },
    );
  }

  const slugs = site.pages.map((p) => p.slug);
  return new NextResponse(asStandalonePage(page.html, site.stylesheet, slugs, slugs[0]), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-validate-ok": String(report.ok),
      "x-generated-pages": slugs.join(","),
    },
  });
}

/** POST — same pipeline for a caller-supplied business, returning the model and report as JSON. */
export async function POST(req: NextRequest) {
  const session = await requireRole(req.cookies.get(COOKIE_NAME)?.value, "editor");
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    // The 400 tells the caller; the log tells us WHICH malformed body, which matters when a
    // client is silently sending something unparseable on every request.
    console.error("[generate-v2] unparseable request body:", (error as Error).message);
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isBusinessInput(body)) {
    return NextResponse.json(
      { error: "Body must be a BusinessInput (businessName, tagline, description, services[], phone, email, address)." },
      { status: 400 },
    );
  }

  try {
    const { sitePlan, model, site, report } = await runPipeline(body, null);
    return NextResponse.json(
      {
        ok: report.ok,
        violations: report.violations,
        plan: sitePlan,
        model,
        pages: site.pages.map((p) => ({ slug: p.slug, bytes: p.html.length })),
        stylesheetBytes: site.stylesheet.length,
      },
      // A failing gate is not a server error and not a success. 422 says "understood, refused".
      { status: report.ok ? 200 : 422 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[generate-v2] pipeline failed:", message);
    return NextResponse.json({ error: "Generation failed.", detail: message }, { status: 500 });
  }
}

// Preview harness for the Phase 1 generation pipeline.
//
// Why this exists: lib/sections/**, lib/render/** and lib/validate/** are fully built,
// tested and styled, but no app route calls them yet — the generator migration is the LAST
// Phase 1 item, and Phase 0.9 (foundation) now sits ahead of it. That left the new
// architecture invisible in the running app, so there was no way to look at real output
// without reading test files.
//
// This route renders a fixed demo SiteModel through the real renderer and returns the real
// HTML, so the pipeline can be judged by eye. It is a WINDOW onto the pipeline, not the
// migration: it adds nothing to the generation flow, changes no existing route, and the old
// generator is untouched.
//
// Two deliberate deviations from real delivery, both preview-only:
//  1. The stylesheet is inlined into a <style> block. Real delivery serves it as /style.css
//     (renderHtml emits the <link>), but a standalone preview response has nowhere to serve
//     that file from. The CSS bytes are identical.
//  2. Content is a hand-written fixture. write() does not exist yet, so nothing can generate
//     copy — this shows the RENDERING, not AI-authored content. Do not read it as proof that
//     content generation works.

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, requireRole } from "@/lib/auth";
import { renderHtml } from "@/lib/render/render-html";
import { validateSite } from "@/lib/validate/validate";
import type { SiteModel } from "@/lib/site-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_MODEL: SiteModel = {
  version: 1,
  brand: {
    tokens: {
      color: {
        primary: "#1d4ed8",
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
    },
    voice: { tone: "friendly, confident" },
  },
  meta: {
    businessName: "Riverside Plumbing Co.",
    contact: { phone: "555-0100", email: "hello@riverside.example" },
    hours: [{ days: "Mon–Fri", time: "8am–6pm" }],
    social: {},
    locations: [],
  },
  nav: [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services" },
    { label: "Contact", href: "/contact" },
  ],
  pages: [
    {
      slug: "home",
      title: "Home",
      seo: {
        title: "Riverside Plumbing Co. — Fast, Reliable Plumbing",
        description: "Licensed, insured, on call 24/7 for emergency plumbing.",
        schema: [],
      },
      sections: [
        {
          type: "hero",
          variant: "split",
          content: {
            heading: "Plumbing problems, fixed fast",
            subheading: "Licensed, insured, and on call 24/7.",
            cta: { label: "Get a free quote", href: "/contact" },
          },
        },
        {
          type: "services",
          variant: "grid",
          content: {
            heading: "What we do",
            items: [
              { title: "Emergency repair", description: "Burst pipes and leaks handled fast.", price: "From $120" },
              { title: "Water heaters", description: "Install, repair and replace." },
              { title: "Drain cleaning", description: "Thorough, and no mess left behind." },
            ],
          },
        },
        {
          type: "stats",
          variant: "row",
          content: {
            heading: "By the numbers",
            items: [
              { value: "24/7", label: "Emergency cover" },
              { value: "1,200+", label: "Jobs completed" },
              { value: "4.9★", label: "Average rating" },
            ],
          },
        },
        {
          type: "testimonials",
          variant: "cards",
          content: {
            heading: "What clients say",
            items: [
              { quote: "Showed up in 20 minutes and fixed it properly.", author: "Dana R.", role: "Homeowner" },
              { quote: "Fair pricing, no surprises on the invoice.", author: "Mike T." },
            ],
          },
        },
        {
          type: "faq",
          variant: "accordion",
          content: {
            heading: "Common questions",
            items: [
              { question: "Do you offer emergency service?", answer: "Yes — 24/7, every day of the year." },
              { question: "Are you licensed and insured?", answer: "Fully licensed and insured in-state." },
            ],
          },
        },
        {
          type: "cta",
          variant: "banner",
          content: {
            heading: "Ready when you are",
            subheading: "Same-day appointments in most areas.",
            cta: { label: "Call 555-0100", href: "tel:5550100" },
          },
        },
      ],
    },
    // A three-page demo, not one: nav links must resolve to real pages or validateSite's
    // structure/links gate fails — it caught exactly that when this fixture was one page
    // with a three-item nav. Keeping it multi-page also exercises per-page rendering and the
    // unique-title/description gates, which a single page cannot.
    {
      slug: "services",
      title: "Services",
      seo: {
        title: "Our Services — Riverside Plumbing Co.",
        description: "Emergency repair, water heaters, drain cleaning and pipe replacement.",
        schema: [],
      },
      sections: [
        {
          type: "hero",
          variant: "centered",
          content: {
            heading: "Everything we handle",
            subheading: "Residential and light commercial plumbing.",
          },
        },
        {
          type: "services",
          variant: "list",
          content: {
            heading: "Full service list",
            items: [
              { title: "Emergency repair", description: "Burst pipes, major leaks, no water.", price: "From $120" },
              { title: "Water heaters", description: "Tank and tankless, install and repair." },
              { title: "Drain cleaning", description: "Camera inspection included." },
              { title: "Pipe replacement", description: "Copper and PEX repiping." },
            ],
          },
        },
        {
          type: "steps",
          variant: "numbered",
          content: {
            heading: "How a callout works",
            items: [
              { title: "You call", description: "We confirm a window, usually same day." },
              { title: "We diagnose", description: "Fixed-price quote before any work starts." },
              { title: "We fix it", description: "Tidy up, then a written summary." },
            ],
          },
        },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      seo: {
        title: "Contact Riverside Plumbing Co.",
        description: "Call, email, or send a message and we will get back the same day.",
        schema: [],
      },
      sections: [
        // A hero leads this page deliberately. Only `hero` emits an <h1>, so a page without
        // one fails validateSite's structure/h1 gate — the gate caught exactly that when this
        // page opened with the contact section alone. A section cannot know whether it is a
        // page's primary heading, so this is a real constraint on page composition, not a
        // fixture quirk. Filed separately.
        {
          type: "hero",
          variant: "centered",
          content: {
            heading: "Get in touch",
            subheading: "Call 555-0100 for anything urgent.",
          },
        },
        {
          type: "contact",
          variant: "stacked",
          content: {
            heading: "Send a message",
            body: ["For quotes, the form below is fine — we reply the same day."],
            showForm: true,
          },
        },
      ],
    },
  ],
} as SiteModel;

export async function GET(req: NextRequest) {
  // Operator-only. Middleware already gates non-public paths, but the in-handler check is
  // the enforced one (lib/route-auth.test.mts ratchets on it).
  const session = await requireRole(req.cookies.get(COOKIE_NAME)?.value, "editor");
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 403 });
  }

  const wantsReport = req.nextUrl.searchParams.get("report") === "1";

  let site;
  try {
    site = renderHtml(DEMO_MODEL);
  } catch (err) {
    // Surface the real reason. renderHtml throws deliberately on an unregistered
    // section/variant rather than silently dropping it, and that message is the useful
    // signal — swallowing it here would hide exactly what this harness exists to reveal.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[preview-site] renderHtml threw:", message);
    return NextResponse.json(
      { error: "Render failed.", detail: message },
      { status: 500 },
    );
  }

  const report = validateSite(DEMO_MODEL, site);

  if (wantsReport) {
    return NextResponse.json({
      ok: report.ok,
      violations: report.violations,
      pages: site.pages.map((p) => p.slug),
      stylesheetBytes: site.stylesheet.length,
    });
  }

  // ?page=<slug> picks which page to show; defaults to the first.
  const wanted = req.nextUrl.searchParams.get("page");
  const page = wanted ? site.pages.find((p) => p.slug === wanted) : site.pages[0];
  if (!page) {
    return NextResponse.json(
      { error: `No page "${wanted}".`, available: site.pages.map((p) => p.slug) },
      { status: 404 },
    );
  }

  // Preview-only: inline the stylesheet, since a single standalone response cannot also
  // serve /style.css. Same bytes, different delivery mechanism.
  // Nav hrefs are rewritten to this route so the demo is clickable in a browser; real
  // delivery keeps the plain "/slug" paths renderHtml emits.
  let html = page.html.replace(
    '<link rel="stylesheet" href="/style.css">',
    `<style>${site.stylesheet}</style>`,
  );
  for (const p of site.pages) {
    html = html.replaceAll(
      `href="/${p.slug}"`,
      `href="/api/preview-site?page=${encodeURIComponent(p.slug)}"`,
    );
  }
  html = html.replaceAll(
    'href="/"',
    `href="/api/preview-site?page=${encodeURIComponent(site.pages[0].slug)}"`,
  );

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      // Report the gate result in a header so it is visible without a second request.
      "x-validate-ok": String(report.ok),
      "x-validate-violations": String(report.violations.length),
    },
  });
}

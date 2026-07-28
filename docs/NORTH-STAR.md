# NORTH STAR — Finn-Loop Site Factory

> **Read this before writing any code or specifying any issue.**
> This document defines what we are building and what "correct" means.
> It is evergreen: it describes the target, not the current state.
>
> | Document | Answers |
> |---|---|
> | **this file** | What are we building? What must always be true? |
> | [`STATE-OF-THE-BUILD.md`](./STATE-OF-THE-BUILD.md) | Where is the code really, structurally? |
> | [`GAP-LEDGER.md`](./GAP-LEDGER.md) | 162 verified defects and the 7 root causes behind them |
> | [`PRODUCT-VISION.md`](./PRODUCT-VISION.md) | Why we win, and what enterprise-grade requires |
> | [`AGENT-TIERS.md`](./AGENT-TIERS.md) | Which model does which work, and how |
> | [`../ROADMAP.md`](../ROADMAP.md) | In what order |

---

## 1. What we are building

**A production line that turns a client intake form into a live, on-brand WordPress website with under 10 minutes of human attention.**

We are a marketing agency. This is not a product we sell to the public — it is the
machine our agency runs on. Every design decision serves throughput and quality at
volume, not end-user self-service.

**The one-sentence test:** a lead fills in a form; an operator clicks twice; the client
has a live website on our hosting that we would be proud to put our name on.

### Who uses it

| Role | What they do |
|---|---|
| **Lead / prospect** | Fills in the public intake form. Never logs in. |
| **Operator** (us) | Approves the AI's plan, reviews the built site, clicks deliver. |
| **Client** (post-launch) | Logs into the portal, sees their site, requests changes. |

### What "as good as lovable.dev" means here

Lovable's actual achievement is not "AI writes code." It is that **the default output
is good every single time**, because quality is engineered into the system rather than
requested from the model. We copy the principle, not the product:

- Lovable optimises for one person iterating conversationally on one app.
- We optimise for one operator shipping many client sites with predictable quality and
  near-zero rework.

Concretely, we match lovable on: visual quality of first output, speed to first preview,
and the ability to refine in plain English. We do **not** need: a code editor, arbitrary
app logic, or a chat-first UI.

---

## 2. The Golden Path

This is the canonical flow. **Every feature must serve a numbered step. If it serves
none, it is out of scope.**

```
1. CAPTURE   Lead submits the public intake form (or a lead arrives from the CRM).
2. BRIEF     Submission is normalised into a structured Brief. Operator may enrich it.
3. PLAN      AI proposes: template + page set + section plan + copy angle, with reasons.
             ── HUMAN GATE ①: approve, or adjust and approve. Default = approve.
4. BUILD     Brief + Plan → SiteModel → rendered preview. No human input required.
5. REVIEW    Operator (and optionally the client) views the preview and refines in
             plain English until happy.
             ── HUMAN GATE ②: approve for delivery.
6. PROVISION Hosting is created (Plesk or Hostinger), WordPress installed, plugin
             paired, SSL issued. No human input required.
7. DELIVER   SiteModel is rendered to the chosen WordPress target and published live.
8. HANDOFF   Client portal access is issued; the site is registered with the SEO
             platform; the CRM record is updated.
```

**Steps 1, 2, 4, 6, 7, 8 must be fully automatic.**
**Steps 3 and 5 are the two human gates** — this is the "one or two clicks" the business
requires. Both must default to a single approve button with a sensible pre-filled answer.

Human-in-the-loop is a **choice, not a dependency**: an operator may intervene anywhere,
but the path must complete without intervention if they only press approve.

---

## 3. Invariants

Hard rules. Violating one is a bug even if the feature "works."

**Product**

1. **Every change must reduce time or clicks on the Golden Path, or measurably improve
   output quality at a named step.** If it does neither, do not build it.
2. **No new top-level page or dashboard** unless it is a Golden Path step or the user
   explicitly asked for it.
3. **A feature is not done until its Golden Path step works end to end** against a real
   WordPress site. Compiling is not evidence. Typechecking is not evidence.
4. **Never report success for work that did not happen.** No silent fallbacks, no empty
   `catch` blocks that swallow failures, no "✓ done" when the underlying call failed.

**Architecture**

5. **The `SiteModel` is the single source of truth for a site.** HTML, Gutenberg blocks,
   Elementor JSON and Beaver Builder data are *render targets* derived from it — never
   the source, never edited directly, never round-tripped back into the model.
6. **LLMs never emit markup.** Not HTML, not CSS, not Gutenberg block comments, not
   Elementor `_elementor_data`. A model's only permitted output is
   `{section_id, variant, slot_values}` plus a token document, schema-validated. Deterministic
   renderers produce all markup. *This is what makes a sanitizer unnecessary rather than
   merely absent — and it is why no model output can ever become stored XSS, off-palette
   colour, or a Core Web Vitals regression.*
7. **Design quality is deterministic.** Layout, spacing, type scale, responsiveness and
   accessibility live in the section registry and the design tokens — not in a prompt, and
   not in the model's discretion.
7a. **Every rendered section carries a stable `(section_id, variant, registry_version)`
   instance id.** This is load-bearing for revenue attribution and cannot be retrofitted
   once sites have shipped.
8. **Every delivery target renders from the same `SiteModel`.** Adding a target must not
   require a second generation pipeline.
9. **All external systems sit behind an adapter interface** in `lib/integrations/*`
   (hosting, CRM, SEO, email). No provider-specific calls scattered through routes.
10. **Secrets are never written to logs, disk, or any response body.** Credentials at
    rest are encrypted.

**Data**

11. **A project belongs to a client and a delivery target, and never silently loses that
    link.** Any operation that creates a new project version must carry the client,
    connection and published-page references forward.
12. **Multi-tenant isolation is enforced server-side on every request**, not by
    middleware alone and never by the UI.

---

## 4. Quality bar

A site may not be delivered unless it passes these automatically. These are gates in
code, not aspirations in a prompt.

**Structure**
- Valid, parseable HTML; document ends where it should (no truncated model output).
- Semantic landmarks: one `<h1>` per page, `<header>`/`<main>`/`<footer>`, logical heading order.
- Every internal link resolves to a real page in the same site.
- `<title>` and meta description present and unique per page; Open Graph + JSON-LD schema present.

**Visual**
- No layout breakage at 360 / 768 / 1280 / 1920 px.
- All spacing, type sizes, colours and radii come from tokens. No arbitrary values.
- Every page shares one header, one footer and one token set — verified, not assumed.

**Content**
- No lorem ipsum, no unreplaced `{{placeholders}}`, no other business's name left in.
- No invented credentials, awards, review counts, certifications or statistics.
- Every image is real and relevant: client-supplied, licensed stock, or generated —
  never a random photo service. Every image has meaningful alt text.

**Accessibility — legally load-bearing, not a nicety**
- **WCAG 2.2 AA** is the default target (not 2.1 — the EU harmonised standard flips around
  October 2026). The rule pack is versioned and swappable per tenant.
- Automated pass on every page, **plus** the section variant it uses must come from a
  registry template certified by expert manual and assistive-technology audit. Automated
  tooling catches only 30–40% of real failures, so automated-only cannot honestly be called
  compliance.
- 24×24 CSS px minimum target size; no drag-only interactions; focus never obscured by
  sticky elements; a help affordance in a consistent position; no cognitive-function-test
  CAPTCHAs in generated forms.
- Contrast meets AA. All interactive elements keyboard reachable and labelled.
- **Never bundle an accessibility overlay** and never claim automatic compliance — see
  [`PRODUCT-VISION.md §2.4`](./PRODUCT-VISION.md).

**Performance**
- Core Web Vitals: **LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1** — all three, no averaging.
  Lab budgets gate publish; a first-party RUM beacon reports rolling 28-day p75 per site,
  because a new site has no field data to prove compliance with.
- Lighthouse ≥ 90 on Performance, Accessibility, Best Practices and SEO.

**Discoverability**
- Server-rendered or statically generated. **No client-side-only primary content** — many AI
  crawlers do not execute JavaScript. Verified by a build-time check with JS disabled.
- JSON-LD generated from the same content model that renders the page, with no field that
  lacks corresponding visible text.
- robots.txt, sitemap.xml, canonicals, hreflang and the internal-link graph derived from one
  manifest, with a linter that fails publish on any disagreement between them.

**Function**
- The contact form actually submits and reaches the client.
- Time to first preview under 60 seconds.
- **Nothing publishes unless every gate above passes.** A failing gate holds the page as a
  draft and surfaces the reason — it never publishes with a warning.

---

## 5. Architecture — the SiteModel

The central technical decision. One structured model, many renderers.

```
Intake Form
    ↓
  Brief                       structured business facts + goals + brand inputs
    ↓  plan()                 1 LLM call, JSON schema output
  SitePlan                    template + pages + ordered section types/variants
    ↓  write()                N small parallel LLM calls, JSON schema output
  SiteModel  ◄──── the source of truth; versioned; diffable
    ↓  validate()             deterministic quality gates (§4)
    ↓  render(target)
  ┌──────────┬────────────┬───────────┬────────┐
  │  HTML    │ Gutenberg  │ Elementor │ Beaver │
  │ + theme  │  blocks    │   JSON    │  data  │
  └──────────┴────────────┴───────────┴────────┘
```

### The model

```ts
SiteModel {
  version: 1
  brand:  { tokens: DesignTokens, logo?: MediaRef, voice: Voice }
  meta:   { businessName, contact, hours, social, locations }
  nav:    NavItem[]
  pages:  Page[]
}

Page    { slug, title, seo: {title, description, schema[]}, sections: Section[] }

Section { type: 'hero' | 'services' | 'features' | 'about' | 'testimonials'
                | 'gallery' | 'faq' | 'cta' | 'contact' | 'team' | 'pricing'
                | 'stats' | 'logos' | 'steps'
          variant: string        // a vetted layout of that type
          content: <typed per section type>
          media?:  MediaRef[] }

DesignTokens { color{primary,accent,bg,surface,text,muted,border},
               font{heading,body}, typeScale, spacingUnit, radius, shadow,
               containerMax }

MediaRef { kind: 'upload'|'stock'|'generated', url, alt, width, height,
           wpMediaId? }   // wpMediaId set once uploaded to the target WP
```

### The section library

`lib/sections/<type>/<variant>/` — each variant is a hand-designed, responsive,
accessible layout that knows how to render itself to each target:

```ts
export const heroSplit: SectionRenderer = {
  html:       (content, tokens) => "...",
  gutenberg:  (content, tokens) => "...",
  elementor:  (content, tokens) => ({...}),
}
```

**This is where site quality lives.** A new variant is designed once, reviewed once, and
then produces correct output forever. Model output quality stops being a variable.

### What a template becomes

A template is no longer frozen HTML. It is **a token preset plus a default section plan**
— which makes "pick the best-fitting template and fill it with this client's content" a
real, deterministic operation rather than a prompt hint.

Screenshot and URL intake produce *tokens + a section plan*, not scraped markup.

### Why this shape

| Problem | How the model solves it |
|---|---|
| Pages look inconsistent | One token set + one shell, applied by the renderer |
| Output not responsive | Responsiveness is built into each variant, once |
| Can't support Elementor/Beaver | Another renderer, not another pipeline |
| NL edits rewrite whole pages | An edit is a patch to a node: `sections[2].content.heading` |
| Can't diff or review versions | JSON diff between model versions |
| WordPress mangles our HTML | We emit the format WordPress actually expects |
| Slow generation | Small, typed, parallel calls instead of 5 big serial ones |

---

## 6. Delivery targets

All render from the same `SiteModel`. The operator picks one at delivery.

| Target | Use when | What lands in WordPress |
|---|---|---|
| **Custom theme** *(default)* | We want full control and best performance | A generated lightweight theme: real templates, one stylesheet, assets in the media library |
| **Gutenberg blocks** | Client will edit content themselves in stock WP | Native `wp-block-*` markup that respects the active theme |
| **Elementor** | Client's team already uses Elementor | `_elementor_data` JSON per page |
| **Beaver Builder** | Client's team already uses Beaver | Beaver layout data per page |

**Non-negotiable for every target:** images are uploaded to the WordPress media library
and referenced by their WP URL; navigation points at real WordPress permalinks; the
static front page is set; pages are published, not left as drafts.

---

## 7. Integration seams

Define the boundary now so the SEO platform and CRM can attach later without a rewrite.
Each is one adapter module with one interface.

**Hosting** — `lib/integrations/hosting/`
```ts
interface HostingProvider {
  createSite(domain): Promise<SiteHandle>
  installWordPress(handle, opts): Promise<WpCredentials>   // must throw, never fail open
  issueSsl(handle): Promise<void>
  getAdminCredentials(handle): Promise<WpCredentials>
}
```
Implementations: `plesk.ts`, `hostinger.ts`. Provisioning code depends only on the interface.

**CRM** — `lib/integrations/crm/`
Inbound: a lead becomes a Brief. Outbound: project status flows back to the lead record.
Projects carry `external_lead_id`. Our CRM is already reachable over MCP; the adapter
wraps it either way.

**SEO platform** — `lib/integrations/seo/`
Pre-build: keyword and SERP data inform page selection and copy.
Post-launch: register the site, hand off to the content engine.

**Rule:** no route, page or generation module may call an external system directly.

---

## 8. Non-goals

Explicitly out of scope. Do not build these without an explicit decision recorded here.

- A self-service website builder for the public.
- A hosting control panel — we automate Plesk and Hostinger, we do not reimplement them.
- E-commerce, memberships, booking systems, or custom application logic in client sites.
- A code editor or developer-facing IDE experience.
- Supporting arbitrary third-party WordPress themes. We control the theme or we emit
  theme-neutral blocks.
- Migrating or redesigning existing client sites (a later product, not this one).

---

## 9. Working agreement for AI agents

1. **Read this document first.** If a request conflicts with an invariant, say so before
   building, and name the invariant.
2. **State the Golden Path step** your change serves, in the issue and the PR.
3. **Build vertical slices.** One step working end to end beats five steps half-built.
   Breadth without depth is the failure mode this project has already experienced.
4. **Prove it against reality.** Run the flow against a real WordPress site and show the
   result. A green typecheck is not proof.
5. **Do not drift.** If you notice adjacent broken things, note them in
   `STATE-OF-THE-BUILD.md` — do not fix them inside an unrelated change.
6. **When the spec is ambiguous, choose the option that removes a human click** without
   removing a human decision.

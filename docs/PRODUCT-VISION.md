# Product Vision — the defensible position and what "best in market" requires

> Grounded in a competitive scan of the 2026 AI site-generation market and the concrete
> legal, performance and enterprise requirements that apply to sites an agency delivers.
> Read after [`NORTH-STAR.md`](./NORTH-STAR.md).
>
> **Sequencing honesty up front:** none of the five capabilities below is reachable while
> the pipeline cannot publish a page. The enterprise thesis and the blocker list in
> [`GAP-LEDGER.md`](./GAP-LEDGER.md) are the **same programme of work**.

---

## 1. Positioning

**Stop describing this as an AI website builder.** That category is commoditised. Every
incumbent — Wix, Hostinger Horizons, Lovable, v0, Bolt, 10Web, ZipWP — is converging on
the same prompt → draft → visual-edit loop, and none of it is what the agency is paid for.

The sharpest defensible position is the one **only this company can occupy**, because it
already owns all three systems:

> **The only site factory where the search data that justifies a page, the page itself, and
> the booked revenue that page produced share one identifier.**

Sold plainly: **"GoHighLevel's agency economics, with sites that actually rank."**

That is an attack on a documented weakness, not a claim:

| Competitor | Owns | Structurally lacks |
|---|---|---|
| **GoHighLevel** | The agency business model worth copying wholesale: unlimited sub-accounts, per-client rebilling | Site quality. Mobile PageSpeed 20–45, unremovable platform scripts, and it "gives you every technical control Google needs, then ships all of them empty" — agencies routinely find live GHL pages titled *"Home – Page 1"* with no meta description |
| **Relume** | The best layout generator in the market | Webflow-only. No WordPress, no CRM, no marketing-tool integration |
| **10Web** | Solid AI build + hosting | Caps the AI builder at 5 pages; most value evaporates off its own hosting |
| **ZipWP** | The best block architecture | No search data, no CRM |
| **All of them** | Generation quality | *"The AI runs at generation-time, not as an editing partner"* — every site goes stale the day it ships |

**The moat is not generation quality.** Concede that layer — generate onto core/Spectra
blocks if it helps. The moat is **the integration surface and the closed loop**, which is
exactly what a design-time tool and a CRM-only platform each structurally lack.

---

## 2. The five capabilities

### 1. A versioned Section Registry as the *only* output the model may produce

The model emits `{section_id, variant, slot_values}` arrays plus a token document. **Never
markup. Never CSS. Never Gutenberg block comments or Elementor `_elementor_data`.**

Sections are hand-authored, accessibility-certified block templates living in the plugin.
A generated `theme.json` is the single per-client visual identity artifact, and WordPress
derives `--wp--preset--*` custom properties from it — so the model is **structurally unable
to emit an off-palette hex or off-scale spacing.**

This is v0's real advantage (a registry plus a CSS-variable token contract — not prompt
craft) applied to WordPress. It deletes in one architectural move the largest defect class
in the audit: **no sanitizer is needed because no model markup is ever persisted.** No
`cleanHtml`, no prose-in-page, no stored XSS, no Core Web Vitals drift, and WCAG 2.2 AA
target sizes and focus behaviour guaranteed at token level.

Competitors already shipping freeform HTML/JSX cannot retrofit this without rebuilding
their generator and re-migrating every existing site.

**Corollary:** this is also the only architecture in which regeneration is safe — which is
what capability 5 depends on.

### 2. A SERP-driven page graph with a hard data-sufficiency publish gate

The sitemap is **computed from the agency's own clustered keyword and SERP data** — volume,
intent, SERP-feature presence, live top-10 competitor section ordering used as a *negative*
constraint — not from a generic industry template. It emits service × city matrices with an
auto-generated hub-and-spoke internal link graph, rather than five pages.

**The gate that makes it safe:** a spoke page cannot publish unless it carries N unique
verifiable local data points — real reviews for that location, local pricing, named
projects, service-radius/travel-time specifics, regional regulatory or seasonal detail.
Pages failing the gate are held as drafts and surfaced in the portal as a content request
the CRM chases.

This is simultaneously the scale wedge over 10Web's 5-page cap **and** the safety property
against Google's 2026 scaled-content enforcement, which collapsed the grey zone between
data-backed programmatic pages and doorway pages.

No standalone builder has the search data; no SEO tool has the emitter. **Inverting the
industry ordering — search data as an *input* to generation rather than an audit of the
output — is the single most differentiating architectural decision available here.**

### 3. Section-level revenue attribution

Every rendered section carries a stable `(section_id, variant, registry_version)` instance
id, threaded through form submissions and call tracking into the CRM lead record and onward
to booked revenue.

Once a few hundred sites have accumulated data, rank registry variants by **measured
conversion per vertical per intent** and have the generator sample from proven variants
instead of uniformly. That also answers the known weakness of the registry model — the
visible homogeneity that lets anyone identify a Relume build.

This is the asset that compounds and cannot be shortcut. A builder vendor with no CRM
literally cannot compute it; a CRM vendor with no factory has nothing to attribute to.

> **⚠️ It requires stable section identity from day one.** Retrofitting after a few hundred
> sites ship is prohibitive. **Make this schema decision now, in the same migration that
> introduces `delivered_pages`.** This is the one capability where delay is permanently
> expensive.

### 4. A publish gate that makes shipping a non-compliant page impossible

Nothing publishes unless it clears, as **blocking** checks:

- **WCAG 2.2 AA** automated pass, against a template certified once by expert manual and
  assistive-technology audit.
- **Core Web Vitals** lab budgets: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 — all three, no
  averaging — plus a first-party RUM beacon reporting rolling 28-day p75 per site.
- **Schema-versus-visible-content consistency.**
- **Canonical / sitemap / hreflang coherence**, with orphan-page and one-way-hreflang
  detection.
- **Title / meta / JSON-LD populated** from the SEO platform.

Plus: immutable slugs after first index with auto-301 on change; per-site accessibility
statements generated from real audit results **including the spoken-form version the EAA
requires**; and an immutable per-release conformance report retained as legal evidence.

**Why this is revenue, not overhead** — the compliance landscape as of mid-2026:

| Fact | Consequence |
|---|---|
| The **European Accessibility Act** has been enforceable since **28 June 2025**, reaching any business selling to EU consumers regardless of where it is based. E-commerce is the catch-all category | Tenant onboarding needs a compliance-scoping questionnaire that assigns each site a mandatory conformance profile |
| The harmonised standard flips from WCAG 2.1 AA to **WCAG 2.2 AA around October 2026** (EN 301 549 V4.1.1) | Ship a **versioned, swappable rule-pack engine**; default new sites to 2.2 AA so October is a config change, not a re-platform |
| **5,114** US digital accessibility lawsuits in 2025; 1,037 in Q1 2026 alone; pacing past 6,000. No ADA web regulation exists, so "no rule yet" is not a defence | Automated pre-launch audit as a blocking gate, plus a **paid ongoing scan-and-remediate SLA** |
| **22.6%** of H1 2025 US suits targeted sites that *already had an overlay widget installed*. The FTC fined accessiBe **$1M** over compliance claims | **Never bundle or resell an overlay.** Never market "automatically ADA compliant" — overstated claims are themselves an FTC exposure |
| Automated tooling catches only **30–40%** of real WCAG failures. WebAIM Million 2026: 95.9% of top-million homepages have automatically detectable failures, up from 94.8% — reversing six years of improvement | Certify **~60 templates once** by expert audit and amortise across every tenant site. This is the only honest *and* only economic basis for a conformance claim |
| The agency's liability is **contractual, not statutory** — it arrives as an indemnity demand from the client, not a lawsuit from a user. Courts strike blanket indemnity but honour **contribution** clauses | Treat contract and evidence as product features: bounded conformance warranty tied to a named standard and audit date, exclusions for client-uploaded content, contribution allocation, immutable per-release reports. Carry tech E&O with an accessibility rider |
| Only **55.9%** of tracked origins pass all three Core Web Vitals. New sites have **no CrUX record**, so lab scores cannot prove field compliance | Ship the RUM beacon by default. Post-launch performance becomes a monitored SLA rather than a launch-day snapshot — a real differentiator against page builders |

Demoable as: **"it will not let you ship an SEO-broken or inaccessible page."** GHL cannot
answer that.

### 5. Closed-loop regeneration on a durable job runner

A position drop, or a keyword cluster with no matching page, triggers the factory to
propose a section insert, a copy revision, or a new spoke page. The client approves it in
the portal. A durable workflow applies it, republishes, and the CRM measures whether calls
and booked jobs actually moved.

This is **only safe because of capability 1** — a site that is a section graph plus a token
document can be regenerated deterministically, whereas a hand-edited React export or an
opaque `_elementor_data` blob cannot. It directly occupies the gap the entire market leaves
open: *the AI runs at generation time, not as an editing partner.*

Build it on the same durable-execution substrate that fixes
[`GAP-LEDGER.md`](./GAP-LEDGER.md) pattern 4 — per-step checkpoints, deterministic
idempotency keys, terminal DLQ, resumable SSE, and **human approval modelled as a suspended
workflow awaiting a signal** rather than a held HTTP connection. Instrument per-tenant token
cost so gross margin per site is a first-class metric sales can quote.

---

## 3. Two supporting decisions that make all five durable

**Keep the privileged first-party plugin as the provisioning channel.** WordPress 7.0's
Abilities API and MCP Adapter deliberately never expose theme install, plugin activation,
kit import, or redirect-table writes. So: route *ongoing content operations* through the
standard MCP adapter to inherit core's permission model, and register the factory's own
operations as first-class Abilities so the SEO platform and CRM call them over MCP with
**role-scoped tokens instead of shared secrets.**

**Keep hosting neutrality as an explicit selling point.** Plesk, portable WordPress, no
proprietary rendering layer. The deliverable is *a site the client owns* — precisely the
objection that kills 10Web and GHL in agency sales.

---

## 4. Enterprise requirements — the build order that wins deals

Not a wish list; a sequence. RBAC and audit logging are **prerequisites, not add-ons.**

1. **Two-axis RBAC.** Not a flat role list — `(principal → scope → permission)` where scope
   is organisation, workspace, or individual site. Agency operators legitimately act across
   many client sites while each client's users are confined to their own. Model
   "agency staff with cross-tenant access" as a **distinct principal type**, separately
   logged and separately consented to in the client DPA. **Every authorisation check takes
   tenant/site scope as a mandatory argument**, so a missing scope is an error, never an
   implicit allow.
2. **Audit logging.** Append-only, actor-attributed, tenant-scoped, exportable,
   tamper-evident. Log site publish/unpublish, DNS and certificate changes, domain
   verification, content changes, AI generation runs, data export, and every cross-tenant
   access by agency staff — with before/after values and a request correlation id. 12 months
   minimum retention. This doubles as SOC 2 evidence *and* accessibility publishing
   provenance.
3. **SSO** — SAML 2.0 and OIDC per tenant, with IdP-group-to-role mapping and
   enforced-SSO/domain capture.
4. **SCIM 2.0** — provisioning and, critically, **deprovisioning**.

Gate SSO and SCIM behind an enterprise plan; that is the standard paywall line.

**Tenancy: adopt the bridge model.** Pooled storage with `tenant_id` on every row **plus
database row-level security as defence in depth** — not application-layer filtering alone —
and a documented path to siloed or dedicated-region deployment for large or regulated
tenants. Enforce **per-tenant quotas and rate limits on the expensive shared resources**
(AI concurrency and tokens, build workers, bandwidth): noisy-neighbour resource exhaustion
is a denial-of-service vector against other tenants, i.e. a security control, not a
performance nicety.

**Custom domains bring two obligations:** automated per-domain ACME certificate lifecycle
with expiry alerting, and a **scheduled dangling-DNS reconciliation job** — when a tenant
offboards but leaves the DNS record pointing at platform infrastructure, that record is a
subdomain-takeover vector. Verify ownership via a platform-issued TXT token *before* binding
any hostname, and refuse to re-bind an unverified hostname to a different tenant.

**GDPR: the platform is a processor for site-visitor data and a controller for tenant
account data.** That dual role requires a signable online DPA, a public versioned
sub-processor register with change notification and an objection window (the register is
unavoidably long — LLM provider, hosting/CDN, DNS/CA, analytics, email), DSAR and erasure
tooling that can **reach data inside generated sites** (form submissions, comments,
analytics), breach runbooks with contractual timelines, and a commitment that tenant content
is not used to train models.

**Make region a first-class tenant attribute.** Residency and sovereignty are different
products, and the legal basis for US transfers is under live challenge. EU-region storage
and compute as a selectable option — **including region-pinned inference, since the model
call is itself a cross-border transfer of whatever is in the prompt** — no cross-region
background jobs or logs, a swappable model-provider abstraction, and honest documentation of
residency versus sovereignty rather than marketing one as the other.

---

## 5. Technical SEO requirements the generator must satisfy

These are gates on the renderer, not content advice.

- **Server-rendered or statically generated only.** No client-side-only primary content.
  Google's rendering is deferred and resource-intensive, and **many AI crawlers do not
  execute JavaScript at all**. Add a build-time check asserting primary content is present
  in the raw HTML with JS disabled.
- **Structured data as entity disambiguation, generated from the same content model that
  renders the page** — never hand-authored separately. Fail the build when a schema field
  has no corresponding visible text, when required properties are missing, or when entity
  identity (name, address, URL, `sameAs`) is inconsistent across pages. Mismatched markup
  risks being ignored or treated as spam.
- **robots.txt, sitemap.xml, canonicals, hreflang clusters and the internal-link graph all
  derived from one routing manifest**, with a consistency linter that fails publish on: a
  `noindex` URL in the sitemap, a canonical pointing at a redirect or non-200, one-way
  hreflang, a missing `x-default`, or an orphan page with no inbound internal link. The
  common failure is these four disagreeing with each other.
- **Emit `llms.txt` because it is nearly free — but do not price or market it as the
  AI-visibility feature.** Adoption is minimal and it has near-zero presence in content
  actually cited by AI systems. What correlates with AI citation is conventional quality:
  fast, server-rendered, factually dense, cleanly marked-up pages with good internal
  linking. Keep an abstraction so an emerging standard can be emitted from the same
  manifest.

---

## 6. What this means for the roadmap

The five capabilities map onto existing debt rather than adding a parallel track:

| Capability | Absorbs |
|---|---|
| 1 — Section Registry | The entire sanitizer / HTML-validation / `cleanHtml` debt (pattern 2). This is the correct destination for it |
| 2 — SERP-driven page graph | Replaces the hard-coded 5-page set; makes the SEO platform an input |
| 3 — Section attribution | **Must be decided inside the schema migration** (pattern 3) |
| 4 — Publish gate | Absorbs the "nothing is ever published" blocker and turns it into the quality gate |
| 5 — Closed-loop regeneration | The correct destination for the durable-job-runner debt (pattern 4) |

See [`../ROADMAP.md`](../ROADMAP.md) for the sequenced plan.

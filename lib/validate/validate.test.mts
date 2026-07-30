import assert from "node:assert/strict";
import { test } from "node:test";
import { renderHtml, type RenderedSite } from "../render/render-html.ts";
import { sectionInstanceId } from "../sections/registry.ts";
import type { DesignTokens, SiteModel } from "../site-model.ts";
import {
  checkAlt,
  checkH1,
  checkLandmarks,
  checkLinks,
  checkTitle,
  validateSite,
  type ValidationReport,
  type Violation,
} from "./validate.ts";

const tokens: DesignTokens = {
  color: { primary: "#123456", accent: "#abcdef", bg: "#ffffff", surface: "#f5f5f5", text: "#111111", muted: "#666666", border: "#dddddd" },
  font: { heading: "Inter", body: "Arial" },
  typeScale: "1.25", spacingUnit: "8px", radius: "4px", shadow: "0 1px 2px #0003", containerMax: "1200px",
};

function validModel(): SiteModel {
  const page = (slug: string, title: string, variant: string, heading: string) => ({
    slug,
    title,
    seo: { title: `${title} — Example`, description: `${title} page description.`, schema: [] },
    sections: [{ type: "hero" as const, variant, content: { heading } }],
  });
  return {
    version: 1,
    brand: { tokens, voice: { tone: "clear" } },
    meta: { businessName: "Example", contact: {}, hours: [], social: {}, locations: [] },
    nav: [{ label: "About", href: "/about" }],
    pages: [page("home", "Home", "split", "Welcome"), page("about", "About", "centered", "About us")],
  };
}

function fixture(): { model: SiteModel; rendered: RenderedSite } {
  const model = validModel();
  return { model, rendered: renderHtml(model) };
}

function withPageHtml(
  rendered: RenderedSite,
  slug: string,
  mutate: (html: string) => string,
): RenderedSite {
  return {
    ...rendered,
    pages: rendered.pages.map((page) =>
      page.slug === slug ? { slug: page.slug, html: mutate(page.html) } : page,
    ),
  };
}

function ofGate(report: ValidationReport, gate: string): Violation[] {
  return report.violations.filter((violation) => violation.gate === gate);
}

test("AC-1: an unmodified valid fixture passes every gate", () => {
  const { model, rendered } = fixture();
  assert.deepEqual(validateSite(model, rendered), { ok: true, violations: [] });
});

test("AC-2: removing the <h1> flags exactly that page", () => {
  const { model, rendered } = fixture();
  const mutated = withPageHtml(rendered, "home", (html) => html.replace("<h1>", "<h2>"));
  const direct = checkH1(mutated);
  assert.equal(direct.length, 1);
  assert.equal(direct[0].gate, "structure/h1");
  assert.equal(direct[0].page, "home");
  const report = validateSite(model, mutated);
  assert.deepEqual(report.violations, direct);
  assert.equal(report.ok, false);
});

test("structure/h1 flags a page with two headings", () => {
  const { rendered } = fixture();
  const mutated = withPageHtml(rendered, "about", (html) =>
    html.replace("</h1>", "</h1><h1>Second</h1>"),
  );
  const violations = checkH1(mutated);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].page, "about");
  assert.match(violations[0].message, /found 2/);
});

test("AC-3: missing landmarks name their page and element", () => {
  const { model, rendered } = fixture();
  const noFooter = withPageHtml(rendered, "home", (html) => html.replace("<footer", "<div"));
  const report = validateSite(model, noFooter);
  assert.equal(report.violations.length, 1);
  assert.equal(report.violations[0].gate, "structure/landmarks");
  assert.equal(report.violations[0].page, "home");
  assert.match(report.violations[0].message, /<footer/);
  const noMain = withPageHtml(rendered, "about", (html) => html.replace("<main>", "<div>"));
  const direct = checkLandmarks(noMain);
  assert.equal(direct.length, 1);
  assert.equal(direct[0].page, "about");
  assert.match(direct[0].message, /<main/);
});

test("AC-4: identical titles across pages are one site-wide violation", () => {
  const { model, rendered } = fixture();
  const mutated = withPageHtml(rendered, "about", (html) =>
    html.replace("<title>About — Example</title>", "<title>Home — Example</title>"),
  );
  const report = validateSite(model, mutated);
  assert.equal(report.violations.length, 1);
  assert.equal(report.violations[0].gate, "structure/title");
  assert.equal(report.violations[0].page, null);
  assert.match(report.violations[0].message, /"home".*"about"/);
});

test("AC-4: empty or absent meta descriptions are flagged per page", () => {
  const { rendered } = fixture();
  const empty = withPageHtml(rendered, "home", (html) =>
    html.replace('content="Home page description."', 'content=""'),
  );
  const emptyViolations = checkTitle(empty);
  assert.equal(emptyViolations.length, 1);
  assert.equal(emptyViolations[0].gate, "structure/title");
  assert.equal(emptyViolations[0].page, "home");
  const absent = withPageHtml(rendered, "about", (html) =>
    html.replace('<meta name="description" content="About page description.">', ""),
  );
  const absentViolations = checkTitle(absent);
  assert.equal(absentViolations.length, 1);
  assert.equal(absentViolations[0].page, "about");
});

test("structure/title flags descriptions duplicated across pages", () => {
  const { rendered } = fixture();
  const mutated = withPageHtml(rendered, "about", (html) =>
    html.replace('content="About page description."', 'content="Home page description."'),
  );
  const violations = checkTitle(mutated);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].page, null);
  assert.match(violations[0].message, /descriptions must be unique/);
});

test("AC-5: an internal href with no matching slug is flagged", () => {
  const { model, rendered } = fixture();
  const mutated = withPageHtml(rendered, "home", (html) =>
    html.replace("</main>", '<a href="/nope">x</a></main>'),
  );
  const report = validateSite(model, mutated);
  assert.equal(report.violations.length, 1);
  assert.equal(report.violations[0].gate, "structure/links");
  assert.equal(report.violations[0].page, "home");
  assert.match(report.violations[0].message, /"\/nope"/);
});

test("AC-5: external, fragment, mailto and fail-closed hrefs pass; assets ignored", () => {
  const { model, rendered } = fixture();
  assert.equal(checkLinks(rendered).length, 0);
  const injected =
    '<a href="https://example.com/x">e</a><a href="#faq">f</a>' +
    '<a href="mailto:a@b.c">m</a><a href="tel:+15551234">t</a><a href="#">h</a>';
  const mutated = withPageHtml(rendered, "home", (html) =>
    html.replace("</main>", `${injected}</main>`),
  );
  assert.deepEqual(validateSite(model, mutated), { ok: true, violations: [] });
});

test("AC-6: lorem ipsum and unreplaced {{…}} tokens are flagged", () => {
  const { rendered } = fixture();
  const lorem = withPageHtml(rendered, "home", (html) =>
    html.replace("</main>", "<p>Lorem ipsum dolor</p></main>"),
  );
  const loremViolations = ofGate(validateSite(validModel(), lorem), "content/placeholders");
  assert.equal(loremViolations.length, 1);
  assert.equal(loremViolations[0].page, "home");
  const token = withPageHtml(rendered, "about", (html) =>
    html.replace("</main>", "<p>{{business_name}}</p></main>"),
  );
  const tokenViolations = ofGate(validateSite(validModel(), token), "content/placeholders");
  assert.equal(tokenViolations.length, 1);
  assert.equal(tokenViolations[0].page, "about");
  assert.match(tokenViolations[0].message, /\{\{business_name\}\}/);
});

test("AC-7: images with empty or missing alt are flagged", () => {
  const { rendered } = fixture();
  const emptyAlt = withPageHtml(rendered, "home", (html) =>
    html.replace("</main>", '<img src="/x.jpg" alt=""></main>'),
  );
  const emptyViolations = checkAlt(emptyAlt);
  assert.equal(emptyViolations.length, 1);
  assert.equal(emptyViolations[0].gate, "content/alt");
  assert.equal(emptyViolations[0].page, "home");
  assert.match(emptyViolations[0].message, /empty alt/);
  const noAlt = withPageHtml(rendered, "home", (html) =>
    html.replace("</main>", '<img src="/x.jpg"></main>'),
  );
  const noAltViolations = checkAlt(noAlt);
  assert.equal(noAltViolations.length, 1);
  assert.match(noAltViolations[0].message, /no alt/);
});

test("AC-8: inline style attributes and <style> blocks are flagged", () => {
  const { model, rendered } = fixture();
  const attribute = withPageHtml(rendered, "home", (html) =>
    html.replace("</main>", '<div style="color:red">x</div></main>'),
  );
  const attributeReport = validateSite(model, attribute);
  assert.equal(attributeReport.violations.length, 1);
  assert.equal(attributeReport.violations[0].gate, "tokens/no-inline-style");
  assert.equal(attributeReport.violations[0].page, "home");
  const block = withPageHtml(rendered, "about", (html) =>
    html.replace("</head>", "<style>body{color:red}</style></head>"),
  );
  const blockReport = validateSite(model, block);
  assert.equal(blockReport.violations.length, 1);
  assert.equal(blockReport.violations[0].gate, "tokens/no-inline-style");
  assert.equal(blockReport.violations[0].page, "about");
});

test("AC-9: dropped or duplicated section instance ids are flagged", () => {
  const { model, rendered } = fixture();
  const id = sectionInstanceId("hero", "split", 0);
  const dropped = withPageHtml(rendered, "home", (html) =>
    html.replace(` data-section-instance="${id}"`, ""),
  );
  const droppedReport = validateSite(model, dropped);
  assert.equal(droppedReport.violations.length, 1);
  assert.equal(droppedReport.violations[0].gate, "sections/instance-ids");
  assert.equal(droppedReport.violations[0].page, "home");
  assert.match(droppedReport.violations[0].message, new RegExp(id));
  const doubled = withPageHtml(rendered, "home", (html) =>
    html.replace(
      `data-section-instance="${id}"`,
      `data-section-instance="${id}" data-section-instance="${id}"`,
    ),
  );
  const doubledReport = validateSite(model, doubled);
  assert.equal(doubledReport.violations.length, 1);
  assert.equal(doubledReport.violations[0].gate, "sections/instance-ids");
  assert.match(doubledReport.violations[0].message, /found 2.*expected 1/);
});

test("sections/instance-ids flags a model page with no rendered HTML", () => {
  const { model, rendered } = fixture();
  const withoutAbout: RenderedSite = {
    ...rendered,
    pages: rendered.pages.filter((page) => page.slug === "home"),
  };
  const instanceIds = ofGate(validateSite(model, withoutAbout), "sections/instance-ids");
  assert.equal(instanceIds.length, 1);
  assert.equal(instanceIds[0].page, "about");
});

test("AC-10: three broken gates return all three violations at once", () => {
  const { model, rendered } = fixture();
  let mutated = withPageHtml(rendered, "home", (html) => html.replace("<h1>", "<h2>"));
  mutated = withPageHtml(mutated, "about", (html) =>
    html.replace("</main>", '<p>lorem ipsum</p><a href="/nope">x</a></main>'),
  );
  const report = validateSite(model, mutated);
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.violations.map((violation) => violation.gate).sort(),
    ["content/placeholders", "structure/h1", "structure/links"],
  );
});

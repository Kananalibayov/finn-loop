// Shape + guard tests for lib/site-model.ts (issue #139).
//
// The model emits structured data, never markup (NORTH-STAR Invariant 1/6),
// so isSiteModel is what makes downstream validation possible at all. It must
// fail closed on any malformed input — returning false, never throwing.
//
// Run: npm test
//
// Follows the table-driven node:test + node:assert/strict shape of net.test.mts.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SECTION_TYPES,
  isSiteModel,
  type Section,
  type SiteModel,
  type DesignTokens,
  type MediaRef,
} from "./site-model.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function validTokens(): DesignTokens {
  return {
    color: {
      primary: "#2563eb",
      accent: "#22d3ee",
      bg: "#ffffff",
      surface: "#f9fafb",
      text: "#1f2937",
      muted: "#6b7280",
      border: "#e5e7eb",
    },
    font: { heading: "Inter", body: "Inter" },
    typeScale: "1.25",
    spacingUnit: "1rem",
    radius: "8px",
    shadow: "0 1px 3px rgba(0,0,0,0.1)",
    containerMax: "1200px",
  };
}

function validMedia(): MediaRef {
  return {
    kind: "stock",
    url: "https://example.com/photo.jpg",
    alt: "A sunny storefront",
    width: 1600,
    height: 900,
  };
}

function validModel(): SiteModel {
  return {
    version: 1,
    brand: {
      tokens: validTokens(),
      voice: { tone: "professional and calm" },
    },
    meta: {
      businessName: "Acme Pty Ltd",
      contact: { phone: "+1 555 0100", email: "hello@acme.test" },
      hours: [{ days: "Mon–Fri", time: "9am–5pm" }],
      social: {},
      locations: [],
    },
    nav: [{ label: "Home", href: "/" }],
    pages: [
      {
        slug: "home",
        title: "Home",
        seo: { title: "Acme — Home", description: "Welcome to Acme.", schema: [] },
        sections: [
          {
            type: "hero",
            variant: "split",
            content: {
              heading: "We build things",
              subheading: "Since 2010",
              cta: { label: "Get a quote", href: "/contact" },
            },
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// AC-3: a complete valid model is accepted
// ---------------------------------------------------------------------------

test("isSiteModel returns true for a complete valid minimal SiteModel", () => {
  assert.equal(isSiteModel(validModel()), true);
});

// ---------------------------------------------------------------------------
// AC-4: returns false WITHOUT throwing for malformed input
// ---------------------------------------------------------------------------

const MUST_REJECT: Array<[string, unknown]> = [
  ["null", null],
  ["undefined", undefined],
  ["number", 42],
  ["string", "string"],
  ["empty array", []],
  ["empty object", {}],
  ["version 2", { ...validModel(), version: 2 }],
  ["missing color token", { ...validModel(), brand: { ...validModel().brand, tokens: { ...validTokens(), color: { primary: "#000", accent: "#000", bg: "#000", surface: "#000", text: "#000", muted: "#000" /* border missing */ } } } }],
  ["bad section type", {
    ...validModel(),
    pages: [{
      ...validModel().pages[0],
      sections: [{ type: "not-a-real-section", variant: "x", content: {} }],
    }],
  }],
];

for (const [name, value] of MUST_REJECT) {
  test(`isSiteModel returns false and does not throw for ${name}`, () => {
    let result: boolean;
    assert.doesNotThrow(() => {
      result = isSiteModel(value);
    });
    assert.equal(result!, false, `${name} should be rejected`);
  });
}

// ---------------------------------------------------------------------------
// AC-5: narrowing on section.type narrows section.content
// ---------------------------------------------------------------------------

test("narrowing section.type narrows content (hero.heading round-trips)", () => {
  const section: Section = {
    type: "hero",
    variant: "split",
    content: { heading: "We build things", cta: { label: "Go", href: "/go" } },
  };
  // Typecheck proof: accessing content.heading here requires the discriminator
  // to narrow content to HeroContent. Runtime proof: the value round-trips.
  if (section.type === "hero") {
    assert.equal(section.content.heading, "We build things");
    assert.equal(section.content.cta?.label, "Go");
  } else {
    assert.fail("section.type should be hero");
  }
});

test("narrowing section.type narrows content (faq.items question round-trips)", () => {
  const section: Section = {
    type: "faq",
    variant: "accordion",
    content: {
      items: [{ question: "Do you ship?", answer: "Yes, worldwide." }],
    },
  };
  if (section.type === "faq") {
    assert.equal(section.content.items[0].question, "Do you ship?");
  } else {
    assert.fail("section.type should be faq");
  }
});

// ---------------------------------------------------------------------------
// AC-6: SECTION_TYPES matches the SectionType union exactly
// ---------------------------------------------------------------------------

test("SECTION_TYPES has exactly 14 members", () => {
  assert.equal(SECTION_TYPES.length, 14);
});

test("every SECTION_TYPES member is unique", () => {
  assert.equal(new Set(SECTION_TYPES).size, SECTION_TYPES.length);
});

test("SECTION_TYPES covers every SectionType variant the guard accepts", () => {
  // Build a model whose single section cycles through each type, and confirm
  // the guard accepts each — proving the runtime list can't silently drift
  // from the union: a SectionType not in SECTION_TYPES would be rejected.
  const base = validModel();
  const expected: Section["type"][] = [
    "hero", "services", "features", "about", "testimonials", "gallery",
    "faq", "cta", "contact", "team", "pricing", "stats", "logos", "steps",
  ];
  assert.deepEqual([...SECTION_TYPES].sort(), [...expected].sort());
  for (const t of SECTION_TYPES) {
    const model: SiteModel = {
      ...base,
      pages: [{
        ...base.pages[0],
        sections: [{ type: t, variant: "v", content: {} as never }],
      }],
    };
    assert.equal(isSiteModel(model), true, `type ${t} should be accepted`);
  }
});

// ---------------------------------------------------------------------------
// MediaRef + brand.logo path coverage
// ---------------------------------------------------------------------------

test("isSiteModel accepts an optional brand.logo MediaRef", () => {
  const model = validModel();
  model.brand.logo = validMedia();
  assert.equal(isSiteModel(model), true);
});

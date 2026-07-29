import assert from "node:assert/strict";
import { test } from "node:test";
import { getRenderer, listVariants, sectionInstanceId } from "../registry.ts";
import { teamGrid } from "./grid.ts";
import { teamRows } from "./rows.ts";
import type { DesignTokens, TeamContent } from "../../site-model.ts";

const tokens: DesignTokens = {
  color: {
    primary: "#123456",
    accent: "#abcdef",
    bg: "#ffffff",
    surface: "#f5f5f5",
    text: "#111111",
    muted: "#666666",
    border: "#dddddd",
  },
  font: { heading: "Inter", body: "Arial" },
  typeScale: "1.25",
  spacingUnit: "0.5rem",
  radius: "0.25rem",
  shadow: "0 1px 2px rgb(0 0 0 / 0.1)",
  containerMax: "70rem",
};
const context = { tokens, instanceId: "team-grid-v1-0" };

const content: TeamContent = {
  heading: "Our team",
  members: [
    { name: "Alice", role: "Lead", bio: "Builds things.", photo: { kind: "upload", url: "/alice.png", alt: "Alice", width: 200, height: 200 } },
    { name: "Bob", role: "Eng" },
    { name: "Cara", bio: "Designs." },
  ],
};

// AC-1, AC-2, AC-3: registry contract.
test("team renderers are registered with exact variants", () => {
  for (const variant of ["grid", "rows"] as const) {
    const renderer = getRenderer("team", variant);
    assert.equal(renderer?.type, "team");
    assert.equal(renderer?.variant, variant);
  }
  assert.equal(getRenderer("team", "nope"), null);
  assert.deepEqual(listVariants("team").sort(), ["grid", "rows"]);
});

// AC-4: each variant carries its section-instance id exactly once.
test("each team variant renders its section instance exactly once", () => {
  for (const variant of ["grid", "rows"] as const) {
    const renderer = getRenderer("team", variant)!;
    const html = renderer.html(content, {
      tokens,
      instanceId: sectionInstanceId("team", variant, 0),
    });
    assert.equal(
      (html.match(/data-section-instance="team-grid-v1-0"/g) ?? []).length,
      variant === "grid" ? 1 : 0,
    );
    assert.equal(
      (html.match(/data-section-instance="team-rows-v1-0"/g) ?? []).length,
      variant === "rows" ? 1 : 0,
    );
    assert.equal((html.match(/data-section-instance=/g) ?? []).length, 1);
  }
});

// AC-5: hostile content is escaped, no <script survives.
test("team escapes untrusted member text", () => {
  const hostile: TeamContent = {
    members: [{ name: 'Tom & "Jerry" <script>alert(1)</script>' }],
  };
  for (const variant of ["grid", "rows"] as const) {
    const html = getRenderer("team", variant)!.html(hostile, context);
    assert.ok(!html.includes("<script"), `${variant} leaked <script`);
    assert.ok(html.includes("&amp;"), `${variant} missing &amp;`);
    assert.ok(html.includes("&lt;"), `${variant} missing &lt;`);
    assert.ok(html.includes("&quot;"), `${variant} missing &quot;`);
  }
});

// AC-6: colors derive from tokens, not hardcoded.
test("team output derives colors from the supplied token set", () => {
  const first = teamGrid.html(content, context);
  const second = teamGrid.html(content, {
    tokens: { ...tokens, color: { ...tokens.color, primary: "#abcdef" } },
    instanceId: context.instanceId,
  });
  assert.ok(first.includes("#123456"));
  assert.ok(second.includes("#abcdef"));
  assert.ok(!second.includes("#123456"));
  const rowsFirst = teamRows.html(content, context);
  assert.ok(rowsFirst.includes("#123456"));
});

// AC-8: empty members list produces no orphaned <ul></ul> and no <img>.
test("empty members list renders a valid section with no orphaned list markup", () => {
  for (const variant of ["grid", "rows"] as const) {
    const html = getRenderer("team", variant)!.html({ members: [] }, context);
    assert.ok(!html.includes("<ul></ul>"), `${variant} produced <ul></ul>`);
    assert.equal((html.match(/<img/g) ?? []).length, 0);
    assert.ok(html.includes("<section"));
  }
});

// AC-9: three members produce three member blocks; img count equals members with photos.
test("member block count and photo count match content", () => {
  for (const variant of ["grid", "rows"] as const) {
    const html = getRenderer("team", variant)!.html(content, context);
    assert.equal((html.match(/class="team-[^"]*__member"/g) ?? []).length, 3);
    assert.equal((html.match(/<img/g) ?? []).length, 1);
  }
});

// AC-9 (cont.): a member with no photo produces no <img for that member.
test("a member without a photo produces no img", () => {
  const noPhoto: TeamContent = { members: [{ name: "Solo" }, { name: "Duo" }] };
  for (const variant of ["grid", "rows"] as const) {
    const html = getRenderer("team", variant)!.html(noPhoto, context);
    assert.equal((html.match(/<img/g) ?? []).length, 0);
  }
});

// AC-10: a javascript: photo url does not survive.
test("javascript photo url is neutralized to #", () => {
  const xss: TeamContent = {
    members: [{ name: "X", photo: { kind: "upload", url: "javascript:alert(1)", alt: "x" } }],
  };
  for (const variant of ["grid", "rows"] as const) {
    const html = getRenderer("team", variant)!.html(xss, context);
    assert.ok(!/src="javascript:/i.test(html), `${variant} leaked javascript: src`);
    assert.ok(html.includes('src="#"'));
  }
});

// AC-11: registering team does not disturb existing types.
test("team registration preserves hero and services variants", () => {
  assert.deepEqual(listVariants("hero").sort(), ["centered", "split"]);
  assert.deepEqual(listVariants("services").sort(), ["grid", "list"]);
});

// Layout distinction (Step 2: grid vs rows are genuinely different).
test("grid and rows remain distinct layouts", () => {
  const grid = getRenderer("team", "grid")!.html(content, {
    tokens,
    instanceId: sectionInstanceId("team", "grid", 0),
  });
  const rows = getRenderer("team", "rows")!.html(content, {
    tokens,
    instanceId: sectionInstanceId("team", "rows", 0),
  });
  assert.ok(grid.includes("team-grid"));
  assert.ok(rows.includes("team-rows"));
  assert.ok(!grid.includes("team-rows"), "grid leaked rows class");
  assert.ok(!rows.includes("team-grid"), "rows leaked grid class");
});

// Optional content is omitted cleanly.
test("optional heading, role and bio are omitted when absent", () => {
  const minimal: TeamContent = { members: [{ name: "Only name" }] };
  for (const variant of ["grid", "rows"] as const) {
    const html = getRenderer("team", variant)!.html(minimal, context);
    assert.ok(!html.includes("<h2"), `${variant} rendered an unrequested heading`);
    assert.ok(!html.includes("__role"), `${variant} rendered an empty role`);
    assert.ok(!html.includes("__bio"), `${variant} rendered an empty bio`);
    assert.ok(!html.includes("<p></p>"));
  }
});

// Heading renders only when present.
test("optional heading renders when present", () => {
  for (const variant of ["grid", "rows"] as const) {
    const html = getRenderer("team", variant)!.html(content, context);
    assert.ok(html.includes("Our team"));
    assert.equal((html.match(/<h2/g) ?? []).length, 1);
  }
});

// Photo dimensions emit width/height only when both are present.
test("photo width and height emit only when both are present", () => {
  const both: TeamContent = {
    members: [{ name: "A", photo: { kind: "upload", url: "/a.png", alt: "a", width: 100, height: 100 } }],
  };
  const one: TeamContent = {
    members: [{ name: "B", photo: { kind: "upload", url: "/b.png", alt: "b", width: 100 } }],
  };
  for (const variant of ["grid", "rows"] as const) {
    const htmlBoth = getRenderer("team", variant)!.html(both, context);
    assert.ok(htmlBoth.includes('width="100"') && htmlBoth.includes('height="100"'));
    const htmlOne = getRenderer("team", variant)!.html(one, context);
    assert.ok(!htmlOne.includes('height='));
  }
});

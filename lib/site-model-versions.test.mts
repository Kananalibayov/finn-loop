import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { SiteModel } from "./site-model.ts";

// Phase 0.9 (#235): versioned SiteModel storage. DATABASE_FILE is set before
// the dynamic import because lib/db.ts resolves the file path at module load;
// each test file runs in its own process, so the module cache cannot leak a
// previous import's path.
//
// The temp dir is intentionally NOT deleted: the module keeps a process-local
// singleton handle open (by design, lib/db.ts has no close), and Windows
// refuses to remove a directory containing an open SQLite file. The OS temp
// cleaner owns it after the test process exits.
const dir = mkdtempSync(join(tmpdir(), "finn-smv-"));
process.env.DATABASE_FILE = join(dir, "app.db");
const {
  insertProject,
  getProject,
  insertSiteModelVersion,
  listSiteModelVersions,
  getSiteModelVersion,
  getHeadSiteModel,
} = await import("./db.ts");

// Minimal model shape proven against validateSite in section-css.test.mts.
function makeModel(heading: string): SiteModel {
  return {
    version: 1,
    brand: {
      tokens: {
        color: { primary: "#0f5cc0", accent: "#e8a13a", bg: "#ffffff", surface: "#f4f6f8", text: "#17202a", muted: "#5d6b7a", border: "#d8dee5" },
        font: { heading: "Inter", body: "Arial" },
        typeScale: "1.25", spacingUnit: "8px", radius: "6px", shadow: "0 1px 3px #0002", containerMax: "1100px",
      },
      voice: { tone: "clear" },
    },
    meta: { businessName: "Versioned", contact: {}, hours: [], social: {}, locations: [] },
    nav: [{ label: "Home", href: "/" }],
    pages: [
      {
        slug: "home",
        title: "Home",
        seo: { title: "Home — Versioned", description: "Versioned home page.", schema: [] },
        sections: [{ type: "hero", variant: "split", content: { heading } }],
      },
    ],
  };
}

function newProject(): number {
  return insertProject({
    businessName: "Versioned",
    tagline: "t",
    themeId: "default",
    mode: "test",
    inputJson: "{}",
    pagesJson: "{}",
  });
}

test("AC-1: sequential inserts number 1,2, move the head pointer, and leave version 1 immutable", () => {
  const projectId = newProject();
  const v1 = insertSiteModelVersion(projectId, makeModel("First"), "generator");
  const v2 = insertSiteModelVersion(projectId, makeModel("Second"), "change-request");
  assert.equal(v1.version_number, 1);
  assert.equal(v2.version_number, 2);
  assert.equal(getProject(projectId)?.head_version_id, v2.id);
  const reread = getSiteModelVersion(v1.id);
  assert.equal(reread?.version_number, 1);
  assert.equal((reread?.model.pages[0]?.sections[0]?.content as { heading: string }).heading, "First");
});

test("AC-2: an invalid model throws and persists nothing", () => {
  const projectId = newProject();
  assert.throws(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately invalid input
    () => insertSiteModelVersion(projectId, {} as any, "generator"),
    /isSiteModel/,
  );
  assert.equal(listSiteModelVersions(projectId).length, 0);
  assert.equal(getProject(projectId)?.head_version_id, null);
});

test("AC-3: a nonexistent project_id throws a foreign-key error", () => {
  assert.throws(
    () => insertSiteModelVersion(999999, makeModel("Orphan"), "generator"),
    /FOREIGN KEY/i,
  );
});

test("AC-4: list returns metadata newest-first with no model_json key", () => {
  const projectId = newProject();
  insertSiteModelVersion(projectId, makeModel("One"), "generator");
  insertSiteModelVersion(projectId, makeModel("Two"), "operator");
  const list = listSiteModelVersions(projectId);
  assert.equal(list.length, 2);
  assert.deepEqual(
    list.map((v) => v.version_number),
    [2, 1],
  );
  for (const row of list) {
    assert.deepEqual(Object.keys(row).sort(), ["created_at", "id", "project_id", "source", "version_number"]);
    assert.equal("model_json" in row, false);
  }
});

test("AC-5: getHeadSiteModel returns the head version's model deep-equal", () => {
  const projectId = newProject();
  insertSiteModelVersion(projectId, makeModel("Old"), "generator");
  const second = makeModel("Current");
  const v2 = insertSiteModelVersion(projectId, second, "demo");
  const head = getHeadSiteModel(projectId);
  assert.equal(head?.id, v2.id);
  assert.equal(head?.source, "demo");
  assert.deepEqual(head?.model, second);
});

test("getHeadSiteModel returns null for a legacy project with no versions", () => {
  const projectId = newProject();
  assert.equal(getHeadSiteModel(projectId), null);
});

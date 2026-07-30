import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// Phase 0.9 (#231): the app's own open path must run WAL with a busy timeout.
// DATABASE_FILE is set before the dynamic import because lib/db.ts resolves
// the file path at module load; each test file runs in its own process, so the
// module cache cannot leak a previous import's path.
test("the app-opened db handle runs WAL with a busy timeout", async () => {
  // The temp dir is intentionally NOT deleted: the module keeps a process-local
  // singleton handle open (by design, lib/db.ts has no close), and Windows
  // refuses to remove a directory containing an open SQLite file. The OS temp
  // cleaner owns it after the test process exits.
  const dir = mkdtempSync(join(tmpdir(), "finn-wal-"));
  process.env.DATABASE_FILE = join(dir, "app.db");
  const { getDbPragmas, listProjects } = await import("./db.ts");
  // Force the lazy open through a real accessor, then read the pragmas off
  // the same handle the app uses.
  listProjects();
  const pragmas = getDbPragmas();
  assert.equal(pragmas.journalMode, "wal");
  assert.equal(pragmas.busyTimeout, 5000);
  delete process.env.DATABASE_FILE;
});

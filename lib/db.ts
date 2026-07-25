// AC-1, AC-2, AC-7: SQLite persistence via better-sqlite3.
// The DB file is auto-created on first run; the schema via CREATE TABLE IF
// NOT EXISTS (NG-4: no migrations framework). The DB is only touched at
// runtime — never at build time (AC-8). Connection is lazily cached per
// process so dev hot-reload doesn't leak handles.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface ProjectRow {
  id: number;
  business_name: string;
  tagline: string;
  theme_id: string;
  mode: string;
  input_json: string;
  pages_json: string;
  created_at: string;
  /** AC-1 (issue #16): groups a project with its regenerated versions. */
  site_group_id: string;
}

/** AC-7: configurable via DATABASE_FILE env, default data/app.db. */
const DB_FILE = resolve(process.env.DATABASE_FILE ?? "data/app.db");

let dbInstance: Database.Database | null = null;

/**
 * Returns the process-wide DB connection, creating the file + schema on first
 * use. Lazy (not module-load-time) so importing this module during `next build`
 * never touches the filesystem — required by AC-8.
 */
function db(): Database.Database {
  if (dbInstance) return dbInstance;
  // Ensure the parent directory exists so better-sqlite3 can create the file.
  mkdirSync(dirname(DB_FILE), { recursive: true });
  const conn = new Database(DB_FILE);
  // AC-2: sites table. IF NOT EXISTS so re-runs are idempotent (NG-4).
  // AC-1 (issue #16): site_group_id groups a site with its regenerated versions.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      theme_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      input_json TEXT NOT NULL,
      pages_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      site_group_id TEXT
    );
  `);
  // AC-1 (issue #16): guarded ALTER for existing DBs that predate site_group_id.
  // Check PRAGMA table_info rather than relying on ALTER to fail; idempotent.
  const cols = conn.prepare(`PRAGMA table_info(sites)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "site_group_id")) {
    conn.exec(`ALTER TABLE sites ADD COLUMN site_group_id TEXT;`);
    // Backfill existing rows: each forms a singleton group keyed by its own id.
    conn.exec(`UPDATE sites SET site_group_id = CAST(id AS TEXT) WHERE site_group_id IS NULL;`);
  }
  dbInstance = conn;
  return conn;
}

/** AC-3: insert a generated project, returns its new id.
 *  AC-3 (issue #16): a fresh generation starts its own group — site_group_id
 *  is set to the new row's own id after INSERT (the id is auto-generated). */
export function insertProject(input: {
  businessName: string;
  tagline: string;
  themeId: string;
  mode: string;
  inputJson: string;
  pagesJson: string;
}): number {
  const conn = db();
  const stmt = conn.prepare(
    `INSERT INTO sites (business_name, tagline, theme_id, mode, input_json, pages_json, created_at)
     VALUES (@businessName, @tagline, @themeId, @mode, @inputJson, @pagesJson, @createdAt)`,
  );
  const now = new Date().toISOString();
  const info = stmt.run({
    businessName: input.businessName,
    tagline: input.tagline,
    themeId: input.themeId,
    mode: input.mode,
    inputJson: input.inputJson,
    pagesJson: input.pagesJson,
    createdAt: now,
  });
  const newId = Number(info.lastInsertRowid);
  // Each new top-level generation starts its own group (group id = own id).
  conn.prepare(`UPDATE sites SET site_group_id = ? WHERE id = ?`).run(
    String(newId),
    newId,
  );
  return newId;
}

/** AC-2 (issue #16): insert a regenerated version into an existing group.
 *  The new row shares the original's site_group_id but gets a fresh id +
 *  created_at; the original row is preserved unchanged. Returns the new id. */
export function regenerateProject(
  groupId: string,
  input: {
    businessName: string;
    tagline: string;
    themeId: string;
    mode: string;
    inputJson: string;
    pagesJson: string;
  },
): number {
  const stmt = db().prepare(
    `INSERT INTO sites (business_name, tagline, theme_id, mode, input_json, pages_json, created_at, site_group_id)
     VALUES (@businessName, @tagline, @themeId, @mode, @inputJson, @pagesJson, @createdAt, @groupId)`,
  );
  const now = new Date().toISOString();
  const info = stmt.run({
    businessName: input.businessName,
    tagline: input.tagline,
    themeId: input.themeId,
    mode: input.mode,
    inputJson: input.inputJson,
    pagesJson: input.pagesJson,
    createdAt: now,
    groupId,
  });
  return Number(info.lastInsertRowid);
}

/** AC-4: list saved projects newest-first (projection only — no heavy pages JSON). */
export function listProjects(): Array<
  Pick<ProjectRow, "id" | "business_name" | "theme_id" | "created_at">
> {
  const stmt = db().prepare(
    `SELECT id, business_name, theme_id, created_at FROM sites ORDER BY id DESC`,
  );
  return stmt.all() as Array<
    Pick<ProjectRow, "id" | "business_name" | "theme_id" | "created_at">
  >;
}

/** AC-5: fetch the full project (input + pages) for re-rendering. */
export function getProject(id: number): ProjectRow | undefined {
  const stmt = db().prepare(`SELECT * FROM sites WHERE id = ?`);
  return stmt.get(id) as ProjectRow | undefined;
}

/** AC-6: remove a saved project. Returns true if a row was actually deleted. */
export function deleteProject(id: number): boolean {
  const stmt = db().prepare(`DELETE FROM sites WHERE id = ?`);
  const info = stmt.run(id);
  return info.changes > 0;
}

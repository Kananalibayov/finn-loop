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
  /** AC-4 (issue #30): JSON map of page keys → WP page IDs (null if not pushed). */
  wp_page_ids: string | null;
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
      site_group_id TEXT,
      wp_page_ids TEXT
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
  // AC-4 (issue #30): guarded ALTER for wp_page_ids (WP page IDs after push).
  if (!cols.some((c) => c.name === "wp_page_ids")) {
    conn.exec(`ALTER TABLE sites ADD COLUMN wp_page_ids TEXT;`);
  }
  // AC-1 (issue #24): wp_settings — single-row table for WP connection creds.
  // id is always 1 (enforced by the helpers). Password stored as plaintext
  // (NG-1: single-operator tool on a Docker volume; encryption deferred).
  conn.exec(`
    CREATE TABLE IF NOT EXISTS wp_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      api_url TEXT NOT NULL,
      username TEXT NOT NULL,
      app_password TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  // AC-1 (issue #32): wp_connections — multi-row table for per-client WP sites.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS wp_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      api_url TEXT NOT NULL,
      username TEXT NOT NULL,
      app_password TEXT NOT NULL,
      pairing_code TEXT,
      created_at TEXT NOT NULL
    );
  `);
  // AC-1 (issue #34): wp_pairing_codes — one-time codes for plugin auto-connect.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS wp_pairing_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      connection_id INTEGER,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
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

/** AC-4: list saved projects newest-first (projection only — no heavy pages JSON).
 *  AC-1 (issue #38): extended to surface status data already in the table for
 *  the dashboard card grid — tagline, mode, WP-push state (wp_page_ids), and
 *  group_size (count of regenerated versions sharing site_group_id). No new
 *  columns; purely a richer SELECT + return type. */
export function listProjects(): Array<{
  id: number;
  business_name: string;
  tagline: string;
  theme_id: string;
  mode: string;
  created_at: string;
  wp_page_ids: string | null;
  group_size: number;
}> {
  const stmt = db().prepare(
    `SELECT
       s.id, s.business_name, s.tagline, s.theme_id, s.mode, s.created_at, s.wp_page_ids,
       (SELECT COUNT(*) FROM sites s2 WHERE s2.site_group_id = s.site_group_id) AS group_size
     FROM sites s
     ORDER BY s.id DESC`,
  );
  return stmt.all() as Array<{
    id: number;
    business_name: string;
    tagline: string;
    theme_id: string;
    mode: string;
    created_at: string;
    wp_page_ids: string | null;
    group_size: number;
  }>;
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

// --- WordPress settings (issue #24) ---

/** AC-1: row shape for the wp_settings table (single row, id always 1). */
export interface WpSettingsRow {
  id: number;
  api_url: string;
  username: string;
  app_password: string;
  updated_at: string;
}

/** AC-2: return the single WP settings row, or null if none saved yet. */
export function getWpSettings(): WpSettingsRow | null {
  const row = db().prepare(`SELECT * FROM wp_settings WHERE id = 1`).get();
  return (row as WpSettingsRow | undefined) ?? null;
}

/** AC-2: upsert the single WP settings row (id always 1). Returns the stored row. */
export function saveWpSettings(input: {
  apiUrl: string;
  username: string;
  appPassword: string;
}): WpSettingsRow {
  const conn = db();
  const now = new Date().toISOString();
  // UPSERT via ON CONFLICT — the id=1 row is created if missing, updated otherwise.
  conn.prepare(
    `INSERT INTO wp_settings (id, api_url, username, app_password, updated_at)
     VALUES (1, @apiUrl, @username, @appPassword, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       api_url = excluded.api_url,
       username = excluded.username,
       app_password = excluded.app_password,
       updated_at = excluded.updated_at`,
  ).run({
    apiUrl: input.apiUrl,
    username: input.username,
    appPassword: input.appPassword,
    updatedAt: now,
  });
  return getWpSettings()!;
}

// --- WP push tracking (issue #30) ---

/** AC-4: store the WP page IDs (JSON map) for a project after pushing. */
export function updateProjectWpPageIds(
  projectId: number,
  wpPageIds: Record<string, number>,
): void {
  db()
    .prepare(`UPDATE sites SET wp_page_ids = ? WHERE id = ?`)
    .run(JSON.stringify(wpPageIds), projectId);
}

// --- WP pairing codes (issue #34: plugin auto-connect) ---

/** AC-2: generate a random pairing code in format XXXX-XXXX-XXXX. */
function generatePairingCodeString(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars (0/O, 1/I)
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${segment()}-${segment()}-${segment()}`;
}

/** Row shape for wp_pairing_codes. */
export interface PairingCodeRow {
  id: number;
  code: string;
  label: string;
  used: number;
  connection_id: number | null;
  created_at: string;
  expires_at: string;
}

/** AC-2: create a new pairing code. Returns the row (with the code). */
export function createPairingCode(label: string): PairingCodeRow {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  const code = generatePairingCodeString();
  const info = db()
    .prepare(
      `INSERT INTO wp_pairing_codes (code, label, used, created_at, expires_at)
       VALUES (@code, @label, 0, @createdAt, @expiresAt)`,
    )
    .run({
      code,
      label,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  return getPairingCodeById(Number(info.lastInsertRowid))!;
}

/** AC-2: get a pairing code by ID. */
export function getPairingCodeById(id: number): PairingCodeRow | null {
  const row = db().prepare(`SELECT * FROM wp_pairing_codes WHERE id = ?`).get(id);
  return (row as PairingCodeRow | undefined) ?? null;
}

/** AC-2: get a pairing code by the code string. */
export function getPairingCode(code: string): PairingCodeRow | null {
  const row = db()
    .prepare(`SELECT * FROM wp_pairing_codes WHERE code = ?`)
    .get(code);
  return (row as PairingCodeRow | undefined) ?? null;
}

/** AC-2: list all pairing codes (for the UI). */
export function listPairingCodes(): PairingCodeRow[] {
  return db()
    .prepare(`SELECT * FROM wp_pairing_codes ORDER BY id DESC`)
    .all() as PairingCodeRow[];
}

/** AC-2: consume a pairing code (mark as used + link to connection).
 *  Returns the row if valid (unused + not expired), null otherwise. */
export function consumePairingCode(code: string): PairingCodeRow | null {
  // Race-free consume: single conditional UPDATE + check row count.
  // SQLite serializes writes under one connection, so two concurrent requests
  // with the same code can't both pass this — one UPDATE succeeds (changes=1),
  // the other finds used=1 already and gets changes=0.
  const info = db()
    .prepare(
      `UPDATE wp_pairing_codes
       SET used = 1
       WHERE code = ? AND used = 0 AND expires_at > ?`,
    )
    .run(code, new Date().toISOString());
  if (info.changes === 0) return null; // already used, expired, or nonexistent
  return getPairingCode(code);
}

/** AC-4 step 4: link a pairing code to a connection after registration. */
export function linkPairingCode(code: string, connectionId: number): void {
  db()
    .prepare(`UPDATE wp_pairing_codes SET connection_id = ? WHERE code = ?`)
    .run(connectionId, code);
}

// --- WP connections (issue #32: multi-client support) ---

/** Row shape for the wp_connections table. */
export interface WpConnectionRow {
  id: number;
  label: string;
  api_url: string;
  username: string;
  app_password: string;
  pairing_code: string | null;
  created_at: string;
}

/** AC-2 (#32): list all WP connections, newest-first.
 *  AC-1 (#40): extended to surface each connection's origin — whether it was
 *  auto-created by the plugin consuming a pairing code (recoverable via the
 *  wp_pairing_codes join on connection_id). No new columns; purely a richer
 *  SELECT + return type. */
export function listWpConnections(): Array<WpConnectionRow & { paired_via_code: number }> {
  return db()
    .prepare(
      `SELECT
         c.*,
         (SELECT COUNT(*) FROM wp_pairing_codes p
          WHERE p.connection_id = c.id AND p.used = 1) AS paired_via_code
       FROM wp_connections c
       ORDER BY c.id DESC`,
    )
    .all() as Array<WpConnectionRow & { paired_via_code: number }>;
}

/** AC-2 (#32): get one WP connection by ID, or null. */
export function getWpConnection(id: number): WpConnectionRow | null {
  const row = db()
    .prepare(`SELECT * FROM wp_connections WHERE id = ?`)
    .get(id);
  return (row as WpConnectionRow | undefined) ?? null;
}

/** AC-2 (#32): add a new WP connection. Returns the stored row. */
export function addWpConnection(input: {
  label: string;
  apiUrl: string;
  username: string;
  appPassword: string;
}): WpConnectionRow {
  const now = new Date().toISOString();
  const info = db()
    .prepare(
      `INSERT INTO wp_connections (label, api_url, username, app_password, created_at)
       VALUES (@label, @apiUrl, @username, @appPassword, @createdAt)`,
    )
    .run({
      label: input.label,
      apiUrl: input.apiUrl,
      username: input.username,
      appPassword: input.appPassword,
      createdAt: now,
    });
  return getWpConnection(Number(info.lastInsertRowid))!;
}

/** AC-2 (#32): delete a WP connection. */
export function deleteWpConnection(id: number): boolean {
  const info = db().prepare(`DELETE FROM wp_connections WHERE id = ?`).run(id);
  return info.changes > 0;
}


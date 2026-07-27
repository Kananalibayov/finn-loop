// AC-1, AC-2, AC-7: SQLite persistence via better-sqlite3.
// The DB file is auto-created on first run; the schema via CREATE TABLE IF
// NOT EXISTS (NG-4: no migrations framework). The DB is only touched at
// runtime — never at build time (AC-8). Connection is lazily cached per
// process so dev hot-reload doesn't leak handles.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { BUILTIN_TEMPLATES } from "@/lib/builtin-templates";

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
  /** AC-1 (issue #44): linked wp_connections row id (null = unlinked, falls
   *  back to legacy wp_settings on push). */
  wp_connection_id: number | null;
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
  // AC-1 (issue #44): guarded ALTER for wp_connection_id (links a project to a
  // specific wp_connections row; null = unlinked, push falls back to legacy
  // wp_settings). Idempotent — re-runs are no-ops; existing rows stay null.
  if (!cols.some((c) => c.name === "wp_connection_id")) {
    conn.exec(`ALTER TABLE sites ADD COLUMN wp_connection_id INTEGER;`);
  }
  // AC-1 (issue #62): guarded ALTERs for health-reporting columns on
  // wp_connections. Idempotent — checks PRAGMA table_info each time.
  const connCols = conn.prepare(`PRAGMA table_info(wp_connections)`).all() as Array<{ name: string }>;
  if (!connCols.some((c) => c.name === "wp_version")) {
    conn.exec(`ALTER TABLE wp_connections ADD COLUMN wp_version TEXT;`);
  }
  if (!connCols.some((c) => c.name === "theme_name")) {
    conn.exec(`ALTER TABLE wp_connections ADD COLUMN theme_name TEXT;`);
  }
  if (!connCols.some((c) => c.name === "plugin_count")) {
    conn.exec(`ALTER TABLE wp_connections ADD COLUMN plugin_count INTEGER;`);
  }
  if (!connCols.some((c) => c.name === "health_score")) {
    conn.exec(`ALTER TABLE wp_connections ADD COLUMN health_score INTEGER;`);
  }
  if (!connCols.some((c) => c.name === "health_reported_at")) {
    conn.exec(`ALTER TABLE wp_connections ADD COLUMN health_reported_at TEXT;`);
  }
  if (!connCols.some((c) => c.name === "health_secret")) {
    conn.exec(`ALTER TABLE wp_connections ADD COLUMN health_secret TEXT;`);
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
  // AC-1 (issue #46): app_settings — single-row table (id always 1) holding
  // app-level overrides for the OpenAI key, generation model, and admin
  // password hash. Empty string = "no override, fall back to env". This is
  // the same single-row idempotent pattern as wp_settings.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      openai_api_key TEXT NOT NULL DEFAULT '',
      generation_model TEXT NOT NULL DEFAULT '',
      admin_password_hash TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
  `);
  // AC-1 (issue #51): templates — the template library. Hybrid model:
  // spec_json holds the design spec (CSS vars + voice), pages_json holds
  // optional frozen HTML (Record<PageKey, html>); either or both may be set.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      spec_json TEXT NOT NULL,
      pages_json TEXT,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  // AC-1 (issue #61): wp_login_tokens — single-use, short-lived tokens for the
  // SSO auto-login handshake. Each token is connection-scoped + consumed on
  // first validation. The plugin validates a token by calling the platform
  // back; the platform marks it used here (atomic conditional UPDATE).
  conn.exec(`
    CREATE TABLE IF NOT EXISTS wp_login_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
  // AC-1 (issue #68): clients — client accounts for the client portal.
  conn.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  // AC-2 (issue #68): guarded ALTER — link sites to a client (nullable).
  const sitesCols = conn.prepare(`PRAGMA table_info(sites)`).all() as Array<{ name: string }>;
  if (!sitesCols.some((c) => c.name === "client_id")) {
    conn.exec(`ALTER TABLE sites ADD COLUMN client_id INTEGER;`);
  }
  // AC-2 (issue #51): seed built-in starter templates (idempotent — only
  // inserts builtins whose name isn't already present).
  seedBuiltinTemplates(conn);
  dbInstance = conn;
  return conn;
}

/** AC-2 (issue #51): idempotently insert the built-in starter templates.
 *  Called from db() after the schema is created. Safe to re-run. */
function seedBuiltinTemplates(conn: Database.Database): void {
  const existing = conn
    .prepare(`SELECT name FROM templates WHERE source = 'builtin'`)
    .all() as Array<{ name: string }>;
  const have = new Set(existing.map((r) => r.name));
  const now = new Date().toISOString();
  const stmt = conn.prepare(
    `INSERT INTO templates (name, description, category, spec_json, pages_json, source, created_at)
     VALUES (@name, @description, @category, @spec_json, @pages_json, 'builtin', @created_at)`,
  );
  for (const t of BUILTIN_TEMPLATES) {
    if (have.has(t.name)) continue;
    stmt.run({
      name: t.name,
      description: t.description,
      category: t.category,
      spec_json: t.specJson,
      pages_json: t.pagesJson,
      created_at: now,
    });
  }
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

/** AC-2 (issue #44): link/unlink a project to a wp_connections row.
 *  Pass null to unlink (push falls back to legacy wp_settings). */
export function updateProjectConnectionId(
  projectId: number,
  connectionId: number | null,
): void {
  db()
    .prepare(`UPDATE sites SET wp_connection_id = ? WHERE id = ?`)
    .run(connectionId, projectId);
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
  /** AC-1 (issue #62): health-reporting fields (null until first report). */
  wp_version: string | null;
  theme_name: string | null;
  plugin_count: number | null;
  health_score: number | null;
  health_reported_at: string | null;
  health_secret: string | null;
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
  /** AC-2 (issue #62): optional health secret for plugin-paired connections. */
  healthSecret?: string;
}): WpConnectionRow {
  const now = new Date().toISOString();
  const info = db()
    .prepare(
      `INSERT INTO wp_connections (label, api_url, username, app_password, created_at, health_secret)
       VALUES (@label, @apiUrl, @username, @appPassword, @createdAt, @healthSecret)`,
    )
    .run({
      label: input.label,
      apiUrl: input.apiUrl,
      username: input.username,
      appPassword: input.appPassword,
      createdAt: now,
      healthSecret: input.healthSecret ?? null,
    });
  return getWpConnection(Number(info.lastInsertRowid))!;
}

/** AC-2 (#32): delete a WP connection. */
export function deleteWpConnection(id: number): boolean {
  const info = db().prepare(`DELETE FROM wp_connections WHERE id = ?`).run(id);
  return info.changes > 0;
}

// --- App-level settings (issue #46: OpenAI key, model, admin password) ---

/** AC-1 (issue #46): row shape for app_settings (single row, id always 1). */
export interface AppSettingsRow {
  id: number;
  openai_api_key: string;
  generation_model: string;
  admin_password_hash: string;
  updated_at: string;
}

/** AC-2 (issue #46): return the single app_settings row, or null if absent.
 *  Callers should treat null as "all defaults, use env". */
export function getAppSettings(): AppSettingsRow | null {
  const row = db().prepare(`SELECT * FROM app_settings WHERE id = 1`).get();
  return (row as AppSettingsRow | undefined) ?? null;
}

/** AC-2 (issue #46): partial UPSERT of the app_settings row (id always 1).
 *  Only the provided fields are updated; empty string means "clear override".
 *  Returns the full row after save. */
export function saveAppSettings(input: {
  openaiApiKey?: string;
  generationModel?: string;
  adminPasswordHash?: string;
}): AppSettingsRow {
  const conn = db();
  const now = new Date().toISOString();
  // Coalesce to current-or-empty so omitted fields don't clobber existing values.
  const current = getAppSettings() ?? {
    openai_api_key: "",
    generation_model: "",
    admin_password_hash: "",
  };
  const openai_api_key = input.openaiApiKey ?? current.openai_api_key;
  const generation_model = input.generationModel ?? current.generation_model;
  const admin_password_hash = input.adminPasswordHash ?? current.admin_password_hash;
  conn
    .prepare(
      `INSERT INTO app_settings (id, openai_api_key, generation_model, admin_password_hash, updated_at)
       VALUES (1, @openai_api_key, @generation_model, @admin_password_hash, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
         openai_api_key = excluded.openai_api_key,
         generation_model = excluded.generation_model,
         admin_password_hash = excluded.admin_password_hash,
         updated_at = excluded.updated_at`,
    )
    .run({
      openai_api_key,
      generation_model,
      admin_password_hash,
      updated_at: now,
    });
  return getAppSettings()!;
}

/** AC-3 (issue #46): the effective OpenAI key — DB override if set, else env.
 *  Returns empty string if neither is configured. */
export function getEffectiveOpenAiKey(): string {
  const dbKey = getAppSettings()?.openai_api_key ?? "";
  if (dbKey) return dbKey;
  return process.env.OPENAI_API_KEY ?? "";
}

/** AC-3 (issue #46): the effective generation model — DB override if set,
 *  else the env value, else the hardcoded default gpt-4o-mini. */
export function getEffectiveGenerationModel(): string {
  const dbModel = getAppSettings()?.generation_model ?? "";
  if (dbModel) return dbModel;
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

// --- Templates (issue #51: template library) ---

/** AC-1 (issue #51): row shape for the templates table. */
export interface TemplateRow {
  id: number;
  name: string;
  description: string;
  category: string;
  spec_json: string;
  pages_json: string | null;
  source: string;
  created_at: string;
}

/** AC-1: list all templates newest-first. */
export function listTemplates(): TemplateRow[] {
  return db()
    .prepare(`SELECT * FROM templates ORDER BY id DESC`)
    .all() as TemplateRow[];
}

/** AC-1: get one template by id, or null. */
export function getTemplate(id: number): TemplateRow | null {
  const row = db().prepare(`SELECT * FROM templates WHERE id = ?`).get(id);
  return (row as TemplateRow | undefined) ?? null;
}

/** AC-1: insert a template. Returns the stored row. */
export function insertTemplate(input: {
  name: string;
  description: string;
  category: string;
  specJson: string;
  pagesJson: string | null;
  source: string;
}): TemplateRow {
  const now = new Date().toISOString();
  const info = db()
    .prepare(
      `INSERT INTO templates (name, description, category, spec_json, pages_json, source, created_at)
       VALUES (@name, @description, @category, @spec_json, @pages_json, @source, @created_at)`,
    )
    .run({
      name: input.name,
      description: input.description,
      category: input.category,
      spec_json: input.specJson,
      pages_json: input.pagesJson,
      source: input.source,
      created_at: now,
    });
  return getTemplate(Number(info.lastInsertRowid))!;
}

/** AC-1: delete a template. Returns true if a row was deleted.
 *  NOTE: callers must refuse builtin deletions at the API layer (AC-5). */
export function deleteTemplate(id: number): boolean {
  const info = db().prepare(`DELETE FROM templates WHERE id = ?`).run(id);
  return info.changes > 0;
}

// --- WP SSO login tokens (issue #61: auto-login from dashboard) ---

/** AC-1 (issue #61): row shape for wp_login_tokens. */
export interface WpLoginTokenRow {
  id: number;
  connection_id: number;
  token: string;
  used: number;
  created_at: string;
  expires_at: string;
}

const LOGIN_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** AC-1: generate a single-use login token for a connection. Returns the token
 *  + its expiry. The token is a 32-byte random hex string. */
export function createLoginToken(connectionId: number): { token: string; expiresAt: string } {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOGIN_TOKEN_TTL_MS);
  const token = randomHexToken();
  db()
    .prepare(
      `INSERT INTO wp_login_tokens (connection_id, token, used, created_at, expires_at)
       VALUES (@connection_id, @token, 0, @created_at, @expires_at)`,
    )
    .run({
      connection_id: connectionId,
      token,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
  return { token, expiresAt: expiresAt.toISOString() };
}

/** AC-1: consume a login token — atomic single-use validation. Returns the
 *  connection's username on success (so the plugin can log that user in), or
 *  null if the token is wrong / already used / expired / connection-mismatched.
 *  Race-free via a conditional UPDATE + changes-check (same pattern as #34's
 *  consumePairingCode). */
export function consumeLoginToken(
  connectionId: number,
  token: string,
): { username: string } | null {
  const conn = db();
  const info = conn
    .prepare(
      `UPDATE wp_login_tokens
       SET used = 1
       WHERE token = ? AND connection_id = ? AND used = 0 AND expires_at > ?`,
    )
    .run(token, connectionId, new Date().toISOString());
  if (info.changes === 0) return null;
  const c = conn.prepare(`SELECT username FROM wp_connections WHERE id = ?`).get(connectionId) as
    | { username: string }
    | undefined;
  return c ?? null;
}

/** 32-byte random hex token (64 chars). Uses Web Crypto (global in Node 18+). */
function randomHexToken(): string {
  const arr = new Uint8Array(32);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// --- WP health reporting (issue #62: health/info from plugin) ---

/** AC-1 (issue #62): save a health report for a connection. Called by the
 *  public health-report endpoint after validating the health_secret. */
export function saveWpConnectionHealth(
  connectionId: number,
  data: {
    wpVersion: string;
    themeName: string;
    pluginCount: number;
    healthScore: number;
  },
): void {
  db()
    .prepare(
      `UPDATE wp_connections
       SET wp_version = @wpVersion,
           theme_name = @themeName,
           plugin_count = @pluginCount,
           health_score = @healthScore,
           health_reported_at = @reportedAt
       WHERE id = @id`,
    )
    .run({
      id: connectionId,
      wpVersion: data.wpVersion,
      themeName: data.themeName,
      pluginCount: data.pluginCount,
      healthScore: data.healthScore,
      reportedAt: new Date().toISOString(),
    });
}

/** AC-2 (issue #62): verify a connection's health_secret using a constant-time
 *  comparison (prevents timing attacks). Returns true if the secret matches. */
export function verifyHealthSecret(connectionId: number, secret: string): boolean {
  const row = db()
    .prepare(`SELECT health_secret FROM wp_connections WHERE id = ?`)
    .get(connectionId) as { health_secret: string | null } | undefined;
  if (!row || !row.health_secret) return false;
  // Constant-time comparison.
  const a = Buffer.from(secret);
  const b = Buffer.from(row.health_secret);
  if (a.length !== b.length) return false;
  return a.equals(b); // Node Buffer.equals is constant-time
}

// --- Clients (issue #68: client portal auth) ---

export interface ClientRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export function createClient(input: {
  name: string;
  email: string;
  passwordHash: string;
}): ClientRow {
  const now = new Date().toISOString();
  const info = db()
    .prepare(
      `INSERT INTO clients (name, email, password_hash, created_at)
       VALUES (@name, @email, @passwordHash, @createdAt)`,
    )
    .run({
      name: input.name,
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      createdAt: now,
    });
  return getClientById(Number(info.lastInsertRowid))!;
}

export function getClientByEmail(email: string): ClientRow | null {
  const row = db()
    .prepare(`SELECT * FROM clients WHERE email = ?`)
    .get(email.toLowerCase().trim()) as ClientRow | undefined;
  return row ?? null;
}

export function getClientById(id: number): ClientRow | null {
  const row = db().prepare(`SELECT * FROM clients WHERE id = ?`).get(id) as ClientRow | undefined;
  return row ?? null;
}

export function listClients(): Array<Omit<ClientRow, "password_hash">> {
  const rows = db()
    .prepare(`SELECT id, name, email, created_at FROM clients ORDER BY id DESC`)
    .all() as Array<Omit<ClientRow, "password_hash">>;
  return rows;
}

export function deleteClient(id: number): boolean {
  // Unlink projects before deleting (don't delete the projects themselves).
  db().prepare(`UPDATE sites SET client_id = NULL WHERE client_id = ?`).run(id);
  const info = db().prepare(`DELETE FROM clients WHERE id = ?`).run(id);
  return info.changes > 0;
}

/** AC-2: assign/unassign a project to a client. */
export function assignProjectToClient(projectId: number, clientId: number | null): void {
  db().prepare(`UPDATE sites SET client_id = ? WHERE id = ?`).run(clientId, projectId);
}

/** Safe projection — never returns password_hash. */
function safeClient(c: ClientRow): Omit<ClientRow, "password_hash"> {
  return { id: c.id, name: c.name, email: c.email, created_at: c.created_at };
}


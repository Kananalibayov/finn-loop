// AC-10 (issue #46): Settings redesigned into 4 app-level sections.
//   1. Application — OpenAI key + generation model (DB override, env fallback).
//   2. Account — change admin password (verify-current + new).
//   3. Storage — read-only DB path + live counts.
//   4. Advanced — legacy fallback WordPress (demoted, relabeled).
//
// The old single-WP-card is preserved verbatim in section 4 (backward compat
// for unlinked projects); only its framing + explanatory note change.

"use client";

import { useCallback, useEffect, useState } from "react";

type AppSettings = {
  openaiApiKeySet: boolean;
  openaiKeyMasked: string | null;
  openaiKeySource: "db" | "env" | "none";
  generationModel: string;
  generationModelSource: "db" | "env" | "default";
  adminPasswordSet: boolean;
};

type LegacyWpState = {
  apiUrl: string;
  username: string;
  appPassword: string;
  hasPassword: boolean;
};

type WpTestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; username: string; roles: string[] }
  | { status: "error"; message: string };

type Counts = { projects: number; connections: number; pairingCodes: number };

export default function SettingsPage() {
  // --- Section 1: Application ---
  const [app, setApp] = useState<AppSettings | null>(null);
  const [appLoading, setAppLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newModel, setNewModel] = useState("");
  const [appSaving, setAppSaving] = useState(false);
  const [appResult, setAppResult] = useState<string | null>(null);
  const [appError, setAppError] = useState<string | null>(null);

  // --- Section 2: Account ---
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwResult, setPwResult] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  // --- Section 3: Storage ---
  const [counts, setCounts] = useState<Counts | null>(null);
  const dbPath = process.env.NEXT_PUBLIC_DATABASE_FILE ?? "data/app.db";

  // --- Section 4: Legacy WP (unchanged logic) ---
  const [legacy, setLegacy] = useState<LegacyWpState>({
    apiUrl: "", username: "", appPassword: "", hasPassword: false,
  });
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [legacyTest, setLegacyTest] = useState<WpTestState>({ status: "idle" });
  const [legacySave, setLegacySave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [legacyError, setLegacyError] = useState<string | null>(null);

  const loadApp = useCallback(async () => {
    setAppLoading(true);
    setAppError(null);
    try {
      const res = await fetch("/api/app/settings", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status}).`);
      const data = (await res.json()) as AppSettings;
      setApp(data);
      setNewModel(data.generationModelSource === "default" ? "" : data.generationModel);
    } catch (e) {
      setAppError((e as Error).message);
    } finally {
      setAppLoading(false);
    }
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/wp/connections", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setCounts({
        projects: Array.isArray(p) ? p.length : 0,
        connections: Array.isArray(c) ? c.length : 0,
        pairingCodes: 0, // not exposed via a list endpoint; omitted from the UI below
      });
    } catch {
      // Non-fatal — counts are informational.
    }
  }, []);

  const loadLegacy = useCallback(async () => {
    setLegacyLoading(true);
    setLegacyError(null);
    try {
      const res = await fetch("/api/wp/settings", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status}).`);
      const data = (await res.json()) as Partial<LegacyWpState>;
      setLegacy({
        apiUrl: data.apiUrl || "",
        username: data.username || "",
        appPassword: "",
        hasPassword: Boolean(data.hasPassword),
      });
    } catch (e) {
      setLegacyError((e as Error).message);
    } finally {
      setLegacyLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApp();
    loadCounts();
    loadLegacy();
  }, [loadApp, loadCounts, loadLegacy]);

  // --- Section 1 handlers ---
  async function handleSaveApp() {
    setAppSaving(true);
    setAppError(null);
    setAppResult(null);
    try {
      const patch: { openaiApiKey?: string; generationModel?: string } = {};
      // Only send fields the operator touched. For the key, empty = clear.
      if (newKey !== "") patch.openaiApiKey = newKey.trim();
      else patch.openaiApiKey = ""; // explicit clear only if they emptied a previously-set field
      patch.generationModel = newModel.trim();
      const res = await fetch("/api/app/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => ({}))) as AppSettings & { error?: string };
      if (!res.ok) throw new Error(data?.error || `Save failed (HTTP ${res.status}).`);
      setApp(data);
      setNewKey("");
      setAppResult("Saved. Generation will use the updated values on the next run.");
      setTimeout(() => setAppResult(null), 4000);
    } catch (e) {
      setAppError((e as Error).message);
    } finally {
      setAppSaving(false);
    }
  }

  // --- Section 2 handlers ---
  async function handleChangePassword() {
    setPwSaving(true);
    setPwError(null);
    setPwResult(null);
    try {
      const res = await fetch("/api/app/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `Change failed (HTTP ${res.status}).`);
      }
      setCurrentPw("");
      setNewPw("");
      setPwResult("Password updated — use the new one next login.");
      setTimeout(() => setPwResult(null), 5000);
    } catch (e) {
      setPwError((e as Error).message);
    } finally {
      setPwSaving(false);
    }
  }

  // --- Section 4 handlers (unchanged logic from the old page) ---
  async function handleLegacyTest() {
    setLegacyTest({ status: "testing" });
    setLegacyError(null);
    try {
      const res = await fetch("/api/wp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: legacy.apiUrl,
          username: legacy.username,
          appPassword: legacy.appPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean; username?: string; roles?: string[]; error?: string;
      };
      if (data.ok) {
        setLegacyTest({
          status: "ok",
          username: data.username || legacy.username,
          roles: data.roles || [],
        });
      } else {
        setLegacyTest({ status: "error", message: data.error || "Connection failed." });
      }
    } catch (e) {
      setLegacyTest({ status: "error", message: (e as Error).message });
    }
  }

  async function handleLegacySave() {
    setLegacySave("saving");
    setLegacyError(null);
    try {
      const res = await fetch("/api/wp/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: legacy.apiUrl,
          username: legacy.username,
          appPassword: legacy.appPassword,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error || `Save failed (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as { hasPassword?: boolean };
      setLegacy((f) => ({ ...f, appPassword: "", hasPassword: Boolean(data.hasPassword) }));
      setLegacySave("saved");
      setTimeout(() => setLegacySave("idle"), 3000);
    } catch (e) {
      setLegacySave("error");
      setLegacyError((e as Error).message);
    }
  }

  const keySourceLabel =
    app?.openaiKeySource === "db" ? "Using DB override"
    : app?.openaiKeySource === "env" ? "Using .env default"
    : "Not configured";
  const modelSourceLabel =
    app?.generationModelSource === "db" ? "DB override"
    : app?.generationModelSource === "env" ? ".env default"
    : "default (gpt-4o-mini)";

  return (
    <main className="page">
      <header className="app-header">
        <h1>Settings</h1>
        <p>App-level configuration: generation, account, storage.</p>
      </header>

      {/* ---------------- Section 1: Application ---------------- */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Application</h2>
        <p className="login-sub" style={{ marginBottom: 12 }}>
          These power site generation for all clients. Overrides take precedence over <code>.env</code>.
        </p>

        <label htmlFor="oai">OpenAI API key</label>
        <input
          id="oai"
          type="password"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder={app?.openaiKeyMasked ? `${app.openaiKeyMasked} — type to replace` : "sk-…"}
          autoComplete="off"
        />
        <span className="hint">
          {appLoading ? "Loading…" : `${keySourceLabel}${app?.openaiKeyMasked ? ` (${app.openaiKeyMasked})` : ""}`}. Leave the field empty + Save to clear the override and use <code>.env</code>.
        </span>

        <label htmlFor="mdl">Generation model</label>
        <input
          id="mdl"
          type="text"
          value={newModel}
          onChange={(e) => setNewModel(e.target.value)}
          placeholder="gpt-4o-mini"
        />
        <span className="hint">Currently: {app?.generationModel ?? "—"} ({modelSourceLabel}). Leave empty for default.</span>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveApp}
            disabled={appSaving}
          >
            {appSaving ? "Saving…" : "Save"}
          </button>
        </div>
        {appResult && <div className="notice" style={{ marginTop: 12 }}>{appResult}</div>}
        {appError && <div className="error" style={{ marginTop: 12 }}>{appError}</div>}
      </section>

      {/* ---------------- Section 2: Account ---------------- */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Account</h2>
        <p className="login-sub" style={{ marginBottom: 12 }}>
          Change the admin password used to log in to this dashboard.
        </p>

        <label htmlFor="cpw">Current password</label>
        <input
          id="cpw"
          type="password"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          autoComplete="current-password"
        />
        <label htmlFor="npw">New password <span className="hint">(min 8 chars)</span></label>
        <input
          id="npw"
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          autoComplete="new-password"
        />

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleChangePassword}
            disabled={pwSaving || !currentPw || newPw.length < 8}
          >
            {pwSaving ? "Changing…" : "Change password"}
          </button>
        </div>
        {pwResult && <div className="notice" style={{ marginTop: 12 }}>{pwResult}</div>}
        {pwError && <div className="error" style={{ marginTop: 12 }}>{pwError}</div>}
      </section>

      {/* ---------------- Section 3: Storage ---------------- */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Storage</h2>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 16px", fontSize: 14 }}>
          <dt className="hint">Database file</dt>
          <dd style={{ margin: 0 }}><code>{dbPath}</code></dd>
          <dt className="hint">Upload directory</dt>
          <dd style={{ margin: 0 }}><code>data/uploads</code></dd>
          <dt className="hint">Projects</dt>
          <dd style={{ margin: 0 }}>{counts?.projects ?? "…"}</dd>
          <dt className="hint">Connections</dt>
          <dd style={{ margin: 0 }}>{counts?.connections ?? "…"}</dd>
        </dl>
      </section>

      {/* ---------------- Section 3.5: Branding ---------------- */}
      <BrandingSection />

      {/* Email settings (issue #81) */}
      <EmailSection />

      {/* Plesk integration (issue #88) */}
      <PleskSection />

      {/* ---------------- Section 4: Advanced (legacy WP) ---------------- */}
      <section className="card">
        <h2>Advanced — Legacy fallback WordPress</h2>
        <p className="login-sub" style={{ marginBottom: 12 }}>
          Used only for projects with <strong>no linked connection</strong>. To deliver to a specific client,
          link a connection on the project page or manage them on the Connections page.
        </p>

        {legacyLoading ? (
          <div className="preview-empty">Loading…</div>
        ) : (
          <>
            <label htmlFor="apiUrl">REST API URL</label>
            <input
              id="apiUrl"
              type="url"
              value={legacy.apiUrl}
              onChange={(e) => setLegacy((f) => ({ ...f, apiUrl: e.target.value }))}
              placeholder="https://your-wp.example/wp-json"
            />
            <span className="hint">The WP REST root, ending in /wp-json</span>

            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={legacy.username}
              onChange={(e) => setLegacy((f) => ({ ...f, username: e.target.value }))}
              placeholder="wp-admin-user"
            />

            <label htmlFor="appPassword">Application Password</label>
            <input
              id="appPassword"
              type="password"
              value={legacy.appPassword}
              onChange={(e) => setLegacy((f) => ({ ...f, appPassword: e.target.value }))}
              placeholder={legacy.hasPassword ? "•••••• (saved — type to replace)" : "xxxx xxxx xxxx xxxx xxxx xxxx"}
              autoComplete="off"
            />
            {legacy.hasPassword && !legacy.appPassword && (
              <span className="hint">A password is saved. Leave blank to keep it, or type a new one to replace.</span>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleLegacyTest}
                disabled={legacyTest.status === "testing" || !legacy.apiUrl || !legacy.username || !legacy.appPassword}
              >
                {legacyTest.status === "testing" ? "Testing…" : "Test connection"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleLegacySave}
                disabled={legacySave === "saving" || !legacy.apiUrl || !legacy.username || !legacy.appPassword}
              >
                {legacySave === "saving" ? "Saving…" : legacySave === "saved" ? "Saved ✓" : "Save"}
              </button>
            </div>

            {legacyTest.status === "ok" && (
              <div className="notice" style={{ marginTop: 12 }}>
                ✓ Connected as <strong>{legacyTest.username}</strong>
                {legacyTest.roles.length > 0 && ` (${legacyTest.roles.join(", ")})`}
              </div>
            )}
            {legacyTest.status === "error" && (
              <div className="error" style={{ marginTop: 12 }}>{legacyTest.message}</div>
            )}
            {legacySave === "error" && legacyError && (
              <div className="error" style={{ marginTop: 12 }}>{legacyError}</div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

/** Branding section (issue #79): agency name, logo, primary color. */
function BrandingSection() {
  const [data, setData] = useState({ agencyName: "", agencyLogoUrl: "", primaryColor: "#2563eb" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/branding", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status}).`);
      const updated = await res.json();
      setData(updated);
      setResult("Branding saved — refresh to see changes across the app.");
      setTimeout(() => setResult(null), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2>Branding</h2>
      <p className="hint" style={{ marginBottom: 12 }}>Customize how the platform looks for your team and clients.</p>

      <label htmlFor="an">Agency name</label>
      <input id="an" type="text" value={data.agencyName}
        onChange={(e) => setData((d) => ({ ...d, agencyName: e.target.value }))}
        placeholder="My Agency" />

      <label htmlFor="al">Logo URL <span className="hint">(upload via the logo uploader on /generate, then paste the URL here)</span></label>
      <input id="al" type="url" value={data.agencyLogoUrl}
        onChange={(e) => setData((d) => ({ ...d, agencyLogoUrl: e.target.value }))}
        placeholder="/api/uploads/abc123.png" />

      <label htmlFor="ac">Primary color</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input id="ac" type="color" value={data.primaryColor}
          onChange={(e) => setData((d) => ({ ...d, primaryColor: e.target.value }))}
          style={{ width: 50, height: 38, padding: 0, border: "1px solid var(--app-border)", borderRadius: 8, cursor: "pointer" }} />
        <input type="text" value={data.primaryColor}
          onChange={(e) => setData((d) => ({ ...d, primaryColor: e.target.value }))}
          placeholder="#2563eb" style={{ flex: 1 }} />
      </div>

      <button type="button" className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: "auto", marginTop: 16 }}>
        {saving ? "Saving…" : "Save branding"}
      </button>
      {result && <div className="notice" style={{ marginTop: 12 }}>{result}</div>}
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
    </section>
  );
}

/** Email settings section (issue #81). */
function EmailSection() {
  const [cfg, setCfg] = useState({ smtpHost: "", smtpPort: "587", smtpUser: "", smtpPass: "", smtpFrom: "", notifyOperatorEmail: "" });
  const [hasPass, setHasPass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setCfg(d); setHasPass(d.hasPassword); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status}).`);
      setResult("Email settings saved.");
      setTimeout(() => setResult(null), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch("/api/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: cfg.notifyOperatorEmail || cfg.smtpUser }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data?.error || "Test failed.");
      setResult("Test email sent ✓");
      setTimeout(() => setResult(null), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  if (loading) return null;

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2>Email / SMTP</h2>
      <p className="hint" style={{ marginBottom: 12 }}>Configure SMTP to send notifications (change requests, completions). Use your Hostinger/Plesk SMTP credentials.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
        <div>
          <label htmlFor="sh">SMTP host</label>
          <input id="sh" type="text" value={cfg.smtpHost}
            onChange={(e) => setCfg((c) => ({ ...c, smtpHost: e.target.value }))}
            placeholder="smtp.hostinger.com" />
        </div>
        <div>
          <label htmlFor="sp">Port</label>
          <input id="sp" type="number" value={cfg.smtpPort}
            onChange={(e) => setCfg((c) => ({ ...c, smtpPort: e.target.value }))} />
        </div>
      </div>

      <label htmlFor="su">SMTP user (email)</label>
      <input id="su" type="email" value={cfg.smtpUser}
        onChange={(e) => setCfg((c) => ({ ...c, smtpUser: e.target.value }))}
        placeholder="you@agency.com" />

      <label htmlFor="spw">SMTP password {hasPass && <span className="hint">(saved — type to replace)</span>}</label>
      <input id="spw" type="password" value={cfg.smtpPass}
        onChange={(e) => setCfg((c) => ({ ...c, smtpPass: e.target.value }))}
        placeholder={hasPass ? "•••••• (saved)" : "your SMTP password"} autoComplete="off" />

      <label htmlFor="sf">From address</label>
      <input id="sf" type="email" value={cfg.smtpFrom}
        onChange={(e) => setCfg((c) => ({ ...c, smtpFrom: e.target.value }))}
        placeholder="noreply@agency.com" />

      <label htmlFor="ne">Notify operator email</label>
      <input id="ne" type="email" value={cfg.notifyOperatorEmail}
        onChange={(e) => setCfg((c) => ({ ...c, notifyOperatorEmail: e.target.value }))}
        placeholder="alerts@agency.com" />
      <span className="hint">Where new change-request alerts are sent.</span>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-secondary" style={{ width: "auto" }} onClick={handleTest} disabled={testing || !cfg.smtpHost}>
          {testing ? "Sending…" : "Send test email"}
        </button>
      </div>
      {result && <div className="notice" style={{ marginTop: 12 }}>{result}</div>}
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
    </section>
  );
}

/** Plesk integration section (issue #88). */
function PleskSection() {
  const [cfg, setCfg] = useState({ pleskUrl: "", pleskUser: "", pleskPassword: "" });
  const [hasPass, setHasPass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plesk/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setCfg(d); setHasPass(d.hasPassword); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/plesk/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status}).`);
      setResult("Saved."); setTimeout(() => setResult(null), 3000);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true); setError(null);
    try {
      const res = await fetch("/api/plesk/test", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; hostname?: string; version?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data?.error || "Test failed.");
      setResult(`Connected ✓ ${data.hostname} (v${data.version})`);
      setTimeout(() => setResult(null), 5000);
    } catch (e) { setError((e as Error).message); }
    finally { setTesting(false); }
  }

  if (loading) return null;

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2>Plesk Integration</h2>
      <p className="hint" style={{ marginBottom: 12 }}>Connect to your Plesk server to auto-provision WordPress sites for clients.</p>

      <label htmlFor="pu">Plesk URL</label>
      <input id="pu" type="url" value={cfg.pleskUrl}
        onChange={(e) => setCfg((c) => ({ ...c, pleskUrl: e.target.value }))}
        placeholder="https://your-server.com:8443" />

      <label htmlFor="puser">Admin user (or API token user)</label>
      <input id="puser" type="text" value={cfg.pleskUser}
        onChange={(e) => setCfg((c) => ({ ...c, pleskUser: e.target.value }))}
        placeholder="admin" />

      <label htmlFor="ppw">Password / API token {hasPass && <span className="hint">(saved — type to replace)</span>}</label>
      <input id="ppw" type="password" value={cfg.pleskPassword}
        onChange={(e) => setCfg((c) => ({ ...c, pleskPassword: e.target.value }))}
        placeholder={hasPass ? "•••••• (saved)" : "your Plesk admin password or API token"} autoComplete="off" />

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-secondary" style={{ width: "auto" }} onClick={handleTest} disabled={testing || !cfg.pleskUrl}>
          {testing ? "Testing…" : "Test connection"}
        </button>
      </div>
      {result && <div className="notice" style={{ marginTop: 12 }}>{result}</div>}
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
    </section>
  );
}

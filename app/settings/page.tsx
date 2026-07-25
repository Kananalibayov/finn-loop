// AC-5, AC-6 (issue #24): WordPress settings page.
// Form for apiUrl / username / appPassword with two actions:
// - "Test connection" → POST /api/wp/test (from #23) with the typed values,
//   shows green/red result inline.
// - "Save" → PUT /api/wp/settings, persists to the wp_settings row.
// On load, pre-fills from GET /api/wp/settings (apiUrl + username; password
// is never returned by the API, only hasPassword — so the field starts empty).

"use client";

import { useEffect, useState } from "react";

type SettingsState = {
  apiUrl: string;
  username: string;
  appPassword: string;
  hasPassword: boolean;
};

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; username: string; roles: string[] }
  | { status: "error"; message: string };

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsState>({
    apiUrl: "",
    username: "",
    appPassword: "",
    hasPassword: false,
  });
  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Load existing settings on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wp/settings", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status}).`);
        const data = (await res.json()) as Partial<SettingsState>;
        if (cancelled) return;
        setForm({
          apiUrl: data.apiUrl || "",
          username: data.username || "",
          appPassword: "", // never returned by the API
          hasPassword: Boolean(data.hasPassword),
        });
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // AC-5: test connection using the currently-typed values (not saved ones).
  async function handleTest() {
    setTest({ status: "testing" });
    setError(null);
    try {
      const res = await fetch("/api/wp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: form.apiUrl,
          username: form.username,
          appPassword: form.appPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        username?: string;
        roles?: string[];
        error?: string;
      };
      if (data.ok) {
        setTest({
          status: "ok",
          username: data.username || form.username,
          roles: data.roles || [],
        });
      } else {
        setTest({ status: "error", message: data.error || "Connection failed." });
      }
    } catch (e) {
      setTest({ status: "error", message: (e as Error).message });
    }
  }

  // AC-5: save settings.
  async function handleSave() {
    setSave("saving");
    setError(null);
    try {
      const res = await fetch("/api/wp/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: form.apiUrl,
          username: form.username,
          appPassword: form.appPassword,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Save failed (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as { hasPassword?: boolean };
      setForm((f) => ({ ...f, appPassword: "", hasPassword: Boolean(data.hasPassword) }));
      setSave("saved");
      setTimeout(() => setSave("idle"), 3000);
    } catch (e) {
      setSave("error");
      setError((e as Error).message);
    }
  }

  if (loading) {
    return (
      <main>
        <div className="preview-empty">Loading settings…</div>
      </main>
    );
  }

  return (
    <main>
      <header className="app-header">
        <h1>Settings</h1>
        <p>Configure the WordPress instance this app delivers to.</p>
      </header>

      <section className="card">
        <h2>WordPress connection</h2>

        <label htmlFor="apiUrl">REST API URL</label>
        <input
          id="apiUrl"
          type="url"
          value={form.apiUrl}
          onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))}
          placeholder="https://your-wp.example/wp-json"
        />
        <span className="hint">The WP REST root, ending in /wp-json</span>

        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          placeholder="wp-admin-user"
        />

        <label htmlFor="appPassword">Application Password</label>
        <input
          id="appPassword"
          type="password"
          value={form.appPassword}
          onChange={(e) => setForm((f) => ({ ...f, appPassword: e.target.value }))}
          placeholder={form.hasPassword ? "•••••• (saved — type to replace)" : "xxxx xxxx xxxx xxxx xxxx xxxx"}
          autoComplete="off"
        />
        {form.hasPassword && !form.appPassword && (
          <span className="hint">A password is saved. Leave blank to keep it, or type a new one to replace.</span>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleTest}
            disabled={test.status === "testing" || !form.apiUrl || !form.username || !form.appPassword}
          >
            {test.status === "testing" ? "Testing…" : "Test connection"}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={save === "saving" || !form.apiUrl || !form.username || !form.appPassword}
          >
            {save === "saving" ? "Saving…" : save === "saved" ? "Saved ✓" : "Save"}
          </button>
        </div>

        {/* AC-6: inline test result */}
        {test.status === "ok" && (
          <div className="notice" style={{ marginTop: 12 }}>
            ✓ Connected as <strong>{test.username}</strong>
            {test.roles.length > 0 && ` (${test.roles.join(", ")})`}
          </div>
        )}
        {test.status === "error" && (
          <div className="error" style={{ marginTop: 12 }}>
            {test.message}
          </div>
        )}

        {save === "error" && error && (
          <div className="error" style={{ marginTop: 12 }}>{error}</div>
        )}
      </section>
    </main>
  );
}

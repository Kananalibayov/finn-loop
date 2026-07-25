// AC-5 (issue #32): WP connections management page.
// Lists all WP connections (label, URL, username, Test, Delete).
// "Add connection" form (label, apiUrl, username, appPassword).

"use client";

import { useCallback, useEffect, useState } from "react";

type Connection = {
  id: number;
  label: string;
  apiUrl: string;
  username: string;
  hasPassword: boolean;
  createdAt: string;
};

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; username: string; roles: string[] }
  | { status: "error"; message: string };

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testStates, setTestStates] = useState<Record<number, TestState>>({});

  // Add-form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "", apiUrl: "", username: "", appPassword: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wp/connections", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status}).`);
      const data = (await res.json()) as Connection[];
      setConnections(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/wp/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error || `Add failed (HTTP ${res.status}).`);
      }
      setForm({ label: "", apiUrl: "", username: "", appPassword: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/wp/connections/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`Delete failed (HTTP ${res.status}).`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleTest(conn: Connection) {
    setTestStates((s) => ({ ...s, [conn.id]: { status: "testing" } }));
    try {
      const res = await fetch("/api/wp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUrl: conn.apiUrl, username: conn.username, appPassword: "" }),
      });
      // Note: the test endpoint needs the actual password, which we don't have client-side.
      // For now, this will show "need password" — the operator should use the Settings page's
      // test button (which has the password in the form field). This is a known limitation
      // of the safe-projection approach (password never returned to the client).
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; username?: string; roles?: string[]; error?: string };
      if (data.ok) {
        setTestStates((s) => ({ ...s, [conn.id]: { status: "ok", username: data.username || conn.username, roles: data.roles || [] } }));
      } else {
        setTestStates((s) => ({ ...s, [conn.id]: { status: "error", message: data.error || "Test requires the password to be re-entered." } }));
      }
    } catch (e) {
      setTestStates((s) => ({ ...s, [conn.id]: { status: "error", message: (e as Error).message } }));
    }
  }

  return (
    <main>
      <header className="app-header">
        <h1>WordPress Connections</h1>
        <p>Manage WordPress sites for your clients. Each project pushes to its linked connection.</p>
      </header>

      <section className="card">
        {loading && <div className="preview-empty">Loading…</div>}

        {error && <div className="error">{error}</div>}

        {!loading && connections.length === 0 && !showForm && (
          <div className="preview-empty">
            No WordPress connections yet.{" "}
            <button className="app-nav-link" onClick={() => setShowForm(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--app-primary)", textDecoration: "underline", fontSize: "inherit" }}>
              Add one →
            </button>
          </div>
        )}

        {connections.length > 0 && (
          <ul className="site-list">
            {connections.map((conn) => {
              const ts = testStates[conn.id] || { status: "idle" };
              return (
                <li key={conn.id} className="site-row">
                  <div className="site-row-main">
                    <span className="site-row-name">{conn.label}</span>
                    <span className="site-row-meta">
                      {conn.username} · {conn.apiUrl.replace(/^https?:\/\//, "").replace(/\/wp-json.*/, "")}
                    </span>
                    {ts.status === "ok" && (
                      <span className="notice" style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", fontSize: 12 }}>
                        ✓ {ts.username} ({ts.roles.join(", ")})
                      </span>
                    )}
                    {ts.status === "error" && (
                      <span className="error" style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", fontSize: 12 }}>
                        {ts.message}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn-secondary"
                      onClick={() => handleTest(conn)}
                      disabled={ts.status === "testing"}
                    >
                      {ts.status === "testing" ? "Testing…" : "Test"}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleDelete(conn.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {connections.length > 0 && !showForm && (
          <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>
            + Add connection
          </button>
        )}

        {/* Add connection form */}
        {showForm && (
          <form onSubmit={handleAdd} style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--app-border)" }}>
            <h2>Add WordPress Connection</h2>
            <label htmlFor="label">Label <span className="hint">(e.g. "Acme Corp")</span></label>
            <input id="label" type="text" required value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Client name" />

            <label htmlFor="apiUrl">REST API URL</label>
            <input id="apiUrl" type="url" required value={form.apiUrl}
              onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))}
              placeholder="https://client-site.com/wp-json" />

            <label htmlFor="username">Username</label>
            <input id="username" type="text" required value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              placeholder="wp-admin-user" />

            <label htmlFor="appPassword">Application Password</label>
            <input id="appPassword" type="password" required value={form.appPassword}
              onChange={(e) => setForm((f) => ({ ...f, appPassword: e.target.value }))}
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              autoComplete="off" />

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save connection"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

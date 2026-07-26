// AC-6 (issue #34): WP connections page + pairing code generation.
// Lists connections (from #32, which may or may not be merged yet — defensive).
// Also shows a "Generate Pairing Code" section for the plugin auto-connect flow.

"use client";

import { useCallback, useEffect, useState } from "react";

type Connection = {
  id: number;
  label: string;
  apiUrl: string;
  username: string;
  hasPassword: boolean;
  createdAt: string;
  /** AC-2 (#40): true when this connection was auto-created by the plugin
   *  consuming a pairing code (vs added manually by the operator). */
  pairedViaCode?: boolean;
};

type PairingCode = {
  code: string;
  label: string;
  expiresAt: string;
};

/** AC-5 (issue #40): per-card test-connection result state. */
type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; username: string; roles: string[] }
  | { status: "error"; message: string };

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // AC-4 (issue #40): per-card busy + test-result state for the card grid.
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [testStates, setTestStates] = useState<Record<number, TestState>>({});

  // Pairing state
  const [pairingLabel, setPairingLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [activeCode, setActiveCode] = useState<PairingCode | null>(null);
  const [copied, setCopied] = useState(false);

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

  // AC-6: generate pairing code.
  async function handleGeneratePairing(e: React.FormEvent) {
    e.preventDefault();
    if (!pairingLabel.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/wp/pairing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: pairingLabel.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error || `Generate failed (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as PairingCode;
      setActiveCode(data);
      setPairingLabel("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyCode() {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
    // AC-4 (issue #40): optimistic removal + per-card busy state.
    setDeletingId(id);
    try {
      const res = await fetch(`/api/wp/connections/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`Delete failed (HTTP ${res.status}).`);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  // AC-5 (issue #40): test a connection. Carries forward the #32/#35 caveat —
  // the safe API projection never returns the password, so a client-side test
  // without re-entering creds reports "need password". The button remains so
  // the operator can trigger it; the result renders inline on the card.
  async function handleTest(conn: Connection) {
    setTestStates((s) => ({ ...s, [conn.id]: { status: "testing" } }));
    try {
      const res = await fetch("/api/wp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUrl: conn.apiUrl, username: conn.username, appPassword: "" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        username?: string;
        roles?: string[];
        error?: string;
      };
      if (data.ok) {
        setTestStates((s) => ({
          ...s,
          [conn.id]: { status: "ok", username: data.username || conn.username, roles: data.roles || [] },
        }));
      } else {
        setTestStates((s) => ({
          ...s,
          [conn.id]: { status: "error", message: data.error || "Test requires the password to be re-entered." },
        }));
      }
    } catch (e) {
      setTestStates((s) => ({ ...s, [conn.id]: { status: "error", message: (e as Error).message } }));
    }
  }

  return (
    <main className="page">
      <header className="app-header">
        <h1>WordPress Connections</h1>
        <p>Manage client WordPress sites. Generate pairing codes for auto-connect via the plugin.</p>
      </header>

      {/* AC-6: Pairing code generation section */}
      <section className="card" style={{ marginBottom: 24 }}>
        <h2>Generate Pairing Code</h2>
        <p className="login-sub" style={{ marginBottom: 12 }}>
          Generate a one-time code, then install the companion plugin on the client&apos;s WordPress
          and enter this code. The plugin auto-connects — no manual password copy-paste.
        </p>
        <form onSubmit={handleGeneratePairing} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Client name (e.g. Acme Corp)"
            value={pairingLabel}
            onChange={(e) => setPairingLabel(e.target.value)}
            style={{ flex: "1 1 200px" }}
          />
          <button type="submit" className="btn-primary" disabled={generating || !pairingLabel.trim()}>
            {generating ? "Generating…" : "Generate code"}
          </button>
        </form>

        {activeCode && (
          <div className="notice" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong style={{ fontSize: 18, letterSpacing: "0.05em" }}>{activeCode.code}</strong>
              <div style={{ fontSize: 12, marginTop: 2 }}>
                For: {activeCode.label} · Expires: {new Date(activeCode.expiresAt).toLocaleString()}
              </div>
            </div>
            <button className="btn-secondary" onClick={handleCopyCode}>
              {copied ? "Copied ✓" : "Copy code"}
            </button>
          </div>
        )}
      </section>

      {/* AC-3 (issue #40): connections list — now a responsive card grid. */}
      <section className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Connections</h2>
          {!showForm && connections.length > 0 && (
            <button className="btn-secondary" onClick={() => setShowForm(true)}>
              + Add manually
            </button>
          )}
        </div>

        <div className="dashboard-grid" style={{ marginTop: 16 }}>
          {loading && (
            <div className="dashboard-empty">
              <div className="preview-empty">Loading…</div>
            </div>
          )}

          {error && (
            <div className="dashboard-empty">
              <div className="error">{error}</div>
            </div>
          )}

          {!loading && connections.length === 0 && !showForm && (
            <div className="dashboard-empty">
              <div className="preview-empty">
                No WordPress connections yet.{" "}
                <button onClick={() => setShowForm(true)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--app-primary)", textDecoration: "underline", fontSize: "inherit",
                }}>
                  Add one manually →
                </button>
              </div>
            </div>
          )}

          {connections.map((conn) => {
            const ts = testStates[conn.id] || { status: "idle" };
            return (
              <article key={conn.id} className="connection-card">
                {/* AC-4(a): label. */}
                <h3 className="connection-card-title">{conn.label}</h3>
                {/* AC-4(b): site host subtitle. */}
                <p className="connection-card-subtitle">{hostFromUrl(conn.apiUrl)}</p>

                {/* AC-5: status badges. */}
                <div className="connection-card-meta">
                  {conn.pairedViaCode ? (
                    <span className="badge badge--info">Plugin-paired</span>
                  ) : (
                    <span className="badge badge--theme">Manual</span>
                  )}
                  {conn.hasPassword ? (
                    <span className="badge badge--wp-pushed">✓ Credentials</span>
                  ) : (
                    <span className="badge badge--warning">No password</span>
                  )}
                  <span className="connection-card-date">{formatDate(conn.createdAt)}</span>
                </div>

                {/* AC-4(d): username meta. */}
                <div className="connection-card-meta">
                  <span className="badge badge--theme">{conn.username}</span>
                </div>

                {/* AC-5: inline test result. */}
                {ts.status === "ok" && (
                  <div className="connection-card-test-result notice">
                    ✓ {ts.username}{ts.roles.length > 0 && ` (${ts.roles.join(", ")})`}
                  </div>
                )}
                {ts.status === "error" && (
                  <div className="connection-card-test-result error">{ts.message}</div>
                )}

                {/* AC-4(e): actions. */}
                <div className="connection-card-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleTest(conn)}
                    disabled={ts.status === "testing"}
                  >
                    {ts.status === "testing" ? "Testing…" : "Test"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleDelete(conn.id)}
                    disabled={deletingId === conn.id}
                  >
                    {deletingId === conn.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {showForm && (
        <section className="card">
          <form onSubmit={handleAdd}>
            <h2>Add Connection Manually</h2>
            <label htmlFor="label">Label</label>
            <input id="label" type="text" required value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Client name" />
            <label htmlFor="apiUrl">REST API URL</label>
            <input id="apiUrl" type="url" required value={form.apiUrl}
              onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))}
              placeholder="https://client-site.com/wp-json" />
            <label htmlFor="username">Username</label>
            <input id="username" type="text" required value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="wp-admin-user" />
            <label htmlFor="appPassword">Application Password</label>
            <input id="appPassword" type="password" required value={form.appPassword}
              onChange={(e) => setForm((f) => ({ ...f, appPassword: e.target.value }))}
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" autoComplete="off" />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save connection"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}

/** AC-4(b) (issue #40): extract the host from a WP REST API URL for the card
 *  subtitle. Strips the scheme and any trailing /wp-json path. Falls back to
 *  the raw string if parsing fails. */
function hostFromUrl(apiUrl: string): string {
  return apiUrl.replace(/^https?:\/\//, "").replace(/\/wp-json.*/, "");
}

/** ISO -> human-readable date. Falls back to the raw string on parse failure. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

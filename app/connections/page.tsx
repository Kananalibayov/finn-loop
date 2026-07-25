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
};

type PairingCode = {
  code: string;
  label: string;
  expiresAt: string;
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const res = await fetch(`/api/wp/connections/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`Delete failed (HTTP ${res.status}).`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main>
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

      {/* Connections list */}
      <section className="card">
        <h2>Connections</h2>

        {loading && <div className="preview-empty">Loading…</div>}
        {error && <div className="error">{error}</div>}

        {!loading && connections.length === 0 && !showForm && (
          <div className="preview-empty">
            No WordPress connections yet.{" "}
            <button onClick={() => setShowForm(true)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--app-primary)", textDecoration: "underline", fontSize: "inherit",
            }}>
              Add one manually →
            </button>
          </div>
        )}

        {connections.length > 0 && (
          <ul className="site-list">
            {connections.map((conn) => (
              <li key={conn.id} className="site-row">
                <div className="site-row-main">
                  <span className="site-row-name">{conn.label}</span>
                  <span className="site-row-meta">
                    {conn.username} · {conn.apiUrl.replace(/^https?:\/\//, "").replace(/\/wp-json.*/, "")}
                  </span>
                </div>
                <button className="btn-secondary" onClick={() => handleDelete(conn.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        {!showForm && connections.length > 0 && (
          <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>
            + Add manually
          </button>
        )}

        {showForm && (
          <form onSubmit={handleAdd} style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--app-border)" }}>
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
        )}
      </section>
    </main>
  );
}

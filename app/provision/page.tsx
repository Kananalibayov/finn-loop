// Plesk WP provisioning — create a new WordPress site from the dashboard.
"use client";

import { useState } from "react";
import Link from "next/link";

export default function ProvisionPage() {
  const [form, setForm] = useState({ domain: "", wpEmail: "", wpTitle: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; wpUrl?: string; domain?: string; error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/plesk/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; wpUrl?: string; domain?: string; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `Provision failed (HTTP ${res.status}).`);
      }
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <header className="app-header">
        <h1>Provision WordPress</h1>
        <p>Auto-create a new WordPress site on your Plesk server. Creates the domain + installs WP via WP Toolkit.</p>
      </header>

      {result && (
        <section className="card" style={{ marginBottom: 16, borderColor: "var(--app-success)" }}>
          <div className="notice" style={{ marginBottom: 0 }}>
            <strong>✓ WordPress provisioned!</strong><br />
            Domain: <code>{result.domain}</code><br />
            URL: <a href={result.wpUrl} target="_blank" rel="noopener noreferrer">{result.wpUrl}</a>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            Next steps: install the Finn-Loop plugin on this WP, then generate a pairing code on the{" "}
            <Link href="/connections" className="app-nav-link">Connections page</Link> to auto-connect it.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-secondary" style={{ width: "auto", marginTop: 0 }} onClick={() => setResult(null)}>
              Provision another
            </button>
          </div>
        </section>
      )}

      {!result && (
        <section className="card">
          <form onSubmit={handleSubmit}>
            <label htmlFor="dom">Domain *</label>
            <input id="dom" type="text" required value={form.domain}
              onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
              placeholder="client.com or sub.yourdomain.com" />
            <span className="hint">Must already point to your Plesk server (DNS configured).</span>

            <label htmlFor="wpe">WP admin email *</label>
            <input id="wpe" type="email" required value={form.wpEmail}
              onChange={(e) => setForm((f) => ({ ...f, wpEmail: e.target.value }))}
              placeholder="client@acme.com" />

            <label htmlFor="wpt">WP site title</label>
            <input id="wpt" type="text" value={form.wpTitle}
              onChange={(e) => setForm((f) => ({ ...f, wpTitle: e.target.value }))}
              placeholder="Acme Corp (defaults to domain name)" />

            <button type="submit" className="btn-primary" disabled={submitting || !form.domain.trim() || !form.wpEmail.trim()}>
              {submitting ? "Provisioning… (30-60s)" : "Provision WordPress"}
            </button>

            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
          </form>
        </section>
      )}
    </main>
  );
}

// AC-11 (issue #68): operator-facing client management page.

"use client";

import { useCallback, useEffect, useState } from "react";

type Client = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status}).`);
      setClients((await res.json()) as Client[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data?.error || `Create failed (HTTP ${res.status}).`);
      setForm({ name: "", email: "", password: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this client? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`Delete failed (HTTP ${res.status}).`);
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="page">
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1>Clients</h1>
            <p>Create client accounts for the portal. Clients see only their assigned projects.</p>
          </div>
          {!showForm && (
            <button className="btn-primary" style={{ width: "auto", marginTop: 0 }} onClick={() => setShowForm(true)}>
              + Add client
            </button>
          )}
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {loading && <div className="card"><div className="preview-empty">Loading…</div></div>}

      {!loading && clients.length === 0 && !showForm && (
        <div className="card">
          <div className="preview-empty">
            No clients yet.{" "}
            <button onClick={() => setShowForm(true)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--app-primary)", textDecoration: "underline", fontSize: "inherit",
            }}>Add one →</button>
          </div>
        </div>
      )}

      {!loading && clients.length > 0 && (
        <section className="card">
          <ul className="site-list">
            {clients.map((c) => (
              <li key={c.id} className="site-row">
                <div className="site-row-main">
                  <span className="site-row-name">{c.name}</span>
                  <span className="site-row-meta">{c.email}</span>
                </div>
                <button
                  type="button"
                  className="btn-secondary site-row-delete"
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                >
                  {deletingId === c.id ? "Deleting…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showForm && (
        <section className="card">
          <form onSubmit={handleCreate}>
            <h2>Add Client</h2>
            <label htmlFor="cn">Name *</label>
            <input id="cn" type="text" required value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Acme Corp" />

            <label htmlFor="ce">Email *</label>
            <input id="ce" type="email" required value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="client@acme.com" />

            <label htmlFor="cp">Temporary password * <span className="hint">(min 6 chars)</span></label>
            <input id="cp" type="password" required minLength={6} value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="temp-password" autoComplete="off" />

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={saving || !form.name.trim() || !form.email.trim()}>
                {saving ? "Creating…" : "Create client"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}

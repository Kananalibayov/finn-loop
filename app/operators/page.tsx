// AC-8 (issue #74): operator management page.
"use client";

import { useCallback, useEffect, useState } from "react";

type Operator = { id: number; name: string; email: string; role: string; created_at: string };

export default function OperatorsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "editor" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operators", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status}).`);
      setOperators((await res.json()) as Operator[]);
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
      const res = await fetch("/api/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data?.error || `Failed (HTTP ${res.status}).`);
      setForm({ name: "", email: "", password: "", role: "editor" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/operators/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error || `Failed (HTTP ${res.status}).`);
      }
      setOperators((prev) => prev.filter((o) => o.id !== id));
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
            <h1>Team</h1>
            <p>Manage operator accounts. Admins can create + delete others.</p>
          </div>
          {!showForm && (
            <button className="btn-primary" style={{ width: "auto", marginTop: 0 }} onClick={() => setShowForm(true)}>
              + Add operator
            </button>
          )}
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {loading && <div className="card"><div className="preview-empty">Loading…</div></div>}

      {!loading && operators.length > 0 && (
        <section className="card">
          <ul className="site-list">
            {operators.map((op) => (
              <li key={op.id} className="site-row">
                <div className="site-row-main">
                  <span className="site-row-name">{op.name}</span>
                  <span className="site-row-meta">
                    {op.email} · <span className="badge badge--theme">{op.role}</span>
                  </span>
                </div>
                <button type="button" className="btn-secondary" onClick={() => handleDelete(op.id)} disabled={deletingId === op.id}>
                  {deletingId === op.id ? "Deleting…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showForm && (
        <section className="card">
          <form onSubmit={handleCreate}>
            <h2>Add Operator</h2>
            <label htmlFor="on">Name *</label>
            <input id="on" type="text" required value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />

            <label htmlFor="oe">Email *</label>
            <input id="oe" type="email" required value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@agency.com" />

            <label htmlFor="op">Temporary password * <span className="hint">(min 6 chars)</span></label>
            <input id="op" type="password" required minLength={6} value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="off" />

            <label htmlFor="or">Role</label>
            <select id="or" value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="admin">Admin (full access + manage team)</option>
              <option value="editor">Editor (generate, edit, push)</option>
              <option value="viewer">Viewer (read-only)</option>
            </select>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={saving || !form.name.trim() || !form.email.trim()}>
                {saving ? "Creating…" : "Create operator"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}

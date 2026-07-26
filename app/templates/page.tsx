// AC-7 (issue #51): template library page.
// Grid of template cards (reuse the dashboard-grid + card pattern) with
// badges for category/source/frozen-vs-spec. Manual-upload form for adding
// custom templates. Delete is blocked on builtins (the API refuses; the
// button is hidden on builtin cards).

"use client";

import { useCallback, useEffect, useState } from "react";

type Template = {
  id: number;
  name: string;
  description: string;
  category: string;
  spec_json: string;
  pages_json: string | null;
  source: string;
  created_at: string;
};

type LoadState = "loading" | "ready" | "error";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  // Upload-form state.
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "custom",
    specJson: '{\n  "vars": { "--color-primary": "#2563eb" },\n  "voice": "professional"\n}',
    pagesJson: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/templates", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status}).`);
      const data = (await res.json()) as Template[];
      setTemplates(data);
      setState("ready");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data?.error || `Upload failed (HTTP ${res.status}).`);
      }
      setForm((f) => ({ ...f, name: "", description: "" }));
      setShowForm(false);
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: Template) {
    setDeletingId(t.id);
    setFormError(null);
    try {
      const res = await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error || "Built-in templates can't be deleted.");
      }
      if (!res.ok && res.status !== 204) {
        throw new Error(`Delete failed (HTTP ${res.status}).`);
      }
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="page">
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1>Templates</h1>
            <p>Reusable designs for fast, consistent client delivery.</p>
          </div>
          {!showForm && (
            <button className="btn-primary" style={{ width: "auto", marginTop: 0 }} onClick={() => setShowForm(true)}>
              + Upload template
            </button>
          )}
        </div>
      </header>

      {state === "loading" && <div className="card"><div className="preview-empty">Loading…</div></div>}
      {state === "error" && (
        <div className="card">
          <div className="error">
            {error || "Could not load templates."}
            <div style={{ marginTop: 8 }}>
              <button className="btn-secondary" onClick={load}>Try again</button>
            </div>
          </div>
        </div>
      )}
      {state === "ready" && templates.length === 0 && !showForm && (
        <div className="card">
          <div className="preview-empty">
            No templates yet.{" "}
            <button onClick={() => setShowForm(true)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--app-primary)", textDecoration: "underline", fontSize: "inherit",
            }}>Upload one →</button>
          </div>
        </div>
      )}

      {state === "ready" && templates.length > 0 && (
        <div className="dashboard-grid">
          {templates.map((t) => {
            const frozen = t.pages_json !== null && t.pages_json !== "";
            return (
              <article key={t.id} className="template-card">
                <h3 className="project-card-title">{t.name}</h3>
                <p className="project-card-subtitle">{t.description}</p>
                <div className="project-card-meta">
                  <span className="badge badge--theme">{t.category}</span>
                  <span className="badge badge--info">{t.source}</span>
                  {frozen ? (
                    <span className="badge badge--wp-pushed">✓ Frozen HTML</span>
                  ) : (
                    <span className="badge badge--warning">Spec only</span>
                  )}
                </div>
                {/* Delivery flow arrives in #54; for now, no per-card action
                    besides delete (hidden on builtins). */}
                {t.source !== "builtin" && (
                  <div className="project-card-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleDelete(t)}
                      disabled={deletingId === t.id}
                    >
                      {deletingId === t.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Upload template</h2>
          <p className="login-sub" style={{ marginBottom: 12 }}>
            Paste a design spec (required) and optional frozen HTML pages. The spec is JSON with a <code>vars</code> object (CSS variables) and an optional <code>voice</code>.
          </p>
          <form onSubmit={handleUpload}>
            <label htmlFor="name">Name *</label>
            <input id="name" type="text" required value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Spring Retail" />

            <label htmlFor="desc">Description</label>
            <input id="desc" type="text" value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Bright, airy, retail-friendly" />

            <label htmlFor="cat">Category</label>
            <input id="cat" type="text" value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="retail / restaurant / professional / tech / custom" />

            <label htmlFor="spec">Spec JSON * <span className="hint">(object with `vars` + optional `voice`)</span></label>
            <textarea id="spec" required rows={6} value={form.specJson}
              onChange={(e) => setForm((f) => ({ ...f, specJson: e.target.value }))}
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }} />

            <label htmlFor="pages">Frozen pages JSON <span className="hint">(optional — Record&lt;PageKey, html&gt;)</span></label>
            <textarea id="pages" rows={4} value={form.pagesJson}
              onChange={(e) => setForm((f) => ({ ...f, pagesJson: e.target.value }))}
              placeholder='{"home":"<!doctype html>…","services":"…"}'
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }} />

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={saving || !form.name.trim()}>
                {saving ? "Saving…" : "Save template"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
            {formError && <div className="error" style={{ marginTop: 12 }}>{formError}</div>}
          </form>
        </section>
      )}
    </main>
  );
}

// AC-1, AC-3, AC-6 (issue #5): saved-sites dashboard.
// Lists saved sites newest-first (AC-1), with a per-row Delete button that
// calls DELETE /api/sites/[id] and removes the row (AC-3), and a friendly
// empty state linking back to the generator (AC-6). Each row links to
// /sites/[id] for the preview (AC-2).

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SiteListItem = {
  id: number;
  business_name: string;
  theme_id: string;
  created_at: string;
};

type Status = "loading" | "ready" | "error";

export default function SitesPage() {
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/sites", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status}).`);
      const data = (await res.json()) as SiteListItem[];
      setSites(data);
      setStatus("ready");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: number) {
    // AC-3: hard delete via DELETE /api/sites/[id]. No confirmation modal — the
    // generator flow treats these as disposable; the spec's "removes the row"
    // implies immediate removal. (Undo is explicitly out of scope for #5.)
    setDeletingId(id);
    try {
      const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error(`Delete failed (HTTP ${res.status}).`);
      }
      // Remove the row locally; no full refetch needed.
      setSites((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main>
      <header className="app-header">
        <h1>Saved sites</h1>
        <p>Browse, preview, delete, or re-download previously generated sites.</p>
      </header>

      <section className="card">
        {status === "loading" && <div className="preview-empty">Loading…</div>}

        {status === "error" && (
          <div className="error">
            {error || "Could not load sites."}
            <div style={{ marginTop: 8 }}>
              <button className="btn-secondary" onClick={load}>
                Try again
              </button>
            </div>
          </div>
        )}

        {status === "ready" && sites.length === 0 && (
          <div className="preview-empty">
            No saved sites yet.{" "}
            <Link href="/" className="app-nav-link">
              Generate one →
            </Link>
          </div>
        )}

        {status === "ready" && sites.length > 0 && (
          <ul className="site-list">
            {sites.map((s) => (
              <li key={s.id} className="site-row">
                <Link href={`/sites/${s.id}`} className="site-row-main">
                  <span className="site-row-name">{s.business_name || "(untitled)"}</span>
                  <span className="site-row-meta">
                    {s.theme_id} · {formatDate(s.created_at)}
                  </span>
                </Link>
                <button
                  type="button"
                  className="btn-secondary site-row-delete"
                  onClick={() => handleDelete(s.id)}
                  disabled={deletingId === s.id}
                  title="Delete this site"
                >
                  {deletingId === s.id ? "Deleting…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/** ISO → human-readable date. Falls back to the raw string on parse failure. */
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

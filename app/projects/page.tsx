// AC-3, AC-4, AC-5, AC-6 (issue #38): projects dashboard — rich site cards.
// Replaces the flat single-column list (issue #5) with a responsive card grid
// that surfaces status data already in the DB: theme, WP-push state, and the
// number of regenerated versions in the project's group. The data-loading
// logic, delete behavior, and loading/error/empty states are unchanged — only
// the rendering is promoted to dashboard cards.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// AC-1 (issue #38): extended projection — now includes tagline, mode,
// wp_page_ids (WP push state), and group_size (regenerated version count).
type ProjectListItem = {
  id: number;
  business_name: string;
  tagline: string;
  theme_id: string;
  mode: string;
  created_at: string;
  wp_page_ids: string | null;
  group_size: number;
};

type Status = "loading" | "ready" | "error";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status}).`);
      const data = (await res.json()) as ProjectListItem[];
      setProjects(data);
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
    // Hard delete via DELETE /api/projects/[id] (unchanged from issue #5).
    // Optimistic local removal — no full refetch needed.
    setDeletingId(id);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error(`Delete failed (HTTP ${res.status}).`);
      }
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="page">
      <header className="app-header">
        <h1>Projects</h1>
        <p>Browse, preview, delete, or re-download previously generated projects.</p>
      </header>

      <div className="dashboard-grid">
        {status === "loading" && (
          <div className="card dashboard-empty">
            <div className="preview-empty">Loading…</div>
          </div>
        )}

        {status === "error" && (
          <div className="card dashboard-empty">
            <div className="error">
              {error || "Could not load projects."}
              <div style={{ marginTop: 8 }}>
                <button className="btn-secondary" onClick={load}>
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {status === "ready" && projects.length === 0 && (
          <div className="card dashboard-empty">
            <div className="preview-empty">
              No projects yet.{" "}
              <Link href="/" className="app-nav-link">
                Generate one →
              </Link>
            </div>
          </div>
        )}

        {status === "ready" &&
          projects.map((p) => {
            // AC-5: derive status badges from the row.
            const pushed = p.wp_page_ids !== null && p.wp_page_ids !== "";
            const multiVersion = p.group_size > 1;
            return (
              <article key={p.id} className="project-card">
                {/* AC-4(a): title links to the detail page. */}
                <Link href={`/projects/${p.id}`} className="project-card-title">
                  {p.business_name || "(untitled)"}
                </Link>
                {/* AC-4(b): tagline subtitle, only when present. */}
                {p.tagline && <p className="project-card-subtitle">{p.tagline}</p>}

                {/* AC-5: status badges + date meta. */}
                <div className="project-card-meta">
                  <span className="badge badge--theme">{p.theme_id}</span>
                  {pushed ? (
                    <span className="badge badge--wp-pushed">✓ Pushed to WP</span>
                  ) : (
                    <span className="badge badge--wp-local">Local only</span>
                  )}
                  {multiVersion && (
                    <span className="badge badge--version">v{p.group_size}</span>
                  )}
                  <span className="project-card-date">{formatDate(p.created_at)}</span>
                </div>

                {/* AC-4(e): actions row. */}
                <div className="project-card-actions">
                  <Link href={`/projects/${p.id}`} className="btn-primary">
                    Open
                  </Link>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    title="Delete this project"
                  >
                    {deletingId === p.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </article>
            );
          })}
      </div>
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

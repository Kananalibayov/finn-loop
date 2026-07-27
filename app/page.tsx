// AC-2..AC-5, AC-7 (issue #48): operator dashboard home.
// Replaces the old "/" (which was the Generator form, now at /generate).
// Shows: stat cards (counts), quick-action entry points, and the 6 most
// recent projects. Consumes only existing /api/projects + /api/wp/connections.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ProjectListItem = {
  id: number;
  business_name: string;
  tagline: string;
  theme_id: string;
  created_at: string;
  wp_page_ids: string | null;
  group_size: number;
};

type Connection = {
  id: number;
  label: string;
  pairedViaCode?: boolean;
};

type LoadState = "loading" | "ready" | "error";

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setState("loading");
    setError(null);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/wp/connections", { cache: "no-store" }),
      ]);
      if (!pRes.ok) throw new Error(`Projects fetch failed (HTTP ${pRes.status}).`);
      if (!cRes.ok) throw new Error(`Connections fetch failed (HTTP ${cRes.status}).`);
      const pData = (await pRes.json()) as ProjectListItem[];
      const cData = (await cRes.json()) as Connection[];
      setProjects(pData);
      setConnections(cData);
      setState("ready");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  // AC-3: derived stats.
  const pushedCount = projects.filter(
    (p) => p.wp_page_ids !== null && p.wp_page_ids !== "",
  ).length;
  const pairedCount = connections.filter((c) => c.pairedViaCode === true).length;
  const recent = projects.slice(0, 6); // newest-first already

  return (
    <main className="page">
      <header className="app-header">
        <h1>Dashboard</h1>
        <p>Overview of your agency&apos;s sites and connections.</p>
      </header>

      {/* AC-3: stat cards */}
      <div className="stat-grid">
        <StatCard icon="📁" label="Total projects" value={state === "ready" ? projects.length : null} />
        <StatCard icon="🔗" label="WP connections" value={state === "ready" ? connections.length : null} />
        <StatCard icon="✓" label="Pushed to WP" value={state === "ready" ? pushedCount : null} />
        <StatCard icon="🔌" label="Plugin-paired" value={state === "ready" ? pairedCount : null} />
      </div>

      {/* AC-4: quick actions (no data dependency — always render) */}
      <section className="card" style={{ marginTop: 16 }}>
        <h2>Quick actions</h2>
        <div className="quick-actions">
          <Link href="/generate" className="quick-action">
            <span className="quick-action-icon" aria-hidden="true">✨</span>
            <strong>Generate a site</strong>
            <span className="hint">Create a new 5-page site from business info.</span>
          </Link>
          <Link href="/onboard" className="quick-action">
            <span className="quick-action-icon" aria-hidden="true">➕</span>
            <strong>Onboard a client</strong>
            <span className="hint">Guided setup: client info + connect their WordPress.</span>
          </Link>
          <Link href="/connections" className="quick-action">
            <span className="quick-action-icon" aria-hidden="true">🔗</span>
            <strong>Manage connections</strong>
            <span className="hint">View, test, and manage client WP sites.</span>
          </Link>
        </div>
      </section>

      {/* AC-5: recent projects */}
      <section style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Recent projects</h2>
          {state === "ready" && projects.length > 0 && (
            <Link href="/projects" className="app-nav-link">View all →</Link>
          )}
        </div>

        {state === "loading" && (
          <div className="card"><div className="preview-empty">Loading…</div></div>
        )}

        {state === "error" && (
          <div className="card">
            <div className="error">
              {error || "Could not load dashboard."}
              <div style={{ marginTop: 8 }}>
                <button className="btn-secondary" onClick={load}>Try again</button>
              </div>
            </div>
          </div>
        )}

        {state === "ready" && projects.length === 0 && (
          <div className="card">
            <div className="preview-empty">
              No projects yet.{" "}
              <Link href="/generate" className="app-nav-link">Generate one →</Link>
            </div>
          </div>
        )}

        {state === "ready" && recent.length > 0 && (
          <div className="dashboard-grid">
            {recent.map((p) => {
              const pushed = p.wp_page_ids !== null && p.wp_page_ids !== "";
              const multiVersion = p.group_size > 1;
              return (
                <article key={p.id} className="project-card">
                  <Link href={`/projects/${p.id}`} className="project-card-title">
                    {p.business_name || "(untitled)"}
                  </Link>
                  {p.tagline && <p className="project-card-subtitle">{p.tagline}</p>}
                  <div className="project-card-meta">
                    <span className="badge badge--theme">{p.theme_id}</span>
                    {pushed ? (
                      <span className="badge badge--wp-pushed">✓ Pushed</span>
                    ) : (
                      <span className="badge badge--wp-local">Local</span>
                    )}
                    {multiVersion && (
                      <span className="badge badge--version">v{p.group_size}</span>
                    )}
                    <span className="project-card-date">{formatDate(p.created_at)}</span>
                  </div>
                  <div className="project-card-actions">
                    <Link href={`/projects/${p.id}`} className="btn-primary">Open</Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Analytics + recent activity (issue #80) */}
      <AnalyticsSection />
    </main>
  );
}

/** AC-3: a single stat card. value=null renders a placeholder dash while loading. */
function StatCard({ icon, label, value }: { icon: string; label: string; value: number | null }) {
  return (
    <div className="stat-card">
      <span className="stat-card-icon" aria-hidden="true">{icon}</span>
      <div>
        <div className="stat-card-value">{value === null ? "—" : value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
}

/** ISO -> human-readable date. Falls back to the raw string on parse failure. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Analytics section (issue #80): stats cards + recent activity feed. */
function AnalyticsSection() {
  const [data, setData] = useState<{
    stats: {
      totalGenerations: number;
      totalPushes: number;
      totalDeliveries: number;
      totalChangeRequests: number;
      totalClientLogins: number;
    };
    recent: Array<{ id: number; event_type: string; description: string; created_at: string }>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/activity", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const eventIcon: Record<string, string> = {
    generate: "✨",
    push_wp: "📤",
    deliver_template: "📦",
    change_request: "📝",
    client_login: "🔑",
  };

  return (
    <>
      <section style={{ marginTop: 16 }}>
        <h2 style={{ margin: "0 0 12px" }}>Activity</h2>
        <div className="stat-grid">
          <StatCard icon="✨" label="Generations" value={data.stats.totalGenerations} />
          <StatCard icon="📤" label="WP pushes" value={data.stats.totalPushes} />
          <StatCard icon="📦" label="Deliveries" value={data.stats.totalDeliveries} />
          <StatCard icon="📝" label="Change requests" value={data.stats.totalChangeRequests} />
        </div>
      </section>

      {data.recent.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Recent activity</h2>
          <ul className="site-list">
            {data.recent.slice(0, 10).map((a) => (
              <li key={a.id} className="site-row" style={{ padding: "8px 0" }}>
                <span style={{ fontSize: 18, marginRight: 8 }}>{eventIcon[a.event_type] ?? "•"}</span>
                <div className="site-row-main">
                  <span className="site-row-meta">{a.description}</span>
                </div>
                <span className="hint" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

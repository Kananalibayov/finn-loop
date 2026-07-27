// Client portal dashboard: their site preview + WP health + account.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ClientProject = {
  id: number;
  business_name: string;
  theme_id: string;
  created_at: string;
  previewHtml: string;
  wp_connection_id: number | null;
  wp_version: string | null;
  wp_theme_name: string | null;
  plugin_count: number | null;
  health_score: number | null;
  health_reported_at: string | null;
};

type Client = { id: number; name: string; email: string };

export default function PortalDashboard() {
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [requests, setRequests] = useState<Array<{ id: number; instruction: string; status: string; created_at: string; operator_notes: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/portal/me", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/portal/projects", { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
      fetch("/api/portal/requests", { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
    ]).then(([c, p, reqs]) => {
      setClient(c);
      setProjects(Array.isArray(p) ? p : []);
      setRequests(Array.isArray(reqs) ? reqs : []);
      setLoading(false);
    }).catch((e) => {
      setError((e as Error).message);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <main className="page"><div className="preview-empty">Loading…</div></main>;
  }

  return (
    <main className="page">
      <header className="app-header">
        <h1>{client?.name ?? "Client"} Portal</h1>
        <p>Welcome{client ? `, ${client.name}` : ""}. Here&apos;s your website overview.</p>
      </header>

      {projects.length === 0 ? (
        <section className="card">
          <div className="preview-empty">
            No website assigned yet. Your agency will assign one shortly.
          </div>
        </section>
      ) : (
        projects.map((p) => (
          <div key={p.id} style={{ marginBottom: 24 }}>
            {/* Site preview */}
            <section className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>{p.business_name}</h2>
                <span className="badge badge--theme">{p.theme_id}</span>
              </div>
              {p.previewHtml ? (
                <div className="preview-frame-wrap">
                  <iframe title="preview" className="preview-frame" srcDoc={p.previewHtml} />
                </div>
              ) : (
                <div className="preview-empty">No preview available.</div>
              )}
            </section>

            {/* WP Health */}
            {p.wp_connection_id && (
              <section className="card" style={{ marginTop: 16 }}>
                <h2>WordPress Health</h2>
                {p.health_reported_at ? (
                  <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 16px", fontSize: 14 }}>
                    <dt className="hint">WP Version</dt><dd style={{ margin: 0 }}>{p.wp_version ?? "—"}</dd>
                    <dt className="hint">Theme</dt><dd style={{ margin: 0 }}>{p.wp_theme_name ?? "—"}</dd>
                    <dt className="hint">Plugins</dt><dd style={{ margin: 0 }}>{p.plugin_count ?? "—"}</dd>
                    <dt className="hint">Health Score</dt><dd style={{ margin: 0 }}>{p.health_score ?? "—"}/10</dd>
                    <dt className="hint">Last Report</dt><dd style={{ margin: 0 }}>{new Date(p.health_reported_at).toLocaleString()}</dd>
                  </dl>
                ) : (
                  <p className="hint">No health data reported yet.</p>
                )}
              </section>
            )}
          </div>
        ))
      )}

      {/* Change requests */}
      <section className="card" style={{ marginTop: 16 }}>
        <h2>Request a Change</h2>
        <p className="hint" style={{ marginBottom: 12 }}>Describe what you'd like changed on your site. Your agency will review and apply it.</p>
        <textarea
          id="change-request-input"
          placeholder="e.g. 'Update the phone number to +1 (555) 123-4567 and add our new location to the contact page'"
          style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 8, border: "1px solid var(--app-border)", fontSize: 14 }}
        />
        <button
          type="button"
          className="btn-primary"
          style={{ marginTop: 8 }}
          onClick={async () => {
            const el = document.getElementById("change-request-input") as HTMLTextAreaElement;
            const instruction = el.value.trim();
            if (!instruction || !projects[0]?.id) return;
            try {
              const res = await fetch("/api/portal/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId: projects[0].id, instruction }),
              });
              if (res.ok) {
                el.value = "";
                // Reload requests
                setRequests(await (await fetch("/api/portal/requests", { cache: "no-store" })).json());
              }
            } catch { /* non-fatal */ }
          }}
        >
          Submit request
        </button>
      </section>

      {/* Change request history */}
      {requests.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Your Requests</h2>
          <ul className="site-list">
            {requests.map((r) => {
              const badge = r.status === "pending" ? "badge--warning" : r.status === "completed" || r.status === "approved" ? "badge--wp-pushed" : "badge--theme";
              return (
                <li key={r.id} className="site-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                    <span className={`badge ${badge}`}>{r.status}</span>
                    <span className="hint" style={{ marginLeft: "auto" }}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <span style={{ fontSize: 14 }}>{r.instruction}</span>
                  {r.operator_notes && <span className="hint" style={{ fontSize: 12 }}>↳ {r.operator_notes}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Account */}
      <section className="card" style={{ marginTop: 16 }}>
        <h2>Account</h2>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 16px", fontSize: 14 }}>
          <dt className="hint">Name</dt><dd style={{ margin: 0 }}>{client?.name ?? "—"}</dd>
          <dt className="hint">Email</dt><dd style={{ margin: 0 }}>{client?.email ?? "—"}</dd>
        </dl>
      </section>
    </main>
  );
}

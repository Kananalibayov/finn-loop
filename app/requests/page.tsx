// Operator: change requests queue.
"use client";

import { useCallback, useEffect, useState } from "react";

type ChangeRequest = {
  id: number;
  client_id: number;
  project_id: number;
  instruction: string;
  status: string;
  operator_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  client_name: string;
  business_name: string;
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/change-requests", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status}).`);
      setRequests((await res.json()) as ChangeRequest[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id: number, status: string) {
    setActing(id);
    setError(null);
    try {
      const res = await fetch(`/api/change-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: notes[id] || "" }),
      });
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status}).`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActing(null);
    }
  }

  const statusBadge = (s: string) => {
    const cls = s === "pending" ? "badge--warning" : s === "approved" || s === "completed" ? "badge--wp-pushed" : "badge--theme";
    return <span className={`badge ${cls}`}>{s}</span>;
  };

  return (
    <main className="page">
      <header className="app-header">
        <h1>Change Requests</h1>
        <p>Review client change requests. Approve → apply via NL editing (phase 4). Reject → note why.</p>
      </header>

      {loading && <div className="card"><div className="preview-empty">Loading…</div></div>}
      {error && <div className="error">{error}</div>}

      {!loading && requests.length === 0 && (
        <div className="card"><div className="preview-empty">No change requests yet.</div></div>
      )}

      {!loading && requests.length > 0 && (
        <div className="dashboard-grid">
          {requests.map((r) => (
            <article key={r.id} className="connection-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 className="project-card-title">{r.client_name}</h3>
                {statusBadge(r.status)}
              </div>
              <p className="connection-card-subtitle">{r.business_name}</p>
              <div className="notice" style={{ marginTop: 8, fontSize: 13 }}>
                &ldquo;{r.instruction}&rdquo;
              </div>
              <div className="hint" style={{ marginTop: 8, fontSize: 12 }}>
                {new Date(r.created_at).toLocaleString()}
              </div>

              {r.operator_notes && (
                <div className="hint" style={{ marginTop: 8, fontSize: 12 }}>
                  <strong>Notes:</strong> {r.operator_notes}
                </div>
              )}

              {r.status === "pending" && (
                <>
                  <textarea
                    placeholder="Operator notes (optional)…"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 8, border: "1px solid var(--app-border)", fontSize: 13, minHeight: 50 }}
                  />
                  <div className="project-card-actions">
                    <button className="btn-primary" onClick={() => handleAction(r.id, "approved")} disabled={acting === r.id}>
                      {acting === r.id ? "…" : "Approve"}
                    </button>
                    <button className="btn-secondary" onClick={() => handleAction(r.id, "rejected")} disabled={acting === r.id}>
                      Reject
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

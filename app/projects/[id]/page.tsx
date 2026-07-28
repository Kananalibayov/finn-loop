// AC-2, AC-4 (issue #5): single-project preview page (renamed from "site" in #25).
// Fetches GET /api/projects/[id] (the full row incl. pages_json), parses the stored
// pages, and renders them in the same preview UI as the generator: page tabs +
// iframe (srcDoc) + a Download ZIP button that rebuilds the ZIP via /api/zip.

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { BusinessInput, GeneratedPage } from "@/lib/types";

type FullProject = {
  id: number;
  business_name: string;
  pages_json: string;
  input_json: string;
  created_at: string;
  /** AC-3 (issue #44): linked connection id, null if unlinked. */
  wp_connection_id?: number | null;
};

/** AC-6 (issue #44): a connection in the picker list. */
type ConnectionOption = {
  id: number;
  label: string;
  apiUrl: string;
};

type Status = "loading" | "ready" | "not-found" | "error";

export default function ProjectPreviewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [project, setProject] = useState<FullProject | null>(null);
  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [zipping, setZipping] = useState(false);
  // AC-5 (issue #18): per-button busy states for the two new export formats.
  const [buildingHtml, setBuildingHtml] = useState(false);
  const [buildingStatic, setBuildingStatic] = useState(false);
  // AC-6 (issue #30): push-to-WP state.
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);

  // AC-6 (issue #44): connection picker state.
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | "">(project?.wp_connection_id ?? "");
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);

  // AC-4 (issue #16): edit & regenerate state.
  const [editing, setEditing] = useState(false);
  const [editInput, setEditInput] = useState<BusinessInput | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // NL edit state (issue #71).
  const [nlInstruction, setNlInstruction] = useState("");
  const [nlPreview, setNlPreview] = useState<string | null>(null);
  const [nlEditing, setNlEditing] = useState(false);
  const [nlApplying, setNlApplying] = useState(false);

  function setEditField<K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) {
    setEditInput((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setStatus("not-found");
          return;
        }
        if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status}).`);
        const data = (await res.json()) as FullProject;
        const parsed = safeParsePages(data.pages_json);
        if (cancelled) return;
        setProject(data);
        setPages(parsed);
        // AC-6 (issue #44): pre-fill the connection picker with the project's link.
        setSelectedConnectionId(data.wp_connection_id ?? "");
        // AC-4 (issue #16): pre-fill the edit form from the saved input.
        setEditInput(safeParseInput(data.input_json));
        setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // AC-6 (issue #44): load the connection list for the picker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wp/connections", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ConnectionOption[];
        if (!cancelled) setConnections(data);
      } catch {
        // Non-fatal — picker just won't populate; the project still renders.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // AC-6 (issue #44): link/unlink the project to a connection.
  async function handleLink() {
    if (!id) return;
    setLinking(true);
    setLinkResult(null);
    setError(null);
    const connectionId =
      selectedConnectionId === "" ? null : Number(selectedConnectionId);
    try {
      const res = await fetch(`/api/projects/${id}/connection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `Link failed (HTTP ${res.status}).`);
      }
      // Reflect the change locally.
      setProject((prev) =>
        prev ? { ...prev, wp_connection_id: data.ok ? connectionId : prev.wp_connection_id } : prev,
      );
      setLinkResult(
        connectionId === null
          ? "Unlinked — pushes to legacy settings."
          : "Linked — pushes to the selected connection.",
      );
      setTimeout(() => setLinkResult(null), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLinking(false);
    }
  }

  // AC-7 (issue #44): compute the current push-target hint.
  const currentTargetHint = useMemo(() => {
    if (!project) return "";
    if (project.wp_connection_id == null) return "Pushes to: legacy settings (Settings page)";
    const conn = connections.find((c) => c.id === project.wp_connection_id);
    return conn ? `Pushes to: ${conn.label}` : "Pushes to: linked connection";
  }, [project, connections]);

  const previewDoc = useMemo(() => {
    if (!pages.length) return "";
    return pages[Math.min(activePage, pages.length - 1)]?.html ?? "";
  }, [pages, activePage]);

  // AC-4, AC-5 (issue #18): generic export handler — posts pages to an export
  // endpoint and triggers a download of the returned blob.
  async function handleExport(endpoint: string, filename: string, busyKey: "zipping" | "buildingHtml" | "buildingStatic") {
    if (!pages.length) return;
    const setter = busyKey === "zipping" ? setZipping
      : busyKey === "buildingHtml" ? setBuildingHtml
      : setBuildingStatic;
    setter(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pages),
      });
      if (!res.ok) throw new Error(`Export failed (HTTP ${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setter(false);
    }
  }

  // AC-5, AC-6 (issue #16): submit the edit form → regenerate → navigate.
  async function handleRegenerate() {
    if (!editInput || !id) return;
    if (!editInput.businessName.trim()) return;
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: editInput }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error || `Regeneration failed (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as { id: number };
      // Navigate to the freshly-generated version.
      router.push(`/projects/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  // AC-6 (issue #30): push to WordPress.
  async function handlePushWp() {
    if (!id || !pages.length) return;
    setPushing(true);
    setPushResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/push-wp`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { pushed?: number; error?: string };
      if (!res.ok) {
        throw new Error(data?.error || `Push failed (HTTP ${res.status}).`);
      }
      setPushResult(`✓ Pushed ${data.pushed || pages.length} pages as drafts to WordPress`);
    } catch (e) {
      setPushResult(null);
      setError((e as Error).message);
    } finally {
      setPushing(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="page">
        <div className="preview-empty">Loading project…</div>
      </main>
    );
  }

  if (status === "not-found") {
    return (
      <main className="page">
        <section className="card">
          <h2>Project not found</h2>
          <p>This project may have been deleted.</p>
          <Link href="/projects" className="btn-secondary" style={{ display: "inline-block", marginTop: 12 }}>
            ← Back to Projects
          </Link>
        </section>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="page">
        <section className="card">
          <div className="error">{error || "Could not load this project."}</div>
          <Link href="/projects" className="btn-secondary" style={{ display: "inline-block", marginTop: 12 }}>
            ← Back to Projects
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="preview-toolbar">
        <Link href="/projects" className="btn-secondary">
          ← Back
        </Link>
        <h2 style={{ margin: "0 0 0 12px" }}>
          {project?.business_name || "(untitled)"}
        </h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setEditing((v) => !v)}
            disabled={regenerating}
          >
            {editing ? "Close edit" : "Edit & regenerate"}
          </button>
          {/* AC-6 (issue #30): push to WordPress. */}
          <button
            type="button"
            className="btn-primary"
            onClick={handlePushWp}
            disabled={pushing || pages.length === 0}
          >
            {pushing ? "Pushing…" : "Push to WordPress"}
          </button>
        </div>
      </div>

      {/* AC-6, AC-7 (issue #44): connection picker + push-target hint. */}
      <section className="card" style={{ marginBottom: 12, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label htmlFor="conn" style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
            Push target
          </label>
          <select
            id="conn"
            value={selectedConnectionId}
            onChange={(e) => setSelectedConnectionId(e.target.value === "" ? "" : Number(e.target.value))}
            style={{ flex: "1 1 220px", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--app-border)", fontSize: 14, background: "#fff", color: "var(--app-text)" }}
          >
            <option value="">None (use legacy settings)</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleLink}
            disabled={linking}
            style={{ width: "auto", marginTop: 0 }}
          >
            {linking ? "Linking…" : "Link"}
          </button>
        </div>
        <div className="hint" style={{ marginTop: 8, fontSize: 13 }}>
          {currentTargetHint}
        </div>
        {linkResult && (
          <div className="notice" style={{ marginTop: 8, fontSize: 13 }}>{linkResult}</div>
        )}
      </section>

      {/* AC-6 (issue #30): push result inline. */}
      {pushResult && (
        <div className="notice" style={{ marginBottom: 12 }}>{pushResult}</div>
      )}

      {/* AC-4 (issue #16): edit form, pre-filled from the saved input. */}
      {editing && editInput && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2>Edit input</h2>
          <p className="login-sub" style={{ marginBottom: 12 }}>
            Changing these fields re-runs generation with the new input. The
            current version is kept as history (a new row is created).
          </p>
          <label htmlFor="bn">Business name *</label>
          <input
            id="bn"
            type="text"
            value={editInput.businessName}
            onChange={(e) => setEditField("businessName", e.target.value)}
          />
          <label htmlFor="tg">Tagline</label>
          <input
            id="tg"
            type="text"
            value={editInput.tagline}
            onChange={(e) => setEditField("tagline", e.target.value)}
          />
          <label htmlFor="ds">Description</label>
          <textarea
            id="ds"
            value={editInput.description}
            onChange={(e) => setEditField("description", e.target.value)}
          />
          <label htmlFor="sv">
            Services <span className="hint">(one per line)</span>
          </label>
          <textarea
            id="sv"
            value={editInput.services.join("\n")}
            onChange={(e) =>
              setEditField(
                "services",
                e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              )
            }
          />
          <label htmlFor="ph">Phone</label>
          <input
            id="ph"
            type="tel"
            value={editInput.phone}
            onChange={(e) => setEditField("phone", e.target.value)}
          />
          <label htmlFor="em">Email</label>
          <input
            id="em"
            type="email"
            value={editInput.email}
            onChange={(e) => setEditField("email", e.target.value)}
          />
          <label htmlFor="ad">Address</label>
          <textarea
            id="ad"
            value={editInput.address}
            onChange={(e) => setEditField("address", e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={handleRegenerate}
            disabled={regenerating || !editInput.businessName.trim()}
          >
            {regenerating ? "Regenerating…" : "Regenerate site"}
          </button>
          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        </section>
      )}

      {/* NL edit bar (issue #71) */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>NL Edit</h2>
        <p className="hint" style={{ marginBottom: 8 }}>
          Describe a change in plain English. The AI edits the current page ({pages[activePage]?.title}). Preview before saving.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            value={nlInstruction}
            onChange={(e) => setNlInstruction(e.target.value)}
            placeholder="e.g. 'Change the hero heading to Premium Coffee and make the CTA green'"
            style={{ flex: "1 1 300px", padding: "9px 11px", border: "1px solid var(--app-border)", borderRadius: 8, fontSize: 14 }}
            disabled={nlEditing || nlApplying}
          />
          <button
            type="button"
            className="btn-secondary"
            style={{ width: "auto", marginTop: 0 }}
            disabled={nlEditing || !nlInstruction.trim() || pages.length === 0}
            onClick={async () => {
              setNlEditing(true);
              setError(null);
              setNlPreview(null);
              try {
                const res = await fetch(`/api/projects/${id}/nl-edit`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pageKey: pages[activePage]?.key, instruction: nlInstruction }),
                });
                const data = await res.json().catch(() => ({})) as { modifiedHtml?: string; error?: string };
                if (!res.ok || !data.modifiedHtml) throw new Error(data?.error || `Edit failed (HTTP ${res.status}).`);
                setNlPreview(data.modifiedHtml);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setNlEditing(false);
              }
            }}
          >
            {nlEditing ? "Editing…" : "Preview change"}
          </button>
        </div>

        {nlPreview && (
          <div style={{ marginTop: 12 }}>
            <div className="notice" style={{ marginBottom: 8 }}>
              Preview ready. Apply to save as a new version, or discard.
            </div>
            <div className="preview-frame-wrap" style={{ marginBottom: 8 }}>
              <iframe title="nl-preview" className="preview-frame" srcDoc={nlPreview} sandbox="" style={{ height: 300 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto", marginTop: 0 }}
                disabled={nlApplying}
                onClick={async () => {
                  setNlApplying(true);
                  setError(null);
                  try {
                    const res = await fetch(`/api/projects/${id}/nl-edit/apply`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ pageKey: pages[activePage]?.key, modifiedHtml: nlPreview }),
                    });
                    const data = await res.json().catch(() => ({})) as { id?: number; error?: string };
                    if (!res.ok || !data.id) throw new Error(data?.error || `Apply failed (HTTP ${res.status}).`);
                    setNlPreview(null);
                    setNlInstruction("");
                    router.push(`/projects/${data.id}`);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setNlApplying(false);
                  }
                }}
              >
                {nlApplying ? "Saving…" : "Save as new version"}
              </button>
              <button type="button" className="btn-secondary" style={{ width: "auto", marginTop: 0 }} onClick={() => setNlPreview(null)}>
                Discard
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="preview-toolbar">
          <div className="preview-tabs">
            {pages.map((p, i) => (
              <button
                key={p.key}
                className={`preview-tab ${i === activePage ? "active" : ""}`}
                onClick={() => setActivePage(i)}
              >
                {p.title}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              className="btn-secondary"
              onClick={() => handleExport("/api/zip", "generated-site.zip", "zipping")}
              disabled={zipping || buildingHtml || buildingStatic || pages.length === 0}
            >
              {zipping ? "Zipping…" : "Download ZIP"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => handleExport("/api/export/single-html", "site.html", "buildingHtml")}
              disabled={zipping || buildingHtml || buildingStatic || pages.length === 0}
            >
              {buildingHtml ? "Building…" : "Single HTML"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => handleExport("/api/export/static-zip", "static-site.zip", "buildingStatic")}
              disabled={zipping || buildingHtml || buildingStatic || pages.length === 0}
            >
              {buildingStatic ? "Zipping…" : "Static ZIP"}
            </button>
          </div>
        </div>
        <div className="preview-frame-wrap">
          <iframe
            key={activePage}
            title="preview"
            className="preview-frame"
            srcDoc={previewDoc}
            sandbox=""
          />
        </div>
      </section>
    </main>
  );
}

/** Parse pages_json defensively — bad data shouldn't crash the page. */
function safeParsePages(raw: string): GeneratedPage[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as GeneratedPage[];
  } catch {
    return [];
  }
}

/** Parse input_json defensively into a BusinessInput shape, with sane defaults. */
function safeParseInput(raw: string): BusinessInput {
  const fallback: BusinessInput = {
    businessName: "",
    tagline: "",
    description: "",
    services: [],
    phone: "",
    email: "",
    address: "",
    logoUrl: "",
    brandColors: "",
  };
  try {
    const parsed = JSON.parse(raw) as Partial<BusinessInput>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

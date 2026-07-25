// AC-2, AC-4 (issue #5): single-site preview page.
// Fetches GET /api/sites/[id] (the full row incl. pages_json), parses the stored
// pages, and renders them in the same preview UI as the generator: page tabs +
// iframe (srcDoc) + a Download ZIP button that rebuilds the ZIP via /api/zip.

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { BusinessInput, GeneratedPage } from "@/lib/types";

type FullSite = {
  id: number;
  business_name: string;
  pages_json: string;
  input_json: string;
  created_at: string;
};

type Status = "loading" | "ready" | "not-found" | "error";

export default function SitePreviewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [site, setSite] = useState<FullSite | null>(null);
  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [zipping, setZipping] = useState(false);
  // AC-5 (issue #18): per-button busy states for the two new export formats.
  const [buildingHtml, setBuildingHtml] = useState(false);
  const [buildingStatic, setBuildingStatic] = useState(false);

  // AC-4 (issue #16): edit & regenerate state.
  const [editing, setEditing] = useState(false);
  const [editInput, setEditInput] = useState<BusinessInput | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  function setEditField<K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) {
    setEditInput((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/sites/${id}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setStatus("not-found");
          return;
        }
        if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status}).`);
        const data = (await res.json()) as FullSite;
        const parsed = safeParsePages(data.pages_json);
        if (cancelled) return;
        setSite(data);
        setPages(parsed);
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
      const res = await fetch(`/api/sites/${id}/regenerate`, {
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
      router.push(`/sites/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  if (status === "loading") {
    return (
      <main>
        <div className="preview-empty">Loading site…</div>
      </main>
    );
  }

  if (status === "not-found") {
    return (
      <main>
        <section className="card">
          <h2>Site not found</h2>
          <p>This site may have been deleted.</p>
          <Link href="/sites" className="btn-secondary" style={{ display: "inline-block", marginTop: 12 }}>
            ← Back to Saved sites
          </Link>
        </section>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main>
        <section className="card">
          <div className="error">{error || "Could not load this site."}</div>
          <Link href="/sites" className="btn-secondary" style={{ display: "inline-block", marginTop: 12 }}>
            ← Back to Saved sites
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="preview-toolbar">
        <Link href="/sites" className="btn-secondary">
          ← Back
        </Link>
        <h2 style={{ margin: "0 0 0 12px" }}>
          {site?.business_name || "(untitled)"}
        </h2>
        <div style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setEditing((v) => !v)}
            disabled={regenerating}
          >
            {editing ? "Close edit" : "Edit & regenerate"}
          </button>
        </div>
      </div>

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

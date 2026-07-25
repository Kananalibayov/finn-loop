// AC-2, AC-4 (issue #5): single-site preview page.
// Fetches GET /api/sites/[id] (the full row incl. pages_json), parses the stored
// pages, and renders them in the same preview UI as the generator: page tabs +
// iframe (srcDoc) + a Download ZIP button that rebuilds the ZIP via /api/zip.

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { GeneratedPage } from "@/lib/types";

type FullSite = {
  id: number;
  business_name: string;
  pages_json: string;
  created_at: string;
};

type Status = "loading" | "ready" | "not-found" | "error";

export default function SitePreviewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [site, setSite] = useState<FullSite | null>(null);
  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [zipping, setZipping] = useState(false);

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

  async function handleDownload() {
    if (!pages.length) return;
    setZipping(true);
    try {
      const res = await fetch("/api/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pages),
      });
      if (!res.ok) throw new Error("Could not build ZIP.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "generated-site.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setZipping(false);
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
      </div>

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
          <div style={{ marginLeft: "auto" }}>
            <button
              className="btn-secondary"
              onClick={handleDownload}
              disabled={zipping || pages.length === 0}
            >
              {zipping ? "Zipping…" : "Download ZIP"}
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

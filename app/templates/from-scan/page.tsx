// AC-4 (issue #53): live-site URL → template page.
// URL input + optional metadata → POST → on success redirect to /templates.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FromScanPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("scanned");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/templates/from-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name, description, category }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!res.ok || typeof data.id !== "number") {
        throw new Error(data?.error || `Scan failed (HTTP ${res.status}).`);
      }
      router.push("/templates");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <div className="preview-toolbar">
        <Link href="/templates" className="btn-secondary">← Back</Link>
        <h2 style={{ margin: "0 0 0 12px" }}>From URL</h2>
      </div>

      <section className="card">
        <p className="login-sub" style={{ marginBottom: 12 }}>
          Paste a website URL — gpt-4o fetches the HTML and reproduces the site&apos;s design as a reusable
          template (extracted palette/fonts + 5 frozen pages). Takes ~30-90s.
        </p>
        <p className="hint" style={{ marginTop: -4, marginBottom: 12 }}>
          Note: some sites render content with JavaScript, which we can&apos;t execute. Results for those
          sites may be approximate.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="url">Website URL *</label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            autoFocus
            disabled={submitting}
          />

          <label htmlFor="nm">Name <span className="hint">(optional — defaults to &quot;Scanned &lt;hostname&gt;&quot;)</span></label>
          <input
            id="nm"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Scanned Co"
            disabled={submitting}
          />

          <label htmlFor="ds">Description</label>
          <input
            id="ds"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Extracted from a reference site."
            disabled={submitting}
          />

          <label htmlFor="ct">Category</label>
          <input
            id="ct"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="scanned / professional / retail / ..."
            disabled={submitting}
          />

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !url.trim()}
          >
            {submitting ? (
              <>
                <span className="spinner" />
                Scanning… can take 30-90s
              </>
            ) : (
              "Scan site"
            )}
          </button>

          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        </form>
      </section>
    </main>
  );
}

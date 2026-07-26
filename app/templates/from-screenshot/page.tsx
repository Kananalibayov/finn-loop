// AC-4 (issue #52): screenshot → template intake page.
// Upload a design screenshot + optional name/description/category, submit,
// and on success redirect to /templates where the new card appears. Reuses
// the logo-upload widget pattern from the generator.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FromScreenshotPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("scanned");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (name) form.append("name", name);
      if (description) form.append("description", description);
      if (category) form.append("category", category);
      const res = await fetch("/api/templates/from-screenshot", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!res.ok || typeof data.id !== "number") {
        throw new Error(data?.error || `Generation failed (HTTP ${res.status}).`);
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
        <h2 style={{ margin: "0 0 0 12px" }}>From screenshot</h2>
      </div>

      <section className="card">
        <p className="login-sub" style={{ marginBottom: 12 }}>
          Upload a screenshot of a design — a reference site, a Figma mock, even a sketch. gpt-4o will
          analyze it and produce a reusable template (extracted palette + 5 frozen pages). Takes ~30-90s.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="ss">Screenshot *</label>
          <div className="logo-upload">
            <input
              id="ss"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => document.getElementById("ss")?.click()}
              disabled={submitting}
            >
              {file ? "Change file" : "Choose image"}
            </button>
            {file && (
              <span className="logo-name">✓ {file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
            )}
          </div>
          <span className="hint">PNG, JPEG, or WebP. Max 2 MB.</span>

          <label htmlFor="nm">Name <span className="hint">(optional — defaults to "From screenshot …")</span></label>
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
            disabled={submitting || !file}
          >
            {submitting ? (
              <>
                <span className="spinner" />
                Generating… can take 30-90s
              </>
            ) : (
              "Generate template"
            )}
          </button>

          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        </form>
      </section>
    </main>
  );
}

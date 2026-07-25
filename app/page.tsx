"use client";

import { useMemo, useState } from "react";
import { THEMES, ThemeId } from "@/lib/themes";
import { BusinessInput, GenerateResponse, Mode } from "@/lib/types";

type Status = "idle" | "loading" | "done" | "error";

export default function HomePage() {
  // AC-1: form fields
  const [input, setInput] = useState<BusinessInput>({
    businessName: "",
    tagline: "",
    description: "",
    services: [],
    phone: "",
    email: "",
    address: "",
    logoUrl: "",
    brandColors: "",
  });
  const [servicesText, setServicesText] = useState("");
  // AC-2: mode selector
  const [mode, setMode] = useState<Mode>("full");
  // AC-3: theme picker
  const [themeId, setThemeId] = useState<ThemeId>("minimal");

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [zipping, setZipping] = useState(false);
  // AC-5, AC-6 (issue #17): logo upload state.
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string>("");

  function set<K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) {
    setInput((s) => ({ ...s, [key]: value }));
  }

  // AC-5 (issue #17): upload the selected logo file, store the returned URL.
  async function handleLogoUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads/logo", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data?.error || `Upload failed (HTTP ${res.status}).`);
      }
      set("logoUrl", data.url);
      setLogoName(file.name);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const canSubmit =
    status !== "loading" && input.businessName.trim().length > 0;

  async function handleGenerate() {
    setStatus("loading");
    setError(null);
    setResult(null);
    setActivePage(0);

    // Parse the services textarea into a list (one per non-empty line).
    const services = servicesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { ...input, services },
          mode,
          themeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Generation failed (HTTP ${res.status}).`);
      }
      setResult(data as GenerateResponse);
      setStatus("done");
    } catch (e) {
      setError((e as Error).message || "Generation failed.");
      setStatus("error");
    }
  }

  async function handleDownload() {
    if (!result) return;
    setZipping(true);
    try {
      const res = await fetch("/api/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.pages),
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

  const previewDoc = useMemo(() => {
    if (!result?.pages?.length) return "";
    return result.pages[Math.min(activePage, result.pages.length - 1)]?.html ?? "";
  }, [result, activePage]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>AI Website Generator</h1>
        <p>Enter business info. Get a 5-page website you can preview and download.</p>
      </header>

      <div className="grid">
        {/* ---------------- Left: form ---------------- */}
        <section className="card">
          <h2>Business info</h2>

          <label htmlFor="bn">Business name *</label>
          <input
            id="bn"
            type="text"
            value={input.businessName}
            onChange={(e) => set("businessName", e.target.value)}
            placeholder="Sunrise Coffee"
          />

          <label htmlFor="tg">Tagline</label>
          <input
            id="tg"
            type="text"
            value={input.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="Fresh roast daily"
          />

          <label htmlFor="ds">Description</label>
          <textarea
            id="ds"
            value={input.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="A neighborhood coffee shop serving single-origin espresso, pastries, and a calm place to work."
          />

          <label htmlFor="sv">Services <span className="hint">(one per line)</span></label>
          <textarea
            id="sv"
            value={servicesText}
            onChange={(e) => setServicesText(e.target.value)}
            placeholder={"Espresso bar\nFresh pastries\nCoffee subscriptions"}
          />

          <label htmlFor="ph">Phone</label>
          <input
            id="ph"
            type="tel"
            value={input.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 (555) 010-2030"
          />

          <label htmlFor="em">Email</label>
          <input
            id="em"
            type="email"
            value={input.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="hello@sunrisecoffee.com"
          />

          <label htmlFor="ad">Address</label>
          <textarea
            id="ad"
            value={input.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder={"123 Market St\nSpringfield, CA 90001"}
          />

          {/* AC-5 (issue #17): logo upload widget (replaces the old URL field). */}
          <label htmlFor="lg">Logo <span className="hint">(optional — upload a file)</span></label>
          <div className="logo-upload">
            <input
              id="lg"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handleLogoUpload(e.target.files?.[0])}
              disabled={uploading}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => document.getElementById("lg")?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Choose logo file"}
            </button>
            {logoName && !uploading && (
              <span className="logo-name">✓ {logoName}</span>
            )}
            {input.logoUrl && !logoName && (
              <span className="logo-name hint">(existing logo set)</span>
            )}
          </div>
          {uploadError && (
            <div className="error" style={{ marginTop: 8 }}>{uploadError}</div>
          )}

          <label htmlFor="bc">Brand colors <span className="hint">(optional, e.g. "#1d4ed8, warm earth tones")</span></label>
          <input
            id="bc"
            type="text"
            value={input.brandColors}
            onChange={(e) => set("brandColors", e.target.value)}
            placeholder="leave blank to use theme defaults"
          />

          {/* AC-2 */}
          <label>Generation mode</label>
          <div className="segmented" role="tablist" aria-label="Generation mode">
            <button
              type="button"
              className={mode === "full" ? "active" : ""}
              onClick={() => setMode("full")}
            >
              Full site (5 pages)
            </button>
            <button
              type="button"
              className={mode === "home" ? "active" : ""}
              onClick={() => setMode("home")}
            >
              Homepage only
            </button>
          </div>

          {/* AC-3 */}
          <label>Theme</label>
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-card ${themeId === t.id ? "active" : ""}`}
                onClick={() => setThemeId(t.id)}
                title={t.description}
              >
                <div
                  className="theme-swatch"
                  style={{
                    background: `linear-gradient(90deg, ${t.vars["--color-bg"]} 0 33%, ${t.vars["--color-primary"]} 33% 66%, ${t.vars["--color-surface"]} 66%)`,
                  }}
                />
                <span className="name">{t.name.split(" ")[0]}</span>
                <span className="desc">{t.name.replace(/^[^(]*\(/, "").replace(/\)$/, "")}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleGenerate}
            disabled={!canSubmit}
          >
            {status === "loading" ? (
              <>
                <span className="spinner" />
                Generating…
              </>
            ) : (
              `Generate ${mode === "full" ? "5-page site" : "homepage"}`
            )}
          </button>

          {/* AC-4 / AC-9 */}
          {status === "error" && error && (
            <div className="error">
              {error}
              <div style={{ marginTop: 8 }}>
                <button className="btn-secondary" onClick={handleGenerate}>
                  Try again
                </button>
              </div>
            </div>
          )}

          {status === "done" && result?.defaultsApplied && (
            <div className="notice">
              {result.defaultsApplied.logo || result.defaultsApplied.colors
                ? "Used sensible defaults for: " +
                  [
                    result.defaultsApplied.logo ? "logo" : null,
                    result.defaultsApplied.colors ? "colors" : null,
                  ]
                    .filter(Boolean)
                    .join(", ") +
                  "."
                : "Used your logo and brand colors."}
            </div>
          )}
        </section>

        {/* ---------------- Right: preview ---------------- */}
        <section className="card">
          <h2>Preview</h2>

          {status !== "done" || !result ? (
            <div className="preview-empty">
              {status === "loading"
                ? "Generating pages… this can take 20–60 seconds."
                : "Your generated site will appear here."}
            </div>
          ) : (
            <>
              <div className="preview-toolbar">
                <div className="preview-tabs">
                  {result.pages.map((p, i) => (
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
                    disabled={zipping}
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
            </>
          )}
        </section>
      </div>
    </div>
  );
}

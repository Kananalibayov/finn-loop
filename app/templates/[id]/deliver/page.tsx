// AC-5, AC-7 (issue #54): deliver-a-site-from-template form.
// Fetches the template, renders client-info fields + delivery-mode selector
// (with a live preview of which mode will run) + optional connection picker,
// and POSTs to /api/templates/[id]/deliver. On success redirects to the
// delivered project's preview page.

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { BusinessInput } from "@/lib/types";
import { TEMPLATE_PLACEHOLDERS } from "@/lib/template-placeholders";

type Template = {
  id: number;
  name: string;
  description: string;
  category: string;
  pages_json: string | null;
};

type Connection = { id: number; label: string };
type DeliverMode = "frozen" | "guided" | "auto";

type Status = "loading" | "ready" | "not-found" | "error";

export default function DeliverFromTemplatePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [template, setTemplate] = useState<Template | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  // Client info form.
  const [input, setInput] = useState<BusinessInput>({
    businessName: "",
    tagline: "",
    description: "",
    services: [],
    phone: "",
    email: "",
    address: "",
  });
  const [servicesText, setServicesText] = useState("");

  // Delivery options.
  const [mode, setMode] = useState<DeliverMode>("auto");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState<number | "">("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/templates/${id}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setStatus("not-found");
          return;
        }
        if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status}).`);
        const data = (await res.json()) as Template;
        if (cancelled) return;
        setTemplate(data);
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

  // Load connections for the picker (reuse the #44 pattern).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wp/connections", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Connection[];
        if (!cancelled) setConnections(data);
      } catch {
        // Non-fatal — picker just won't populate.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasFrozen = template?.pages_json !== null && template?.pages_json !== "";

  // AC-7: live preview of which mode will actually run.
  const modePreview = useMemo(() => {
    if (!template) return "";
    if (mode === "frozen") return "Will deliver via: frozen HTML (instant, no AI call).";
    if (mode === "guided") return "Will deliver via: LLM-guided generation (~20-60s).";
    // auto
    return hasFrozen
      ? "Will deliver via: frozen HTML (instant, no AI call)."
      : "Will deliver via: LLM-guided generation (~20-60s).";
  }, [mode, hasFrozen, template]);

  function setField<K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  async function handleDeliver() {
    if (!id || !template) return;
    if (!input.businessName.trim()) return;
    setSubmitting(true);
    setError(null);
    const services = servicesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch(`/api/templates/${id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { ...input, services },
          mode,
          connectionId: connectionId === "" ? null : Number(connectionId),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!res.ok || typeof data.id !== "number") {
        throw new Error(data?.error || `Delivery failed (HTTP ${res.status}).`);
      }
      router.push(`/projects/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="page">
        <div className="preview-empty">Loading template…</div>
      </main>
    );
  }

  if (status === "not-found") {
    return (
      <main className="page">
        <section className="card">
          <h2>Template not found</h2>
          <Link href="/templates" className="btn-secondary" style={{ display: "inline-block", marginTop: 12 }}>
            ← Back to Templates
          </Link>
        </section>
      </main>
    );
  }

  if (status === "error" || !template) {
    return (
      <main className="page">
        <section className="card">
          <div className="error">{error || "Could not load this template."}</div>
          <Link href="/templates" className="btn-secondary" style={{ display: "inline-block", marginTop: 12 }}>
            ← Back to Templates
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="preview-toolbar">
        <Link href="/templates" className="btn-secondary">← Back</Link>
        <h2 style={{ margin: "0 0 0 12px" }}>Deliver: {template.name}</h2>
      </div>

      <section className="card">
        <p className="login-sub" style={{ marginBottom: 12 }}>
          {template.description}
        </p>

        <label htmlFor="bn">Business name *</label>
        <input
          id="bn"
          type="text"
          value={input.businessName}
          onChange={(e) => setField("businessName", e.target.value)}
          placeholder="Acme Corp"
          autoFocus
        />

        <label htmlFor="tg">Tagline</label>
        <input
          id="tg"
          type="text"
          value={input.tagline}
          onChange={(e) => setField("tagline", e.target.value)}
          placeholder="Fresh roast daily"
        />

        <label htmlFor="ds">Description</label>
        <textarea
          id="ds"
          value={input.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="A short description of the business."
        />

        <label htmlFor="sv">Services <span className="hint">(one per line)</span></label>
        <textarea
          id="sv"
          value={servicesText}
          onChange={(e) => setServicesText(e.target.value)}
          placeholder={"Espresso bar\nFresh pastries"}
        />

        <label htmlFor="ph">Phone</label>
        <input
          id="ph"
          type="tel"
          value={input.phone}
          onChange={(e) => setField("phone", e.target.value)}
          placeholder="+1 (555) 010-2030"
        />

        <label htmlFor="em">Email</label>
        <input
          id="em"
          type="email"
          value={input.email}
          onChange={(e) => setField("email", e.target.value)}
          placeholder="hello@acme.com"
        />

        <label htmlFor="ad">Address</label>
        <textarea
          id="ad"
          value={input.address}
          onChange={(e) => setField("address", e.target.value)}
          placeholder={"123 Market St\nSpringfield, CA"}
        />
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Delivery method</h2>
        <div className="segmented" role="tablist" aria-label="Delivery method" style={{ marginTop: 4 }}>
          <button
            type="button"
            className={mode === "frozen" ? "active" : ""}
            onClick={() => setMode("frozen")}
            disabled={!hasFrozen}
            title={hasFrozen ? "Substitute placeholders in the template's frozen HTML — instant." : "This template has no frozen HTML (spec-only)."}
          >
            Frozen {hasFrozen ? "" : "(n/a)"}
          </button>
          <button
            type="button"
            className={mode === "guided" ? "active" : ""}
            onClick={() => setMode("guided")}
          >
            Guided (AI)
          </button>
          <button
            type="button"
            className={mode === "auto" ? "active" : ""}
            onClick={() => setMode("auto")}
          >
            Auto
          </button>
        </div>
        <div className="hint" style={{ marginTop: 8, fontSize: 13 }}>
          {modePreview}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Connection <span className="hint">(optional)</span></h2>
        <p className="login-sub" style={{ marginBottom: 12 }}>
          Link the delivered site to a client&apos;s WordPress so you can push it there from the project page.
        </p>
        <select
          value={connectionId}
          onChange={(e) => setConnectionId(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--app-border)", fontSize: 14, background: "#fff", color: "var(--app-text)" }}
        >
          <option value="">None (deliver unlinked)</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Placeholders <span className="hint">(frozen templates only)</span></h2>
        <p className="hint" style={{ fontSize: 13 }}>
          Frozen templates substitute these tokens with the client info above: {TEMPLATE_PLACEHOLDERS.join(", ")}.
        </p>
      </section>

      {error && <div className="error" style={{ marginTop: 16 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={handleDeliver}
          disabled={submitting || !input.businessName.trim()}
        >
          {submitting ? "Delivering…" : "Deliver site"}
        </button>
        <Link href="/templates" className="btn-secondary">Cancel</Link>
      </div>
    </main>
  );
}

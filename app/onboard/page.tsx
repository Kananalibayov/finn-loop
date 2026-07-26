// AC-1..AC-6 (issue #42): client onboarding wizard.
// A guided 3-step flow (Client info -> Connect -> Done) that orchestrates the
// existing connection/pairing APIs — no new endpoints, no DB changes.
// Step 2 offers two paths: enter WP creds manually (POST /api/wp/connections)
// or generate a one-time pairing code (POST /api/wp/pairing/generate) to hand
// to the client for plugin auto-connect.

"use client";

import Link from "next/link";
import { useState } from "react";

type Step = 1 | 2 | 3;
type ConnectMethod = "manual" | "pairing";

/** AC-4: derive the WP REST API URL from a site URL (append /wp-json if
 *  missing). Mirrors the logic in /api/wp/pairing/register's deriveApiUrl. */
function deriveApiUrl(siteUrl: string): string {
  const trimmed = siteUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/wp-json")) return trimmed;
  return `${trimmed}/wp-json`;
}

export default function OnboardPage() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 — client info. label is the only persisted field (used as the
  // connection label). contactName/contactEmail are held in state only for
  // the Step 3 summary (NG-2: no DB column for them yet).
  const [label, setLabel] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Step 2 — connection method + per-method form state.
  const [method, setMethod] = useState<ConnectMethod>("manual");
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");

  // Async state.
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 3 — result summary.
  const [createdConnectionId, setCreatedConnectionId] = useState<number | null>(null);
  const [generatedCode, setGeneratedCode] = useState<{ code: string; expiresAt: string } | null>(null);

  function resetWizard() {
    setStep(1);
    setLabel("");
    setContactName("");
    setContactEmail("");
    setMethod("manual");
    setSiteUrl("");
    setUsername("");
    setAppPassword("");
    setSubmitting(false);
    setError(null);
    setCreatedConnectionId(null);
    setGeneratedCode(null);
  }

  // AC-4: manual path — POST the connection, advance on success.
  async function handleManualConnect() {
    setError(null);
    if (!label.trim() || !siteUrl.trim() || !username.trim() || !appPassword.trim()) {
      setError("All fields are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/wp/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          apiUrl: deriveApiUrl(siteUrl.trim()),
          username: username.trim(),
          appPassword: appPassword.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!res.ok || typeof data.id !== "number") {
        throw new Error(data?.error || `Connect failed (HTTP ${res.status}).`);
      }
      setCreatedConnectionId(data.id);
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // AC-5: pairing path — generate a code (does not wait for plugin registration).
  async function handleGenerateCode() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/wp/pairing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string; expiresAt?: string; error?: string };
      if (!res.ok || !data.code || !data.expiresAt) {
        throw new Error(data?.error || `Generate failed (HTTP ${res.status}).`);
      }
      setGeneratedCode({ code: data.code, expiresAt: data.expiresAt });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyCode() {
    if (generatedCode) navigator.clipboard.writeText(generatedCode.code);
  }

  const stepsMeta = [
    { n: 1 as Step, label: "Client info" },
    { n: 2 as Step, label: "Connect" },
    { n: 3 as Step, label: "Done" },
  ];

  return (
    <main className="page">
      <header className="app-header">
        <h1>Onboard a client</h1>
        <p>Guided setup: capture client info, connect their WordPress, and you&apos;re done.</p>
      </header>

      <section className="card wizard">
        {/* AC-1: stepper header. */}
        <ol className="wizard-steps">
          {stepsMeta.map((s) => (
            <li
              key={s.n}
              className={`wizard-step ${step === s.n ? "active" : ""} ${step > s.n ? "done" : ""}`}
            >
              <span className="wizard-step-num">{step > s.n ? "✓" : s.n}</span>
              <span className="wizard-step-label">{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="wizard-body">
          {/* ---------------- Step 1: Client info ---------------- */}
          {step === 1 && (
            <>
              <label htmlFor="lbl">Client name *</label>
              <input
                id="lbl"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Acme Corp"
                autoFocus
              />
              <label htmlFor="cn">Contact name <span className="hint">(optional)</span></label>
              <input
                id="cn"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Jane Doe"
              />
              <label htmlFor="ce">Contact email <span className="hint">(optional)</span></label>
              <input
                id="ce"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="jane@acme.com"
              />
              {error && <div className="error">{error}</div>}
              <div className="wizard-actions">
                <Link href="/connections" className="btn-secondary">Cancel</Link>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!label.trim()}
                  onClick={() => { setError(null); setStep(2); }}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* ---------------- Step 2: Connect ---------------- */}
          {step === 2 && (
            <>
              {/* AC-3: method selection. */}
              <div className="wizard-options">
                <button
                  type="button"
                  className={`wizard-option ${method === "manual" ? "selected" : ""}`}
                  onClick={() => { setMethod("manual"); setError(null); }}
                >
                  <strong>Enter credentials manually</strong>
                  <span className="hint">You have the client&apos;s WP username + application password.</span>
                </button>
                <button
                  type="button"
                  className={`wizard-option ${method === "pairing" ? "selected" : ""}`}
                  onClick={() => { setMethod("pairing"); setError(null); setGeneratedCode(null); }}
                >
                  <strong>Generate a pairing code</strong>
                  <span className="hint">The client installs our plugin and enters the code — auto-connects.</span>
                </button>
              </div>

              {/* AC-4: manual sub-form. */}
              {method === "manual" && (
                <div className="wizard-subform">
                  <label htmlFor="su">WordPress site URL *</label>
                  <input
                    id="su"
                    type="url"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://client-site.com"
                  />
                  <label htmlFor="un">Username *</label>
                  <input
                    id="un"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="wp-admin-user"
                  />
                  <label htmlFor="ap">Application Password *</label>
                  <input
                    id="ap"
                    type="password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    autoComplete="off"
                  />
                </div>
              )}

              {/* AC-5: pairing sub-form. */}
              {method === "pairing" && (
                <div className="wizard-subform">
                  {!generatedCode ? (
                    <p className="login-sub">
                      We&apos;ll generate a one-time code for <strong>{label}</strong>.
                      The client enters it in our plugin on their WordPress — the plugin auto-connects.
                    </p>
                  ) : (
                    <div className="wizard-code-display">
                      <div className="wizard-code">{generatedCode.code}</div>
                      <button type="button" className="btn-secondary" onClick={handleCopyCode}>
                        Copy code
                      </button>
                      <p className="hint" style={{ marginTop: 8 }}>
                        Expires: {new Date(generatedCode.expiresAt).toLocaleString()}
                      </p>
                      <p className="hint">
                        Install the companion plugin on the client&apos;s WordPress and enter this code. The plugin auto-connects.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {error && <div className="error">{error}</div>}
              <div className="wizard-actions">
                <button type="button" className="btn-secondary" onClick={() => { setError(null); setStep(1); }}>
                  Back
                </button>
                {method === "manual" ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={submitting}
                    onClick={handleManualConnect}
                  >
                    {submitting ? "Connecting…" : "Connect & finish"}
                  </button>
                ) : (
                  !generatedCode ? (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={submitting}
                      onClick={handleGenerateCode}
                    >
                      {submitting ? "Generating…" : "Generate pairing code"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setStep(3)}
                    >
                      Finish
                    </button>
                  )
                )}
              </div>
            </>
          )}

          {/* ---------------- Step 3: Done ---------------- */}
          {step === 3 && (
            <div className="wizard-done">
              <div className="notice" style={{ marginBottom: 16 }}>
                ✓ Client onboarded
              </div>
              <dl className="wizard-summary">
                <dt>Client</dt>
                <dd>{label}</dd>
                {contactName && (<><dt>Contact</dt><dd>{contactName}</dd></>)}
                {contactEmail && (<><dt>Email</dt><dd>{contactEmail}</dd></>)}
                <dt>Connection method</dt>
                <dd>{method === "manual" ? "Manual credentials" : "Pairing code (plugin)"}</dd>
                {method === "manual" && createdConnectionId !== null && (
                  <><dt>Connection ID</dt><dd>#{createdConnectionId}</dd></>
                )}
                {method === "pairing" && generatedCode && (
                  <><dt>Pairing code</dt><dd><code>{generatedCode.code}</code></dd></>
                )}
              </dl>
              <div className="wizard-actions">
                <Link href="/connections" className="btn-primary">View connection</Link>
                <button type="button" className="btn-secondary" onClick={resetWizard}>
                  Onboard another
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

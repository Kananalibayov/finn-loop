// AC-8 (issue #68): client login page. PUBLIC.

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function ClientLoginForm() {
  const search = useSearchParams();
  const next = search.get("next") || "/portal";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });
      if (res.ok) {
        const data = await res.json() as { redirect: string };
        window.location.href = data.redirect;
      } else {
        setError("Invalid email or password.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card login-card" onSubmit={handleSubmit}>
      <h1>Client Portal</h1>
      <p className="login-sub">Sign in to view your website and request changes.</p>

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="client@acme.com"
        required
        autoFocus
      />

      <label htmlFor="pw">Password</label>
      <input
        id="pw"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button
        type="submit"
        className="btn-primary"
        disabled={loading || !email || !password}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      {error && <div className="error">{error}</div>}
    </form>
  );
}

export default function PortalLoginPage() {
  return (
    <div className="login-shell">
      <Suspense fallback={<div className="card login-card">Loading…</div>}>
        <ClientLoginForm />
      </Suspense>
    </div>
  );
}

// AC-2 (issue #6): single-admin login form.
// Posts to /api/login (route handler). On success the server sets the session
// cookie and redirects to ?next or /. Wrong password shows a generic error.
// The form is wrapped in <Suspense> because useSearchParams() requires it
// during static prerender.

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const search = useSearchParams();
  const next = search.get("next") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, next }),
      });
      if (res.ok) {
        const data = (await res.json()) as { redirect: string };
        // Server set the cookie; navigate to the destination.
        window.location.href = data.redirect;
      } else {
        // Generic error — never reveal whether the password was wrong vs. other.
        setError("Incorrect password.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card login-card" onSubmit={handleSubmit}>
      <h1>Admin login</h1>
      <p className="login-sub">Sign in to manage generated sites.</p>

      <label htmlFor="pw">Password</label>
      <input
        id="pw"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoFocus
      />

      <button
        type="submit"
        className="btn-primary"
        disabled={loading || password.length === 0}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      {error && <div className="error">{error}</div>}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="login-shell">
      <Suspense fallback={<div className="login-card card">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

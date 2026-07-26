// AC-1 (issue #63): manage WP settings page.
// Reads current settings from the plugin, shows a form, syncs on save.

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Settings = {
  blogname?: string;
  blogdescription?: string;
  blog_public?: number;
  posts_per_page?: number;
  default_comment_status?: string;
  moderation_notify?: number;
};

type Status = "loading" | "ready" | "not-found" | "error";

export default function ManageSettingsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wp/connections/${id}/settings`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setStatus("not-found");
          return;
        }
        if (!res.ok) throw new Error(`Failed (HTTP ${res.status})`);
        const data = (await res.json()) as Settings;
        if (!cancelled) {
          setSettings(data);
          setStatus("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setStatus("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setError(null);
    setSaveResult(null);
    try {
      const res = await fetch(`/api/wp/connections/${id}/sync-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `Sync failed (HTTP ${res.status})`);
      }
      setSaveResult("Settings synced to WordPress ✓");
      setTimeout(() => setSaveResult(null), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return <main className="page"><div className="preview-empty">Loading settings…</div></main>;
  }
  if (status === "not-found" || status === "error") {
    return (
      <main className="page">
        <section className="card">
          <div className="error">{error || "Could not load this connection."}</div>
          <Link href="/connections" className="btn-secondary" style={{ display: "inline-block", marginTop: 12 }}>← Back</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="preview-toolbar">
        <Link href="/connections" className="btn-secondary">← Back</Link>
        <h2 style={{ margin: "0 0 0 12px" }}>Manage WP Settings</h2>
      </div>

      <section className="card">
        <h2>Site</h2>
        <label htmlFor="bn">Site Title</label>
        <input id="bn" type="text" value={settings.blogname ?? ""}
          onChange={(e) => setSettings((s) => ({ ...s, blogname: e.target.value }))} />

        <label htmlFor="bd">Tagline</label>
        <input id="bd" type="text" value={settings.blogdescription ?? ""}
          onChange={(e) => setSettings((s) => ({ ...s, blogdescription: e.target.value }))} />

        <label htmlFor="bp">Site Visibility</label>
        <select id="bp" value={settings.blog_public ?? 1}
          onChange={(e) => setSettings((s) => ({ ...s, blog_public: Number(e.target.value) }))}>
          <option value={1}>Public (indexable)</option>
          <option value={0}>Private (discourage search engines)</option>
        </select>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Reading</h2>
        <label htmlFor="ppp">Posts per page</label>
        <input id="ppp" type="number" min={5} max={100} value={settings.posts_per_page ?? 10}
          onChange={(e) => setSettings((s) => ({ ...s, posts_per_page: Number(e.target.value) }))} />
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Discussion</h2>
        <label htmlFor="dcs">Default comment status</label>
        <select id="dcs" value={settings.default_comment_status ?? "open"}
          onChange={(e) => setSettings((s) => ({ ...s, default_comment_status: e.target.value }))}>
          <option value="open">Allow comments</option>
          <option value="closed">Comments closed</option>
        </select>

        <label htmlFor="mn">Email me on new comment</label>
        <select id="mn" value={settings.moderation_notify ?? 1}
          onChange={(e) => setSettings((s) => ({ ...s, moderation_notify: Number(e.target.value) }))}>
          <option value={1}>Yes</option>
          <option value={0}>No</option>
        </select>
      </section>

      {error && <div className="error" style={{ marginTop: 16 }}>{error}</div>}
      {saveResult && <div className="notice" style={{ marginTop: 16 }}>{saveResult}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Syncing…" : "Sync to WordPress"}
        </button>
        <Link href="/connections" className="btn-secondary">Cancel</Link>
      </div>
    </main>
  );
}

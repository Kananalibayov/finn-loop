// Apply a change request via NL editing: edit all pages using the instruction,
// save as a new version, mark the request completed, optionally push to WP.
// Issue #100 (GAP-LEDGER §8.1): editor-or-above — a viewer could otherwise apply
// pending requests and skip operator approval entirely.
import { NextRequest, NextResponse } from "next/server";
import {
  getChangeRequestById,
  resolveChangeRequest,
  getProject,
  regenerateProject,
  getWpSettings,
  getWpConnection,
} from "@/lib/db";
import { applyEdit } from "@/lib/nl-edit";
import { notifyClientRequestCompleted } from "@/lib/email";
import { WpClient } from "@/lib/wp";
import { COOKIE_NAME, requireRole } from "@/lib/auth";
import type { GeneratedPage, PageKey } from "@/lib/types";

const PAGE_SLUG: Record<PageKey, string> = {
  home: "home",
  services: "services",
  gallery: "gallery",
  contact: "contact",
  about: "about",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRole(req.cookies.get(COOKIE_NAME)?.value, "editor");
  if (!session) {
    return NextResponse.json({ error: "Editor access or above required." }, { status: 403 });
  }

  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: { pushToWp?: boolean };
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {
    body = {};
  }

  const cr = getChangeRequestById(num);
  if (!cr) {
    return NextResponse.json({ error: "Change request not found." }, { status: 404 });
  }
  if (cr.status !== "pending" && cr.status !== "approved") {
    return NextResponse.json(
      { error: `Cannot apply a ${cr.status} request.` },
      { status: 400 },
    );
  }

  const project = getProject(cr.project_id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  // Parse pages.
  let pages: GeneratedPage[];
  try {
    pages = JSON.parse(project.pages_json) as GeneratedPage[];
  } catch {
    return NextResponse.json({ error: "Failed to parse project pages." }, { status: 500 });
  }

  // Apply the NL edit to each page and retain the observed result for accounting.
  const results: Array<{ key: PageKey; ok: true } | { key: PageKey; ok: false; error: string }> = [];
  const editedPages: GeneratedPage[] = [];
  for (const page of pages) {
    try {
      const modifiedHtml = await applyEdit(page.html, cr.instruction);
      results.push({ key: page.key, ok: true });
      editedPages.push({ ...page, html: modifiedHtml });
    } catch (e) {
      results.push({ key: page.key, ok: false, error: (e as Error).message });
      editedPages.push(page);
    }
  }

  const edited = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok) as Array<{
    key: PageKey;
    ok: false;
    error: string;
  }>;
  const failureNotes = `Failed pages: ${failed.map((result) => `${result.key}: ${result.error}`).join("; ")}`;

  if (pages.length > 0 && failed.length === pages.length) {
    const resolved = resolveChangeRequest(num, "failed", failureNotes, ["pending", "approved"]);
    if (!resolved) {
      return NextResponse.json(
        { error: "Request is no longer in a state that allows this transition." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, status: "failed", failed }, { status: 502 });
  }

  // Save as a new version.
  const newProjectId = regenerateProject(project.site_group_id, {
    businessName: project.business_name,
    tagline: project.tagline,
    themeId: project.theme_id,
    mode: project.mode,
    inputJson: project.input_json,
    pagesJson: JSON.stringify(editedPages),
  });

  // Optionally push to WP.
  let pushed = 0;
  let skipped = 0;
  const pushFailed: Array<{ key: PageKey; error: string }> = [];
  if (body.pushToWp) {
    let creds: { apiUrl: string; username: string; appPassword: string } | null = null;

    if (project.wp_connection_id) {
      const conn = getWpConnection(project.wp_connection_id);
      if (conn) {
        creds = { apiUrl: conn.api_url, username: conn.username, appPassword: conn.app_password };
      }
    }
    if (!creds) {
      const s = getWpSettings();
      if (s) creds = { apiUrl: s.api_url, username: s.username, appPassword: s.app_password };
    }

    if (creds) {
      const client = new WpClient(creds);
      try {
        // Read existing WP page IDs from the project.
        let wpPageIds: Record<string, number> = {};
        if (project.wp_page_ids) {
          try {
            wpPageIds = JSON.parse(project.wp_page_ids) as Record<string, number>;
          } catch (e) {
            console.error("[apply] failed to parse WordPress page IDs:", (e as Error).message);
          }
        }
        for (const result of edited) {
          const page = editedPages.find((candidate) => candidate.key === result.key)!;
          const wpId = wpPageIds[page.key];
          if (!wpId) {
            skipped += 1;
            continue;
          }
          try {
            await client.updatePage(wpId, { title: page.title, content: page.html });
            pushed += 1;
          } catch (e) {
            const error = (e as Error).message;
            pushFailed.push({ key: page.key, error });
            console.error(`[apply] failed to push page ${page.key}:`, error);
          }
        }
      } catch (e) {
        console.error("[apply] failed to read WordPress page IDs:", (e as Error).message);
      }
    }
  }

  const ok = failed.length === 0 && pushFailed.length === 0;
  if (!ok) {
    const notes = failed.length > 0
      ? failureNotes
      : `Push failures: ${pushFailed.map((result) => `${result.key}: ${result.error}`).join("; ")}`;
    const resolved = resolveChangeRequest(num, "failed", notes, ["pending", "approved"]);
    if (!resolved) {
      return NextResponse.json(
        { error: "Request is no longer in a state that allows this transition." },
        { status: 409 },
      );
    }
  } else {
    const resolved = resolveChangeRequest(
      num,
      "completed",
      `Applied as project #${newProjectId}`,
      ["pending", "approved"],
    );
    if (!resolved) {
      return NextResponse.json(
        { error: "Request is no longer in a state that allows this transition." },
        { status: 409 },
      );
    }

    const { getClientById } = await import("@/lib/db");
    const client = getClientById(cr.client_id);
    if (client) {
      notifyClientRequestCompleted(client.email, client.name, cr.instruction).catch((error) => {
        console.error("[apply] failed to notify client:", (error as Error).message);
      });
    }
  }

  return NextResponse.json({
    ok,
    newProjectId,
    status: ok ? "completed" : "failed",
    edited,
    failed,
    pushed,
    skipped,
    pushFailed,
  });
}

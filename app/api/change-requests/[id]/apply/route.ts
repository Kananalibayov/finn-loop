// Apply a change request via NL editing: edit all pages using the instruction,
// save as a new version, mark the request completed, optionally push to WP.
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

  // Apply the NL edit to each page (the instruction applies to the whole site).
  const editedPages: GeneratedPage[] = [];
  for (const page of pages) {
    try {
      const modifiedHtml = await applyEdit(page.html, cr.instruction);
      editedPages.push({ ...page, html: modifiedHtml });
    } catch {
      // If a page fails, keep the original (partial success > total failure).
      editedPages.push(page);
    }
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

  // Mark the request completed.
  resolveChangeRequest(num, "completed", `Applied as project #${newProjectId}`);

  // Notify client (best-effort).
  const { getClientById } = await import("@/lib/db");
  const client = getClientById(cr.client_id);
  if (client) {
    notifyClientRequestCompleted(client.email, client.name, cr.instruction).catch(() => {});
  }

  // Optionally push to WP.
  let pushed = 0;
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
          try { wpPageIds = JSON.parse(project.wp_page_ids) as Record<string, number>; } catch { /* fresh */ }
        }
        for (const page of editedPages) {
          const wpId = wpPageIds[page.key];
          if (wpId) {
            await client.updatePage(wpId, { title: page.title, content: page.html });
          }
        }
        pushed = editedPages.length;
      } catch {
        // Push failure is non-fatal — the edit is saved; operator can push manually.
      }
    }
  }

  return NextResponse.json({
    ok: true,
    newProjectId,
    status: "completed",
    pushed,
  });
}

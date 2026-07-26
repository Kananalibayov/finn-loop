// AC-5 (issue #30): push generated content to WordPress as draft pages.
// First push creates 5 pages; re-push updates them by stored WP page ID.

import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProjectWpPageIds, getWpSettings, getWpConnection } from "@/lib/db";
import { WpClient } from "@/lib/wp";
import type { GeneratedPage, PageKey } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Map page key → WP slug (used as the URL slug in WordPress). */
const PAGE_SLUG: Record<PageKey, string> = {
  home: "home",
  services: "services",
  gallery: "gallery",
  contact: "contact",
  about: "about",
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  // Load the project.
  const project = getProject(num);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  // AC-5 (issue #44): resolve the push target with precedence:
  //  (1) the project's linked wp_connections row (if set + still exists), else
  //  (2) the legacy wp_settings row (backward compat for unlinked projects).
  let creds: { apiUrl: string; username: string; appPassword: string } | null = null;

  if (project.wp_connection_id != null) {
    const conn = getWpConnection(project.wp_connection_id);
    if (conn) {
      creds = {
        apiUrl: conn.api_url,
        username: conn.username,
        appPassword: conn.app_password,
      };
    }
    // If the linked connection was deleted, fall through to legacy below.
  }

  if (!creds) {
    const wpSettings = getWpSettings();
    if (wpSettings) {
      creds = {
        apiUrl: wpSettings.api_url,
        username: wpSettings.username,
        appPassword: wpSettings.app_password,
      };
    }
  }

  if (!creds) {
    return NextResponse.json(
      { error: "WordPress not configured. Link a connection on this project or set up the legacy Settings." },
      { status: 400 },
    );
  }

  // Parse the pages from the stored JSON.
  let pages: GeneratedPage[];
  try {
    const parsed = JSON.parse(project.pages_json);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return NextResponse.json(
        { error: "This project has no pages to push." },
        { status: 400 },
      );
    }
    pages = parsed as GeneratedPage[];
  } catch {
    return NextResponse.json(
      { error: "Failed to parse project pages." },
      { status: 500 },
    );
  }

  // Construct the WP client from the resolved credentials (AC-5 issue #44).
  const client = new WpClient(creds);

  // Check if this project was already pushed (has stored WP page IDs).
  let wpPageIds: Record<string, number> = {};
  if (project.wp_page_ids) {
    try {
      wpPageIds = JSON.parse(project.wp_page_ids) as Record<string, number>;
    } catch {
      // Corrupt JSON — treat as first push.
      wpPageIds = {};
    }
  }

  const isFirstPush = Object.keys(wpPageIds).length === 0;

  try {
    const results: Record<string, number> = {};

    for (const page of pages) {
      const slug = PAGE_SLUG[page.key] || page.key;

      if (isFirstPush) {
        // AC-5 step 4: first push — check if a page with this slug already
        // exists in WP (prevents duplicates on retry after partial failure).
        const existingId = await client.getPageIdBySlug(slug);
        let wpId: number;
        if (existingId) {
          // Page exists (from a previous partial push) — update it.
          await client.updatePage(existingId, {
            title: page.title,
            content: page.html,
          });
          wpId = existingId;
        } else {
          // Create new draft page.
          wpId = await client.createPage({
            title: page.title,
            slug,
            content: page.html,
            status: "draft",
          });
        }
        results[page.key] = wpId;
      } else {
        // AC-5 step 5: re-push — update existing page by stored WP ID.
        const wpId = wpPageIds[page.key];
        if (wpId) {
          await client.updatePage(wpId, {
            title: page.title,
            content: page.html,
          });
          results[page.key] = wpId;
        } else {
          // No stored ID for this page (shouldn't happen, but handle gracefully).
          const newId = await client.createPage({
            title: page.title,
            slug,
            content: page.html,
            status: "draft",
          });
          results[page.key] = newId;
        }
      }
    }

    // Persist the WP page IDs for future re-pushes.
    updateProjectWpPageIds(num, results);

    return NextResponse.json(
      { pushed: pages.length, pageIds: results },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Push to WordPress failed." },
      { status: 502 },
    );
  }
}

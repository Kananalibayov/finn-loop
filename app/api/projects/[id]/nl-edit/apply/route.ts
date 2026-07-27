// NL edit apply: save the modified page as a new project version.
import { NextRequest, NextResponse } from "next/server";
import { getProject, regenerateProject } from "@/lib/db";
import type { GeneratedPage } from "@/lib/types";

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

  const project = getProject(num);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  let body: { pageKey?: string; modifiedHtml?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { pageKey, modifiedHtml } = body;
  if (!pageKey || !modifiedHtml) {
    return NextResponse.json({ error: "pageKey and modifiedHtml are required." }, { status: 400 });
  }

  // Parse current pages, replace the target page's HTML, save as new version.
  let pages: GeneratedPage[];
  try {
    pages = JSON.parse(project.pages_json) as GeneratedPage[];
  } catch {
    return NextResponse.json({ error: "Failed to parse project pages." }, { status: 500 });
  }

  const pageIndex = pages.findIndex((p) => p.key === pageKey);
  if (pageIndex < 0) {
    return NextResponse.json({ error: `Page "${pageKey}" not found.` }, { status: 404 });
  }

  pages[pageIndex] = { ...pages[pageIndex], html: modifiedHtml };

  const newId = regenerateProject(project.site_group_id, {
    businessName: project.business_name,
    tagline: project.tagline,
    themeId: project.theme_id,
    mode: project.mode,
    inputJson: project.input_json,
    pagesJson: JSON.stringify(pages),
  });

  return NextResponse.json({ id: newId, pageKey }, { status: 201 });
}

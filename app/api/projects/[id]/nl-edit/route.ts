// NL edit: preview a change before applying. Returns modified HTML for preview.
import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db";
import { applyEdit } from "@/lib/nl-edit";
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

  let body: { pageKey?: string; instruction?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const pageKey = body.pageKey;
  const instruction = body.instruction?.trim();
  if (!pageKey || !instruction) {
    return NextResponse.json({ error: "pageKey and instruction are required." }, { status: 400 });
  }

  // Find the current page's HTML.
  let pages: GeneratedPage[];
  try {
    pages = JSON.parse(project.pages_json) as GeneratedPage[];
  } catch {
    return NextResponse.json({ error: "Failed to parse project pages." }, { status: 500 });
  }

  const page = pages.find((p) => p.key === pageKey);
  if (!page) {
    return NextResponse.json({ error: `Page "${pageKey}" not found.` }, { status: 404 });
  }

  try {
    const modifiedHtml = await applyEdit(page.html, instruction);
    return NextResponse.json({ modifiedHtml, pageKey });
  } catch (e) {
    const msg = (e as Error).message || "Edit failed.";
    return NextResponse.json(
      { error: /OPENAI|API|network/i.test(msg) ? `AI edit failed: ${msg}` : msg },
      { status: 502 },
    );
  }
}

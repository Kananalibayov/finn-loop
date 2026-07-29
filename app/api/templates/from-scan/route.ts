// AC-3 (issue #53): live-site URL scan → template intake endpoint.
// Accepts { url, name?, description?, category? }, fetches + analyzes via
// gpt-4o, inserts a template with source="scan".

import { NextRequest, NextResponse } from "next/server";
import { generateTemplateFromUrl } from "@/lib/template-from-url";
import { insertTemplate } from "@/lib/db";
import { UnsafeTargetError } from "@/lib/net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { url?: string; name?: string; description?: string; category?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required." }, { status: 400 });
  }

  // Pre-validate the URL client-side of the fetch (clearer error than fetch's).
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return NextResponse.json({ error: "URL must be http or https." }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid URL. Must include the scheme (e.g. https://example.com)." },
      { status: 400 },
    );
  }

  const name = body.name?.trim() || `Scanned ${new URL(url).hostname}`;
  const description = body.description?.trim() || `Scanned from ${new URL(url).hostname}`;
  const category = body.category?.trim() || "scanned";

  let generated: Awaited<ReturnType<typeof generateTemplateFromUrl>>;
  try {
    generated = await generateTemplateFromUrl(url);
  } catch (e) {
    const msg = (e as Error).message || "Scan failed.";
    console.error("[from-scan] failed:", msg);
    if (e instanceof UnsafeTargetError) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    // Distinguish validation errors (400) from upstream/fetch/parse errors (502).
    const isValidation = /Invalid URL|must be http/i.test(msg);
    return NextResponse.json(
      { error: msg },
      { status: isValidation ? 400 : 502 },
    );
  }

  const row = insertTemplate({
    name,
    description,
    category,
    specJson: JSON.stringify(generated.spec),
    pagesJson: JSON.stringify(generated.pages),
    source: "scan",
  });
  return NextResponse.json(row, { status: 201 });
}

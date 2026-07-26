// AC-3, AC-4 (issue #51): template library list + manual-upload intake.
// GET returns all templates; POST accepts a manual template (spec + optional
// frozen pages). Operator-only (behind middleware).

import { NextRequest, NextResponse } from "next/server";
import { listTemplates, insertTemplate } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** AC-3: list all templates newest-first. No secrets in a template — return
 *  the rows as-is (the safe projection is the full row). */
export async function GET() {
  return NextResponse.json(listTemplates());
}

/** AC-4: manual-upload intake. Validates name + specJson, parses both as JSON,
 *  sets source="manual". pagesJson is optional (spec-only templates allowed). */
export async function POST(req: NextRequest) {
  let body: {
    name?: string;
    description?: string;
    category?: string;
    specJson?: string; // a JSON string (object of { vars, voice? })
    pagesJson?: string; // a JSON string (Record<PageKey, html>), optional
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, description, category, specJson, pagesJson } = body ?? {};

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  if (!specJson?.trim()) {
    return NextResponse.json({ error: "specJson is required." }, { status: 400 });
  }

  // Validate specJson parses as an object with a `vars` field.
  let parsedSpec: unknown;
  try {
    parsedSpec = JSON.parse(specJson);
  } catch {
    return NextResponse.json({ error: "specJson is not valid JSON." }, { status: 400 });
  }
  if (typeof parsedSpec !== "object" || parsedSpec === null || !("vars" in parsedSpec)) {
    return NextResponse.json(
      { error: "specJson must be an object with a `vars` field." },
      { status: 400 },
    );
  }

  // pagesJson is optional; if provided, it must parse to an object.
  let validatedPages: string | null = null;
  if (pagesJson !== undefined && pagesJson !== null && pagesJson.trim() !== "") {
    try {
      const parsedPages = JSON.parse(pagesJson);
      if (typeof parsedPages !== "object" || parsedPages === null) {
        throw new Error("not an object");
      }
    } catch {
      return NextResponse.json({ error: "pagesJson is not valid JSON." }, { status: 400 });
    }
    validatedPages = pagesJson;
  }

  const row = insertTemplate({
    name: name.trim(),
    description: description?.trim() ?? "",
    category: category?.trim() || "custom",
    specJson,
    pagesJson: validatedPages,
    source: "manual",
  });
  return NextResponse.json(row, { status: 201 });
}

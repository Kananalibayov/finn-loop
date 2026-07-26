// AC-5, AC-6 (issue #51): single-template detail + delete.
// GET returns the full row; DELETE removes non-builtin templates but REFUSES
// builtins (they're managed by the app). Operator-only (behind middleware).

import { NextRequest, NextResponse } from "next/server";
import { getTemplate, deleteTemplate } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** AC-6: return the full template row for the detail/deliver page (#54). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const row = getTemplate(num);
  if (!row) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  return NextResponse.json(row);
}

/** AC-5: delete a template. Builtins are protected (source='builtin') — they
 *  can only be removed by changing the seeded data in code, not from the UI. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const row = getTemplate(num);
  if (!row) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  if (row.source === "builtin") {
    return NextResponse.json(
      { error: "Built-in templates cannot be deleted from the UI." },
      { status: 409 },
    );
  }
  deleteTemplate(num);
  return new NextResponse(null, { status: 204 });
}

// Operator: approve/reject a change request.
import { NextRequest, NextResponse } from "next/server";
import { resolveChangeRequest } from "@/lib/db";

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

  let body: { status?: string; notes?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const status = body.status;
  if (status !== "approved" && status !== "rejected" && status !== "completed") {
    return NextResponse.json({ error: "status must be 'approved', 'rejected', or 'completed'." }, { status: 400 });
  }

  const row = resolveChangeRequest(num, status, body.notes?.trim() || null);
  if (!row) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  return NextResponse.json(row);
}

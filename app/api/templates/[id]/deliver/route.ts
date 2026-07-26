// AC-4 (issue #54): deliver a site from a template.
// POST /api/templates/[id]/deliver { input, mode, connectionId? }.
// Produces a sites row via the hybrid model (frozen substitution or LLM-guided),
// optionally links it to a connection, and returns the new project id.

import { NextRequest, NextResponse } from "next/server";
import { getTemplate, insertProject, updateProjectConnectionId, getWpConnection } from "@/lib/db";
import { deliverFromTemplate, type DeliverMode } from "@/lib/template-deliver";
import type { BusinessInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  const template = getTemplate(num);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  // Parse + validate body.
  let body: { input?: BusinessInput; mode?: DeliverMode; connectionId?: number | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = body.input;
  const mode: DeliverMode = body.mode ?? "auto";

  if (!input || typeof input !== "object") {
    return NextResponse.json({ error: "input is required." }, { status: 400 });
  }
  if (!input.businessName?.trim()) {
    return NextResponse.json({ error: "input.businessName is required." }, { status: 400 });
  }
  if (mode !== "frozen" && mode !== "guided" && mode !== "auto") {
    return NextResponse.json(
      { error: "mode must be 'frozen', 'guided', or 'auto'." },
      { status: 400 },
    );
  }

  // Normalize the input (ensure services is an array, fill defaults).
  const normalizedInput: BusinessInput = {
    businessName: input.businessName.trim(),
    tagline: input.tagline?.trim() ?? "",
    description: input.description?.trim() ?? "",
    services: Array.isArray(input.services)
      ? input.services.map((s) => String(s).trim()).filter(Boolean)
      : [],
    phone: input.phone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    address: input.address?.trim() ?? "",
    logoUrl: input.logoUrl?.trim() || undefined,
    brandColors: input.brandColors?.trim() || undefined,
  };

  // Deliver (frozen or guided).
  let delivered: Awaited<ReturnType<typeof deliverFromTemplate>>;
  try {
    delivered = await deliverFromTemplate(template, normalizedInput, mode);
  } catch (e) {
    const msg = (e as Error).message || "Delivery failed.";
    // OpenAI / network errors during guided generation → 502 (upstream).
    // Everything else (frozen-on-spec-only, corrupt JSON, missing page) → 400.
    const isUpstream = /OPENAI|API|network|timeout/i.test(msg);
    return NextResponse.json(
      { error: isUpstream ? `Guided generation failed: ${msg}` : msg },
      { status: isUpstream ? 502 : 400 },
    );
  }

  // Insert as a normal sites row.
  const projectId = insertProject({
    businessName: normalizedInput.businessName,
    tagline: normalizedInput.tagline,
    themeId: delivered.themeId,
    mode: "full",
    inputJson: JSON.stringify(normalizedInput),
    pagesJson: JSON.stringify(delivered.pages),
  });

  // Optionally link to a connection (validate it exists).
  let linkedConnectionId: number | null = null;
  if (body.connectionId !== undefined && body.connectionId !== null) {
    if (!Number.isInteger(body.connectionId) || body.connectionId <= 0) {
      return NextResponse.json(
        { error: "connectionId must be a positive integer or null." },
        { status: 400 },
      );
    }
    const conn = getWpConnection(body.connectionId);
    if (!conn) {
      return NextResponse.json(
        { error: `Connection ${body.connectionId} does not exist.` },
        { status: 404 },
      );
    }
    updateProjectConnectionId(projectId, body.connectionId);
    linkedConnectionId = body.connectionId;
  }

  return NextResponse.json(
    { id: projectId, modeUsed: delivered.modeUsed, connectionId: linkedConnectionId },
    { status: 201 },
  );
}

// Client: submit + list their change requests.
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionRole } from "@/lib/auth";
import { createChangeRequest, listChangeRequestsForClient, logActivity } from "@/lib/db";
import { notifyOperatorChangeRequest } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionRole(token);
  if (!session || session.role !== "client" || !session.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(listChangeRequestsForClient(session.clientId));
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionRole(token);
  if (!session || session.role !== "client" || !session.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: number; instruction?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const instruction = body.instruction?.trim();
  if (!instruction) {
    return NextResponse.json({ error: "instruction is required." }, { status: 400 });
  }
  if (!Number.isInteger(body.projectId) || (body.projectId as number) <= 0) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const row = createChangeRequest({
    clientId: session.clientId,
    projectId: body.projectId as number,
    instruction,
  });
  logActivity({
    eventType: "change_request",
    description: `Client submitted change request: "${instruction.substring(0, 80)}"`,
    clientId: session.clientId,
    projectId: body.projectId as number,
  });

  // Notify operator (best-effort, non-blocking).
  const { getClientById, getProject } = await import("@/lib/db");
  const client = getClientById(session.clientId);
  const project = getProject(body.projectId as number);
  if (client && project) {
    notifyOperatorChangeRequest(instruction, client.name, project.business_name).catch(() => {});
  }

  const { client_id: _cid, ...safe } = row;
  return NextResponse.json(safe, { status: 201 });
}

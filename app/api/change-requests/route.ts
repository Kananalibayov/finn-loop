// Operator: list all change requests.
import { NextResponse } from "next/server";
import { listChangeRequests } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listChangeRequests());
}

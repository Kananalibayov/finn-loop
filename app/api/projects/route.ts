// AC-4 (issue #4): list saved projects newest-first (projection only).

import { NextResponse } from "next/server";
import { listProjects } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = listProjects();
  return NextResponse.json(rows);
}

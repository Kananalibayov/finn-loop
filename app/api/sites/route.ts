// AC-4 (issue #4): list saved sites newest-first (projection only).

import { NextResponse } from "next/server";
import { listSites } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = listSites();
  return NextResponse.json(rows);
}

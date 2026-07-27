// Analytics: activity feed + stats summary. Operator-only.
import { NextResponse } from "next/server";
import { listRecentActivity, getActivityStats } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    stats: getActivityStats(),
    recent: listRecentActivity(20),
  });
}

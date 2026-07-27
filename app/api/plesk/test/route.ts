// Test Plesk connection. Operator-only.
import { NextResponse } from "next/server";
import { getPleskConfig } from "@/lib/db";
import { testPleskConnection } from "@/lib/plesk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const config = getPleskConfig();
  if (!config) {
    return NextResponse.json({ error: "Plesk not configured. Enter settings first." }, { status: 400 });
  }
  try {
    const info = await testPleskConnection(config);
    return NextResponse.json({ ok: true, ...info });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

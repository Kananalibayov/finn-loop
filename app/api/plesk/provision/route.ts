// Provision a new WP site via Plesk. Operator-only.
import { NextRequest, NextResponse } from "next/server";
import { getPleskConfig, logActivity } from "@/lib/db";
import { provisionWpSite } from "@/lib/plesk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const config = getPleskConfig();
  if (!config) {
    return NextResponse.json({ error: "Plesk not configured." }, { status: 400 });
  }

  let body: { domain?: string; wpEmail?: string; wpTitle?: string };
  try { body = (await req.json()) as typeof body; } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const domain = body.domain?.trim();
  const wpEmail = body.wpEmail?.trim();
  if (!domain || !wpEmail) {
    return NextResponse.json({ error: "domain and wpEmail are required." }, { status: 400 });
  }

  try {
    const result = await provisionWpSite(config, {
      domain,
      wpEmail,
      wpTitle: body.wpTitle?.trim() || domain,
    });

    logActivity({
      eventType: "plesk_provision",
      description: `Provisioned WordPress on ${domain} via Plesk`,
    });

    return NextResponse.json({
      ok: true,
      domain,
      wpUrl: result.wpInstance.url,
      subscriptionId: result.subscription.id,
      wpInstanceId: result.wpInstance.id,
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

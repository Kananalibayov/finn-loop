// Branding API: GET (safe) + PUT (update). Operator-only.
import { NextRequest, NextResponse } from "next/server";
import { getBranding, saveBranding } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getBranding());
}

export async function PUT(req: NextRequest) {
  let body: { agencyName?: string; agencyLogoUrl?: string; primaryColor?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  saveBranding({
    agencyName: body.agencyName?.trim(),
    agencyLogoUrl: body.agencyLogoUrl?.trim(),
    primaryColor: body.primaryColor?.trim(),
  });
  return NextResponse.json(getBranding());
}

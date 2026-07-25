// AC-4 (issue #23): POST /api/wp/test — test a WP connection with provided creds.
// Accepts { apiUrl, username, appPassword } in the body, constructs a WpClient,
// calls testConnection(), and returns the result. This is the backend the
// Settings page (#24) will call from its "Test connection" button.

import { NextRequest, NextResponse } from "next/server";
import { WpClient, type WpCreds } from "@/lib/wp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Partial<WpCreds>;
  try {
    body = (await req.json()) as Partial<WpCreds>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { apiUrl, username, appPassword } = body ?? {};
  // Validate all three fields are present + non-empty.
  if (!apiUrl?.trim() || !username?.trim() || !appPassword?.trim()) {
    return NextResponse.json(
      { error: "apiUrl, username, and appPassword are all required." },
      { status: 400 },
    );
  }

  // Basic URL shape check — must start with http:// or https://.
  if (!/^https?:\/\//i.test(apiUrl.trim())) {
    return NextResponse.json(
      { error: "apiUrl must start with http:// or https://" },
      { status: 400 },
    );
  }

  const client = new WpClient({
    apiUrl: apiUrl.trim(),
    username: username.trim(),
    appPassword: appPassword.trim(),
  });
  const result = await client.testConnection();

  // Return the WpTestResult as-is (200 for both ok + !ok — the body carries
  // the verdict, matching the spec's "errors are returned in the result shape").
  return NextResponse.json(result, { status: 200 });
}

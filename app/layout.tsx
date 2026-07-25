// AC-3, AC-6 (issue #36): root layout now renders the enterprise shell
// (Sidebar + main) ONLY for authenticated routes. When the user is not
// authenticated, the page (e.g. /login) renders centered, with no sidebar.
//
// Auth detection is server-side and read-only: we check the session cookie
// with the same verifySession() the middleware uses. No auth semantics change
// — the middleware still enforces protection; this is purely presentational.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import AppShell from "@/app/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Website Generator",
  description: "Enter business info, get a 5-page website.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // AC-6: read the session cookie server-side. verifySession is the exact
  // function the middleware uses, so the visible chrome matches the gate.
  // (Next.js 15: cookies() is async and must be awaited.)
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const authenticated = await verifySession(token);

  return (
    <html lang="en">
      <body>
        {authenticated ? <AppShell>{children}</AppShell> : children}
      </body>
    </html>
  );
}

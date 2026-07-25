// AC-5 (issue #5): shared top nav linking the generator (/) and the saved-sites
// list (/sites). Active link is highlighted via usePathname(). Lives in a client
// component because usePathname() is a client-side hook.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Generator" },
  { href: "/sites", label: "Saved sites" },
] as const;

/** True when `href` corresponds to the active route. "/" matches only "/". */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Nav() {
  const pathname = usePathname() || "/";
  return (
    <nav className="app-nav">
      <div className="app-nav-inner">
        <span className="app-nav-brand">AI Website Generator</span>
        <div className="app-nav-links">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`app-nav-link ${isActive(pathname, l.href) ? "active" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

// AC-1, AC-2, AC-7 (issue #36): enterprise app-shell sidebar.
// Replaces the old top nav (app/components/Nav.tsx, deleted in this issue).
//
// Features:
// - Grouped vertical nav: Create (Generator), Manage (Projects, Connections),
//   Configure (Settings).
// - Collapsible: a toggle in the brand row collapses to an icon-only rail
//   (≈64px) or expands to full width (≈240px). State is remembered across
//   navigations via sessionStorage key "sidebar.collapsed".
// - Active highlight via usePathname() (same isActive() rule as the old nav).
// - Mobile (<900px): rendered as an overlay drawer; the layout drives
//   open/close via props (mobileOpen + onClose). The drawer closes on route
//   change (handled here via a pathname effect).

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "sidebar.collapsed";

type OperatorProfile = { id: number; name: string; role: string };

type NavItem = {
  href: string;
  label: string;
  icon: string; // simple glyph; no icon library (NG-5)
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const GROUPS: NavGroup[] = [
  {
    label: "Create",
    items: [
      { href: "/", label: "Dashboard", icon: "🏠" },
      { href: "/generate", label: "Generator", icon: "✨" },
      { href: "/onboard", label: "Onboard client", icon: "➕" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/projects", label: "Projects", icon: "📁" },
      { href: "/templates", label: "Templates", icon: "🎨" },
      { href: "/connections", label: "Connections", icon: "🔗" },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/clients", label: "Clients", icon: "👥" },
      { href: "/operators", label: "Team", icon: "🔐" },
      { href: "/settings", label: "Settings", icon: "⚙️" },
    ],
  },
];

/** True when `href` corresponds to the active route. "/" matches only "/". */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Read the initial collapsed state from sessionStorage + viewport width.
 * On viewports < 900px the sidebar starts collapsed (per AC-2). */
function readInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.innerWidth < 900) return true; // AC-2: mobile starts collapsed
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    // sessionStorage may be unavailable (private mode) — fall through.
  }
  return false;
}

export default function Sidebar({
  mobileOpen,
  onClose,
}: {
  /** Mobile drawer open state (controlled by the layout). On desktop this is
   *  ignored — the sidebar is always in the document flow. */
  mobileOpen: boolean;
  /** Close handler — invoked when a nav link is clicked (so the drawer closes
   *  on navigation, AC-7) or when the backdrop is clicked. */
  onClose: () => void;
}) {
  const pathname = usePathname() || "/";
  const [collapsed, setCollapsed] = useState(false);
  const [operator, setOperator] = useState<OperatorProfile | null>(null);

  // AC-10 (issue #74): fetch the current operator's profile for the footer.
  useEffect(() => {
    fetch("/api/operators/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setOperator(d as OperatorProfile); })
      .catch(() => {});
  }, []);

  // AC-2: initialize from sessionStorage after mount (avoid SSR mismatch).
  useEffect(() => {
    setCollapsed(readInitialCollapsed());
  }, []);

  // AC-2: persist collapsed state.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Ignore write failures (private mode, quota, etc.).
    }
  }, [collapsed]);

  // AC-7: close the mobile drawer on route change.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((v) => !v);
  }

  return (
    <>
      {/* Mobile backdrop (only when the drawer is open). Hidden on desktop via
          CSS media query — it's only rendered when mobileOpen is true. */}
      {mobileOpen && <div className="app-backdrop" onClick={onClose} aria-hidden="true" />}

      <aside
        className={[
          "sidebar",
          collapsed ? "collapsed" : "",
          // On mobile the drawer slides out via the drawer-hidden class.
          mobileOpen ? "" : "drawer-hidden",
        ].join(" ")}
        aria-label="Primary navigation"
      >
        {/* Brand block */}
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">F</span>
          <span className="sidebar-brand-name">Finn-Loop</span>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {/* Grouped nav */}
        <nav className="sidebar-nav">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="sidebar-group-label">{group.label}</div>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-item ${active ? "active" : ""}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="sidebar-item-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="sidebar-item-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Account footer (AC-10 issue #74: dynamic operator profile) */}
        <div className="sidebar-footer">
          <span className="sidebar-avatar" title={operator?.name ?? "Operator"}>
            {(operator?.name ?? "O").charAt(0).toUpperCase()}
          </span>
          <div className="sidebar-footer-info">
            <div className="sidebar-footer-name">{operator?.name ?? "Operator"}</div>
            <div className="sidebar-footer-role">{operator?.role ?? "admin"}</div>
          </div>
        </div>
      </aside>
    </>
  );
}

// AC-3, AC-7 (issue #36): client wrapper around the Sidebar that owns the
// mobile drawer open/close state. The server layout decides WHETHER to render
// this shell (only for authenticated routes — AC-6); this component handles
// the interactive bit (hamburger button toggling the drawer on mobile).

"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell-layout">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="app-shell-main">
        {/* Mobile-only top bar with the hamburger toggle. Hidden on desktop
            via CSS (display: none above 900px). */}
        <div className="app-mobile-bar">
          <button
            type="button"
            className="app-icon-btn"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <span className="app-brand-mark">Finn-Loop</span>
        </div>
        {children}
      </div>
    </div>
  );
}

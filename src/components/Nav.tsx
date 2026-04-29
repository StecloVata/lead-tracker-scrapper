"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTutorial } from "@/contexts/TutorialContext";
import type { User } from "@supabase/supabase-js";

const LINKS = [
  { href: "/", label: "Leads", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )},
  { href: "/analytics", label: "Analytics", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )},
  { href: "/signals", label: "Signals", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )},
];

export default function Nav({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const tutorial = useTutorial();
  const [signalUnread, setSignalUnread] = useState(0);

  useEffect(() => {
    fetch("/api/signals/counts")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSignalUnread(data.reduce((s: number, d: { unread: number }) => s + d.unread, 0));
        }
      })
      .catch(() => {});
  }, [pathname]);

  const username = user.user_metadata?.username as string | undefined;
  const displayName = username ?? user.email ?? "";

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 border-b" style={{ background: "var(--navy)", borderColor: "rgba(255,255,255,0.1)" }}>
      <div className="max-w-[1400px] mx-auto px-6 flex items-center h-14 gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--teal)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--navy-dark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
            </svg>
          </div>
          <span className="font-bold text-sm" style={{ color: "#fff" }}>Adversus Leads</span>
        </div>

        {/* Nav links */}
        {LINKS.map(link => {
          const active = pathname === link.href;
          const tutorialAttr = link.href === "/analytics" ? "nav-analytics" : undefined;
          const isSignals = link.href === "/signals";
          return (
            <Link
              key={link.href}
              href={link.href}
              data-tutorial={tutorialAttr}
              className="relative flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg hover-glass"
              style={{
                color: active ? "var(--navy-dark)" : "rgba(255,255,255,0.75)",
                background: active ? "var(--teal)" : "transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              {link.icon}
              {link.label}
              {isSignals && signalUnread > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold rounded-full px-1"
                  style={{ background: "#ef4444", color: "#fff", fontSize: 10 }}
                >
                  {signalUnread > 99 ? "99+" : signalUnread}
                </span>
              )}
            </Link>
          );
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* User */}
        <div className="flex items-center gap-3">
          <button
            onClick={tutorial.start}
            className="text-xs px-3 py-1.5 rounded-lg hover-btn"
            style={{ background: "rgba(87,218,221,0.15)", color: "var(--teal)" }}
            title="Restart the tour"
          >
            🗺️ Tour
          </button>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{displayName}</span>
          <button
            onClick={signOut}
            className="text-xs px-3 py-1.5 rounded-lg hover-btn"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}

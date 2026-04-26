"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTutorial } from "@/contexts/TutorialContext";
import type { User } from "@supabase/supabase-js";

const LINKS = [
  { href: "/", label: "Leads", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )},
  { href: "/scraper", label: "Scraper", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )},
  { href: "/analytics", label: "Analytics", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )},
];

export default function Nav({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const tutorial = useTutorial();

  const username = user.user_metadata?.username as string | undefined;
  const displayName = username ?? user.email ?? "";

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50" style={{ background: "var(--navy)", boxShadow: "0 1px 0 rgba(255,255,255,0.06)" }}>
      <div className="max-w-[1400px] mx-auto px-6 flex items-center h-16 gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-6">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--teal)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--navy-dark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm tracking-tight" style={{ color: "#fff" }}>Adversus Leads</span>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {LINKS.map(link => {
            const active = pathname === link.href;
            const tutorialAttr = link.href === "/scraper" ? "nav-scraper" : link.href === "/analytics" ? "nav-analytics" : undefined;
            return (
              <Link
                key={link.href}
                href={link.href}
                data-tutorial={tutorialAttr}
                className="flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg transition-all"
                style={{
                  color: active ? "var(--navy-dark)" : "rgba(255,255,255,0.78)",
                  background: active ? "var(--teal)" : "transparent",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User cluster */}
        <div className="flex items-center gap-2">
          <button
            onClick={tutorial.start}
            className="text-xs px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 font-medium"
            style={{ background: "rgba(87,218,221,0.18)", color: "var(--teal)" }}
            title="Restart the tour"
          >
            <span style={{ fontSize: 13 }}>🗺️</span> Tour
          </button>
          <span className="text-xs px-2.5 font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>{displayName}</span>
          <button
            onClick={signOut}
            className="text-xs px-3 py-2 rounded-lg transition-all font-medium"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}

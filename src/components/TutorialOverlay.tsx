"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTutorial } from "@/contexts/TutorialContext";

interface Step {
  selector: string;
  route: string;
  title: string;
  body: string;
  icon: string;
  tooltipSide: "top" | "bottom" | "left" | "right";
}

const STEPS: Step[] = [
  {
    selector: '[data-tutorial="pipeline-tabs"]',
    route: "/",
    icon: "🗂️",
    title: "Your Pipeline",
    body: "All your leads live here. Switch between Pipeline (active leads) and Archived (leads you've set aside). The counts update in real time as you work.",
    tooltipSide: "bottom",
  },
  {
    selector: '[data-tutorial="add-lead-btn"]',
    route: "/",
    icon: "➕",
    title: "Add a Lead — Two Ways",
    body: "Click here to add a lead. Choose Add manually to fill in the details yourself, or Add via link to paste a company website or LinkedIn URL — the app auto-fills everything for you.",
    tooltipSide: "bottom",
  },
  {
    selector: '[data-tutorial="first-lead-card"]',
    route: "/",
    icon: "📇",
    title: "Lead Cards",
    body: "Each card shows the company, tier, country, and notes. Click to open and edit the full profile — contacts, sales trigger, status, and more. The 🗂 icon archives it out of your pipeline.",
    tooltipSide: "bottom",
  },
  {
    selector: '[data-tutorial="next-action-area"]',
    route: "/",
    icon: "📋",
    title: "Follow-up Reminders",
    body: "Set a next action and due date on any lead — it shows as a badge on the card: 🔴 overdue, 🟠 due today, 🔵 upcoming. Click the red or orange chips to instantly filter to those leads.",
    tooltipSide: "bottom",
  },
  {
    selector: '[data-tutorial="nav-scraper"]',
    route: "/scraper",
    icon: "🔍",
    title: "Lead Generator",
    body: "Need fresh prospects? Filter by region, vertical, company size, and tier — the app finds real companies and automatically flags any that are already in your pipeline.",
    tooltipSide: "bottom",
  },
  {
    selector: '[data-tutorial="nav-analytics"]',
    route: "/analytics",
    icon: "📊",
    title: "Analytics",
    body: "Track your pipeline health: conversion rate, meeting rate, leads by country, tier distribution, and status breakdown. Check it weekly to see where deals are getting stuck.",
    tooltipSide: "bottom",
  },
];

interface Rect { top: number; left: number; width: number; height: number }

export default function TutorialOverlay() {
  const { active, step, total, next, prev, skip } = useTutorial();
  const router = useRouter();
  const pathname = usePathname();
  const [rect, setRect] = useState<Rect | null>(null);
  const [navigating, setNavigating] = useState(false);

  const current = STEPS[step];
  const PAD = 10;

  const findElement = useCallback(() => {
    if (!current) return;
    const el = document.querySelector(current.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setNavigating(false);
    }
  }, [current]);

  useEffect(() => {
    if (!active || !current) return;

    if (pathname !== current.route) {
      setNavigating(true);
      setRect(null);
      router.push(current.route);
      return;
    }

    setNavigating(false);
    // Small delay to let page render
    const t = setTimeout(findElement, 120);
    return () => clearTimeout(t);
  }, [active, step, pathname, current, router, findElement]);

  // Re-measure on scroll / resize
  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", findElement);
    window.addEventListener("scroll", findElement, true);
    return () => {
      window.removeEventListener("resize", findElement);
      window.removeEventListener("scroll", findElement, true);
    };
  }, [active, findElement]);

  if (!active) return null;

  const progress = ((step) / (total - 1)) * 100;

  // Tooltip positioning
  function tooltipStyle(): React.CSSProperties {
    if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const TW = 340;
    const ARROW = 14;
    const side = current.tooltipSide;

    const hCenter = rect.left + rect.width / 2 - TW / 2;
    const clampedLeft = Math.max(12, Math.min(hCenter, window.innerWidth - TW - 12));

    if (side === "bottom") {
      return { top: rect.top + rect.height + PAD + ARROW, left: clampedLeft };
    }
    if (side === "top") {
      return { bottom: window.innerHeight - rect.top + PAD + ARROW, left: clampedLeft };
    }
    if (side === "right") {
      return { top: rect.top + rect.height / 2 - 80, left: rect.left + rect.width + PAD + ARROW };
    }
    // left
    return { top: rect.top + rect.height / 2 - 80, right: window.innerWidth - rect.left + PAD + ARROW };
  }

  // Arrow pointing from tooltip toward element
  function arrowStyle(): React.CSSProperties {
    if (!rect) return {};
    const side = current.tooltipSide;
    const TW = 340;
    const hCenter = rect.left + rect.width / 2 - TW / 2;
    const clampedLeft = Math.max(12, Math.min(hCenter, window.innerWidth - TW - 12));
    const arrowX = rect.left + rect.width / 2 - clampedLeft;
    const arrowXClamped = Math.max(16, Math.min(arrowX, TW - 16));

    if (side === "bottom") return { top: -8, left: arrowXClamped, transform: "translateX(-50%) rotate(180deg)" };
    if (side === "top") return { bottom: -8, left: arrowXClamped, transform: "translateX(-50%)" };
    if (side === "right") return { left: -8, top: "50%", transform: "translateY(-50%) rotate(90deg)" };
    return { right: -8, top: "50%", transform: "translateY(-50%) rotate(-90deg)" };
  }

  return (
    <>
      {/* Dark overlay — uses box-shadow hole trick */}
      {rect && (
        <div
          style={{
            position: "fixed",
            zIndex: 9998,
            pointerEvents: "none",
            borderRadius: 12,
            transition: "all 0.25s ease",
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(10,15,40,0.72)",
            outline: "2px solid rgba(87,218,221,0.7)",
          }}
        />
      )}

      {/* Full-screen click trap (outside spotlight) */}
      {rect && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9997 }} onClick={skip} />
      )}

      {/* Loading state — no rect yet */}
      {!rect && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(10,15,40,0.72)" }} />
      )}

      {/* Tooltip */}
      <div
        style={{
          position: "fixed",
          zIndex: 9999,
          width: 340,
          ...tooltipStyle(),
          transition: "all 0.25s ease",
          pointerEvents: "all",
        }}
      >
        {/* Arrow */}
        {rect && (
          <div style={{ position: "absolute", ...arrowStyle() }}>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
              <path d="M8 0L16 10H0L8 0Z" fill="#fff" />
            </svg>
          </div>
        )}

        <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)" }}>
          {/* Progress bar */}
          <div className="h-1 w-full" style={{ background: "#e5e7eb" }}>
            <div
              className="h-1 transition-all duration-500"
              style={{ width: `${progress}%`, background: "var(--teal)" }}
            />
          </div>

          <div className="p-5">
            {/* Step counter */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                Step {step + 1} of {total}
              </span>
              <button
                onClick={skip}
                className="text-xs transition-colors"
                style={{ color: "var(--muted)" }}
              >
                Skip tour ✕
              </button>
            </div>

            {/* Title */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{current.icon}</span>
              <h3 className="font-bold text-base" style={{ color: "var(--text)" }}>{current.title}</h3>
            </div>

            {/* Body */}
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-sub)" }}>
              {navigating ? "Navigating…" : current.body}
            </p>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="text-xs px-3 py-2 rounded-lg border transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-sub)" }}
                >
                  ← Back
                </button>
              )}
              <div className="flex-1" />

              {/* Dot indicators */}
              <div className="flex gap-1 items-center">
                {Array.from({ length: total }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all"
                    style={{
                      width: i === step ? 16 : 6,
                      height: 6,
                      background: i === step ? "var(--navy)" : "#d1d5db",
                    }}
                  />
                ))}
              </div>

              <div className="flex-1" />
              <button
                onClick={next}
                className="text-xs px-4 py-2 rounded-lg font-semibold transition-colors"
                style={{ background: "var(--navy)", color: "#fff" }}
              >
                {step === total - 1 ? "Finish 🎉" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

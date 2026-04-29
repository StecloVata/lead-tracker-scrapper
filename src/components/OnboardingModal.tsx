"use client";

import { useState, useEffect } from "react";
import { useTutorial } from "@/contexts/TutorialContext";

interface Props {
  userId: string;
}

export default function OnboardingModal({ userId }: Props) {
  const doneKey = `adv_onboarding_done_${userId}`;
  const tutorial = useTutorial();

  const [visible, setVisible] = useState(false);
  const [screen, setScreen] = useState<"leads" | "tutorial">("leads");
  const [seedChoice, setSeedChoice] = useState<"seed" | "empty">("seed");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only show if onboarding not yet completed
    if (!localStorage.getItem(doneKey)) {
      // Check if user already has leads — existing users skip onboarding
      fetch("/api/leads?skipOnboarding=true")
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data) && data.length === 0) {
            setVisible(true);
          } else if (Array.isArray(data) && data.length > 0) {
            // Has leads already — mark done silently
            localStorage.setItem(doneKey, "1");
          }
        });
    }
  }, [doneKey]);

  async function handleLeadsChoice() {
    setLoading(true);
    if (seedChoice === "seed") {
      await fetch("/api/leads/seed", { method: "POST" });
      localStorage.setItem(doneKey, "1");
      setLoading(false);
      setScreen("tutorial"); // only offer tour when 89 leads are loaded
    } else {
      localStorage.setItem(doneKey, "1");
      setLoading(false);
      setVisible(false); // start fresh → skip tutorial prompt entirely
    }
  }

  function handleTutorialChoice(take: boolean) {
    setVisible(false);
    if (take) {
      // Wait for LeadsClient to fetch and render the 89 leads before starting
      setTimeout(() => tutorial.start(), 1200);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4" style={{ background: "rgba(15,20,50,0.6)" }}>
      {screen === "leads" ? (
        <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#fff" }}>
          {/* Header */}
          <div className="px-8 pt-8 pb-2 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--navy)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text)" }}>Welcome to Adversus Leads</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>How would you like to get started?</p>
          </div>

          <div className="px-8 py-6 space-y-3">
            {/* Option: seed */}
            <button
              onClick={() => setSeedChoice("seed")}
              className="w-full text-left p-4 rounded-xl border-2 transition-all"
              style={{
                borderColor: seedChoice === "seed" ? "var(--navy)" : "var(--border)",
                background: seedChoice === "seed" ? "#f0f2ff" : "#fff",
                boxShadow: seedChoice === "seed" ? "0 0 0 3px rgba(26,35,85,0.08)" : "none",
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">📋</span>
                <div>
                  <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>Load 89 sample leads</div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    Pre-researched BPOs, telecoms, debt collectors and more across the Nordics, DACH, and Benelux. Ready to work from day one.
                  </div>
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#dcfce7", color: "#166534" }}>
                    89 leads · 7 verticals · 10 countries
                  </span>
                </div>
              </div>
            </button>

            {/* Option: empty */}
            <button
              onClick={() => setSeedChoice("empty")}
              className="w-full text-left p-4 rounded-xl border-2 transition-all"
              style={{
                borderColor: seedChoice === "empty" ? "var(--navy)" : "var(--border)",
                background: seedChoice === "empty" ? "#f0f2ff" : "#fff",
                boxShadow: seedChoice === "empty" ? "0 0 0 3px rgba(26,35,85,0.08)" : "none",
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">✨</span>
                <div>
                  <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>Start from scratch</div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    Empty pipeline. Add your own leads manually, import a CSV, or use the Lead Generator to find companies that match your ICP.
                  </div>
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#f3f4f6", color: "#4b5563" }}>
                    Clean slate
                  </span>
                </div>
              </div>
            </button>
          </div>

          <div className="px-8 pb-8">
            <button
              onClick={handleLeadsChoice}
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-60 transition-opacity"
              style={{ background: "var(--orange)", color: "#fff" }}
            >
              {loading ? "Setting up…" : "Continue →"}
            </button>
            <p className="text-center text-xs mt-3" style={{ color: "var(--muted)" }}>You can always import or delete leads later.</p>
          </div>
        </div>
      ) : (
        // Tutorial choice screen
        <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#fff" }}>
          <div className="px-8 pt-8 pb-2 text-center">
            <div className="text-4xl mb-4">🗺️</div>
            <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text)" }}>Take the tour?</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              A quick interactive guide walks you through every feature — takes about 2 minutes.
            </p>
          </div>

          <div className="px-8 py-6 space-y-3">
            <button
              onClick={() => handleTutorialChoice(true)}
              className="w-full p-4 rounded-xl border-2 text-left transition-all hover:shadow-md"
              style={{ borderColor: "var(--navy)", background: "#f0f2ff" }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">🎯</span>
                <div>
                  <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                    Yes, show me around <span className="text-xs font-normal ml-1 px-1.5 py-0.5 rounded-full" style={{ background: "var(--orange)", color: "#fff" }}>Recommended</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    Step-by-step spotlight guide covering the pipeline, adding leads, follow-ups, and analytics.
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleTutorialChoice(false)}
              className="w-full p-4 rounded-xl border-2 text-left transition-all hover:bg-gray-50"
              style={{ borderColor: "var(--border)", background: "#fff" }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">⚡</span>
                <div>
                  <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>Skip for now</div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    Jump straight in. You can always restart the tour from the nav bar.
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

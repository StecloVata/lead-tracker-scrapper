"use client";

import type { Lead } from "@/types/lead";

export default function StatsBar({ leads }: { leads: Lead[] }) {
  const stats = {
    total: leads.length,
    tier1: leads.filter(l => l.tier === 1).length,
    contacted: leads.filter(l => !["Not contacted", "Not a fit"].includes(l.status)).length,
    meetings: leads.filter(l => l.status === "Meeting booked").length,
    qualified: leads.filter(l => ["Qualified", "Closed"].includes(l.status)).length,
    avgAI: leads.filter(l => l.ai_score).length > 0
      ? Math.round(leads.filter(l => l.ai_score).reduce((s, l) => s + (l.ai_score ?? 0), 0) / leads.filter(l => l.ai_score).length)
      : null,
  };

  const items = [
    { label: "Total leads", value: stats.total, color: "var(--navy)" },
    { label: "Tier 1", value: stats.tier1, color: "#065f46" },
    { label: "In pipeline", value: stats.contacted, color: "#1d4ed8" },
    { label: "Meetings", value: stats.meetings, color: "#9a3412" },
    { label: "Qualified/Closed", value: stats.qualified, color: "#166534" },
    { label: "Avg AI score", value: stats.avgAI ?? "—", color: stats.avgAI ? (stats.avgAI >= 70 ? "#16a34a" : "#ca8a04") : "var(--muted)" },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {items.map(({ label, value, color }) => (
        <div key={label} className="rounded-xl p-4 text-center" style={{ background: "#fff", border: "1px solid var(--border)" }}>
          <div className="text-2xl font-bold" style={{ color }}>{value}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

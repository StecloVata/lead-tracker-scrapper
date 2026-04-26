"use client";

import type { Lead } from "@/types/lead";

export default function StatsBar({ leads }: { leads: Lead[] }) {
  const items = [
    { label: "Total leads", value: leads.length, color: "var(--primary)", accent: true },
    { label: "Tier 1", value: leads.filter(l => l.tier === 1).length, color: "#065f46" },
    { label: "In pipeline", value: leads.filter(l => !["Not contacted", "Not a fit"].includes(l.status)).length, color: "var(--navy)" },
    { label: "Meetings", value: leads.filter(l => l.status === "Meeting booked").length, color: "#9a3412" },
    { label: "Qualified", value: leads.filter(l => l.status === "Qualified").length, color: "#16a34a" },
    { label: "Closed", value: leads.filter(l => l.status === "Closed").length, color: "#166534" },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {items.map(({ label, value, color, accent }) => (
        <div
          key={label}
          className="rounded-xl p-4 text-center transition-all"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
            borderTop: accent ? "3px solid var(--primary)" : `1px solid var(--border)`,
          }}
        >
          <div className="text-2xl font-bold tracking-tight leading-none" style={{ color }}>{value}</div>
          <div className="text-xs mt-1.5 font-medium" style={{ color: "var(--muted)" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

"use client";

import type { Lead, LeadStatus } from "@/types/lead";
import { cn } from "@/lib/utils";

const FLAG: Record<string, string> = {
  Sweden: "🇸🇪", Norway: "🇳🇴", Denmark: "🇩🇰", UK: "🇬🇧", Netherlands: "🇳🇱",
  Germany: "🇩🇪", Belgium: "🇧🇪", Switzerland: "🇨🇭", Ireland: "🇮🇪", Finland: "🇫🇮",
};

const TIER_C = {
  1: { bg: "#e0fdf4", text: "#065f46", label: "T1" },
  2: { bg: "#eff6ff", text: "#1d4ed8", label: "T2" },
  3: { bg: "#fff7ed", text: "#9a3412", label: "T3" },
};

const STATUS_C: Record<string, { bg: string; text: string }> = {
  "Not contacted": { bg: "#f3f4f6", text: "#4b5563" },
  "Researching": { bg: "#dbeafe", text: "#1e40af" },
  "Contacted": { bg: "#ede9fe", text: "#5b21b6" },
  "Meeting booked": { bg: "#ffedd5", text: "#9a3412" },
  "Qualified": { bg: "#dcfce7", text: "#166534" },
  "Closed": { bg: "#166534", text: "#fff" },
  "Not a fit": { bg: "#fee2e2", text: "#991b1b" },
};

const STATUSES: LeadStatus[] = ["Not contacted", "Researching", "Contacted", "Meeting booked", "Qualified", "Closed", "Not a fit"];

interface Props {
  lead: Lead;
  compact?: boolean;
  onOpen: () => void;
  onStatusChange: (s: LeadStatus) => void;
  onPriorityToggle: () => void;
  onAIScore: () => void;
}

export default function LeadCard({ lead, compact, onOpen, onStatusChange, onPriorityToggle, onAIScore }: Props) {
  const tier = TIER_C[lead.tier as 1 | 2 | 3] ?? TIER_C[2];
  const status = STATUS_C[lead.status] ?? STATUS_C["Not contacted"];

  if (compact) {
    return (
      <div
        onClick={onOpen}
        className="rounded-xl p-3 cursor-pointer transition-shadow hover:shadow-md"
        style={{ background: "#fff", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className="text-xs font-semibold leading-tight" style={{ color: "var(--text)" }}>{lead.company}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: tier.bg, color: tier.text }}>{tier.label}</span>
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
          <span>{FLAG[lead.country] ?? "🌍"}</span>
          <span>{lead.country}</span>
        </div>
        {lead.ai_score && (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-xs font-bold" style={{ color: aiScoreColor(lead.ai_score) }}>{lead.ai_score}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>AI score</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-xl transition-shadow hover:shadow-md"
      style={{ background: "#fff", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start gap-4 p-4">
        {/* Priority star */}
        <button
          onClick={e => { e.stopPropagation(); onPriorityToggle(); }}
          className="text-lg leading-none mt-0.5 flex-shrink-0"
          title="Toggle priority"
        >
          {lead.is_priority ? "⭐" : "☆"}
        </button>

        {/* Main info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{lead.company}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: tier.bg, color: tier.text }}>{tier.label}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{FLAG[lead.country] ?? "🌍"} {lead.country} · {lead.city}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f3f4f6", color: "var(--text-sub)" }}>{lead.vertical}</span>
          </div>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-sub)" }}>{lead.notes}</p>
          {lead.persona && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Persona: {lead.persona}</p>}
        </div>

        {/* AI score */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          {lead.ai_score ? (
            <div className="text-center">
              <div className="text-lg font-bold leading-none" style={{ color: aiScoreColor(lead.ai_score) }}>{lead.ai_score}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>AI fit</div>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onAIScore(); }}
              className="text-xs px-2 py-1 rounded-lg border transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--muted)", background: "transparent" }}
              title="Score with AI"
            >
              AI score
            </button>
          )}
        </div>

        {/* Status dropdown */}
        <select
          value={lead.status}
          onChange={e => { e.stopPropagation(); onStatusChange(e.target.value as LeadStatus); }}
          onClick={e => e.stopPropagation()}
          className={cn("text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 outline-none cursor-pointer border-0")}
          style={{ background: status.bg, color: status.text }}
        >
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}

function aiScoreColor(score: number) {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#ca8a04";
  return "#dc2626";
}

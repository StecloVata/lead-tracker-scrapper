"use client";

import type { Lead, LeadStatus } from "@/types/lead";
import { cn } from "@/lib/utils";
import SignalBadge from "./SignalBadge";

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
  onArchive?: () => void;
  onRestore?: () => void;
  signalUnread?: number;
  signalMaxUrgency?: 1 | 2 | 3 | null;
}

export default function LeadCard({ lead, compact, onOpen, onStatusChange, onPriorityToggle, onAIScore, onArchive, onRestore, signalUnread = 0, signalMaxUrgency = null }: Props) {
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

  const signalBorder = signalMaxUrgency === 3 ? "#ef4444"
    : signalMaxUrgency === 2 ? "#f59e0b"
    : signalMaxUrgency === 1 ? "#94a3b8"
    : undefined;

  return (
    <div
      className="rounded-xl transition-shadow hover:shadow-md"
      style={{
        background: "#fff",
        border: "1px solid var(--border)",
        borderLeft: signalBorder ? `4px solid ${signalBorder}` : undefined,
      }}
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
            <SignalBadge unreadCount={signalUnread} maxUrgency={signalMaxUrgency} onClick={e => { e.stopPropagation(); onOpen(); }} />
            <span className="text-xs" style={{ color: "var(--muted)" }}>{FLAG[lead.country] ?? "🌍"} {lead.country} · {lead.city}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f3f4f6", color: "var(--text-sub)" }}>{lead.vertical}</span>
          </div>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-sub)" }}>{lead.notes}</p>
          {lead.persona && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Persona: {lead.persona}</p>}
          {lead.next_action && <NextActionBadge action={lead.next_action} date={lead.next_action_date} />}
          {(lead.website || lead.linkedin) && (
            <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
              {lead.website && (
                <a
                  href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                  style={{ background: "#f3f4f6", color: "var(--text-sub)", border: "1px solid var(--border)" }}
                >
                  🌐 Website
                </a>
              )}
              {lead.linkedin && (
                <a
                  href={lead.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                  style={{ background: "#e8f0fe", color: "#1d4ed8", border: "1px solid #bfdbfe" }}
                >
                  in LinkedIn
                </a>
              )}
            </div>
          )}
        </div>

        {/* AI score — shown only if already scored */}
        {lead.ai_score ? (
          <div className="flex flex-col items-center gap-1 flex-shrink-0 text-center">
            <div className="text-lg font-bold leading-none" style={{ color: aiScoreColor(lead.ai_score) }}>{lead.ai_score}</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>AI fit</div>
          </div>
        ) : null}

        {/* Status dropdown — hidden in archive view */}
        {!lead.is_archived && (
          <select
            value={lead.status}
            onChange={e => { e.stopPropagation(); onStatusChange(e.target.value as LeadStatus); }}
            onClick={e => e.stopPropagation()}
            className={cn("text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 outline-none cursor-pointer border-0")}
            style={{ background: status.bg, color: status.text }}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {/* Archive / Restore */}
        {onRestore && (
          <button
            onClick={e => { e.stopPropagation(); onRestore(); }}
            className="text-xs px-2.5 py-1 rounded-lg font-medium flex-shrink-0 transition-colors"
            style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }}
            title="Restore lead"
          >
            ↩ Restore
          </button>
        )}
        {onArchive && !lead.is_archived && (
          <button
            onClick={e => { e.stopPropagation(); onArchive(); }}
            className="text-xs px-2 py-1 rounded-lg flex-shrink-0 transition-colors"
            style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
            title="Archive lead"
          >
            🗂
          </button>
        )}
      </div>
    </div>
  );
}

function aiScoreColor(score: number) {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#ca8a04";
  return "#dc2626";
}

function NextActionBadge({ action, date }: { action: string; date?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = date && date < today;
  const isToday = date && date === today;

  let bg = "#f3f4f6", color = "#6b7280", dot = "⬜";
  if (isOverdue) { bg = "#fee2e2"; color = "#991b1b"; dot = "🔴"; }
  else if (isToday) { bg = "#fff7ed"; color = "#9a3412"; dot = "🟠"; }
  else if (date) { bg = "#eff6ff"; color = "#1d4ed8"; dot = "🔵"; }

  const label = !date ? "" : isOverdue
    ? `Overdue · ${fmt(date)}`
    : isToday ? "Today"
    : fmt(date);

  return (
    <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-lg text-xs font-medium" style={{ background: bg, color }}>
      <span style={{ fontSize: 9 }}>{dot}</span>
      <span>{action}</span>
      {label && <span className="opacity-75">· {label}</span>}
    </div>
  );
}

function fmt(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

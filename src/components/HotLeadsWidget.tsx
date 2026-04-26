"use client";

import { useState, useEffect } from "react";

interface HotLead {
  lead_id: string;
  company: string;
  country: string;
  vertical: string;
  maxUrgency: 1 | 2 | 3;
  unreadCount: number;
  latestSignalTitle: string;
  latestSignalType: string;
  detectedAt: string;
}

const URGENCY_LABEL: Record<1 | 2 | 3, { label: string; bg: string; text: string }> = {
  3: { label: "Hot", bg: "#fee2e2", text: "#991b1b" },
  2: { label: "Warm", bg: "#fff7ed", text: "#9a3412" },
  1: { label: "Mild", bg: "#f3f4f6", text: "#4b5563" },
};

const FLAG: Record<string, string> = {
  Sweden: "🇸🇪", Norway: "🇳🇴", Denmark: "🇩🇰", UK: "🇬🇧", Netherlands: "🇳🇱",
  Germany: "🇩🇪", Belgium: "🇧🇪", Switzerland: "🇨🇭", Ireland: "🇮🇪", Finland: "🇫🇮",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

interface Props {
  onOpenLead?: (leadId: string) => void;
}

export default function HotLeadsWidget({ onOpenLead }: Props) {
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/signals/hot-leads");
        const data = await res.json();
        setHotLeads(Array.isArray(data) ? data : []);
      } catch {
        setHotLeads([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (!loading && hotLeads.length === 0) return null;

  return (
    <div className="rounded-2xl mb-4" style={{ background: "#fff", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-base">⚡</span>
        <h2 className="text-sm font-bold" style={{ color: "var(--text)" }}>Hot leads — contact now</h2>
        <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>Signals in last 7 days</span>
      </div>

      {loading ? (
        <div className="px-5 py-4 text-xs" style={{ color: "var(--muted)" }}>Loading…</div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {hotLeads.map(lead => {
            const u = URGENCY_LABEL[lead.maxUrgency];
            return (
              <div key={lead.lead_id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{lead.company}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: u.bg, color: u.text }}>
                      {u.label}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {FLAG[lead.country] ?? "🌍"} {lead.country}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>· {lead.vertical}</span>
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-sub)" }}>
                    {lead.latestSignalTitle}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {lead.unreadCount} signal{lead.unreadCount > 1 ? "s" : ""} · {timeAgo(lead.detectedAt)}
                  </p>
                </div>
                <button
                  onClick={() => onOpenLead?.(lead.lead_id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0 transition-colors"
                  style={{ background: "var(--orange)", color: "#fff" }}
                >
                  View
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

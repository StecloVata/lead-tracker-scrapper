"use client";

import { useState, useEffect } from "react";
import type { SignalType } from "@/types/lead";

const FLAG: Record<string, string> = {
  Sweden: "🇸🇪", Norway: "🇳🇴", Denmark: "🇩🇰", UK: "🇬🇧", Netherlands: "🇳🇱",
  Germany: "🇩🇪", Belgium: "🇧🇪", Switzerland: "🇨🇭", Ireland: "🇮🇪", Finland: "🇫🇮",
};

const URGENCY = {
  3: { label: "Hot",  border: "#ef4444", bg: "#fef2f2", badge: { bg: "#ef4444",  text: "#fff" } },
  2: { label: "Warm", border: "#f59e0b", bg: "#fffbeb", badge: { bg: "#f59e0b",  text: "#fff" } },
  1: { label: "Mild", border: "#94a3b8", bg: "#f8fafc", badge: { bg: "#94a3b8",  text: "#fff" } },
} as const;

const SIGNAL_META: Record<SignalType, { icon: string; label: string }> = {
  funding:           { icon: "💰", label: "Funding / M&A" },
  hiring:            { icon: "🧑‍💼", label: "Hiring" },
  leadership_change: { icon: "👔", label: "Leadership change" },
  expansion:         { icon: "🌍", label: "Expansion" },
  pain_point:        { icon: "⚠️", label: "Pain point" },
  tech_change:       { icon: "🔧", label: "Tech change" },
  event:             { icon: "🎤", label: "Event" },
  press:             { icon: "📰", label: "Press" },
};

type Signal = {
  id: string;
  lead_id: string;
  signal_type: SignalType;
  title: string;
  description: string;
  source_url: string;
  urgency: 1 | 2 | 3;
  detected_at: string;
  is_read: boolean;
};

type LeadGroup = {
  lead_id: string;
  company: string;
  country: string;
  vertical: string;
  tier: number;
  status: string;
  max_urgency: number;
  unread_count: number;
  signals: Signal[];
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function SignalsClient() {
  const [groups, setGroups] = useState<LeadGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | 3 | 2 | 1>("all");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const data = await fetch("/api/signals/feed").then(r => r.json());
    setGroups(Array.isArray(data) ? data : []);
    // Auto-expand all by default
    if (Array.isArray(data)) setExpanded(new Set(data.map((g: LeadGroup) => g.lead_id)));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markLeadRead(leadId: string) {
    await fetch(`/api/signals/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setGroups(prev => prev.map(g =>
      g.lead_id === leadId
        ? { ...g, unread_count: 0, signals: g.signals.map(s => ({ ...s, is_read: true })) }
        : g
    ));
  }

  async function scanAll() {
    setScanning(true);
    setScanMsg("");
    const res = await fetch("/api/signals/refresh-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ""}` },
    });
    const data = await res.json();
    setScanMsg(data.newSignals > 0
      ? `Found ${data.newSignals} new signal${data.newSignals > 1 ? "s" : ""} across ${data.processed} leads`
      : `Scanned ${data.processed} leads — no new signals`
    );
    await load();
    setScanning(false);
  }

  function toggleExpand(leadId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(leadId) ? next.delete(leadId) : next.add(leadId);
      return next;
    });
  }

  const filtered = groups.filter(g =>
    filter === "all" ? true : g.max_urgency === filter
  );

  const totalUnread = groups.reduce((s, g) => s + g.unread_count, 0);
  const hotCount = groups.filter(g => g.max_urgency === 3).length;

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>⚡ Signals</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Buying triggers detected across your leads
          </p>
        </div>
        <button
          onClick={scanAll}
          disabled={scanning}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold disabled:opacity-50 transition-colors flex-shrink-0"
          style={{ background: "var(--orange)", color: "#fff" }}
        >
          {scanning ? (
            <><span className="animate-spin inline-block">⟳</span> Scanning…</>
          ) : (
            <>⚡ Scan all leads</>
          )}
        </button>
      </div>

      {scanMsg && (
        <div className="px-4 py-2.5 rounded-xl text-sm" style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
          {scanMsg}
        </div>
      )}

      {/* ── Stats bar ── */}
      {!loading && groups.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Leads with signals", value: groups.length, color: "var(--navy)" },
            { label: "Unread signals", value: totalUnread, color: "#ef4444" },
            { label: "Hot leads", value: hotCount, color: "#ef4444" },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl px-4 py-3 text-center" style={{ background: "#fff", border: "1px solid var(--border)" }}>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter tabs ── */}
      {!loading && groups.length > 0 && (
        <div className="flex gap-2">
          {(["all", 3, 2, 1] as const).map(f => {
            const labels: Record<string, string> = { all: "All", 3: "🔴 Hot", 2: "🟡 Warm", 1: "⚪ Mild" };
            const counts: Record<string, number> = {
              all: groups.length,
              3: groups.filter(g => g.max_urgency === 3).length,
              2: groups.filter(g => g.max_urgency === 2).length,
              1: groups.filter(g => g.max_urgency === 1).length,
            };
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                style={{
                  background: active ? "var(--navy)" : "var(--surface)",
                  color: active ? "#fff" : "var(--text-sub)",
                  border: "1px solid var(--border)",
                }}
              >
                {labels[f]} ({counts[f]})
              </button>
            );
          })}
          {totalUnread > 0 && (
            <button
              onClick={() => groups.forEach(g => markLeadRead(g.lead_id))}
              className="text-xs px-3 py-1.5 rounded-lg font-medium ml-auto transition-colors"
              style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}
            >
              Mark all read
            </button>
          )}
        </div>
      )}

      {/* ── Lead cards ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ background: "#fff", border: "1px solid var(--border)" }}>
          <div className="text-4xl mb-3">📡</div>
          <p className="text-base font-semibold" style={{ color: "var(--text)" }}>
            {groups.length === 0 ? "No signals yet" : "No leads match this filter"}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {groups.length === 0
              ? 'Hit "Scan all leads" to search for buying triggers across your pipeline'
              : "Try a different urgency filter"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(group => {
            const u = URGENCY[group.max_urgency as 1 | 2 | 3] ?? URGENCY[1];
            const isExpanded = expanded.has(group.lead_id);
            const visibleSignals = isExpanded ? group.signals : group.signals.slice(0, 2);

            return (
              <div
                key={group.lead_id}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderLeft: `4px solid ${u.border}`,
                }}
              >
                {/* Lead header */}
                <div
                  className="flex items-center gap-3 px-5 py-3.5 cursor-pointer"
                  style={{ background: u.bg }}
                  onClick={() => toggleExpand(group.lead_id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{group.company}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: u.badge.bg, color: u.badge.text }}
                      >
                        {u.label}
                      </span>
                      {group.unread_count > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "var(--navy)", color: "#fff" }}>
                          {group.unread_count} new
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        {FLAG[group.country] ?? "🌍"} {group.country} · {group.vertical}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      {group.signals.length} signal{group.signals.length > 1 ? "s" : ""} · {timeAgo(group.signals[0].detected_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {group.unread_count > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); markLeadRead(group.lead_id); }}
                        className="text-xs px-2.5 py-1 rounded-lg"
                        style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-sub)" }}
                      >
                        Mark read
                      </button>
                    )}
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Signal rows */}
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {visibleSignals.map(sig => {
                    const meta = SIGNAL_META[sig.signal_type] ?? { icon: "📌", label: sig.signal_type };
                    return (
                      <div
                        key={sig.id}
                        className="flex items-start gap-3 px-5 py-3"
                        style={{ opacity: sig.is_read ? 0.55 : 1 }}
                      >
                        <span className="text-base flex-shrink-0 mt-0.5">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{sig.title}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                              {meta.label}
                            </span>
                            {!sig.is_read && (
                              <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: u.border }} />
                            )}
                          </div>
                          {sig.description && (
                            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-sub)" }}>{sig.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs" style={{ color: "var(--muted)" }}>{timeAgo(sig.detected_at)}</span>
                            {sig.source_url && (
                              <a
                                href={sig.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-xs font-medium"
                                style={{ color: "#2563eb" }}
                              >
                                Read article ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Show more / less */}
                  {group.signals.length > 2 && (
                    <button
                      onClick={() => toggleExpand(group.lead_id)}
                      className="w-full text-xs py-2.5 text-center transition-colors"
                      style={{ color: "var(--muted)", background: "var(--surface)" }}
                    >
                      {isExpanded
                        ? "Show less ▲"
                        : `Show ${group.signals.length - 2} more signal${group.signals.length - 2 > 1 ? "s" : ""} ▼`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

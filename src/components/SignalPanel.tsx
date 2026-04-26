"use client";

import { useState, useEffect, useCallback } from "react";
import type { Signal, SignalType } from "@/types/lead";

interface Props {
  leadId: string;
  onUnreadChange?: (count: number, maxUrgency: 1 | 2 | 3 | null) => void;
}

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

const URGENCY_STYLE: Record<1 | 2 | 3, { bg: string; text: string; label: string }> = {
  3: { bg: "#fee2e2", text: "#991b1b", label: "High" },
  2: { bg: "#fff7ed", text: "#9a3412", label: "Medium" },
  1: { bg: "#f3f4f6", text: "#4b5563", label: "Low" },
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

export default function SignalPanel({ leadId, onUnreadChange }: Props) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/signals/${leadId}`);
    const data = await res.json();
    const list: Signal[] = Array.isArray(data) ? data : [];
    setSignals(list);
    setLoading(false);

    if (onUnreadChange) {
      const unread = list.filter(s => !s.is_read);
      const maxUrgency = unread.reduce((m: number, s) => Math.max(m, s.urgency), 0);
      onUnreadChange(unread.length, maxUrgency > 0 ? (maxUrgency as 1 | 2 | 3) : null);
    }
  }, [leadId, onUnreadChange]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  async function markAllRead() {
    await fetch(`/api/signals/${leadId}`, { method: "PATCH", body: JSON.stringify({}), headers: { "Content-Type": "application/json" } });
    setSignals(prev => prev.map(s => ({ ...s, is_read: true })));
    onUnreadChange?.(0, null);
  }

  async function markOneRead(signalId: string) {
    await fetch(`/api/signals/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify({ signal_id: signalId }),
      headers: { "Content-Type": "application/json" },
    });
    setSignals(prev => prev.map(s => s.id === signalId ? { ...s, is_read: true } : s));
    const remaining = signals.filter(s => !s.is_read && s.id !== signalId);
    const max = remaining.reduce((m: number, s) => Math.max(m, s.urgency), 0);
    onUnreadChange?.(remaining.length, max > 0 ? (max as 1 | 2 | 3) : null);
  }

  async function runScan() {
    setScanning(true);
    setScanMsg("");
    const res = await fetch("/api/signals/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId }),
    });
    const data = await res.json();
    if (data.newCount > 0) {
      setScanMsg(`Found ${data.newCount} new signal${data.newCount > 1 ? "s" : ""}!`);
      setSignals(data.signals ?? []);
      const unread = (data.signals ?? []).filter((s: Signal) => !s.is_read);
      const max = unread.reduce((m: number, s: Signal) => Math.max(m, s.urgency), 0);
      onUnreadChange?.(unread.length, max > 0 ? max as 1 | 2 | 3 : null);
    } else {
      setScanMsg("No new signals found.");
    }
    setScanning(false);
  }

  const unreadCount = signals.filter(s => !s.is_read).length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Signals {signals.length > 0 && <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>({signals.length})</span>}
          </span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#eff6ff", color: "#1d4ed8" }}
            >
              Mark all read
            </button>
          )}
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 hover-btn"
          style={{ background: "var(--orange)", color: "#fff" }}
        >
          {scanning ? "Scanning…" : "⚡ Scan now"}
        </button>
      </div>

      {scanMsg && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#f0fdf4", color: "#166534" }}>
          {scanMsg}
        </p>
      )}

      {/* Signal list */}
      {loading ? (
        <p className="text-xs" style={{ color: "var(--muted)" }}>Loading signals…</p>
      ) : signals.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-2xl mb-2">📡</p>
          <p className="text-sm font-medium" style={{ color: "var(--text-sub)" }}>No signals yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Hit "Scan now" to search for buying triggers</p>
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map(signal => {
            const meta = SIGNAL_META[signal.signal_type] ?? { icon: "📌", label: signal.signal_type };
            const urgency = URGENCY_STYLE[signal.urgency as 1 | 2 | 3] ?? URGENCY_STYLE[1];
            return (
              <div
                key={signal.id}
                className="rounded-xl p-3 transition-opacity"
                style={{
                  background: signal.is_read ? "var(--surface)" : urgency.bg,
                  border: `1px solid ${signal.is_read ? "var(--border)" : "transparent"}`,
                  opacity: signal.is_read ? 0.7 : 1,
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0 mt-0.5">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-semibold" style={{ color: signal.is_read ? "var(--text-sub)" : urgency.text }}>
                        {signal.title}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.06)", color: "inherit" }}>
                        {meta.label}
                      </span>
                      {!signal.is_read && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: urgency.text, color: "#fff" }}>
                          {urgency.label}
                        </span>
                      )}
                    </div>
                    {signal.description && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>{signal.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs" style={{ color: "var(--muted)" }}>{timeAgo(signal.detected_at)}</span>
                      {signal.source_url && (
                        <a
                          href={signal.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline"
                          style={{ color: "#1d4ed8" }}
                        >
                          Source ↗
                        </a>
                      )}
                      {!signal.is_read && (
                        <button
                          onClick={() => markOneRead(signal.id)}
                          className="text-xs hover-text"
                          style={{ color: "var(--muted)" }}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

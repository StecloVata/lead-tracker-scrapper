"use client";

import { useState, useEffect } from "react";
import type { Lead } from "@/types/lead";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  FunnelChart, Funnel, LabelList,
} from "recharts";

const STATUS_ORDER = ["Not contacted", "Researching", "Contacted", "Meeting booked", "Qualified", "Closed", "Not a fit"];
const STATUS_COLORS = ["#9ca3af", "#3b82f6", "#8b5cf6", "#f97316", "#22c55e", "#16a34a", "#ef4444"];
const VERTICAL_COLORS = ["#3639a4", "#57dadd", "#ff7364", "#4b4ec7", "#7577b8", "#272980", "#a5b4fc"];

export default function AnalyticsClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leads").then(r => r.json()).then(data => {
      setLeads(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-16" style={{ color: "var(--muted)" }}>Loading analytics…</div>;
  if (leads.length === 0) return <div className="text-center py-16" style={{ color: "var(--muted)" }}>No data yet — add some leads first.</div>;

  // Pipeline funnel data
  const pipelineData = STATUS_ORDER.map(s => ({
    name: s,
    value: leads.filter(l => l.status === s).length,
  })).filter(d => d.name !== "Not a fit");

  // Leads by vertical
  const verticalData = Object.entries(
    leads.reduce((acc, l) => { acc[l.vertical] = (acc[l.vertical] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  // Leads by country
  const countryData = Object.entries(
    leads.reduce((acc, l) => { acc[l.country] = (acc[l.country] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));

  // Tier distribution
  const tierData = [1, 2, 3].map(t => ({
    name: `Tier ${t}`,
    value: leads.filter(l => l.tier === t).length,
  }));
  const TIER_COLORS = ["#065f46", "#1d4ed8", "#9a3412"];

  // Status breakdown
  const statusData = STATUS_ORDER.map((s, i) => ({
    name: s,
    value: leads.filter(l => l.status === s).length,
    fill: STATUS_COLORS[i],
  }));

  // Conversion rate
  const inPipeline = leads.filter(l => !["Not contacted", "Not a fit"].includes(l.status)).length;
  const convRate = leads.length > 0 ? Math.round((inPipeline / leads.length) * 100) : 0;
  const meetingRate = leads.length > 0 ? Math.round((leads.filter(l => ["Meeting booked", "Qualified", "Closed"].includes(l.status)).length / leads.length) * 100) : 0;
  const closedCount = leads.filter(l => l.status === "Closed").length;
  const scoredLeads = leads.filter(l => l.ai_score);
  const avgScore = scoredLeads.length > 0 ? Math.round(scoredLeads.reduce((s, l) => s + (l.ai_score ?? 0), 0) / scoredLeads.length) : null;

  const Card = ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>{title}</h3>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Analytics</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Pipeline health and lead distribution</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total leads", value: leads.length, color: "var(--navy)" },
          { label: "In pipeline", value: `${convRate}%`, color: "#1d4ed8" },
          { label: "Meeting rate", value: `${meetingRate}%`, color: "#9a3412" },
          { label: "Closed", value: closedCount, color: "#166534" },
          { label: "Avg AI score", value: avgScore ? `${avgScore}/100` : "—", color: avgScore && avgScore >= 70 ? "#16a34a" : "#ca8a04" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ background: "#fff", border: "1px solid var(--border)" }}>
            <div className="text-2xl font-bold" style={{ color }}>{value}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Pipeline funnel">
          <ResponsiveContainer width="100%" height={240}>
            <FunnelChart>
              <Tooltip formatter={(v) => [v, "leads"]} />
              <Funnel dataKey="value" data={pipelineData} isAnimationActive>
                {pipelineData.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i]} />
                ))}
                <LabelList position="right" fill="var(--text)" style={{ fontSize: 11 }} />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Leads by vertical">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={verticalData} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {verticalData.map((_, i) => <Cell key={i} fill={VERTICAL_COLORS[i % VERTICAL_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Tier distribution">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={tierData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false} style={{ fontSize: 11 }}>
                {tierData.map((_, i) => <Cell key={i} fill={TIER_COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Status breakdown">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData} margin={{ left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Leads by country">
          <div className="space-y-2">
            {countryData.map(({ name, value }) => {
              const pct = Math.round((value / countryData[0].value) * 100);
              return (
                <div key={name}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{name}</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--navy)" }}>{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--navy)", width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

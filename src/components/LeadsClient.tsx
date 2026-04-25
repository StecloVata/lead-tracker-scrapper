"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Lead, LeadFilters } from "@/types/lead";
import LeadCard from "./LeadCard";
import LeadFiltersBar from "./LeadFiltersBar";
import LeadModal from "./LeadModal";
import StatsBar from "./StatsBar";
import { downloadCSV, parseCSV } from "@/lib/csv";

const VERTICALS = ["All verticals", "BPO", "Insurance & Finance", "Debt Collection", "Telecoms & Utilities", "Solar & Energy", "Recruitment & Staffing", "SaaS / Tech Sales"];
const COUNTRIES = ["All countries", "Sweden", "Norway", "Denmark", "UK", "Netherlands", "Germany", "Belgium", "Switzerland", "Ireland", "Finland"];
const TIERS = ["All tiers", "Tier 1", "Tier 2", "Tier 3"];
const STATUSES_FILTER = ["All statuses", "Not contacted", "Researching", "Contacted", "Meeting booked", "Qualified", "Closed", "Not a fit"];

export default function LeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filters, setFilters] = useState<LeadFilters>({ vertical: "All verticals", country: "All countries", tier: "All tiers", search: "", status: "All statuses" });
  const [sortBy, setSortBy] = useState("tier");

  async function fetchLeads() {
    setLoading(true);
    const res = await fetch("/api/leads");
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { fetchLeads(); }, []);

  const filtered = useMemo(() => {
    let list = leads.filter(l => {
      if (filters.vertical !== "All verticals" && l.vertical !== filters.vertical) return false;
      if (filters.country !== "All countries" && l.country !== filters.country) return false;
      if (filters.tier !== "All tiers" && `Tier ${l.tier}` !== filters.tier) return false;
      if (filters.status !== "All statuses" && l.status !== filters.status) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${l.company} ${l.country} ${l.city} ${l.vertical} ${l.notes} ${l.persona}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sortBy === "tier") list = [...list].sort((a, b) => a.tier - b.tier);
    if (sortBy === "company") list = [...list].sort((a, b) => a.company.localeCompare(b.company));
    if (sortBy === "country") list = [...list].sort((a, b) => a.country.localeCompare(b.country));
    if (sortBy === "date_desc") list = [...list].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    if (sortBy === "date_asc") list = [...list].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    if (sortBy === "ai_score") list = [...list].sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));
    return list;
  }, [leads, filters, sortBy]);

  const updateLead = useCallback(async (id: string, patch: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
  }, []);

  const addLead = useCallback(async (lead: Partial<Lead>) => {
    const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
    const newLead = await res.json();
    setLeads(prev => [newLead, ...prev]);
    return newLead;
  }, []);


  function handleExportCSV() {
    downloadCSV(filtered, "adversus-leads.csv");
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    for (const row of rows) await addLead(row);
    e.target.value = "";
  }

  const KANBAN_COLS = ["Not contacted", "Researching", "Contacted", "Meeting booked", "Qualified", "Closed", "Not a fit"] as const;

  return (
    <div className="space-y-4">
      <StatsBar leads={leads} />

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <LeadFiltersBar
          filters={filters}
          setFilters={setFilters}
          sortBy={sortBy}
          setSortBy={setSortBy}
          verticals={VERTICALS}
          countries={COUNTRIES}
          tiers={TIERS}
          statuses={STATUSES_FILTER}
        />
        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {(["list", "kanban"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
              style={{ background: view === v ? "var(--navy)" : "#fff", color: view === v ? "#fff" : "var(--muted)" }}>
              {v}
            </button>
          ))}
        </div>

        {/* Export / Import */}
        <button onClick={handleExportCSV} className="text-xs px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: "var(--border)", color: "var(--text-sub)", background: "#fff" }}>
          Export CSV
        </button>
        <label className="text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors" style={{ borderColor: "var(--border)", color: "var(--text-sub)", background: "#fff" }}>
          Import CSV
          <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
        </label>

        {/* Add lead */}
        <button
          onClick={() => setSelectedLead({} as Lead)}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
          style={{ background: "var(--navy)", color: "#fff" }}
        >
          + Add lead
        </button>
      </div>

      {/* Count */}
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        {filtered.length} of {leads.length} leads
      </p>

      {/* List view */}
      {view === "list" && (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--border)" }} />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-16" style={{ color: "var(--muted)" }}>No leads match your filters</div>
          ) : (
            filtered.map(lead => (
              <LeadCard key={lead.id} lead={lead} onOpen={() => setSelectedLead(lead)} onStatusChange={s => updateLead(lead.id, { status: s })} onPriorityToggle={() => updateLead(lead.id, { is_priority: !lead.is_priority })} onAIScore={() => {}} />
            ))
          )}
        </div>
      )}

      {/* Kanban view */}
      {view === "kanban" && (
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
          {KANBAN_COLS.map(col => {
            const colLeads = filtered.filter(l => l.status === col);
            return (
              <div key={col} className="flex-shrink-0 w-64">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <StatusDot status={col} />
                  <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{col}</span>
                  <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>{colLeads.length}</span>
                </div>
                <div className="space-y-2 min-h-[60px]">
                  {colLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} compact onOpen={() => setSelectedLead(lead)} onStatusChange={s => updateLead(lead.id, { status: s })} onPriorityToggle={() => updateLead(lead.id, { is_priority: !lead.is_priority })} onAIScore={() => {}} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead modal */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSave={async (patch) => {
            if (selectedLead.id) {
              await updateLead(selectedLead.id, patch);
              setSelectedLead(prev => prev ? { ...prev, ...patch } : null);
            } else {
              const created = await addLead(patch);
              setSelectedLead(null);
              return created;
            }
          }}
          onDelete={selectedLead.id ? () => { deleteLead(selectedLead.id); setSelectedLead(null); } : undefined}
        />
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "Not contacted": "#9ca3af", "Researching": "#3b82f6", "Contacted": "#8b5cf6",
    "Meeting booked": "#f97316", "Qualified": "#22c55e", "Closed": "#16a34a", "Not a fit": "#ef4444",
  };
  return <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[status] ?? "#9ca3af" }} />;
}

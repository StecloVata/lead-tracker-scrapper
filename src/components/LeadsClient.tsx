"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Lead, LeadFilters } from "@/types/lead";
import LeadCard from "./LeadCard";
import LeadFiltersBar from "./LeadFiltersBar";
import LeadModal from "./LeadModal";
import StatsBar from "./StatsBar";
import { downloadCSV, downloadCSVTemplate, parseCSV } from "@/lib/csv";

const VERTICALS = ["All verticals", "BPO", "Insurance & Finance", "Debt Collection", "Telecoms & Utilities", "Solar & Energy", "Recruitment & Staffing", "SaaS / Tech Sales"];
const COUNTRIES = ["All countries", "Sweden", "Norway", "Denmark", "UK", "Netherlands", "Germany", "Belgium", "Switzerland", "Ireland", "Finland"];
const TIERS = ["All tiers", "Tier 1", "Tier 2", "Tier 3"];
const STATUSES_FILTER = ["All statuses", "Not contacted", "Researching", "Contacted", "Meeting booked", "Qualified", "Closed", "Not a fit"];
const ARCHIVABLE_STATUSES = ["Not contacted", "Researching", "Contacted", "Meeting booked", "Qualified", "Closed", "Not a fit"];

export default function LeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [archivedLeads, setArchivedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pipeline" | "archived">("pipeline");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filters, setFilters] = useState<LeadFilters>({ vertical: "All verticals", country: "All countries", tier: "All tiers", search: "", status: "All statuses" });
  const [sortBy, setSortBy] = useState("tier");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [extractUrl, setExtractUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [showArchiveMenu, setShowArchiveMenu] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState("");
  // Signal badge data: leadId → { unread, maxUrgency }
  const [signalCounts, setSignalCounts] = useState<Record<string, { unread: number; maxUrgency: 1 | 2 | 3 | null }>>({});

  async function fetchLeads() {
    setLoading(true);
    const [active, archived] = await Promise.all([
      fetch("/api/leads").then(r => r.json()),
      fetch("/api/leads?archived=true").then(r => r.json()),
    ]);
    setLeads(Array.isArray(active) ? active : []);
    setArchivedLeads(Array.isArray(archived) ? archived : []);
    setLoading(false);
  }

  async function fetchSignalCounts() {
    try {
      const data = await fetch("/api/signals/counts").then(r => r.json());
      if (!Array.isArray(data)) return;
      const map: Record<string, { unread: number; maxUrgency: 1 | 2 | 3 | null }> = {};
      for (const item of data) {
        map[item.lead_id] = { unread: item.unread, maxUrgency: item.max_urgency as 1 | 2 | 3 };
      }
      setSignalCounts(map);
    } catch { /* silent */ }
  }

  useEffect(() => { fetchLeads(); fetchSignalCounts(); }, []);

  useEffect(() => {
    function openFirst() {
      setLeads(current => {
        const first = current.find(l => !l.is_archived);
        if (first) setSelectedLead(first);
        return current;
      });
    }
    function closeModal() {
      setSelectedLead(null);
    }
    window.addEventListener("tutorial:open-first-lead", openFirst);
    window.addEventListener("tutorial:close-modal", closeModal);
    return () => {
      window.removeEventListener("tutorial:open-first-lead", openFirst);
      window.removeEventListener("tutorial:close-modal", closeModal);
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const overdueLeads = leads.filter(l => l.next_action_date && l.next_action_date < today);
  const dueTodayLeads = leads.filter(l => l.next_action_date === today);

  const filtered = useMemo(() => {
    const source = tab === "archived" ? archivedLeads : leads;
    let list = source.filter(l => {
      if (filters.vertical !== "All verticals" && l.vertical !== filters.vertical) return false;
      if (filters.country !== "All countries" && l.country !== filters.country) return false;
      if (filters.tier !== "All tiers" && `Tier ${l.tier}` !== filters.tier) return false;
      if (filters.status !== "All statuses" && l.status !== filters.status) return false;
      if (filters.search === "__overdue__") {
        const t = new Date().toISOString().slice(0, 10);
        if (!l.next_action_date || l.next_action_date >= t) return false;
      } else if (filters.search === "__today__") {
        const t = new Date().toISOString().slice(0, 10);
        if (l.next_action_date !== t) return false;
      } else if (filters.search) {
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
  }, [leads, archivedLeads, tab, filters, sortBy]);

  const updateLead = useCallback(async (id: string, patch: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    setArchivedLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    setArchivedLeads(prev => prev.filter(l => l.id !== id));
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
  }, []);

  const addLead = useCallback(async (lead: Partial<Lead>) => {
    const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
    const newLead = await res.json();
    setLeads(prev => [newLead, ...prev]);
    return newLead;
  }, []);

  const archiveLead = useCallback(async (id: string) => {
    setLeads(prev => {
      const lead = prev.find(l => l.id === id);
      if (lead) setArchivedLeads(a => [{ ...lead, is_archived: true }, ...a]);
      return prev.filter(l => l.id !== id);
    });
    await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_archived: true }) });
  }, []);

  const restoreLead = useCallback(async (id: string) => {
    setArchivedLeads(prev => {
      const lead = prev.find(l => l.id === id);
      if (lead) setLeads(a => [{ ...lead, is_archived: false }, ...a]);
      return prev.filter(l => l.id !== id);
    });
    await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_archived: false }) });
  }, []);

  async function archiveByStatus(status: string) {
    setArchiving(true);
    setShowArchiveMenu(false);
    const res = await fetch("/api/leads/archive-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, archived: true }),
    });
    const data = await res.json();
    setArchiving(false);
    if (!data.error) {
      await fetchLeads();
      const moved = leads.filter(l => l.status === status).length;
      setArchiveMsg(`${moved} "${status}" leads archived.`);
      setTimeout(() => setArchiveMsg(""), 4000);
    }
  }

  async function handleExtractLead() {
    if (!extractUrl.trim()) return;
    setExtracting(true);
    setExtractError("");
    const res = await fetch("/api/extract-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: extractUrl.trim() }),
    });
    const data = await res.json();
    setExtracting(false);
    if (data.error) {
      setExtractError(data.error);
    } else {
      setShowUrlInput(false);
      setExtractUrl("");
      setExtractError("");
      setSelectedLead({ ...data, status: "Not contacted", is_priority: false, tier: 2 } as Lead);
    }
  }

  function handleExportCSV() {
    downloadCSV(filtered, "adversus-leads.csv");
  }

  const [importMsg, setImportMsg] = useState<{ type: "ok" | "warn" | "error"; text: string } | null>(null);

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { leads, skipped, unknownHeaders } = parseCSV(text);
    e.target.value = "";

    if (leads.length === 0) {
      const hint = unknownHeaders.length
        ? `No leads found. Unrecognised columns: ${unknownHeaders.slice(0, 4).join(", ")}. Make sure your CSV has a "company" column.`
        : 'No leads found. Make sure your CSV has a "company" column and at least one data row.';
      setImportMsg({ type: "error", text: hint });
      setTimeout(() => setImportMsg(null), 8000);
      return;
    }

    for (const row of leads) await addLead(row);

    const parts = [`✓ ${leads.length} lead${leads.length !== 1 ? "s" : ""} imported`];
    if (skipped > 0) parts.push(`${skipped} row${skipped !== 1 ? "s" : ""} skipped (no company name)`);
    if (unknownHeaders.length) parts.push(`unknown columns ignored: ${unknownHeaders.slice(0, 3).join(", ")}`);
    setImportMsg({ type: skipped > 0 || unknownHeaders.length > 0 ? "warn" : "ok", text: parts.join(" · ") });
    setTimeout(() => setImportMsg(null), 6000);
  }

  const KANBAN_COLS = ["Not contacted", "Researching", "Contacted", "Meeting booked", "Qualified", "Closed", "Not a fit"] as const;

  return (
    <div className="space-y-4">
      <StatsBar leads={leads} />

      {/* Overdue / Due today chips */}
      <div data-tutorial="next-action-area" />
      {(overdueLeads.length > 0 || dueTodayLeads.length > 0) && tab === "pipeline" && (
        <div className="flex gap-2">
          {overdueLeads.length > 0 && (
            <button
              onClick={() => { setTab("pipeline"); setFilters(f => ({ ...f, search: "__overdue__" })); }}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: "#fee2e2", color: "#991b1b" }}
            >
              🔴 {overdueLeads.length} overdue
            </button>
          )}
          {dueTodayLeads.length > 0 && (
            <button
              onClick={() => { setTab("pipeline"); setFilters(f => ({ ...f, search: "__today__" })); }}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: "#fff7ed", color: "#9a3412" }}
            >
              🟠 {dueTodayLeads.length} due today
            </button>
          )}
          {(filters.search === "__overdue__" || filters.search === "__today__") && (
            <button
              onClick={() => setFilters(f => ({ ...f, search: "" }))}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
            >
              ✕ Clear filter
            </button>
          )}
        </div>
      )}

      {/* Pipeline / Archived tabs */}
      <div data-tutorial="pipeline-tabs" className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--border)" }}>
        {(["pipeline", "archived"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="text-xs px-4 py-1.5 rounded-lg font-medium capitalize transition-all"
            style={{
              background: tab === t ? "#fff" : "transparent",
              color: tab === t ? "var(--text)" : "var(--muted)",
              boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {t === "pipeline" ? `Pipeline (${leads.length})` : `Archived (${archivedLeads.length})`}
          </button>
        ))}
      </div>

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

        {tab === "pipeline" && (
          <>
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
            <div className="flex items-center gap-1">
              <label className="text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors" style={{ borderColor: "var(--border)", color: "var(--text-sub)", background: "#fff" }}>
                Import CSV
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleImportCSV} />
              </label>
              <CSVInfoTooltip />
            </div>
            <button onClick={downloadCSVTemplate} className="text-xs px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: "var(--border)", color: "var(--text-sub)", background: "#fff" }} title="Download a blank CSV template with the correct column names">
              Template ↓
            </button>

            {/* Bulk archive by status */}
            <div className="relative">
              <button
                onClick={() => setShowArchiveMenu(m => !m)}
                disabled={archiving}
                className="text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text-sub)", background: "#fff" }}
              >
                {archiving ? "Archiving…" : "🗂 Archive by status ▾"}
              </button>
              {showArchiveMenu && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl shadow-lg z-50 py-1"
                  style={{ background: "#fff", border: "1px solid var(--border)", minWidth: "200px" }}
                >
                  <p className="text-xs px-4 py-2 font-semibold" style={{ color: "var(--muted)" }}>Archive all leads with status:</p>
                  {ARCHIVABLE_STATUSES.map(s => {
                    const n = leads.filter(l => l.status === s).length;
                    return (
                      <button
                        key={s}
                        onClick={() => archiveByStatus(s)}
                        disabled={n === 0}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center justify-between disabled:opacity-40"
                        style={{ color: "var(--text)" }}
                      >
                        <span>{s}</span>
                        <span className="font-semibold" style={{ color: "var(--muted)" }}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add lead */}
            <div className="relative" data-tutorial="add-lead-btn">
              <button
                onClick={() => { setShowAddMenu(m => !m); setShowUrlInput(false); setExtractError(""); setExtractUrl(""); }}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: "var(--orange)", color: "#fff" }}
              >
                + Add lead ▾
              </button>
              {showAddMenu && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl shadow-lg z-50 overflow-hidden"
                  style={{ background: "#fff", border: "1px solid var(--border)", minWidth: "200px" }}
                >
                  <button
                    className="w-full text-left px-4 py-3 text-xs hover:bg-gray-50 transition-colors"
                    style={{ color: "var(--text)" }}
                    onClick={() => { setShowAddMenu(false); setShowUrlInput(false); setSelectedLead({} as Lead); }}
                  >
                    <div className="font-semibold">✏️ Add manually</div>
                    <div className="mt-0.5" style={{ color: "var(--muted)" }}>Fill in all fields yourself</div>
                  </button>
                  <div style={{ borderTop: "1px solid var(--border)" }} />
                  <button
                    className="w-full text-left px-4 py-3 text-xs hover:bg-gray-50 transition-colors"
                    style={{ color: "var(--text)" }}
                    onClick={() => { setShowUrlInput(true); setShowAddMenu(false); }}
                  >
                    <div className="font-semibold">🔗 Add via link</div>
                    <div className="mt-0.5" style={{ color: "var(--muted)" }}>Auto-fill from website or LinkedIn</div>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* URL extraction panel */}
      {showUrlInput && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "#fff", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>🔗 Add lead via link</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Paste a company website or LinkedIn company page URL — we'll extract the details automatically.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={extractUrl}
              onChange={e => setExtractUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleExtractLead()}
              placeholder="https://company.com or linkedin.com/company/..."
              className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
              style={{ border: "1px solid var(--border)", color: "var(--text)", background: "var(--surface)" }}
              autoFocus
            />
            <button
              onClick={handleExtractLead}
              disabled={extracting || !extractUrl.trim()}
              className="text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              style={{ background: "var(--orange)", color: "#fff" }}
            >
              {extracting ? "Extracting…" : "Extract"}
            </button>
            <button
              onClick={() => { setShowUrlInput(false); setExtractUrl(""); setExtractError(""); }}
              className="text-xs px-3 py-2 rounded-lg"
              style={{ border: "1px solid var(--border)", color: "var(--text-sub)" }}
            >
              Cancel
            </button>
          </div>
          {extractError && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#fee2e2", color: "#991b1b" }}>{extractError}</p>
          )}
        </div>
      )}

      {/* Import feedback */}
      {importMsg && (
        <div className="p-3 rounded-xl text-xs font-medium" style={{
          background: importMsg.type === "error" ? "#fee2e2" : importMsg.type === "warn" ? "#fff7ed" : "#dcfce7",
          color: importMsg.type === "error" ? "#991b1b" : importMsg.type === "warn" ? "#9a3412" : "#166534",
        }}>
          {importMsg.text}
        </div>
      )}

      {/* Archive confirmation message */}
      {archiveMsg && (
        <div className="p-3 rounded-xl text-xs font-medium" style={{ background: "#f3f4f6", color: "var(--text-sub)" }}>
          🗂 {archiveMsg}
        </div>
      )}

      {/* Count */}
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        {filtered.length} of {tab === "archived" ? archivedLeads.length : leads.length} leads
      </p>

      {/* List view */}
      {(tab === "archived" || view === "list") && (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--border)" }} />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-16" style={{ color: "var(--muted)" }}>
              {tab === "archived" ? "No archived leads." : "No leads match your filters"}
            </div>
          ) : (
            filtered.map((lead, idx) => (
              <div key={lead.id} data-tutorial={idx === 0 ? "first-lead-card" : undefined}>
                <LeadCard
                  lead={lead}
                  onOpen={() => setSelectedLead(lead)}
                  onStatusChange={s => updateLead(lead.id, { status: s })}
                  onPriorityToggle={() => updateLead(lead.id, { is_priority: !lead.is_priority })}
                  onAIScore={() => {}}
                  onArchive={tab === "pipeline" ? () => archiveLead(lead.id) : undefined}
                  onRestore={tab === "archived" ? () => restoreLead(lead.id) : undefined}
                  signalUnread={signalCounts[lead.id]?.unread ?? 0}
                  signalMaxUrgency={signalCounts[lead.id]?.maxUrgency ?? null}
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* Kanban view — pipeline only */}
      {tab === "pipeline" && view === "kanban" && (
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

function CSVInfoTooltip() {
  const [open, setOpen] = useState(false);

  const COLUMNS = [
    { name: "company", req: true,  aliases: "Company Name, Organization, Name, Firm",       values: "Any text" },
    { name: "country", req: false, aliases: "Nation",                                        values: "Any text — e.g. Sweden, Germany" },
    { name: "city",    req: false, aliases: "Location, HQ, Town",                            values: "Any text" },
    { name: "vertical",req: false, aliases: "Industry, Sector, Segment",                     values: "BPO · Insurance & Finance · Debt Collection · Telecoms & Utilities · Solar & Energy · Recruitment & Staffing · SaaS / Tech Sales" },
    { name: "tier",    req: false, aliases: "Priority Tier, Priority",                       values: "1, 2 or 3  (default: 2)" },
    { name: "size",    req: false, aliases: "Company Size, Employees, Headcount",             values: "Any text — e.g. 50–200" },
    { name: "website", req: false, aliases: "URL, Domain, Web",                              values: "Domain without https — e.g. acmebpo.se" },
    { name: "persona", req: false, aliases: "Contact, Decision Maker, Key Persona",          values: "Any text — e.g. Head of Operations" },
    { name: "trigger", req: false, aliases: "Sales Trigger, Reason, Buying Trigger",         values: "Any text" },
    { name: "notes",   req: false, aliases: "Description, Note, Comments, Details, Info",    values: "Any text" },
    { name: "status",  req: false, aliases: "—",                                             values: "Not contacted · Researching · Contacted · Meeting booked · Qualified · Closed · Not a fit  (default: Not contacted)" },
    { name: "linkedin",req: false, aliases: "LinkedIn URL",                                  values: "Full URL — e.g. linkedin.com/company/acme" },
  ];

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center border transition-colors"
        style={{ borderColor: "var(--border)", color: "var(--text-sub)", background: "#fff" }}
        aria-label="CSV import requirements"
      >
        i
      </button>

      {open && (
        <div
          className="fixed rounded-2xl shadow-2xl z-50 overflow-hidden"
          style={{ width: 520, background: "#fff", border: "1px solid var(--border)", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)", background: "#f8f9ff" }}>
            <p className="text-sm font-bold" style={{ color: "var(--navy)" }}>CSV Import Requirements</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              First row must be headers · UTF-8 encoding · Rows without a company name are skipped
            </p>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th className="text-left px-4 py-2 font-semibold" style={{ color: "var(--text-sub)" }}>Column</th>
                  <th className="text-left px-4 py-2 font-semibold" style={{ color: "var(--text-sub)" }}>Also recognised as</th>
                  <th className="text-left px-4 py-2 font-semibold" style={{ color: "var(--text-sub)" }}>Accepted values</th>
                </tr>
              </thead>
              <tbody>
                {COLUMNS.map((col, i) => (
                  <tr key={col.name} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderTop: "1px solid var(--border)" }}>
                    <td className="px-4 py-2 align-top font-mono" style={{ color: "var(--navy)", whiteSpace: "nowrap" }}>
                      {col.name}
                      {col.req && (
                        <span className="ml-1.5 text-xs font-sans font-semibold px-1 py-0.5 rounded" style={{ background: "#fee2e2", color: "#991b1b" }}>required</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top" style={{ color: "var(--text-sub)" }}>{col.aliases}</td>
                    <td className="px-4 py-2 align-top" style={{ color: "var(--muted)" }}>{col.values}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Example row */}
          <div className="px-5 py-4 border-t" style={{ borderColor: "var(--border)", background: "#f8f9ff" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-sub)" }}>Example</p>
            <div className="rounded-lg overflow-x-auto p-3 text-xs font-mono leading-relaxed" style={{ background: "#1a2355", color: "#57dadd" }}>
              <div style={{ color: "rgba(255,255,255,0.4)" }}>company,country,city,vertical,tier,size,website,notes,status</div>
              <div>Acme BPO,Sweden,Stockholm,BPO,2,50–200,acmebpo.se,Strong outbound focus,Not contacted</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

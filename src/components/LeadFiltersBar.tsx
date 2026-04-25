"use client";

import type { LeadFilters } from "@/types/lead";

interface Props {
  filters: LeadFilters;
  setFilters: (f: LeadFilters) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  verticals: string[];
  countries: string[];
  tiers: string[];
  statuses: string[];
}

export default function LeadFiltersBar({ filters, setFilters, sortBy, setSortBy, verticals, countries, tiers, statuses }: Props) {
  const selectStyle = {
    border: "1px solid var(--border)",
    background: "#fff",
    color: "var(--text-sub)",
    fontSize: "12px",
    padding: "6px 10px",
    borderRadius: "8px",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <input
        type="text"
        placeholder="Search leads…"
        value={filters.search}
        onChange={e => setFilters({ ...filters, search: e.target.value })}
        className="text-xs px-3 py-1.5 rounded-lg outline-none w-48"
        style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--text)" }}
      />

      <select style={selectStyle} value={filters.vertical} onChange={e => setFilters({ ...filters, vertical: e.target.value })}>
        {verticals.map(v => <option key={v}>{v}</option>)}
      </select>

      <select style={selectStyle} value={filters.country} onChange={e => setFilters({ ...filters, country: e.target.value })}>
        {countries.map(c => <option key={c}>{c}</option>)}
      </select>

      <select style={selectStyle} value={filters.tier} onChange={e => setFilters({ ...filters, tier: e.target.value })}>
        {tiers.map(t => <option key={t}>{t}</option>)}
      </select>

      <select style={selectStyle} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
        {statuses.map(s => <option key={s}>{s}</option>)}
      </select>

      <select style={selectStyle} value={sortBy} onChange={e => setSortBy(e.target.value)}>
        <option value="tier">Sort: Tier</option>
        <option value="company">Sort: Company</option>
        <option value="country">Sort: Country</option>
        <option value="date_desc">Sort: Newest first</option>
        <option value="date_asc">Sort: Oldest first</option>
        <option value="ai_score">Sort: AI Score</option>
      </select>
    </div>
  );
}

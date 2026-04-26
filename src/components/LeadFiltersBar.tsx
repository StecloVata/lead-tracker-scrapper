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
  const selectStyle: React.CSSProperties = {
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text-sub)",
    fontSize: "13px",
    fontWeight: 500,
    padding: "7px 11px",
    paddingRight: "26px",
    borderRadius: "10px",
    outline: "none",
    cursor: "pointer",
    transition: "border-color 0.15s ease, background 0.15s ease",
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <input
        type="text"
        placeholder="Search leads…"
        value={filters.search}
        onChange={e => setFilters({ ...filters, search: e.target.value })}
        className="text-sm px-3.5 py-2 rounded-lg outline-none w-56 transition-all"
        style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }}
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

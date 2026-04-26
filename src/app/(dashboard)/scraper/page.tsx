"use client";

import { useState } from "react";

const REGIONS = ["Nordics", "DACH", "Benelux", "UK & Ireland", "Southern Europe"];
const REGION_COUNTRIES: Record<string, string[]> = {
  "Nordics": ["Sweden", "Norway", "Denmark", "Finland"],
  "DACH": ["Germany", "Austria", "Switzerland"],
  "Benelux": ["Netherlands", "Belgium", "Luxembourg"],
  "UK & Ireland": ["UK", "Ireland"],
  "Southern Europe": ["Spain", "Italy", "Portugal", "France"],
};
const VERTICALS = ["BPO", "Insurance & Finance", "Debt Collection", "Telecoms & Utilities", "Solar & Energy", "Recruitment & Staffing", "SaaS / Tech Sales"];
const SIZES = ["Any size", "Small (10–50)", "Mid-market (50–200)", "Large (200+)"];
const TIERS = [
  { value: 1, label: "Tier 1 — Outbound-only, high volume" },
  { value: 2, label: "Tier 2 — Mixed outbound" },
  { value: 3, label: "Tier 3 — Some outbound" },
];

interface LeadResult {
  company: string;
  website: string;
  country: string;
  vertical: string;
  tier: number;
  size: string;
  notes: string;
  linkedin_url: string;
  isNew: boolean;
}

export default function ScraperPage() {
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [vertical, setVertical] = useState("");
  const [size, setSize] = useState("Any size");
  const [tier, setTier] = useState(2);
  const [count, setCount] = useState(10);
  const [results, setResults] = useState<LeadResult[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedCount, setAddedCount] = useState(0);

  const availableCountries = region ? REGION_COUNTRIES[region] ?? [] : [];

  async function handleSearch() {
    setLoading(true);
    setError("");
    setResults([]);
    setSelected(new Set());
    setAddedCount(0);

    const res = await fetch("/api/generate-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        region: region || undefined,
        country: country || undefined,
        vertical: vertical || undefined,
        size: size !== "Any size" ? size : undefined,
        tier,
        count,
      }),
    });

    const data = await res.json();
    if (data.error) {
      setError(data.error);
    } else {
      setResults(data.leads ?? []);
    }
    setLoading(false);
  }

  function toggleSelect(i: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(results.map((_, i) => i).filter(i => results[i].isNew)));
  }

  async function addSelected() {
    const toAdd = [...selected].map(i => results[i]);
    let added = 0;
    for (const lead of toAdd) {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: lead.company,
          website: lead.website,
          country: lead.country,
          city: "",
          vertical: lead.vertical,
          tier: lead.tier,
          size: lead.size,
          persona: "",
          trigger: `Found via lead generator — ${region || "Any region"}, ${vertical || "Any vertical"}`,
          notes: lead.notes,
          status: "Not contacted",
          is_priority: false,
        }),
      });
      added++;
    }
    setAddedCount(added);
    setSelected(new Set());
    // Mark added leads as no longer new
    setResults(prev => prev.map((l, i) => selected.has(i) ? { ...l, isNew: false } : l));
  }

  const newLeads = results.filter(l => l.isNew);
  const selectStyle = {
    border: "1px solid var(--border)",
    background: "#fff",
    color: "var(--text)",
    fontSize: "13px",
    padding: "8px 12px",
    borderRadius: "10px",
    outline: "none",
    cursor: "pointer",
    width: "100%",
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Lead Generator</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Find new companies that match your ICP. Duplicates from your existing list are flagged automatically.
        </p>
      </div>

      {/* Filter panel */}
      <div className="rounded-2xl p-6 space-y-5" style={{ background: "#fff", border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-2 gap-4">
          {/* Region */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-sub)" }}>Region</label>
            <select style={selectStyle} value={region} onChange={e => { setRegion(e.target.value); setCountry(""); }}>
              <option value="">Any region</option>
              {REGIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          {/* Country */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-sub)" }}>
              Specific country {!region && <span style={{ color: "var(--muted)" }}>(select region first)</span>}
            </label>
            <select style={{ ...selectStyle, opacity: availableCountries.length ? 1 : 0.5 }} value={country} onChange={e => setCountry(e.target.value)} disabled={!availableCountries.length}>
              <option value="">Any country in region</option>
              {availableCountries.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Vertical */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-sub)" }}>Industry / Vertical</label>
            <select style={selectStyle} value={vertical} onChange={e => setVertical(e.target.value)}>
              <option value="">Any vertical</option>
              {VERTICALS.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {/* Company size */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-sub)" }}>Company size</label>
            <select style={selectStyle} value={size} onChange={e => setSize(e.target.value)}>
              {SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Tier */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>Target tier</label>
          <div className="flex gap-2">
            {TIERS.map(t => (
              <button
                key={t.value}
                onClick={() => setTier(t.value)}
                className="flex-1 text-xs px-3 py-2 rounded-lg hover-btn text-left"
                style={{
                  border: `1px solid ${tier === t.value ? "var(--orange)" : "var(--border)"}`,
                  background: tier === t.value ? "var(--orange)" : "#fff",
                  color: tier === t.value ? "#fff" : "var(--text-sub)",
                }}
              >
                <div className="font-semibold">T{t.value}</div>
                <div className="opacity-75 mt-0.5" style={{ fontSize: "10px" }}>
                  {t.label.split("—")[1]?.trim()}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Count slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium" style={{ color: "var(--text-sub)" }}>Number of leads to find</label>
            <span className="text-sm font-bold" style={{ color: "var(--navy)" }}>{count}</span>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            step={5}
            value={count}
            onChange={e => setCount(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--navy)" }}
          />
          <div className="flex justify-between text-xs mt-1" style={{ color: "var(--muted)" }}>
            <span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 hover-btn"
          style={{ background: "var(--orange)", color: "#fff" }}
        >
          {loading ? "Finding leads…" : `Find ${count} leads`}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl text-sm" style={{ background: "#fee2e2", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--border)" }} />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="space-y-3">
          {/* Results header */}
          <div className="flex items-center gap-3">
            <p className="text-xs flex-1" style={{ color: "var(--muted)" }}>
              <span className="font-semibold" style={{ color: "var(--text)" }}>{newLeads.length} new</span> leads found
              {results.length - newLeads.length > 0 && ` · ${results.length - newLeads.length} already in your list`}
            </p>
            {newLeads.length > 0 && (
              <button onClick={selectAll} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--text-sub)" }}>
                Select all new
              </button>
            )}
            {selected.size > 0 && (
              <button
                onClick={addSelected}
                className="text-xs px-4 py-1.5 rounded-lg font-semibold"
                style={{ background: "var(--orange)", color: "#fff" }}
              >
                Add {selected.size} to pipeline
              </button>
            )}
          </div>

          {addedCount > 0 && (
            <div className="p-3 rounded-xl text-sm" style={{ background: "#dcfce7", color: "#166534" }}>
              ✓ {addedCount} leads added to your pipeline
            </div>
          )}

          {results.map((lead, i) => (
            <div
              key={i}
              onClick={() => lead.isNew && toggleSelect(i)}
              className="rounded-xl p-4 transition-all"
              style={{
                background: "#fff",
                border: `1px solid ${selected.has(i) ? "var(--orange)" : "var(--border)"}`,
                opacity: lead.isNew ? 1 : 0.5,
                cursor: lead.isNew ? "pointer" : "default",
                boxShadow: selected.has(i) ? "0 0 0 2px var(--orange)" : "none",
              }}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div
                  className="w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border"
                  style={{
                    background: selected.has(i) ? "var(--orange)" : "#fff",
                    borderColor: selected.has(i) ? "var(--orange)" : "var(--border)",
                  }}
                >
                  {selected.has(i) && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{lead.company}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#1d4ed8" }}>T{lead.tier}</span>
                    {lead.country && <span className="text-xs" style={{ color: "var(--muted)" }}>{lead.country}</span>}
                    {lead.vertical && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f3f4f6", color: "var(--text-sub)" }}>{lead.vertical}</span>}
                    {!lead.isNew && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>Already in list</span>}
                  </div>
                  {lead.notes && <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-sub)" }}>{lead.notes}</p>}
                  <div className="flex gap-3 mt-1">
                    {lead.website && <a href={`https://${lead.website}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs underline" style={{ color: "var(--navy)" }}>{lead.website}</a>}
                    {lead.linkedin_url && <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs underline" style={{ color: "var(--navy)" }}>LinkedIn</a>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="text-center py-16" style={{ color: "var(--muted)" }}>
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-sm">Set your filters above and click <strong>Find leads</strong></p>
        </div>
      )}
    </div>
  );
}

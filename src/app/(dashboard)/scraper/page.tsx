"use client";

import { useState } from "react";

const REGIONS: Record<string, string[]> = {
  "Nordics":        ["Norway", "Sweden", "Denmark", "Finland"],
  "DACH":           ["Germany", "Austria", "Switzerland"],
  "Benelux":        ["Netherlands", "Belgium", "Luxembourg"],
  "UK & Ireland":   ["UK", "Ireland"],
  "Southern Europe":["Spain", "Italy", "Portugal", "France"],
};

const ALL_COUNTRIES = Object.values(REGIONS).flat();

const VERTICALS = [
  "BPO", "Insurance & Finance", "Debt Collection",
  "Telecoms & Utilities", "Solar & Energy",
  "Recruitment & Staffing", "SaaS / Tech Sales",
];

const SIZES = ["Any size", "Small (10–50)", "Mid-market (50–200)", "Large (200+)"];

const TIERS = [
  { value: 1, label: "Tier 1", sub: "Outbound-only, high volume" },
  { value: 2, label: "Tier 2", sub: "Mixed outbound" },
  { value: 3, label: "Tier 3", sub: "Some outbound" },
];

// Countries with structured registries
const REGISTRY_COUNTRIES = ["Norway", "UK", "Denmark"];

interface Candidate {
  id: string;
  company: string;
  website: string;
  country: string;
  vertical: string;
  tier: number;
  size: string;
  notes: string;
  linkedin_url: string;
  emails: string[];
  phones: string[];
  people: { name: string; role: string; linkedin: string }[];
  tech_stack: string[];
  icp_score: number;
  is_duplicate: boolean;
  duplicate_match: string;
  duplicate_lead_id: string | null;
  review_status: string;
}

interface EnrichResult {
  emails: string[];
  phones: string[];
  people: { name: string; role: string; linkedin: string }[];
  tech_stack: string[];
  linkedin_url: string;
  description: string;
}

const selectStyle: React.CSSProperties = {
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

export default function ScraperPage() {
  // Step 1 — config
  const [region, setRegion]     = useState("");
  const [country, setCountry]   = useState("");
  const [vertical, setVertical] = useState("");
  const [size, setSize]         = useState("Any size");
  const [tier, setTier]         = useState(2);
  const [useRegistry, setUseRegistry] = useState(true);
  const [useJobBoards, setUseJobBoards] = useState(true);

  // Step 2 — results
  const [step, setStep]           = useState<1 | 2>(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [jobId, setJobId]         = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [addedCount, setAddedCount] = useState(0);
  const [approving, setApproving] = useState(false);

  // Detail panel
  const [detailId, setDetailId]   = useState<string | null>(null);
  const [enriching, setEnriching] = useState<string | null>(null);

  const availableCountries = region ? (REGIONS[region] ?? []) : ALL_COUNTRIES;
  const hasRegistry = REGISTRY_COUNTRIES.includes(country);

  const detail = candidates.find(c => c.id === detailId) ?? null;
  const newCandidates = candidates.filter(c => !c.is_duplicate);
  const dupeCandidates = candidates.filter(c => c.is_duplicate);

  async function handleScan() {
    if (!country || !vertical) {
      setError("Please select a country and vertical.");
      return;
    }
    setLoading(true);
    setError("");
    setCandidates([]);
    setSelected(new Set());
    setAddedCount(0);
    setStep(1);

    const res = await fetch("/api/scraper/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country,
        vertical,
        size: size !== "Any size" ? size : undefined,
        tier,
        sources: { registry: useRegistry, jobBoards: useJobBoards },
      }),
    });

    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setJobId(data.jobId);

    // Fetch candidates from the completed job
    const jobRes = await fetch(`/api/scraper/jobs/${data.jobId}`);
    const jobData = await jobRes.json();
    setCandidates(jobData.candidates ?? []);
    setStep(2);
    setLoading(false);
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllNew() {
    setSelected(new Set(newCandidates.map(c => c.id)));
  }

  async function handleApprove() {
    if (selected.size === 0) return;
    setApproving(true);
    const res = await fetch("/api/scraper/candidates/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    const data = await res.json();
    setAddedCount(data.added ?? 0);
    setSelected(new Set());

    // Refresh candidate list to reflect approved status
    if (jobId) {
      const jobRes = await fetch(`/api/scraper/jobs/${jobId}`);
      const jobData = await jobRes.json();
      setCandidates(jobData.candidates ?? []);
    }
    setApproving(false);
  }

  async function handleEnrich(candidate: Candidate) {
    if (!candidate.website) return;
    setEnriching(candidate.id);
    const res = await fetch("/api/scraper/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website: candidate.website, candidateId: candidate.id }),
    });
    const data: EnrichResult = await res.json();
    setCandidates(prev => prev.map(c =>
      c.id === candidate.id
        ? {
            ...c,
            emails:      data.emails?.length    ? data.emails    : c.emails,
            phones:      data.phones?.length    ? data.phones    : c.phones,
            people:      data.people?.length    ? data.people    : c.people,
            tech_stack:  data.tech_stack?.length ? data.tech_stack : c.tech_stack,
            linkedin_url: data.linkedin_url     || c.linkedin_url,
            notes:       data.description       || c.notes,
          }
        : c
    ));
    setEnriching(null);
  }

  const icpBar = (score: number) => {
    const w = Math.min(100, score * 12);
    const color = score >= 6 ? "#16a34a" : score >= 3 ? "var(--orange)" : "#94a3b8";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 48, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{score}</span>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", maxWidth: "100%" }}>
      {/* Main panel */}
      <div style={{ flex: 1, minWidth: 0 }} className="space-y-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Scraper</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Discover companies from structured registries and job boards. Duplicates are detected automatically.
          </p>
        </div>

        {/* Config panel */}
        <div className="rounded-2xl p-6 space-y-5" style={{ background: "#fff", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-sub)" }}>Region</label>
              <select style={selectStyle} value={region} onChange={e => { setRegion(e.target.value); setCountry(""); }}>
                <option value="">Any region</option>
                {Object.keys(REGIONS).map(r => <option key={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-sub)" }}>Country *</label>
              <select style={selectStyle} value={country} onChange={e => setCountry(e.target.value)}>
                <option value="">Select country</option>
                {availableCountries.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-sub)" }}>Vertical *</label>
              <select style={selectStyle} value={vertical} onChange={e => setVertical(e.target.value)}>
                <option value="">Select vertical</option>
                {VERTICALS.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>

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
                  <div className="font-semibold">{t.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{t.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Source toggles */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>Data sources</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text)" }}>
                <input
                  type="checkbox"
                  checked={useRegistry}
                  onChange={e => setUseRegistry(e.target.checked)}
                  style={{ accentColor: "var(--navy)" }}
                />
                Company Registry
                {country && (
                  <span style={{ color: hasRegistry ? "var(--navy)" : "var(--muted)", fontStyle: "italic" }}>
                    {hasRegistry ? `(${country === "Norway" ? "Brreg" : country === "UK" ? "Companies House" : "CVR"})` : "(not available for this country)"}
                  </span>
                )}
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text)" }}>
                <input
                  type="checkbox"
                  checked={useJobBoards}
                  onChange={e => setUseJobBoards(e.target.checked)}
                  style={{ accentColor: "var(--navy)" }}
                />
                Job Boards (Indeed)
              </label>
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={loading || !country || !vertical}
            className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 hover-btn"
            style={{ background: "var(--orange)", color: "#fff" }}
          >
            {loading ? "Scanning…" : "Start scan"}
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl text-sm" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</div>
        )}

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--border)" }} />
            ))}
          </div>
        )}

        {/* Results */}
        {step === 2 && !loading && candidates.length > 0 && (
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs flex-1" style={{ color: "var(--muted)" }}>
                <span className="font-semibold" style={{ color: "var(--text)" }}>{newCandidates.length} new</span>
                {dupeCandidates.length > 0 && ` · ${dupeCandidates.length} already in your pipeline`}
              </p>
              {newCandidates.length > 0 && (
                <button
                  onClick={selectAllNew}
                  className="text-xs px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: "var(--border)", color: "var(--text-sub)" }}
                >
                  Select all new
                </button>
              )}
              {selected.size > 0 && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="text-xs px-4 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                  style={{ background: "var(--orange)", color: "#fff" }}
                >
                  {approving ? "Adding…" : `Add ${selected.size} to pipeline`}
                </button>
              )}
            </div>

            {addedCount > 0 && (
              <div className="p-3 rounded-xl text-sm" style={{ background: "#dcfce7", color: "#166534" }}>
                ✓ {addedCount} leads added to your pipeline
              </div>
            )}

            {candidates.map(c => {
              const approved = c.review_status === "approved";
              const isDupe   = c.is_duplicate;
              const isSelected = selected.has(c.id);
              const canSelect  = !isDupe && !approved;

              return (
                <div
                  key={c.id}
                  onClick={() => canSelect && toggleSelect(c.id)}
                  className="rounded-xl p-4 transition-all"
                  style={{
                    background: "#fff",
                    border: `1px solid ${isSelected ? "var(--orange)" : "var(--border)"}`,
                    opacity: isDupe || approved ? 0.55 : 1,
                    cursor: canSelect ? "pointer" : "default",
                    boxShadow: isSelected ? "0 0 0 2px var(--orange)" : "none",
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div
                      className="w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border"
                      style={{
                        background: isSelected ? "var(--orange)" : "#fff",
                        borderColor: isSelected ? "var(--orange)" : "var(--border)",
                        visibility: canSelect ? "visible" : "hidden",
                      }}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{c.company}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#1d4ed8" }}>T{c.tier}</span>
                        {c.country && <span className="text-xs" style={{ color: "var(--muted)" }}>{c.country}</span>}
                        {c.vertical && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f3f4f6", color: "var(--text-sub)" }}>
                            {c.vertical}
                          </span>
                        )}
                        {isDupe && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>
                            Already in pipeline · matched on {c.duplicate_match}
                          </span>
                        )}
                        {approved && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#166534" }}>
                            Added ✓
                          </span>
                        )}
                        {c.tech_stack?.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#fdf4ff", color: "#7e22ce" }}>
                            {c.tech_stack.slice(0, 2).join(", ")}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        {icpBar(c.icp_score)}
                        {c.size && <span className="text-xs" style={{ color: "var(--muted)" }}>{c.size}</span>}
                        {c.emails?.length > 0 && (
                          <span className="text-xs" style={{ color: "var(--navy)" }}>
                            {c.emails.length} email{c.emails.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {c.people?.length > 0 && (
                          <span className="text-xs" style={{ color: "var(--navy)" }}>
                            {c.people.length} contact{c.people.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {c.notes && (
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-sub)" }}>{c.notes}</p>
                      )}

                      <div className="flex gap-3 mt-1.5 flex-wrap">
                        {c.website && (
                          <a
                            href={`https://${c.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs underline"
                            style={{ color: "var(--navy)" }}
                          >
                            {c.website}
                          </a>
                        )}
                        {c.linkedin_url && (
                          <a
                            href={c.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs underline"
                            style={{ color: "var(--navy)" }}
                          >
                            LinkedIn
                          </a>
                        )}
                        {c.website && !approved && !isDupe && (
                          <button
                            onClick={e => { e.stopPropagation(); setDetailId(c.id); }}
                            className="text-xs underline"
                            style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            Enrich →
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

        {step === 2 && !loading && candidates.length === 0 && (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm">No results found. Try a different country or vertical.</p>
          </div>
        )}
      </div>

      {/* Detail / Enrich panel */}
      {detail && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{
            width: 320,
            flexShrink: 0,
            background: "#fff",
            border: "1px solid var(--border)",
            position: "sticky",
            top: 24,
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>{detail.company}</h3>
            <button
              onClick={() => setDetailId(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          {detail.website && (
            <button
              onClick={() => handleEnrich(detail)}
              disabled={enriching === detail.id}
              className="w-full py-2 rounded-lg text-xs font-semibold disabled:opacity-50 hover-btn"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {enriching === detail.id ? "Enriching…" : "Crawl website"}
            </button>
          )}

          {detail.emails?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-sub)" }}>Emails</p>
              {detail.emails.map(e => (
                <p key={e} className="text-xs" style={{ color: "var(--text)" }}>{e}</p>
              ))}
            </div>
          )}

          {detail.phones?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-sub)" }}>Phone numbers</p>
              {detail.phones.map(p => (
                <p key={p} className="text-xs" style={{ color: "var(--text)" }}>{p}</p>
              ))}
            </div>
          )}

          {detail.people?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-sub)" }}>Contacts</p>
              {detail.people.map((p, i) => (
                <div key={i} className="mb-2">
                  <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{p.name}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{p.role}</p>
                  {p.linkedin && (
                    <a href={p.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: "var(--navy)" }}>
                      LinkedIn
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {detail.tech_stack?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-sub)" }}>Tech detected</p>
              <div className="flex flex-wrap gap-1">
                {detail.tech_stack.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#fdf4ff", color: "#7e22ce" }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {detail.notes && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-sub)" }}>Description</p>
              <p className="text-xs" style={{ color: "var(--text)" }}>{detail.notes}</p>
            </div>
          )}

          {!detail.emails?.length && !detail.phones?.length && !detail.people?.length && !enriching && (
            <p className="text-xs text-center py-4" style={{ color: "var(--muted)" }}>
              {detail.website ? 'Click "Crawl website" to extract contacts, emails, and tech stack.' : "No website available to enrich."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

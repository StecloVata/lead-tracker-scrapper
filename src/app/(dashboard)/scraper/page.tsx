"use client";

import { useState } from "react";

interface ScrapeResult {
  title: string;
  url: string;
  snippet: string;
}

const VERTICALS = ["", "BPO", "Insurance & Finance", "Debt Collection", "Telecoms & Utilities", "Solar & Energy", "Recruitment & Staffing", "SaaS / Tech Sales"];
const COUNTRIES = ["", "Sweden", "Norway", "Denmark", "UK", "Netherlands", "Germany", "Belgium", "Switzerland", "Ireland", "Finland"];

export default function ScraperPage() {
  const [query, setQuery] = useState("");
  const [vertical, setVertical] = useState("");
  const [country, setCountry] = useState("");
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);

    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, vertical, country }),
    });
    const data = await res.json();

    if (data.error) {
      setError(data.error);
    } else {
      setResults(data.results ?? []);
    }
    setLoading(false);
  }

  async function addAsLead(result: ScrapeResult) {
    const domain = new URL(result.url).hostname.replace("www.", "");
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: result.title.split(" - ")[0].split(" | ")[0].trim(),
        website: domain,
        notes: result.snippet,
        vertical: vertical || "BPO",
        country: country || "",
        city: "",
        tier: 2,
        size: "",
        persona: "",
        trigger: `Found via scraper: ${query}`,
        status: "Not contacted",
        is_priority: false,
      }),
    });
    setAddedUrls(prev => new Set([...prev, result.url]));
  }

  const inputStyle = {
    border: "1px solid var(--border)",
    background: "#fff",
    color: "var(--text)",
    fontSize: "13px",
    padding: "8px 12px",
    borderRadius: "8px",
    outline: "none",
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Lead Scraper</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Search Google for companies that could benefit from Adversus. Results are pulled via headless browser.</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="rounded-2xl p-5 space-y-4" style={{ background: "#fff", border: "1px solid var(--border)" }}>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-sub)" }}>Search query</label>
          <input
            style={inputStyle}
            className="w-full"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. outbound call center Belgium, debt collection Germany, solar sales team UK"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-sub)" }}>Vertical (optional)</label>
            <select style={{ ...inputStyle, cursor: "pointer" }} className="w-full" value={vertical} onChange={e => setVertical(e.target.value)}>
              <option value="">Any vertical</option>
              {VERTICALS.filter(Boolean).map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-sub)" }}>Country (optional)</label>
            <select style={{ ...inputStyle, cursor: "pointer" }} className="w-full" value={country} onChange={e => setCountry(e.target.value)}>
              <option value="">Any country</option>
              {COUNTRIES.filter(Boolean).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 transition-opacity"
          style={{ background: "var(--navy)", color: "#fff" }}
        >
          {loading ? "Scraping Google…" : "Search for leads"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl text-sm" style={{ background: "#fee2e2", color: "#991b1b" }}>
          <strong>Error:</strong> {error}
          <p className="mt-1 text-xs opacity-75">Tip: Make sure the dev server is running locally. On Vercel, scraping requires the Chromium layer to be configured.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--border)" }} />
          ))}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "var(--muted)" }}>{results.length} results found</p>
          {results.map((r, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid var(--border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline" style={{ color: "var(--navy)" }}>
                    {r.title}
                  </a>
                  <p className="text-xs mt-1" style={{ color: "var(--text-sub)" }}>{r.snippet}</p>
                  <p className="text-xs mt-1 truncate" style={{ color: "var(--muted)" }}>{r.url}</p>
                </div>
                <button
                  onClick={() => addAsLead(r)}
                  disabled={addedUrls.has(r.url)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0 transition-colors disabled:opacity-50"
                  style={{
                    background: addedUrls.has(r.url) ? "#dcfce7" : "var(--navy)",
                    color: addedUrls.has(r.url) ? "#166534" : "#fff",
                  }}
                >
                  {addedUrls.has(r.url) ? "Added ✓" : "Add as lead"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="text-center py-16" style={{ color: "var(--muted)" }}>
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm">Enter a search query above to find leads</p>
          <p className="text-xs mt-1 opacity-60">Try: &quot;call center outbound Norway&quot; or &quot;solar sales team Germany&quot;</p>
        </div>
      )}
    </div>
  );
}

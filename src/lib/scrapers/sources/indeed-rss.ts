import { type DedupIndex, checkDuplicate, extendIndex } from "../dedup";
import type { ScraperCandidate } from "./brreg";

// Indeed RSS — free, no API key, all countries
// Best for countries without a structured registry (DE, NL, FR, AT, etc.)
// Surfaces companies actively hiring in sales/contact-center roles = strong ICP signal

const VERTICAL_QUERIES: Record<string, string[]> = {
  "BPO":                    ["call center manager", "contact centre operations", "BPO team lead"],
  "Insurance & Finance":    ["insurance sales manager", "outbound insurance", "telesales insurance"],
  "Debt Collection":        ["debt collection manager", "collections team lead", "debt recovery"],
  "Telecoms & Utilities":   ["telecoms sales manager", "outbound telecoms", "utilities telesales"],
  "Solar & Energy":         ["solar sales manager", "renewable energy sales", "solar telesales"],
  "Recruitment & Staffing": ["recruitment sales manager", "staffing outbound", "sales recruiter"],
  "SaaS / Tech Sales":      ["inside sales manager", "SDR team lead", "sales development manager"],
};

const COUNTRY_INDEED: Record<string, string> = {
  "Germany":     "de",
  "Austria":     "at",
  "Switzerland": "ch",
  "Netherlands": "nl",
  "Belgium":     "be",
  "France":      "fr",
  "Spain":       "es",
  "Italy":       "it",
  "Portugal":    "pt",
  "UK":          "co.uk",
  "Ireland":     "ie",
  "Sweden":      "se",
  "Norway":      "no",
  "Denmark":     "dk",
  "Finland":     "fi",
};

const ICP_KEYWORDS = [
  "outbound","dialing","dialler","agents","campaigns","telemarketing",
  "bpo","seats","contact centre","contact center","call center","callcenter",
  "outsourcing","telesales","inside sales","cold calling",
];

function scoreICP(text: string): number {
  const lower = text.toLowerCase();
  return ICP_KEYWORDS.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
}

function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .trim();
}

interface RssJob {
  company:  string;
  location: string;
  title:    string;
  snippet:  string;
  url:      string;
}

async function fetchIndeedRss(query: string, countryCode: string): Promise<RssJob[]> {
  try {
    const tld = countryCode === "co.uk" ? "co.uk" : countryCode;
    const url = `https://${tld}.indeed.com/rss?q=${encodeURIComponent(query)}&sort=date&limit=25`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const jobs: RssJob[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block  = m[1];
      const title  = stripTags((block.match(/<title>([\s\S]*?)<\/title>/)     ?? [])[1] ?? "");
      const link   = stripTags((block.match(/<link[^>]*>([\s\S]*?)<\/link>/)  ?? [])[1] ?? "");
      const desc   = stripTags((block.match(/<description>([\s\S]*?)<\/description>/) ?? [])[1] ?? "");

      // Indeed job titles follow "Job Title - Company Name - City, Country"
      const parts    = title.split(" - ");
      const company  = parts.length >= 2 ? parts[parts.length - 2].trim() : "";
      const location = parts.length >= 1 ? parts[parts.length - 1].trim() : "";

      if (company && link) {
        jobs.push({ company, location, title: parts[0]?.trim() ?? "", snippet: desc, url: link });
      }
    }
    return jobs;
  } catch {
    return [];
  }
}

export async function fetchIndeedRSS(
  vertical: string,
  country: string,
  tier: number,
  index: DedupIndex,
): Promise<ScraperCandidate[]> {
  const countryCode = COUNTRY_INDEED[country];
  if (!countryCode) return [];

  const queries = VERTICAL_QUERIES[vertical] ?? ["call center manager", "outbound sales manager"];
  const candidates: ScraperCandidate[] = [];
  const seen = new Set<string>();

  // Run up to 2 queries in parallel
  const jobLists = await Promise.all(
    queries.slice(0, 2).map(q => fetchIndeedRss(q, countryCode))
  );
  const allJobs = jobLists.flat();

  for (const job of allJobs) {
    if (!job.company || seen.has(job.company.toLowerCase())) continue;
    seen.add(job.company.toLowerCase());

    const dupeCheck = checkDuplicate({ company: job.company, website: "" }, index);
    const candidate: ScraperCandidate = {
      company: job.company,
      website: "",
      country,
      vertical,
      tier,
      size: "",
      notes: [
        job.location ? `Based in ${job.location}` : "",
        `Hiring: ${job.title}`,
        job.snippet.slice(0, 200),
      ].filter(Boolean).join(" · "),
      linkedin_url: "",
      icp_score: scoreICP(job.company + " " + job.title + " " + job.snippet),
      is_duplicate:      dupeCheck.isDuplicate,
      duplicate_match:   dupeCheck.isDuplicate ? dupeCheck.layer : "",
      duplicate_lead_id: dupeCheck.isDuplicate ? dupeCheck.leadId : null,
    };

    if (!dupeCheck.isDuplicate) {
      extendIndex(index, { id: crypto.randomUUID(), company: job.company, website: "" });
    }

    candidates.push(candidate);
    if (candidates.length >= 30) break;
  }

  return candidates;
}

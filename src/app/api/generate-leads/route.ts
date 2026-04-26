import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const REGIONS: Record<string, string[]> = {
  "Nordics": ["Norway", "Sweden", "Denmark", "Finland"], // Norway first → uses registry
  "DACH": ["Germany", "Austria", "Switzerland"],
  "Benelux": ["Netherlands", "Belgium", "Luxembourg"],
  "UK & Ireland": ["UK", "Ireland"],
  "Southern Europe": ["Spain", "Italy", "Portugal", "France"],
};

const COUNTRY_TLD: Record<string, string> = {
  "Sweden": "se", "Norway": "no", "Denmark": "dk", "Finland": "fi",
  "Germany": "de", "Austria": "at", "Switzerland": "ch",
  "Netherlands": "nl", "Belgium": "be", "Luxembourg": "lu",
  "UK": "uk", "Ireland": "ie",
  "Spain": "es", "Italy": "it", "Portugal": "pt", "France": "fr",
};

// Brave Search uses ISO 3166-1 alpha-2 (UK → gb)
const BRAVE_COUNTRY: Record<string, string> = {
  "Sweden": "se", "Norway": "no", "Denmark": "dk", "Finland": "fi",
  "Germany": "de", "Austria": "at", "Switzerland": "ch",
  "Netherlands": "nl", "Belgium": "be", "Luxembourg": "lu",
  "UK": "gb", "Ireland": "ie",
  "Spain": "es", "Italy": "it", "Portugal": "pt", "France": "fr",
};

const VERTICAL_KEYWORDS: Record<string, string[]> = {
  "BPO": ["call center", "BPO", "contact centre", "outsourcing"],
  "Insurance & Finance": ["insurance telesales", "insurance sales", "financial services outbound"],
  "Debt Collection": ["debt collection", "debt recovery", "collections agency"],
  "Telecoms & Utilities": ["telecoms outbound", "utilities telesales", "energy telesales"],
  "Solar & Energy": ["solar sales", "solar energy company", "renewable energy sales"],
  "Recruitment & Staffing": ["staffing agency", "recruitment outbound", "sales outsourcing"],
  "SaaS / Tech Sales": ["SaaS SDR", "inside sales", "tech sales outsourcing"],
};

// Norway Brønnøysund NACE codes by vertical
const NORWAY_NACE: Record<string, string[]> = {
  "BPO": ["82.200"],
  "Insurance & Finance": ["65.120", "65.110"],
  "Debt Collection": ["82.910"],
  "Telecoms & Utilities": ["61.100", "61.200"],
  "Solar & Energy": ["35.110", "35.140"],
  "Recruitment & Staffing": ["78.100", "78.200"],
  "SaaS / Tech Sales": ["62.010", "62.020"],
};

const LOCAL_KEYWORDS: Record<string, string[]> = {
  "Sweden":      ["callcenter utgående", "telemarketing företag"],
  "Norway":      ["kundesenter utgående", "telemarketing selskap"],
  "Denmark":     ["callcenter udgående", "telemarketing virksomhed"],
  "Finland":     ["puhelinmyynti yritys"],
  "Germany":     ["Callcenter Outbound", "Telefonmarketing Unternehmen"],
  "Austria":     ["Callcenter Outbound", "Telefonmarketing"],
  "Switzerland": ["Callcenter Outbound", "Telefonmarketing"],
  "Netherlands": ["callcenter uitgaand", "telemarketing bedrijf"],
  "Belgium":     ["callcenter prospectie", "télémarketing entreprise"],
  "France":      ["centre appels prospection", "télémarketing entreprise"],
  "Spain":       ["call center televenta", "telemarketing empresa"],
  "Italy":       ["call center outbound", "telemarketing azienda"],
  "Portugal":    ["call center outbound", "telemarketing empresa"],
};

const ICP_KEYWORDS = [
  "outbound", "dialing", "dialler", "agents", "campaigns", "telemarketing",
  "bpo", "seats", "contact centre", "contact center", "call center", "callcenter",
  "outsourcing", "telesales", "inside sales", "cold calling", "prospecting",
  "debt collection", "insurance sales", "solar sales", "appointment setting",
];

const BLOCKLIST = [
  "clutch.co", "manifest.com", "poidata.io", "zoominfo.com", "yelp.com",
  "tripadvisor", "facebook.com", "twitter.com", "wikipedia", "glassdoor",
  "indeed.com", "trustpilot", "g2.com", "capterra.com", "reddit.com",
  "youtube.com", "forbes.com", "inc.com", "businessinsider.com",
  "medium.com", "wordpress.com", "blogspot.com", "substack.com",
  "theguardian.com", "bbc.com", "techcrunch.com",
];

const LISTICLE_URL_PATTERNS = [
  "/blog/", "/top-", "/best-", "/list", "/ranking", "/review",
  "/article", "/news/", "/guide/", "/directory", "/resources/", "/post/",
];

const LISTICLE_TITLE_RE = /^(top\s+\d+|best\s+\d+|\d+\s+best|\d+\s+top|the\s+best|list\s+of|best\s+call|top\s+call)/i;

type Candidate = {
  company: string;
  website: string;
  country: string;
  vertical: string;
  tier: number;
  size: string;
  notes: string;
  linkedin_url: string;
  isNew: boolean;
  icpScore: number;
  domain: string;
};

function scoreICP(text: string): number {
  const lower = text.toLowerCase();
  return ICP_KEYWORDS.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
}

function sizeFromCount(n: number): string {
  if (n >= 200) return "Large (200+)";
  if (n >= 50) return "Mid-market (50–200)";
  if (n >= 10) return "Small (10–50)";
  return "";
}

function extractSize(snippet: string): string {
  const m = snippet.match(/(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)\s*employees/i)
    ?? snippet.match(/(\d[\d,]+)\+?\s*employees/i);
  if (!m) return "";
  return sizeFromCount(parseInt(m[1].replace(/,/g, "")));
}

function matchesSize(n: number, sizeFilter?: string): boolean {
  if (!sizeFilter) return n > 0;
  if (sizeFilter.includes("Small")) return n >= 10 && n < 50;
  if (sizeFilter.includes("Mid")) return n >= 50 && n < 200;
  if (sizeFilter.includes("Large")) return n >= 200;
  return n > 0;
}

async function checkAlive(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

// Norway Brønnøysund Register — free, no API key, structured company data
async function fetchNorwayRegistry(
  vertical: string,
  sizeFilter: string | undefined,
  tier: number,
  existingNames: Set<string>,
  existingWebsites: Set<string>,
): Promise<Candidate[]> {
  const naceCodes = NORWAY_NACE[vertical] ?? ["82.200"];
  const candidates: Candidate[] = [];

  for (const nace of naceCodes) {
    try {
      const url = `https://data.brreg.no/enhetsregisteret/api/enheter?naeringskode=${encodeURIComponent(nace)}&konkurs=false&size=50`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      for (const e of (data._embedded?.enheter ?? [])) {
        if (!e.navn || e.underAvvikling) continue;
        const employees: number = e.antallAnsatte ?? 0;
        if (employees === 0) continue;
        if (sizeFilter && !matchesSize(employees, sizeFilter)) continue;

        const company: string = e.navn.trim();
        const website: string = e.hjemmeside
          ? e.hjemmeside.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
          : "";
        const city: string = e.forretningsadresse?.poststed ?? e.forretningsadresse?.kommune ?? "";
        const industryDesc: string = e.naeringskode1?.beskrivelse ?? "";
        const companyKey = company.toLowerCase();
        const isDuplicate = existingNames.has(companyKey) || (website && existingWebsites.has(website.toLowerCase()));

        candidates.push({
          company,
          website,
          country: "Norway",
          vertical,
          tier,
          size: sizeFromCount(employees),
          notes: [industryDesc, city ? `Based in ${city}` : "", `${employees} employees`].filter(Boolean).join(" · "),
          linkedin_url: "",
          isNew: !isDuplicate,
          icpScore: scoreICP(company + " " + industryDesc),
          domain: website,
        });
      }
    } catch {
      // Registry temporarily unavailable — continue to next NACE code
    }
  }

  return candidates;
}

// Brave Search — free tier, 2,000 queries/month, no listicles
async function fetchBrave(
  queries: string[],
  countryCode: string,
  apiKey: string,
): Promise<{ title: string; url: string; snippet: string }[]> {
  const responses = await Promise.all(
    queries.slice(0, 2).map(q =>
      fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=20&country=${countryCode}&search_lang=en`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": apiKey,
          },
          signal: AbortSignal.timeout(10000),
        }
      ).then(r => r.ok ? r.json() : null).catch(() => null)
    )
  );

  const results: { title: string; url: string; snippet: string }[] = [];
  for (const data of responses) {
    for (const r of (data?.web?.results ?? [])) {
      if (r.title && r.url) results.push({ title: r.title, url: r.url, snippet: r.description ?? "" });
    }
  }
  return results;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { region, country, vertical, size, tier, count = 10 } = await request.json();

  const { data: existingLeads } = await supabase
    .from("leads")
    .select("company, website")
    .eq("user_id", user.id);

  const existingNames = new Set((existingLeads ?? []).map(l => l.company.toLowerCase().trim()));
  const existingWebsites = new Set(
    (existingLeads ?? []).map(l => (l.website ?? "").toLowerCase().trim()).filter(Boolean)
  );

  const targetCountries = country
    ? [country]
    : region && REGIONS[region]
    ? REGIONS[region]
    : ["Norway", "Sweden", "Denmark", "UK", "Germany", "Netherlands"];

  const primaryCountry = targetCountries[0];
  const tld = COUNTRY_TLD[primaryCountry];
  const keywords = VERTICAL_KEYWORDS[vertical] ?? ["call center", "outbound dialing", "BPO", "contact centre"];
  const localKws = LOCAL_KEYWORDS[primaryCountry] ?? [];

  try {
    let candidates: Candidate[] = [];

    if (primaryCountry === "Norway") {
      // Brønnøysund Register: structured, zero-noise, always actual companies
      candidates = await fetchNorwayRegistry(vertical ?? "BPO", size, tier ?? 2, existingNames, existingWebsites);
    } else {
      const braveKey = process.env.BRAVE_API_KEY;
      if (!braveKey) {
        return NextResponse.json({
          error: "BRAVE_API_KEY not set — add it in Vercel → Settings → Environment Variables",
        }, { status: 500 });
      }

      const queries = [
        `site:linkedin.com/company "${keywords[0]}" "${primaryCountry}"`,
        tld
          ? (localKws.length > 0 ? `"${localKws[0]}" site:.${tld}` : `"${keywords[0]}" "outbound" site:.${tld}`)
          : `"${keywords[0]}" "outbound" "${primaryCountry}"`,
      ];

      const rawResults = await fetchBrave(queries, BRAVE_COUNTRY[primaryCountry] ?? "us", braveKey);

      const seen = new Set<string>();
      for (const r of rawResults) {
        const url = r.url.toLowerCase();
        if (BLOCKLIST.some(b => url.includes(b))) continue;
        if (LISTICLE_URL_PATTERNS.some(p => url.includes(p))) continue;
        if (LISTICLE_TITLE_RE.test(r.title.trim())) continue;

        let domain = "";
        try { domain = new URL(r.url).hostname.replace("www.", ""); } catch { continue; }
        if (seen.has(domain)) continue;
        seen.add(domain);

        let company = r.title
          .replace(/ \| LinkedIn$/i, "").replace(/ - LinkedIn$/i, "")
          .replace(/ \| .*$/, "").replace(/ - .*$/, "").trim();
        if (!company || company.length < 2) continue;

        let detectedCountry = primaryCountry;
        for (const c of targetCountries) {
          if (r.snippet.includes(c) || r.title.includes(c)) { detectedCountry = c; break; }
        }

        const isLinkedIn = r.url.includes("linkedin.com/company");
        const isDuplicate = existingNames.has(company.toLowerCase()) || existingWebsites.has(domain);

        candidates.push({
          company,
          website: isLinkedIn ? "" : domain,
          country: detectedCountry,
          vertical: vertical ?? "BPO",
          tier: tier ?? 2,
          size: extractSize(r.snippet) || size || "",
          notes: r.snippet,
          linkedin_url: isLinkedIn ? r.url : "",
          isNew: !isDuplicate,
          icpScore: scoreICP(r.title + " " + r.snippet),
          domain,
        });
      }

      // Domain liveness check for non-LinkedIn web results (parallel)
      const webCandidates = candidates.filter(c => !c.linkedin_url && c.website);
      const alive = await Promise.all(webCandidates.map(c => checkAlive(c.domain)));
      const deadDomains = new Set(webCandidates.filter((_, i) => !alive[i]).map(c => c.domain));
      candidates = candidates.filter(c => c.linkedin_url || !deadDomains.has(c.domain));
    }

    candidates.sort((a, b) => {
      if (a.isNew !== b.isNew) return b.isNew ? 1 : -1;
      return b.icpScore - a.icpScore;
    });

    const leads = candidates.slice(0, count).map(({ icpScore: _s, domain: _d, ...lead }) => lead);

    return NextResponse.json({
      leads,
      totalFound: candidates.length,
      existingCount: candidates.filter(l => !l.isNew).length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

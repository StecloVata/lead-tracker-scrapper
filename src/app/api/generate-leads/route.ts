import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const REGIONS: Record<string, string[]> = {
  "Nordics": ["Sweden", "Norway", "Denmark", "Finland"],
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

const VERTICAL_KEYWORDS: Record<string, string[]> = {
  "BPO": ["call center", "BPO", "contact centre", "outsourcing"],
  "Insurance & Finance": ["insurance telesales", "insurance sales", "financial services outbound"],
  "Debt Collection": ["debt collection", "debt recovery", "collections agency"],
  "Telecoms & Utilities": ["telecoms outbound", "utilities telesales", "energy telesales"],
  "Solar & Energy": ["solar sales", "solar energy company", "renewable energy sales"],
  "Recruitment & Staffing": ["staffing agency", "recruitment outbound", "sales outsourcing"],
  "SaaS / Tech Sales": ["SaaS SDR", "inside sales", "tech sales outsourcing"],
};

const LOCAL_KEYWORDS: Record<string, string[]> = {
  "Sweden":      ["callcenter utgående", "telemarketing företag", "kundtjänst outbound"],
  "Norway":      ["kundesenter utgående", "telemarketing selskap", "utgående salg"],
  "Denmark":     ["callcenter udgående", "telemarketing virksomhed", "kundeservice outbound"],
  "Finland":     ["puhelinmyynti yritys", "callcenter ulospäin"],
  "Germany":     ["Callcenter Outbound", "Telefonmarketing Unternehmen", "Outbound-Vertrieb"],
  "Austria":     ["Callcenter Outbound", "Telefonmarketing"],
  "Switzerland": ["Callcenter Outbound", "Telefonmarketing"],
  "Netherlands": ["callcenter uitgaand", "telemarketing bedrijf", "outbound bellen"],
  "Belgium":     ["callcenter prospectie", "télémarketing entreprise"],
  "France":      ["centre appels prospection", "télémarketing entreprise", "prospection commerciale"],
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

function scoreICP(text: string): number {
  const lower = text.toLowerCase();
  return ICP_KEYWORDS.reduce((score, kw) => score + (lower.includes(kw) ? 1 : 0), 0);
}

function extractSize(snippet: string): string {
  const rangeMatch = snippet.match(/(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)\s*employees/i);
  const singleMatch = snippet.match(/(\d[\d,]+)\+?\s*employees/i);
  const m = rangeMatch ?? singleMatch;
  if (!m) return "";
  const count = parseInt(m[1].replace(/,/g, ""));
  if (count > 200) return "Large (200+)";
  if (count > 50) return "Mid-market (50–200)";
  return "Small (10–50)";
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { region, country, vertical, size, tier, count = 10 } = await request.json();

  const token = process.env.APIFY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_API_TOKEN not set" }, { status: 500 });

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
    : ["Sweden", "Norway", "Denmark", "UK", "Germany", "Netherlands"];

  const primaryCountry = targetCountries[0];
  const tld = COUNTRY_TLD[primaryCountry];
  const keywords = vertical && VERTICAL_KEYWORDS[vertical]
    ? VERTICAL_KEYWORDS[vertical]
    : ["call center", "outbound dialing", "BPO", "contact centre"];
  const localKws = LOCAL_KEYWORDS[primaryCountry] ?? [];

  // Query 1 & 2: LinkedIn company pages (most reliable — always actual companies)
  const queries: string[] = [
    `site:linkedin.com/company "${keywords[0]}" "${primaryCountry}"`,
    `site:linkedin.com/company "${keywords[1] ?? keywords[0]}" "${targetCountries[1] ?? primaryCountry}"`,
  ];

  // Query 3: Country TLD targeting (company websites in native domain)
  if (tld) {
    queries.push(`"${keywords[0]}" "outbound" site:.${tld}`);
  }

  // Query 4: Local language (surfaces companies that only advertise in native language)
  if (localKws.length > 0 && tld) {
    queries.push(`"${localKws[0]}" site:.${tld}`);
  } else if (tld) {
    queries.push(`"${keywords[0]}" site:.${tld} -blog -"top 10" -"best"`);
  }

  const queryBatch = queries.slice(0, 4).join("\n");

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${token}&timeout=50&memory=256`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: queryBatch,
          maxPagesPerQuery: 1,
          resultsPerPage: 10,
          languageCode: "en",
          mobileResults: false,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Apify error: ${res.status} — ${text}` }, { status: 500 });
    }

    const data = await res.json();

    const allResults: { title: string; url: string; snippet: string }[] = [];
    for (const page of (data ?? [])) {
      for (const r of (page.organicResults ?? [])) {
        if (r.title && r.url) allResults.push({ title: r.title, url: r.url, snippet: r.description ?? "" });
      }
    }

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

    const seen = new Set<string>();
    const candidates: Candidate[] = [];

    for (const r of allResults) {
      const url = r.url.toLowerCase();

      if (BLOCKLIST.some(b => url.includes(b))) continue;
      if (LISTICLE_URL_PATTERNS.some(p => url.includes(p))) continue;
      if (LISTICLE_TITLE_RE.test(r.title.trim())) continue;

      let domain = "";
      try { domain = new URL(r.url).hostname.replace("www.", ""); } catch { continue; }
      if (seen.has(domain)) continue;
      seen.add(domain);

      let company = r.title
        .replace(/ \| LinkedIn$/i, "")
        .replace(/ - LinkedIn$/i, "")
        .replace(/ \| .*$/, "")
        .replace(/ - .*$/, "")
        .trim();
      if (!company || company.length < 2) continue;

      let detectedCountry = primaryCountry;
      for (const c of targetCountries) {
        if (r.snippet.includes(c) || r.title.includes(c)) { detectedCountry = c; break; }
      }

      const isLinkedIn = r.url.includes("linkedin.com/company");
      const companyKey = company.toLowerCase().trim();
      const isDuplicate = existingNames.has(companyKey) || existingWebsites.has(domain);
      const icpScore = scoreICP(r.title + " " + r.snippet);
      const extractedSize = extractSize(r.snippet);

      candidates.push({
        company,
        website: isLinkedIn ? "" : domain,
        country: detectedCountry,
        vertical: vertical ?? "BPO",
        tier: tier ?? 2,
        size: extractedSize || size || "",
        notes: r.snippet,
        linkedin_url: isLinkedIn ? r.url : "",
        isNew: !isDuplicate,
        icpScore,
        domain,
      });
    }

    // Domain liveness check — only for non-LinkedIn results, in parallel
    const webCandidates = candidates.filter(c => !c.linkedin_url && c.website);
    const livenessResults = await Promise.all(webCandidates.map(c => checkAlive(c.domain)));
    const deadDomains = new Set(
      webCandidates.filter((_, i) => !livenessResults[i]).map(c => c.domain)
    );

    const filtered = candidates.filter(c => c.linkedin_url || !deadDomains.has(c.domain));

    // Sort: new leads first, then by ICP score descending
    filtered.sort((a, b) => {
      if (a.isNew !== b.isNew) return b.isNew ? 1 : -1;
      return b.icpScore - a.icpScore;
    });

    const leads = filtered.slice(0, count).map(({ icpScore: _s, domain: _d, ...lead }) => lead);

    return NextResponse.json({
      leads,
      totalFound: filtered.length,
      existingCount: filtered.filter(l => !l.isNew).length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

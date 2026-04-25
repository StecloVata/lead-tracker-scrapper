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

const VERTICAL_KEYWORDS: Record<string, string[]> = {
  "BPO": ["call center", "BPO", "contact centre", "telemarketing", "outsourcing"],
  "Insurance & Finance": ["insurance telesales", "financial services outbound", "insurance sales"],
  "Debt Collection": ["debt collection", "debt recovery", "collections agency"],
  "Telecoms & Utilities": ["telecoms outbound", "utilities sales", "energy telesales"],
  "Solar & Energy": ["solar sales", "solar energy company", "renewable energy sales"],
  "Recruitment & Staffing": ["staffing agency", "recruitment outbound", "sales outsourcing"],
  "SaaS / Tech Sales": ["SaaS SDR", "inside sales", "tech sales outsourcing"],
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { region, country, vertical, size, tier, count = 10 } = await request.json();

  const token = process.env.APIFY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_API_TOKEN not set" }, { status: 500 });

  // Get existing company names for dedup
  const { data: existingLeads } = await supabase
    .from("leads")
    .select("company, website")
    .eq("user_id", user.id);

  const existingNames = new Set(
    (existingLeads ?? []).map(l => l.company.toLowerCase().trim())
  );
  const existingWebsites = new Set(
    (existingLeads ?? []).map(l => (l.website ?? "").toLowerCase().trim()).filter(Boolean)
  );

  // Build targeted countries list
  const targetCountries = country
    ? [country]
    : region && REGIONS[region]
    ? REGIONS[region]
    : ["Sweden", "Norway", "Denmark", "UK", "Germany", "Netherlands"];

  // Build keyword list for this vertical
  const keywords = vertical && VERTICAL_KEYWORDS[vertical]
    ? VERTICAL_KEYWORDS[vertical]
    : ["call center", "outbound dialing", "BPO", "contact centre"];

  // Generate multiple targeted queries to get diverse results
  const queries: string[] = [];
  for (const kw of keywords.slice(0, 2)) {
    for (const c of targetCountries.slice(0, 3)) {
      queries.push(`${kw} ${c} site:linkedin.com/company`);
      queries.push(`${kw} ${c} -site:clutch.co -site:manifest.com -site:poidata.io`);
    }
  }

  // Run Apify Google Search for multiple queries in parallel (max 4 to save credits)
  const queryBatch = queries.slice(0, 4).join("\n");

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${token}&timeout=55&memory=256`,
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

    // Flatten all organic results across all query pages
    const allResults: { title: string; url: string; snippet: string }[] = [];
    for (const page of (data ?? [])) {
      for (const r of (page.organicResults ?? [])) {
        if (r.title && r.url) allResults.push({ title: r.title, url: r.url, snippet: r.description ?? "" });
      }
    }

    // Parse into lead candidates — filter out directories, blogs, etc.
    const BLOCKLIST = ["clutch.co", "manifest.com", "poidata.io", "zoominfo.com", "yelp.com", "tripadvisor", "facebook.com", "twitter.com", "wikipedia", "glassdoor", "indeed.com", "trustpilot", "g2.com", "capterra.com", "reddit.com", "youtube.com"];

    const seen = new Set<string>();
    const leads: {
      company: string;
      website: string;
      country: string;
      vertical: string;
      tier: number;
      size: string;
      notes: string;
      linkedin_url: string;
      isNew: boolean;
    }[] = [];

    for (const r of allResults) {
      if (leads.length >= count * 2) break;

      const url = r.url.toLowerCase();
      if (BLOCKLIST.some(b => url.includes(b))) continue;

      // Extract domain
      let domain = "";
      try { domain = new URL(r.url).hostname.replace("www.", ""); } catch { continue; }

      if (seen.has(domain)) continue;
      seen.add(domain);

      // Extract company name — clean up LinkedIn/Google title format
      let company = r.title
        .replace(/ \| LinkedIn$/i, "")
        .replace(/ - LinkedIn$/i, "")
        .replace(/ \| .*$/, "")
        .replace(/ - .*$/, "")
        .trim();

      if (!company || company.length < 2) continue;

      // Detect likely country from snippet + title
      let detectedCountry = targetCountries[0] ?? "";
      for (const c of targetCountries) {
        if (r.snippet.includes(c) || r.title.includes(c)) { detectedCountry = c; break; }
      }

      const isLinkedIn = r.url.includes("linkedin.com/company");
      const companyKey = company.toLowerCase().trim();
      const isDuplicate = existingNames.has(companyKey) || existingWebsites.has(domain);

      leads.push({
        company,
        website: isLinkedIn ? "" : domain,
        country: detectedCountry,
        vertical: vertical ?? "BPO",
        tier: tier ?? 2,
        size: size ?? "",
        notes: r.snippet,
        linkedin_url: isLinkedIn ? r.url : "",
        isNew: !isDuplicate,
      });
    }

    // Sort: new leads first, then duplicates
    leads.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));

    return NextResponse.json({
      leads: leads.slice(0, count),
      totalFound: leads.length,
      existingCount: leads.filter(l => !l.isNew).length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

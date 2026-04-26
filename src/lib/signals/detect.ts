import Anthropic from "@anthropic-ai/sdk";
import type { SignalType } from "@/types/lead";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface DetectedSignal {
  signal_type: SignalType;
  title: string;
  description: string;
  source_url: string;
  urgency: 1 | 2 | 3;
}

interface BraveResult {
  title: string;
  url: string;
  snippet: string;
  age?: string;
}

async function braveSearch(query: string, type: "web" | "news" = "web"): Promise<BraveResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) return [];

  const endpoint = type === "news"
    ? "https://api.search.brave.com/res/v1/news/search"
    : "https://api.search.brave.com/res/v1/web/search";

  try {
    const res = await fetch(
      `${endpoint}?q=${encodeURIComponent(query)}&count=10&freshness=pm`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = type === "news"
      ? (data.results ?? [])
      : (data?.web?.results ?? []);
    return items.map((r: { title?: string; url?: string; description?: string; age?: string }) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.description ?? "",
      age: r.age ?? "",
    }));
  } catch {
    return [];
  }
}

async function googleAlertsRss(company: string): Promise<BraveResult[]> {
  try {
    const query = encodeURIComponent(`"${company}"`);
    const rssUrl = `https://www.google.com/alerts/feeds/00000000000000000/${query}`;
    // Google Alerts RSS requires the user to have created an alert first.
    // We use this as a fallback — fetch their public RSS if it happens to exist.
    const res = await fetch(rssUrl, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
    return entries.slice(0, 5).map(m => {
      const block = m[1];
      const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/) ?? [])[1]?.replace(/<[^>]+>/g, "") ?? "";
      const link = (block.match(/href="([^"]+)"/) ?? [])[1] ?? "";
      const summary = (block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) ?? [])[1]?.replace(/<[^>]+>/g, "") ?? "";
      return { title, url: link, snippet: summary };
    });
  } catch {
    return [];
  }
}

function buildQueries(company: string, website: string): { query: string; type: "web" | "news" }[] {
  const name = `"${company}"`;
  const site = website ? ` OR site:${website}` : "";
  return [
    // Funding & M&A
    { query: `${name} funding OR investment OR "Series A" OR "Series B" OR acquired OR acquisition 2024 OR 2025`, type: "news" },
    // Leadership changes
    { query: `${name} (appointed OR "new CEO" OR "new CTO" OR "VP Sales" OR "Head of Operations" OR joins OR promotes)`, type: "news" },
    // Hiring / scaling outbound
    { query: `site:linkedin.com/jobs ${company} (outbound OR "call center" OR dialer OR agents OR SDR OR telemarketing)`, type: "web" },
    // Company expansion
    { query: `${name} ("new office" OR expansion OR "enters market" OR launch OR "opens in")`, type: "news" },
    // LinkedIn company activity
    { query: `site:linkedin.com/company ${company}${site}`, type: "web" },
    // Pain point / tech signals
    { query: `${name} (dialer OR "contact center software" OR "call center technology" OR "outbound platform" OR migration)`, type: "web" },
  ];
}

const EXTRACTION_PROMPT = `You are a B2B sales signal analyst for Adversus, an outbound dialing platform.

Given these search results about a company, extract ONLY real buying signals — events that suggest this company may need new call center / outbound dialing software soon.

Signal types and urgency:
- "funding"           urgency 3 — new capital, acquisition, PE buyout
- "leadership_change" urgency 3 — new CTO, VP Ops, Head of Sales, Operations Director
- "hiring"            urgency 3 — job postings for outbound agents, SDRs, dialer admins
- "expansion"         urgency 2 — new market, new office, new product line
- "pain_point"        urgency 2 — mentions of inefficiency, cost, agent issues, legacy systems
- "tech_change"       urgency 2 — migrating software, evaluating vendors, RFP process
- "event"             urgency 1 — speaking at CCW, Engage, contact center conferences
- "press"             urgency 1 — press release, growth announcement, new contract win

Rules:
- Only include signals with a real source URL
- Skip generic/vague results with no signal value
- Max 5 signals
- If nothing qualifies, return empty array

Results:
RESULTS_PLACEHOLDER

Respond with JSON only, no markdown:
{"signals": [{"signal_type": "...", "title": "...", "description": "1 sentence", "source_url": "...", "urgency": 1|2|3}]}`;

export async function detectSignals(
  company: string,
  website: string,
): Promise<DetectedSignal[]> {
  const queries = buildQueries(company, website);

  // Run all searches in parallel
  const [searchResults, alertResults] = await Promise.all([
    Promise.all(queries.map(q => braveSearch(q.query, q.type))),
    googleAlertsRss(company),
  ]);

  const allResults: BraveResult[] = [
    ...searchResults.flat(),
    ...alertResults,
  ];

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = allResults.filter(r => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  if (unique.length === 0) return [];

  const resultsText = unique
    .slice(0, 20)
    .map((r, i) => `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`)
    .join("\n\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: EXTRACTION_PROMPT.replace("RESULTS_PLACEHOLDER", resultsText),
      }],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    return (parsed.signals ?? []) as DetectedSignal[];
  } catch {
    return [];
  }
}

import type { SignalType } from "@/types/lead";

export interface DetectedSignal {
  signal_type: SignalType;
  title: string;
  description: string;
  source_url: string;
  urgency: 1 | 2 | 3;
}

interface NewsItem {
  title: string;
  url: string;
  snippet: string;
  pubDate: string;
}

// ── Google News RSS — completely free, no API key ─────────────────────────────

async function googleNewsRss(query: string): Promise<NewsItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: NewsItem[] = [];
    const entries = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    for (const m of entries.slice(0, 15)) {
      const block = m[1];
      const title = stripTags((block.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? "");
      const link  = stripTags((block.match(/<link\s*\/?>([\s\S]*?)<\/link>/) ?? [])[1] ?? "")
                  || ((block.match(/https?:\/\/[^\s"<]+/) ?? [])[0] ?? "");
      const desc  = stripTags((block.match(/<description>([\s\S]*?)<\/description>/) ?? [])[1] ?? "");
      const date  = ((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ?? [])[1] ?? "").trim();

      if (title && link) items.push({ title, url: link, snippet: desc, pubDate: date });
    }
    return items;
  } catch {
    return [];
  }
}

function stripTags(s: string): string {
  return s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
}

// ── Keyword classifier — no AI needed ────────────────────────────────────────

const SIGNAL_RULES: Array<{
  type: SignalType;
  urgency: 1 | 2 | 3;
  keywords: string[];
}> = [
  {
    type: "funding",
    urgency: 3,
    keywords: [
      "funding", "raises", "raised", "series a", "series b", "series c",
      "investment", "investor", "venture capital", "pe firm", "private equity",
      "acquired", "acquisition", "buyout", "merger",
    ],
  },
  {
    type: "leadership_change",
    urgency: 3,
    keywords: [
      "appoints", "appointed", "new ceo", "new cto", "new coo", "new vp",
      "new head of", "joins as", "named as", "promoted to", "welcomes",
      "steps down", "resigns", "new managing director", "new director",
    ],
  },
  {
    type: "hiring",
    urgency: 3,
    keywords: [
      "hiring", "we're hiring", "is hiring", "job opening", "new positions",
      "expanding team", "recruiting", "join our team", "looking for",
      "open roles", "career opportunity", "growing team",
    ],
  },
  {
    type: "expansion",
    urgency: 2,
    keywords: [
      "expands", "expansion", "new market", "new office", "opens in",
      "launches in", "enters", "international", "grows to", "scale",
    ],
  },
  {
    type: "tech_change",
    urgency: 2,
    keywords: [
      "migration", "digital transformation", "new platform", "technology upgrade",
      "switching to", "replaces", "modernise", "modernize", "new system",
      "software rollout", "dialer", "contact center software",
    ],
  },
  {
    type: "pain_point",
    urgency: 2,
    keywords: [
      "struggling", "challenges", "inefficiency", "problems with",
      "complaint", "dissatisfied", "poor performance", "high churn",
      "agent turnover", "cost reduction", "cutting costs",
    ],
  },
  {
    type: "event",
    urgency: 1,
    keywords: [
      "conference", "summit", "keynote", "speaking at", "presenting at",
      "ccw", "engage", "contact center expo", "cx summit",
    ],
  },
  {
    type: "press",
    urgency: 1,
    keywords: [
      "announces", "announced", "press release", "partnership", "contract win",
      "new client", "award", "recognized", "record growth", "milestone",
    ],
  },
];

function classify(title: string, snippet: string): { type: SignalType; urgency: 1 | 2 | 3 } | null {
  const text = (title + " " + snippet).toLowerCase();
  for (const rule of SIGNAL_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      return { type: rule.type, urgency: rule.urgency };
    }
  }
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function detectSignals(
  company: string,
  _website: string,
): Promise<DetectedSignal[]> {
  // Two searches: general news + hiring/ops-specific news
  const [general, hiring] = await Promise.all([
    googleNewsRss(`"${company}"`),
    googleNewsRss(`"${company}" hiring OR funding OR expansion OR appoints`),
  ]);

  // Deduplicate by URL
  const seen = new Set<string>();
  const all: NewsItem[] = [];
  for (const item of [...general, ...hiring]) {
    if (!seen.has(item.url)) { seen.add(item.url); all.push(item); }
  }

  const signals: DetectedSignal[] = [];
  const usedTypes = new Set<SignalType>();

  for (const item of all) {
    const match = classify(item.title, item.snippet);
    if (!match) continue;

    // Allow max 2 signals of the same type to avoid flooding
    const typeCount = [...signals].filter(s => s.signal_type === match.type).length;
    if (typeCount >= 2) continue;

    signals.push({
      signal_type: match.type,
      title: item.title.slice(0, 120),
      description: item.snippet.slice(0, 200),
      source_url: item.url,
      urgency: match.urgency,
    });

    usedTypes.add(match.type);
    if (signals.length >= 5) break;
  }

  return signals;
}

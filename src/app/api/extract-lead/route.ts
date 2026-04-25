import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await request.json();
  if (!url?.trim()) return NextResponse.json({ error: "URL is required" }, { status: 400 });

  const isLinkedIn = /linkedin\.com\/company\//i.test(url);
  return isLinkedIn ? extractLinkedIn(url) : extractWebsite(url);
}

async function extractWebsite(url: string) {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(normalized, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });

    const html = await res.text();

    const unescape = (s: string) =>
      s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

    const get = (re: RegExp) => {
      const m = html.match(re);
      return m ? unescape(m[1]) : "";
    };

    // JSON-LD (most structured)
    let ldName = "", ldDescription = "", ldCountry = "";
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        const ld = JSON.parse(m[1]);
        const types = ["Organization", "Corporation", "LocalBusiness", "Company"];
        if (types.includes(ld["@type"])) {
          ldName = ld.name || "";
          ldDescription = ld.description || "";
          ldCountry = ld.address?.addressCountry || ld.location?.address?.addressCountry || "";
        }
      } catch { /* ignore malformed JSON-LD */ }
    }

    const ogTitle =
      get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})/i) ||
      get(/<meta[^>]+content=["']([^"']{1,200})[^>]+property=["']og:title["']/i);
    const ogDesc =
      get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,500})/i) ||
      get(/<meta[^>]+content=["']([^"']{1,500})[^>]+property=["']og:description["']/i);
    const metaDesc =
      get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})/i) ||
      get(/<meta[^>]+content=["']([^"']{1,500})[^>]+name=["']description["']/i);
    const pageTitle = get(/<title[^>]*>([^<]{1,200})<\/title>/i);

    const company = ldName || ogTitle || pageTitle.replace(/\s*[\|–\-].*$/, "").trim();
    const notes = ldDescription || ogDesc || metaDesc;
    const domain = new URL(normalized).hostname.replace("www.", "");

    return NextResponse.json({ company, website: domain, notes, linkedin_url: "", country: ldCountry, size: "", vertical: "" });
  } catch (e) {
    return NextResponse.json({ error: `Could not fetch page: ${String(e)}` }, { status: 422 });
  }
}

async function extractLinkedIn(url: string) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_API_TOKEN not set" }, { status: 500 });

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/bebity~linkedin-company-profile-scraper/run-sync-get-dataset-items?token=${token}&timeout=25&memory=256`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrls: [url] }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `LinkedIn scraper error: ${res.status} — ${text}` }, { status: 500 });
    }

    const data = await res.json();
    const item = Array.isArray(data) ? data[0] : null;
    if (!item) return NextResponse.json({ error: "No data returned for this LinkedIn URL" }, { status: 422 });

    const staffCount = item.staffCount ?? item.employeeCount ?? 0;
    let size = "";
    if (staffCount > 200) size = "Large (200+)";
    else if (staffCount > 50) size = "Mid-market (50–200)";
    else if (staffCount > 0) size = "Small (10–50)";
    else if (item.companySize) size = item.companySize;

    return NextResponse.json({
      company: item.name || item.companyName || "",
      website: item.website ? item.website.replace(/^https?:\/\/(www\.)?/, "") : "",
      notes: item.description || "",
      linkedin_url: url,
      country: item.headquarter?.country || item.location || "",
      size,
      vertical: item.industry || "",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

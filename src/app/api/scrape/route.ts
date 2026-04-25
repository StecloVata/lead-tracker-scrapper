import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, vertical, country } = await request.json();
  if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });

  const searchQuery = [query, vertical, country, "outbound call center dialer"]
    .filter(Boolean)
    .join(" ");

  try {
    // DuckDuckGo HTML endpoint — no JS rendering needed, works on Vercel
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      }
    );

    const html = await res.text();
    const results = parseDDGResults(html).slice(0, 10);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function parseDDGResults(html: string) {
  const results: { title: string; url: string; snippet: string }[] = [];

  // Extract result blocks — DDG HTML wraps each result in <div class="result">
  const resultBlocks = html.match(/<div class="result[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) ?? [];

  for (const block of resultBlocks) {
    // Title
    const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    const title = titleMatch ? stripTags(titleMatch[1]).trim() : "";

    // URL — DDG encodes it in a data attr or href
    const urlMatch = block.match(/href="([^"]+)"/) ;
    let url = urlMatch ? urlMatch[1] : "";
    if (url.startsWith("//duckduckgo.com/l/?uddg=")) {
      try { url = decodeURIComponent(url.split("uddg=")[1].split("&")[0]); } catch {}
    }

    // Snippet
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    const snippet = snippetMatch ? stripTags(snippetMatch[1]).trim() : "";

    if (title && url && !url.includes("duckduckgo.com")) {
      results.push({ title, url, snippet });
    }
  }

  // Fallback: simpler regex if block parsing yields nothing
  if (results.length === 0) {
    const titleRe = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = titleRe.exec(html)) !== null && results.length < 10) {
      let url = m[1];
      if (url.includes("uddg=")) {
        try { url = decodeURIComponent(url.split("uddg=")[1].split("&")[0]); } catch {}
      }
      const title = stripTags(m[2]).trim();
      if (title && url && !url.includes("duckduckgo.com")) {
        results.push({ title, url, snippet: "" });
      }
    }
  }

  return results;
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
}

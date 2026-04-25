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
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      }
    );

    const html = await res.text();

    // Extract titles + URLs
    const linkRe = /class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    // Extract snippets
    const snippetRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

    const links: { title: string; url: string }[] = [];
    let m;
    while ((m = linkRe.exec(html)) !== null && links.length < 10) {
      let url = m[1];
      // DDG wraps URLs — decode the uddg= param
      if (url.includes("uddg=")) {
        try {
          const raw = url.split("uddg=")[1].split("&")[0].split("&amp;")[0];
          url = decodeURIComponent(raw);
        } catch { continue; }
      }
      if (url.startsWith("//")) url = "https:" + url;
      const title = stripTags(m[2]).trim();
      if (title && url && !url.includes("duckduckgo.com")) {
        links.push({ title, url });
      }
    }

    const snippets: string[] = [];
    let s;
    while ((s = snippetRe.exec(html)) !== null) {
      snippets.push(stripTags(s[1]).trim());
    }

    const results = links.map((l, i) => ({
      title: l.title,
      url: l.url,
      snippet: snippets[i] ?? "",
    }));

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function stripTags(s: string) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

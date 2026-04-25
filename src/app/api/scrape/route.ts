import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, vertical, country } = await request.json();
  if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });

  const token = process.env.APIFY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_API_TOKEN not set" }, { status: 500 });

  const searchQuery = [query, vertical, country]
    .filter(Boolean)
    .join(" ");

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${token}&timeout=50&memory=256`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: searchQuery,
          maxPagesPerQuery: 1,
          resultsPerPage: 10,
          languageCode: "en",
          mobileResults: false,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Apify error: ${res.status} ${text}` }, { status: 500 });
    }

    const data = await res.json();

    // Apify returns an array of page objects, each with an `organicResults` array
    const organicResults = data?.[0]?.organicResults ?? [];

    const results = organicResults.slice(0, 10).map((r: {
      title?: string;
      url?: string;
      description?: string;
    }) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.description ?? "",
    })).filter((r: { title: string; url: string }) => r.title && r.url);

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

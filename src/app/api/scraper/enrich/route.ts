import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { enrichWebsite } from "@/lib/scrapers/enrich-website";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { website, candidateId } = await request.json();
  if (!website?.trim()) return NextResponse.json({ error: "website is required" }, { status: 400 });

  const result = await enrichWebsite(website);

  // If a candidateId is provided, persist enrichment back to the staging row
  if (candidateId) {
    await supabase
      .from("scrape_candidates")
      .update({
        emails:      result.emails,
        phones:      result.phones,
        people:      result.people,
        tech_stack:  result.tech_stack,
        linkedin_url: result.linkedin_url || undefined,
        notes:       result.description || undefined,
      })
      .eq("id", candidateId)
      .eq("user_id", user.id);
  }

  return NextResponse.json(result);
}

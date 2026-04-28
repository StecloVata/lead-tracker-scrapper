import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { buildIndex } from "@/lib/scrapers/dedup";
import { fetchBrreg } from "@/lib/scrapers/sources/brreg";
import { fetchCompaniesHouse } from "@/lib/scrapers/sources/companies-house";
import { fetchCVR } from "@/lib/scrapers/sources/cvr-dk";
import { fetchIndeedRSS } from "@/lib/scrapers/sources/indeed-rss";
import type { ScraperCandidate } from "@/lib/scrapers/sources/brreg";

export const maxDuration = 60;

// Map of country → which registry source to use
const REGISTRY_COUNTRIES: Record<string, "brreg" | "companies-house" | "cvr-dk"> = {
  "Norway":  "brreg",
  "UK":      "companies-house",
  "Denmark": "cvr-dk",
};

// Countries covered by Indeed RSS
// Denmark is included here too as a fallback — CVR Elasticsearch requires auth
const INDEED_COUNTRIES = [
  "Germany","Austria","Switzerland","Netherlands","Belgium",
  "France","Spain","Italy","Portugal","Ireland",
  "Sweden","Finland","Luxembourg","Denmark","Norway",
];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { country, vertical, size, tier = 2, sources } = await request.json();
  if (!country) return NextResponse.json({ error: "country is required" }, { status: 400 });

  // Determine which sources to run based on country + user-selected source flags
  const useRegistry = sources?.registry !== false;
  const useJobBoards = sources?.jobBoards !== false;

  const registrySource = REGISTRY_COUNTRIES[country];
  const useIndeed = useJobBoards && INDEED_COUNTRIES.includes(country);

  // Create the job record
  const { data: job, error: jobErr } = await supabase
    .from("scrape_jobs")
    .insert({
      user_id: user.id,
      source:  registrySource ?? (useIndeed ? "indeed-rss" : "unknown"),
      params:  { country, vertical, size, tier },
      status:  "running",
    })
    .select()
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: jobErr?.message ?? "Failed to create job" }, { status: 500 });
  }

  // Load existing leads to build the dedup index
  const { data: existingLeads } = await supabase
    .from("leads")
    .select("id, company, website")
    .eq("user_id", user.id);

  const index = buildIndex(
    (existingLeads ?? []).map(l => ({ id: l.id, company: l.company, website: l.website ?? "" }))
  );

  const candidates: ScraperCandidate[] = [];

  try {
    // Run registry + job board sources in parallel where applicable
    const tasks: Promise<ScraperCandidate[]>[] = [];

    if (useRegistry && registrySource === "brreg") {
      tasks.push(fetchBrreg(vertical ?? "BPO", size, tier, index));
    }
    if (useRegistry && registrySource === "companies-house") {
      const chKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (chKey) tasks.push(fetchCompaniesHouse(vertical ?? "BPO", size, tier, index, chKey));
    }
    if (useRegistry && registrySource === "cvr-dk") {
      tasks.push(fetchCVR(vertical ?? "BPO", size, tier, index));
    }
    if (useIndeed) {
      tasks.push(fetchIndeedRSS(vertical ?? "BPO", country, tier, index));
    }

    const results = await Promise.all(tasks);
    candidates.push(...results.flat());

    // Sort: new first, then by ICP score
    candidates.sort((a, b) => {
      if (a.is_duplicate !== b.is_duplicate) return a.is_duplicate ? 1 : -1;
      return b.icp_score - a.icp_score;
    });

    // Insert all candidates into staging table
    if (candidates.length > 0) {
      const rows = candidates.map(c => ({
        job_id:             job.id,
        user_id:            user.id,
        company:            c.company,
        website:            c.website,
        country:            c.country,
        vertical:           c.vertical,
        tier:               c.tier,
        size:               c.size,
        notes:              c.notes,
        linkedin_url:       c.linkedin_url,
        icp_score:          c.icp_score,
        is_duplicate:       c.is_duplicate,
        duplicate_match:    c.duplicate_match,
        duplicate_lead_id:  c.duplicate_lead_id,
      }));

      await supabase.from("scrape_candidates").insert(rows);
    }

    const newCount  = candidates.filter(c => !c.is_duplicate).length;
    const dupeCount = candidates.filter(c =>  c.is_duplicate).length;

    await supabase
      .from("scrape_jobs")
      .update({ status: "done", result_count: newCount, dupe_count: dupeCount, finished_at: new Date().toISOString() })
      .eq("id", job.id);

    return NextResponse.json({ jobId: job.id, resultCount: newCount, dupeCount });
  } catch (e) {
    await supabase
      .from("scrape_jobs")
      .update({ status: "failed", error_message: String(e) })
      .eq("id", job.id);

    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("scrape_jobs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

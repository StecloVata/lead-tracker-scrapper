import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { buildIndex, checkDuplicate } from "@/lib/scrapers/dedup";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await request.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }

  // Fetch candidates to approve
  const { data: candidates, error: fetchErr } = await supabase
    .from("scrape_candidates")
    .select("*")
    .in("id", ids)
    .eq("user_id", user.id)
    .eq("review_status", "pending");

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!candidates?.length) return NextResponse.json({ added: 0, skipped: 0 });

  // Re-build dedup index from current leads (race condition safety)
  const { data: existingLeads } = await supabase
    .from("leads")
    .select("id, company, website")
    .eq("user_id", user.id);

  const index = buildIndex(
    (existingLeads ?? []).map(l => ({ id: l.id, company: l.company, website: l.website ?? "" }))
  );

  let added = 0;
  let skipped = 0;
  const skippedIds: string[] = [];

  for (const candidate of candidates) {
    // Final dedup check before inserting — catches races if user ran two jobs
    const dupeCheck = checkDuplicate(
      { company: candidate.company, website: candidate.website ?? "" },
      index
    );

    if (dupeCheck.isDuplicate) {
      skipped++;
      skippedIds.push(candidate.id);
      // Update candidate to reflect it was a duplicate at approval time
      await supabase
        .from("scrape_candidates")
        .update({
          review_status:    "rejected",
          is_duplicate:     true,
          duplicate_match:  dupeCheck.layer,
          duplicate_lead_id: dupeCheck.leadId,
        })
        .eq("id", candidate.id);
      continue;
    }

    // Insert into leads
    const { data: newLead, error: insertErr } = await supabase
      .from("leads")
      .insert({
        user_id:     user.id,
        company:     candidate.company,
        website:     candidate.website ?? "",
        country:     candidate.country ?? "",
        city:        "",
        vertical:    candidate.vertical ?? "",
        tier:        candidate.tier ?? 2,
        size:        candidate.size ?? "",
        persona:     "",
        trigger:     `Found via scraper (${candidate.country ?? ""})`,
        notes:       candidate.notes ?? "",
        status:      "Not contacted",
        is_priority: false,
        linkedin:    candidate.linkedin_url ?? "",
      })
      .select()
      .single();

    if (insertErr || !newLead) {
      skipped++;
      continue;
    }

    // Insert extracted contacts if any
    const people = Array.isArray(candidate.people) ? candidate.people : [];
    if (people.length > 0) {
      await supabase.from("contacts").insert(
        people.map((p: { name: string; role: string; linkedin?: string }) => ({
          lead_id:  newLead.id,
          name:     p.name ?? "",
          role:     p.role ?? "",
          phone:    "",
          email:    "",
          linkedin: p.linkedin ?? "",
        }))
      );
    }

    // Mark candidate as approved
    await supabase
      .from("scrape_candidates")
      .update({ review_status: "approved" })
      .eq("id", candidate.id);

    added++;
  }

  return NextResponse.json({ added, skipped, skippedIds });
}

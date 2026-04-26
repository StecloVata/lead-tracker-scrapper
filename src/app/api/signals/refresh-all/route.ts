import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { detectSignals } from "@/lib/signals/detect";

export const maxDuration = 60;

// Called by Vercel Cron daily at 07:00 UTC.
// Also callable manually from the dashboard (no body needed, uses service-role key path).
export async function POST(request: Request) {
  // Verify cron secret so this can't be triggered by anyone externally
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Fetch leads not checked in the last 23 hours, prioritised: tier1 → tier2 → tier3
  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
  const { data: leads } = await supabase
    .from("leads")
    .select("id, company, website, tier")
    .or(`last_signal_check.is.null,last_signal_check.lt.${cutoff}`)
    .eq("is_archived", false)
    .order("tier", { ascending: true })
    .limit(20); // stay inside the 60s Vercel timeout

  if (!leads || leads.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;
  let newSignals = 0;

  for (const lead of leads) {
    try {
      const detected = await detectSignals(lead.company, lead.website ?? "");

      const { data: existing } = await supabase
        .from("signals")
        .select("source_url")
        .eq("lead_id", lead.id);

      const knownUrls = new Set((existing ?? []).map((s: { source_url: string }) => s.source_url));
      const toInsert = detected
        .filter(s => !s.source_url || !knownUrls.has(s.source_url))
        .map(s => ({ ...s, lead_id: lead.id }));

      if (toInsert.length > 0) {
        await supabase.from("signals").insert(toInsert);
        newSignals += toInsert.length;
      }

      await supabase
        .from("leads")
        .update({ last_signal_check: new Date().toISOString() })
        .eq("id", lead.id);

      processed++;
    } catch {
      // Continue with next lead if one fails
    }
  }

  return NextResponse.json({ processed, newSignals });
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { detectSignals } from "@/lib/signals/detect";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lead_id } = await request.json();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, company, website")
    .eq("id", lead_id)
    .eq("user_id", user.id)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const detected = await detectSignals(lead.company, lead.website ?? "");

  // Fetch existing source URLs to avoid duplicates
  const { data: existing } = await supabase
    .from("signals")
    .select("source_url")
    .eq("lead_id", lead_id);

  const knownUrls = new Set((existing ?? []).map(s => s.source_url));

  const toInsert = detected
    .filter(s => !s.source_url || !knownUrls.has(s.source_url))
    .map(s => ({ ...s, lead_id }));

  if (toInsert.length > 0) {
    await supabase.from("signals").insert(toInsert);
  }

  // Update last_signal_check
  await supabase
    .from("leads")
    .update({ last_signal_check: new Date().toISOString() })
    .eq("id", lead_id)
    .eq("user_id", user.id);

  // Return all signals for this lead (newest first)
  const { data: signals } = await supabase
    .from("signals")
    .select("*")
    .eq("lead_id", lead_id)
    .order("detected_at", { ascending: false });

  return NextResponse.json({ signals: signals ?? [], newCount: toInsert.length });
}

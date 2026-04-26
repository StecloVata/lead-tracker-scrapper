import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Full feed: all signals (last 30 days) grouped by lead, with lead info.
// Used by the /signals page.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: signals } = await supabase
    .from("signals")
    .select("*, leads!inner(id, company, country, vertical, tier, website, status, user_id, is_archived)")
    .eq("leads.user_id", user.id)
    .eq("leads.is_archived", false)
    .gte("detected_at", since)
    .order("detected_at", { ascending: false });

  if (!signals || signals.length === 0) return NextResponse.json([]);

  // Group signals by lead
  type LeadGroup = {
    lead_id: string;
    company: string;
    country: string;
    vertical: string;
    tier: number;
    website: string;
    status: string;
    max_urgency: number;
    unread_count: number;
    signals: typeof signals;
  };

  const leadMap = new Map<string, LeadGroup>();

  for (const sig of signals) {
    const lead = sig.leads as { id: string; company: string; country: string; vertical: string; tier: number; website: string; status: string; user_id: string; is_archived: boolean };
    if (!lead) continue;

    const existing = leadMap.get(lead.id);
    if (!existing) {
      leadMap.set(lead.id, {
        lead_id: lead.id,
        company: lead.company,
        country: lead.country,
        vertical: lead.vertical,
        tier: lead.tier,
        website: lead.website,
        status: lead.status,
        max_urgency: sig.urgency,
        unread_count: sig.is_read ? 0 : 1,
        signals: [sig],
      });
    } else {
      existing.signals.push(sig);
      if (sig.urgency > existing.max_urgency) existing.max_urgency = sig.urgency;
      if (!sig.is_read) existing.unread_count++;
    }
  }

  const result = [...leadMap.values()]
    .sort((a, b) => b.max_urgency - a.max_urgency || b.unread_count - a.unread_count);

  return NextResponse.json(result);
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Returns top 5 leads with unread signals in the last 7 days, ranked by max urgency
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch unread signals from the last 7 days joined with their lead
  const { data: signals } = await supabase
    .from("signals")
    .select("id, lead_id, signal_type, title, urgency, detected_at, leads(id, company, country, vertical, is_archived, user_id)")
    .eq("is_read", false)
    .gte("detected_at", since)
    .order("detected_at", { ascending: false });

  if (!signals || signals.length === 0) return NextResponse.json([]);

  // Group by lead_id, keep only leads belonging to this user
  const leadMap = new Map<string, {
    lead_id: string;
    company: string;
    country: string;
    vertical: string;
    maxUrgency: number;
    unreadCount: number;
    latestSignalTitle: string;
    latestSignalType: string;
    detectedAt: string;
  }>();

  for (const sig of signals) {
    const lead = Array.isArray(sig.leads) ? sig.leads[0] : sig.leads as { id: string; company: string; country: string; vertical: string; is_archived: boolean; user_id: string } | null;
    if (!lead || lead.user_id !== user.id || lead.is_archived) continue;

    const existing = leadMap.get(lead.id);
    if (!existing) {
      leadMap.set(lead.id, {
        lead_id: lead.id,
        company: lead.company,
        country: lead.country,
        vertical: lead.vertical,
        maxUrgency: sig.urgency,
        unreadCount: 1,
        latestSignalTitle: sig.title,
        latestSignalType: sig.signal_type,
        detectedAt: sig.detected_at,
      });
    } else {
      existing.unreadCount++;
      if (sig.urgency > existing.maxUrgency) existing.maxUrgency = sig.urgency;
    }
  }

  const sorted = [...leadMap.values()]
    .sort((a, b) => b.maxUrgency - a.maxUrgency || b.unreadCount - a.unreadCount)
    .slice(0, 5);

  return NextResponse.json(sorted);
}

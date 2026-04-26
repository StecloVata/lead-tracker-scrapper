import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Lightweight: returns {lead_id, unread, max_urgency} for every lead that has unread signals.
// Used by LeadsClient to show badges on all lead rows.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: signals } = await supabase
    .from("signals")
    .select("lead_id, urgency, leads!inner(user_id)")
    .eq("is_read", false)
    .eq("leads.user_id", user.id);

  if (!signals || signals.length === 0) return NextResponse.json([]);

  const map = new Map<string, { unread: number; max_urgency: number }>();
  for (const s of signals) {
    const existing = map.get(s.lead_id);
    if (!existing) {
      map.set(s.lead_id, { unread: 1, max_urgency: s.urgency });
    } else {
      existing.unread++;
      if (s.urgency > existing.max_urgency) existing.max_urgency = s.urgency;
    }
  }

  return NextResponse.json(
    [...map.entries()].map(([lead_id, v]) => ({ lead_id, ...v }))
  );
}

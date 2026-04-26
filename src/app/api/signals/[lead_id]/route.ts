import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/signals/[lead_id] — fetch all signals for a lead
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lead_id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lead_id } = await params;

  // Verify lead ownership
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", lead_id)
    .eq("user_id", user.id)
    .single();

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: signals } = await supabase
    .from("signals")
    .select("*")
    .eq("lead_id", lead_id)
    .order("detected_at", { ascending: false });

  return NextResponse.json(signals ?? []);
}

// PATCH /api/signals/[lead_id] — mark all signals for this lead as read
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lead_id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lead_id } = await params;
  const body = await request.json().catch(() => ({}));

  // If signal_id provided → mark single signal read; otherwise mark all for lead
  if (body.signal_id) {
    await supabase
      .from("signals")
      .update({ is_read: true })
      .eq("id", body.signal_id)
      .eq("lead_id", lead_id);
  } else {
    await supabase
      .from("signals")
      .update({ is_read: true })
      .eq("lead_id", lead_id);
  }

  return NextResponse.json({ ok: true });
}

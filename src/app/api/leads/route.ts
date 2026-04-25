import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SEED_LEADS } from "@/lib/leads-seed";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Auto-seed for new users
  const { count } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  if (count === 0) {
    const toInsert = SEED_LEADS.map(l => ({ ...l, user_id: user.id }));
    await supabase.from("leads").insert(toInsert);
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*, contacts(*)")
    .eq("user_id", user.id)
    .order("tier", { ascending: true })
    .order("company", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("leads")
    .insert({ ...body, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

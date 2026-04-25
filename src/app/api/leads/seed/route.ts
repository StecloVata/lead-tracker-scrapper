import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SEED_LEADS } from "@/lib/leads-seed";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ message: "Already has leads", seeded: false });
  }

  const toInsert = SEED_LEADS.map(l => ({ ...l, user_id: user.id }));
  const { error } = await supabase.from("leads").insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ seeded: true, count: toInsert.length });
}

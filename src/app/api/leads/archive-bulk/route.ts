import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status, archived = true } = await request.json();
  if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  const { error, count } = await supabase
    .from("leads")
    .update({ is_archived: archived })
    .eq("user_id", user.id)
    .eq("status", status)
    .eq("is_archived", !archived);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count });
}

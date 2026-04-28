import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [{ data: job }, { data: candidates }] = await Promise.all([
    supabase
      .from("scrape_jobs")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("scrape_candidates")
      .select("*")
      .eq("job_id", id)
      .eq("user_id", user.id)
      .order("is_duplicate", { ascending: true })
      .order("icp_score", { ascending: false }),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ job, candidates: candidates ?? [] });
}

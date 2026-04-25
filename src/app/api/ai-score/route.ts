import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lead_id } = await request.json();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", lead_id)
    .eq("user_id", user.id)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const prompt = `You are an expert sales analyst for Adversus, a cloud-based outbound dialing platform used by call centers, BPOs, insurance companies, debt collectors, and sales teams.

Evaluate how well this prospect fits as an Adversus customer:

Company: ${lead.company}
Country: ${lead.country}
City: ${lead.city}
Vertical: ${lead.vertical}
Size: ${lead.size}
Persona: ${lead.persona}
Sales trigger: ${lead.trigger}
Notes: ${lead.notes}

Score this lead from 1–100 for Adversus fit, where:
- 90–100: Perfect ICP match — outbound-only, high call volume, likely on legacy dialer
- 70–89: Strong fit — clear outbound use case, probable budget
- 50–69: Moderate fit — outbound component but not primary
- 30–49: Weak fit — some calls but not the core motion
- 1–29: Poor fit — unlikely to need a predictive dialer

Respond with JSON only, no markdown:
{"score": <number>, "reasoning": "<1-2 sentences explaining the score>"}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const { score, reasoning } = JSON.parse(text);

    await supabase
      .from("leads")
      .update({ ai_score: score, ai_reasoning: reasoning })
      .eq("id", lead_id)
      .eq("user_id", user.id);

    return NextResponse.json({ score, reasoning });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

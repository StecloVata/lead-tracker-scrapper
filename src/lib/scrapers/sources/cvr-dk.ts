import { type DedupIndex, checkDuplicate, extendIndex } from "../dedup";
import type { ScraperCandidate } from "./brreg";

// Search terms per vertical in Danish for better results
const DENMARK_KEYWORDS: Record<string, string[]> = {
  "BPO":                    ["callcenter", "kontaktcenter", "telemarketing"],
  "Insurance & Finance":    ["forsikring salg", "finansiel telesalg"],
  "Debt Collection":        ["inkasso", "gældsindrivelse"],
  "Telecoms & Utilities":   ["telekommunikation salg", "energi telesalg"],
  "Solar & Energy":         ["solenergi salg", "vedvarende energi"],
  "Recruitment & Staffing": ["rekruttering", "vikarbureau"],
  "SaaS / Tech Sales":      ["software salg", "inside sales"],
};

const ICP_KEYWORDS = [
  "outbound","dialing","dialler","agents","campaigns","telemarketing",
  "bpo","seats","contact centre","contact center","call center","callcenter",
  "outsourcing","telesales","inside sales","cold calling",
  "callcenter","kontaktcenter","inkasso","telesalg",
];

function scoreICP(text: string): number {
  const lower = text.toLowerCase();
  return ICP_KEYWORDS.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
}

function sizeLabel(employees: string): string {
  const n = parseInt(employees ?? "0");
  if (n >= 200) return "Large (200+)";
  if (n >= 50)  return "Mid-market (50–200)";
  if (n >= 10)  return "Small (10–50)";
  return "";
}

// cvrapi.dk — free, no API key, searches Danish company register by keyword
// Docs: https://cvrapi.dk
export async function fetchCVR(
  vertical: string,
  _sizeFilter: string | undefined,
  tier: number,
  index: DedupIndex,
): Promise<ScraperCandidate[]> {
  const keywords = DENMARK_KEYWORDS[vertical] ?? ["callcenter", "telemarketing"];
  const candidates: ScraperCandidate[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords.slice(0, 2)) {
    try {
      const url = `https://cvrapi.dk/api?search=${encodeURIComponent(keyword)}&country=dk&type=company&limit=20`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "adversus-lead-tracker/1.0",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      // cvrapi returns a single object or an array
      const items = Array.isArray(data) ? data : (data.name ? [data] : []);

      for (const item of items) {
        if (!item.name) continue;
        if (item.industrydesc?.toLowerCase().includes("holding")) continue;

        const company = item.name.trim();
        if (seen.has(company.toLowerCase())) continue;
        seen.add(company.toLowerCase());

        const website = item.email
          ? item.email.split("@")[1] ?? ""
          : "";
        const city = item.city ?? item.cityname ?? "";
        const employees = item.employees ?? "";

        const dupeCheck = checkDuplicate({ company, website }, index);
        const candidate: ScraperCandidate = {
          company,
          website,
          country: "Denmark",
          vertical,
          tier,
          size: sizeLabel(String(employees)),
          notes: [
            item.industrydesc ?? "",
            city ? `Based in ${city}` : "",
            employees ? `${employees} employees` : "",
          ].filter(Boolean).join(" · "),
          linkedin_url: "",
          icp_score: scoreICP(company + " " + (item.industrydesc ?? "")),
          is_duplicate:      dupeCheck.isDuplicate,
          duplicate_match:   dupeCheck.isDuplicate ? dupeCheck.layer : "",
          duplicate_lead_id: dupeCheck.isDuplicate ? dupeCheck.leadId : null,
        };

        if (!dupeCheck.isDuplicate) {
          extendIndex(index, { id: crypto.randomUUID(), company, website });
        }

        candidates.push(candidate);
        if (candidates.length >= 25) break;
      }
    } catch {
      // cvrapi temporarily unavailable
    }
    if (candidates.length >= 25) break;
  }

  return candidates;
}

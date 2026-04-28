import { type DedupIndex, checkDuplicate, extendIndex } from "../dedup";
import type { ScraperCandidate } from "./brreg";

// SIC codes relevant to our ICP
const UK_SIC: Record<string, string[]> = {
  "BPO":                    ["82200"],
  "Insurance & Finance":    ["65120", "65110", "64910"],
  "Debt Collection":        ["82910"],
  "Telecoms & Utilities":   ["61100", "61200", "35110"],
  "Solar & Energy":         ["35110", "35140"],
  "Recruitment & Staffing": ["78100", "78200"],
  "SaaS / Tech Sales":      ["62010", "62020", "63110"],
};

const ICP_KEYWORDS = [
  "outbound","dialing","dialler","agents","campaigns","telemarketing",
  "bpo","seats","contact centre","contact center","call center","callcenter",
  "outsourcing","telesales","inside sales","cold calling",
];

function scoreICP(text: string): number {
  const lower = text.toLowerCase();
  return ICP_KEYWORDS.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
}

function sizeLabel(n: number): string {
  if (n >= 200) return "Large (200+)";
  if (n >= 50)  return "Mid-market (50–200)";
  if (n >= 10)  return "Small (10–50)";
  return "";
}

function matchesSize(n: number, sizeFilter?: string): boolean {
  if (!sizeFilter || sizeFilter === "Any size") return true;
  if (sizeFilter.includes("Small"))  return n >= 10 && n < 50;
  if (sizeFilter.includes("Mid"))    return n >= 50 && n < 200;
  if (sizeFilter.includes("Large"))  return n >= 200;
  return true;
}

// Companies House free API — requires a free API key from developer.company-information.service.gov.uk
// Rate limit: 600 requests per 5 minutes
export async function fetchCompaniesHouse(
  vertical: string,
  sizeFilter: string | undefined,
  tier: number,
  index: DedupIndex,
  apiKey: string,
): Promise<ScraperCandidate[]> {
  const sicCodes = UK_SIC[vertical] ?? ["82200"];
  const candidates: ScraperCandidate[] = [];
  const seen = new Set<string>();

  for (const sic of sicCodes.slice(0, 2)) {
    try {
      const url = `https://api.company-information.service.gov.uk/search/companies?q=${sic}&items_per_page=50`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      for (const item of (data.items ?? [])) {
        if (item.company_status !== "active") continue;
        const company: string = item.title ?? item.company_name ?? "";
        if (!company || seen.has(company.toLowerCase())) continue;
        seen.add(company.toLowerCase());

        // Companies House doesn't return employee count in search results
        // Use address as notes context
        const address = [
          item.address?.address_line_1,
          item.address?.locality,
          item.address?.postal_code,
        ].filter(Boolean).join(", ");

        // Employee count not in search API — skip size filter for CH
        if (sizeFilter && sizeFilter !== "Any size") {
          // We can't filter by size from search results; include all and mark size as unknown
        }
        if (!matchesSize(0, sizeFilter)) continue;

        const website = item.links?.company_page
          ? ""  // CH doesn't return websites in search; enrichment fills this
          : "";

        const dupeCheck = checkDuplicate({ company, website }, index);
        const candidate: ScraperCandidate = {
          company,
          website,
          country: "UK",
          vertical,
          tier,
          size: sizeLabel(0),
          notes: [
            item.description ?? "",
            address ? `Based in ${address}` : "",
            `Companies House: ${item.company_number ?? ""}`,
          ].filter(Boolean).join(" · "),
          linkedin_url: "",
          icp_score: scoreICP(company + " " + (item.description ?? "")),
          is_duplicate:      dupeCheck.isDuplicate,
          duplicate_match:   dupeCheck.isDuplicate ? dupeCheck.layer : "",
          duplicate_lead_id: dupeCheck.isDuplicate ? dupeCheck.leadId : null,
        };

        if (!dupeCheck.isDuplicate) {
          extendIndex(index, { id: crypto.randomUUID(), company, website });
        }

        candidates.push(candidate);
        if (candidates.length >= 30) break;
      }
    } catch {
      // API temporarily unavailable
    }
    if (candidates.length >= 30) break;
  }

  return candidates;
}

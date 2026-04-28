import { type DedupIndex, checkDuplicate, extendIndex } from "../dedup";

export interface ScraperCandidate {
  company:      string;
  website:      string;
  country:      string;
  vertical:     string;
  tier:         number;
  size:         string;
  notes:        string;
  linkedin_url: string;
  icp_score:    number;
  is_duplicate: boolean;
  duplicate_match: string;
  duplicate_lead_id: string | null;
}

const NORWAY_NACE: Record<string, string[]> = {
  "BPO":                   ["82.200", "82.990", "82.100", "74.900"],
  "Insurance & Finance":   ["65.120", "65.110", "66.220", "64.910"],
  "Debt Collection":       ["82.910", "64.910", "66.190"],
  "Telecoms & Utilities":  ["61.100", "61.200", "61.900", "35.140"],
  "Solar & Energy":        ["35.110", "35.140", "43.210", "71.120"],
  "Recruitment & Staffing":["78.100", "78.200", "78.300", "74.900"],
  "SaaS / Tech Sales":     ["62.010", "62.020", "62.090", "63.110"],
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

function sizeFromCount(n: number): string {
  if (n >= 200) return "Large (200+)";
  if (n >= 50)  return "Mid-market (50–200)";
  if (n >= 10)  return "Small (10–50)";
  return "";
}

function matchesSize(n: number, sizeFilter?: string): boolean {
  if (!sizeFilter || sizeFilter === "Any size") return n > 0;
  if (sizeFilter.includes("Small"))  return n >= 10 && n < 50;
  if (sizeFilter.includes("Mid"))    return n >= 50 && n < 200;
  if (sizeFilter.includes("Large"))  return n >= 200;
  return n > 0;
}

export async function fetchBrreg(
  vertical: string,
  sizeFilter: string | undefined,
  tier: number,
  index: DedupIndex,
): Promise<ScraperCandidate[]> {
  const naceCodes = NORWAY_NACE[vertical] ?? ["82.200"];
  const candidates: ScraperCandidate[] = [];

  for (const nace of naceCodes) {
    try {
      const url = `https://data.brreg.no/enhetsregisteret/api/enheter?naeringskode=${encodeURIComponent(nace)}&konkurs=false&size=50`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      for (const e of (data._embedded?.enheter ?? [])) {
        if (!e.navn || e.underAvvikling) continue;
        const employees: number = e.antallAnsatte ?? 0;
        if (employees === 0) continue;
        if (!matchesSize(employees, sizeFilter)) continue;

        const company = e.navn.trim();
        const website = e.hjemmeside
          ? e.hjemmeside.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
          : "";
        const city = e.forretningsadresse?.poststed ?? e.forretningsadresse?.kommune ?? "";
        const industryDesc = e.naeringskode1?.beskrivelse ?? "";

        const dupeCheck = checkDuplicate({ company, website }, index);
        const candidate: ScraperCandidate = {
          company,
          website,
          country: "Norway",
          vertical,
          tier,
          size: sizeFromCount(employees),
          notes: [industryDesc, city ? `Based in ${city}` : "", `${employees} employees`].filter(Boolean).join(" · "),
          linkedin_url: "",
          icp_score: scoreICP(company + " " + industryDesc),
          is_duplicate:      dupeCheck.isDuplicate,
          duplicate_match:   dupeCheck.isDuplicate ? dupeCheck.layer : "",
          duplicate_lead_id: dupeCheck.isDuplicate ? dupeCheck.leadId : null,
        };

        if (!dupeCheck.isDuplicate) {
          extendIndex(index, { id: crypto.randomUUID(), company, website });
        }

        candidates.push(candidate);
      }
    } catch {
      // Registry temporarily unavailable — skip this NACE code
    }
  }

  return candidates;
}

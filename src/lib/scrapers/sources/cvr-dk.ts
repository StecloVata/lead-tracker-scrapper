import { type DedupIndex, checkDuplicate, extendIndex } from "../dedup";
import type { ScraperCandidate } from "./brreg";

// Danish NACE/DB07 codes per vertical
const DENMARK_NACE: Record<string, string[]> = {
  "BPO":                    ["82.20"],
  "Insurance & Finance":    ["65.12", "65.11"],
  "Debt Collection":        ["82.91"],
  "Telecoms & Utilities":   ["61.10", "61.20"],
  "Solar & Energy":         ["35.11", "35.14"],
  "Recruitment & Staffing": ["78.10", "78.20"],
  "SaaS / Tech Sales":      ["62.01", "62.02"],
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

// CVR (Central Business Register) — completely free, no API key
// Docs: https://datacvr.virk.dk/artikel/system-til-system-adgang-til-cvr-data
export async function fetchCVR(
  vertical: string,
  sizeFilter: string | undefined,
  tier: number,
  index: DedupIndex,
): Promise<ScraperCandidate[]> {
  const naceCodes = DENMARK_NACE[vertical] ?? ["82.20"];
  const candidates: ScraperCandidate[] = [];

  for (const nace of naceCodes.slice(0, 2)) {
    try {
      // CVR Elasticsearch endpoint — free, unauthenticated for basic queries
      const body = {
        query: {
          bool: {
            must: [
              { term: { "Vrvirksomhed.virksomhedsstatus.status.keyword": "NORMAL" } },
              { term: { "Vrvirksomhed.hovedbranche.branchekode.keyword": nace.replace(".", "") } },
            ],
          },
        },
        size: 50,
        _source: [
          "Vrvirksomhed.virksomhedNavn",
          "Vrvirksomhed.reklamebeskyttet",
          "Vrvirksomhed.beliggenhedsadresse",
          "Vrvirksomhed.kontaktoplysninger",
          "Vrvirksomhed.aarsbeskaeftigelse",
          "Vrvirksomhed.hovedbranche",
        ],
      };

      const res = await fetch(
        "https://cvrapi.dk/api/dk/virksomhed/_search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        }
      );
      if (!res.ok) continue;

      const data = await res.json();
      const hits = data.hits?.hits ?? [];

      for (const hit of hits) {
        const src = hit._source?.Vrvirksomhed;
        if (!src) continue;
        if (src.reklamebeskyttet) continue; // opted out of marketing

        const nameEntry = Array.isArray(src.virksomhedNavn)
          ? src.virksomhedNavn.find((n: { periode?: { gyldigTil?: string } }) => !n.periode?.gyldigTil)
          : src.virksomhedNavn;
        const company = nameEntry?.navn ?? "";
        if (!company) continue;

        // Employee count from latest year
        const employment = Array.isArray(src.aarsbeskaeftigelse)
          ? src.aarsbeskaeftigelse.sort((a: { aar: number }, b: { aar: number }) => b.aar - a.aar)[0]
          : null;
        const employees = employment?.antalAnsatte ?? 0;
        if (employees === 0) continue;
        if (!matchesSize(employees, sizeFilter)) continue;

        const addr = Array.isArray(src.beliggenhedsadresse)
          ? src.beliggenhedsadresse.find((a: { periode?: { gyldigTil?: string } }) => !a.periode?.gyldigTil)
          : src.beliggenhedsadresse;
        const city = addr?.postdistrikt ?? addr?.kommune?.kommuneNavn ?? "";

        // Website from contact info
        const contacts = src.kontaktoplysninger ?? [];
        const websiteEntry = contacts.find((c: { kontaktoplysningstype?: string }) =>
          c.kontaktoplysningstype === "HJEMMESIDE"
        );
        const website = websiteEntry?.kontaktoplysning
          ? websiteEntry.kontaktoplysning.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
          : "";

        const industryDesc = src.hovedbranche?.branchetekst ?? "";

        const dupeCheck = checkDuplicate({ company, website }, index);
        const candidate: ScraperCandidate = {
          company,
          website,
          country: "Denmark",
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
        if (candidates.length >= 30) break;
      }
    } catch {
      // CVR API temporarily unavailable
    }
    if (candidates.length >= 30) break;
  }

  return candidates;
}

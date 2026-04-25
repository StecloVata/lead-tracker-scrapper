import type { Lead } from "@/types/lead";

const EXPORT_HEADERS = ["company", "country", "city", "vertical", "tier", "size", "website", "persona", "trigger", "notes", "status", "is_priority"];

// Maps common header variants → internal field name
const HEADER_MAP: Record<string, string> = {
  company: "company", "company name": "company", organization: "company", name: "company", firm: "company",
  country: "country", nation: "country",
  city: "city", location: "city", town: "city", hq: "city",
  vertical: "vertical", industry: "vertical", sector: "vertical", segment: "vertical",
  tier: "tier", "priority tier": "tier", priority: "tier",
  size: "size", "company size": "size", employees: "size", headcount: "size", "employee count": "size",
  website: "website", url: "website", domain: "website", "web": "website",
  persona: "persona", contact: "persona", "decision maker": "persona", "key persona": "key persona",
  trigger: "trigger", "sales trigger": "trigger", reason: "trigger", "buying trigger": "trigger",
  notes: "notes", description: "notes", note: "notes", comments: "notes", details: "notes", info: "notes",
  status: "status",
  "is_priority": "is_priority", "priority flag": "is_priority",
  linkedin: "linkedin", "linkedin url": "linkedin",
};

// Proper RFC-4180 CSV line parser — handles empty fields, escaped quotes, CRLF
function parseLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

export function downloadCSV(leads: Lead[], filename: string) {
  const rows = [EXPORT_HEADERS.join(",")];
  for (const l of leads) {
    rows.push(EXPORT_HEADERS.map(h => {
      const v = String((l as unknown as Record<string, unknown>)[h] ?? "");
      return `"${v.replace(/"/g, '""')}"`;
    }).join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSVTemplate() {
  const headers = ["company", "country", "city", "vertical", "tier", "size", "website", "persona", "trigger", "notes", "status"];
  const example = ["Acme BPO", "Sweden", "Stockholm", "BPO", "2", "50–200", "acmebpo.se", "Head of Operations", "Expanding outbound team", "Strong Adversus fit", "Not contacted"];
  const rows = [headers.join(","), example.map(v => `"${v}"`).join(",")];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "leads-template.csv"; a.click();
  URL.revokeObjectURL(url);
}

export interface ParseResult {
  leads: Partial<Lead>[];
  skipped: number;
  unknownHeaders: string[];
}

export function parseCSV(text: string): ParseResult {
  // Normalise line endings
  const lines = text.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return { leads: [], skipped: 0, unknownHeaders: [] };

  const rawHeaders = parseLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

  // Map each raw header to an internal field name
  const mappedHeaders = rawHeaders.map(h => HEADER_MAP[h] ?? h);
  const unknownHeaders = rawHeaders.filter(h => !HEADER_MAP[h]);

  const leads: Partial<Lead>[] = [];
  let skipped = 0;

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const vals = parseLine(line);
    const obj: Record<string, unknown> = {};

    mappedHeaders.forEach((field, i) => {
      obj[field] = (vals[i] ?? "").trim();
    });

    if (!obj.company) { skipped++; continue; }

    // Coerce types
    const tierNum = parseInt(String(obj.tier)) || 2;
    obj.tier = tierNum < 1 || tierNum > 3 ? 2 : tierNum;
    obj.is_priority = String(obj.is_priority).toLowerCase() === "true";
    if (!obj.status) obj.status = "Not contacted";

    leads.push(obj as Partial<Lead>);
  }

  return { leads, skipped, unknownHeaders };
}

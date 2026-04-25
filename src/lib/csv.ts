import type { Lead } from "@/types/lead";

const HEADERS = ["company", "country", "city", "vertical", "tier", "size", "website", "persona", "trigger", "notes", "status", "is_priority", "ai_score"];

export function downloadCSV(leads: Lead[], filename: string) {
  const rows = [HEADERS.join(",")];
  for (const l of leads) {
    rows.push(HEADERS.map(h => {
      const v = String((l as unknown as Record<string, unknown>)[h] ?? "");
      return `"${v.replace(/"/g, '""')}"`;
    }).join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseCSV(text: string): Partial<Lead>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, "").toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) ?? [];
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] ?? "").replace(/^"|"$/g, "").replace(/""/g, '"').trim();
    });
    if (obj.tier) obj.tier = parseInt(String(obj.tier)) || 2;
    if (obj.is_priority) obj.is_priority = obj.is_priority === "true";
    if (obj.ai_score && obj.ai_score !== "") obj.ai_score = parseInt(String(obj.ai_score)) || null;
    else obj.ai_score = null;
    return obj as Partial<Lead>;
  }).filter(r => r.company);
}

const LEGAL_SUFFIXES =
  /\b(ltd|llc|gmbh|ag|as|ab|bv|nv|sa|srl|spa|plc|inc|corp|co|oy|aps|a\/s|s\.a|s\.r\.l)\b\.?/gi;

export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenFingerprint(name: string): string {
  return normalizeCompany(name)
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function domainRoot(website: string): string {
  if (!website) return "";
  const clean = website
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  const parts = clean.split(".");
  return parts.length >= 2 ? parts[parts.length - 2] : clean;
}

export function normalizeDomain(website: string): string {
  if (!website) return "";
  return website
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

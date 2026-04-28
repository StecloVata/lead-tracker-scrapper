import { domainRoot, normalizeDomain, normalizeCompany, tokenFingerprint } from "./normalize";

export interface DedupIndex {
  domainRoots:     Map<string, string>;
  exactDomains:    Map<string, string>;
  normalizedNames: Map<string, string>;
  tokenSets:       Map<string, string>;
}

export function buildIndex(
  leads: { id: string; company: string; website: string }[]
): DedupIndex {
  const domainRoots     = new Map<string, string>();
  const exactDomains    = new Map<string, string>();
  const normalizedNames = new Map<string, string>();
  const tokenSets       = new Map<string, string>();

  for (const l of leads) {
    const dr = domainRoot(l.website ?? "");
    if (dr) domainRoots.set(dr, l.id);

    const ed = normalizeDomain(l.website ?? "");
    if (ed) exactDomains.set(ed, l.id);

    const nm = normalizeCompany(l.company);
    if (nm) normalizedNames.set(nm, l.id);

    const tf = tokenFingerprint(l.company);
    if (tf) tokenSets.set(tf, l.id);
  }

  return { domainRoots, exactDomains, normalizedNames, tokenSets };
}

export type DupeMatch =
  | { isDuplicate: false }
  | { isDuplicate: true; layer: "domain" | "name" | "token"; leadId: string };

export function checkDuplicate(
  candidate: { company: string; website?: string },
  index: DedupIndex
): DupeMatch {
  const site = candidate.website ?? "";

  const ed = normalizeDomain(site);
  if (ed && index.exactDomains.has(ed))
    return { isDuplicate: true, layer: "domain", leadId: index.exactDomains.get(ed)! };

  const dr = domainRoot(site);
  if (dr && index.domainRoots.has(dr))
    return { isDuplicate: true, layer: "domain", leadId: index.domainRoots.get(dr)! };

  const nm = normalizeCompany(candidate.company);
  if (nm && index.normalizedNames.has(nm))
    return { isDuplicate: true, layer: "name", leadId: index.normalizedNames.get(nm)! };

  const tf = tokenFingerprint(candidate.company);
  if (tf && index.tokenSets.has(tf))
    return { isDuplicate: true, layer: "token", leadId: index.tokenSets.get(tf)! };

  return { isDuplicate: false };
}

// Extend an existing index with newly staged candidates (within-batch dedup)
export function extendIndex(
  index: DedupIndex,
  candidate: { id: string; company: string; website?: string }
): void {
  const site = candidate.website ?? "";

  const dr = domainRoot(site);
  if (dr && !index.domainRoots.has(dr)) index.domainRoots.set(dr, candidate.id);

  const ed = normalizeDomain(site);
  if (ed && !index.exactDomains.has(ed)) index.exactDomains.set(ed, candidate.id);

  const nm = normalizeCompany(candidate.company);
  if (nm && !index.normalizedNames.has(nm)) index.normalizedNames.set(nm, candidate.id);

  const tf = tokenFingerprint(candidate.company);
  if (tf && !index.tokenSets.has(tf)) index.tokenSets.set(tf, candidate.id);
}

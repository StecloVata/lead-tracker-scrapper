export interface EnrichmentResult {
  emails:      string[];
  phones:      string[];
  people:      { name: string; role: string; linkedin: string }[];
  tech_stack:  string[];
  linkedin_url: string;
  description: string;
}

// Contact-center / outbound tech stack — any mention boosts ICP score
const TECH_SIGNALS = [
  "Adversus", "Genesys", "Five9", "NICE", "Avaya", "Twilio", "Talkdesk",
  "Zendesk", "Salesforce", "HubSpot", "Freshdesk", "CloudTalk", "Aircall",
  "Kavkom", "Dialer", "Predictive dialer", "Auto dialer", "Power dialer",
];

// Roles we care about (decision-makers)
const DM_ROLE_RE =
  /\b(ceo|coo|cto|cco|managing director|md|vp sales|head of sales|sales director|operations director|operations manager|contact cent(?:er|re) manager|call cent(?:er|re) manager)\b/i;

// Pages to try per domain (localised slugs included)
const CONTACT_SLUGS = ["/contact", "/contact-us", "/kontakt", "/contacto", "/contatti", "/contact-us/"];
const ABOUT_SLUGS   = ["/about", "/about-us", "/om-oss", "/over-ons", "/uber-uns", "/qui-sommes-nous"];
const TEAM_SLUGS    = ["/team", "/leadership", "/management", "/people", "/our-team", "/about/team"];
const CAREER_SLUGS  = ["/careers", "/jobs", "/vacancies", "/work-with-us", "/join-us", "/karriere"];

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en" },
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Try a list of slugs, return first successful HTML
async function tryPages(base: string, slugs: string[]): Promise<string | null> {
  for (const slug of slugs) {
    const html = await fetchPage(`https://${base}${slug}`);
    if (html) return html;
  }
  return null;
}

function extractEmails(html: string, domain: string): string[] {
  const raw = html.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,6}/gi) ?? [];
  const NOISE = /^(noreply|no-reply|support|info|hello|contact|careers|jobs|privacy|legal|abuse|postmaster|webmaster)@/i;
  return [...new Set(
    raw
      .filter(e => e.toLowerCase().endsWith(`@${domain}`) || e.toLowerCase().includes(`@${domain}`))
      .filter(e => !NOISE.test(e))
      .map(e => e.toLowerCase())
  )].slice(0, 5);
}

function extractPhones(html: string): string[] {
  // Match intl format: +XX or +XXX prefix
  const raw = html.match(/\+\d[\d\s().-]{7,18}\d/g) ?? [];
  return [...new Set(raw.map(p => p.replace(/\s+/g, " ").trim()))].slice(0, 3);
}

function extractLinkedIn(html: string): string {
  const m = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/company\/[\w-]+\/?/i);
  return m ? m[0].replace(/\/$/, "") : "";
}

function extractDescription(html: string): string {
  const unescape = (s: string) =>
    s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
     .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

  const get = (re: RegExp) => { const m = html.match(re); return m ? unescape(m[1]) : ""; };

  return (
    get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,400})/i) ||
    get(/<meta[^>]+content=["']([^"']{1,400})[^>]+property=["']og:description["']/i) ||
    get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})/i) ||
    get(/<meta[^>]+content=["']([^"']{1,400})[^>]+name=["']description["']/i)
  );
}

function extractTechStack(html: string): string[] {
  const lower = html.toLowerCase();
  return TECH_SIGNALS.filter(t => lower.includes(t.toLowerCase()));
}

function extractPeople(html: string): { name: string; role: string; linkedin: string }[] {
  const people: { name: string; role: string; linkedin: string }[] = [];

  // schema.org Person markup
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const ld = JSON.parse(m[1]);
      const items = Array.isArray(ld) ? ld : [ld];
      for (const item of items) {
        if (item["@type"] === "Person" && item.name) {
          const role = item.jobTitle || "";
          if (!DM_ROLE_RE.test(role)) continue;
          people.push({
            name: item.name,
            role,
            linkedin: item.sameAs?.find?.((u: string) => u.includes("linkedin")) ?? "",
          });
        }
      }
    } catch { /* malformed JSON-LD */ }
  }

  if (people.length > 0) return people.slice(0, 5);

  // Heuristic: <h3>Name</h3><p>Role</p> or name in a card with a role nearby
  const cardRe = /<(?:h[2-4]|div|span)[^>]*>([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)<\/(?:h[2-4]|div|span)>\s*(?:<[^>]+>)*([^<]{4,80})<\/[a-z]+>/g;
  for (const m of html.matchAll(cardRe)) {
    const name = m[1].trim();
    const role = m[2].trim().replace(/&amp;/g, "&");
    if (!DM_ROLE_RE.test(role)) continue;
    if (people.some(p => p.name === name)) continue;

    // Look for adjacent linkedin href
    const ctx = html.slice(Math.max(0, m.index! - 300), m.index! + 300);
    const li = ctx.match(/href=["'](https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+)/i);
    people.push({ name, role, linkedin: li?.[1] ?? "" });
    if (people.length >= 5) break;
  }

  return people;
}

export async function enrichWebsite(domain: string): Promise<EnrichmentResult> {
  const base = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

  const [homeHtml, contactHtml, aboutHtml, teamHtml, careerHtml] = await Promise.all([
    fetchPage(`https://${base}`),
    tryPages(base, CONTACT_SLUGS),
    tryPages(base, ABOUT_SLUGS),
    tryPages(base, TEAM_SLUGS),
    tryPages(base, CAREER_SLUGS),
  ]);

  const allHtml = [homeHtml, contactHtml, aboutHtml, teamHtml, careerHtml]
    .filter(Boolean)
    .join("\n");

  const emails      = extractEmails(allHtml, base);
  const phones      = extractPhones(allHtml);
  const linkedin_url = extractLinkedIn(allHtml);
  const tech_stack  = extractTechStack([careerHtml, homeHtml].filter(Boolean).join("\n"));
  const people      = extractPeople([teamHtml, aboutHtml].filter(Boolean).join("\n"));
  const description = extractDescription(homeHtml ?? "");

  return { emails, phones, people, tech_stack, linkedin_url, description };
}

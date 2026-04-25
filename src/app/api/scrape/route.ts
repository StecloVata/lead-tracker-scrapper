import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Dynamic import to avoid bundle issues on Vercel
async function getBrowser() {
  if (process.env.VERCEL) {
    const chromium = await import("@sparticuz/chromium-min");
    const puppeteer = await import("puppeteer-core");
    return puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: { width: 1280, height: 800 },
      executablePath: await chromium.default.executablePath(
        "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
      ),
      headless: true,
    });
  } else {
    const puppeteer = await import("puppeteer");
    return puppeteer.default.launch({ headless: true });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, vertical, country } = await request.json();
  if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });

  const searchQuery = `${query} ${vertical || ""} ${country || ""} outbound call center dialer site:linkedin.com OR site:crunchbase.com OR inurl:about`.trim();

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");

    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=10`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const results = await page.evaluate(() => {
      const items: { title: string; url: string; snippet: string }[] = [];
      document.querySelectorAll(".g").forEach(el => {
        const titleEl = el.querySelector("h3");
        const linkEl = el.querySelector("a");
        const snippetEl = el.querySelector(".VwiC3b, .s3v9rd, .st");
        if (titleEl && linkEl) {
          items.push({
            title: titleEl.textContent || "",
            url: (linkEl as HTMLAnchorElement).href || "",
            snippet: snippetEl?.textContent || "",
          });
        }
      });
      return items.slice(0, 8);
    });

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}

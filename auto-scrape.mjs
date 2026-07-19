/**
 * Automated Email Scraper
 *
 * Uses Puppeteer to visit pages, extract emails, and export CSV.
 * Same extraction logic as the Chrome extension but fully automated.
 *
 * Usage:
 *   npm run scrape                    # scrape URLs from urls.txt
 *   npm run scrape:search             # search queries from queries.txt → find URLs → scrape
 *   node auto-scrape.mjs https://example.com https://other.com   # pass URLs directly
 */

import puppeteer from "puppeteer-core"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Config ───────────────────────────────────────────────
const CONFIG = {
  /** Subpages to crawl on each domain */
  subpages: [
    "/contact",
    "/contact-us",
    "/about",
    "/about-us",
    "/team",
    "/careers",
  ],
  /** Delay between page visits (ms) — be respectful */
  delayBetweenPages: 800,
  /** Page load timeout (ms) */
  pageTimeout: 10000,
  /** Max pages to visit per domain (including subpages) */
  maxPagesPerDomain: 7,
  /** Max search result URLs to collect per query */
  maxSearchResults: 20,
  /** Junk email patterns to auto-skip */
  junkPatterns: [
    /noreply@/i,
    /no-reply@/i,
    /donotreply@/i,
    /mailer-daemon@/i,
    /postmaster@/i,
    /^test@/i,
    /example\.com$/i,
    /sentry\.io$/i,
    /wixpress\.com$/i,
    /\.png$/i,
    /\.jpg$/i,
    /\.gif$/i,
  ],
  /** Patterns that indicate HR / decision-maker emails */
  hrPatterns: [
    /^hr@/i,
    /^hr\./i,
    /^careers@/i,
    /^hiring@/i,
    /^recruit/i,
    /^people@/i,
    /^talent/i,
    /^jobs@/i,
    /^humanresource/i,
    /^admin@/i,
    /^ceo@/i,
    /^coo@/i,
    /^founder@/i,
    /^director@/i,
    /^management@/i,
    /^contact@/i,
    /^info@/i,
  ],
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// ─── Helpers ──────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function getChromePath() {
  const paths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ]
  const found = paths.find((p) => fs.existsSync(p))
  if (!found) {
    console.error("Chrome not found. Install Chrome or set CHROME_PATH env var.")
    process.exit(1)
  }
  return found
}

function loadIgnoreList() {
  const ignorePath = path.join(__dirname, "ignore.txt")
  if (!fs.existsSync(ignorePath)) return new Set()
  return new Set(
    fs
      .readFileSync(ignorePath, "utf-8")
      .split("\n")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes("@"))
  )
}

function loadUrls() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"))
  if (args.length > 0) return args

  const urlsPath = path.join(__dirname, "urls.txt")
  if (!fs.existsSync(urlsPath)) {
    console.error("No URLs provided.")
    console.error("  Create urls.txt (one URL per line)")
    console.error("  Or pass URLs: node auto-scrape.mjs https://example.com")
    process.exit(1)
  }
  return fs
    .readFileSync(urlsPath, "utf-8")
    .split("\n")
    .map((u) => u.trim())
    .filter((u) => u && !u.startsWith("#"))
}

function loadQueries() {
  const queriesPath = path.join(__dirname, "queries.txt")
  if (!fs.existsSync(queriesPath)) {
    console.error("No queries found. Create queries.txt (one search query per line)")
    process.exit(1)
  }
  return fs
    .readFileSync(queriesPath, "utf-8")
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q && !q.startsWith("#"))
}

function isJunkEmail(email) {
  return CONFIG.junkPatterns.some((p) => p.test(email))
}

function classifyEmail(email) {
  if (CONFIG.hrPatterns.some((p) => p.test(email))) return "HR/Decision-Maker"
  return "General"
}

function normalizeUrl(raw) {
  let url = raw.trim()
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url
  }
  return url
}

// ─── Core: Extract emails from a page ────────────────────

async function extractEmails(page) {
  return page.evaluate(() => {
    const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const emails = new Set()

    // mailto links
    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      const href = (a.getAttribute("href") || "")
        .replace(/^mailto:/i, "")
        .split(/[?,&]/)[0]
        .trim()
      const match = href.match(EMAIL_RE)
      if (match) emails.add(match[0].toLowerCase())
    })

    // visible text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.textContent || ""
        return text.includes("@") && text.length <= 500
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT
      },
    })
    let n
    while ((n = walker.nextNode())) {
      const matches = (n.textContent || "").match(EMAIL_RE) || []
      matches.forEach((email) => emails.add(email.toLowerCase()))
    }

    return [...emails]
  })
}

// ─── Core: Scrape a single URL ───────────────────────────

async function scrapePage(browser, url, ignoreSet, results) {
  let page
  try {
    page = await browser.newPage()
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    )
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" })
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: CONFIG.pageTimeout })

    // Wait a bit for any JS-rendered content
    await sleep(1000)

    const emails = await extractEmails(page)
    let found = 0

    emails.forEach((email) => {
      if (ignoreSet.has(email)) return
      if (isJunkEmail(email)) return

      if (!results.has(email)) {
        results.set(email, { sources: new Set(), type: classifyEmail(email) })
      }
      results.get(email).sources.add(url)
      found++
    })

    if (found > 0) {
      console.log(`    ✓ ${url} → ${found} email(s)`)
    } else {
      console.log(`    · ${url} → 0`)
    }
  } catch (err) {
    console.log(`    ✗ ${url} → failed (${err.message.slice(0, 60)})`)
  } finally {
    if (page) await page.close().catch(() => {})
  }
}

// ─── Core: Crawl a domain (base URL + subpages) ─────────

async function crawlDomain(browser, baseUrl, ignoreSet, results) {
  const normalized = normalizeUrl(baseUrl)
  let origin
  try {
    origin = new URL(normalized).origin
  } catch {
    console.log(`  ⚠ Invalid URL: ${baseUrl}`)
    return
  }

  console.log(`\n  🔍 ${origin}`)

  // Build list: base URL + subpages
  const urlsToVisit = [normalized]
  CONFIG.subpages.forEach((sub) => {
    urlsToVisit.push(`${origin}${sub}`)
  })

  // Limit
  const limited = urlsToVisit.slice(0, CONFIG.maxPagesPerDomain)

  // Scrape in parallel batches of 3
  const BATCH_SIZE = 3
  for (let i = 0; i < limited.length; i += BATCH_SIZE) {
    const batch = limited.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map((url) => scrapePage(browser, url, ignoreSet, results)))
    if (i + BATCH_SIZE < limited.length) await sleep(CONFIG.delayBetweenPages)
  }
}

// ─── Search mode: Use DuckDuckGo to find URLs ───────────

async function searchForUrls(browser, query) {
  console.log(`\n  🔎 Searching: "${query}"`)
  const urls = []
  let page
  try {
    page = await browser.newPage()
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    )
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 })

    const links = await page.evaluate(() => {
      const results = []
      document.querySelectorAll("a.result__a").forEach((a) => {
        // Use a.href (resolved absolute URL), not getAttribute which returns relative
        const href = a.href || ""
        if (href.startsWith("http")) results.push(href)
      })
      return results
    })

    // Extract real URLs from DuckDuckGo redirect wrappers
    const realLinks = links.map((link) => {
      try {
        const u = new URL(link)
        const uddg = u.searchParams.get("uddg")
        return uddg ? decodeURIComponent(uddg) : link
      } catch {
        return link
      }
    })

    // Dedupe by domain and limit
    const seenDomains = new Set()
    const skipDomains = ["duckduckgo.com", "google.com", "bing.com", "linkedin.com", "facebook.com", "youtube.com", "twitter.com", "x.com", "wikipedia.org", "reddit.com"]
    for (const link of realLinks) {
      try {
        const domain = new URL(link).hostname.replace(/^www\./, "")
        if (!seenDomains.has(domain) && !skipDomains.some((s) => domain.includes(s))) {
          seenDomains.add(domain)
          urls.push(link)
        }
      } catch {}
      if (urls.length >= CONFIG.maxSearchResults) break
    }

    console.log(`     Found ${urls.length} unique domains`)
  } catch (err) {
    console.log(`     Search failed: ${err.message.slice(0, 60)}`)
  } finally {
    if (page) await page.close().catch(() => {})
  }
  return urls
}

// ─── Export CSV ──────────────────────────────────────────

function exportCsv(results) {
  const outDir = path.join(__dirname, "output")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")
  const outFile = path.join(outDir, `emails-${timestamp}.csv`)

  // Sort: HR emails first, then alphabetical
  const sorted = [...results.entries()].sort((a, b) => {
    if (a[1].type === "HR/Decision-Maker" && b[1].type !== "HR/Decision-Maker") return -1
    if (a[1].type !== "HR/Decision-Maker" && b[1].type === "HR/Decision-Maker") return 1
    return a[0].localeCompare(b[0])
  })

  const rows = ["email,type,source_urls"]
  sorted.forEach(([email, data]) => {
    const sources = [...data.sources].join(" | ")
    rows.push(`"${email}","${data.type}","${sources}"`)
  })

  fs.writeFileSync(outFile, rows.join("\n"))
  return outFile
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const isSearchMode = process.argv.includes("--search")

  console.log("╔══════════════════════════════════════╗")
  console.log("║     Automated Email Scraper          ║")
  console.log("╚══════════════════════════════════════╝")

  const ignoreSet = loadIgnoreList()
  const chromePath = process.env.CHROME_PATH || getChromePath()

  console.log(`\n  Chrome : ${chromePath}`)
  console.log(`  Ignore : ${ignoreSet.size} email(s)`)
  console.log(`  Mode   : ${isSearchMode ? "Search → Scrape" : "Direct URL Scrape"}`)

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })

  const results = new Map() // email → { sources: Set, type: string }

  try {
    if (isSearchMode) {
      // ── Search mode: queries.txt → DuckDuckGo → scrape results ──
      const queries = loadQueries()
      console.log(`  Queries: ${queries.length}`)

      for (const query of queries) {
        const urls = await searchForUrls(browser, query)
        for (const url of urls) {
          await crawlDomain(browser, url, ignoreSet, results)
        }
        await sleep(3000) // pause between searches
      }
    } else {
      // ── URL mode: urls.txt → scrape each domain ──
      const urls = loadUrls()
      console.log(`  URLs   : ${urls.length}`)

      for (const url of urls) {
        await crawlDomain(browser, url, ignoreSet, results)
      }
    }
  } finally {
    await browser.close()
  }

  // ── Results summary ──
  if (results.size === 0) {
    console.log("\n  No emails found.")
    return
  }

  const hrCount = [...results.values()].filter((r) => r.type === "HR/Decision-Maker").length
  const outFile = exportCsv(results)

  console.log("\n╔══════════════════════════════════════╗")
  console.log(`║  Total emails : ${String(results.size).padEnd(20)}║`)
  console.log(`║  HR/Key       : ${String(hrCount).padEnd(20)}║`)
  console.log(`║  General      : ${String(results.size - hrCount).padEnd(20)}║`)
  console.log("╚══════════════════════════════════════╝")
  console.log(`\n  Saved → ${outFile}`)
}

main().catch((err) => {
  console.error("\nFatal error:", err.message)
  process.exit(1)
})

# Email Scraper

Two tools in one repo:
1. **Chrome Extension** — manual, page-by-page scraping via browser popup
2. **Auto Scraper** — fully automated, headless Puppeteer script (just run one command)

---

## Auto Scraper (Automated)

### Setup (one time)

```bash
cd chrome-ext
npm install
```

### Mode 1: Scrape from URL list

1. Add company websites to `urls.txt` (one per line):
   ```
   https://www.infosys.com
   https://www.wipro.com
   https://www.tcs.com
   ```

2. Run:
   ```bash
   npm run scrape
   ```

3. Done. CSV saved to `output/emails-YYYY-MM-DD.csv`

For each URL, it auto-crawls subpages: `/contact`, `/about`, `/team`, `/careers`, `/about-us`, `/contact-us`, `/people`, `/our-team`, `/leadership`

### Mode 2: Search + Scrape

1. Add search queries to `queries.txt` (one per line):
   ```
   HR manager contact email IT companies India
   human resources head email startups Noida
   ```

2. Run:
   ```bash
   npm run scrape:search
   ```

   This searches DuckDuckGo for each query, collects result URLs, then scrapes each domain.

### Mode 3: Pass URLs directly

```bash
node auto-scrape.mjs https://example.com https://other.com
```

### Ignore list

Add emails to `ignore.txt` (one per line) to exclude them from results:
```
ashish.rai@appinventiv.com
noreply@example.com
```

### Output

CSV with columns: `email`, `type`, `source_urls`

- **HR/Decision-Maker** — emails matching hr@, careers@, hiring@, talent@, ceo@, founder@, admin@, contact@, etc.
- **General** — all other emails

HR emails are sorted first in the output.

### Config

Edit the `CONFIG` object at the top of `auto-scrape.mjs` to change:
- `subpages` — which subpages to crawl per domain
- `delayBetweenPages` — delay between requests (default 2s)
- `maxPagesPerDomain` — max pages per domain (default 10)
- `maxSearchResults` — max URLs per search query (default 20)
- `junkPatterns` — auto-skip junk emails (noreply, test, etc.)
- `hrPatterns` — patterns to classify as HR/Decision-Maker

---

## Chrome Extension (Manual)

### Install

1. Open Chrome → `chrome://extensions/`
2. Turn **Developer mode** on (top right)
3. Click **Load unpacked** and select the `chrome-ext` folder
4. Pin the extension from the puzzle menu

### How to use

1. **Ignore list** — Add emails to exclude from results
2. **Scrape this page** — Click extension → Find emails on this page
3. **Add to collection** — Merge results into saved list (deduped)
4. **Export** — Export this page or full collection as CSV
5. **Clear** — Wipe the collection

---

## Project layout

```
chrome-ext/
├── auto-scrape.mjs   # Automated Puppeteer scraper
├── urls.txt           # Input: company URLs (one per line)
├── queries.txt        # Input: search queries (for --search mode)
├── ignore.txt         # Emails to exclude
├── output/            # CSV output files
├── package.json       # Node dependencies
├── manifest.json      # Chrome extension manifest V3
├── popup.html         # Extension popup UI
├── popup.css          # Extension styles
├── popup.js           # Extension logic
├── content.js         # Extension content script
├── background.js      # Extension background worker
└── README.md          # This file
```

---

## Legal / responsible use

Use only on publicly accessible pages. Don't bypass login or scrape behind auth. Respect privacy and anti-spam laws (GDPR, CAN-SPAM). You are responsible for how you use the data.

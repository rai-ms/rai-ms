const STORAGE_KEY = 'ignoreList';
const COLLECTION_KEY = 'collectedEmails';
const DEFAULT_IGNORE = ['ashish.rai@appinventiv.com'];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const SUBPAGES = ['/contact', '/contact-us', '/about', '/about-us', '/team', '/careers'];

const JUNK_PATTERNS = [
  /noreply@/i, /no-reply@/i, /donotreply@/i, /mailer-daemon@/i,
  /postmaster@/i, /^test@/i, /example\.com$/i, /sentry\.io$/i,
  /wixpress\.com$/i, /\.png$/i, /\.jpg$/i, /\.gif$/i, /\.svg$/i,
];

const HR_PATTERNS = [
  /^hr@/i, /^hr\./i, /^careers@/i, /^hiring@/i, /^recruit/i,
  /^people@/i, /^talent/i, /^jobs@/i, /^humanresource/i,
  /^admin@/i, /^ceo@/i, /^coo@/i, /^founder@/i, /^director@/i,
  /^management@/i, /^contact@/i, /^info@/i,
];

const SKIP_DOMAINS = [
  'duckduckgo.com', 'google.com', 'bing.com', 'linkedin.com',
  'facebook.com', 'youtube.com', 'twitter.com', 'x.com',
  'wikipedia.org', 'reddit.com', 'instagram.com',
];

// ─── Region & Industry targeting data ───
const REGIONS = {
  uae: {
    name: 'UAE',
    cities: ['Dubai', 'Abu Dhabi'],
    queryHints: ['UAE', 'Dubai', 'Abu Dhabi', 'DIFC', 'free zone'],
  },
  saudi: {
    name: 'Saudi Arabia',
    cities: ['Riyadh', 'Jeddah', 'NEOM'],
    queryHints: ['Saudi Arabia', 'Riyadh', 'Jeddah', 'Vision 2030'],
  },
  singapore: {
    name: 'Singapore',
    cities: ['Singapore'],
    queryHints: ['Singapore'],
  },
  usa: {
    name: 'USA',
    cities: ['San Francisco', 'New York', 'Austin', 'Seattle', 'Boston'],
    queryHints: ['USA', 'Silicon Valley', 'New York', 'Austin Texas'],
  },
  uk: {
    name: 'UK',
    cities: ['London', 'Manchester', 'Edinburgh'],
    queryHints: ['UK', 'London', 'United Kingdom'],
  },
  canada: {
    name: 'Canada',
    cities: ['Toronto', 'Vancouver', 'Montreal'],
    queryHints: ['Canada', 'Toronto', 'Vancouver'],
  },
  australia: {
    name: 'Australia',
    cities: ['Sydney', 'Melbourne', 'Brisbane'],
    queryHints: ['Australia', 'Sydney', 'Melbourne'],
  },
  germany: {
    name: 'Germany',
    cities: ['Berlin', 'Munich', 'Frankfurt'],
    queryHints: ['Germany', 'Berlin', 'Munich'],
  },
  qatar: {
    name: 'Qatar',
    cities: ['Doha'],
    queryHints: ['Qatar', 'Doha'],
  },
  netherlands: {
    name: 'Netherlands',
    cities: ['Amsterdam', 'Rotterdam'],
    queryHints: ['Netherlands', 'Amsterdam'],
  },
  ireland: {
    name: 'Ireland',
    cities: ['Dublin'],
    queryHints: ['Ireland', 'Dublin'],
  },
  israel: {
    name: 'Israel',
    cities: ['Tel Aviv', 'Jerusalem'],
    queryHints: ['Israel', 'Tel Aviv'],
  },
};

const INDUSTRIES = {
  tech: {
    name: 'IT / SaaS',
    terms: ['software company', 'SaaS company', 'IT company', 'tech startup', 'technology company'],
  },
  fintech: {
    name: 'Fintech',
    terms: ['fintech company', 'financial technology', 'payment company', 'banking startup'],
  },
  ecommerce: {
    name: 'E-Commerce',
    terms: ['ecommerce company', 'online retail', 'D2C brand', 'marketplace startup'],
  },
  healthcare: {
    name: 'Healthcare',
    terms: ['healthtech company', 'healthcare startup', 'medtech company', 'digital health'],
  },
  consulting: {
    name: 'Consulting',
    terms: ['consulting firm', 'management consulting', 'advisory firm', 'professional services'],
  },
  manufacturing: {
    name: 'Manufacturing',
    terms: ['manufacturing company', 'industrial company', 'factory automation', 'production company'],
  },
};

// Tested query templates that return 10+ domains on DuckDuckGo
// Pattern: short, punchy, 6-8 words. Always end with "email" or "email list"
// AVOID: "with contact", "list of", "in {location}" — these return 0
const QUERY_TEMPLATES = [
  '{industry} companies {location} email contact list',
  '{industry} companies {location} email directory',
  '{industry} startups {location} HR email',
  'top {industry} companies {location} email',
  '{location} {industry} companies email address list',
  '{industry} companies {location} HR manager email',
  'startup {industry} companies {location} email list',
  '{location} {industry} company directory email',
];

function generateSmartQueries(selectedRegions, selectedIndustries) {
  const queries = [];

  if (selectedRegions.length === 0 && selectedIndustries.length === 0) return [];

  // Use broader industry terms for better DDG results
  const INDUSTRY_SHORT = {
    tech: ['IT', 'software', 'tech', 'SaaS'],
    fintech: ['fintech', 'financial technology', 'payment'],
    ecommerce: ['ecommerce', 'online retail', 'D2C'],
    healthcare: ['healthtech', 'healthcare', 'medtech'],
    consulting: ['consulting', 'advisory', 'professional services'],
    manufacturing: ['manufacturing', 'industrial', 'production'],
  };

  for (const regionKey of selectedRegions) {
    const region = REGIONS[regionKey];
    if (!region) continue;

    // Use main city (best DDG results)
    const loc = region.cities[0];

    if (selectedIndustries.length === 0) {
      // Region only — broad company queries (tested patterns)
      queries.push('top companies ' + loc + ' email contact list');
      queries.push(loc + ' companies email directory HR');
      queries.push('startup companies ' + loc + ' email address list');
      queries.push(region.name + ' companies HR manager email');
    } else {
      for (const industryKey of selectedIndustries) {
        const terms = INDUSTRY_SHORT[industryKey] || [industryKey];
        // Pick 3 random templates — use shortest industry term
        const shuffled = [...QUERY_TEMPLATES].sort(() => Math.random() - 0.5);
        for (const tmpl of shuffled.slice(0, 3)) {
          queries.push(tmpl.replace('{industry}', terms[0]).replace('{location}', loc));
        }
        // One query with country name too
        queries.push(terms[0] + ' companies ' + region.name + ' HR email');
      }
    }
  }

  // Industries only (no region) — global queries
  if (selectedRegions.length === 0 && selectedIndustries.length > 0) {
    for (const industryKey of selectedIndustries) {
      const terms = INDUSTRY_SHORT[industryKey] || [industryKey];
      queries.push(terms[0] + ' companies email contact list directory');
      queries.push('top ' + terms[0] + ' companies HR manager email');
      queries.push(terms[0] + ' startups email directory HR');
    }
  }

  // Dedupe and limit (too many = slow, 15 queries is sweet spot)
  return [...new Set(queries)].slice(0, 15);
}

// ─── AI Email Scorer (rule-based + domain intelligence) ───
// Instant scoring without LLM — uses domain reputation, role patterns, and heuristics
const PREMIUM_DOMAINS = [
  // Big tech regions (high-value HRMS targets)
  '.ae', '.sa', '.sg', '.uk', '.de', '.nl', '.ie', '.il', '.au', '.ca', '.qa',
  '.ch', '.se', '.no', '.dk', '.fi', '.nz', '.jp', '.kr', '.hk',
];

const COMPANY_SIZE_SIGNALS = [
  // These domain keywords suggest mid-large companies (HRMS sweet spot)
  /group\./i, /global\./i, /holding/i, /enterprise/i, /solutions\./i,
  /tech\./i, /digital\./i, /systems\./i, /services\./i,
];

function scoreEmail(email) {
  const [local, domain] = email.toLowerCase().split('@');
  if (!domain) return { score: 0, role: 'Invalid', tags: [] };

  let score = 3; // base score
  const tags = [];
  let role = 'Unknown';

  // ── Role-based scoring ──
  if (/^(hr|human\.?resources?)/.test(local)) { score += 4; role = 'HR Manager'; tags.push('HR Direct'); }
  else if (/^(people|people\.?ops)/.test(local)) { score += 4; role = 'People Ops'; tags.push('People Team'); }
  else if (/^(talent|recruit|hiring|careers|jobs)/.test(local)) { score += 3; role = 'Talent/Recruiting'; tags.push('Recruiting'); }
  else if (/^(ceo|founder|coo|cto|md|director|vp|head)/.test(local)) { score += 3; role = 'C-Suite/Leadership'; tags.push('Decision Maker'); }
  else if (/^(admin|management|office)/.test(local)) { score += 2; role = 'Admin/Management'; tags.push('Admin'); }
  else if (/^(contact|info|hello|enquir)/.test(local)) { score += 1; role = 'General Contact'; tags.push('Generic'); }
  else if (/^(support|help|service|billing|sales|marketing)/.test(local)) { score += 0; role = 'Support/Sales'; tags.push('Low Priority'); }
  else if (/^[a-z]+\.[a-z]+$/.test(local)) { score += 2; role = 'Named Person'; tags.push('Personal Email'); }
  else { role = 'General'; }

  // ── Domain quality scoring ──
  const tld = '.' + domain.split('.').pop();

  // Premium country domains (rich markets)
  if (PREMIUM_DOMAINS.some(d => domain.endsWith(d))) { score += 1; tags.push('Premium Market'); }

  // Custom domain (not free email) = likely a company
  const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'mail.com', 'protonmail.com', 'icloud.com'];
  if (freeProviders.includes(domain)) { score -= 2; tags.push('Free Email'); }
  else { score += 1; tags.push('Company Domain'); }

  // Company size signals in domain
  if (COMPANY_SIZE_SIGNALS.some(p => p.test(domain))) { score += 1; tags.push('Mid-Large Company'); }

  // Cap score 1-10
  score = Math.max(1, Math.min(10, score));

  return { score, role, tags, domain };
}

// ─── Ollama AI integration (optional enhancement) ───
const OLLAMA_URL = 'http://localhost:11434';

async function isOllamaRunning() {
  try {
    const resp = await fetch(OLLAMA_URL + '/api/tags', { signal: AbortSignal.timeout(2000) });
    return resp.ok;
  } catch { return false; }
}

async function aiGenerateQueries(regions, industries, targetDescription) {
  try {
    const resp = await fetch(OLLAMA_URL + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:4b',
        prompt: '/nothink\nGenerate 8 DuckDuckGo search queries to find HR manager emails at ' +
          industries.join(', ') + ' companies in ' + regions.join(', ') +
          '. Target: ' + (targetDescription || 'companies with 50-500 employees that need HRMS software') +
          '\nReply with ONLY the queries, one per line. No numbering, no explanation.',
        stream: false,
        options: { num_predict: 300, temperature: 0.7 }
      })
    });
    const data = await resp.json();
    let text = data.response || '';
    // Strip think tags if present
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return text.split('\n').map(q => q.trim()).filter(q => q.length > 10);
  } catch {
    return [];
  }
}

function isJunkEmail(email) {
  return JUNK_PATTERNS.some(p => p.test(email));
}

function classifyEmail(email) {
  const result = scoreEmail(email);
  return result.score >= 6 ? 'HR' : 'General';
}

(function () {
  let lastEmails = [];
  let autoEmails = new Map(); // email → { sources: Set, type: string }
  let stopRequested = false;

  // ─── DOM refs: shared ───
  const collectionCount = document.getElementById('collectionCount');
  const addFeedback = document.getElementById('addFeedback');
  const exportCollectionBtn = document.getElementById('exportCollectionBtn');
  const clearCollectionBtn = document.getElementById('clearCollectionBtn');

  // ─── DOM refs: manual tab ───
  const scrapeBtn = document.getElementById('scrapeBtn');
  const resultsSection = document.getElementById('resultsSection');
  const resultsCount = document.getElementById('resultsCount');
  const resultsList = document.getElementById('resultsList');
  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  const errorMessage = document.getElementById('errorMessage');
  const addToCollectionBtn = document.getElementById('addToCollectionBtn');
  const exportPageBtn = document.getElementById('exportPageBtn');
  const ignoreInput = document.getElementById('ignoreInput');
  const ignoreAddBtn = document.getElementById('ignoreAddBtn');
  const ignoreListEl = document.getElementById('ignoreList');

  // ─── DOM refs: auto tab ───
  const urlsInput = document.getElementById('urlsInput');
  const queriesInput = document.getElementById('queriesInput');
  const crawlSubpages = document.getElementById('crawlSubpages');
  const autoScrapeBtn = document.getElementById('autoScrapeBtn');
  const autoStopBtn = document.getElementById('autoStopBtn');
  const autoProgress = document.getElementById('autoProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const progressFound = document.getElementById('progressFound');
  const progressLog = document.getElementById('progressLog');
  const autoResults = document.getElementById('autoResults');
  const autoResultsCount = document.getElementById('autoResultsCount');
  const autoResultsList = document.getElementById('autoResultsList');
  const autoAddBtn = document.getElementById('autoAddBtn');
  const autoExportBtn = document.getElementById('autoExportBtn');

  // ═══════════════════════════════════════════════════════
  // TAB SWITCHING
  // ═══════════════════════════════════════════════════════
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.hidden = true);
      const target = tab.dataset.tab === 'manual' ? 'manualTab' : 'autoTab';
      document.getElementById(target).hidden = false;
    });
  });

  // Mode switching (URLs / Search)
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isSearch = btn.dataset.mode === 'search';
      document.getElementById('urlsMode').hidden = isSearch;
      document.getElementById('searchMode').hidden = !isSearch;
    });
  });

  // ═══════════════════════════════════════════════════════
  // REGION & INDUSTRY CHIP SELECTION
  // ═══════════════════════════════════════════════════════
  document.querySelectorAll('#regionChips .chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });

  document.querySelectorAll('#industryChips .chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });

  document.getElementById('generateQueriesBtn').addEventListener('click', () => {
    const selectedRegions = [...document.querySelectorAll('#regionChips .chip.selected')].map(c => c.dataset.region);
    const selectedIndustries = [...document.querySelectorAll('#industryChips .chip.selected')].map(c => c.dataset.industry);

    if (selectedRegions.length === 0 && selectedIndustries.length === 0) {
      queriesInput.placeholder = 'Select at least one region or industry above first!';
      return;
    }

    const queries = generateSmartQueries(selectedRegions, selectedIndustries);
    const existing = queriesInput.value.trim();
    queriesInput.value = existing ? existing + '\n' + queries.join('\n') : queries.join('\n');
  });

  document.getElementById('clearQueriesBtn').addEventListener('click', () => {
    queriesInput.value = '';
    document.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
  });

  // ═══════════════════════════════════════════════════════
  // SHARED HELPERS
  // ═══════════════════════════════════════════════════════
  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function downloadCsv(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function updateCollectionCount() {
    chrome.storage.local.get({ [COLLECTION_KEY]: [] }, (result) => {
      const list = result[COLLECTION_KEY] || [];
      collectionCount.textContent = list.length + ' email' + (list.length !== 1 ? 's' : '') + ' in collection';
    });
  }

  function showAddFeedback(msg, isError) {
    addFeedback.textContent = msg;
    addFeedback.style.color = isError ? '#dc2626' : '#16a34a';
    addFeedback.hidden = false;
    setTimeout(() => { addFeedback.hidden = true; }, 4000);
  }

  function addEmailsToCollection(emails) {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [COLLECTION_KEY]: [] }, (result) => {
        const existing = Array.isArray(result[COLLECTION_KEY]) ? result[COLLECTION_KEY] : [];
        const existingSet = new Set(existing.map(e => String(e).toLowerCase()));
        let added = 0;
        emails.forEach(email => {
          const key = String(email).toLowerCase();
          if (!existingSet.has(key)) {
            existingSet.add(key);
            existing.push(email);
            added++;
          }
        });
        chrome.storage.local.set({ [COLLECTION_KEY]: existing }, () => {
          updateCollectionCount();
          const already = emails.length - added;
          const msg = added > 0
            ? 'Added ' + added + ' new' + (already > 0 ? ' (' + already + ' already)' : '') + '.'
            : 'All ' + emails.length + ' already in collection.';
          showAddFeedback(msg, false);
          resolve(added);
        });
      });
    });
  }

  // ═══════════════════════════════════════════════════════
  // MANUAL TAB (existing logic)
  // ═══════════════════════════════════════════════════════
  function showError(msg) {
    errorMessage.textContent = msg;
    errorState.hidden = false;
    resultsSection.hidden = true;
    emptyState.hidden = true;
  }

  function hideError() {
    errorState.hidden = true;
  }

  function renderResults(emails) {
    lastEmails = emails || [];
    hideError();
    emptyState.hidden = lastEmails.length > 0;
    resultsSection.hidden = lastEmails.length === 0;
    if (lastEmails.length === 0) { resultsList.innerHTML = ''; return; }
    resultsCount.textContent = lastEmails.length + ' email' + (lastEmails.length !== 1 ? 's' : '');
    resultsList.innerHTML = lastEmails.map(email =>
      '<div class="email-row">' + escapeHtml(email) + '</div>'
    ).join('');
  }

  scrapeBtn.addEventListener('click', async () => {
    scrapeBtn.disabled = true;
    scrapeBtn.textContent = 'Scanning\u2026';
    hideError();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) { showError('No active tab.'); scrapeBtn.disabled = false; scrapeBtn.textContent = 'Find emails on this page'; return; }
      let response = null;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PAGE' });
      } catch (_) {
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
          response = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PAGE' });
        } catch (_2) {
          response = await runScrapeInPage(tab.id);
        }
      }
      if (response?.success) { renderResults(response.data); }
      else { showError(response?.error || 'Could not read this page.'); }
    } catch (e) {
      showError('Could not read this page. Try refreshing.');
    }
    scrapeBtn.disabled = false;
    scrapeBtn.textContent = 'Find emails on this page';
  });

  function runScrapeInPage(tabId) {
    return new Promise((resolve) => {
      chrome.storage.local.get({ ignoreList: DEFAULT_IGNORE }, (storageResult) => {
        const ignoreList = storageResult.ignoreList || [];
        const ignoreSet = new Set(ignoreList.map(e => String(e).toLowerCase()));
        chrome.scripting.executeScript({
          target: { tabId },
          func: (ignoreKeys) => {
            const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const ignoreSet = new Set(ignoreKeys);
            const out = [];
            document.querySelectorAll('a[href^="mailto:"]').forEach(function(a) {
              const href = (a.getAttribute('href') || '').replace(/^mailto:/i, '').split(/[?,&]/)[0].trim();
              const m = href.match(EMAIL_REGEX);
              const email = m ? m[0] : (href.indexOf('@') >= 0 ? href : null);
              if (email && !ignoreSet.has(email.toLowerCase())) out.push(email);
            });
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
              acceptNode: function(node) {
                const t = node.textContent || '';
                return (t.indexOf('@') >= 0 && t.length <= 500) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
              }
            });
            const seen = new Set(out.map(e => e.toLowerCase()));
            let n;
            while ((n = walker.nextNode())) {
              const matches = (n.textContent || '').match(EMAIL_REGEX) || [];
              matches.forEach(function(email) {
                const k = email.toLowerCase();
                if (!seen.has(k) && !ignoreSet.has(k)) { seen.add(k); out.push(email); }
              });
            }
            return out;
          },
          args: [Array.from(ignoreSet)]
        }, (result) => {
          if (chrome.runtime.lastError || !result?.[0]?.result) {
            resolve({ success: false, error: chrome.runtime.lastError?.message || 'Script failed' });
            return;
          }
          resolve({ success: true, data: result[0].result });
        });
      });
    });
  }

  addToCollectionBtn.addEventListener('click', () => {
    if (lastEmails.length === 0) { showAddFeedback('No emails to add.', true); return; }
    addToCollectionBtn.disabled = true;
    addEmailsToCollection(lastEmails).then(() => { addToCollectionBtn.disabled = false; });
  });

  exportPageBtn.addEventListener('click', () => {
    if (lastEmails.length === 0) return;
    const csv = 'email\n' + lastEmails.map(e => '"' + e.replace(/"/g, '""') + '"').join('\n');
    downloadCsv(csv, 'emails-page-' + new Date().toISOString().slice(0, 10) + '.csv');
  });

  // ═══════════════════════════════════════════════════════
  // AUTO SCRAPE TAB
  // ═══════════════════════════════════════════════════════

  function log(msg, cls) {
    const span = document.createElement('span');
    span.className = 'log-line' + (cls ? ' ' + cls : '');
    span.textContent = msg;
    progressLog.appendChild(span);
    progressLog.scrollTop = progressLog.scrollHeight;
  }

  function updateProgress(current, total, found) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    progressFill.style.width = pct + '%';
    progressText.textContent = current + ' / ' + total + ' pages';
    progressFound.textContent = found + ' emails';
  }

  async function getIgnoreSet() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_IGNORE }, (result) => {
        resolve(new Set((result[STORAGE_KEY] || []).map(e => e.toLowerCase())));
      });
    });
  }

  function extractEmailsFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const emails = new Set();

    // mailto links
    doc.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      const href = (a.getAttribute('href') || '').replace(/^mailto:/i, '').split(/[?,&]/)[0].trim();
      const match = href.match(EMAIL_REGEX);
      if (match) emails.add(match[0].toLowerCase());
    });

    // text content
    const text = doc.body?.textContent || '';
    const matches = text.match(EMAIL_REGEX) || [];
    matches.forEach(e => emails.add(e.toLowerCase()));

    return [...emails];
  }

  async function fetchAndExtract(url, ignoreSet) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'text/html' }
      });
      clearTimeout(timeout);
      if (!resp.ok) return [];
      const html = await resp.text();
      const raw = extractEmailsFromHtml(html);
      return raw.filter(e => !ignoreSet.has(e) && !isJunkEmail(e));
    } catch {
      clearTimeout(timeout);
      return [];
    }
  }

  function normalizeUrl(raw) {
    let url = raw.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    return url;
  }

  async function searchDuckDuckGo(query) {
    log('Searching: "' + query + '"', 'search');
    try {
      // Open DuckDuckGo in a real hidden tab (bypasses bot detection + CORS)
      const searchUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
      const tab = await new Promise((resolve) => {
        chrome.tabs.create({ url: searchUrl, active: false }, resolve);
      });

      // Wait for tab to finish loading
      await new Promise((resolve) => {
        const listener = (tabId, info) => {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        // Timeout safety: resolve after 12s even if not fully loaded
        setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 12000);
      });

      // Inject script to extract links — uses real DOM with resolved URLs
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return [...document.querySelectorAll('a.result__a')].map(a => a.href);
        }
      });

      // Close the search tab
      chrome.tabs.remove(tab.id).catch(() => {});

      const links = results?.[0]?.result || [];

      // Extract real URLs from DDG redirect wrappers
      const urls = [];
      const seenDomains = new Set();
      const skipDomains = ['duckduckgo.com', 'google.com', 'bing.com', 'linkedin.com',
        'facebook.com', 'youtube.com', 'twitter.com', 'x.com',
        'wikipedia.org', 'reddit.com', 'instagram.com'];

      for (const link of links) {
        let href = link;
        try {
          const u = new URL(href);
          const uddg = u.searchParams.get('uddg');
          if (uddg) href = decodeURIComponent(uddg);
        } catch {}

        try {
          const domain = new URL(href).hostname.replace(/^www\./, '');
          if (!seenDomains.has(domain) && !skipDomains.some(s => domain.includes(s))) {
            seenDomains.add(domain);
            urls.push(href);
          }
        } catch {}
      }

      log('  Found ' + urls.length + ' domains', 'info');
      return urls.slice(0, 15);
    } catch (err) {
      log('  Search failed: ' + err.message, 'fail');
      return [];
    }
  }

  async function runAutoScrape() {
    stopRequested = false;
    autoEmails = new Map();
    autoResults.hidden = true;
    autoProgress.hidden = false;
    progressLog.innerHTML = '';
    autoScrapeBtn.hidden = true;
    autoStopBtn.hidden = false;

    const ignoreSet = await getIgnoreSet();
    const doCrawl = crawlSubpages.checked;
    const isSearchMode = document.querySelector('.mode-btn.active').dataset.mode === 'search';

    let urls = [];

    if (isSearchMode) {
      const queries = queriesInput.value.split('\n').map(q => q.trim()).filter(Boolean);
      if (queries.length === 0) {
        log('No search queries entered.', 'fail');
        finishAutoScrape();
        return;
      }
      log('Starting search mode (' + queries.length + ' queries)', 'info');
      for (const query of queries) {
        if (stopRequested) break;
        const found = await searchDuckDuckGo(query);
        urls.push(...found);
        await new Promise(r => setTimeout(r, 1500));
      }
      // Dedupe by domain
      const seen = new Set();
      urls = urls.filter(u => {
        try {
          const d = new URL(u).hostname;
          if (seen.has(d)) return false;
          seen.add(d);
          return true;
        } catch { return false; }
      });
      log('Total unique domains: ' + urls.length, 'info');
    } else {
      urls = urlsInput.value.split('\n').map(u => u.trim()).filter(u => u && !u.startsWith('#'));
      if (urls.length === 0) {
        log('No URLs entered.', 'fail');
        finishAutoScrape();
        return;
      }
      log('Starting URL mode (' + urls.length + ' sites)', 'info');
    }

    const totalPages = urls.length * (doCrawl ? (1 + SUBPAGES.length) : 1);
    let currentPage = 0;
    updateProgress(0, totalPages, 0);

    for (const baseUrl of urls) {
      if (stopRequested) break;

      const normalized = normalizeUrl(baseUrl);
      let origin;
      try { origin = new URL(normalized).origin; } catch { continue; }

      const pagesToVisit = [normalized];
      if (doCrawl) SUBPAGES.forEach(sub => pagesToVisit.push(origin + sub));

      log(origin, 'info');

      // Scrape in parallel batches of 3
      const BATCH = 3;
      for (let i = 0; i < pagesToVisit.length; i += BATCH) {
        if (stopRequested) break;
        const batch = pagesToVisit.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (url) => {
          const emails = await fetchAndExtract(url, ignoreSet);
          currentPage++;
          return { url, emails };
        }));

        results.forEach(({ url, emails }) => {
          let found = 0;
          emails.forEach(email => {
            if (!autoEmails.has(email)) {
              autoEmails.set(email, { sources: new Set(), type: classifyEmail(email) });
            }
            autoEmails.get(email).sources.add(url);
            found++;
          });
          if (found > 0) {
            const short = url.replace(origin, '');
            log('  \u2713 ' + (short || '/') + ' \u2192 ' + found, 'success');
          }
        });

        updateProgress(currentPage, totalPages, autoEmails.size);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    finishAutoScrape();
  }

  function finishAutoScrape() {
    autoScrapeBtn.hidden = false;
    autoStopBtn.hidden = true;

    if (autoEmails.size === 0) {
      log('\nNo emails found.', 'fail');
      updateProgress(0, 0, 0);
      return;
    }

    // AI Score every email
    const scored = [...autoEmails.entries()].map(([email, data]) => {
      const ai = scoreEmail(email);
      return { email, ...data, score: ai.score, role: ai.role, tags: ai.tags };
    });

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score || a.email.localeCompare(b.email));

    const hotLeads = scored.filter(e => e.score >= 7).length;
    const warmLeads = scored.filter(e => e.score >= 4 && e.score < 7).length;
    const coldLeads = scored.filter(e => e.score < 4).length;

    log('\nDone! AI scored ' + scored.length + ' emails', 'success');
    log('  🔥 Hot leads (7-10): ' + hotLeads, 'success');
    log('  🟡 Warm leads (4-6): ' + warmLeads, 'info');
    log('  ⚪ Cold leads (1-3): ' + coldLeads, '');

    // Show results
    autoResults.hidden = false;
    autoResultsCount.textContent = scored.length + ' emails (' + hotLeads + ' hot, ' + warmLeads + ' warm)';

    autoResultsList.innerHTML = scored.slice(0, 200).map(item => {
      const scoreClass = item.score >= 7 ? 'hot' : item.score >= 4 ? 'warm' : 'cold';
      return '<div class="email-row">' +
        '<div style="flex:1;min-width:0">' +
          '<span style="word-break:break-all">' + escapeHtml(item.email) + '</span>' +
          '<div style="font-size:10px;color:#94a3b8;margin-top:1px">' + escapeHtml(item.role) + ' · ' + item.tags.slice(0, 2).join(', ') + '</div>' +
        '</div>' +
        '<span class="email-score ' + scoreClass + '">' + item.score + '/10</span>' +
        '</div>';
    }).join('');

    if (scored.length > 200) {
      autoResultsList.innerHTML += '<div class="email-row" style="color:#94a3b8;text-align:center">+' + (scored.length - 200) + ' more (export CSV to see all)</div>';
    }

    // Store scored data for export
    autoEmails._scored = scored;
  }

  autoScrapeBtn.addEventListener('click', runAutoScrape);

  autoStopBtn.addEventListener('click', () => {
    stopRequested = true;
    autoStopBtn.textContent = 'Stopping\u2026';
    autoStopBtn.disabled = true;
    setTimeout(() => {
      autoStopBtn.textContent = 'Stop';
      autoStopBtn.disabled = false;
    }, 2000);
  });

  autoAddBtn.addEventListener('click', () => {
    if (autoEmails.size === 0) return;
    autoAddBtn.disabled = true;
    addEmailsToCollection([...autoEmails.keys()]).then(() => { autoAddBtn.disabled = false; });
  });

  autoExportBtn.addEventListener('click', () => {
    if (autoEmails.size === 0) return;
    const sorted = [...autoEmails.entries()].sort((a, b) => {
      if (a[1].type === 'HR' && b[1].type !== 'HR') return -1;
      if (a[1].type !== 'HR' && b[1].type === 'HR') return 1;
      return a[0].localeCompare(b[0]);
    });
    const rows = ['email,type,source_urls'];
    sorted.forEach(([email, data]) => {
      rows.push('"' + email + '","' + data.type + '","' + [...data.sources].join(' | ') + '"');
    });
    downloadCsv(rows.join('\n'), 'emails-auto-' + new Date().toISOString().slice(0, 10) + '.csv');
  });

  // ═══════════════════════════════════════════════════════
  // IGNORE LIST (shared)
  // ═══════════════════════════════════════════════════════
  function loadIgnoreList() {
    chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_IGNORE }, (result) => {
      const list = result[STORAGE_KEY] || [];
      ignoreListEl.innerHTML = list.map(email =>
        '<li><span class="ignore-email">' + escapeHtml(email) + '</span> <button type="button" class="ignore-remove" data-email="' + escapeHtml(email) + '">Remove</button></li>'
      ).join('');
      ignoreListEl.querySelectorAll('.ignore-remove').forEach(btn => {
        btn.addEventListener('click', () => removeFromIgnoreList(btn.getAttribute('data-email')));
      });
    });
  }

  function addToIgnoreList(email) {
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;
    chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_IGNORE }, (result) => {
      const list = result[STORAGE_KEY] || [];
      if (list.map(e => e.toLowerCase()).includes(trimmed)) return;
      list.push(trimmed);
      chrome.storage.local.set({ [STORAGE_KEY]: list }, loadIgnoreList);
    });
    ignoreInput.value = '';
  }

  function removeFromIgnoreList(email) {
    const key = (email || '').toLowerCase();
    chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_IGNORE }, (result) => {
      const list = (result[STORAGE_KEY] || []).filter(e => e.toLowerCase() !== key);
      chrome.storage.local.set({ [STORAGE_KEY]: list }, loadIgnoreList);
    });
  }

  // ═══════════════════════════════════════════════════════
  // COLLECTION (shared)
  // ═══════════════════════════════════════════════════════
  exportCollectionBtn.addEventListener('click', () => {
    chrome.storage.local.get({ [COLLECTION_KEY]: [] }, (result) => {
      const list = result[COLLECTION_KEY] || [];
      if (list.length === 0) return;
      const csv = 'email\n' + list.map(e => '"' + e.replace(/"/g, '""') + '"').join('\n');
      downloadCsv(csv, 'emails-collection-' + new Date().toISOString().slice(0, 10) + '.csv');
    });
  });

  clearCollectionBtn.addEventListener('click', () => {
    if (!confirm('Clear entire collection?')) return;
    chrome.storage.local.set({ [COLLECTION_KEY]: [] }, updateCollectionCount);
  });

  // ─── Init ───
  loadIgnoreList();
  updateCollectionCount();
  ignoreAddBtn.addEventListener('click', () => addToIgnoreList(ignoreInput.value));
  ignoreInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addToIgnoreList(ignoreInput.value); });
})();

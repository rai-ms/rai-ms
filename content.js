/**
 * Content script: finds visible emails on the page only.
 * Ignore list is read from chrome.storage at runtime.
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const DEFAULT_IGNORE = ['ashish.rai@appinventiv.com'];

function extractFromMailto() {
  const emails = [];
  const links = document.querySelectorAll('a[href^="mailto:"]');
  links.forEach(a => {
    const href = (a.getAttribute('href') || '').replace(/^mailto:/i, '').split(/[?,&]/)[0].trim();
    const match = href.match(EMAIL_REGEX);
    const email = match ? match[0] : (href.includes('@') ? href : null);
    if (email) emails.push(email);
  });
  return emails;
}

function extractFromText() {
  const seen = new Set();
  const emails = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = node.textContent || '';
        if (!text.includes('@') || text.length > 500) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  let n;
  while ((n = walker.nextNode())) {
    const matches = (n.textContent || '').match(EMAIL_REGEX) || [];
    matches.forEach(email => {
      const key = email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        emails.push(email);
      }
    });
  }
  return emails;
}

function scrapePage(ignoreSet) {
  const mailto = extractFromMailto();
  const text = extractFromText();
  const seen = new Set();
  const result = [];
  [...mailto, ...text].forEach(email => {
    const key = email.toLowerCase();
    if (ignoreSet.has(key) || seen.has(key)) return;
    seen.add(key);
    result.push(email);
  });
  return result;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SCRAPE_PAGE') {
    chrome.storage.local.get({ ignoreList: DEFAULT_IGNORE }, (result) => {
      try {
        const ignoreSet = new Set((result.ignoreList || []).map(e => e.toLowerCase()));
        const emails = scrapePage(ignoreSet);
        sendResponse({ success: true, data: emails });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    });
    return true;
  }
});

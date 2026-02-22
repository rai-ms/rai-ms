const STORAGE_KEY = 'ignoreList';
const COLLECTION_KEY = 'collectedEmails';
const DEFAULT_IGNORE = ['ashish.rai@appinventiv.com'];

(function () {
  let lastEmails = [];

  const scrapeBtn = document.getElementById('scrapeBtn');
  const resultsSection = document.getElementById('resultsSection');
  const resultsCount = document.getElementById('resultsCount');
  const resultsList = document.getElementById('resultsList');
  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  const errorMessage = document.getElementById('errorMessage');
  const addToCollectionBtn = document.getElementById('addToCollectionBtn');
  const exportPageBtn = document.getElementById('exportPageBtn');
  const exportCollectionBtn = document.getElementById('exportCollectionBtn');
  const clearCollectionBtn = document.getElementById('clearCollectionBtn');
  const collectionCount = document.getElementById('collectionCount');
  const addFeedback = document.getElementById('addFeedback');
  const ignoreInput = document.getElementById('ignoreInput');
  const ignoreAddBtn = document.getElementById('ignoreAddBtn');
  const ignoreListEl = document.getElementById('ignoreList');

  function showError(msg) {
    errorMessage.textContent = msg;
    errorState.hidden = false;
    resultsSection.hidden = true;
    emptyState.hidden = true;
  }

  function hideError() {
    errorState.hidden = true;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderResults(emails) {
    lastEmails = emails || [];
    hideError();
    emptyState.hidden = lastEmails.length > 0;
    resultsSection.hidden = lastEmails.length === 0;

    if (lastEmails.length === 0) {
      resultsList.innerHTML = '';
      return;
    }

    resultsCount.textContent = lastEmails.length + ' email' + (lastEmails.length !== 1 ? 's' : '');
    resultsList.innerHTML = lastEmails.map(email =>
      '<div class="email-row">' + escapeHtml(email) + '</div>'
    ).join('');
  }

  function exportPageCsv() {
    if (lastEmails.length === 0) return;
    const csv = 'email\n' + lastEmails.map(e => '"' + e.replace(/"/g, '""') + '"').join('\n');
    downloadCsv(csv, 'emails-page-' + new Date().toISOString().slice(0, 10) + '.csv');
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

  function addToCollection() {
    if (lastEmails.length === 0) return;
    chrome.storage.local.get({ [COLLECTION_KEY]: [] }, (result) => {
      const existing = result[COLLECTION_KEY] || [];
      const existingSet = new Set(existing.map(e => e.toLowerCase()));
      let added = 0;
      lastEmails.forEach(email => {
        const key = email.toLowerCase();
        if (!existingSet.has(key)) {
          existingSet.add(key);
          existing.push(email);
          added++;
        }
      });
      chrome.storage.local.set({ [COLLECTION_KEY]: existing }, () => {
        updateCollectionCount();
        const already = lastEmails.length - added;
        addFeedback.textContent = added > 0
          ? 'Added ' + added + ' new' + (already > 0 ? ' (' + already + ' already in collection)' : '') + '.'
          : 'All ' + lastEmails.length + ' already in collection.';
        addFeedback.hidden = false;
        setTimeout(() => { addFeedback.hidden = true; }, 3000);
      });
    });
  }

  function exportCollectionCsv() {
    chrome.storage.local.get({ [COLLECTION_KEY]: [] }, (result) => {
      const list = result[COLLECTION_KEY] || [];
      if (list.length === 0) return;
      const csv = 'email\n' + list.map(e => '"' + e.replace(/"/g, '""') + '"').join('\n');
      downloadCsv(csv, 'emails-collection-' + new Date().toISOString().slice(0, 10) + '.csv');
    });
  }

  function clearCollection() {
    if (!confirm('Clear entire collection?')) return;
    chrome.storage.local.set({ [COLLECTION_KEY]: [] }, updateCollectionCount);
  }

  scrapeBtn.addEventListener('click', async () => {
    scrapeBtn.disabled = true;
    scrapeBtn.textContent = 'Scanning…';
    hideError();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        showError('No active tab.');
        return;
      }
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PAGE' });
      if (response?.success) {
        renderResults(response.data);
      } else {
        showError(response?.error || 'Could not read this page.');
      }
    } catch (e) {
      showError('Load a normal webpage first, then try again.');
    }
    scrapeBtn.disabled = false;
    scrapeBtn.textContent = 'Find emails on this page';
  });

  addToCollectionBtn.addEventListener('click', addToCollection);
  exportPageBtn.addEventListener('click', exportPageCsv);
  exportCollectionBtn.addEventListener('click', exportCollectionCsv);
  clearCollectionBtn.addEventListener('click', clearCollection);

  function loadIgnoreList() {
    chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_IGNORE }, (result) => {
      const list = result[STORAGE_KEY] || [];
      ignoreListEl.innerHTML = list.map(email =>
        '<li><span class="ignore-email">' + escapeHtml(email) + '</span> <button type="button" class="ignore-remove" data-email="' + escapeHtml(email) + '">Remove</button></li>'
      ).join('');
      ignoreListEl.querySelectorAll('.ignore-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const email = btn.getAttribute('data-email');
          removeFromIgnoreList(email);
        });
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

  loadIgnoreList();
  updateCollectionCount();
  ignoreAddBtn.addEventListener('click', () => addToIgnoreList(ignoreInput.value));
  ignoreInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addToIgnoreList(ignoreInput.value); });
})();

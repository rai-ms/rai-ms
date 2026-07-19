const COLLECTION_KEY = 'collectedEmails';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ADD_TO_COLLECTION') {
    const toAdd = Array.isArray(msg.emails) ? msg.emails : [];
    chrome.storage.local.get({ [COLLECTION_KEY]: [] }, (result) => {
      const existing = Array.isArray(result[COLLECTION_KEY]) ? result[COLLECTION_KEY] : [];
      const existingSet = new Set(existing.map(e => String(e).toLowerCase()));
      let added = 0;
      toAdd.forEach(email => {
        const key = String(email).toLowerCase();
        if (!existingSet.has(key)) {
          existingSet.add(key);
          existing.push(email);
          added++;
        }
      });
      chrome.storage.local.set({ [COLLECTION_KEY]: existing }, () => {
        sendResponse({
          success: !chrome.runtime.lastError,
          error: chrome.runtime.lastError?.message,
          added,
          total: existing.length
        });
      });
    });
    return true;
  }
});

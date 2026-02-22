# HRNexTo Lead Finder – Chrome Extension

Chrome extension to **find visible emails** on the current page and flag contacts that look like **HR or senior personnel**, so you can reach out about [HRNexTo](https://hrnexto.com) (HRMS platform).

It only extracts information that is **already visible** on the page (e.g. team, about, or contact pages). It does not access private data or log into any service.

---

## Install (Chrome)

1. Open Chrome and go to `chrome://extensions/`.
2. Turn **Developer mode** on (top right).
3. Click **Load unpacked** and select this folder:  
   `.../chrome-ext`
4. The extension icon will appear in the toolbar.

---

## How to use

1. Open a webpage that shows contact/team info (e.g. company “Team”, “About”, “Contact”, or “Leadership” page).
2. Click the extension icon to open the popup.
3. Click **“Find emails on this page”**.
4. Review the list. Emails with nearby text suggesting HR/senior roles are marked **HR/Senior** and highlighted.
5. Use **“Show only HR / Senior roles”** to filter.
6. Click **“Export CSV”** to download a CSV (email, name, context, is_likely_hr_senior) for use in your outreach.

---

## What it detects

- **Emails**: From `mailto:` links and from plain text on the page.
- **HR/Senior hints**: Nearby text (e.g. headings, job titles) containing words like:  
  HR, Human Resources, Director, VP, Head of, Manager, Recruitment, Talent, People Ops, CEO, etc.

---

## Legal and responsible use

- Use only on pages you are allowed to access. Do not bypass login or scrape behind auth.
- Respect privacy and anti-spam laws (e.g. GDPR, CAN-SPAM, local rules). Only email people where you have a legitimate interest or consent, and always offer a clear way to opt out.
- This tool only surfaces **publicly visible** contact info. You are responsible for how you store, use, and email that data.

---

## Project layout

```
chrome-ext/
├── manifest.json   # Extension manifest (Manifest V3)
├── popup.html      # Popup UI
├── popup.css       # Popup styles
├── popup.js        # Popup logic + CSV export
├── content.js      # Injected script: finds emails + HR/senior context
└── README.md       # This file
```

---

## Optional: add icons

To set a custom icon, add PNGs under `icons/` (e.g. `icon16.png`, `icon32.png`, `icon48.png`) and in `manifest.json` set:

```json
"action": {
  "default_popup": "popup.html",
  "default_icon": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png"
  }
},
"icons": {
  "16": "icons/icon16.png",
  "32": "icons/icon32.png",
  "48": "icons/icon48.png"
}
```

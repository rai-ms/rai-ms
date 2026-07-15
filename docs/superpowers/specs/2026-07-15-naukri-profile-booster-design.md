# Naukri Profile Booster — Design

Date: 2026-07-15
Status: Approved (design)

## Problem

The current repo holds an unrelated "Email Scraper" extension. The user wants two
new things, unrelated to that extension:

1. **A top-tier Naukri profile** — optimized content, then applied to naukri.com
   via Claude-in-Chrome with a review step.
2. **An hourly auto-refresher** — keeps the Naukri profile "fresh" so it ranks
   higher in recruiter search (recruiters sort/filter by "profile last updated").

## User facts (source of truth for content)

- Total experience: **3 years**.
- **React Native: ~1 year 3 months** (most recent). Last 3 projects all at
  **Bloom** company. Most recent = *Employee App Mobile*
  (`/Users/admin/Documents/learning/react-native-learn/Employee App Mobile`).
- **Flutter: 4 projects** (earlier in the 3 years).
- Employee App Mobile real stack (grounds the experience bullets): React Native
  0.83, Expo 55, TypeScript, Zustand, React Query, Reanimated 4, Azure AD SSO
  (expo-auth-session), Infobip push notifications (vendor-agnostic facade),
  i18n (i18next + react-i18next + Intl polyfills), Contentful CMS, MMKV storage,
  react-native-keychain, Dynatrace instrumentation, Jest, atomic-design component
  structure.

### Facts still needed from user (marked as placeholders until provided)

Full name · current job title · whether Bloom is employer or client (and the
payroll company) · location/city · notice period · education (degree, college,
year) · current/expected CTC (optional).

## Decisions (from brainstorming)

- **Auto-update engine:** Puppeteer + Mac `launchd` scheduler (not a pure Chrome
  extension). Runs in the background whenever the laptop is on; more reliable
  than an extension that only runs while Chrome is open.
- **Profile content flow:** Write optimized content as text first → user reviews
  → apply to Naukri via Claude-in-Chrome.
- **Login method:** Saved browser session (persistent `userDataDir`). User logs
  in once manually; script reuses cookies. No password stored on disk.

## Non-goals / risks (explicit)

- Automating profile refresh to influence ranking may violate Naukri's Terms of
  Service; small risk of account restriction. It is the user's own account and
  own decision. Design mitigates the bot-pattern (below) but cannot remove the
  policy risk.
- The refresher performs a **no-op** update (re-upload the same resume) — it does
  not fabricate or change any profile claims.

## Deliverable 1 — Naukri Profile Optimization Pack

A reviewable markdown doc (`naukri-refresher/PROFILE-PACK.md` or shown inline)
containing:

1. **Resume Headline** — ~250 chars, keyword-dense (React Native, Expo,
   TypeScript, Zustand/Redux, React Query, Reanimated, iOS, Android, etc.).
2. **Profile Summary / About** — 3-YOE narrative: RN 1yr3mo @ Bloom + Flutter.
3. **Key Skills** — the highest-leverage field for recruiter search matching.
4. **Work Experience bullets** — Bloom RN (Employee App) + Flutter projects.
5. **IT Skills table** — skill · version · total experience · last used.
6. **Profile-completeness checklist** — education, resume upload, photo, etc.

Applied to naukri.com via Claude-in-Chrome, section by section, after user
review. Naukri DOM selectors are verified live during this same session (reused
by Deliverable 2).

## Deliverable 2 — `naukri-refresher/` (Puppeteer + launchd)

Self-contained folder in this repo. Uses the repo's existing `puppeteer-core`.

| File | Responsibility |
|---|---|
| `login.mjs` | One-time headful launch; user logs in manually; session persisted to `naukri-refresher/session/` (gitignored). |
| `refresh.mjs` | Reuse session → open profile → **re-upload the existing resume** (bumps "last updated" with zero visible change) → fallback: toggle resume-headline trailing char. Append a line to `naukri-refresher/refresh.log`. |
| `config.json` | `activeHours` (e.g. 9–21), `jitterMinutes`, `skipProbability`, `resumePath`. |
| `com.user.naukri-refresher.plist` | launchd job: triggers hourly; the script itself adds random delay, runs only within `activeHours`, and randomly skips some runs to avoid an exact-hourly bot signature. |
| `README.md` | Setup: `npm run naukri:login` once, then `launchctl load` the plist. |

### Refresh action detail

Primary: re-upload the same resume PDF via the profile's resume-upload control.
This refreshes the "profile last updated" timestamp without changing any visible
content. Fallback (if upload control changes): open the resume-headline editor,
append then immediately re-save a trailing period on alternating runs (minimal
visible change). Selectors kept in one place and verified live.

### Anti-bot-pattern behavior

- Active only during `activeHours` (daytime).
- Random jitter (0–`jitterMinutes`) before acting.
- Random `skipProbability` chance to do nothing this run.
- Human-plausible cadence, not exactly on the hour.

### Failure handling

- If session is expired / login wall detected → log a clear "re-login needed"
  message and exit non-zero (no silent failure).
- If a selector is not found → log which step failed; do not crash the machine's
  scheduler (exit cleanly, try next run).
- All runs append to `refresh.log` with timestamp + outcome.

## Testing

- `login.mjs`: manual (headful) — confirm session dir populated.
- `refresh.mjs`: dry-run flag (`--dry`) that navigates and locates controls but
  does not click Save/Upload; verify it finds every selector and logs OK.
- Verify the "profile last updated" timestamp actually changes after one real
  run (observed via Claude-in-Chrome).
- launchd: `launchctl start` once and confirm `refresh.log` gets a line.

## Out of scope

- Modifying the existing Email Scraper extension.
- Any change to the Employee App Mobile repo.

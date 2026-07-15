# naukri-refresher

Keeps your Naukri "profile last updated" timestamp fresh so you rank higher in
recruiter search. It performs a **no-op** update (re-uploads your existing
resume) — it never changes or fabricates any profile content.

> ⚠️ Automating profile activity may violate Naukri's Terms of Service. This is
> your own account and your own risk. Timing is randomized and daytime-only to
> stay human-plausible, but the policy risk cannot be removed.

## Setup

1. `npm install` (from repo root — installs puppeteer-core).
2. Set your resume path: copy `config.example.json` → `config.json`, edit
   `resumePath` to your resume PDF's absolute path.
3. One-time login: `npm run naukri:login` → log in when Chrome opens → press Enter.
4. Verify: `npm run naukri:refresh -- --dry` → expect `DRY resume-input-found`.
5. One real run: `npm run naukri:refresh` → expect `OK resume-reuploaded`.

## Schedule it (macOS launchd)

1. Edit `com.user.naukri-refresher.plist`, replace every `REPLACE_WITH_ABSOLUTE_PATH`
   with this folder's parent absolute path, and fix the `node` path (`which node`).
2. `cp naukri-refresher/com.user.naukri-refresher.plist ~/Library/LaunchAgents/`
3. `launchctl load ~/Library/LaunchAgents/com.user.naukri-refresher.plist`
4. Test now: `launchctl start com.user.naukri-refresher` → check `refresh.log`.
5. Stop: `launchctl unload ~/Library/LaunchAgents/com.user.naukri-refresher.plist`

## Config

| Key | Meaning |
|---|---|
| `profileUrl` | Naukri profile page URL |
| `resumePath` | Absolute path to the resume PDF to re-upload |
| `activeStartHour` / `activeEndHour` | Only act within this hour window (24h) |
| `jitterMinutes` | Random 0–N minute delay before acting |
| `skipProbability` | Chance (0–1) of skipping any given run |

## Tests

`npm run naukri:test` — unit tests for scheduling and config logic.

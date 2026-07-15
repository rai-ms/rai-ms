# Naukri Profile Booster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Puppeteer + launchd "profile refresher" that periodically bumps the user's Naukri "profile last updated" timestamp via a no-op resume re-upload, plus a reviewable optimized-profile content pack applied to naukri.com via Claude-in-Chrome.

**Architecture:** A self-contained `naukri-refresher/` folder reuses the repo's existing `puppeteer-core`, driving the user's Chrome with a persistent `userDataDir` for a saved login session. Pure scheduling/config logic is unit-tested with the built-in `node:test` runner; the browser interaction is verified with a `--dry` mode plus one observed live run. A launchd job triggers hourly and the script itself adds jitter, an active-hours window, and random skips to avoid an exact-hourly bot signature. The content pack is a separate reviewable markdown artifact.

**Tech Stack:** Node 20 ESM, `puppeteer-core` (already in `package.json`), `node:test`, `node:assert`, macOS `launchd`, Chrome.

---

## File Structure

- `naukri-refresher/lib/schedule.mjs` — pure functions: active-hours check, random skip, jitter, `decideRun()`. No I/O.
- `naukri-refresher/lib/schedule.test.mjs` — unit tests for schedule logic.
- `naukri-refresher/lib/config.mjs` — load + validate `config.json`.
- `naukri-refresher/lib/config.test.mjs` — unit tests for config validation.
- `naukri-refresher/lib/log.mjs` — append a timestamped line to `refresh.log`.
- `naukri-refresher/login.mjs` — one-time headful login; persists session to `session/`.
- `naukri-refresher/refresh.mjs` — main entry: decide → (jitter) → open profile → re-upload resume → log. Supports `--dry`.
- `naukri-refresher/config.example.json` — committed template.
- `naukri-refresher/config.json` — user's real config (gitignored).
- `naukri-refresher/com.user.naukri-refresher.plist` — launchd job template.
- `naukri-refresher/README.md` — setup + safety notes.
- `naukri-refresher/PROFILE-PACK.md` — Deliverable 1 optimized content (reviewable).
- `.gitignore` (modify) — ignore `naukri-refresher/session/`, `naukri-refresher/refresh.log`, `naukri-refresher/config.json`.
- `package.json` (modify) — add `naukri:login`, `naukri:refresh`, `naukri:test` scripts.

---

## Task 1: Scheduling logic (pure, TDD)

**Files:**
- Create: `naukri-refresher/lib/schedule.mjs`
- Test: `naukri-refresher/lib/schedule.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// naukri-refresher/lib/schedule.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWithinActiveHours, shouldSkip, computeJitterMs, decideRun } from './schedule.mjs';

const cfg = { activeStartHour: 9, activeEndHour: 21, jitterMinutes: 20, skipProbability: 0.3 };

test('isWithinActiveHours: inside window', () => {
  assert.equal(isWithinActiveHours(new Date('2026-07-15T10:00:00'), cfg), true);
});
test('isWithinActiveHours: before window', () => {
  assert.equal(isWithinActiveHours(new Date('2026-07-15T08:59:00'), cfg), false);
});
test('isWithinActiveHours: at end hour is exclusive', () => {
  assert.equal(isWithinActiveHours(new Date('2026-07-15T21:00:00'), cfg), false);
});
test('shouldSkip: rng below prob skips', () => {
  assert.equal(shouldSkip(() => 0.1, 0.3), true);
});
test('shouldSkip: rng above prob runs', () => {
  assert.equal(shouldSkip(() => 0.9, 0.3), false);
});
test('computeJitterMs: bounded by jitterMinutes', () => {
  assert.equal(computeJitterMs(() => 0.5, 20), 10 * 60 * 1000);
});
test('decideRun: outside hours -> no run', () => {
  const r = decideRun(new Date('2026-07-15T07:00:00'), () => 0.9, cfg);
  assert.deepEqual(r, { run: false, reason: 'outside-active-hours' });
});
test('decideRun: random skip -> no run', () => {
  const r = decideRun(new Date('2026-07-15T10:00:00'), () => 0.0, cfg);
  assert.deepEqual(r, { run: false, reason: 'random-skip' });
});
test('decideRun: eligible -> run with jitter', () => {
  const r = decideRun(new Date('2026-07-15T10:00:00'), () => 0.5, cfg);
  assert.equal(r.run, true);
  assert.equal(r.jitterMs, 10 * 60 * 1000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test naukri-refresher/lib/schedule.test.mjs`
Expected: FAIL — `Cannot find module './schedule.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// naukri-refresher/lib/schedule.mjs
// Pure scheduling helpers. rng is injectable so behavior is deterministic in tests.

export function isWithinActiveHours(date, { activeStartHour, activeEndHour }) {
  const h = date.getHours();
  return h >= activeStartHour && h < activeEndHour;
}

export function shouldSkip(rng, skipProbability) {
  return rng() < skipProbability;
}

export function computeJitterMs(rng, jitterMinutes) {
  return Math.floor(rng() * jitterMinutes * 60 * 1000);
}

// Decides whether this scheduled invocation should act.
// Order: active-hours gate -> random skip -> run (with jitter delay).
export function decideRun(date, rng, config) {
  if (!isWithinActiveHours(date, config)) {
    return { run: false, reason: 'outside-active-hours' };
  }
  if (shouldSkip(rng, config.skipProbability)) {
    return { run: false, reason: 'random-skip' };
  }
  return { run: true, jitterMs: computeJitterMs(rng, config.jitterMinutes) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test naukri-refresher/lib/schedule.test.mjs`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add naukri-refresher/lib/schedule.mjs naukri-refresher/lib/schedule.test.mjs
git commit -m "feat(naukri): scheduling logic with active-hours, skip, jitter"
```

---

## Task 2: Config load + validation (TDD)

**Files:**
- Create: `naukri-refresher/lib/config.mjs`
- Test: `naukri-refresher/lib/config.test.mjs`
- Create: `naukri-refresher/config.example.json`

- [ ] **Step 1: Write the failing test**

```js
// naukri-refresher/lib/config.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from './config.mjs';

function writeTmp(obj) {
  const dir = mkdtempSync(join(tmpdir(), 'naukri-cfg-'));
  const p = join(dir, 'config.json');
  writeFileSync(p, JSON.stringify(obj));
  return p;
}

const valid = {
  profileUrl: 'https://www.naukri.com/mnjuser/profile',
  resumePath: '/tmp/resume.pdf',
  activeStartHour: 9, activeEndHour: 21,
  jitterMinutes: 20, skipProbability: 0.3,
};

test('loadConfig: valid config loads', () => {
  assert.deepEqual(loadConfig(writeTmp(valid)), valid);
});
test('loadConfig: missing key throws', () => {
  const bad = { ...valid }; delete bad.resumePath;
  assert.throws(() => loadConfig(writeTmp(bad)), /resumePath/);
});
test('loadConfig: start >= end throws', () => {
  assert.throws(() => loadConfig(writeTmp({ ...valid, activeStartHour: 21, activeEndHour: 9 })), /activeStartHour/);
});
test('loadConfig: skipProbability out of range throws', () => {
  assert.throws(() => loadConfig(writeTmp({ ...valid, skipProbability: 1.5 })), /skipProbability/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test naukri-refresher/lib/config.test.mjs`
Expected: FAIL — `Cannot find module './config.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// naukri-refresher/lib/config.mjs
import { readFileSync } from 'node:fs';

const REQUIRED = [
  'profileUrl', 'resumePath',
  'activeStartHour', 'activeEndHour',
  'jitterMinutes', 'skipProbability',
];

export function loadConfig(path) {
  const cfg = JSON.parse(readFileSync(path, 'utf8'));
  for (const k of REQUIRED) {
    if (!(k in cfg)) throw new Error(`config missing required key: ${k}`);
  }
  if (cfg.activeStartHour >= cfg.activeEndHour) {
    throw new Error('config: activeStartHour must be < activeEndHour');
  }
  if (cfg.skipProbability < 0 || cfg.skipProbability > 1) {
    throw new Error('config: skipProbability must be between 0 and 1');
  }
  return cfg;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test naukri-refresher/lib/config.test.mjs`
Expected: PASS.

- [ ] **Step 5: Create the example config**

```json
{
  "profileUrl": "https://www.naukri.com/mnjuser/profile",
  "resumePath": "/absolute/path/to/your-resume.pdf",
  "activeStartHour": 9,
  "activeEndHour": 21,
  "jitterMinutes": 20,
  "skipProbability": 0.3
}
```

- [ ] **Step 6: Commit**

```bash
git add naukri-refresher/lib/config.mjs naukri-refresher/lib/config.test.mjs naukri-refresher/config.example.json
git commit -m "feat(naukri): config loader with validation + example config"
```

---

## Task 3: Logger

**Files:**
- Create: `naukri-refresher/lib/log.mjs`
- Test: `naukri-refresher/lib/log.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// naukri-refresher/lib/log.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendLog } from './log.mjs';

test('appendLog: writes a timestamped line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'naukri-log-'));
  const p = join(dir, 'refresh.log');
  appendLog(p, 'hello', new Date('2026-07-15T10:00:00Z'));
  const content = readFileSync(p, 'utf8');
  assert.match(content, /2026-07-15T10:00:00.000Z\thello\n/);
});
test('appendLog: appends, does not overwrite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'naukri-log-'));
  const p = join(dir, 'refresh.log');
  appendLog(p, 'one', new Date('2026-07-15T10:00:00Z'));
  appendLog(p, 'two', new Date('2026-07-15T11:00:00Z'));
  const lines = readFileSync(p, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test naukri-refresher/lib/log.test.mjs`
Expected: FAIL — `Cannot find module './log.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// naukri-refresher/lib/log.mjs
import { appendFileSync } from 'node:fs';

// date is injectable for testability; defaults to now at call time.
export function appendLog(path, message, date = new Date()) {
  appendFileSync(path, `${date.toISOString()}\t${message}\n`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test naukri-refresher/lib/log.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add naukri-refresher/lib/log.mjs naukri-refresher/lib/log.test.mjs
git commit -m "feat(naukri): append-only timestamped logger"
```

---

## Task 4: One-time login script

**Files:**
- Create: `naukri-refresher/login.mjs`

Note: not unit-tested (interactive headful browser). Verified manually in Step 3.

- [ ] **Step 1: Write the implementation**

```js
// naukri-refresher/login.mjs
// One-time: opens a real Chrome window with a persistent profile dir so you can
// log into Naukri manually. The session (cookies) is saved to ./session and
// reused by refresh.mjs. Password is never read or stored by this script.

import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import readline from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = join(__dirname, 'session');
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

const browser = await puppeteer.launch({
  headless: false,
  executablePath: CHROME,
  userDataDir: SESSION_DIR,
  defaultViewport: null,
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto('https://www.naukri.com/nlogin/login', { waitUntil: 'domcontentloaded' });

console.log('\n👉 Chrome window me Naukri login karo. Ho jaaye toh yahan Enter dabao.');
await ask('');
await browser.close();
rl.close();
console.log('✅ Session saved to naukri-refresher/session. Ab `npm run naukri:refresh` chalega.');
```

- [ ] **Step 2: Add npm script**

Modify `package.json` scripts block, add:

```json
"naukri:login": "node naukri-refresher/login.mjs",
```

- [ ] **Step 3: Manual verification**

Run: `npm run naukri:login`
Expected: Chrome opens Naukri login. After you log in and press Enter, the
directory `naukri-refresher/session/` exists and is non-empty (`ls naukri-refresher/session`).

- [ ] **Step 4: Commit**

```bash
git add naukri-refresher/login.mjs package.json
git commit -m "feat(naukri): one-time manual login that persists a session"
```

---

## Task 5: Refresh entry point (re-upload resume, with --dry)

**Files:**
- Create: `naukri-refresher/refresh.mjs`

Note: browser action verified via `--dry` (locates controls, never clicks Save/Upload)
and one observed live run. Selectors are centralized so they are easy to update
when Naukri's DOM changes.

- [ ] **Step 1: Write the implementation**

```js
// naukri-refresher/refresh.mjs
// Reuses the saved session to bump "profile last updated" by re-uploading the
// SAME resume file (no visible profile change). Honors active-hours, jitter, and
// random skip. Pass --dry to locate controls without uploading.

import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { loadConfig } from './lib/config.mjs';
import { decideRun } from './lib/schedule.mjs';
import { appendLog } from './lib/log.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = join(__dirname, 'session');
const LOG = join(__dirname, 'refresh.log');
const CONFIG = join(__dirname, 'config.json');
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DRY = process.argv.includes('--dry');

// Resume-upload file input on the Naukri profile page. Centralized so it is easy
// to correct after a live check. Kept broad on purpose.
const RESUME_INPUT_SELECTOR = 'input[type="file"][name*="resume" i], input[type="file"][id*="resume" i], input[type="file"]';

function log(msg) {
  appendLog(LOG, msg);
  console.log(msg);
}

async function main() {
  if (!existsSync(SESSION_DIR)) {
    log('ERROR no-session — run `npm run naukri:login` first');
    process.exit(1);
  }
  const cfg = loadConfig(CONFIG);
  if (!existsSync(cfg.resumePath)) {
    log(`ERROR resume-not-found ${cfg.resumePath}`);
    process.exit(1);
  }

  const decision = decideRun(new Date(), Math.random, cfg);
  if (!decision.run) {
    log(`SKIP ${decision.reason}`);
    return;
  }
  if (!DRY && decision.jitterMs > 0) {
    log(`JITTER sleeping ${Math.round(decision.jitterMs / 1000)}s`);
    await sleep(decision.jitterMs);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME,
    userDataDir: SESSION_DIR,
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    await page.goto(cfg.profileUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    // Login-wall detection: if redirected to a login URL, session expired.
    if (/login/i.test(page.url())) {
      log('ERROR session-expired — run `npm run naukri:login` again');
      process.exit(2);
    }

    const input = await page.$(RESUME_INPUT_SELECTOR);
    if (!input) {
      log('ERROR resume-input-not-found — selector needs a live update');
      process.exit(3);
    }

    if (DRY) {
      log('DRY resume-input-found — no upload performed');
      return;
    }

    await input.uploadFile(cfg.resumePath);
    // Give Naukri a moment to process the upload / show its confirmation toast.
    await sleep(6000);
    log('OK resume-reuploaded');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  log(`ERROR ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm scripts**

Modify `package.json` scripts block, add:

```json
"naukri:refresh": "node naukri-refresher/refresh.mjs",
"naukri:test": "node --test naukri-refresher/lib"
```

- [ ] **Step 3: Create the real config from the example**

```bash
cp naukri-refresher/config.example.json naukri-refresher/config.json
```
Then edit `naukri-refresher/config.json` and set `resumePath` to your actual
resume PDF absolute path. (`profileUrl` may need adjusting after the live check.)

- [ ] **Step 4: Dry-run verification**

Run: `npm run naukri:refresh -- --dry`
Expected: log line `DRY resume-input-found — no upload performed` (or a clear
`ERROR` naming the failed step if a selector needs updating).

- [ ] **Step 5: Commit**

```bash
git add naukri-refresher/refresh.mjs package.json
git commit -m "feat(naukri): refresh entry point — no-op resume re-upload with dry mode"
```

---

## Task 6: launchd job + gitignore + README

**Files:**
- Create: `naukri-refresher/com.user.naukri-refresher.plist`
- Create: `naukri-refresher/README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Write the launchd plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.user.naukri-refresher</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>REPLACE_WITH_ABSOLUTE_PATH/naukri-refresher/refresh.mjs</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>REPLACE_WITH_ABSOLUTE_PATH/naukri-refresher/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>REPLACE_WITH_ABSOLUTE_PATH/naukri-refresher/launchd.err.log</string>
</dict>
</plist>
```
Note: fires at the top of every hour; `refresh.mjs` itself applies jitter,
active-hours, and random skip so the real action is not exactly hourly.
`node` path may differ — check with `which node` and update `ProgramArguments`.

- [ ] **Step 2: Update .gitignore**

Append to `.gitignore`:

```
naukri-refresher/session/
naukri-refresher/config.json
naukri-refresher/*.log
```

- [ ] **Step 3: Write the README**

````markdown
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
````

- [ ] **Step 4: Run all unit tests**

Run: `npm run naukri:test`
Expected: PASS — all schedule/config/log tests green.

- [ ] **Step 5: Commit**

```bash
git add naukri-refresher/com.user.naukri-refresher.plist naukri-refresher/README.md .gitignore
git commit -m "feat(naukri): launchd job, gitignore, and setup README"
```

---

## Task 7: Profile Optimization Pack (Deliverable 1)

**Files:**
- Create: `naukri-refresher/PROFILE-PACK.md`

This is content, not code. It is drafted from the user's real experience (Bloom
RN Employee App + Flutter) and reviewed by the user before being applied to
naukri.com via Claude-in-Chrome. Personal facts still missing are marked
`⟨FILL⟩` for the user to complete.

- [ ] **Step 1: Draft the pack**

Sections (each written out in full in the file):
1. Resume Headline (~250 chars, keyword-dense).
2. Profile Summary / About.
3. Key Skills (comma list optimized for Naukri search).
4. Work Experience bullets — Bloom (React Native) and Flutter projects.
5. IT Skills table — skill · version · total experience · last used.
6. Profile-completeness checklist.

Placeholders for: full name, current title, Bloom = employer vs client (+ payroll
company), location, notice period, education, current/expected CTC.

- [ ] **Step 2: User review**

Present the pack. User fills `⟨FILL⟩` placeholders and approves wording.

- [ ] **Step 3: Commit**

```bash
git add naukri-refresher/PROFILE-PACK.md
git commit -m "docs(naukri): optimized profile content pack for review"
```

---

## Task 8: Apply to Naukri via Claude-in-Chrome (live)

Not a code task — an interactive browser session run with the user present.

- [ ] **Step 1:** Open naukri.com (user's logged-in Chrome via Claude-in-Chrome).
- [ ] **Step 2:** Apply the approved Headline, Summary, Key Skills, Experience,
  IT Skills from `PROFILE-PACK.md`, section by section, confirming each save.
- [ ] **Step 3:** While on the profile page, capture the live selectors for the
  resume-upload control and profile URL; update `RESUME_INPUT_SELECTOR` in
  `refresh.mjs` and `profileUrl` in `config.json` if they differ from the plan's
  defaults. Commit any selector fix:

```bash
git add naukri-refresher/refresh.mjs naukri-refresher/config.example.json
git commit -m "fix(naukri): correct live resume-upload selector / profile URL"
```
- [ ] **Step 4:** Confirm the "profile last updated" timestamp changed after one
  real `npm run naukri:refresh`.

---

## Self-Review Notes

- **Spec coverage:** Deliverable 1 → Tasks 7–8. Deliverable 2 → Tasks 1–6.
  Saved-session login → Task 4. Anti-bot behavior → Task 1. No-op re-upload →
  Task 5. launchd → Task 6. Live selector verification → Task 8 Step 3.
- **Placeholder scan:** Only intentional `⟨FILL⟩` personal-fact markers in Task 7
  and `REPLACE_WITH_ABSOLUTE_PATH` in the plist (documented in README Step 1).
- **Type consistency:** `decideRun` returns `{run, reason}` or `{run, jitterMs}`;
  consumed consistently in `refresh.mjs`. `loadConfig` keys match `config.example.json`
  and the README config table. `RESUME_INPUT_SELECTOR` defined once in `refresh.mjs`.

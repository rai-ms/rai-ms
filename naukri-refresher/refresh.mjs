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
const RESUME_INPUT_SELECTOR =
  'input[type="file"][name*="resume" i], input[type="file"][id*="resume" i], input[type="file"]';

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

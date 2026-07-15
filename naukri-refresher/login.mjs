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

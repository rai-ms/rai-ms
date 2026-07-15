import { appendFileSync } from 'node:fs';

// date is injectable for testability; defaults to now at call time.
export function appendLog(path, message, date = new Date()) {
  appendFileSync(path, `${date.toISOString()}\t${message}\n`);
}

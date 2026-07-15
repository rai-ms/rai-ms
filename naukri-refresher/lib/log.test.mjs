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

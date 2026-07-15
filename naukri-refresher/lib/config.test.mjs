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

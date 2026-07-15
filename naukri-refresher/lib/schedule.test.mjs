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

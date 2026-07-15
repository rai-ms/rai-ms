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

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

// The broadcast clock: maps a wall-clock instant to a scene on the timeline.
//
// The timeline is a sequence of per-speaker UNITS:
//   [announcer intro] -> [short applause] -> [~10 min keynote] -> [applause]
// Each unit's length is a deterministic function of its index (the keynote runs
// 8-12 min), so every viewer agrees on which scene is live without any server
// state. Mapping a time to a scene walks the units from a cached anchor (O(1)
// amortized; one bounded walk on first load). The audio pipeline sizes each
// scene's audio to its unit, so the same math drives both writer and reader.

import { SPEAKING_MAX_MS, SPEAKING_MIN_MS } from "../grammar/config.ts";

export const BROADCAST_SEED = "keynote";
/** Fixed broadcast origin (UTC). Scene 0 began here; every viewer agrees. */
export const EPOCH_MS = Date.UTC(2025, 0, 1, 0, 0, 0);

export const INTRO_MS = 9_000; // announcer introduces the speaker
export const INTRO_APPLAUSE_MS = 3_500; // short applause as the speaker walks on
export const END_APPLAUSE_MS = 7_000; // closing ovation
const FIXED_MS = INTRO_MS + INTRO_APPLAUSE_MS + END_APPLAUSE_MS;
const SPEAKING_SPAN = SPEAKING_MAX_MS - SPEAKING_MIN_MS;

export interface Located {
  /** Scene index live at the queried instant. */
  index: number;
  /** Wall-clock start of that scene's unit. */
  startMs: number;
  /** Total length of that scene's unit. */
  unitMs: number;
}

/** A cheap, well-distributed 32-bit integer hash for per-scene durations. */
function hash32(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

/** Deterministic speaking length (ms) of the keynote at a scene index (8-12 min).
 * The audio pipeline uses this as each scene's budget so audio fits its unit. */
export function speakingMsForScene(index: number): number {
  return SPEAKING_MIN_MS + (hash32(index) % SPEAKING_SPAN);
}

/** Deterministic total unit length (ms): intro + applause + keynote + applause. */
export function unitMsForScene(index: number): number {
  return FIXED_MS + speakingMsForScene(index);
}

// Cached anchor so the per-tick walk is O(1) amortized (one bounded walk on the
// first call). The whole client shares this single broadcast position.
let anchorIndex = 0;
let anchorStart = EPOCH_MS;

/** Locate the scene live at an instant: its index, unit start, and unit length. */
export function locateScene(nowMs: number): Located {
  let index = anchorIndex;
  let start = anchorStart;
  while (start > nowMs && index > 0) {
    index -= 1;
    start -= unitMsForScene(index);
  }
  while (start + unitMsForScene(index) <= nowMs) {
    start += unitMsForScene(index);
    index += 1;
  }
  anchorIndex = index;
  anchorStart = start;
  return { index, startMs: start, unitMs: unitMsForScene(index) };
}

/** The scene index live at a given instant (walks variable-length units). */
export function sceneIndexAtTime(nowMs: number): number {
  return locateScene(nowMs).index;
}

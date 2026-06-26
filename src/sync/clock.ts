// The broadcast clock: maps a wall-clock instant to exactly what is on screen.
//
// The timeline is a sequence of per-speaker UNITS:
//   [announcer intro] -> [short applause] -> [~10 min keynote] -> [applause]
// Each unit's length is a deterministic function of its index (the keynote runs
// 8-12 min), so all viewers agree on it. To map a time to a scene we walk the
// units from a cached anchor (O(1) amortized; one bounded walk on first load),
// which keeps late-joiner sync exact without storing any server state. The
// keynote's sentences are scaled to fill its speaking window, so captions stay
// the synchronized source of truth even if a device's TTS drifts.

import { SpeechEngine } from "../grammar/engine.ts";
import { SPEAKING_MAX_MS, SPEAKING_MIN_MS } from "../grammar/config.ts";
import type { Corpus, Scene } from "../grammar/types.ts";

export const BROADCAST_SEED = "keynote";
/** Fixed broadcast origin (UTC). Scene 0 began here; every viewer agrees. */
export const EPOCH_MS = Date.UTC(2025, 0, 1, 0, 0, 0);

export const INTRO_MS = 9_000; // announcer introduces the speaker
export const INTRO_APPLAUSE_MS = 4_000; // short applause as the speaker walks on
export const END_APPLAUSE_MS = 8_000; // applause after the keynote
const FIXED_MS = INTRO_MS + INTRO_APPLAUSE_MS + END_APPLAUSE_MS;
const SPEAKING_SPAN = SPEAKING_MAX_MS - SPEAKING_MIN_MS;

export type Phase = "intro" | "introApplause" | "speaking" | "endApplause";

export interface ActiveLine {
  text: string;
  role: "announcer" | "speaker";
}

export interface ClockState {
  sceneIndex: number;
  phase: Phase;
  scene: Scene;
  line: ActiveLine | null;
  utteranceIndex: number;
  progress: number;
  applause: boolean;
}

interface Segment {
  start: number;
  end: number;
  index: number;
}

/** A cheap, well-distributed 32-bit integer hash for per-scene durations. */
function hash32(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

export class SceneClock {
  private readonly engine: SpeechEngine;
  private cacheIndex = -1;
  private cacheScene: Scene | null = null;
  private cacheSpeaking = 0;
  private timeline: Segment[] = [];
  private anchorIndex = 0;
  private anchorStart = EPOCH_MS;

  constructor(corpus: Corpus, seed: string = BROADCAST_SEED) {
    this.engine = new SpeechEngine(corpus, seed);
  }

  /** Speaking length (ms) of the keynote at the given scene index. */
  speakingMsAt(index: number): number {
    return SPEAKING_MIN_MS + (hash32(index) % SPEAKING_SPAN);
  }

  /** Total length (ms) of a scene's unit: intro + applause + keynote + applause. */
  unitMsAt(index: number): number {
    return FIXED_MS + this.speakingMsAt(index);
  }

  /** The scene index live at the given instant, with its unit start time. */
  private locate(nowMs: number): { index: number; start: number } {
    let index = this.anchorIndex;
    let start = this.anchorStart;
    while (start > nowMs) {
      index -= 1;
      start -= this.unitMsAt(index);
    }
    while (start + this.unitMsAt(index) <= nowMs) {
      start += this.unitMsAt(index);
      index += 1;
    }
    this.anchorIndex = index;
    this.anchorStart = start;
    return { index, start };
  }

  sceneIndexAt(nowMs: number): number {
    return this.locate(nowMs).index;
  }

  private sceneAt(index: number): Scene {
    if (index !== this.cacheIndex || !this.cacheScene) {
      this.cacheSpeaking = this.speakingMsAt(index);
      this.cacheScene = this.engine.generateScene(index, this.cacheSpeaking);
      this.cacheIndex = index;
      this.buildTimeline(this.cacheScene, this.cacheSpeaking);
    }
    return this.cacheScene;
  }

  /** Lay the scene's utterances across its speaking window. */
  private buildTimeline(scene: Scene, speakingMs: number): void {
    const total = scene.utterances.reduce((sum, u) => sum + u.nominalMs, 0) || 1;
    const scale = speakingMs / total;
    let t = 0;
    this.timeline = scene.utterances.map((u, index) => {
      const start = t;
      t += u.nominalMs * scale;
      return { start, end: t, index };
    });
  }

  /** Full broadcast state at the given instant. */
  stateAt(nowMs: number): ClockState {
    const { index: sceneIndex, start } = this.locate(nowMs);
    const scene = this.sceneAt(sceneIndex);
    const speakingMs = this.cacheSpeaking;
    const rel = nowMs - start;

    const introEnd = INTRO_MS;
    const introApplauseEnd = introEnd + INTRO_APPLAUSE_MS;
    const speakEnd = introApplauseEnd + speakingMs;

    if (rel < introEnd) {
      return {
        sceneIndex,
        phase: "intro",
        scene,
        line: { text: scene.intro.text, role: "announcer" },
        utteranceIndex: -1,
        progress: rel / INTRO_MS,
        applause: false,
      };
    }
    if (rel < introApplauseEnd) {
      return {
        sceneIndex,
        phase: "introApplause",
        scene,
        line: null,
        utteranceIndex: -1,
        progress: (rel - introEnd) / INTRO_APPLAUSE_MS,
        applause: true,
      };
    }
    if (rel < speakEnd) {
      const o = rel - introApplauseEnd;
      const seg = this.segmentAt(o);
      const u = scene.utterances[seg.index];
      return {
        sceneIndex,
        phase: "speaking",
        scene,
        line: u ? { text: u.text, role: "speaker" } : null,
        utteranceIndex: seg.index,
        progress: (o - seg.start) / Math.max(1, seg.end - seg.start),
        applause: false,
      };
    }
    return {
      sceneIndex,
      phase: "endApplause",
      scene,
      line: null,
      utteranceIndex: -1,
      progress: (rel - speakEnd) / END_APPLAUSE_MS,
      applause: true,
    };
  }

  /** Binary-search the speaking timeline for the segment covering offset o. */
  private segmentAt(o: number): Segment {
    const tl = this.timeline;
    if (tl.length === 0) return { start: 0, end: 1, index: -1 };
    let lo = 0;
    let hi = tl.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (o < (tl[mid] as Segment).end) hi = mid;
      else lo = mid + 1;
    }
    return tl[lo] as Segment;
  }
}

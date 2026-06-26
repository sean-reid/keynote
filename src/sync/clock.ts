// The broadcast clock: maps a wall-clock instant to exactly what is on screen.
//
// The timeline is a repeating fixed-length UNIT per speaker:
//   [announcer intro] -> [short applause] -> [~30 min keynote] -> [applause]
// Because the unit length is fixed, any viewer (including a late joiner) computes
// the current scene with a single floor() and lands on the same moment, no replay.
// The keynote's sentences are scaled to fill the speaking window exactly, so the
// captions stay the synchronized source of truth even if a device's TTS drifts.

import { SpeechEngine } from "../grammar/engine.ts";
import { SPEAKING_MS } from "../grammar/config.ts";
import type { Corpus, Scene } from "../grammar/types.ts";

export const BROADCAST_SEED = "keynote";
/** Fixed broadcast origin (UTC). Scene 0 began here; every viewer agrees. */
export const EPOCH_MS = Date.UTC(2025, 0, 1, 0, 0, 0);

export const INTRO_MS = 9_000; // announcer introduces the speaker
export const INTRO_APPLAUSE_MS = 4_000; // short applause as the speaker walks on
export const END_APPLAUSE_MS = 8_000; // applause after the keynote
export const UNIT_MS = INTRO_MS + INTRO_APPLAUSE_MS + SPEAKING_MS + END_APPLAUSE_MS;

export type Phase = "intro" | "introApplause" | "speaking" | "endApplause";

export interface ActiveLine {
  text: string;
  role: "announcer" | "speaker";
}

export interface ClockState {
  sceneIndex: number;
  phase: Phase;
  scene: Scene;
  /** The line currently being spoken, or null during applause. */
  line: ActiveLine | null;
  /** Index into scene.utterances while speaking, else -1. */
  utteranceIndex: number;
  /** Progress 0..1 through the current line or applause phase. */
  progress: number;
  /** True during either applause phase. */
  applause: boolean;
}

interface Segment {
  start: number;
  end: number;
  index: number;
}

export class SceneClock {
  private readonly engine: SpeechEngine;
  private cacheIndex = -1;
  private cacheScene: Scene | null = null;
  private timeline: Segment[] = [];

  constructor(corpus: Corpus, seed: string = BROADCAST_SEED) {
    this.engine = new SpeechEngine(corpus, seed);
  }

  /** The scene index that is live at the given instant. */
  sceneIndexAt(nowMs: number): number {
    return Math.floor((nowMs - EPOCH_MS) / UNIT_MS);
  }

  private sceneAt(index: number): Scene {
    if (index !== this.cacheIndex || !this.cacheScene) {
      this.cacheScene = this.engine.generateScene(index);
      this.cacheIndex = index;
      this.buildTimeline(this.cacheScene);
    }
    return this.cacheScene;
  }

  /** Lay the scene's utterances across the fixed speaking window. */
  private buildTimeline(scene: Scene): void {
    const total = scene.utterances.reduce((sum, u) => sum + u.nominalMs, 0) || 1;
    const scale = SPEAKING_MS / total;
    let t = 0;
    this.timeline = scene.utterances.map((u, index) => {
      const start = t;
      t += u.nominalMs * scale;
      return { start, end: t, index };
    });
  }

  /** Full broadcast state at the given instant. */
  stateAt(nowMs: number): ClockState {
    const sceneIndex = this.sceneIndexAt(nowMs);
    const scene = this.sceneAt(sceneIndex);
    const rel = nowMs - EPOCH_MS - sceneIndex * UNIT_MS;

    const introEnd = INTRO_MS;
    const introApplauseEnd = introEnd + INTRO_APPLAUSE_MS;
    const speakEnd = introApplauseEnd + SPEAKING_MS;

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
    if (tl.length === 0) return { start: 0, end: SPEAKING_MS, index: -1 };
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

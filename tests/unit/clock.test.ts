import { beforeAll, describe, expect, it } from "vitest";
import {
  EPOCH_MS,
  INTRO_APPLAUSE_MS,
  INTRO_MS,
  SceneClock,
} from "../../src/sync/clock.ts";
import { SPEAKING_MAX_MS, SPEAKING_MIN_MS } from "../../src/grammar/config.ts";
import type { Corpus } from "../../src/grammar/types.ts";
import { loadCorpusFromDisk } from "../helpers/corpus.ts";

let corpus: Corpus;

beforeAll(() => {
  corpus = loadCorpusFromDisk();
});

describe("SceneClock", () => {
  it("gives each scene a speaking length of 8-12 minutes", () => {
    const clock = new SceneClock(corpus);
    for (let i = 0; i < 50; i++) {
      const ms = clock.speakingMsAt(i);
      expect(ms).toBeGreaterThanOrEqual(SPEAKING_MIN_MS);
      expect(ms).toBeLessThan(SPEAKING_MAX_MS);
    }
    // Lengths should actually vary.
    const lengths = new Set(Array.from({ length: 50 }, (_, i) => clock.speakingMsAt(i)));
    expect(lengths.size).toBeGreaterThan(10);
  });

  it("advances one scene per unit, with variable unit lengths", () => {
    const clock = new SceneClock(corpus);
    expect(clock.sceneIndexAt(EPOCH_MS)).toBe(0);
    let t = EPOCH_MS;
    for (let i = 0; i < 5; i++) {
      expect(clock.sceneIndexAt(t + 1_000)).toBe(i);
      t += clock.unitMsAt(i);
    }
    expect(clock.sceneIndexAt(t + 1_000)).toBe(5);
  });

  it("is deterministic across instances for the same instant", () => {
    const t = EPOCH_MS + 5_000_000;
    const a = new SceneClock(corpus).stateAt(t);
    const b = new SceneClock(corpus).stateAt(t);
    expect(a.sceneIndex).toBe(b.sceneIndex);
    expect(a.phase).toBe(b.phase);
    expect(a.line?.text).toBe(b.line?.text);
    expect(a.utteranceIndex).toBe(b.utteranceIndex);
  });

  it("moves through intro, applause, speaking, then applause", () => {
    const clock = new SceneClock(corpus);
    // Scene 0 starts at the epoch.
    expect(clock.stateAt(EPOCH_MS + 1_000).phase).toBe("intro");
    expect(clock.stateAt(EPOCH_MS + INTRO_MS + 1_000).phase).toBe("introApplause");
    expect(clock.stateAt(EPOCH_MS + INTRO_MS + INTRO_APPLAUSE_MS + 1_000).phase).toBe("speaking");
    expect(clock.stateAt(EPOCH_MS + clock.unitMsAt(0) - 1_000).phase).toBe("endApplause");
  });

  it("introduces the speaker by the announcer during the intro", () => {
    const clock = new SceneClock(corpus);
    const s = clock.stateAt(EPOCH_MS + 2_000);
    expect(s.line?.role).toBe("announcer");
    expect(s.line?.text).toContain(s.scene.speaker.name);
  });

  it("delivers speaker lines that advance over the speaking window", () => {
    const clock = new SceneClock(corpus);
    const speakStart = EPOCH_MS + INTRO_MS + INTRO_APPLAUSE_MS;
    const early = clock.stateAt(speakStart + 500);
    const late = clock.stateAt(speakStart + clock.speakingMsAt(0) - 5_000);
    expect(early.line?.role).toBe("speaker");
    expect(early.utteranceIndex).toBe(0);
    expect(late.utteranceIndex).toBeGreaterThan(early.utteranceIndex);
  });

  it("lets a late joiner land mid-stream consistently", () => {
    const clock = new SceneClock(corpus);
    const t = EPOCH_MS + 40_000_000; // far into the broadcast
    const a = clock.stateAt(t);
    const b = new SceneClock(corpus).stateAt(t);
    expect(a.sceneIndex).toBe(b.sceneIndex);
    expect(a.sceneIndex).toBeGreaterThan(50);
    expect(a.line?.text).toBe(b.line?.text);
  });
});

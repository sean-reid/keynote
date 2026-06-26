import { beforeAll, describe, expect, it } from "vitest";
import {
  EPOCH_MS,
  INTRO_APPLAUSE_MS,
  INTRO_MS,
  SceneClock,
  UNIT_MS,
} from "../../src/sync/clock.ts";
import { SPEAKING_MS } from "../../src/grammar/config.ts";
import type { Corpus } from "../../src/grammar/types.ts";
import { loadCorpusFromDisk } from "../helpers/corpus.ts";

let corpus: Corpus;

beforeAll(() => {
  corpus = loadCorpusFromDisk();
});

describe("SceneClock", () => {
  it("advances one scene per unit", () => {
    const clock = new SceneClock(corpus);
    expect(clock.sceneIndexAt(EPOCH_MS)).toBe(0);
    expect(clock.sceneIndexAt(EPOCH_MS + UNIT_MS)).toBe(1);
    expect(clock.sceneIndexAt(EPOCH_MS + UNIT_MS * 9 + 5_000)).toBe(9);
  });

  it("is deterministic across instances for the same instant", () => {
    const t = EPOCH_MS + UNIT_MS * 3 + INTRO_MS + INTRO_APPLAUSE_MS + 12_345;
    const a = new SceneClock(corpus).stateAt(t);
    const b = new SceneClock(corpus).stateAt(t);
    expect(a.sceneIndex).toBe(b.sceneIndex);
    expect(a.phase).toBe(b.phase);
    expect(a.line?.text).toBe(b.line?.text);
    expect(a.utteranceIndex).toBe(b.utteranceIndex);
  });

  it("moves through intro, applause, speaking, then applause", () => {
    const clock = new SceneClock(corpus);
    const base = EPOCH_MS + UNIT_MS * 2;
    expect(clock.stateAt(base + 1_000).phase).toBe("intro");
    expect(clock.stateAt(base + INTRO_MS + 1_000).phase).toBe("introApplause");
    expect(clock.stateAt(base + INTRO_MS + INTRO_APPLAUSE_MS + 1_000).phase).toBe("speaking");
    expect(clock.stateAt(base + UNIT_MS - 1_000).phase).toBe("endApplause");
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
    const late = clock.stateAt(speakStart + SPEAKING_MS - 5_000);
    expect(early.line?.role).toBe("speaker");
    expect(early.utteranceIndex).toBe(0);
    expect(late.utteranceIndex).toBeGreaterThan(early.utteranceIndex);
  });

  it("lets a late joiner land mid-stream consistently", () => {
    const clock = new SceneClock(corpus);
    const t = EPOCH_MS + UNIT_MS * 1000 + INTRO_MS + INTRO_APPLAUSE_MS + SPEAKING_MS / 2;
    const s = clock.stateAt(t);
    expect(s.sceneIndex).toBe(1000);
    expect(s.phase).toBe("speaking");
    expect(s.line?.text.length).toBeGreaterThan(0);
  });

  it("reports applause during both applause phases", () => {
    const clock = new SceneClock(corpus);
    const base = EPOCH_MS + UNIT_MS * 4;
    expect(clock.stateAt(base + INTRO_MS + 500).applause).toBe(true);
    expect(clock.stateAt(base + UNIT_MS - 2_000).applause).toBe(true);
  });
});

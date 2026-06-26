import { beforeAll, describe, expect, it } from "vitest";
import { SpeechEngine } from "../../src/grammar/engine.ts";
import { SCENE_MS } from "../../src/grammar/config.ts";
import type { Corpus } from "../../src/grammar/types.ts";
import { loadCorpusFromDisk } from "../helpers/corpus.ts";

let corpus: Corpus;

beforeAll(() => {
  corpus = loadCorpusFromDisk();
});

describe("SpeechEngine", () => {
  it("loads every themed domain plus the rhetoric backbone", () => {
    expect(corpus.domains.length).toBeGreaterThanOrEqual(11);
    expect(corpus.rhetoric.openers.length).toBeGreaterThan(0);
  });

  it("regenerates an identical scene for the same seed and index", () => {
    const a = new SpeechEngine(corpus, "broadcast-001").generateScene(7);
    const b = new SpeechEngine(corpus, "broadcast-001").generateScene(7);
    expect(a).toEqual(b);
  });

  it("produces different speech for different seeds", () => {
    const a = new SpeechEngine(corpus, "monday").generateScene(7);
    const b = new SpeechEngine(corpus, "tuesday").generateScene(7);
    expect(a.utterances.map((u) => u.text)).not.toEqual(b.utterances.map((u) => u.text));
  });

  it("opens with an opener and closes with gratitude", () => {
    const scene = new SpeechEngine(corpus, "arc").generateScene(3);
    expect(scene.utterances[0]?.beat).toBe("opener");
    expect(scene.utterances.at(-1)?.beat).toBe("gratitude");
  });

  it("keeps a single topic for the whole scene", () => {
    const scene = new SpeechEngine(corpus, "topic").generateScene(12);
    const topics = new Set(scene.utterances.map((u) => u.topic));
    expect(topics.size).toBe(1);
    expect(scene.topic).toBe([...topics][0]);
  });

  it("introduces the product at the reveal, not before", () => {
    for (let i = 0; i < 20; i++) {
      const scene = new SpeechEngine(corpus, "callbacks").generateScene(i);
      const revealAt = scene.utterances.findIndex((u) => u.beat === "reveal");
      expect(revealAt).toBeGreaterThanOrEqual(0);
      const before = scene.utterances.slice(0, revealAt);
      for (const u of before) expect(u.text).not.toContain(scene.product);
    }
  });

  it("refers back to the product after the reveal", () => {
    let scenesWithCallback = 0;
    for (let i = 0; i < 20; i++) {
      const scene = new SpeechEngine(corpus, "callbacks").generateScene(i);
      const revealAt = scene.utterances.findIndex((u) => u.beat === "reveal");
      const after = scene.utterances.slice(revealAt + 1);
      if (after.some((u) => u.text.includes(scene.product))) scenesWithCallback++;
    }
    expect(scenesWithCallback).toBeGreaterThan(15);
  });

  it("never leaves an unresolved slot token", () => {
    for (let i = 0; i < 40; i++) {
      const scene = new SpeechEngine(corpus, "slots").generateScene(i);
      for (const u of scene.utterances) {
        expect(u.text, u.text).not.toMatch(/#\w+#/);
        expect(u.text.length).toBeGreaterThan(0);
        expect(u.nominalMs).toBeGreaterThan(0);
        expect(u.words.length).toBeGreaterThan(0);
      }
    }
  });

  it("fills roughly the target scene duration", () => {
    const scene = new SpeechEngine(corpus, "duration").generateScene(1);
    expect(scene.totalMs).toBeGreaterThan(SCENE_MS * 0.7);
    expect(scene.totalMs).toBeLessThan(SCENE_MS * 1.3);
  });

  it("drifts topics across many scenes", () => {
    const engine = new SpeechEngine(corpus, "drift");
    const topics = new Set<string>();
    for (let i = 0; i < 60; i++) topics.add(engine.generateScene(i).topic);
    expect(topics.size).toBeGreaterThan(3);
  });
});

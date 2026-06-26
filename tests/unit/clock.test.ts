import { describe, expect, it } from "vitest";
import {
  EPOCH_MS,
  locateScene,
  sceneIndexAtTime,
  speakingMsForScene,
  unitMsForScene,
} from "../../src/sync/clock.ts";
import { SPEAKING_MAX_MS, SPEAKING_MIN_MS } from "../../src/grammar/config.ts";

describe("broadcast clock", () => {
  it("gives each scene a speaking length of 8-12 minutes", () => {
    for (let i = 0; i < 50; i++) {
      const ms = speakingMsForScene(i);
      expect(ms).toBeGreaterThanOrEqual(SPEAKING_MIN_MS);
      expect(ms).toBeLessThan(SPEAKING_MAX_MS);
    }
    const lengths = new Set(Array.from({ length: 50 }, (_, i) => speakingMsForScene(i)));
    expect(lengths.size).toBeGreaterThan(10);
  });

  it("a unit is the keynote plus its fixed intro and applause windows", () => {
    for (let i = 0; i < 20; i++) {
      expect(unitMsForScene(i)).toBeGreaterThan(speakingMsForScene(i));
    }
  });

  it("scene 0 begins at the epoch", () => {
    expect(sceneIndexAtTime(EPOCH_MS)).toBe(0);
    expect(locateScene(EPOCH_MS).startMs).toBe(EPOCH_MS);
  });

  it("advances one scene per unit, with variable unit lengths", () => {
    let t = EPOCH_MS;
    for (let i = 0; i < 6; i++) {
      expect(sceneIndexAtTime(t + 1_000)).toBe(i);
      t += unitMsForScene(i);
    }
    expect(sceneIndexAtTime(t + 1_000)).toBe(6);
  });

  it("reports the exact unit boundaries for the located scene", () => {
    const t = EPOCH_MS + 4_000_000;
    const here = locateScene(t);
    expect(here.startMs).toBeLessThanOrEqual(t);
    expect(here.startMs + here.unitMs).toBeGreaterThan(t);
    expect(here.unitMs).toBe(unitMsForScene(here.index));
  });

  it("is deterministic regardless of the cached anchor's history", () => {
    // Jump far forward, then back, then forward again: the anchor walk must land
    // on the same answer as a direct query for any instant.
    const t = EPOCH_MS + 40_000_000;
    locateScene(EPOCH_MS + 90_000_000);
    locateScene(EPOCH_MS);
    const viaWalk = locateScene(t);
    expect(viaWalk.index).toBe(sceneIndexAtTime(t));
    expect(viaWalk.index).toBeGreaterThan(50);
  });

  it("never returns a negative index before the epoch", () => {
    expect(sceneIndexAtTime(EPOCH_MS - 1_000_000)).toBe(0);
  });
});

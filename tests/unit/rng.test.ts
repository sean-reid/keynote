import { describe, expect, it } from "vitest";
import { Rng, xmur3 } from "../../src/grammar/rng.ts";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng("infinite");
    const b = new Rng("infinite");
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("diverges for different seeds", () => {
    const a = Array.from({ length: 20 }, (_, i) => new Rng(`seed-${i}`).next());
    expect(new Set(a).size).toBe(a.length);
  });

  it("produces floats inside [0, 1)", () => {
    const rng = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("respects weights over a large sample", () => {
    const rng = new Rng("weights");
    const counts = [0, 0, 0];
    for (let i = 0; i < 10_000; i++) {
      const idx = rng.weightedIndex([1, 0, 3]);
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
    expect(counts[1]).toBe(0);
    expect(counts[2] ?? 0).toBeGreaterThan(counts[0] ?? 0);
  });

  it("hashes strings to stable 32-bit seeds", () => {
    expect(xmur3("abc")).toBe(xmur3("abc"));
    expect(xmur3("abc")).not.toBe(xmur3("abd"));
    expect(xmur3("abc")).toBeGreaterThanOrEqual(0);
  });
});

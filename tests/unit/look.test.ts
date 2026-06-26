import { describe, expect, it } from "vitest";
import { presenterLook } from "../../src/stage/look.ts";

describe("presenterLook", () => {
  it("is deterministic for a given persona and gender", () => {
    expect(presenterLook(42, "female")).toEqual(presenterLook(42, "female"));
    expect(presenterLook("Ada Vance", "female")).toEqual(presenterLook("Ada Vance", "female"));
  });

  it("varies across personas", () => {
    const looks = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(presenterLook(i, "male"))));
    expect(looks.size).toBeGreaterThan(10);
  });

  it("never gives female presenters facial hair, and never makes them bald", () => {
    for (let i = 0; i < 60; i++) {
      const look = presenterLook(i, "female");
      expect(look.facialHair).toBe("none");
      expect(["short", "medium", "long"]).toContain(look.hairStyle);
    }
  });

  it("keeps male hair styles to bald/short/medium with sane fields", () => {
    for (let i = 0; i < 60; i++) {
      const look = presenterLook(i, "male");
      expect(["bald", "short", "medium"]).toContain(look.hairStyle);
      expect(["none", "stubble", "beard"]).toContain(look.facialHair);
      expect(look.build).toBeGreaterThan(0.8);
      expect(look.build).toBeLessThan(1.2);
      expect(look.skin.startsWith("#")).toBe(true);
      expect(look.rimSide === 1 || look.rimSide === -1).toBe(true);
    }
  });
});

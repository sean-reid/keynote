import { describe, expect, it } from "vitest";
import { MouthTracker } from "../../src/stream/lipsync.ts";

const DT = 1 / 60;

function feed(tracker: MouthTracker, db: number, frames: number): number {
  let out = 0;
  for (let i = 0; i < frames; i++) out = tracker.update(db, DT);
  return out;
}

describe("MouthTracker", () => {
  it("is closed on silence and on non-finite input", () => {
    const t = new MouthTracker();
    expect(t.update(-Infinity, DT)).toBe(0);
    expect(t.update(NaN, DT)).toBe(0);
    expect(t.update(-90, DT)).toBe(0);
  });

  it("opens fully on a syllable at the recent peak", () => {
    const t = new MouthTracker();
    expect(t.update(-40, DT)).toBe(1);
  });

  it("closes for sounds well below the recent peak, whatever the absolute level", () => {
    for (const peak of [-20, -40, -55]) {
      const t = new MouthTracker();
      t.update(peak, DT);
      expect(t.update(peak - 19, DT)).toBe(0);
      expect(t.update(peak - 30, DT)).toBe(0);
    }
  });

  it("opens partially between the peak and the closed threshold", () => {
    const t = new MouthTracker();
    t.update(-30, DT);
    const mid = t.update(-36, DT);
    const low = t.update(-44, DT);
    expect(mid).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("re-opens for a quieter speaker once the old peak has relaxed", () => {
    const t = new MouthTracker();
    t.update(-20, DT);
    expect(t.update(-42, DT)).toBe(0);
    feed(t, -Infinity, 60 * 3);
    expect(t.update(-42, DT)).toBe(1);
  });

  it("stays shut through a short quiet stretch after a loud syllable", () => {
    const t = new MouthTracker();
    t.update(-30, DT);
    expect(feed(t, -50, 30)).toBeLessThan(0.05);
  });
});

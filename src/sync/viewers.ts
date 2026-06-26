// A plausible live viewer count. It is a pure function of the shared clock (so
// every viewer sees the same number) but reads as a jumpy random walk rather
// than a smooth wave: it sums several octaves of hash-based value noise, which
// looks like fractional Brownian motion (a wandering, twitchy line that drifts
// both up and down) instead of an obvious sinusoid.

/** Integer hash -> [0, 1). */
function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

/** Value noise in [-1, 1], linearly interpolated so it changes direction (and
 * visibly jumps) at each integer step rather than gliding like a sine. */
function noise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i);
  const b = hash(i + 1);
  return (a + (b - a) * f) * 2 - 1;
}

export function viewerCount(nowMs: number): number {
  const t = nowMs / 1000;

  // Slow audience level that wanders over many minutes.
  const base = 21_000 + noise(t / 540 + 9) * 8_000 + noise(t / 130 + 4) * 2_600;

  // Twitchy churn on shorter timescales; the fastest octave updates ~every
  // second, so the counter visibly ticks up and down like a live number.
  const churn =
    noise(t / 29 + 1) * 850 +
    noise(t / 8.5 + 2) * 380 +
    noise(t / 2.6 + 3) * 170 +
    noise(t / 0.9 + 5) * 70;

  return Math.max(1, Math.round(base + churn));
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

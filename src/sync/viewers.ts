// A plausible live viewer count. It is computed from the shared clock and scene,
// so every viewer sees the same number drifting the same way, with no backend.

import { Rng } from "../grammar/rng.ts";

export function viewerCount(nowMs: number, sceneIndex: number): number {
  const base = 6_000 + new Rng(`viewers|${sceneIndex}`).int(38_000);
  const seconds = nowMs / 1000;
  const wobble = Math.sin(seconds / 31) * 0.06 + Math.sin(seconds / 6.3) * 0.02;
  return Math.max(1, Math.round(base * (1 + wobble)));
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

// Compute which scenes to precompute. Without flags, prints the scene index that
// is live right now. With --plan, prints a JSON matrix of {from,to} shards
// covering [now, now+count) for the GitHub Actions matrix.

import { sceneIndexAtTime } from "../../src/sync/clock.ts";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? (process.argv[i + 1] as string) : fallback;
}

const base = sceneIndexAtTime(Date.now());

if (process.argv.includes("--plan")) {
  const count = Number(arg("count", "144"));
  const shards = Number(arg("shards", "12"));
  const per = Math.ceil(count / shards);
  const matrix: Array<{ from: number; to: number }> = [];
  for (let i = 0; i < shards; i++) {
    const from = base + i * per;
    const to = Math.min(base + count - 1, from + per - 1);
    if (from <= to) matrix.push({ from, to });
  }
  process.stdout.write(JSON.stringify(matrix));
} else {
  process.stdout.write(String(base));
}

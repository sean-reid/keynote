// Compute which scenes to precompute. Without flags, prints the scene index live
// right now. With --plan, prints a JSON matrix of {from,to} shards covering only
// the gap between what already exists and the buffer we want kept ahead of live,
// so scheduled runs generate just the new scenes and always stay ahead.

import { sceneIndexAtTime } from "../../src/sync/clock.ts";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? (process.argv[i + 1] as string) : fallback;
}

const base = sceneIndexAtTime(Date.now());

if (!process.argv.includes("--plan")) {
  process.stdout.write(String(base));
} else {
  const buffer = Number(arg("count", "288")); // scenes to keep ready ahead of live
  const shards = Number(arg("shards", "12"));
  const catalogUrl =
    process.env.KEYNOTE_CATALOG_URL ?? "https://keynote.dwainosaur.com/audio/index.json";

  // Discover how far content already reaches, so we only generate beyond it.
  let have = base - 1;
  try {
    const res = await fetch(catalogUrl, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = (await res.json()) as { max?: number };
      if (typeof data.max === "number" && data.max >= base) have = data.max;
    }
  } catch {
    // No reachable catalog (e.g. first ever run); generate the buffer from live.
  }

  const start = Math.max(base, have + 1);
  const end = base + buffer - 1;
  const matrix: Array<{ from: number; to: number }> = [];
  if (start <= end) {
    const per = Math.ceil((end - start + 1) / shards);
    for (let i = 0; i < shards; i++) {
      const from = start + i * per;
      const to = Math.min(end, from + per - 1);
      if (from <= to) matrix.push({ from, to });
    }
  }
  // Actions rejects an empty matrix; refresh the live scene when nothing is due.
  if (matrix.length === 0) matrix.push({ from: base, to: base });
  process.stdout.write(JSON.stringify(matrix));
}

// Precompute scene audio + manifests for a range of scenes.
//
//   node scripts/precompute/index.ts --from 0 --to 143 --out audio-out
//   KEYNOTE_TTS_STUB=1 node scripts/precompute/index.ts --from 0 --to 0   # local dry run

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadCorpusFromDisk } from "../../src/grammar/corpus.node.ts";
import { SpeechEngine } from "../../src/grammar/engine.ts";
import type { BroadcastIndex } from "../../src/audio/manifest.ts";
import { BROADCAST_SEED, unitMsForScene } from "../../src/sync/clock.ts";
import { buildScene } from "./scene.ts";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? (process.argv[i + 1] as string) : fallback;
}

const from = Number(arg("from", "0"));
const to = Number(arg("to", String(from)));
const seed = arg("seed", BROADCAST_SEED);
// Each scene fills its broadcast-clock unit so the audio lines up with the live
// timeline; --budget overrides the unit length for quick local runs.
const budgetOverride = process.argv.includes("--budget") ? Number(arg("budget", "0")) : null;
const outDir = arg("out", "audio-out");

mkdirSync(outDir, { recursive: true });
const engine = new SpeechEngine(loadCorpusFromDisk(), seed);

for (let scene = from; scene <= to; scene++) {
  const unitMs = budgetOverride ?? unitMsForScene(scene);
  const manifest = buildScene(engine, scene, seed, unitMs, outDir);
  const speechSegments = manifest.segments.filter((s) => s.kind === "speech").length;
  process.stdout.write(
    `scene ${scene}: ${(manifest.durationMs / 1000).toFixed(0)}s, ` +
      `${speechSegments} phrases -> ${outDir}/${scene}.mp3\n`,
  );
}

// A catalog of this run's range. The workflow recomputes a bucket-wide index
// after publishing; this keeps a single local run self-describing for the client.
const index: BroadcastIndex = { version: 1, min: from, max: to };
writeFileSync(join(outDir, "index.json"), JSON.stringify(index));


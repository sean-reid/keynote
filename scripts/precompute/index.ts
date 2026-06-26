// Precompute scene audio + manifests for a range of scenes.
//
//   node scripts/precompute/index.ts --from 0 --to 143 --out audio-out
//   KEYNOTE_TTS_STUB=1 node scripts/precompute/index.ts --from 0 --to 0   # local dry run

import { mkdirSync } from "node:fs";
import { loadCorpusFromDisk } from "../../src/grammar/corpus.node.ts";
import { SpeechEngine } from "../../src/grammar/engine.ts";
import { SPEAKING_MS } from "../../src/grammar/config.ts";
import { BROADCAST_SEED } from "../../src/sync/clock.ts";
import { buildScene } from "./scene.ts";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? (process.argv[i + 1] as string) : fallback;
}

const from = Number(arg("from", "0"));
const to = Number(arg("to", String(from)));
const seed = arg("seed", BROADCAST_SEED);
const budgetMs = Number(arg("budget", String(SPEAKING_MS)));
const outDir = arg("out", "audio-out");

mkdirSync(outDir, { recursive: true });
const engine = new SpeechEngine(loadCorpusFromDisk(), seed);

for (let scene = from; scene <= to; scene++) {
  const manifest = buildScene(engine, scene, seed, budgetMs, outDir);
  const speechSegments = manifest.segments.filter((s) => s.kind === "speech").length;
  process.stdout.write(
    `scene ${scene}: ${(manifest.durationMs / 1000).toFixed(0)}s, ` +
      `${speechSegments} phrases -> ${outDir}/${scene}.mp3\n`,
  );
}

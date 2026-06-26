// Download the Piper voice models the pipeline needs into PIPER_MODELS (default
// data/.piper-models). Idempotent: skips files already present (so CI can cache).

import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_VOICES, configUrl, modelUrl } from "./voices.ts";

const dir = process.env.PIPER_MODELS ?? join("data", ".piper-models");
mkdirSync(dir, { recursive: true });

async function fetchTo(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) {
    process.stdout.write(`have ${dest}\n`);
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  process.stdout.write(`saved ${dest}\n`);
}

for (const v of ALL_VOICES) {
  await fetchTo(modelUrl(v), join(dir, `${v.id}.onnx`));
  await fetchTo(configUrl(v), join(dir, `${v.id}.onnx.json`));
}
process.stdout.write(`done: ${ALL_VOICES.length} voices in ${dir}\n`);

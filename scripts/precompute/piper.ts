// Thin wrapper around the native Piper CLI. Set KEYNOTE_TTS_STUB=1 to synthesize
// silence (sized by word count) instead - lets the pipeline be validated locally
// without Piper installed; CI runs the real binary.

import { execFileSync } from "node:child_process";
import { join } from "node:path";

const PIPER_BIN = process.env.PIPER_BIN ?? "piper";
const MODELS_DIR = process.env.PIPER_MODELS ?? join("data", ".piper-models");
const STUB = process.env.KEYNOTE_TTS_STUB === "1";

/** Synthesize `text` with the given voice model into a wav file. */
export function synth(text: string, voiceId: string, outWav: string): void {
  if (STUB) {
    synthStub(text, outWav);
    return;
  }
  const model = join(MODELS_DIR, `${voiceId}.onnx`);
  execFileSync(PIPER_BIN, ["--model", model, "--output_file", outWav], { input: text });
}

function synthStub(text: string, outWav: string): void {
  const words = text.split(/\s+/).filter(Boolean).length;
  const seconds = Math.max(0.6, words * 0.33 + 0.4);
  execFileSync("ffmpeg", [
    "-nostdin", "-loglevel", "error",
    "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono",
    "-t", seconds.toFixed(2), "-y", outWav,
  ]);
}

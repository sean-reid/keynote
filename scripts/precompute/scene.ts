// Build one scene's audio: announcer intro -> applause -> speaker phrases (with a
// short applause after applause-flagged lines) -> closing applause, concatenated
// into a single mp3, plus a timing manifest. Phrases fill the speaking budget by
// REAL audio duration so the scene stays within a fixed wall-clock unit.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SpeechEngine } from "../../src/grammar/engine.ts";
import type { AudioSegment, SceneManifest } from "../../src/audio/manifest.ts";
import { Rng } from "../../src/grammar/rng.ts";
import { ANNOUNCER, speakerVoice } from "./voices.ts";
import { synth } from "./piper.ts";

const APPLAUSE_DIR = join("data", "audio", "applause");

function applauseClips(prefix: string): string[] {
  return readdirSync(APPLAUSE_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".mp3"))
    .sort()
    .map((f) => join(APPLAUSE_DIR, f));
}

const SHORT_APPLAUSE = applauseClips("applause-short-");
const LONG_APPLAUSE = applauseClips("applause-long-");

function durationMs(file: string): number {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
  ]);
  return Math.round(parseFloat(out.toString().trim()) * 1000);
}

function concatToMp3(parts: string[], outMp3: string): void {
  const inputs = parts.flatMap((p) => ["-i", p]);
  const filter = `${parts.map((_, i) => `[${i}:a]`).join("")}concat=n=${parts.length}:v=0:a=1[out]`;
  execFileSync("ffmpeg", [
    "-nostdin", "-loglevel", "error",
    ...inputs,
    "-filter_complex", filter, "-map", "[out]",
    "-ar", "22050", "-ac", "1", "-b:a", "64k", "-y", outMp3,
  ]);
}

export function buildScene(
  engine: SpeechEngine,
  sceneIndex: number,
  seed: string,
  speakingBudgetMs: number,
  outDir: string,
): SceneManifest {
  const scene = engine.generateScene(sceneIndex, speakingBudgetMs);
  const tmp = mkdtempSync(join(tmpdir(), `kn-scene-${sceneIndex}-`));
  const applauseRng = new Rng(`${seed}|applause|${sceneIndex}`);
  const parts: string[] = [];
  const segments: AudioSegment[] = [];
  let cursor = 0;

  const append = (file: string, kind: AudioSegment["kind"], text: string, utteranceIndex: number): void => {
    const dur = durationMs(file);
    segments.push({ kind, startMs: cursor, durationMs: dur, text: kind === "applause" ? "" : text, utteranceIndex });
    cursor += dur;
    parts.push(file);
  };

  // A varied applause clip, chosen deterministically per scene.
  const applause = (clips: string[]): void => {
    if (clips.length > 0) append(applauseRng.pick(clips), "applause", "", -1);
  };

  // Announcer introduces the speaker, then a short applause as they walk on.
  const introWav = join(tmp, "intro.wav");
  synth(scene.intro.text, ANNOUNCER.id, introWav);
  append(introWav, "intro", scene.intro.text, -1);
  applause(SHORT_APPLAUSE);

  // Speaker phrases, fitting the speaking budget by real audio duration.
  const voiceId = speakerVoice(scene.speaker.gender, scene.speaker.persona).id;
  for (let i = 0; i < scene.utterances.length; i++) {
    if (cursor >= speakingBudgetMs) break;
    const u = scene.utterances[i];
    if (!u) break;
    const wav = join(tmp, `u${i}.wav`);
    synth(u.text, voiceId, wav);
    append(wav, "speech", u.text, i);
    if (u.applause) applause(SHORT_APPLAUSE);
  }

  // Closing ovation.
  applause(LONG_APPLAUSE);

  const outMp3 = join(outDir, `${sceneIndex}.mp3`);
  concatToMp3(parts, outMp3);
  rmSync(tmp, { recursive: true, force: true });

  const manifest: SceneManifest = {
    version: 1,
    scene: sceneIndex,
    seed,
    topic: scene.topic,
    topicLabel: scene.topicLabel,
    company: scene.company,
    product: scene.product,
    tagline: scene.tagline,
    speaker: { name: scene.speaker.name, title: scene.speaker.title, gender: scene.speaker.gender },
    durationMs: cursor,
    segments,
  };
  writeFileSync(join(outDir, `${sceneIndex}.json`), JSON.stringify(manifest));
  return manifest;
}

// Build one scene's audio: announcer intro -> applause -> speaker phrases (with a
// short applause after applause-flagged lines) -> closing applause, concatenated
// into a single mp3, plus a timing manifest. Phrases fill the scene's unit by
// REAL audio duration, stopping before the reserved closing ovation so the
// speaker is never cut off, so the audio lines up with the broadcast clock.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SpeechEngine } from "../../src/grammar/engine.ts";
import type { AudioSegment, SceneManifest } from "../../src/audio/manifest.ts";
import { Rng } from "../../src/grammar/rng.ts";
import { END_APPLAUSE_MS } from "../../src/sync/clock.ts";
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
  unitMs: number,
  outDir: string,
): SceneManifest {
  const scene = engine.generateScene(sceneIndex, unitMs);
  const tmp = mkdtempSync(join(tmpdir(), `kn-scene-${sceneIndex}-`));
  const applauseRng = new Rng(`${seed}|applause|${sceneIndex}`);
  const parts: string[] = [];
  const segments: AudioSegment[] = [];
  let cursor = 0;

  const append = (
    file: string,
    kind: AudioSegment["kind"],
    text: string,
    utteranceIndex: number,
    dur = durationMs(file),
  ): void => {
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

  // Reserve a window for the closing ovation so the speaker is never cut for it.
  const speakLimit = Math.max(cursor, unitMs - END_APPLAUSE_MS);

  // Speaker phrases, filling the speaking window by real audio duration. A phrase
  // is only added if it finishes before the ovation, so the speaker is never cut.
  // Applause after a flagged line is deferred to the next phrase, so the final
  // line's clap merges into the closing ovation instead of playing as a separate
  // short burst right before it.
  const voiceId = speakerVoice(scene.speaker.gender, scene.speaker.persona).id;
  let spoken = 0;
  let pendingApplause = false;
  for (let i = 0; i < scene.utterances.length && cursor < speakLimit; i++) {
    const u = scene.utterances[i];
    if (!u) break;
    if (pendingApplause) {
      applause(SHORT_APPLAUSE);
      pendingApplause = false;
      if (cursor >= speakLimit) break;
    }
    const wav = join(tmp, `u${i}.wav`);
    synth(u.text, voiceId, wav);
    const dur = durationMs(wav);
    if (spoken > 0 && cursor + dur > speakLimit) break;
    append(wav, "speech", u.text, i, dur);
    spoken++;
    pendingApplause = u.applause;
  }

  // A single closing ovation clip (no looping, which sounds like a short clip on
  // repeat). A brief settle before the next speaker is fine; the broadcast clock
  // holds the last frame to the unit boundary.
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
    speaker: {
      name: scene.speaker.name,
      title: scene.speaker.title,
      gender: scene.speaker.gender,
      persona: scene.speaker.persona,
    },
    durationMs: cursor,
    segments,
  };
  writeFileSync(join(outDir, `${sceneIndex}.json`), JSON.stringify(manifest));
  return manifest;
}

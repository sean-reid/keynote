// Map a speaker to a Piper voice. Each voice is a separate ~60 MB model that
// streams from the CDN and is cached in the browser, so the set is kept small:
// two voices per gender for variety, plus a distinct deep voice for the
// off-camera announcer.

import type { VoiceId } from "@diffusionstudio/vits-web";
import type { SpeakOptions } from "./types.ts";

const FEMALE: VoiceId[] = ["en_US-amy-medium", "en_US-hfc_female-medium"];
const MALE: VoiceId[] = ["en_US-ryan-medium", "en_US-hfc_male-medium"];
const ANNOUNCER: VoiceId = "en_GB-northern_english_male-medium";

/** The voice warmed up first (also a speaker voice). */
export const PIPER_DEFAULT: VoiceId = "en_US-ryan-medium";

/** Every voice the broadcast can use, for background prefetching. */
export const PIPER_VOICES: VoiceId[] = [...new Set([...FEMALE, ...MALE, ANNOUNCER])];

export function piperVoice(opts: SpeakOptions): VoiceId {
  if (opts.kind === "announcer") return ANNOUNCER;
  const list = opts.gender === "female" ? FEMALE : MALE;
  return list[(opts.persona ?? 0) % list.length] as VoiceId;
}

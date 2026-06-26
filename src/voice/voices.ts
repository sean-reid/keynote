// Map a speaker to a Kokoro neural voice. Kokoro's voices are gendered, so this
// keeps the voice consistent with the speaker's name and gender, with variety
// across speakers and a deep, fixed voice for the off-camera announcer.

import type { SpeakOptions } from "./speech.ts";

const FEMALE = ["af_heart", "af_bella", "af_nicole", "af_sarah", "af_aoede", "af_kore", "bf_emma", "bf_isabella"];
const MALE = ["am_michael", "am_eric", "am_liam", "am_adam", "am_fenrir", "bm_george", "bm_lewis"];
const ANNOUNCER = "am_onyx"; // deep, resonant

export function kokoroVoice(opts: SpeakOptions): string {
  if (opts.kind === "announcer") return ANNOUNCER;
  const list = opts.gender === "female" ? FEMALE : MALE;
  return list[(opts.persona ?? 0) % list.length] as string;
}

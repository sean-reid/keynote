// The Piper voices the pipeline uses, with their Hugging Face model paths.
//
// We use every single-speaker English voice that ships a medium-quality model.
// Medium keeps synthesis fast (the pipeline runs nightly over many scenes) while
// still sounding natural. Voices are split by gender so a speaker's voice matches
// their name, and the announcer has a dedicated voice that never appears in the
// speaker pool, so the off-camera intro is always a distinct person.
//
// Excluded on purpose: multi-speaker models (no single gender to match) and
// voices that only ship a "low" model (below the medium quality bar).

export interface PiperVoiceInfo {
  /** Model id, e.g. "en_US-ryan-medium"; the .onnx file is named after it. */
  readonly id: string;
  /** Subpath under the piper-voices repo, e.g. "en/en_US/ryan/medium". */
  readonly path: string;
}

const voice = (id: string, path: string): PiperVoiceInfo => ({ id, path });

/** Off-camera announcer who introduces every speaker; kept out of the pools
 * below so it is never mistaken for one of the presenters. */
export const ANNOUNCER: PiperVoiceInfo = voice("en_US-norman-medium", "en/en_US/norman/medium");

export const FEMALE: PiperVoiceInfo[] = [
  voice("en_US-amy-medium", "en/en_US/amy/medium"),
  voice("en_US-hfc_female-medium", "en/en_US/hfc_female/medium"),
  voice("en_US-kristin-medium", "en/en_US/kristin/medium"),
  voice("en_US-lessac-medium", "en/en_US/lessac/medium"),
  voice("en_US-ljspeech-medium", "en/en_US/ljspeech/medium"),
  voice("en_US-sam-medium", "en/en_US/sam/medium"),
  voice("en_GB-alba-medium", "en/en_GB/alba/medium"),
  voice("en_GB-cori-medium", "en/en_GB/cori/medium"),
  voice("en_GB-jenny_dioco-medium", "en/en_GB/jenny_dioco/medium"),
];

export const MALE: PiperVoiceInfo[] = [
  voice("en_US-bryce-medium", "en/en_US/bryce/medium"),
  voice("en_US-hfc_male-medium", "en/en_US/hfc_male/medium"),
  voice("en_US-joe-medium", "en/en_US/joe/medium"),
  voice("en_US-john-medium", "en/en_US/john/medium"),
  voice("en_US-kusal-medium", "en/en_US/kusal/medium"),
  voice("en_US-reza_ibrahim-medium", "en/en_US/reza_ibrahim/medium"),
  voice("en_US-ryan-medium", "en/en_US/ryan/medium"),
  voice("en_GB-alan-medium", "en/en_GB/alan/medium"),
  voice("en_GB-northern_english_male-medium", "en/en_GB/northern_english_male/medium"),
];

export const ALL_VOICES: PiperVoiceInfo[] = [
  ...new Map([...FEMALE, ...MALE, ANNOUNCER].map((v) => [v.id, v])).values(),
];

export function speakerVoice(gender: "male" | "female", persona: number): PiperVoiceInfo {
  const list = gender === "female" ? FEMALE : MALE;
  return list[persona % list.length] as PiperVoiceInfo;
}

const HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main";

export function modelUrl(v: PiperVoiceInfo): string {
  return `${HF_BASE}/${v.path}/${v.id}.onnx`;
}

export function configUrl(v: PiperVoiceInfo): string {
  return `${HF_BASE}/${v.path}/${v.id}.onnx.json`;
}

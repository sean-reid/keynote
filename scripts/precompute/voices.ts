// The Piper voices the pipeline uses, with their Hugging Face model paths.
// High-quality where a "-high" model exists; the announcer reuses the flagship
// male voice (the only high-quality single-speaker male in Piper's catalog).

export interface PiperVoiceInfo {
  /** Model id, e.g. "en_US-ryan-high"; the .onnx file is named after it. */
  readonly id: string;
  /** Subpath under the piper-voices repo, e.g. "en/en_US/ryan/high". */
  readonly path: string;
}

const voice = (id: string, path: string): PiperVoiceInfo => ({ id, path });

export const FEMALE: PiperVoiceInfo[] = [
  voice("en_US-lessac-high", "en/en_US/lessac/high"),
  voice("en_US-ljspeech-high", "en/en_US/ljspeech/high"),
];

export const MALE: PiperVoiceInfo[] = [
  voice("en_US-ryan-high", "en/en_US/ryan/high"),
  voice("en_US-hfc_male-medium", "en/en_US/hfc_male/medium"),
];

export const ANNOUNCER: PiperVoiceInfo = MALE[0] as PiperVoiceInfo; // en_US-ryan-high

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

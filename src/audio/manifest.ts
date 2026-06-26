// The contract between the audio pipeline (writer) and the client (reader).
// Each precomputed scene is one mp3 plus a SceneManifest describing the timing
// of every segment inside it, so the client can drive captions and applause
// without re-running any synthesis.

export type SegmentKind = "intro" | "speech" | "applause";

export interface AudioSegment {
  kind: SegmentKind;
  /** Offset of this segment within the scene's audio file, in milliseconds. */
  startMs: number;
  durationMs: number;
  /** Caption text for intro/speech segments; empty for applause. */
  text: string;
  /** Index into the scene's speaker utterances for speech segments, else -1. */
  utteranceIndex: number;
}

export interface SceneAudioSpeaker {
  name: string;
  title: string;
  gender: "male" | "female";
}

export interface SceneManifest {
  /** Format version, so the client can reject incompatible manifests. */
  version: 1;
  scene: number;
  seed: string;
  topic: string;
  topicLabel: string;
  company: string;
  product: string;
  tagline: string;
  speaker: SceneAudioSpeaker;
  /** Total duration of the scene's audio file, in milliseconds. */
  durationMs: number;
  segments: AudioSegment[];
}

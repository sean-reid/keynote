export type VoiceKind = "announcer" | "speaker";

export interface SpeakOptions {
  kind: VoiceKind;
  persona?: number;
  gender?: "male" | "female";
}

/** A speech backend. The engine picks the best available one and falls back. */
export interface VoiceProvider {
  /** Create/resume audio within a user gesture (for backends that need it). */
  unlock(): void;
  /** Prepare the backend (load models, etc). Resolves to whether it is usable. */
  init(): Promise<boolean>;
  /** True once the backend is loaded and healthy. */
  readonly usable: boolean;
  speak(text: string, opts: SpeakOptions, onEnd: () => void): void;
  cancel(): void;
}

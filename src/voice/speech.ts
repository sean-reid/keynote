// Best-effort speech via the browser's built-in Web Speech API. This is the
// zero-cost, zero-download voice path that works everywhere; a neural voice can
// be layered on later for capable devices. Captions remain the source of truth,
// so if the audio drifts or is muted, the broadcast still reads correctly.

export type VoiceKind = "announcer" | "speaker";

export interface SpeakOptions {
  kind: VoiceKind;
  persona?: number;
  gender?: "male" | "female";
}

const MALE_HINTS = /\b(male|david|daniel|alex|fred|james|george|guy|aaron|arthur|rishi|reed)\b/i;
const FEMALE_HINTS = /\b(female|samantha|victoria|karen|tessa|moira|fiona|serena|zira|susan)\b/i;

export class Voice {
  private synth: SpeechSynthesis | null =
    typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
  private voices: SpeechSynthesisVoice[] = [];
  private current: SpeechSynthesisUtterance | null = null;
  enabled = false;

  constructor() {
    if (!this.synth) return;
    const load = (): void => {
      this.voices = this.synth?.getVoices() ?? [];
    };
    load();
    this.synth.addEventListener("voiceschanged", load);
  }

  get available(): boolean {
    return this.synth !== null;
  }

  /** Must be called from a user gesture to satisfy autoplay policies. */
  enable(): void {
    if (!this.synth || this.enabled) return;
    this.enabled = true;
    // A silent priming utterance unlocks audio on iOS/Safari.
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    this.synth.speak(u);
  }

  cancel(): void {
    this.current = null;
    this.synth?.cancel();
  }

  speak(text: string, opts: SpeakOptions, onEnd?: () => void): void {
    if (!this.synth || !this.enabled || !text) {
      onEnd?.();
      return;
    }
    this.synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = this.pickVoice(opts);
    if (voice) u.voice = voice;

    const p = opts.persona ?? 0;
    if (opts.kind === "announcer") {
      u.pitch = 0.6; // deep, off-camera announcer
      u.rate = 0.96;
    } else if (opts.gender === "female") {
      u.pitch = 1.05 + ((p % 40) / 40) * 0.35;
      u.rate = 0.95 + ((Math.floor(p / 40) % 20) / 20) * 0.16;
    } else {
      u.pitch = 0.78 + ((p % 40) / 40) * 0.22;
      u.rate = 0.94 + ((Math.floor(p / 40) % 20) / 20) * 0.16;
    }
    this.current = u;
    u.addEventListener("end", () => {
      if (this.current === u) this.current = null;
      onEnd?.();
    });
    this.synth.speak(u);
  }

  private pickVoice(opts: SpeakOptions): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) return null;
    const english = this.voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
    const pool = english.length > 0 ? english : this.voices;

    if (opts.kind === "announcer") {
      return pool.find((v) => MALE_HINTS.test(v.name)) ?? (pool[0] as SpeechSynthesisVoice);
    }
    const persona = opts.persona ?? 0;
    const ranked = [...pool].sort((a, b) => a.name.localeCompare(b.name));
    // Match the voice to the speaker's gender so the name and voice agree.
    const hint = opts.gender === "female" ? FEMALE_HINTS : MALE_HINTS;
    const matched = ranked.filter((v) => hint.test(v.name));
    const list = matched.length > 0 ? matched : ranked;
    return list[persona % list.length] as SpeechSynthesisVoice;
  }
}

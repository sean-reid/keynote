// Best-effort speech via the browser's built-in Web Speech API. This is the
// zero-cost, zero-download voice path that works everywhere; a neural voice can
// be layered on later for capable devices. Captions remain the source of truth,
// so if the audio drifts or is muted, the broadcast still reads correctly.

export type VoiceKind = "announcer" | "speaker";

interface SpeakOptions {
  kind: VoiceKind;
  persona?: number;
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

    if (opts.kind === "announcer") {
      u.pitch = 0.6; // deep, off-camera announcer
      u.rate = 0.96;
    } else {
      // Vary per speaker so each keynote sounds like a different person.
      const p = opts.persona ?? 0;
      u.pitch = 0.85 + ((p % 50) / 50) * 0.7;
      u.rate = 0.94 + ((Math.floor(p / 50) % 20) / 20) * 0.18;
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
    // Prefer a varied voice, leaning on whatever the platform offers.
    const ranked = [...pool].sort((a, b) => a.name.localeCompare(b.name));
    const preferred = ranked.filter((v) => MALE_HINTS.test(v.name) || FEMALE_HINTS.test(v.name));
    const list = preferred.length > 1 ? preferred : ranked;
    return list[persona % list.length] as SpeechSynthesisVoice;
  }
}

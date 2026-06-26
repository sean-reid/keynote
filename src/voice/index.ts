// Unified voice: a high-quality Piper (WASM, CPU) voice once it has loaded, with
// the browser's Web Speech voice as the immediate, universal fallback. No WebGPU.

import { PiperVoice } from "./piper.ts";
import { WebSpeechVoice } from "./speech.ts";
import type { SpeakOptions } from "./types.ts";

export type { SpeakOptions } from "./types.ts";

export class VoiceEngine {
  private readonly web = new WebSpeechVoice();
  private readonly piper = new PiperVoice();
  enabled = false;

  get available(): boolean {
    return PiperVoice.supported() || this.web.usable;
  }

  /** Must be called from a user gesture. Unlocks audio and starts loading Piper. */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.web.unlock();
    if (PiperVoice.supported()) {
      this.piper.unlock();
      void this.piper.init();
    }
  }

  /** True once the upgraded Piper voice is active. */
  get usingPiper(): boolean {
    return this.piper.usable;
  }

  speak(text: string, opts: SpeakOptions, onEnd: () => void): void {
    if (!this.enabled) {
      onEnd();
      return;
    }
    if (this.piper.usable) {
      this.web.cancel();
      this.piper.speak(text, opts, onEnd);
    } else {
      this.web.speak(text, opts, onEnd);
    }
  }

  cancel(): void {
    this.web.cancel();
    this.piper.cancel();
  }
}

// Unified voice: prefers the neural voice (Kokoro/WebGPU) once it has loaded,
// and uses the browser's Web Speech voice everywhere else and while loading.

import { NeuralVoice } from "./neural.ts";
import { Voice } from "./speech.ts";
import type { SpeakOptions } from "./speech.ts";

export type { SpeakOptions } from "./speech.ts";

export class VoiceEngine {
  private readonly web = new Voice();
  private readonly neural = new NeuralVoice();
  private neuralReady = false;
  enabled = false;

  get available(): boolean {
    return this.web.available || NeuralVoice.supported();
  }

  /** Must be called from a user gesture. Starts loading the neural voice. */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.web.enable();
    if (NeuralVoice.supported()) {
      void this.neural.load().then((ok) => {
        this.neuralReady = ok;
        if (ok) void this.neural.resume();
      });
    }
  }

  /** True once the upgraded neural voice is active. */
  get usingNeural(): boolean {
    return this.neuralReady && this.neural.ready;
  }

  speak(text: string, opts: SpeakOptions, onEnd?: () => void): void {
    if (!this.enabled) {
      onEnd?.();
      return;
    }
    if (this.usingNeural) {
      this.web.cancel();
      void this.neural.speak(text, opts, onEnd);
    } else {
      this.web.speak(text, opts, onEnd);
    }
  }

  cancel(): void {
    this.web.cancel();
    this.neural.cancel();
  }
}

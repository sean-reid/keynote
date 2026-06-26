// High-quality neural speech (Kokoro-82M) running in the browser via WebGPU.
// The model (~160 MB) streams from the Hugging Face CDN on first use and is
// cached by the browser. Gated to WebGPU; callers fall back to Web Speech when
// this is unavailable or still loading.

import { kokoroVoice } from "./voices.ts";
import type { SpeakOptions } from "./speech.ts";

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

export class NeuralVoice {
  private tts: import("kokoro-js").KokoroTTS | null = null;
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private loadPromise: Promise<boolean> | null = null;
  private token = 0;
  ready = false;

  static supported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      "gpu" in navigator &&
      typeof AudioContext !== "undefined"
    );
  }

  /** Load the model once (single-flight). Resolves to whether it is usable. */
  load(): Promise<boolean> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      try {
        const { KokoroTTS } = await import("kokoro-js");
        this.tts = await KokoroTTS.from_pretrained(MODEL, { dtype: "fp16", device: "webgpu" });
        this.ctx = new AudioContext();
        this.ready = true;
        return true;
      } catch (err) {
        console.error("neural voice unavailable", err);
        this.ready = false;
        return false;
      }
    })();
    return this.loadPromise;
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
  }

  async speak(text: string, opts: SpeakOptions, onEnd?: () => void): Promise<void> {
    if (!this.ready || !this.tts || !this.ctx || !text) {
      onEnd?.();
      return;
    }
    const myToken = ++this.token;
    try {
      const out = await this.tts.generate(text, { voice: kokoroVoice(opts) });
      // Cancelled (muted / superseded) while generating.
      if (myToken !== this.token || !this.ctx) {
        onEnd?.();
        return;
      }
      const buffer = this.ctx.createBuffer(1, out.audio.length, out.sampling_rate);
      buffer.getChannelData(0).set(out.audio);
      this.stop();
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.ctx.destination);
      src.onended = (): void => {
        if (this.source === src) this.source = null;
        onEnd?.();
      };
      this.source = src;
      src.start();
    } catch (err) {
      console.error("neural speak failed", err);
      onEnd?.();
    }
  }

  cancel(): void {
    this.token++;
    this.stop();
  }

  private stop(): void {
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
      } catch {
        // already stopped
      }
      this.source = null;
    }
  }
}

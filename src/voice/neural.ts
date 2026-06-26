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
  healthy = true;

  static supported(): boolean {
    const ok =
      typeof navigator !== "undefined" &&
      "gpu" in navigator &&
      typeof AudioContext !== "undefined";
    if (!ok) console.warn("[voice] WebGPU unavailable - using the standard voice");
    return ok;
  }

  /** Create and resume the AudioContext. MUST be called from a user gesture so
   * the context starts running rather than suspended (otherwise playback is
   * silent). The model itself loads separately via load(). */
  unlock(): void {
    if (typeof AudioContext === "undefined") return;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Load the model once (single-flight). Resolves to whether it is usable. */
  load(onProgress?: (percent: number) => void): Promise<boolean> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      try {
        const { KokoroTTS } = await import("kokoro-js");
        this.tts = await KokoroTTS.from_pretrained(MODEL, {
          dtype: "fp32", // the supported WebGPU dtype for Kokoro
          device: "webgpu",
          progress_callback: (e) => {
            if (typeof e.progress === "number") onProgress?.(Math.round(e.progress));
          },
        });
        if (!this.ctx) this.ctx = new AudioContext();
        // Warm up: the first WebGPU generation compiles shaders and is slow, so do
        // it here (during "loading") rather than letting the first real phrase
        // time out. A long budget covers cold-start; if it can't warm up, fall back.
        const warm = this.tts.generate("Welcome to the keynote.", { voice: "am_onyx" });
        await Promise.race([
          warm,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("warmup timed out")), 60_000),
          ),
        ]);
        this.ready = true;
        console.warn("[voice] HD neural voice ready");
        return true;
      } catch (err) {
        console.error("[voice] neural voice failed to load - using the standard voice", err);
        this.ready = false;
        return false;
      }
    })();
    return this.loadPromise;
  }

  async speak(text: string, opts: SpeakOptions, onEnd?: () => void): Promise<void> {
    if (!this.ready || !this.tts || !this.ctx || !text) {
      onEnd?.();
      return;
    }
    const myToken = ++this.token;
    try {
      const generated = this.tts.generate(text, { voice: kokoroVoice(opts) });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("neural generate timed out")), 12_000),
      );
      const out = await Promise.race([generated, timeout]);
      // Cancelled (muted / superseded) while generating.
      if (myToken !== this.token || !this.ctx) {
        onEnd?.();
        return;
      }
      if (this.ctx.state === "suspended") await this.ctx.resume();
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
      // Mark unhealthy so the engine falls back to the standard voice from here on.
      this.healthy = false;
      console.error("[voice] neural generation failed - reverting to standard voice", err);
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

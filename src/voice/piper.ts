// High-quality neural speech via Piper (VITS) running in the browser on the CPU
// through WebAssembly - no WebGPU, so it works in Safari. Voice models stream
// from the CDN and are cached in the browser (OPFS). Inference runs in a worker.

import { PIPER_DEFAULT, PIPER_VOICES, piperVoice } from "./voices.ts";
import type { SpeakOptions, VoiceProvider } from "./types.ts";

type Vits = typeof import("@diffusionstudio/vits-web");

export class PiperVoice implements VoiceProvider {
  private vits: Vits | null = null;
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private loadPromise: Promise<boolean> | null = null;
  private token = 0;
  private ready = false;
  private healthy = true;

  static supported(): boolean {
    return (
      typeof AudioContext !== "undefined" &&
      typeof Worker !== "undefined" &&
      typeof WebAssembly !== "undefined"
    );
  }

  get usable(): boolean {
    return this.ready && this.healthy;
  }

  unlock(): void {
    if (typeof AudioContext === "undefined") return;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  init(): Promise<boolean> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      try {
        this.vits = await import("@diffusionstudio/vits-web");
        // Warm up the default voice (downloads the model + compiles the wasm).
        await this.vits.predict({ text: "Welcome to the keynote.", voiceId: PIPER_DEFAULT });
        if (!this.ctx) this.ctx = new AudioContext();
        this.ready = true;
        console.warn("[voice] HD Piper voice ready");
        // Prefetch the other voices in the background so speaker changes are smooth.
        for (const id of PIPER_VOICES) {
          if (id !== PIPER_DEFAULT) void this.vits.download(id).catch(() => undefined);
        }
        return true;
      } catch (err) {
        console.error("[voice] Piper failed to load - using the standard voice", err);
        this.ready = false;
        return false;
      }
    })();
    return this.loadPromise;
  }

  speak(text: string, opts: SpeakOptions, onEnd: () => void): void {
    void this.run(text, opts, onEnd);
  }

  private async run(text: string, opts: SpeakOptions, onEnd: () => void): Promise<void> {
    if (!this.ready || !this.vits || !this.ctx || !text) {
      onEnd();
      return;
    }
    const myToken = ++this.token;
    try {
      const blob = await Promise.race([
        this.vits.predict({ text, voiceId: piperVoice(opts) }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("piper generate timed out")), 30_000),
        ),
      ]);
      if (myToken !== this.token || !this.ctx) {
        onEnd();
        return;
      }
      const buffer = await this.ctx.decodeAudioData(await blob.arrayBuffer());
      if (myToken !== this.token || !this.ctx) {
        onEnd();
        return;
      }
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.stop();
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.ctx.destination);
      src.onended = (): void => {
        if (this.source === src) this.source = null;
        onEnd();
      };
      this.source = src;
      src.start();
    } catch (err) {
      this.healthy = false;
      console.error("[voice] Piper generation failed - reverting to standard voice", err);
      onEnd();
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

// Minimal type surface for kokoro-js (the package ships no types). Only the bits
// this project uses are declared.
declare module "kokoro-js" {
  export interface RawAudio {
    audio: Float32Array;
    sampling_rate: number;
  }
  export class KokoroTTS {
    static from_pretrained(
      model: string,
      options?: { dtype?: string; device?: string },
    ): Promise<KokoroTTS>;
    generate(text: string, options?: { voice?: string }): Promise<RawAudio>;
  }
}

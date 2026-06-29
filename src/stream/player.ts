// Streams precomputed keynote audio in lock-step with the broadcast clock.
//
// The clock decides which scene is live and how far into it we are; the player
// fetches that scene's mp3 + manifest, seeks the audio to the wall-clock offset
// (so late joiners land mid-talk in sync), and keeps it from drifting. Captions
// come from the manifest, so they match what is heard. If the pipeline ever
// falls behind the clock, the player loops over the scenes that do exist.

import { locateScene } from "../sync/clock.ts";
import type { AudioSegment, BroadcastIndex, SceneManifest } from "../audio/manifest.ts";

const AUDIO_BASE = "/audio";
// Re-seek only on a large desync (late join, throttled tab). A tight tolerance
// made the player chase the clock while a fresh scene was still buffering, which
// skipped the announcer's first words until it stabilized.
const DRIFT_TOLERANCE_MS = 2_500;
// Grace period after loading a scene before any drift correction, so the opening
// announcer plays from the start instead of being seeked through while buffering.
const SETTLE_MS = 3_000;
const PREFETCH_LEAD_MS = 45_000; // warm the next scene this long before it starts
const CATALOG_TTL_MS = 30_000; // how often to re-check the available window
const KEEP_BEHIND = 2; // manifests to retain on each side of the live scene
const KEEP_AHEAD = 4;

export type StreamPhase = "intro" | "speaking" | "applause";

export interface ActiveLine {
  text: string;
  role: "announcer" | "speaker";
}

export interface StreamFrame {
  /** Metadata of the scene whose audio is playing. */
  manifest: SceneManifest;
  /** The live scene index on the clock (drives viewer count + scene changes). */
  sceneIndex: number;
  /** Playback position within the scene audio, in ms. */
  positionMs: number;
  phase: StreamPhase;
  applause: boolean;
  line: ActiveLine | null;
}

function isManifest(value: unknown): value is SceneManifest {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return m.version === 1 && Array.isArray(m.segments) && typeof m.durationMs === "number";
}

function isIndex(value: unknown): value is BroadcastIndex {
  if (typeof value !== "object" || value === null) return false;
  const i = value as Record<string, unknown>;
  return i.version === 1 && typeof i.min === "number" && typeof i.max === "number";
}

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

/** The segment covering a position (the last one that has started). */
function segmentAt(segments: AudioSegment[], positionMs: number): AudioSegment | null {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    if (seg && seg.startMs <= positionMs) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found >= 0 ? (segments[found] ?? null) : null;
}

function toFrame(
  manifest: SceneManifest,
  sceneIndex: number,
  positionMs: number,
  segment: AudioSegment | null,
): StreamFrame {
  if (segment?.kind === "intro") {
    return { manifest, sceneIndex, positionMs, phase: "intro", applause: false, line: { text: segment.text, role: "announcer" } };
  }
  if (segment?.kind === "speech") {
    return { manifest, sceneIndex, positionMs, phase: "speaking", applause: false, line: { text: segment.text, role: "speaker" } };
  }
  return { manifest, sceneIndex, positionMs, phase: "applause", applause: true, line: null };
}

export class StreamPlayer {
  readonly audio: HTMLAudioElement;

  private readonly ready = new Map<number, SceneManifest>();
  private readonly inflight = new Set<number>();
  private readonly warmed = new Set<number>();
  private catalog: BroadcastIndex | null = null;
  private catalogCheckedAt = -Infinity;
  private catalogInflight = false;

  private loaded = -1; // scene index whose mp3 is currently in audio.src
  private loadedAt = 0; // wall-clock time the current scene was attached
  private pendingSeekMs: number | null = null;
  private muted = true;
  private onContent: (() => void) | null = null;

  // Web Audio analysis for lip-sync, wired up on the first unmute gesture.
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelData: Uint8Array<ArrayBuffer> | null = null;
  private smoothedLevel = 0;

  constructor() {
    const audio = new Audio();
    audio.preload = "auto";
    audio.muted = true;
    audio.addEventListener("loadeddata", () => this.applyPendingSeek());
    // A failed/aborted load just means we fall back to the clock for captions.
    audio.addEventListener("error", () => undefined);
    this.audio = audio;
  }

  /** Called whenever new content becomes available, so the UI can re-render. */
  setOnContent(cb: () => void): void {
    this.onContent = cb;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Unmute (must be called from a user gesture to satisfy autoplay policies). */
  enableSound(): void {
    this.muted = false;
    this.audio.muted = false;
    this.enableAnalyser();
    void this.audio.play().catch(() => undefined);
  }

  mute(): void {
    this.muted = true;
    this.audio.muted = true;
  }

  /** Output level in 0..1 for lip-sync, sampled at render rate. Returns 0 when
   * there is no analyser yet (muted) so callers fall back to a procedural mouth. */
  level(): number {
    const analyser = this.analyser;
    const data = this.levelData;
    if (!analyser || !data) return -1; // no audio graph yet (muted): use procedural
    analyser.getByteFrequencyData(data);
    // Energy in the speech formant band (~190Hz..3.4kHz). Tracking voiced energy
    // rather than raw loudness makes the mouth open on vowels and close in the
    // gaps between words, instead of flapping with overall volume.
    const lo = 4;
    const hi = Math.min(72, data.length);
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += data[i]!;
    let v = sum / ((hi - lo) * 255); // 0..1 average band energy
    v = v < 0.05 ? 0 : Math.min(1, (v - 0.05) * 2.6); // noise gate + gain
    v = Math.pow(v, 0.85);
    // Fast attack so it pops open on a syllable; quicker release so it closes
    // between words rather than staying blobbily open.
    const k = v > this.smoothedLevel ? 0.7 : 0.4;
    this.smoothedLevel += (v - this.smoothedLevel) * k;
    return this.smoothedLevel;
  }

  private enableAnalyser(): void {
    if (this.audioCtx) {
      void this.audioCtx.resume().catch(() => undefined);
      return;
    }
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(this.audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024; // finer bins for the speech-band lip-sync
      analyser.smoothingTimeConstant = 0.1; // minimal, so the mouth stays responsive
      source.connect(analyser);
      analyser.connect(ctx.destination);
      this.audioCtx = ctx;
      this.analyser = analyser;
      this.levelData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      void ctx.resume().catch(() => undefined);
    } catch {
      // Web Audio unavailable, or the element is already captured; lip-sync
      // falls back to the procedural speech rhythm.
    }
  }

  /** Advance to wall-clock `now` and return what to render, or null if nothing
   * is loaded yet. */
  frame(now: number): StreamFrame | null {
    const located = locateScene(now);
    this.refreshCatalog(now);

    const sceneIndex = this.resolveScene(located.index);
    this.prefetch(located.index, now - located.startMs, located.unitMs);

    const manifest = this.read(sceneIndex);
    if (!manifest) return null;

    const desired = clamp(now - located.startMs, 0, Math.max(0, manifest.durationMs - 1));
    this.attach(sceneIndex, desired, now);
    this.correctDrift(desired, now);
    this.prune(sceneIndex);

    const positionMs = this.positionMs(desired);
    return toFrame(manifest, located.index, positionMs, segmentAt(manifest.segments, positionMs));
  }

  // --- scene resolution -------------------------------------------------------

  /** Map the clock's scene index to one that exists, looping if we're ahead. */
  private resolveScene(index: number): number {
    const cat = this.catalog;
    if (!cat) return index;
    if (index < cat.min) return cat.min;
    if (index > cat.max) {
      const span = cat.max - cat.min + 1;
      return cat.min + (((index - cat.min) % span) + span) % span;
    }
    return index;
  }

  // --- manifests --------------------------------------------------------------

  private read(index: number): SceneManifest | null {
    const m = this.ready.get(index);
    if (m) return m;
    this.request(index);
    return null;
  }

  private request(index: number): void {
    if (index < 0 || this.ready.has(index) || this.inflight.has(index)) return;
    this.inflight.add(index);
    fetch(`${AUDIO_BASE}/${index}.json`, { cache: "force-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
      .then((data) => {
        if (isManifest(data)) {
          this.ready.set(index, data);
          this.onContent?.();
        }
      })
      .catch(() => undefined)
      .finally(() => this.inflight.delete(index));
  }

  /** Keep the live scene's audio in `audio.src`, seeking to the right offset. */
  private attach(index: number, desiredMs: number, now: number): void {
    if (this.loaded !== index) {
      this.loaded = index;
      this.loadedAt = now;
      this.pendingSeekMs = desiredMs;
      this.audio.src = `${AUDIO_BASE}/${index}.mp3`;
      this.audio.load();
    }
    if (this.audio.paused) void this.audio.play().catch(() => undefined);
  }

  private applyPendingSeek(): void {
    if (this.pendingSeekMs === null) return;
    try {
      this.audio.currentTime = this.pendingSeekMs / 1000;
    } catch {
      // seeking before the media is seekable; the next frame retries via drift
    }
    this.pendingSeekMs = null;
  }

  private correctDrift(desiredMs: number, now: number): void {
    if (this.pendingSeekMs !== null || this.audio.paused) return;
    // Let a freshly loaded scene settle, and only seek when there is buffered
    // data ahead (readyState >= HAVE_FUTURE_DATA), so we never seek through the
    // opening announcer while it is still buffering.
    if (now - this.loadedAt < SETTLE_MS || this.audio.readyState < 3) return;
    if (Math.abs(this.audio.currentTime * 1000 - desiredMs) > DRIFT_TOLERANCE_MS) {
      try {
        this.audio.currentTime = desiredMs / 1000;
      } catch {
        // ignore; will retry next frame
      }
    }
  }

  /** Where captions should read from: the real playhead when audio is running,
   * else the clock-derived offset so captions stay live without audio. */
  private positionMs(desiredMs: number): number {
    if (this.pendingSeekMs === null && !this.audio.paused && this.audio.readyState >= 2) {
      return this.audio.currentTime * 1000;
    }
    return desiredMs;
  }

  // --- prefetch + housekeeping ------------------------------------------------

  private prefetch(clockIndex: number, offsetMs: number, unitMs: number): void {
    if (offsetMs < unitMs - PREFETCH_LEAD_MS) return;
    const next = this.resolveScene(clockIndex + 1);
    this.request(next);
    if (!this.warmed.has(next)) {
      this.warmed.add(next);
      // Read the body so the whole mp3 is downloaded into the HTTP cache, not
      // just the headers; otherwise the scene switch still has to buffer.
      void fetch(`${AUDIO_BASE}/${next}.mp3`, { cache: "force-cache" })
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => undefined);
    }
  }

  private prune(liveIndex: number): void {
    for (const key of this.ready.keys()) {
      if (key < liveIndex - KEEP_BEHIND || key > liveIndex + KEEP_AHEAD) this.ready.delete(key);
    }
    if (this.warmed.size > 32) this.warmed.clear();
  }

  private refreshCatalog(now: number): void {
    if (this.catalogInflight) return;
    if (this.catalog && now - this.catalogCheckedAt < CATALOG_TTL_MS) return;
    this.catalogInflight = true;
    this.catalogCheckedAt = now;
    fetch(`${AUDIO_BASE}/index.json`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
      .then((data) => {
        if (isIndex(data)) this.catalog = data;
      })
      .catch(() => undefined)
      .finally(() => {
        this.catalogInflight = false;
      });
  }
}

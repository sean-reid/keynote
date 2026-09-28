// Maps speech-band loudness to mouth openness.
//
// Speech loudness is judged against the speaker's own recent peaks rather than
// an absolute gate: a syllable near the recent peak opens the mouth fully, and
// anything more than RANGE_DB quieter closes it. That tracks the voice through
// volume changes between speakers and scenes and closes the mouth in the dips
// between words and syllables, which an absolute threshold cannot do.

const SILENCE_DB = -75; // below this the band is treated as silent
const RANGE_DB = 18; // dynamic range mapped onto 0..1 below the recent peak
const PEAK_DECAY_DB_PER_S = 9; // how fast the reference peak relaxes in a pause
const CURVE = 1.8; // >1 keeps mid-level sounds mostly closed

export class MouthTracker {
  private peak = -Infinity;

  /** Feed one analysis frame's speech-band level in dB; returns openness 0..1. */
  update(bandDb: number, dt: number): number {
    if (!Number.isFinite(bandDb) || bandDb < SILENCE_DB) {
      this.peak -= PEAK_DECAY_DB_PER_S * dt;
      return 0;
    }
    this.peak = Math.max(bandDb, this.peak - PEAK_DECAY_DB_PER_S * dt);
    const rel = (bandDb - (this.peak - RANGE_DB)) / RANGE_DB;
    if (rel <= 0) return 0;
    return Math.pow(rel > 1 ? 1 : rel, CURVE);
  }
}

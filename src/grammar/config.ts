// Shared timing constants. The sync layer and the engine must agree on these so
// that mapping a wall-clock instant to a scene gives the same answer everywhere.

/** Nominal speaking length of one keynote (~10 min); also the engine default. */
export const SPEAKING_MS = 10 * 60 * 1000;
/** Each scene's speaking length varies deterministically within this band. */
export const SPEAKING_MIN_MS = 8 * 60 * 1000;
export const SPEAKING_MAX_MS = 12 * 60 * 1000;

/** The end-of-scene applause before the next speaker, in ms. */
export const APPLAUSE_MIN_MS = 4_000;
export const APPLAUSE_MAX_MS = 10_000;

/** Nominal speaking-rate model used to lay sentences out on the timeline. */
export const MS_PER_WORD = 380;
export const SENTENCE_PAUSE_MS = 700;
export const COMMA_PAUSE_MS = 200;

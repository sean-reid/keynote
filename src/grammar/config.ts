// Shared timing constants. The sync layer and the engine must agree on these so
// that mapping a wall-clock instant to a scene gives the same answer everywhere.

/** Target speaking length of one scene (one speaker's keynote), in ms (~30 min). */
export const SPEAKING_MS = 30 * 60 * 1000;

/** The end-of-scene applause before the next speaker, in ms. */
export const APPLAUSE_MIN_MS = 4_000;
export const APPLAUSE_MAX_MS = 10_000;

/** Nominal speaking-rate model used to lay sentences out on the timeline. */
export const MS_PER_WORD = 380;
export const SENTENCE_PAUSE_MS = 700;
export const COMMA_PAUSE_MS = 200;

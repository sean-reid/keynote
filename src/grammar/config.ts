// Shared timing constants. The sync layer and the engine must agree on these so
// that mapping a wall-clock instant to a scene gives the same answer everywhere.

/** Target length of one scene (one coherent mini-keynote), in milliseconds. */
export const SCENE_MS = 150_000;

/** Nominal speaking-rate model used to lay sentences out on the timeline. */
export const MS_PER_WORD = 380;
export const SENTENCE_PAUSE_MS = 700;
export const COMMA_PAUSE_MS = 200;

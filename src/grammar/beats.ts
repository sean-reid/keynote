// The rhetorical arc of a keynote. A scene plays the intro beats once, loops the
// body beats to fill its running time, then closes with the outro beats.

import type { Beat, LexCategory, RhetoricCategory } from "./types.ts";

/** Beats every scene opens with, in order. The product is named at "reveal". */
export const INTRO_BEATS: readonly Beat[] = ["opener", "anecdote", "problem", "whatIf", "reveal"];

/** Body beats the engine cycles through until the scene is full. Weighted toward
 * features and vision so a long scene does not lean on the metric wrappers. */
export const BODY_BEATS: readonly Beat[] = ["feature", "vision", "feature", "metric", "feature", "vision"];

/** Beats every scene closes with, in order. */
export const OUTRO_BEATS: readonly Beat[] = ["callToAction", "gratitude"];

/** Beats that may reference the product by name (everything from the reveal on). */
const PRODUCT_AWARE: ReadonlySet<Beat> = new Set([
  "reveal",
  "feature",
  "metric",
  "vision",
  "callToAction",
  "gratitude",
]);

export function beatNamesProduct(beat: Beat): boolean {
  return PRODUCT_AWARE.has(beat);
}

/** Candidate raw lines (pre-expansion) for a given beat. */
export function beatPool(
  beat: Beat,
  topic: LexCategory,
  rhetoric: RhetoricCategory,
): readonly string[] {
  switch (beat) {
    case "opener":
      return rhetoric.openers;
    case "anecdote":
      return rhetoric.anecdoteFrames;
    case "problem":
      return rhetoric.problemFraming;
    case "whatIf":
      return rhetoric.whatIf;
    case "reveal":
      return rhetoric.reveal;
    case "feature":
      return [...topic.sentenceTemplates, ...topic.cliches];
    case "metric":
      return [...rhetoric.metricTemplates, ...topic.cliches];
    case "vision":
      return [...rhetoric.applauseLines, ...topic.cliches, ...rhetoric.analogies];
    case "callToAction":
      return rhetoric.callToAction;
    case "gratitude":
      return rhetoric.gratitude;
  }
}

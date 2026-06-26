// Deterministic presenter appearance from a persona seed. Pure and seeded, so
// every viewer draws the same speaker for a given scene, and a speaker's look
// stays coherent with their name and voice (same seed drives all three).

import { Rng } from "../grammar/rng.ts";

export type Gender = "male" | "female";

export type HairStyle = "bald" | "short" | "medium" | "long";
export type FacialHair = "none" | "stubble" | "beard";

export interface PresenterLook {
  gender: Gender;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  facialHair: FacialHair;
  glasses: boolean;
  suit: string;
  shirt: string;
  tie: string | null;
  /** Shoulder-width multiplier. */
  build: number;
  /** Side the warm stage rim-light falls on: 1 = right, -1 = left. */
  rimSide: 1 | -1;
}

const SKIN = ["#f2c5a0", "#e7b48b", "#d29a6e", "#bd7f4f", "#9c6437", "#7d4f2c", "#5e3a21"];
const HAIR = ["#15110d", "#241a12", "#3b2a1c", "#5a3d24", "#7a5230", "#a06a3a", "#cdb188", "#b9bcc2", "#8d9098"];
const SUIT = ["#1b2330", "#232833", "#2b2f39", "#33373f", "#2a2533", "#1e2a31", "#322a2a"];
const SHIRT = ["#e9eef4", "#dde6f0", "#f2efe8", "#cdd8e6", "#c2cddc"];
const TIE = ["#7c1f26", "#1f3a5f", "#5a1f3a", "#26402c", "#3b2f5e", "#8a5a1f"];

/** Build the deterministic appearance for a persona of a given gender. */
export function presenterLook(seed: number | string, gender: Gender): PresenterLook {
  const rng = new Rng(`look|${seed}`);

  const skin = rng.pick(SKIN);
  const hair = rng.pick(HAIR);

  const hairStyle: HairStyle =
    gender === "female"
      ? (["short", "medium", "medium", "long", "long"] as const)[rng.int(5)]!
      : (["bald", "short", "short", "short", "medium"] as const)[rng.int(5)]!;

  const facialHair: FacialHair =
    gender === "male"
      ? (["none", "none", "none", "stubble", "beard"] as const)[rng.int(5)]!
      : "none";

  const glasses = rng.chance(0.32);
  const suit = rng.pick(SUIT);
  const shirt = rng.pick(SHIRT);
  const tie = rng.chance(gender === "male" ? 0.55 : 0.25) ? rng.pick(TIE) : null;
  const build = gender === "male" ? rng.range(0.98, 1.14) : rng.range(0.9, 1.05);
  const rimSide: 1 | -1 = rng.chance(0.5) ? 1 : -1;

  return { gender, skin, hair, hairStyle, facialHair, glasses, suit, shirt, tie, build, rimSide };
}

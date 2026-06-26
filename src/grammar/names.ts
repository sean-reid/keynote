// Coin fictional company and product names from morphemes. These get saved per
// scene and referred back to, which is what makes a scene feel like one speech.

import type { LexCategory } from "./types.ts";
import { capitalize } from "./inflect.ts";
import type { Rng } from "./rng.ts";

const COMPANY_SUFFIXES = [
  "Labs",
  "Systems",
  "Technologies",
  "Dynamics",
  "Collective",
  "Works",
  "Foundation",
  "Networks",
  "Intelligence",
  "Industries",
  "Group",
  "Cloud",
];

const PRODUCT_CONNECTORS = ["", "", "", " ", "."];

function morpheme(rng: Rng, primary: string[], fallback: string[]): string {
  const source = primary.length > 0 ? primary : fallback;
  return capitalize(rng.pick(source));
}

/** A product name like "HyperFlow", "NeuraForge AI", or "Quantum.Grid". */
export function coinProduct(rng: Rng, topic: LexCategory, rhetoric: LexCategory): string {
  const prefix = morpheme(rng, topic.productMorphemes.prefixes, rhetoric.productMorphemes.prefixes);
  const stem = morpheme(rng, topic.productMorphemes.stems, rhetoric.productMorphemes.stems);
  const connector = rng.pick(PRODUCT_CONNECTORS);
  let name = `${prefix}${connector}${stem}`.trim();
  if (rng.chance(0.45)) {
    const suffix = morpheme(rng, topic.productMorphemes.suffixes, rhetoric.productMorphemes.suffixes);
    // Suffixes like ".io" or "ify" attach directly; word-like ones get a space.
    name += /^[A-Za-z0-9]/.test(suffix) && suffix.length > 2 ? ` ${suffix}` : suffix;
  }
  return name.trim();
}

/** A company name like "Synapse Labs" or "Hypergrid Intelligence". */
export function coinCompany(rng: Rng, topic: LexCategory, rhetoric: LexCategory): string {
  const stem = morpheme(rng, topic.productMorphemes.stems, rhetoric.productMorphemes.stems);
  if (rng.chance(0.4)) {
    const prefix = morpheme(rng, topic.productMorphemes.prefixes, rhetoric.productMorphemes.prefixes);
    return `${prefix}${stem.toLowerCase()} ${rng.pick(COMPANY_SUFFIXES)}`;
  }
  return `${stem} ${rng.pick(COMPANY_SUFFIXES)}`;
}

/** A short company tagline drawn from the topic's buzzphrases. */
export function coinTagline(rng: Rng, topic: LexCategory): string {
  const source = topic.buzzphrases.length > 0 ? topic.buzzphrases : topic.nouns;
  return capitalize(rng.pick(source)) + ".";
}

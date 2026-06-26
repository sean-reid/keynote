// Coin fictional company, product, and presenter names from corpus data. These
// get saved per scene and referred back to, which is what makes a scene feel
// like one speech delivered by one person.

import type { Branding, LexCategory, Presenters, Speaker } from "./types.ts";
import { capitalize } from "./inflect.ts";
import type { Rng } from "./rng.ts";

function morpheme(rng: Rng, primary: string[], fallback: string[]): string {
  const source = primary.length > 0 ? primary : fallback;
  return capitalize(rng.pick(source));
}

/** A product name like "HyperFlow", "NeuraForge AI", or "Quantum.Grid". */
export function coinProduct(
  rng: Rng,
  topic: LexCategory,
  rhetoric: LexCategory,
  branding: Branding,
): string {
  const prefix = morpheme(rng, topic.productMorphemes.prefixes, rhetoric.productMorphemes.prefixes);
  const stem = morpheme(rng, topic.productMorphemes.stems, rhetoric.productMorphemes.stems);
  const connector = rng.pick(branding.productConnectors);
  let name = `${prefix}${connector}${stem}`.trim();
  if (rng.chance(0.45)) {
    const suffix = morpheme(rng, topic.productMorphemes.suffixes, rhetoric.productMorphemes.suffixes);
    // Suffixes like ".io" or "ify" attach directly; word-like ones get a space.
    name += /^[A-Za-z0-9]/.test(suffix) && suffix.length > 2 ? ` ${suffix}` : suffix;
  }
  return name.trim();
}

/** A company name like "Synapse Labs" or "Hypergrid Intelligence". */
export function coinCompany(
  rng: Rng,
  topic: LexCategory,
  rhetoric: LexCategory,
  branding: Branding,
): string {
  const stem = morpheme(rng, topic.productMorphemes.stems, rhetoric.productMorphemes.stems);
  if (rng.chance(0.4)) {
    const prefix = morpheme(rng, topic.productMorphemes.prefixes, rhetoric.productMorphemes.prefixes);
    return `${prefix}${stem.toLowerCase()} ${rng.pick(branding.companySuffixes)}`;
  }
  return `${stem} ${rng.pick(branding.companySuffixes)}`;
}

/** A short company tagline drawn from the topic's buzzphrases. */
export function coinTagline(rng: Rng, topic: LexCategory): string {
  const source = topic.buzzphrases.length > 0 ? topic.buzzphrases : topic.nouns;
  return capitalize(rng.pick(source)) + ".";
}

/** Invent the presenter for a scene: name, title, gender, and a persona seed. */
export function coinSpeaker(rng: Rng, presenters: Presenters): Speaker {
  const gender: "male" | "female" = rng.chance(0.5) ? "male" : "female";
  const firstNames =
    gender === "male" ? presenters.firstNamesMale : presenters.firstNamesFemale;
  const name = `${rng.pick(firstNames)} ${rng.pick(presenters.lastNames)}`;
  const title = rng.pick(presenters.titles);
  const persona = rng.int(1_000_000);
  return { name, title, gender, persona };
}

/** Fill an announcer introduction template for a given speaker and company. */
export function coinIntroduction(
  rng: Rng,
  speaker: Speaker,
  company: string,
  templates: string[],
): string {
  return rng
    .pick(templates)
    .replace(/#name#/g, speaker.name)
    .replace(/#title#/g, speaker.title)
    .replace(/#company#/g, company);
}

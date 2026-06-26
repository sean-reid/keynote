// Assemble the in-browser corpus from the lexicon JSON files. Vite inlines these
// at build time, so no network request is needed to start generating speech.

import type {
  Announcer,
  Branding,
  Corpus,
  LexCategory,
  Presenters,
  RhetoricCategory,
} from "./types.ts";
import presenters from "../../data/presenters.json";
import branding from "../../data/branding.json";
import announcer from "../../data/announcer.json";

const RHETORIC_CATEGORY = "rhetoric_structure";

const modules = import.meta.glob<LexCategory | RhetoricCategory>("../../data/lexicon/*.json", {
  eager: true,
  import: "default",
});

let cached: Corpus | null = null;

/** Build (and memoize) the corpus from the bundled lexicon files. */
export function loadCorpus(): Corpus {
  if (cached) return cached;

  const domains: LexCategory[] = [];
  let rhetoric: RhetoricCategory | null = null;

  for (const value of Object.values(modules)) {
    if (value.category === RHETORIC_CATEGORY) {
      rhetoric = value as RhetoricCategory;
    } else {
      domains.push(value);
    }
  }

  if (!rhetoric) throw new Error("Lexicon is missing the rhetoric_structure file");
  domains.sort((a, b) => a.category.localeCompare(b.category));

  cached = {
    domains,
    rhetoric,
    presenters: presenters as Presenters,
    branding: branding as Branding,
    announcer: announcer as Announcer,
  };
  return cached;
}

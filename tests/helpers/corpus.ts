// Load the real lexicon from disk for unit tests (Node, no Vite).

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Corpus, LexCategory, RhetoricCategory } from "../../src/grammar/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const lexiconDir = join(here, "..", "..", "data", "lexicon");

export function loadCorpusFromDisk(): Corpus {
  const domains: LexCategory[] = [];
  let rhetoric: RhetoricCategory | null = null;

  for (const file of readdirSync(lexiconDir)) {
    if (!file.endsWith(".json")) continue;
    const parsed = JSON.parse(readFileSync(join(lexiconDir, file), "utf8")) as LexCategory;
    if (parsed.category === "rhetoric_structure") {
      rhetoric = parsed as RhetoricCategory;
    } else {
      domains.push(parsed);
    }
  }

  if (!rhetoric) throw new Error("rhetoric_structure.json not found");
  domains.sort((a, b) => a.category.localeCompare(b.category));
  return { domains, rhetoric };
}

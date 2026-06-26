// Load the real lexicon from disk for unit tests (Node, no Vite).

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
  Announcer,
  Branding,
  Corpus,
  LexCategory,
  Presenters,
  RhetoricCategory,
} from "../../src/grammar/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "..", "data");
const lexiconDir = join(dataDir, "lexicon");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadCorpusFromDisk(): Corpus {
  const domains: LexCategory[] = [];
  let rhetoric: RhetoricCategory | null = null;

  for (const file of readdirSync(lexiconDir)) {
    if (!file.endsWith(".json")) continue;
    const parsed = readJson<LexCategory>(join(lexiconDir, file));
    if (parsed.category === "rhetoric_structure") {
      rhetoric = parsed as RhetoricCategory;
    } else {
      domains.push(parsed);
    }
  }

  if (!rhetoric) throw new Error("rhetoric_structure.json not found");
  domains.sort((a, b) => a.category.localeCompare(b.category));
  return {
    domains,
    rhetoric,
    presenters: readJson<Presenters>(join(dataDir, "presenters.json")),
    branding: readJson<Branding>(join(dataDir, "branding.json")),
    announcer: readJson<Announcer>(join(dataDir, "announcer.json")),
  };
}

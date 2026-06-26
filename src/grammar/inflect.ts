// Lightweight English inflection. Good enough for keynote prose; not a full
// morphology engine. Handles the common cases the lexicon throws at it.

const PLURAL_EXCEPTIONS: Record<string, string> = {
  analysis: "analyses",
  thesis: "theses",
  hypothesis: "hypotheses",
  crisis: "crises",
  matrix: "matrices",
  vertex: "vertices",
  index: "indices",
  criterion: "criteria",
  phenomenon: "phenomena",
  schema: "schemas",
  datum: "data",
  status: "statuses",
};

// Mass / uncountable nouns that should never take a plural.
const UNCOUNTABLE = new Set([
  "data", "metadata", "software", "hardware", "firmware", "middleware", "malware",
  "infrastructure", "intelligence", "analytics", "telemetry", "compliance", "resilience",
  "governance", "observability", "security", "connectivity", "latency", "throughput",
  "bandwidth", "training", "tooling", "automation", "momentum", "traction", "research",
  "content", "feedback", "information", "knowledge", "equipment", "progress", "encryption",
  "authentication", "authorization", "liquidity", "staking", "mining", "compute",
  "scalability", "reliability", "sustainability", "visibility", "synergy", "integrity",
  "recognition", "interoperability", "composability", "decentralization", "uptime",
  "defi", "throughput", "headcount", "runway", "context", "alignment", "trust", "adoption",
]);

// The few words that take -ves; everything else (proof, roof, belief) takes -s.
const F_TO_VES = new Set([
  "leaf", "half", "wolf", "knife", "life", "shelf", "calf", "loaf", "thief", "wife",
  "elf", "self", "scarf", "hoof", "wharf",
]);

/** Pluralize a noun. Multiword nouns are pluralized on their head (last word). */
export function pluralize(word: string): string {
  const trimmed = word.trim();
  const space = trimmed.lastIndexOf(" ");
  if (space >= 0) return trimmed.slice(0, space + 1) + pluralize(trimmed.slice(space + 1));

  const lower = trimmed.toLowerCase();
  if (UNCOUNTABLE.has(lower)) return trimmed;
  if (/ing$/i.test(trimmed)) return trimmed; // gerund-nouns (minting, onboarding) are mass
  const exception = PLURAL_EXCEPTIONS[lower];
  if (exception) return matchCase(trimmed, exception);
  if (F_TO_VES.has(lower)) return matchCase(trimmed, lower.replace(/fe?$/, "ves"));

  if (/s$/i.test(trimmed)) return trimmed; // already plural or sibilant-final mass noun
  if (/(x|z|ch|sh)$/i.test(trimmed)) return trimmed + "es";
  if (/[^aeiou]y$/i.test(trimmed)) return trimmed.slice(0, -1) + "ies";
  if (/[^aeiou]o$/i.test(trimmed)) return trimmed + "es";
  return trimmed + "s";
}

// Multi-syllable verbs stressed on the last syllable double their final consonant
// (infer -> inferring). Stress is not derivable cheaply, so this is curated.
const GERUND_DOUBLES = new Set([
  "infer", "refer", "prefer", "defer", "confer", "occur", "recur", "incur", "deter",
  "embed", "forget", "begin", "commit", "submit", "transmit", "permit", "omit", "admit",
  "control", "compel", "propel", "rebel", "patrol", "allot", "format", "upset", "offset",
  "reset", "airdrop", "bootstrap", "input", "output",
]);

/** Turn a base verb into its -ing form. */
export function gerund(verb: string): string {
  const word = verb.trim();
  // Phrasal or compound verb: inflect the first token, keep the remainder.
  const split = /^(\S+)(\s.*)$/s.exec(word);
  if (split?.[1] && split[2]) return gerund(split[1]) + split[2];
  // Hyphenated compound verbs inflect the last element (future-proof -> future-proofing).
  if (word.includes("-")) {
    const i = word.lastIndexOf("-");
    return word.slice(0, i + 1) + gerund(word.slice(i + 1));
  }
  if (/[^aeiou]e$/i.test(word) && !/(ee|ye|oe)$/i.test(word)) {
    return word.slice(0, -1) + "ing";
  }
  if (/ie$/i.test(word)) return word.slice(0, -2) + "ying";
  // Double a final consonant for single-syllable CVC words (run -> running) and
  // known last-syllable-stressed verbs (infer -> inferring), but not multi-syllable
  // ones stressed earlier (honor -> honoring, open -> opening).
  const vowelGroups = word.match(/[aeiou]+/gi);
  const isCvc = /[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvz]$/i.test(word);
  if ((vowelGroups?.length === 1 && isCvc) || GERUND_DOUBLES.has(word.toLowerCase())) {
    return word + word[word.length - 1] + "ing";
  }
  return word + "ing";
}

/** Turn a base verb into its third-person singular form ("unlock" -> "unlocks"). */
export function thirdPerson(verb: string): string {
  const word = verb.trim();
  const split = /^(\S+)(\s.*)$/s.exec(word);
  if (split?.[1] && split[2]) return thirdPerson(split[1]) + split[2];
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + "es";
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  if (/[^aeiou]o$/i.test(word)) return word + "es";
  return word + "s";
}

// Words that start with a vowel letter but a consonant sound ("a university").
const VOWEL_LETTER_CONSONANT_SOUND = /^(uni|use|usu|user|ubi|eu|once|one|ufo)/i;
// Words that start with a consonant letter but a vowel sound ("an hour").
const SILENT_H = /^(hour|honest|honor|heir)/i;

// Letters whose spoken name begins with a vowel sound ("an F", "an MVP").
const LETTER_VOWEL_SOUND = new Set(["A", "E", "F", "H", "I", "L", "M", "N", "O", "R", "S", "X"]);

/** Pick "a" or "an" for a following word, accounting for common sound rules. */
export function articleFor(word: string): "a" | "an" {
  const w = word.replace(/^[^A-Za-z]+/, "");
  if (!w) return "a";
  // Initialisms read letter by letter ("an API", "a CAC", "an LTV").
  if (/^[A-Z]{2,}/.test(w)) return LETTER_VOWEL_SOUND.has(w[0] as string) ? "an" : "a";
  if (SILENT_H.test(w)) return "an";
  if (/^[aeiou]/i.test(w)) return VOWEL_LETTER_CONSONANT_SOUND.test(w) ? "a" : "an";
  return "a";
}

/** Replace each "a"/"an" with the form that matches the word that follows it. */
export function correctArticles(text: string): string {
  return text.replace(/\b(a|an)(\s+)(["']?[A-Za-z][\w-]*)/gi, (_m, art: string, gap, next: string) => {
    const correct = articleFor(next);
    const cased = /^[A-Z]/.test(art) ? capitalize(correct) : correct;
    return `${cased}${gap}${next}`;
  });
}

/** Collapse an accidental immediate repeat of the same word ("value value"). */
export function collapseDuplicateWords(text: string): string {
  return text.replace(/\b([\w-]+)(\s+\1)+\b/gi, "$1");
}

/** Capitalize the first visible letter, leaving the rest untouched. */
export function capitalize(text: string): string {
  const i = text.search(/[a-z]/i);
  if (i < 0) return text;
  return text.slice(0, i) + text.charAt(i).toUpperCase() + text.slice(i + 1);
}

/** Lowercase the first visible letter, unless it begins an initialism or name. */
export function lowerFirst(text: string): string {
  const i = text.search(/[A-Za-z]/);
  if (i < 0) return text;
  const firstWord = /^[\w'-]+/.exec(text.slice(i))?.[0] ?? "";
  // Keep initialisms (API) and CamelCase product names (AccountSignal) intact.
  if (/[A-Z]/.test(firstWord.slice(1))) return text;
  return text.slice(0, i) + text.charAt(i).toLowerCase() + text.slice(i + 1);
}

/** Copy the casing of a template word onto a replacement. */
function matchCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source.charAt(0) === source.charAt(0).toUpperCase()) {
    return capitalize(replacement);
  }
  return replacement;
}

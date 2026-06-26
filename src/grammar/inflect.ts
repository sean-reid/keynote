// Lightweight English inflection. Good enough for keynote prose; not a full
// morphology engine. Handles the common cases the lexicon throws at it.

const PLURAL_EXCEPTIONS: Record<string, string> = {
  analysis: "analyses",
  thesis: "theses",
  crisis: "crises",
  matrix: "matrices",
  vertex: "vertices",
  index: "indices",
  schema: "schemas",
  datum: "data",
  data: "data",
  status: "statuses",
};

/** Pluralize a single noun. */
export function pluralize(word: string): string {
  const lower = word.toLowerCase();
  const exception = PLURAL_EXCEPTIONS[lower];
  if (exception) return matchCase(word, exception);

  if (/(s|x|z|ch|sh)$/i.test(word)) return word + "es";
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  if (/[^aeiou]o$/i.test(word)) return word + "es";
  if (/(f)$/i.test(word)) return word.slice(0, -1) + "ves";
  if (/fe$/i.test(word)) return word.slice(0, -2) + "ves";
  return word + "s";
}

/** Turn a base verb into its -ing form. */
export function gerund(verb: string): string {
  const word = verb.trim();
  if (/[^aeiou]e$/i.test(word) && !/(ee|ye|oe)$/i.test(word)) {
    return word.slice(0, -1) + "ing";
  }
  if (/ie$/i.test(word)) return word.slice(0, -2) + "ying";
  // Double a final consonant only for single-syllable CVC words (run -> running,
  // ship -> shipping), not multi-syllable ones (honor -> honoring, open -> opening).
  const vowelGroups = word.match(/[aeiou]+/gi);
  if (
    vowelGroups?.length === 1 &&
    /[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvz]$/i.test(word)
  ) {
    return word + word[word.length - 1] + "ing";
  }
  return word + "ing";
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

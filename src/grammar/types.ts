// Shape of the lexicon files in data/lexicon and the generated speech.

export interface ProductMorphemes {
  prefixes: string[];
  stems: string[];
  suffixes: string[];
}

/** One thematic domain (ai_ml, cloud_devops, ...). Matches the lexicon schema. */
export interface LexCategory {
  category: string;
  label: string;
  weight: number;
  nouns: string[];
  adjectives: string[];
  verbs: string[];
  buzzphrases: string[];
  metrics: string[];
  productMorphemes: ProductMorphemes;
  sentenceTemplates: string[];
  cliches: string[];
}

/** The keynote-rhetoric file carries extra arrays on top of the base fields. */
export interface RhetoricCategory extends LexCategory {
  openers: string[];
  transitions: string[];
  whatIf: string[];
  problemFraming: string[];
  reveal: string[];
  callToAction: string[];
  gratitude: string[];
  applauseLines: string[];
  rhetoricalQuestions: string[];
  analogies: string[];
  anecdoteFrames: string[];
  intensifiers: string[];
  hedges: string[];
  discourseMarkers: string[];
  callbackPhrases: string[];
}

/** Everything the engine needs: the themed domains plus the rhetoric backbone. */
export interface Corpus {
  domains: LexCategory[];
  rhetoric: RhetoricCategory;
}

/** A keynote moves through these beats; each scene is one pass through an arc. */
export type Beat =
  | "opener"
  | "anecdote"
  | "problem"
  | "whatIf"
  | "reveal"
  | "feature"
  | "metric"
  | "vision"
  | "callToAction"
  | "gratitude";

/** A single spoken sentence with the metadata captions and slides need. */
export interface Utterance {
  text: string;
  words: string[];
  beat: Beat;
  topic: string;
  nominalMs: number;
}

/** A self-contained coherent block: one company, one product, one topic arc. */
export interface Scene {
  index: number;
  topic: string;
  topicLabel: string;
  company: string;
  product: string;
  tagline: string;
  utterances: Utterance[];
  totalMs: number;
}

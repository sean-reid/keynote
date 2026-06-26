// Turns the corpus into deterministic scenes. A scene is a pure function of the
// global seed and the scene index, so any viewer can reconstruct the exact same
// speech for any moment without replaying everything that came before.

import { BODY_BEATS, INTRO_BEATS, OUTRO_BEATS, beatNamesProduct, beatPool } from "./beats.ts";
import { COMMA_PAUSE_MS, MS_PER_WORD, SCENE_MS, SENTENCE_PAUSE_MS } from "./config.ts";
import { capitalize, collapseDuplicateWords, correctArticles, lowerFirst } from "./inflect.ts";
import { coinCompany, coinProduct, coinSpeaker, coinTagline } from "./names.ts";
import { Rng } from "./rng.ts";
import { expand, type ExpandContext } from "./template.ts";
import type { Beat, Branding, Corpus, LexCategory, Presenters, Scene, Utterance } from "./types.ts";

const OUTRO_RESERVE_MS = 9_000;
const TEASER = "what comes next";

export class SpeechEngine {
  private readonly domains: LexCategory[];
  private readonly rhetoric: Corpus["rhetoric"];
  private readonly presenters: Presenters;
  private readonly branding: Branding;
  private readonly weights: number[];
  private readonly seed: string;
  private readonly quantified: RegExp;

  constructor(corpus: Corpus, seed: string) {
    if (corpus.domains.length === 0) throw new Error("Corpus has no domains");
    this.seed = seed;
    this.domains = corpus.domains;
    this.rhetoric = corpus.rhetoric;
    this.presenters = corpus.presenters;
    this.branding = corpus.branding;
    this.weights = this.domains.map((d) => (d.weight > 0 ? d.weight : 1));
    // Singularize a plural audience noun after a singular quantifier
    // ("every builders" -> "every builder").
    const aud = this.rhetoric.audience.join("|");
    this.quantified = new RegExp(`\\b(every|each|either|neither|a|an|one|single|this|that)\\s+(${aud})\\b`, "gi");
  }

  /** Topic for a scene, with a little stickiness to the previous scene. */
  private topicIndex(sceneIndex: number): number {
    const base = (s: number): number =>
      new Rng(`${this.seed}|topic|${s}`).weightedIndex(this.weights);
    if (sceneIndex > 0 && new Rng(`${this.seed}|drift|${sceneIndex}`).chance(0.34)) {
      return base(sceneIndex - 1);
    }
    return base(sceneIndex);
  }

  /** Build the full scene at the given index. */
  generateScene(sceneIndex: number, targetMs: number = SCENE_MS): Scene {
    const topic = this.domains[this.topicIndex(sceneIndex)] as LexCategory;
    const rng = new Rng(`${this.seed}|scene|${sceneIndex}`);

    const company = coinCompany(rng, topic, this.rhetoric, this.branding);
    const product = coinProduct(rng, topic, this.rhetoric, this.branding);
    const tagline = coinTagline(rng, topic);
    const speaker = coinSpeaker(rng, this.presenters);

    const ctx: ExpandContext = { rng, topic, rhetoric: this.rhetoric, product, company };
    const utterances: Utterance[] = [];
    const seen = new Set<string>();
    let totalMs = 0;

    const emit = (beat: Beat): void => {
      const u = this.makeUtterance(beat, ctx, topic, seen);
      utterances.push(u);
      totalMs += u.nominalMs;
    };

    for (const beat of INTRO_BEATS) {
      if (beat === "anecdote" && !rng.chance(0.6)) continue;
      emit(beat);
    }

    let i = 0;
    const maxBody = Math.ceil(targetMs / 800) + 100; // safety against a degenerate corpus
    while (totalMs < targetMs - OUTRO_RESERVE_MS) {
      emit(BODY_BEATS[i % BODY_BEATS.length] as Beat);
      i++;
      if (i > maxBody) break;
    }

    for (const beat of OUTRO_BEATS) emit(beat);

    return {
      index: sceneIndex,
      topic: topic.category,
      topicLabel: topic.label,
      company,
      product,
      tagline,
      speaker,
      utterances,
      totalMs,
    };
  }

  private makeUtterance(
    beat: Beat,
    ctx: ExpandContext,
    topic: LexCategory,
    seen: Set<string>,
  ): Utterance {
    // Keep the product name hidden until the reveal beat.
    const lineCtx: ExpandContext = beatNamesProduct(beat) ? ctx : { ...ctx, product: TEASER };

    // Try a few draws to avoid repeating a core line already used in this scene.
    // Dedupe on the core (pre-lead-in) so the same sentence with a different
    // transition prefix still counts as a repeat.
    let core = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      core = capitalize(expand(this.pickLine(beat, topic, ctx), lineCtx).trim());
      if (!seen.has(core)) break;
    }
    seen.add(core);

    const text = this.fixQuantifiers(finalizeSentence(this.applyLeadIn(beat, ctx, core)));
    const words = text.split(/\s+/).filter(Boolean);
    const commas = (text.match(/,/g) ?? []).length;
    const nominalMs = words.length * MS_PER_WORD + SENTENCE_PAUSE_MS + commas * COMMA_PAUSE_MS;
    const applause = this.applauseFor(beat, ctx.rng);

    return { text, words, beat, topic: topic.category, nominalMs, applause };
  }

  /** Should the crowd applaud after this beat? */
  private applauseFor(beat: Beat, rng: Rng): boolean {
    if (beat === "reveal" || beat === "gratitude") return true;
    if (beat === "vision") return rng.chance(0.35);
    return false;
  }

  private fixQuantifiers(text: string): string {
    return text.replace(this.quantified, (_m, det: string, word: string) => `${det} ${word.slice(0, -1)}`);
  }

  private pickLine(beat: Beat, topic: LexCategory, ctx: ExpandContext): string {
    return ctx.rng.pick(beatPool(beat, topic, this.rhetoric));
  }

  /** Occasionally prefix a body sentence with a transition or discourse marker. */
  private applyLeadIn(beat: Beat, ctx: ExpandContext, core: string): string {
    const bodyBeat = beat === "feature" || beat === "metric" || beat === "vision";
    if (!bodyBeat) return core;
    const { rng, rhetoric } = ctx;

    let connector: string | null = null;
    if (rng.chance(0.22) && rhetoric.transitions.length > 0) {
      connector = expand(rng.pick(rhetoric.transitions), ctx).trim();
    } else if (rng.chance(0.15) && rhetoric.discourseMarkers.length > 0) {
      connector = expand(rng.pick(rhetoric.discourseMarkers), ctx).trim();
    }
    if (!connector) return core;

    // A connector that is already a full sentence stands on its own. A fragment
    // flows into the core, joined by a space after a conjunction ("...because x")
    // or a comma otherwise ("Here's the thing, x").
    if (/[.!?…]$/.test(connector)) return `${capitalize(connector)} ${core}`;
    const trimmed = connector.replace(/[,;:]+$/, "");
    const lastWord = (/([A-Za-z']+)$/.exec(trimmed)?.[1] ?? "").toLowerCase();
    const sep = FLOW_WORDS.has(lastWord) ? " " : ", ";
    return `${capitalize(trimmed)}${sep}${lowerFirst(core)}`;
  }
}

// Connector-final words that read as continuations, taking no comma before the
// clause they introduce ("...and that matters because the data is clear").
const FLOW_WORDS = new Set([
  "because",
  "so",
  "and",
  "but",
  "that",
  "when",
  "if",
  "as",
  "since",
  "while",
  "which",
  "where",
  "to",
  "of",
  "for",
  "is",
]);

function finalizeSentence(input: string): string {
  let text = input.replace(/\s+/g, " ").trim();
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  text = correctArticles(text);
  text = collapseDuplicateWords(text);
  text = capitalize(text);
  // Capitalize the start of any later sentence inside a multi-sentence line.
  text = text.replace(/([.!?…]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
  if (!/[.!?…]$/.test(text)) text += ".";
  return text;
}

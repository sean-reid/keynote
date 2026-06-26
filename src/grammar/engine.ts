// Turns the corpus into deterministic scenes. A scene is a pure function of the
// global seed and the scene index, so any viewer can reconstruct the exact same
// speech for any moment without replaying everything that came before.

import { BODY_BEATS, INTRO_BEATS, OUTRO_BEATS, beatNamesProduct, beatPool } from "./beats.ts";
import { COMMA_PAUSE_MS, MS_PER_WORD, SENTENCE_PAUSE_MS, SPEAKING_MS } from "./config.ts";
import { capitalize, collapseDuplicateWords, correctArticles, lowerFirst } from "./inflect.ts";
import { coinCompany, coinIntroduction, coinProduct, coinSpeaker, coinTagline } from "./names.ts";
import { Rng } from "./rng.ts";
import { expand, type ExpandContext } from "./template.ts";
import type {
  Announcer,
  Beat,
  Branding,
  Corpus,
  LexCategory,
  Presenters,
  Scene,
  Utterance,
} from "./types.ts";

const OUTRO_RESERVE_MS = 9_000;
const TEASER = "what comes next";

export class SpeechEngine {
  private readonly domains: LexCategory[];
  private readonly rhetoric: Corpus["rhetoric"];
  private readonly presenters: Presenters;
  private readonly branding: Branding;
  private readonly announcer: Announcer;
  private readonly seed: string;
  private readonly quantified: RegExp;
  private readonly topicOrder: number[];
  private readonly topicStride: number;

  constructor(corpus: Corpus, seed: string) {
    if (corpus.domains.length === 0) throw new Error("Corpus has no domains");
    this.seed = seed;
    this.domains = corpus.domains;
    this.rhetoric = corpus.rhetoric;
    this.presenters = corpus.presenters;
    this.branding = corpus.branding;
    this.announcer = corpus.announcer;

    // A shuffled domain order walked by a coprime stride: consecutive scenes
    // always land on different topics, and every topic is visited each lap.
    const n = this.domains.length;
    const orderRng = new Rng(`${seed}|order`);
    this.topicOrder = this.domains.map((_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = orderRng.int(i + 1);
      const tmp = this.topicOrder[i] as number;
      this.topicOrder[i] = this.topicOrder[j] as number;
      this.topicOrder[j] = tmp;
    }
    this.topicStride = n > 1 ? 1 + orderRng.int(n - 1) : 1;
    // Singularize a plural audience noun after a singular quantifier
    // ("every builders" -> "every builder").
    const aud = this.rhetoric.audience.join("|");
    this.quantified = new RegExp(`\\b(every|each|either|neither|a|an|one|single|this|that)\\s+(${aud})\\b`, "gi");
  }

  /** Topic for a scene. Consecutive scenes never share a topic, so the broadcast
   * keeps moving across domains rather than dwelling on one. */
  private topicIndex(sceneIndex: number): number {
    const n = this.domains.length;
    const pos = (((sceneIndex * this.topicStride) % n) + n) % n;
    return this.topicOrder[pos] as number;
  }

  /** Build the full scene at the given index. */
  generateScene(sceneIndex: number, targetMs: number = SPEAKING_MS): Scene {
    const topic = this.domains[this.topicIndex(sceneIndex)] as LexCategory;
    const rng = new Rng(`${this.seed}|scene|${sceneIndex}`);

    const company = coinCompany(rng, topic, this.rhetoric, this.branding);
    const product = coinProduct(rng, topic, this.rhetoric, this.branding);
    const tagline = coinTagline(rng, topic);
    const speaker = coinSpeaker(rng, this.presenters);

    const introText = coinIntroduction(rng, speaker, company, this.announcer.introductions);
    const introWords = introText.split(/\s+/).filter(Boolean);
    const intro = {
      text: introText,
      words: introWords,
      nominalMs: introWords.length * MS_PER_WORD + SENTENCE_PAUSE_MS,
    };

    const ctx: ExpandContext = { rng, topic, rhetoric: this.rhetoric, product, company };
    const utterances: Utterance[] = [];
    const seen = new Set<string>();
    const usedLeadIns = new Set<string>();
    let totalMs = 0;

    const emit = (beat: Beat): void => {
      const u = this.makeUtterance(beat, ctx, topic, seen, usedLeadIns);
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
      intro,
      utterances,
      totalMs,
    };
  }

  private makeUtterance(
    beat: Beat,
    ctx: ExpandContext,
    topic: LexCategory,
    seen: Set<string>,
    usedLeadIns: Set<string>,
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

    const text = this.fixQuantifiers(finalizeSentence(this.applyLeadIn(beat, ctx, core, usedLeadIns)));
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
  private applyLeadIn(beat: Beat, ctx: ExpandContext, core: string, usedLeadIns: Set<string>): string {
    const bodyBeat = beat === "feature" || beat === "metric" || beat === "vision";
    if (!bodyBeat) return core;
    const { rng, rhetoric } = ctx;

    const pool =
      rng.chance(0.22) && rhetoric.transitions.length > 0
        ? rhetoric.transitions
        : rng.chance(0.15) && rhetoric.discourseMarkers.length > 0
          ? rhetoric.discourseMarkers
          : null;
    if (!pool) return core;

    // Prefer a connector not yet used in this scene, to limit transition repeats.
    let connector = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      connector = expand(rng.pick(pool), ctx).trim();
      if (!usedLeadIns.has(connector)) break;
    }
    if (usedLeadIns.has(connector)) return core; // pool exhausted; skip the lead-in
    usedLeadIns.add(connector);

    // Keep a proper-noun-initial core (a product/company name) capitalized.
    const startsName = core.startsWith(ctx.product) || core.startsWith(ctx.company);
    const tail = startsName ? core : lowerFirst(core);

    // A connector that is already a full sentence stands on its own. One ending in
    // a colon or semicolon keeps it. A bare fragment flows into the core, joined by
    // a space after a conjunction ("...because x") or a comma otherwise.
    if (/[.!?…]$/.test(connector)) return `${capitalize(connector)} ${core}`;
    if (/[:;]$/.test(connector)) return `${capitalize(connector)} ${tail}`;
    const trimmed = connector.replace(/,+$/, "");
    const lastWord = (/([A-Za-z']+)$/.exec(trimmed)?.[1] ?? "").toLowerCase();
    const sep = FLOW_WORDS.has(lastWord) ? " " : ", ";
    return `${capitalize(trimmed)}${sep}${tail}`;
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
  "unless",
  "until",
  "though",
]);

function finalizeSentence(input: string): string {
  let text = input.replace(/\s+/g, " ").trim();
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  // Collapse a stacked article pair ("a the tip" -> "the tip", "the the" -> "the").
  text = text.replace(/\b(?:a|an|the)\s+(a|an|the)\b/gi, "$1");
  text = correctArticles(text);
  text = collapseDuplicateWords(text);
  text = capitalize(text);
  // Capitalize the start of any later sentence inside a multi-sentence line.
  text = text.replace(/([.!?…]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
  if (!/[.!?…]$/.test(text)) text += ".";
  return text;
}

// Expand #slot# placeholders inside a template line into concrete words drawn
// from the active topic (and occasionally the shared rhetoric pool, for variety).

import type { LexCategory, RhetoricCategory } from "./types.ts";
import { gerund, pluralize } from "./inflect.ts";
import type { Rng } from "./rng.ts";

export interface ExpandContext {
  rng: Rng;
  topic: LexCategory;
  rhetoric: RhetoricCategory;
  product: string;
  company: string;
}

const SLOT_PATTERN = /#(\w+)#/g;
const MAX_DEPTH = 4;

// Metrics that read as a standalone quantity ("10x", "40%", "order of magnitude"),
// as opposed to lead-in phrases ("north of", "below the line") that need a number.
const QUANTITY = /\d|%|\bx\b|x$|×|fold|order of magnitude|double|triple|quadruple|halv|\bhalf\b|zero|nine|9s|basis point|sub-?second|million|billion|thousand/i;

function quantityMetric(ctx: ExpandContext): string {
  const q = ctx.topic.metrics.filter((m) => QUANTITY.test(m));
  if (q.length > 0) return ctx.rng.pick(q);
  if (ctx.topic.metrics.length > 0) return ctx.rng.pick(ctx.topic.metrics);
  return ctx.rng.pick(ctx.rhetoric.metrics);
}

/** Pull from the topic list most of the time, the shared pool occasionally. */
function blend(ctx: ExpandContext, topicList: string[], sharedList: string[]): string {
  const useShared = sharedList.length > 0 && (topicList.length === 0 || ctx.rng.chance(0.15));
  const source = useShared ? sharedList : topicList;
  return ctx.rng.pick(source);
}

function resolveSlot(name: string, ctx: ExpandContext): string {
  const { topic, rhetoric } = ctx;
  switch (name) {
    case "noun":
      return blend(ctx, topic.nouns, rhetoric.nouns);
    case "nounPlural":
      return pluralize(blend(ctx, topic.nouns, rhetoric.nouns));
    case "adjective":
      return blend(ctx, topic.adjectives, rhetoric.adjectives);
    case "verb":
      return blend(ctx, topic.verbs, rhetoric.verbs);
    case "verbing":
      return gerund(blend(ctx, topic.verbs, rhetoric.verbs));
    case "buzzphrase":
      return blend(ctx, topic.buzzphrases, rhetoric.buzzphrases);
    case "metric":
    case "figure":
      // Most templates want a concrete quantity, not a lead-in phrase. Strip any
      // leading article so frames like "a #metric#" don't yield "a an LTV...".
      return quantityMetric(ctx).replace(/^(an?|the)\s+/i, "");
    case "product":
      return ctx.product;
    case "company":
      return ctx.company;
    case "audience":
      return ctx.rng.pick(ctx.rhetoric.audience);
    default:
      // Unknown slot: leave a readable word rather than a stray token.
      return blend(ctx, topic.nouns, rhetoric.nouns);
  }
}

/** Recursively expand every #slot# in a line. */
export function expand(template: string, ctx: ExpandContext, depth = 0): string {
  if (depth >= MAX_DEPTH || !template.includes("#")) return template;
  const out = template.replace(SLOT_PATTERN, (_match, slot: string) =>
    resolveSlot(slot, ctx),
  );
  return out.includes("#") ? expand(out, ctx, depth + 1) : out;
}

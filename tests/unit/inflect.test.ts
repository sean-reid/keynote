import { describe, expect, it } from "vitest";
import {
  articleFor,
  collapseDuplicateWords,
  correctArticles,
  gerund,
  lowerFirst,
  pluralize,
} from "../../src/grammar/inflect.ts";

describe("pluralize", () => {
  it.each([
    ["platform", "platforms"],
    ["analysis", "analyses"],
    ["category", "categories"],
    ["box", "boxes"],
    ["leaf", "leaves"],
  ])("%s -> %s", (input, expected) => {
    expect(pluralize(input)).toBe(expected);
  });
});

describe("gerund", () => {
  it.each([
    ["run", "running"],
    ["ship", "shipping"],
    ["scale", "scaling"],
    ["honor", "honoring"],
    ["open", "opening"],
    ["deliver", "delivering"],
    ["leverage", "leveraging"],
  ])("%s -> %s", (input, expected) => {
    expect(gerund(input)).toBe(expected);
  });
});

describe("articleFor", () => {
  it.each([
    ["platform", "a"],
    ["engine", "an"],
    ["hour", "an"],
    ["university", "a"],
    ["API", "an"],
    ["CAC", "a"],
    ["LTV", "an"],
    ["MVP", "an"],
    ["SaaS", "a"],
  ] as const)("%s -> %s", (word, expected) => {
    expect(articleFor(word)).toBe(expected);
  });
});

describe("correctArticles", () => {
  it("fixes mismatched articles while preserving case", () => {
    expect(correctArticles("a extraordinary opportunity")).toBe("an extraordinary opportunity");
    expect(correctArticles("an platform")).toBe("a platform");
    expect(correctArticles("An idea")).toBe("An idea");
  });
});

describe("collapseDuplicateWords", () => {
  it("removes an immediate repeat", () => {
    expect(collapseDuplicateWords("the value value matters")).toBe("the value matters");
    expect(collapseDuplicateWords("an an MVP")).toBe("an MVP");
  });
});

describe("lowerFirst", () => {
  it("lowercases ordinary words but leaves names and acronyms", () => {
    expect(lowerFirst("Every customer")).toBe("every customer");
    expect(lowerFirst("AccountSignal ships")).toBe("AccountSignal ships");
    expect(lowerFirst("API matters")).toBe("API matters");
  });
});

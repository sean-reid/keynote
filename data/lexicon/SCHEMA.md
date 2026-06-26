# Lexicon file schema

Each thematic domain is one JSON file in this directory, named `<category>.json`.
Every file MUST follow this exact shape so the grammar engine can merge them.

```jsonc
{
  "category": "ai_ml",                 // snake_case id, matches filename
  "label": "AI & Machine Learning",    // human display name
  "weight": 1.0,                       // relative likelihood this topic is chosen (0.5-2.0)
  "nouns": [],                         // concepts, technologies, artifacts (singular nouns)
  "adjectives": [],                    // hype qualifiers ("next-generation", "frictionless")
  "verbs": [],                         // base-form action verbs ("orchestrate", "unlock")
  "buzzphrases": [],                   // multi-word collocations used verbatim ("paradigm shift")
  "metrics": [],                       // impact/number phrasings ("10x", "north of", "order-of-magnitude")
  "productMorphemes": {                // for COINING fake product/feature names
    "prefixes": [],                    // "Hyper", "Neura", "Quantum", "Cloud"
    "stems": [],                       // "Flow", "Forge", "Synapse", "Grid"
    "suffixes": []                     // "AI", "OS", "Hub", "ify", ".io"
  },
  "sentenceTemplates": [],             // sentences with #slots# (see below)
  "cliches": []                        // full canned lines usable as-is
}
```

## Rules
- Terms must be AUTHENTIC: real jargon as actually used in this domain. Do not invent words
  (the only place invented morphemes belong is `productMorphemes`).
- Lowercase entries unless they are proper-noun style or naturally capitalized.
- Deduplicate. No near-duplicates that differ only by trivial inflection.
- Volume targets per file (minimums): nouns 100, adjectives 50, verbs 40,
  buzzphrases 60, metrics 20, sentenceTemplates 25, cliches 20,
  productMorphemes 20 prefixes / 25 stems / 20 suffixes.

## Slot syntax for sentenceTemplates and cliches
Use `#slot#` placeholders the grammar will fill. Available slots:
`#noun#` `#nounPlural#` `#adjective#` `#verb#` `#verbing#` `#buzzphrase#`
`#metric#` `#product#` `#company#` `#audience#`
Example: "We're not just building #nounPlural#, we're #verbing# an entirely #adjective# #noun#."
Keep templates domain-flavored; the slots draw from this file's own lists plus shared lists.

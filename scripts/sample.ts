// Dev tool: generate a large sample of speech and run automatic quality checks.
// Usage: node scripts/sample.ts [scenes] [seed]
//   node scripts/sample.ts 8 demo      -> print 8 readable scenes
//   node scripts/sample.ts 300 audit   -> scan 300 scenes, print metrics only

import { SpeechEngine } from "../src/grammar/engine.ts";
import { articleFor } from "../src/grammar/inflect.ts";
import type { Scene } from "../src/grammar/types.ts";
import { loadCorpusFromDisk } from "../tests/helpers/corpus.ts";

const sceneCount = Number(process.argv[2] ?? 8);
const seed = process.argv[3] ?? "demo";
const printReadable = sceneCount <= 25;

// Scene target length in minutes (default short, for readable/fast audits).
const targetMs = Number(process.argv[4] ?? 2) * 60_000;

const corpus = loadCorpusFromDisk();
const engine = new SpeechEngine(corpus, seed);

interface Issue {
  kind: string;
  scene: number;
  text: string;
}

const issues: Issue[] = [];
let sentenceCount = 0;
let wordCount = 0;

function check(scene: Scene): void {
  const inScene = new Set<string>();
  for (const u of scene.utterances) {
    sentenceCount++;
    wordCount += u.words.length;
    const t = u.text;
    if (inScene.has(t)) issues.push({ kind: "repeat-in-scene", scene: scene.index, text: t });
    inScene.add(t);
    if (/#\w+#/.test(t)) issues.push({ kind: "unresolved-slot", scene: scene.index, text: t });
    for (const m of t.matchAll(/\b(a|an)\s+(["']?[A-Za-z][\w-]*)/gi)) {
      if (m[1] && m[2] && m[1].toLowerCase() !== articleFor(m[2])) {
        issues.push({ kind: "article-mismatch", scene: scene.index, text: t });
        break;
      }
    }
    if (/\b(\w+)\s+\1\b/i.test(t)) issues.push({ kind: "doubled-word", scene: scene.index, text: t });
    if (/\s{2,}/.test(t)) issues.push({ kind: "double-space", scene: scene.index, text: t });
    if (/\s[,.]/.test(t)) issues.push({ kind: "space-before-punct", scene: scene.index, text: t });
    if (!/^[A-Z0-9"'$]/.test(t)) issues.push({ kind: "bad-start", scene: scene.index, text: t });
    if (/\bevery \w+s\b/.test(t)) issues.push({ kind: "every-plural", scene: scene.index, text: t });
    if (!/[.!?…"']$/.test(t)) issues.push({ kind: "bad-end", scene: scene.index, text: t });
  }
}

for (let i = 0; i < sceneCount; i++) {
  const scene = engine.generateScene(i, targetMs);
  check(scene);
  if (printReadable) {
    process.stdout.write(
      `\n${"=".repeat(72)}\n[scene ${scene.index}] ${scene.company} - ${scene.topicLabel}\n` +
        `speaker: ${scene.speaker.name}, ${scene.speaker.title}\n` +
        `product: ${scene.product}  |  tagline: ${scene.tagline}\n${"-".repeat(72)}\n`,
    );
    process.stdout.write(`[ANNOUNCER] ${scene.intro.text}\n[applause]\n`);
    process.stdout.write(scene.utterances.map((u) => u.text).join(" ") + "\n");
  }
}

const byKind = new Map<string, number>();
for (const issue of issues) byKind.set(issue.kind, (byKind.get(issue.kind) ?? 0) + 1);

process.stdout.write(`\n${"#".repeat(72)}\nMETRICS over ${sceneCount} scenes\n`);
process.stdout.write(`sentences: ${sentenceCount}  words: ${wordCount}\n`);
if (byKind.size === 0) {
  process.stdout.write("no automatic issues found\n");
} else {
  for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${kind}: ${n}\n`);
  }
  process.stdout.write("\nsamples:\n");
  const shown = new Set<string>();
  for (const issue of issues) {
    if (shown.has(issue.kind)) continue;
    shown.add(issue.kind);
    process.stdout.write(`  [${issue.kind}] ${issue.text}\n`);
  }
}

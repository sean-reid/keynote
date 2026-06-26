// Discover the CC0 slide images bundled under data/images, grouped by topic.
// Vite turns each match into a hashed asset URL at build time.

const modules = import.meta.glob("../../data/images/**/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

const byTopic = new Map<string, string[]>();
for (const [path, url] of Object.entries(modules)) {
  const match = /\/images\/([^/]+)\//.exec(path);
  if (!match || !match[1]) continue;
  const list = byTopic.get(match[1]) ?? [];
  list.push(url as string);
  byTopic.set(match[1], list);
}
for (const list of byTopic.values()) list.sort();

/** Image URLs for a topic, or an empty array if none were collected. */
export function imagesFor(topic: string): string[] {
  return byTopic.get(topic) ?? [];
}

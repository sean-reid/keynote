// Collect CC0 (public-domain) stock PHOTOS per topic from Openverse/StockSnap and
// convert them to compact webp for the keynote slide screen. CC0 needs no
// attribution and is safe to redistribute in a public repo.
//
//   node scripts/fetch-images.mjs            # all categories (dedupes across them)
//   node scripts/fetch-images.mjs ai_ml      # one category
//
// StockSnap is used exclusively: the open Flickr CC0 pool is now full of
// AI-generated images, and Rawpixel mixes in antique public-domain engravings.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const QUERIES = {
  ai_ml: ["server room", "circuit board", "robot", "data center", "microchip", "computer chip",
    "motherboard", "laptop code", "technology", "automation"],
  cloud_devops: ["data center", "server", "network cables", "ethernet", "laptop code", "fiber optic",
    "computer terminal", "programming", "hosting", "developer"],
  data_analytics: ["charts", "stock market", "computer monitors", "graph", "laptop dashboard",
    "financial", "trading desk", "spreadsheet", "statistics", "office computer"],
  blockchain_web3: ["bitcoin", "graphics card", "computer hardware", "trading screen", "circuit board",
    "gold coins", "finance", "stock ticker", "money", "technology"],
  cybersecurity: ["padlock", "server", "laptop keyboard", "security camera", "network cables",
    "lock", "code screen", "data center", "privacy", "computer"],
  product_ux: ["sticky notes", "smartphone", "laptop", "sketchbook", "whiteboard", "tablet drawing",
    "creative workspace", "mobile phone", "designer", "notebook"],
  startup_vc: ["team meeting", "coworking space", "office", "presentation", "modern office",
    "startup", "brainstorm", "open office", "laptop meeting", "handshake"],
  sales_marketing_growth: ["conference audience", "handshake", "presentation", "trade show", "office team",
    "meeting", "seminar", "speaker stage", "growth", "city billboard"],
  corporate_management: ["boardroom", "office building", "skyscraper", "handshake", "city skyline",
    "corporate", "glass office", "executive", "business district", "conference room"],
  emerging_tech: ["virtual reality", "robot", "drone", "3d printer", "laboratory", "technology",
    "futuristic", "science", "satellite", "research"],
  sustainability_future: ["solar panels", "wind turbine", "wind farm", "electric car", "forest",
    "nature", "green energy", "mountains", "ocean", "renewable"],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PER_QUERY = 5;
const MIN_BYTES = 12_000;
const seenUrls = new Set();

async function collect(category) {
  const outDir = join("data", "images", category);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  let saved = 0;

  for (const q of QUERIES[category]) {
    let results = [];
    try {
      const api = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0&source=stocksnap&page_size=20&mature=false`;
      const res = await fetch(api, { headers: { "User-Agent": "keynote-image-fetch" } });
      results = (await res.json()).results ?? [];
    } catch (err) {
      console.error(`  "${q}" failed: ${err.message}`);
      continue;
    }

    let taken = 0;
    for (const r of results) {
      if (taken >= PER_QUERY) break;
      const url = r.url;
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);
      const tmp = join(tmpdir(), `kn-${category}-${saved}.img`);
      const out = join(outDir, `${category}-${String(saved).padStart(2, "0")}.webp`);
      try {
        const img = await fetch(url, {
          headers: { "User-Agent": "keynote-image-fetch" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!img.ok) continue;
        const buf = Buffer.from(await img.arrayBuffer());
        if (buf.length < MIN_BYTES) continue;
        writeFileSync(tmp, buf);
        execFileSync("cwebp", ["-quiet", "-q", "72", tmp, "-o", out]);
        rmSync(tmp, { force: true });
        saved++;
        taken++;
        await sleep(200);
      } catch (err) {
        rmSync(tmp, { force: true });
        console.error(`  download failed: ${err.message}`);
      }
    }
  }

  const count = readdirSync(outDir).filter((f) => f.endsWith(".webp")).length;
  console.log(`${category}: ${count} images`);
  return count;
}

const only = process.argv[2];
const categories = only ? [only] : Object.keys(QUERIES);
if (only && !QUERIES[only]) {
  console.error(`unknown category: ${only}`);
  process.exit(1);
}
let total = 0;
for (const cat of categories) total += await collect(cat);
console.log(`\ntotal: ${total} images across ${categories.length} categories`);

// Cloudflare Worker for the Infinite Keynote.
//
// It serves three things from one origin:
//   - the static client (via the [assets] binding),
//   - GET /time, a shared clock so every viewer agrees on "now",
//   - GET /audio/*, the precomputed scenes streamed from R2.
// Scene files are immutable and cached forever; the catalog index is always
// revalidated so newly generated scenes appear without a redeploy.

// Minimal structural types for the bindings we use, so the Worker needs no
// extra type packages (the runtime provides the real implementations).
interface R2Object {
  size: number;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}
interface R2ObjectBody extends R2Object {
  body: ReadableStream;
}
interface R2Bucket {
  head(key: string): Promise<R2Object | null>;
  get(key: string, options?: { range: { offset: number; length: number } }): Promise<R2ObjectBody | null>;
}
interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: Fetcher;
  KEYNOTE_AUDIO: R2Bucket;
}

// Only ever read the catalog and numbered scene files; never arbitrary keys.
const AUDIO_KEY = /^audio\/(?:index\.json|\d+\.(?:mp3|json))$/;

function timeResponse(): Response {
  return new Response(JSON.stringify({ now: Date.now() }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function contentType(key: string): string {
  if (key.endsWith(".mp3")) return "audio/mpeg";
  if (key.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function parseRange(header: string, size: number): { offset: number; length: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startRaw = "", endRaw = ""] = match;
  let start: number;
  let end: number;
  if (startRaw === "") {
    const suffix = Number(endRaw);
    if (!suffix) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startRaw);
    end = endRaw === "" ? size - 1 : Math.min(Number(endRaw), size - 1);
  }
  if (start > end || start >= size) return null;
  return { offset: start, length: end - start + 1 };
}

async function audioResponse(request: Request, key: string, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  const cacheControl =
    key === "audio/index.json"
      ? "public, max-age=0, must-revalidate"
      : "public, max-age=31536000, immutable";

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const head = await env.KEYNOTE_AUDIO.head(key);
    if (!head) return new Response("Not found", { status: 404 });
    const range = parseRange(rangeHeader, head.size);
    if (!range) {
      return new Response("Range not satisfiable", {
        status: 416,
        headers: { "content-range": `bytes */${head.size}` },
      });
    }
    const obj = await env.KEYNOTE_AUDIO.get(key, { range });
    if (!obj) return new Response("Not found", { status: 404 });
    const headers = audioHeaders(obj, key, cacheControl);
    headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
    return new Response(request.method === "HEAD" ? null : obj.body, { status: 206, headers });
  }

  const obj = await env.KEYNOTE_AUDIO.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = audioHeaders(obj, key, cacheControl);
  return new Response(request.method === "HEAD" ? null : obj.body, { headers });
}

function audioHeaders(obj: R2Object, key: string, cacheControl: string): Headers {
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("content-type", contentType(key));
  headers.set("cache-control", cacheControl);
  headers.set("accept-ranges", "bytes");
  headers.set("etag", obj.httpEtag);
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/time") return timeResponse();
    if (url.pathname.startsWith("/audio/")) {
      const key = url.pathname.slice(1);
      if (!AUDIO_KEY.test(key)) return new Response("Not found", { status: 404 });
      return audioResponse(request, key, env);
    }
    return env.ASSETS.fetch(request);
  },
};

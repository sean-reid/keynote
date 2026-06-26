# The Infinite Keynote

A tech keynote that never ends. A fictional executive walks a dark stage and
delivers a product launch that is generated forever and streamed around the
clock. Listen for a minute and it sounds like any keynote you have sat through.
Listen for an hour and it quietly comes apart at the seams.

Live at [keynote.dwainosaur.com](https://keynote.dwainosaur.com).

## How it works

A deterministic grammar turns a categorized lexicon of industry jargon into
endless, locally coherent speech, keyed to the wall clock so every viewer is on
the same moment. The audio is precomputed, not made in the browser:

- **Pipeline** (GitHub Actions): native Piper synthesizes each upcoming scene
  into one mp3 plus a timing manifest and uploads them to R2. It runs on a
  schedule, topping up a buffer ahead of live and evicting old scenes.
- **Worker** (Cloudflare): serves the site, a shared `/time` endpoint, and the
  precomputed audio from R2.
- **Client**: maps the clock to the live scene, streams its mp3 and manifest,
  drives the captions, and animates a rim-lit presenter on a 2D canvas whose
  mouth lip-syncs to the audio.

Everything is reproducible from a seed and a timestamp, so there is no server
state and no recording.

## Development

```bash
npm install
npm run dev          # local dev server
npm run test         # unit tests
npm run test:e2e     # end-to-end tests
npm run build        # production build
npm run deploy       # build and deploy the Worker

# generate audio locally (needs ffmpeg + Piper; KEYNOTE_TTS_STUB=1 for silence)
node scripts/precompute/index.ts --from 0 --to 2 --out audio-out
```

## Layout

```
data/                lexicon, presenters, applause, slide images
scripts/precompute/  offline audio pipeline (Piper -> mp3 + manifest)
src/grammar/         speech generation
src/sync/            broadcast clock and viewer count
src/audio/           scene manifest contract
src/stream/          audio stream player
src/stage/           presenter, look, slides
src/ui/              broadcast overlay
worker/              Cloudflare Worker (assets + /time + R2 audio)
```

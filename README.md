# The Infinite Speech

A keynote address that never ends.

A fictional executive walks a dark stage and delivers a tech keynote that is
generated on the fly and streams forever. Listen for a minute and it sounds like
any product launch you have ever sat through. Listen for an hour and it quietly
comes apart at the seams.

Everything is generated in the browser. There is no video file and no recording.
The speech is assembled from a large lexicon of real industry jargon, stitched
together by a grammar that follows the rhythm of a real keynote, spoken aloud,
and lip-synced onto a 3D presenter in real time.

## How it works

- **Grammar** turns a categorized lexicon into endless, locally coherent speech
  that drifts over time. Seeded from the wall clock, so every viewer is watching
  the same broadcast at the same moment.
- **Voice** is synthesized in the browser, with the mouth shapes driven by the
  speech timing.
- **Stage** is a real-time 3D scene: a presenter, spotlights, and a screen of
  slides that are generated alongside the words.

## Development

```bash
npm install
npm run dev        # local dev server
npm run test       # unit tests
npm run test:e2e   # end to end tests
npm run build      # production build
```

## Layout

```
data/lexicon/   categorized jargon corpus (one file per theme)
src/grammar/    speech generation
src/sync/       broadcast clock
src/voice/      speech synthesis and timing
src/avatar/     presenter and lip sync
src/stage/      3D scene and slides
src/ui/         broadcast overlay
worker/         Cloudflare Worker (static assets + time endpoint)
```

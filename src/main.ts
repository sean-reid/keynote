import "./style.css";
import { loadCorpus } from "./grammar/corpus.ts";
import { SceneClock, type ClockState } from "./sync/clock.ts";
import { syncTime, syncedNow } from "./sync/time.ts";
import { viewerCount } from "./sync/viewers.ts";
import { createBroadcast } from "./ui/broadcast.ts";
import { VoiceEngine } from "./voice/index.ts";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("missing #app");

// The in-browser speech model (kokoro/onnxruntime) can emit background rejections
// on some browsers even though we fall back cleanly. Keep them out of the console.
window.addEventListener("unhandledrejection", (event) => {
  const detail = `${String(event.reason?.message ?? event.reason ?? "")}${String(event.reason?.stack ?? "")}`;
  if (/kokoro|onnx|ort-wasm|webgpu|wasm/i.test(detail)) {
    console.warn("[voice] suppressed a background error from the speech engine");
    event.preventDefault();
  }
});

const corpus = loadCorpus();
const clock = new SceneClock(corpus);
const view = createBroadcast(app);
const voice = new VoiceEngine();

void syncTime();

const ICON_MUTED =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 5M21 9l-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICON_ON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4 4 0 0 1 0 7M18.5 6a7 7 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

let muted = true;
const sound = document.createElement("button");
sound.className = "sound";
sound.type = "button";
sound.setAttribute("aria-label", "Toggle sound");
sound.innerHTML = ICON_MUTED;
app.append(sound);

sound.addEventListener("click", () => {
  if (!voice.enabled) voice.enable();
  muted = !muted;
  sound.innerHTML = muted ? ICON_MUTED : ICON_ON;
  sound.classList.toggle("is-on", !muted);
  if (muted) {
    voice.cancel();
    speaking = false;
  }
});

// The clock picks the scene and phase; within a keynote a local playhead keeps
// the caption and the voice on the exact same phrase, so subtitles match audio
// and the speaker is never cut off. Muted viewers follow the clock directly.
let sceneIdx = -1;
let playhead = 0;
let speaking = false;
let spokenText = "";
let speakStart = 0;
const MAX_SPEAK_MS = 25_000;

function tick(): void {
  const now = syncedNow();
  const cs = clock.stateAt(now);

  if (cs.sceneIndex !== sceneIdx) {
    sceneIdx = cs.sceneIndex;
    playhead = cs.phase === "speaking" ? Math.max(0, cs.utteranceIndex) : 0;
    speaking = false;
    spokenText = "";
  }

  let line: ClockState["line"] = null;
  if (cs.phase === "intro") {
    line = { text: cs.scene.intro.text, role: "announcer" };
  } else if (cs.phase === "speaking") {
    if (muted || !voice.enabled) {
      // Stay locked to the shared clock when there is no audio to follow.
      playhead = Math.max(playhead, cs.utteranceIndex);
    }
    const u = cs.scene.utterances[playhead];
    if (u) line = { text: u.text, role: "speaker" };
  }

  view.update({ ...cs, line, utteranceIndex: playhead }, viewerCount(now, cs.sceneIndex), now);

  // Watchdog: if a phrase never reports completion, recover so audio continues.
  if (speaking && Date.now() - speakStart > MAX_SPEAK_MS) {
    voice.cancel();
    speaking = false;
  }

  if (voice.enabled && !muted && line && !speaking && line.text !== spokenText) {
    spokenText = line.text;
    speaking = true;
    speakStart = Date.now();
    const speakingPhase = cs.phase === "speaking";
    voice.speak(
      line.text,
      { kind: line.role, persona: cs.scene.speaker.persona, gender: cs.scene.speaker.gender },
      () => {
        speaking = false;
        if (speakingPhase) playhead = Math.min(cs.scene.utterances.length - 1, playhead + 1);
      },
    );
  }

  // Pre-generate the upcoming line so the next phrase is ready when this one ends.
  if (voice.enabled) {
    const upcoming =
      cs.phase === "intro"
        ? cs.scene.utterances[0]
        : cs.phase === "speaking"
          ? cs.scene.utterances[playhead + 1]
          : undefined;
    if (upcoming) {
      voice.prefetch(upcoming.text, {
        kind: "speaker",
        persona: cs.scene.speaker.persona,
        gender: cs.scene.speaker.gender,
      });
    }
  }
}

tick();
setInterval(tick, 150);

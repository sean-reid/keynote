import "./style.css";
import { loadCorpus } from "./grammar/corpus.ts";
import { SceneClock } from "./sync/clock.ts";
import { syncTime, syncedNow } from "./sync/time.ts";
import { viewerCount } from "./sync/viewers.ts";
import { createBroadcast } from "./ui/broadcast.ts";
import { Voice } from "./voice/speech.ts";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("missing #app");

const corpus = loadCorpus();
const clock = new SceneClock(corpus);
const view = createBroadcast(app);
const voice = new Voice();

void syncTime();

// Click-to-unmute affordance (also satisfies autoplay policy).
const unmute = document.createElement("button");
unmute.className = "unmute";
unmute.type = "button";
unmute.textContent = voice.available ? "Tap for sound" : "Live";
app.append(unmute);
unmute.addEventListener("click", () => {
  voice.enable();
  unmute.classList.add("hidden");
});

let spokenText = "";

function tick(): void {
  const now = syncedNow();
  const state = clock.stateAt(now);
  view.update(state, viewerCount(now, state.sceneIndex));

  if (voice.enabled) {
    if (state.line && state.line.text !== spokenText) {
      spokenText = state.line.text;
      voice.speak(state.line.text, {
        kind: state.line.role,
        persona: state.scene.speaker.persona,
      });
    } else if (!state.line) {
      spokenText = "";
    }
  }
}

tick();
setInterval(tick, 200);

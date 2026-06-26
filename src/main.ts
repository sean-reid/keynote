import "./style.css";
import { syncTime, syncedNow } from "./sync/time.ts";
import { viewerCount } from "./sync/viewers.ts";
import { createBroadcast } from "./ui/broadcast.ts";
import { StreamPlayer } from "./stream/player.ts";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("missing #app");

const player = new StreamPlayer();
const view = createBroadcast(app, () => player.level());

void syncTime();

const ICON_MUTED =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 5M21 9l-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICON_ON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4 4 0 0 1 0 7M18.5 6a7 7 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

const sound = document.createElement("button");
sound.className = "sound";
sound.type = "button";
sound.setAttribute("aria-label", "Toggle sound");
sound.innerHTML = ICON_MUTED;
app.append(sound);

sound.addEventListener("click", () => {
  if (player.isMuted()) {
    player.enableSound();
    sound.innerHTML = ICON_ON;
    sound.classList.add("is-on");
  } else {
    player.mute();
    sound.innerHTML = ICON_MUTED;
    sound.classList.remove("is-on");
  }
});

function render(): void {
  const now = syncedNow();
  const frame = player.frame(now);
  if (frame) view.update(frame, viewerCount(now), now);
}

player.setOnContent(render);
render();
setInterval(render, 150);

// The broadcast overlay: a keynote stage with live-TV production graphics. Built
// once, then updated each tick from the stream frame (no per-frame DOM churn).

import type { StreamFrame } from "../stream/player.ts";
import { formatCount } from "../sync/viewers.ts";
import { imagesFor } from "../stage/slides.ts";
import { Presenter } from "../stage/presenter.ts";

// How long each slide (the title card, then each photo) stays up.
const SLIDE_MS = 13_000;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function timecode(nowMs: number): string {
  const d = new Date(nowMs);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export interface BroadcastView {
  update(frame: StreamFrame, viewers: number, nowMs: number): void;
  root: HTMLElement;
}

export function createBroadcast(parent: HTMLElement, level: () => number = () => 0): BroadcastView {
  const root = h("div", "broadcast");

  // Stage
  const stage = h("div", "stage");
  const screen = h("div", "screen");
  const media = document.createElement("img");
  media.className = "screen-media";
  media.alt = "";
  media.decoding = "async";
  const screenText = h("div", "screen-text");
  const slideRule = h("div", "slide-rule");
  const slideCompany = h("div", "slide-company");
  const slideProduct = h("div", "slide-product");
  const slideTagline = h("div", "slide-tagline");
  screenText.append(slideCompany, slideProduct, slideRule, slideTagline);
  const slideBadge = h("div", "slide-badge");
  screen.append(media, screenText, slideBadge);
  const spotlight = h("div", "spotlight");
  const haze = h("div", "haze");
  const presenter = new Presenter(level);
  const podium = h("div", "podium");
  const floor = h("div", "floor");
  stage.append(screen, spotlight, haze, floor, presenter.canvas, podium);

  // Texture overlays that sell a live video feed.
  const grain = h("div", "grain");
  const scanlines = h("div", "scanlines");

  // Top bug
  const top = h("header", "chrome chrome-top");
  const bug = h("div", "bug");
  bug.append(h("span", "bug-mark", "KEYNOTE"), h("span", "bug-live", "LIVE"));
  const tcWrap = h("div", "status");
  const viewers = h("div", "viewers");
  const tc = h("div", "timecode");
  tcWrap.append(viewers, tc);
  top.append(bug, tcWrap);

  // Lower third + caption
  const lowerThird = h("div", "lower-third");
  const ltName = h("div", "lt-name");
  const ltTitle = h("div", "lt-title");
  lowerThird.append(ltName, ltTitle);

  const caption = h("div", "caption");
  const captionText = h("p", "caption-text");
  caption.append(captionText);

  root.append(stage, scanlines, grain, top, lowerThird, caption);
  parent.append(root);
  presenter.start();

  let lastSceneIndex = -1;
  let lastPhase = "";
  let lastApplause: boolean | null = null;
  let lastCaption = "";
  let images: string[] = [];
  let slideSlot = -1;
  let introEnd = 0; // ms; the speaker walks on across this window
  let exitStart = 0; // ms; the speaker walks off after the last speech

  function update(frame: StreamFrame, viewerCountNow: number, nowMs: number): void {
    const { manifest } = frame;
    viewers.textContent = `${formatCount(viewerCountNow)} watching`;
    tc.textContent = timecode(nowMs);

    if (frame.sceneIndex !== lastSceneIndex) {
      lastSceneIndex = frame.sceneIndex;
      slideCompany.textContent = manifest.company.toUpperCase();
      slideProduct.textContent = manifest.product;
      slideTagline.textContent = manifest.tagline;
      slideBadge.textContent = manifest.company.toUpperCase();
      ltName.textContent = manifest.speaker.name;
      ltTitle.textContent = `${manifest.speaker.title}, ${manifest.company}`;
      images = imagesFor(manifest.topic);
      slideSlot = -1;
      introEnd = 0;
      exitStart = 0;
      for (const seg of manifest.segments) {
        if (seg.kind === "intro") introEnd = Math.max(introEnd, seg.startMs + seg.durationMs);
        if (seg.kind === "speech") exitStart = Math.max(exitStart, seg.startMs + seg.durationMs);
      }
      presenter.setSpeaker(manifest.speaker.persona ?? manifest.speaker.name, manifest.speaker.gender);
      // At a live scene change we are at the new speaker's intro, so walk them on.
      if (frame.phase === "intro") presenter.enterFromLeft();
    }

    // Rotate the screen between the title card (slot 0) and each photo. The slot
    // comes from the shared clock, so all viewers see the same slide together.
    const slot = images.length > 0 ? Math.floor(nowMs / SLIDE_MS) % (images.length + 1) : 0;
    if (slot !== slideSlot) {
      slideSlot = slot;
      if (slot === 0) {
        screen.classList.remove("show-media");
      } else {
        media.src = images[slot - 1] ?? "";
        screen.classList.add("show-media");
      }
    }

    if (frame.phase !== lastPhase) {
      lastPhase = frame.phase;
      root.dataset.phase = frame.phase;
    }
    if (frame.applause !== lastApplause) {
      lastApplause = frame.applause;
      root.classList.toggle("is-applause", frame.applause);
    }

    const text = frame.line?.text ?? "";
    if (text !== lastCaption) {
      lastCaption = text;
      if (text) {
        caption.classList.remove("hidden");
        captionText.textContent = text;
      } else {
        caption.classList.add("hidden");
      }
    }

    // Walk the speaker on during the intro and off during the closing ovation.
    const pos = frame.positionMs;
    let stageX = 0;
    if (introEnd > 0 && pos < introEnd) {
      stageX = -1.4 * (1 - pos / introEnd);
    } else if (exitStart > 0 && pos >= exitStart) {
      const span = Math.max(1, manifest.durationMs - exitStart);
      stageX = 1.4 * Math.min(1, (pos - exitStart) / span);
    }
    presenter.setStage(stageX);
    presenter.setState({ speaking: frame.phase === "speaking", applause: frame.applause });
  }

  return { update, root };
}

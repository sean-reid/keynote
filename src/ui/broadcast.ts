// The broadcast overlay: a keynote stage with live-TV chrome. Built once, then
// updated each tick from the clock state (no per-frame DOM churn).

import type { ClockState } from "../sync/clock.ts";
import { formatCount } from "../sync/viewers.ts";

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

export interface BroadcastView {
  update(state: ClockState, viewers: number): void;
  root: HTMLElement;
}

export function createBroadcast(parent: HTMLElement): BroadcastView {
  const root = h("div", "broadcast");

  // Stage
  const stage = h("div", "stage");
  const spotlight = h("div", "spotlight");
  const screen = h("div", "screen");
  const slideCompany = h("div", "slide-company");
  const slideProduct = h("div", "slide-product");
  const slideTagline = h("div", "slide-tagline");
  screen.append(slideCompany, slideProduct, slideTagline);
  const presenter = h("div", "presenter");
  presenter.append(h("div", "presenter-head"), h("div", "presenter-body"));
  const podium = h("div", "podium");
  stage.append(screen, spotlight, presenter, podium);

  // Top chrome
  const top = h("header", "chrome chrome-top");
  const live = h("div", "live");
  live.append(h("span", "live-dot"), h("span", "live-label", "LIVE"));
  const channel = h("div", "channel", "THE INFINITE KEYNOTE");
  const viewers = h("div", "viewers");
  top.append(live, channel, viewers);

  // Lower third + caption
  const lowerThird = h("div", "lower-third");
  const ltName = h("div", "lt-name");
  const ltTitle = h("div", "lt-title");
  lowerThird.append(ltName, ltTitle);

  const caption = h("div", "caption");
  const captionText = h("p", "caption-text");
  caption.append(captionText);

  const applause = h("div", "applause", "applause");

  // Ticker
  const ticker = h("div", "ticker");
  const tickerTrack = h("div", "ticker-track");
  ticker.append(tickerTrack);

  root.append(stage, top, lowerThird, applause, caption, ticker);
  parent.append(root);

  let lastSceneIndex = -1;
  let lastPhase = "";

  function update(state: ClockState, viewerCountNow: number): void {
    const { scene } = state;
    viewers.textContent = `${formatCount(viewerCountNow)} watching`;

    if (state.sceneIndex !== lastSceneIndex) {
      lastSceneIndex = state.sceneIndex;
      slideCompany.textContent = scene.company.toUpperCase();
      slideProduct.textContent = scene.product;
      slideTagline.textContent = scene.tagline;
      ltName.textContent = scene.speaker.name;
      ltTitle.textContent = `${scene.speaker.title}, ${scene.company}`;
      tickerTrack.textContent = `${scene.company}   //   Introducing ${scene.product}   //   ${scene.tagline}   //   ${scene.topicLabel}   //   `;
      root.dataset.topic = scene.topic;
    }

    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      root.dataset.phase = state.phase;
      root.classList.toggle("is-applause", state.applause);
      root.classList.toggle("is-intro", state.phase === "intro");
    }

    if (state.line) {
      caption.classList.remove("hidden");
      const prefix = state.line.role === "announcer" ? "ANNOUNCER" : scene.speaker.name;
      captionText.textContent = state.line.text;
      caption.dataset.speaker = prefix;
    } else {
      caption.classList.add("hidden");
    }
  }

  return { update, root };
}

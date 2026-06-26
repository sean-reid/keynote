// The animated keynote presenter: a stylized speaker drawn on a 2D canvas, lit
// like a real person on a dark stage. No WebGL/WebGPU, no assets, no downloads.
//
// Realism here comes from lighting, not detail: the figure sits mostly in shadow
// with a strong warm rim light down one side, so it reads as a backlit speaker
// rather than a flat drawing. The mouth lip-syncs to the audio (real amplitude
// when sound is on, a procedural speech rhythm when muted), the look is derived
// deterministically from the persona, and the speaker paces, leans, sways, and
// blinks so it is never frozen.

import { presenterLook, type Gender, type PresenterLook } from "./look.ts";

const RIM = "255, 226, 190"; // warm stage spotlight, matches --spot
const MAX_DPR = 2;

interface PresenterState {
  speaking: boolean;
  applause: boolean;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** A varied 0..1 envelope that mimics the rhythm of speech (for muted mouths). */
function talkEnvelope(t: number): number {
  const a = Math.sin(t * 11.0) * 0.5 + 0.5;
  const b = Math.sin(t * 6.3 + 1.7) * 0.4 + 0.6;
  const c = Math.sin(t * 17.0 + 0.5) * 0.5 + 0.5;
  return clamp01(a * b * (0.7 + 0.3 * c));
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Darken (f<1) or lighten (f>1) a hex color, clamped, as an rgb() string. */
function shade(hex: string, f: number): string {
  const [r, g, b] = hexRgb(hex);
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

export class Presenter {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly level: () => number;

  private look: PresenterLook = presenterLook(0, "male");
  private state: PresenterState = { speaking: false, applause: false };

  private w = 0;
  private h = 0;
  private raf = 0;
  private last = 0;
  private running = false;

  private t = 0;
  private mouth = 0;
  private blink = 0;
  private blinking = false;
  private blinkClock = 0;
  private blinkWait = 2;
  private paceNorm = 0;
  private paceVel = 0;

  constructor(level: () => number = () => 0) {
    this.level = level;
    const canvas = document.createElement("canvas");
    canvas.className = "presenter-canvas";
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas unavailable");
    this.canvas = canvas;
    this.ctx = ctx;

    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => this.resize()).observe(canvas);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop();
      else this.start();
    });
  }

  setSpeaker(seed: number | string, gender: Gender): void {
    this.look = presenterLook(seed, gender);
  }

  setState(state: PresenterState): void {
    this.state = state;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = (ts: number): void => {
      if (!this.running) return;
      const dt = this.last ? Math.min(0.05, (ts - this.last) / 1000) : 0.016;
      this.last = ts;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.update(0.016);
    this.draw();
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private update(dt: number): void {
    this.t += dt;

    // Pace across the stage (normalized -1..1) and track velocity for lean/bob.
    const prevPace = this.paceNorm;
    this.paceNorm = Math.sin(this.t * 0.11) * 0.62 + Math.sin(this.t * 0.047 + 2) * 0.38;
    this.paceVel = dt > 0 ? (this.paceNorm - prevPace) / dt : 0;

    // Mouth: fast attack toward the speech target, slightly slower release.
    let target = 0;
    if (this.state.speaking) {
      const amp = clamp01(this.level() * 1.6);
      target = Math.max(amp, talkEnvelope(this.t) * 0.85);
    }
    const rate = target > this.mouth ? 22 : 12;
    this.mouth += (target - this.mouth) * Math.min(1, dt * rate);

    // Blink.
    if (this.blinking) {
      this.blinkClock += dt;
      const p = this.blinkClock / 0.18;
      this.blink = p >= 1 ? 0 : p < 0.5 ? p * 2 : (1 - p) * 2;
      if (p >= 1) {
        this.blinking = false;
        this.blinkWait = 2.4 + Math.sin(this.t * 13.7) * 1.2 + 1.6;
      }
    } else {
      this.blinkWait -= dt;
      if (this.blinkWait <= 0) {
        this.blinking = true;
        this.blinkClock = 0;
      }
    }
  }

  private draw(): void {
    const { ctx, w, h } = this;
    if (w === 0 || h === 0) return;
    ctx.clearRect(0, 0, w, h);

    const look = this.look;
    // Medium "talking head" shot: the head is large enough to read facial
    // detail, with the torso cut off by the frame and podium.
    const headW = h * 0.165;
    const headH = h * 0.21;
    const breathe = Math.sin(this.t * 1.15) * (h * 0.004);
    const headCy = h * 0.34 + breathe;
    const shoulderY = headCy + headH * 1.05;
    const groundY = h * 1.35;

    // Stay lively without leaving frame: a contained weight-shift, plus lean/bob.
    const px = w / 2 + this.paceNorm * (w * 0.05);
    const lean = Math.max(-0.05, Math.min(0.05, this.paceVel * 0.7));
    const moving = Math.min(1, Math.abs(this.paceVel) / 0.12);
    const bob = Math.sin(this.t * 5) * moving * (h * 0.005);
    const sway = Math.sin(this.t * 0.6) * (w * 0.002) * (1 - moving);
    const tilt = Math.sin(this.t * 0.5 + 1) * 0.018 + lean * 0.6;
    const cx = px + sway;

    // Backlight halo so the silhouette separates from the dark stage.
    const halo = ctx.createRadialGradient(cx, headCy + headH * 0.4, headH * 0.3, cx, headCy + headH * 0.4, headH * 4.5);
    halo.addColorStop(0, `rgba(${RIM},0.13)`);
    halo.addColorStop(0.45, "rgba(130,160,215,0.05)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(0, bob);
    ctx.translate(cx, shoulderY);
    ctx.rotate(lean);
    ctx.translate(-cx, -shoulderY);

    this.body(cx, groundY, shoulderY, headW, look);
    this.neck(cx, headCy, headW, headH, look);

    ctx.save();
    ctx.translate(cx, headCy);
    ctx.rotate(tilt);
    ctx.translate(-cx, -headCy);
    this.head(cx, headCy, headW, headH, look);
    ctx.restore();

    ctx.restore();
  }

  private ellipse(cx: number, cy: number, rx: number, ry: number): void {
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  }

  private body(cx: number, groundY: number, shoulderY: number, hw: number, look: PresenterLook): void {
    const { ctx } = this;
    const half = hw * 2.0 * look.build;
    const lit = look.rimSide;

    const shoulders = (): void => {
      ctx.beginPath();
      ctx.moveTo(cx - half, groundY);
      ctx.lineTo(cx - half, shoulderY + hw * 0.4);
      ctx.quadraticCurveTo(cx - half, shoulderY - hw * 0.05, cx - half * 0.5, shoulderY - hw * 0.2);
      ctx.quadraticCurveTo(cx, shoulderY - hw * 0.5, cx + half * 0.5, shoulderY - hw * 0.2);
      ctx.quadraticCurveTo(cx + half, shoulderY - hw * 0.05, cx + half, shoulderY + hw * 0.4);
      ctx.lineTo(cx + half, groundY);
      ctx.closePath();
    };

    // Jacket: a dark suit that falls to near-black on the shadow side.
    shoulders();
    const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
    g.addColorStop(0, shade(look.suit, lit < 0 ? 0.4 : 0.1));
    g.addColorStop(0.5, shade(look.suit, 0.17));
    g.addColorStop(1, shade(look.suit, lit > 0 ? 0.4 : 0.1));
    ctx.fillStyle = g;
    ctx.fill();

    // Shirt + collar, dim.
    ctx.beginPath();
    ctx.moveTo(cx, shoulderY - hw * 0.1);
    ctx.lineTo(cx - hw * 0.36, groundY);
    ctx.lineTo(cx + hw * 0.36, groundY);
    ctx.closePath();
    ctx.fillStyle = shade(look.shirt, 0.26);
    ctx.fill();

    if (look.tie) {
      ctx.beginPath();
      ctx.moveTo(cx, shoulderY - hw * 0.02);
      ctx.lineTo(cx - hw * 0.1, shoulderY + hw * 0.12);
      ctx.lineTo(cx - hw * 0.14, groundY);
      ctx.lineTo(cx + hw * 0.14, groundY);
      ctx.lineTo(cx + hw * 0.1, shoulderY + hw * 0.12);
      ctx.closePath();
      ctx.fillStyle = shade(look.tie, 0.4);
      ctx.fill();
    }

    // Rim lights: warm down the lit edge, a cooler backlight on the far edge,
    // so the shoulders read as a backlit silhouette.
    ctx.save();
    shoulders();
    ctx.clip();
    const warm = ctx.createLinearGradient(cx + lit * half - lit * hw, 0, cx + lit * half, 0);
    warm.addColorStop(0, "rgba(0,0,0,0)");
    warm.addColorStop(1, `rgba(${RIM},0.34)`);
    ctx.fillStyle = warm;
    ctx.fillRect(cx - half, shoulderY - hw, half * 2, groundY - shoulderY + hw);
    const cool = ctx.createLinearGradient(cx - lit * half + lit * hw, 0, cx - lit * half, 0);
    cool.addColorStop(0, "rgba(0,0,0,0)");
    cool.addColorStop(1, "rgba(150,180,225,0.16)");
    ctx.fillStyle = cool;
    ctx.fillRect(cx - half, shoulderY - hw, half * 2, groundY - shoulderY + hw);
    ctx.restore();
  }

  private neck(cx: number, headCy: number, hw: number, hh: number, look: PresenterLook): void {
    const { ctx } = this;
    const top = headCy + hh * 0.66;
    ctx.fillStyle = shade(look.skin, 0.18);
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.34, top);
    ctx.lineTo(cx - hw * 0.4, top + hh * 0.7);
    ctx.lineTo(cx + hw * 0.4, top + hh * 0.7);
    ctx.lineTo(cx + hw * 0.34, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    this.ellipse(cx, top, hw * 0.36, hh * 0.16);
    ctx.fill();
  }

  private head(cx: number, cy: number, hw: number, hh: number, look: PresenterLook): void {
    const { ctx } = this;
    const lit = look.rimSide;

    // Ears (dark).
    ctx.fillStyle = shade(look.skin, 0.16);
    for (const s of [-1, 1] as const) {
      this.ellipse(cx + s * hw * 0.92, cy + hh * 0.06, hw * 0.12, hh * 0.15);
      ctx.fill();
    }

    if (look.facialHair === "beard") this.beard(cx, cy, hw, hh, look);

    // Face volume: a soft key highlight on the lit cheek that falls off to dark
    // edges, so the face reads as a lit sphere rather than a flat cut-out.
    this.ellipse(cx, cy, hw, hh);
    const vol = ctx.createRadialGradient(cx + lit * hw * 0.34, cy - hh * 0.12, hw * 0.12, cx, cy + hh * 0.08, hw * 1.32);
    vol.addColorStop(0, shade(look.skin, 0.86));
    vol.addColorStop(0.5, shade(look.skin, 0.46));
    vol.addColorStop(1, shade(look.skin, 0.11));
    ctx.fillStyle = vol;
    ctx.fill();

    // Features painted on the face, then the shadow side is crushed to near
    // black so only the lit half reads (a dramatic stage key light).
    this.features(cx, cy, hw, hh, look);

    ctx.save();
    this.ellipse(cx, cy, hw, hh);
    ctx.clip();
    const key = ctx.createLinearGradient(cx + lit * hw, cy, cx - lit * hw, cy);
    key.addColorStop(0, "rgba(0,0,0,0)");
    key.addColorStop(0.5, "rgba(0,0,0,0)");
    key.addColorStop(0.78, "rgba(2,4,10,0.35)");
    key.addColorStop(1, "rgba(1,2,7,0.8)");
    ctx.fillStyle = key;
    ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.restore();

    this.hair(cx, cy, hw, hh, look);

    // Warm rim on the lit contour; cooler backlight rim on the far contour.
    ctx.save();
    this.ellipse(cx, cy, hw, hh);
    ctx.clip();
    const warm = ctx.createLinearGradient(cx + lit * hw, 0, cx + lit * hw * 0.5, 0);
    warm.addColorStop(0, `rgba(${RIM},0.6)`);
    warm.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = warm;
    ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
    const cool = ctx.createLinearGradient(cx - lit * hw, 0, cx - lit * hw * 0.55, 0);
    cool.addColorStop(0, "rgba(165,195,235,0.42)");
    cool.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cool;
    ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.restore();
  }

  private features(cx: number, cy: number, hw: number, hh: number, look: PresenterLook): void {
    const { ctx } = this;
    const lit = look.rimSide;
    const eyeY = cy - hh * 0.05;
    const eyeDx = hw * 0.4;
    const eyeRx = hw * 0.24;
    const eyeRy = hh * 0.115;

    // Eyebrows.
    ctx.fillStyle = shade(look.hair, 0.55);
    for (const s of [-1, 1] as const) {
      const bx = cx + s * eyeDx;
      ctx.beginPath();
      ctx.moveTo(bx - eyeRx * 1.05, eyeY - eyeRy * 1.9);
      ctx.quadraticCurveTo(bx, eyeY - eyeRy * 2.7, bx + eyeRx * 1.05, eyeY - eyeRy * 1.55);
      ctx.quadraticCurveTo(bx, eyeY - eyeRy * 2.05, bx - eyeRx * 1.05, eyeY - eyeRy * 1.5);
      ctx.closePath();
      ctx.fill();
    }

    // Eyes.
    const open = Math.max(0, 1 - this.blink);
    for (const s of [-1, 1] as const) {
      const ex = cx + s * eyeDx;
      // Soft, feathered socket shadow (no hard ring).
      const sock = ctx.createRadialGradient(ex, eyeY, eyeRy * 0.3, ex, eyeY, eyeRx * 1.3);
      sock.addColorStop(0, "rgba(2,4,10,0.28)");
      sock.addColorStop(1, "rgba(2,4,10,0)");
      ctx.fillStyle = sock;
      ctx.fillRect(ex - eyeRx * 1.4, eyeY - eyeRy * 1.8, eyeRx * 2.8, eyeRy * 3.6);
      if (open < 0.08) {
        ctx.strokeStyle = "rgba(2,3,8,0.8)";
        ctx.lineWidth = Math.max(1, eyeRy * 0.5);
        ctx.beginPath();
        ctx.moveTo(ex - eyeRx, eyeY);
        ctx.quadraticCurveTo(ex, eyeY + eyeRy * 0.3, ex + eyeRx, eyeY);
        ctx.stroke();
        continue;
      }
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ex - eyeRx, eyeY);
      ctx.quadraticCurveTo(ex, eyeY - eyeRy * open * 1.7, ex + eyeRx, eyeY);
      ctx.quadraticCurveTo(ex, eyeY + eyeRy * open * 1.3, ex - eyeRx, eyeY);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = "rgba(212,208,200,0.72)";
      ctx.fillRect(ex - eyeRx, eyeY - eyeRy * 2, eyeRx * 2, eyeRy * 4);
      const ir = eyeRy * 1.25;
      const ix = ex + lit * eyeRx * 0.12;
      ctx.fillStyle = "rgba(74,54,40,0.96)";
      ctx.beginPath();
      ctx.arc(ix, eyeY, ir, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(10,8,6,1)";
      ctx.beginPath();
      ctx.arc(ix, eyeY, ir * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${RIM},0.9)`;
      ctx.beginPath();
      ctx.arc(ix + lit * ir * 0.3, eyeY - ir * 0.35, ir * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Upper lash line.
      ctx.strokeStyle = "rgba(2,3,8,0.55)";
      ctx.lineWidth = Math.max(1, eyeRy * 0.32);
      ctx.beginPath();
      ctx.moveTo(ex - eyeRx, eyeY);
      ctx.quadraticCurveTo(ex, eyeY - eyeRy * open * 1.7, ex + eyeRx, eyeY);
      ctx.stroke();
    }

    // Nose: form shadow on the shadow side, a soft highlight on the lit ridge.
    const noseTop = eyeY + eyeRy * 1.2;
    const noseBot = cy + hh * 0.2;
    ctx.fillStyle = "rgba(3,5,12,0.3)";
    ctx.beginPath();
    ctx.moveTo(cx - lit * hw * 0.03, noseTop);
    ctx.quadraticCurveTo(cx - lit * hw * 0.16, (noseTop + noseBot) / 2, cx - lit * hw * 0.12, noseBot);
    ctx.quadraticCurveTo(cx, noseBot + hh * 0.05, cx + lit * hw * 0.04, noseBot);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${RIM},0.2)`;
    ctx.lineWidth = Math.max(1, hw * 0.04);
    ctx.beginPath();
    ctx.moveTo(cx + lit * hw * 0.04, noseTop);
    ctx.lineTo(cx + lit * hw * 0.05, noseBot - hh * 0.02);
    ctx.stroke();
    ctx.fillStyle = "rgba(2,3,8,0.4)";
    this.ellipse(cx - hw * 0.07, noseBot + hh * 0.01, hw * 0.035, hh * 0.02);
    ctx.fill();
    this.ellipse(cx + hw * 0.07, noseBot + hh * 0.01, hw * 0.035, hh * 0.02);
    ctx.fill();

    // Mouth: upper lip, an animated dark opening with a teeth hint, lower lip.
    const mouthY = cy + hh * 0.46;
    const mouthW = hw * 0.4;
    const openMs = this.mouth * hh * 0.17;
    const smile = this.state.applause ? hh * 0.04 : 0;
    if (look.facialHair !== "none") this.mustache(cx, cy, hw, hh, mouthY, look);

    ctx.fillStyle = shade(look.skin, 0.32);
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY - smile - hh * 0.016, cx + mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY - smile + hh * 0.012, cx - mouthW, mouthY);
    ctx.closePath();
    ctx.fill();

    if (openMs > hh * 0.006) {
      ctx.fillStyle = "rgba(26,11,11,0.96)";
      ctx.beginPath();
      ctx.moveTo(cx - mouthW * 0.9, mouthY);
      ctx.quadraticCurveTo(cx, mouthY + hh * 0.004, cx + mouthW * 0.9, mouthY);
      ctx.quadraticCurveTo(cx, mouthY + openMs, cx - mouthW * 0.9, mouthY);
      ctx.closePath();
      ctx.fill();
      if (openMs > hh * 0.045) {
        ctx.fillStyle = "rgba(216,210,200,0.55)";
        ctx.beginPath();
        ctx.moveTo(cx - mouthW * 0.66, mouthY + openMs * 0.08);
        ctx.quadraticCurveTo(cx, mouthY + hh * 0.004, cx + mouthW * 0.66, mouthY + openMs * 0.08);
        ctx.quadraticCurveTo(cx, mouthY + openMs * 0.3, cx - mouthW * 0.66, mouthY + openMs * 0.08);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.fillStyle = shade(look.skin, 0.56);
    ctx.beginPath();
    ctx.moveTo(cx - mouthW * 0.86, mouthY + openMs);
    ctx.quadraticCurveTo(cx, mouthY + openMs + hh * 0.032 + smile, cx + mouthW * 0.86, mouthY + openMs);
    ctx.quadraticCurveTo(cx, mouthY + openMs + hh * 0.006, cx - mouthW * 0.86, mouthY + openMs);
    ctx.closePath();
    ctx.fill();

    if (look.glasses) this.glasses(cx, eyeY, eyeDx, eyeRx, eyeRy);
  }

  private beard(cx: number, cy: number, hw: number, hh: number, look: PresenterLook): void {
    const { ctx } = this;
    ctx.save();
    this.ellipse(cx, cy + hh * 0.04, hw * 1.04, hh * 1.04);
    ctx.clip();
    ctx.fillStyle = shade(look.hair, 0.5);
    this.ellipse(cx, cy + hh * 0.52, hw * 0.96, hh * 0.6);
    ctx.fill();
    ctx.restore();
  }

  private mustache(cx: number, cy: number, hw: number, hh: number, mouthY: number, look: PresenterLook): void {
    const { ctx } = this;
    ctx.save();
    this.ellipse(cx, cy, hw, hh);
    ctx.clip();
    ctx.fillStyle = look.facialHair === "stubble" ? "rgba(16,12,9,0.4)" : shade(look.hair, 0.55);
    this.ellipse(cx, mouthY - hh * 0.13, hw * 0.3, hh * 0.06);
    ctx.fill();
    ctx.restore();
  }

  private hair(cx: number, cy: number, hw: number, hh: number, look: PresenterLook): void {
    if (look.hairStyle === "bald") return;
    const { ctx } = this;
    const lit = look.rimSide;
    const long = look.hairStyle === "long";
    const drop = long ? hh * 1.6 : look.hairStyle === "medium" ? hh * 0.85 : hh * 0.1;

    // One continuous hair shape: a skull cap with a smooth hairline, flowing
    // down the sides for medium/long, so it reads as a single head of hair.
    const path = (): void => {
      ctx.beginPath();
      ctx.moveTo(cx - hw * 1.02, cy + (drop > hh * 0.2 ? drop * 0.5 : -hh * 0.1));
      ctx.quadraticCurveTo(cx - hw * 1.16, cy - hh * 1.08, cx, cy - hh * 1.16);
      ctx.quadraticCurveTo(cx + hw * 1.16, cy - hh * 1.08, cx + hw * 1.02, cy + (drop > hh * 0.2 ? drop * 0.5 : -hh * 0.1));
      if (drop > hh * 0.2) {
        ctx.quadraticCurveTo(cx + hw * 0.95, cy + drop, cx + hw * 0.6, cy + drop * 0.92);
        ctx.quadraticCurveTo(cx + hw * 0.78, cy - hh * 0.1, cx + hw * 0.52, cy - hh * 0.46);
      } else {
        ctx.lineTo(cx + hw * 0.6, cy - hh * 0.42);
      }
      // Hairline across the forehead (slightly higher in the middle).
      ctx.quadraticCurveTo(cx + hw * 0.34, cy - hh * 0.54, cx, cy - hh * 0.56);
      ctx.quadraticCurveTo(cx - hw * 0.34, cy - hh * 0.54, cx - hw * 0.6, cy - hh * 0.42);
      if (drop > hh * 0.2) {
        ctx.quadraticCurveTo(cx - hw * 0.78, cy - hh * 0.1, cx - hw * 0.6, cy + drop * 0.92);
        ctx.quadraticCurveTo(cx - hw * 0.95, cy + drop, cx - hw * 1.02, cy + drop * 0.5);
      }
      ctx.closePath();
    };

    path();
    ctx.fillStyle = shade(look.hair, 0.4);
    ctx.fill();

    // One smooth rim across the whole hair on the lit side.
    ctx.save();
    path();
    ctx.clip();
    const sheen = ctx.createLinearGradient(cx + lit * hw * 1.1, 0, cx - lit * hw * 0.2, 0);
    sheen.addColorStop(0, `rgba(${RIM},0.42)`);
    sheen.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(cx - hw * 1.3, cy - hh * 1.3, hw * 2.6, hh * 3.2);
    ctx.restore();
  }

  private glasses(cx: number, eyeY: number, eyeDx: number, eyeRx: number, eyeRy: number): void {
    const { ctx } = this;
    ctx.strokeStyle = "rgba(15,17,22,0.9)";
    ctx.lineWidth = Math.max(1.4, eyeRx * 0.16);
    for (const s of [-1, 1] as const) {
      this.ellipse(cx + s * eyeDx, eyeY, eyeRx * 1.3, eyeRy * 1.7);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - eyeDx + eyeRx * 1.15, eyeY);
    ctx.lineTo(cx + eyeDx - eyeRx * 1.15, eyeY);
    ctx.stroke();
    // A glint of stage light on the lens.
    ctx.strokeStyle = `rgba(${RIM},0.35)`;
    ctx.lineWidth = Math.max(0.8, eyeRx * 0.1);
    ctx.beginPath();
    ctx.moveTo(cx + eyeDx - eyeRx * 0.6, eyeY - eyeRy * 0.6);
    ctx.lineTo(cx + eyeDx + eyeRx * 0.2, eyeY + eyeRy * 0.3);
    ctx.stroke();
  }
}

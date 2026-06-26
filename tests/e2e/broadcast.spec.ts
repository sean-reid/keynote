import { test, expect, type Page, type Route } from "@playwright/test";

// The client renders from precomputed scene manifests served at /audio. These
// tests stub that endpoint with a known scene so we can land the broadcast clock
// on a specific segment (intro / applause / speech) and assert what renders.
// Scene 0 starts at the epoch, so a wall-clock offset maps straight into the
// manifest's segment offsets.
const EPOCH_MS = Date.UTC(2025, 0, 1, 0, 0, 0);

const MANIFEST = {
  version: 1,
  scene: 0,
  seed: "keynote",
  topic: "ai_ml",
  topicLabel: "AI & Machine Learning",
  company: "Nexframe",
  product: "Synthflow",
  tagline: "Intelligence, delivered.",
  speaker: { name: "Dr. Ada Vance", title: "Chief Visionary Officer", gender: "female" },
  durationMs: 700_000,
  segments: [
    { kind: "intro", startMs: 0, durationMs: 9_000, text: "Ladies and gentlemen, please welcome Dr. Ada Vance.", utteranceIndex: -1 },
    { kind: "applause", startMs: 9_000, durationMs: 3_500, text: "", utteranceIndex: -1 },
    { kind: "speech", startMs: 12_500, durationMs: 687_500, text: "Today we reinvent the platform from first principles.", utteranceIndex: 0 },
  ],
};

async function stubAudio(page: Page): Promise<void> {
  await page.route("**/audio/**", async (route: Route) => {
    const url = route.request().url();
    if (url.endsWith("/index.json")) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ version: 1, min: 0, max: 0 }) });
    } else if (url.endsWith(".json")) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(MANIFEST) });
    } else {
      // The audio body itself is irrelevant here; captions fall back to the clock.
      await route.fulfill({ contentType: "audio/mpeg", body: "" });
    }
  });
}

async function openAt(page: Page, instant: number): Promise<void> {
  await page.clock.install({ time: instant });
  await stubAudio(page);
  await page.goto("/");
}

test("speaking phase: live chrome, lower third, and a caption render", async ({ page }) => {
  await openAt(page, EPOCH_MS + 73_000);

  await expect(page.locator(".bug-live")).toContainText("LIVE");
  await expect(page.locator(".viewers")).toContainText("watching");
  await expect(page.locator(".lt-name")).toContainText("Ada Vance");
  await expect(page.locator(".caption-text")).not.toBeEmpty();
  await expect(page.locator(".slide-product")).toContainText("Synthflow");

  await page.screenshot({ path: "test-results/speaking.png", fullPage: false });
});

test("intro phase: announcer introduces the speaker", async ({ page }) => {
  await openAt(page, EPOCH_MS + 3_000);

  await expect(page.locator(".broadcast")).toHaveAttribute("data-phase", "intro");
  await expect(page.locator(".caption-text")).toContainText("welcome", { ignoreCase: true });

  await page.screenshot({ path: "test-results/intro.png", fullPage: false });
});

test("applause phase shows the applause state", async ({ page }) => {
  await openAt(page, EPOCH_MS + 10_000);

  await expect(page.locator(".broadcast")).toHaveClass(/is-applause/);
  await page.screenshot({ path: "test-results/applause.png", fullPage: false });
});

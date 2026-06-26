import { test, expect } from "@playwright/test";

// Mirrors src/sync/clock.ts so we can land the page on a known phase.
const EPOCH_MS = Date.UTC(2025, 0, 1, 0, 0, 0);
const INTRO_MS = 9_000;
const INTRO_APPLAUSE_MS = 4_000;
const SPEAKING_MS = 30 * 60 * 1000;
const END_APPLAUSE_MS = 8_000;
const UNIT_MS = INTRO_MS + INTRO_APPLAUSE_MS + SPEAKING_MS + END_APPLAUSE_MS;

async function openAt(page: import("@playwright/test").Page, instant: number) {
  await page.clock.install({ time: instant });
  await page.goto("/");
}

test("speaking phase: live chrome, lower third, and a caption render", async ({ page }) => {
  await openAt(page, EPOCH_MS + UNIT_MS * 7 + INTRO_MS + INTRO_APPLAUSE_MS + 90_000);

  await expect(page.locator(".bug-live")).toContainText("LIVE");
  await expect(page.locator(".viewers")).toContainText("watching");
  await expect(page.locator(".lt-name")).not.toBeEmpty();
  await expect(page.locator(".caption-text")).not.toBeEmpty();
  await expect(page.locator(".slide-product")).not.toBeEmpty();

  await page.screenshot({ path: "test-results/speaking.png", fullPage: false });
});

test("intro phase: announcer introduces the speaker", async ({ page }) => {
  await openAt(page, EPOCH_MS + UNIT_MS * 7 + 3_000);

  await expect(page.locator(".broadcast")).toHaveAttribute("data-phase", "intro");
  await expect(page.locator(".caption-text")).not.toBeEmpty();
  await expect(page.locator(".caption-text")).toContainText("welcome", { ignoreCase: true });

  await page.screenshot({ path: "test-results/intro.png", fullPage: false });
});

test("applause phase shows the applause overlay", async ({ page }) => {
  await openAt(page, EPOCH_MS + UNIT_MS * 7 + UNIT_MS - 4_000);

  await expect(page.locator(".broadcast")).toHaveClass(/is-applause/);
  await page.screenshot({ path: "test-results/applause.png", fullPage: false });
});

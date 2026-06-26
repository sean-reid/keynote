import { test, expect } from "@playwright/test";

// Mirrors src/sync/clock.ts. Scene 0 starts at the epoch; its intro/applause
// windows are fixed, and the keynote runs at least 8 minutes, so these offsets
// land on a known phase regardless of the scene's exact (variable) length.
const EPOCH_MS = Date.UTC(2025, 0, 1, 0, 0, 0);
const INTRO_MS = 9_000;
const INTRO_APPLAUSE_MS = 4_000;

async function openAt(page: import("@playwright/test").Page, instant: number) {
  await page.clock.install({ time: instant });
  await page.goto("/");
}

test("speaking phase: live chrome, lower third, and a caption render", async ({ page }) => {
  await openAt(page, EPOCH_MS + INTRO_MS + INTRO_APPLAUSE_MS + 60_000);

  await expect(page.locator(".bug-live")).toContainText("LIVE");
  await expect(page.locator(".viewers")).toContainText("watching");
  await expect(page.locator(".lt-name")).not.toBeEmpty();
  await expect(page.locator(".caption-text")).not.toBeEmpty();
  await expect(page.locator(".slide-product")).not.toBeEmpty();

  await page.screenshot({ path: "test-results/speaking.png", fullPage: false });
});

test("intro phase: announcer introduces the speaker", async ({ page }) => {
  await openAt(page, EPOCH_MS + 3_000);

  await expect(page.locator(".broadcast")).toHaveAttribute("data-phase", "intro");
  await expect(page.locator(".caption-text")).not.toBeEmpty();
  await expect(page.locator(".caption-text")).toContainText("welcome", { ignoreCase: true });

  await page.screenshot({ path: "test-results/intro.png", fullPage: false });
});

test("applause phase shows the applause state", async ({ page }) => {
  await openAt(page, EPOCH_MS + INTRO_MS + 1_000);

  await expect(page.locator(".broadcast")).toHaveClass(/is-applause/);
  await page.screenshot({ path: "test-results/applause.png", fullPage: false });
});

import { test, expect } from "@playwright/test";
test("public and account pages use the approved campaign imagery", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator('.hero [data-media="stadium"]')).toHaveCount(1);
  await expect(page.locator(".brand-mark")).toHaveCount(0);
  for (const id of [
    "swimming",
    "football",
    "karate",
    "badminton",
    "coaching",
    "agility",
    "family",
    "celebration",
  ])
    await expect(page.locator(`[data-media="${id}"]`).first()).toBeAttached();
  expect(
    await page.locator("h1").evaluate((e) => getComputedStyle(e).fontFamily),
  ).toContain("DM Sans");
  for (const route of ["/", "/auth", "/trial"]) {
    await page.goto(route);
    const sources = await page
      .locator("img")
      .evaluateAll((els) => els.map((e) => e.getAttribute("src")));
    expect(sources.every((s) => s?.startsWith("/images/campaign/"))).toBe(true);
  }
});

test("selective transparent scenes fall back to complete photos on touch layouts", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const sport of ["swimming", "football"]) {
    const image = page.locator(`.sport-${sport} img`);
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.currentSrc))
      .toContain(`${sport}-cutout-`);
    await expect(
      page.locator(`.sport-${sport} .sport-atmosphere`),
    ).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const sport of ["swimming", "football"]) {
    const image = page.locator(`.sport-${sport} img`);
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.currentSrc))
      .not.toContain("cutout");
    await expect(
      page.locator(`.sport-${sport} .sport-atmosphere`),
    ).toBeHidden();
  }
});

test("direct section links settle below the header after motion initializes", async ({
  page,
}) => {
  await page.goto("/#journey");
  await expect(page.locator(".sports-stage")).toHaveClass(/sports-enhanced/);
  await expect
    .poll(() =>
      page
        .locator("#journey")
        .evaluate((el) => Math.abs(el.getBoundingClientRect().top - 90)),
    )
    .toBeLessThan(10);
});

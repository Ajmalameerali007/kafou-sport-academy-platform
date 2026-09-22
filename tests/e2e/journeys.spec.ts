import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("home renders real sports, programs and honest concepts with valid media", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Stronger kids.Brighter futures.",
  );
  await expect(page.locator(".sport-scene")).toHaveCount(4);
  for (const section of [
    "#sports",
    "#programs",
    "#about",
    "#journey",
    "#locations",
  ])
    await expect(page.locator(section)).toBeAttached();
  await page.locator("#locations").scrollIntoViewIfNeeded();
  await expect(
    page.getByText(
      "Branch labels are provisional. Exact venues and sports availability will be confirmed before booking.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("PROGRAM CONCEPTS", { exact: true }),
  ).toBeAttached();
  await page.locator("footer").scrollIntoViewIfNeeded();
  // This asset-integrity check explicitly loads below-fold media; production remains lazy.
  await page.evaluate(() => {
    for (const image of document.images) image.loading = "eager";
  });
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((i) => i.offsetWidth > 0)
      .every((i) => i.complete && i.naturalWidth > 0),
  );
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("auth switches views, validates, supports staff selection without granting roles", async ({
  page,
}) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByText("Enter a valid email address."),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Parent / Guardian name").fill("QA Parent");
  await page.getByLabel("Mobile number", { exact: true }).fill("+971501234567");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("qa@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByLabel("Confirm password", { exact: true }).fill("wrong");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText("Your passwords do not match.")).toBeVisible();
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("TestPassword123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Check your email",
  );
  await page.getByRole("button", { name: "Coach", exact: false }).click();
  await expect(page.getByText("STAFF ACCESS / Coach")).toBeVisible();
  await page.getByLabel("Email").fill("qa@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "email verification is required",
  );
  await expect(page).toHaveURL(/\/auth/);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("qa@example.test");
  await page.getByRole("button", { name: "Send reset instructions" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If an account exists",
  );
  await page.getByRole("button", { name: "Back to log in" }).click();
  await expect(page.getByRole("tab", { name: "Log in" })).toHaveAttribute(
    "data-state",
    "active",
  );
});
test("three-step trial preserves preferences, validates essentials and never invents a booking", async ({
  page,
}) => {
  await page.goto("/trial?sport=football&branch=dxb-2");
  await expect(page.getByRole("radio", { name: "Football" })).toBeChecked();
  await expect(page.getByLabel("Preferred branch (optional)")).toHaveValue(
    "dxb-2",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Review preferences" }).click();
  await expect(page.getByLabel("Parent / Guardian name")).toBeFocused();
  await page.getByLabel("Parent / Guardian name").fill("QA Parent");
  await page.getByLabel("Mobile number").fill("+971501234567");
  await page.getByLabel("Child’s name").fill("QA Child");
  await page.getByLabel("Child’s age").fill("99");
  await page.getByRole("button", { name: "Review preferences" }).click();
  await expect(
    page.getByText("Enter your child’s age (1–17 years)."),
  ).toBeVisible();
  await page.getByLabel("Child’s age").fill("9");
  await page.getByRole("button", { name: "Review preferences" }).click();
  await expect(page.getByText("QA Child · 9 years")).toBeVisible();
  await page.getByRole("button", { name: "Edit Young athlete" }).click();
  await expect(page.getByLabel("Child’s name")).toHaveValue("QA Child");
  await page.getByRole("button", { name: "Review preferences" }).click();
  await page.getByRole("button", { name: "Send trial enquiry" }).click();
  await expect(page.getByText(/Enquiry received · KAF-/)).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.reload();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Parent / Guardian name")).toHaveValue("");
});
test("direct access placeholders and unknown routes are safe", async ({
  page,
}) => {
  for (const role of ["parent", "coach", "sales", "branch", "admin"]) {
    await page.goto("/" + role);
    await expect(page).toHaveURL(/auth/);
    await expect(page.getByLabel("Email",{exact:true})).toBeVisible();
  }
  const response = await page.goto("/not-a-real-page");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "LET’S FIND YOUR WAY BACK." }),
  ).toBeVisible();
});
test("programs and recognition support keyboard selection", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const programs = page.locator(".program-list button");
  await expect(programs.nth(3)).toBeEnabled();
  await programs.nth(3).focus();
  await page.keyboard.press("Enter");
  await expect(programs.nth(3)).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("MAKE THE AFTERNOON COUNT")).toBeVisible();
  const swimming = page.getByRole("tab", { name: "Swimming" });
  await swimming.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Level Progress" }),
  ).toBeVisible();
});
for (const size of [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 590, height: 850 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 844, height: 390 },
])
  test(`responsive and reduced motion ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".sports-stage")).not.toHaveClass(
      /sports-enhanced/,
    );
    await expect(page.locator(".headline-mask").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `outputs/qa/home-${size.width}.png`,
      fullPage: true,
    });
    await page.goto("/auth");
    await expect(page.getByLabel("Email")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `outputs/qa/auth-${size.width}.png`,
      fullPage: true,
    });
    await page.goto("/trial");
    await expect(page.getByRole("radiogroup", { name: "Choose a sport" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("desktop motion, route cleanup and browser history remain stable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".sports-stage")).toHaveClass(/sports-enhanced/);
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".hero-athletes")!).opacity ===
      "1",
  );
  await page.screenshot({
    path: "outputs/qa/home-desktop.png",
    fullPage: false,
  });
  await page.locator("#programs").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "outputs/qa/programs-desktop.png",
    fullPage: false,
  });
  await expect(page.locator(".public-header")).toHaveClass(/is-scrolled/);
  await page.locator(".login-link").click();
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await page.goBack();
  await expect(page.locator(".sports-stage")).toHaveClass(/sports-enhanced/);
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("forms are inert before hydration and private data cannot enter navigation URLs", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of ["/auth", "/auth?view=signup", "/trial"]) {
    await page.goto(route);
    for (const input of await page.locator("main input").all())
      await expect(input).toBeDisabled();
    await expect(page.locator("main button[type=submit]:enabled")).toHaveCount(
      0,
    );
    await expect(page.getByText(/Please enable JavaScript/)).toBeVisible();
  }
  await context.close();
});

test("visible sports remain keyboard-accessible after a scrub direction change", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".sports-stage")).toHaveClass(/sports-enhanced/);
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".hero-athletes")!).opacity ===
      "1",
  );
  for (const fraction of [0.9, 0.1]) {
    await page.evaluate((fraction) => {
      const stage = document.querySelector(".pin-spacer")!;
      window.scrollTo({
        top:
          scrollY +
          stage.getBoundingClientRect().top +
          -88 +
          innerHeight * 3 * fraction,
        behavior: "instant",
      });
    }, fraction);
    const index = fraction > 0.5 ? 3 : 0;
    await expect(page.locator(".sport-scene").nth(index)).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await expect(
      page.locator(".sport-scene").nth(index).getByRole("link"),
    ).toBeVisible();
    expect(
      await page
        .locator(".sport-scene")
        .nth(index)
        .evaluate((el) => (el as HTMLElement).inert),
    ).toBe(false);
    // The visible image and the actual topmost clickable caption must belong to the same sport.
    await expect
      .poll(() =>
        page
          .locator(".sport-scene")
          .nth(index)
          .getByRole("link")
          .evaluate((link) => {
            const r = link.getBoundingClientRect();
            return (
              document
                .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                ?.closest(".sport-scene") === link.closest(".sport-scene")
            );
          }),
      )
      .toBe(true);
  }
});
test("responsive and reduced-motion teardown preserve the reading section", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".sports-stage")).toHaveClass(/sports-enhanced/);
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".hero-athletes")!).opacity ===
      "1",
  );
  await page.evaluate(() =>
    window.scrollTo({
      top:
        scrollY +
        document.querySelector("#journey")!.getBoundingClientRect().top -
        140,
      behavior: "instant",
    }),
  );
  await expect
    .poll(() =>
      page
        .locator("#journey")
        .evaluate((el) => Math.abs(el.getBoundingClientRect().top - 140)),
    )
    .toBeLessThan(20);
  await page.setViewportSize({ width: 900, height: 950 });
  await expect
    .poll(() =>
      page
        .locator("#journey")
        .evaluate((el) => Math.abs(el.getBoundingClientRect().top)),
    )
    .toBeLessThan(300);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator("#journey")
        .evaluate((el) => Math.abs(el.getBoundingClientRect().top)),
    )
    .toBeLessThan(350);
});
test("anchors, mobile menu, native page links and auth history work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .locator("#mobile-nav")
    .getByRole("link", { name: "Programs" })
    .click();
  await expect(page).toHaveURL(/#programs$/);
  await expect(page.locator("#mobile-nav")).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#mobile-nav")).toHaveCount(0);
  await page
    .locator(".header-actions")
    .getByRole("link", { name: "Free trial" })
    .click();
  await expect(page.getByRole("radiogroup", { name: "Choose a sport" })).toBeVisible();
  await page.goto("/auth?view=signup");
  await expect(
    page.getByRole("tab", { name: "Create account" }),
  ).toHaveAttribute("data-state", "active");
  await page.getByRole("tab", { name: "Log in", exact: true }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Log in", exact: true }),
  ).toHaveAttribute("data-state", "active");
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Create account" }),
  ).toHaveAttribute("data-state", "active");
  await page.goForward();
  await expect(page.getByLabel("Email")).toBeVisible();
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
});
test("core pages pass automated WCAG contrast and semantic checks", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of [
    "/",
    "/auth",
    "/auth?view=signup",
    "/auth?view=forgot",
    "/trial",
  ]) {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations, route).toEqual([]);
  }
});

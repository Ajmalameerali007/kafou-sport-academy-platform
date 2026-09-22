import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("new supplied cutouts remain transparent assets across mobile and desktop", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    for (const [selector, asset] of [
      [".sport-karate", "karate"],
      [".sport-badminton", "badminton"],
      [".program-photo", "agility"],
      [".motivation-image", "celebration"],
    ]) {
      const image = page.locator(`${selector} img`);
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((i: HTMLImageElement) => i.currentSrc))
        .toContain(`${asset}-cutout-`);
      await expect
        .poll(() =>
          image.evaluate(
            (i: HTMLImageElement) => i.complete && i.naturalWidth > 0,
          ),
        )
        .toBe(true);
      expect(await image.evaluate((i) => getComputedStyle(i).objectFit)).toBe(
        "contain",
      );
    }
  }
});
test("homepage selections feed the short trial and remain preferences, not confirmed venues", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("Sport", { exact: true }).selectOption("karate");
  await page
    .getByLabel("Preferred branch", { exact: true })
    .selectOption("shj-2");
  await expect(page.locator("#home-branch option")).toHaveCount(9);
  await expect(page.getByText("Dates & times to be confirmed")).toBeVisible();
  await page
    .getByRole("link", { name: "Start a free trial", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Karate", exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("Preferred branch (optional)")).toHaveValue(
    "shj-2",
  );
});
test("Arabic switches without losing entries, validates and persists through navigation", async ({
  page,
}) => {
  await page.goto("/trial?sport=swimming");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Parent / Guardian name").fill("ولي أمر تجريبي");
  await page.getByLabel("Mobile number").fill("+971501234567");
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel("اسم وليّ الأمر")).toHaveValue("ولي أمر تجريبي");
  await page.getByRole("button", { name: "مراجعة التفضيلات" }).click();
  await expect(
    page.getByText("أدخل اسم الطفل بين حرفين و١٠٠ حرف."),
  ).toBeVisible();
  await page.getByLabel("اسم الطفل", { exact: true }).fill("طفل تجريبي");
  await page.getByLabel("عمر الطفل", { exact: true }).fill("٩");
  await page.getByRole("button", { name: "مراجعة التفضيلات" }).click();
  await expect(page.getByText("طفل تجريبي · 9 سنوات")).toBeVisible();
  await page.getByRole("button", { name: "إرسال طلب تجربة" }).click();
  await expect(
    page.getByText(
      "تم حفظ الطلب. اختر حصة مناسبة أدناه لحجز التجربة.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "العودة إلى الأكاديمية" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "أطفال أقوى.",
  );
  await page.goto("/auth");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await page.getByRole("tab", { name: "إنشاء حساب" }).click();
  await expect(page.getByLabel("تأكيد كلمة المرور")).toBeVisible();
  await page.getByRole("tab", { name: "تسجيل الدخول" }).click();
  await page.getByRole("button", { name: "نسيت كلمة المرور؟" }).click();
  await page
    .getByLabel("البريد الإلكتروني", { exact: true })
    .fill("qa@example.test");
  await page.getByRole("button", { name: "إرسال إرشادات الاستعادة" }).click();
  await expect(page.getByRole("status")).toContainText(
    "إذا وُجد حساب",
  );
  await page.goBack();
  await expect(page.getByRole("tab", { name: "تسجيل الدخول" })).toHaveAttribute(
    "data-state",
    "active",
  );
});
test("Arabic public and form routes are accessible and fit all requested viewports", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addCookies([
    {
      name: "kafou-locale",
      value: "ar",
      url: process.env.BASE_URL || "http://localhost:3100",
    },
  ]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 590, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 1024 ? 600 : 900 });
    for (const route of ["/", "/auth?view=signup", "/trial"]) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
  for (const route of [
    "/",
    "/auth",
    "/auth?view=signup",
    "/auth?view=forgot",
    "/trial",
  ]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
  expect(errors).toEqual([]);
});

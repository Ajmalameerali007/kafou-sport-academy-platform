import { demoPassword } from "./private-config";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function login(page: Page, role: string) {
  await page.goto("/auth");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(`${role}.kafou@example.com`);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(demoPassword);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLInputElement>('input[type="password"]')
      .forEach((input) => {
        input.value = "";
      }),
  );
  await expect(page).not.toHaveURL(/\/auth/);
  await expect(page.locator(".portal-skeleton")).toHaveCount(0);
}
test("parent athlete workspace, keyboard search, real profile and responsive Arabic", async ({
  page,
}) => {
  await login(page, "parent");
  await expect(
    page.getByRole("heading", { name: "Your young athletes" }),
  ).toBeVisible();
  await expect(page.locator(".portal-athlete").first()).toContainText("DEMO");
  const search = page.getByRole("button", {
    name: "Search workspace",
    exact: true,
  });
  await search.click();
  await page.getByRole("textbox", { name: "Search records" }).fill("Child One");
  await expect(page.locator(".portal-search-results button")).not.toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(search).toBeFocused();
  await page
    .locator(".portal-athlete")
    .filter({ hasText: "Child One" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("swimming");
  await page.getByRole("button", { name: "Close panel" }).click();
  for (const width of [320, 390, 590, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "outputs/phase2.5/parent-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "رياضيّوك الصغار" }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "فتح القائمة" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "إغلاق اللوحة" }).click();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "outputs/phase2.5/parent-arabic-mobile.png",
    fullPage: true,
  });
});
test("sales pipeline opens accessible lead drawer, supports filters and URL history", async ({
  page,
}) => {
  await login(page, "sales");
  await page.getByRole("button", { name: "Enquiries", exact: true }).click();
  await expect(page).toHaveURL(/view=Enquiries/);
  await expect(
    page.getByRole("region", { name: "Sales pipeline" }),
  ).toBeVisible();
  await page.locator(".portal-lead-card").first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "Lead profile and next actions",
  );
  await expect(
    page.getByRole("heading", { name: "Interaction timeline" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Search leads" })
    .fill("nonexistentxyz");
  await expect(
    page.getByRole("heading", { name: "No leads in this view" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search leads" }).fill("");
  await page.getByRole("button", { name: "New lead", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Capture the essentials.",
  );
  await expect(page.getByLabel("Parent / Guardian name")).toBeVisible();
  await page.getByLabel("Parent / Guardian name").fill("Unfinished family");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alert")).toContainText("Unsaved changes");
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Parent / Guardian name")).toHaveValue(
    "Unfinished family",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Discard changes" }).click();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "outputs/phase2.5/sales-pipeline.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Trials", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("region", { name: "Sales pipeline" }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
});
test("head office branch scope, search and action center do not fabricate unavailable modules", async ({
  page,
}) => {
  await login(page, "headoffice");
  await expect(
    page.getByRole("heading", { name: "Action centre" }),
  ).toBeVisible();
  await expect(page.locator(".admin-action-centre")).toContainText(
    "The next right action",
  );
  await expect(
    page.getByRole("button", { name: "Team", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Today’s Revenue", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByLabel("Filter branch")
    .selectOption({ label: "DEMO · Sharjah" });
  await expect(page.locator(".admin-branch-summary")).not.toContainText(
    "DEMO · Dubai",
  );
  await page.getByRole("button", { name: "Branches", exact: true }).click();
  await expect(page.locator(".ops-child summary")).not.toContainText([
    "DEMO · Dubai",
  ]);
  await page
    .getByRole("button", { name: "Search workspace", exact: true })
    .click();
  await page.getByLabel("Search records").fill("Child One");
  await expect(
    page.getByRole("heading", { name: "No matching records" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("Filter branch").selectOption("");
  await page
    .getByRole("button", { name: "Action center", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Operational reminders");
  await page.keyboard.press("Escape");
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "outputs/phase2.5/head-office.png",
    fullPage: true,
  });
});
test("workspace launcher and mobile coach navigation work without simulated progress", async ({
  page,
}) => {
  await login(page, "coach");
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Choose your workspace" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Coach workspace/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your day, in focus." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Assigned sessions", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText(
      "Times shown in UAE time. Booking type and attendance are separate.",
    ),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "outputs/phase2.5/coach-mobile.png",
    fullPage: true,
  });
});

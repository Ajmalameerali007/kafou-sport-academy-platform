import { test, expect } from "@playwright/test";
const out = "outputs/stabilization-2026-09-21";
test("parent membership uses explicit child scope and focused renewal; family uses readable profiles", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: `${out}/parent-session.private.json`,
  });
  const page = await ctx.newPage();
  await page.goto("/parent?view=Memberships");
  await expect(page.locator(".portal-skeleton")).toHaveCount(0);
  await expect(page.getByLabel("Choose child", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Membership overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Renew for the next month",
      exact: true,
    }),
  ).toHaveCount(0);
  const ids = await page
    .getByLabel("Choose child", { exact: true })
    .locator("option")
    .evaluateAll((o) =>
      o.map((x) => (x as HTMLOptionElement).value).filter(Boolean),
    );
  for (const id of ids.slice(0, 2)) {
    await page.getByLabel("Choose child", { exact: true }).selectOption(id);
    await expect(
      page
        .locator("[data-membership-child]")
        .filter({ has: page.locator(`:not([data-membership-child="${id}"])`) }),
    ).toHaveCount(0);
    await expect(page.locator(".member-loading")).toHaveCount(0);
    expect(
      await page
        .locator("[data-membership-child]")
        .evaluateAll(
          (els, id) =>
            els.every((e) => e.getAttribute("data-membership-child") === id),
          id,
        ),
    ).toBeTruthy();
  }
  await page.goto("/parent?view=Family");
  await expect(
    page.getByRole("region", { name: "Your children", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View profile", exact: true }).first(),
  ).toBeVisible();
  await ctx.close();
});
test("package catalogue keeps branch matrix out of rows", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: `${out}/admin-session.private.json`,
  });
  const page = await ctx.newPage();
  await page.goto("/admin?view=Packages");
  await expect(
    page.getByRole("columnheader", {
      name: "Branch availability",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("tbody .management-offer")).toHaveCount(0);
  await ctx.close();
});

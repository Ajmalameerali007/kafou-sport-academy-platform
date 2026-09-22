import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
const out = "outputs/admin-experience-2026-09-21";
const branch = "26707ec0-f2a1-47f8-88b2-2b3778f4c108";
for (const role of ["admin", "branch"])
  test(`${role}: directories, detail actions, calendar and responsive Arabic`, async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const context = await browser.newContext({
      storageState: existsSync(`${out}/${role}-session.private.json`)
        ? `${out}/${role}-session.private.json`
        : undefined,
      viewport: { width: 1440, height: 960 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    if (!existsSync(`${out}/${role}-session.private.json`)) {
      await page.goto("http://127.0.0.1:3101/auth");
      await page
        .getByRole("textbox", { name: "Email", exact: true })
        .fill(`${role}.kafou@example.com`);
      await page
        .getByRole("textbox", { name: "Password", exact: true })
        .fill(process.env.KAFOU_DEMO_PASSWORD || "");
      await page.getByRole("button", { name: "Log in", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${role}(?:\\?|$)`));
    }
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:3101";
    const visit = async (view: string) => {
      await page.goto(
        `${base}/${role}?view=${encodeURIComponent(view)}&branch=${branch}`,
      );
      await expect(page.locator(".portal-skeleton")).toHaveCount(0);
      await expect(page.getByText("Page could not be loaded")).toHaveCount(0);
    };
    mkdirSync(`${out}/after`, { recursive: true });
    await visit("Families");
    await expect(
      page.getByRole("heading", { name: "Customers", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Customer directory", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Child profile", exact: true }),
    ).toHaveCount(0);
    const search = page.getByRole("searchbox");
    await search.fill("no-such-family-needle");
    await expect(
      page.getByText("No matching records", { exact: true }),
    ).toBeVisible();
    await search.fill("");
    await page.screenshot({ path: `${out}/after/${role}-customers.png` });
    await page
      .getByRole("button", { name: "Manage family", exact: true })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.locator("summary").filter({ hasText: "Add a child" }).click();
    await expect(
      page.getByRole("heading", { name: "Add a child", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `${out}/after/${role}-family-details.png` });
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .click();
    await visit("Trials");
    const admissions = page.getByRole("region", {
      name: "Trial admissions",
      exact: true,
    });
    await expect(admissions.getByRole("table")).toBeVisible();
    await page.screenshot({ path: `${out}/after/${role}-trials.png` });
    await admissions
      .getByRole("button", { name: "Manage trial", exact: true })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .click();
    await visit("Classes / Sessions");
    await expect(
      page.getByRole("region", { name: "Class catalogue" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Session calendar", exact: true })
      .click();
    const data = await (
      await page.request.get(`${base}/api/workspace?branch=${branch}`)
    ).json();
    const sessions =
      data.data?.records?.class_sessions || data.data?.class_sessions || [];
    if (sessions.length)
      await page
        .getByLabel("Calendar date", { exact: true })
        .fill(sessions[0].starts_at.slice(0, 10));
    await expect(page.locator(".work-calendar-day")).toHaveCount(7);
    await page.screenshot({
      path: `${out}/after/${role}-classes-calendar.png`,
    });
    await page.getByLabel("Calendar view", { exact: true }).selectOption("day");
    await expect(page.locator(".work-calendar-day")).toHaveCount(1);
    await page
      .getByLabel("Calendar view", { exact: true })
      .selectOption("week");
    await page
      .getByRole("button", { name: "Next period", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Previous period", exact: true })
      .click();
    await visit("Attendance");
    await expect(
      page.getByRole("region", { name: "Session register" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Open roster", exact: true })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({ path: `${out}/after/${role}-roster.png` });
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .click();
    await page.screenshot({ path: `${out}/after/${role}-attendance.png` });
    await visit("Schedule");
    await expect(
      page.getByRole("region", { name: "Session calendar" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${out}/after/${role}-calendar-mobile.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.screenshot({
      path: `${out}/after/${role}-calendar-mobile-ar.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await visit("Families");
    await page.screenshot({
      path: `${out}/after/${role}-customers-mobile-ar.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
    const release = await (
      await page.request.get(`${base}/api/release`)
    ).json();
    writeFileSync(
      `${out}/${role}-verification.json`,
      JSON.stringify({ release, errors, role, branch }, null, 2),
    );
    await context.close();
  });

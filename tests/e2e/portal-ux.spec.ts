import {
  test,
  expect,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const password = process.env.KAFOU_DEMO_PASSWORD || "";
const emails: Record<string, string> = {
  parent: "parent.kafou@example.com",
  coach: "coach.kafou@example.com",
  branch: "branch.kafou@example.com",
  super_admin: "admin.kafou@example.com",
};

async function roleSession(browser: Browser, role: string) {
  const context = await browser.newContext({
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3101",
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const base = process.env.BASE_URL || "http://127.0.0.1:3101";
  if (!base.startsWith("http://127.0.0.1:")) throw new Error("Local test only");
  const destinations: Record<string, string> = {
    parent: "/parent",
    coach: "/coach",
    branch: "/branch",
    super_admin: "/admin",
  };
  const destination = destinations[role];
  const email = emails[role];
  if (!email) throw new Error(`No current local role account for ${role}`);
  if (!password) throw new Error("KAFOU_DEMO_PASSWORD is required");
  await page.goto("/auth");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination}(?:\\?|$)`));
  await expect(page).toHaveURL(new RegExp(`${destination}(?:\\?|$)`));
  return { context, page };
}

async function closeAll(contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close()));
}

test("parent uses six consumer destinations and contextual sub-features", async ({
  browser,
}) => {
  mkdirSync("outputs/portal-ux/after", { recursive: true });
  const { context, page } = await roleSession(browser, "parent");
  try {
    await expect(page.locator(".portal-skeleton")).toHaveCount(0);
    const primary = page.locator(".portal-sidebar nav button");
    await expect(primary).toHaveCount(6);
    await expect(primary).toHaveText([
      /Home/,
      /Schedule/,
      /Progress/,
      /Family/,
      /Membership/,
      /Support/,
    ]);
    for (const backendLabel of [
      "Enquiries",
      "Trials",
      "Finance",
      "Makeups",
      "Reports",
      "Certificates",
      "Recognition",
      "Engagement",
      "Coach messages",
      "Family access",
      "Documents",
      "Notifications",
      "Security",
    ]) {
      await expect(
        page.locator(".portal-sidebar nav").getByRole("button", {
          name: backendLabel,
          exact: true,
        }),
      ).toHaveCount(0);
    }
    await expect(
      page.getByRole("heading", { name: "Parent Home" }),
    ).toBeVisible();
    await expect(page.getByText("Next session", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Your young athletes", { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: "outputs/portal-ux/after/parent-home.png",
      fullPage: true,
    });

    await page
      .locator(".portal-sidebar nav")
      .getByRole("button", { name: "Schedule", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Schedule", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Make-up and rescheduling/ }),
    ).toBeVisible();
    await expect(
      page.locator(".product-session").filter({ hasText: "Completed" }),
    ).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Upcoming" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.screenshot({
      path: "outputs/portal-ux/after/parent-schedule.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".product-mobile-bar > button")).toHaveCount(5);
    await expect(page.locator(".product-mobile-bar")).toContainText("Home");
    await expect(page.locator(".product-mobile-bar")).toContainText("Schedule");
    await expect(page.locator(".product-mobile-bar")).toContainText("Progress");
    await expect(page.locator(".product-mobile-bar")).toContainText("Family");
    await page
      .locator(".parent-section-tabs")
      .getByRole("button", { name: "Make-up and rescheduling", exact: true })
      .click();
    await expect(
      page.locator('.product-mobile-bar button[aria-current="page"]'),
    ).toHaveText("Schedule");
    await expect(
      page.locator(".portal-heading-actions .portal-primary"),
    ).toHaveCount(0);
    await page
      .locator(".product-mobile-bar")
      .getByRole("button", { name: "Progress", exact: true })
      .click();
    await page
      .locator(".parent-section-tabs")
      .getByRole("button", { name: "Progress reports", exact: true })
      .click();
    await expect(
      page.locator('.product-mobile-bar button[aria-current="page"]'),
    ).toHaveText("Progress");
    const childContext = await page
      .locator(".product-child-selector")
      .boundingBox();
    await expect(
      page.getByRole("combobox", { name: "Athlete", exact: true }),
    ).toHaveCount(0);
    expect(childContext!.y + childContext!.height).toBeLessThan(450);
    await page.screenshot({
      path: "outputs/portal-ux/after/parent-reports-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(
      page.locator('.portal-sidebar nav button[aria-current="page"]'),
    ).toHaveText("Progress");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Profile and security" }).click();
    await expect(
      page.getByRole("button", { name: "Membership", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Support", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Settings", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.screenshot({
      path: "outputs/portal-ux/after/parent-mobile-ar.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
  } finally {
    await context.close();
  }
});

test("completed synthetic child is consistent across isolated role sessions", async ({
  browser,
}) => {
  const childName = "DEMO PRODUCT · portal-ux-2026-09-20 · Child";
  const contexts: BrowserContext[] = [];
  const observations: Array<Record<string, unknown>> = [];
  try {
    const parent = await roleSession(browser, "parent");
    contexts.push(parent.context);
    let started = Date.now();
    await parent.page.goto("/parent");
    await expect(
      parent.page.locator(".product-child-selector option", {
        hasText: childName,
      }),
    ).toHaveCount(1);
    observations.push({
      role: "parent",
      observed: "child context",
      trigger: "fresh authenticated navigation",
      latency_ms: Date.now() - started,
    });

    for (const [role, path] of [
      ["coach", "/coach?view=Students"],
      ["branch", "/branch?view=Students"],
      ["super_admin", "/admin?view=Students"],
    ] as const) {
      const session = await roleSession(browser, role);
      contexts.push(session.context);
      if (role === "coach") {
        await session.page.goto("/coach");
        await expect(
          session.page.getByRole("heading", { name: "Coach Today" }),
        ).toBeVisible();
        await expect(
          session.page.getByText("Next assigned session"),
        ).toBeVisible();
        await session.page.screenshot({
          path: "outputs/portal-ux/after/coach-today.png",
          fullPage: true,
        });
        const profile = session.page.locator(".coach-profile-disclosure");
        await expect(
          profile.getByRole("textbox", { name: "Bio", exact: true }),
        ).toBeHidden();
        await profile.locator("summary").focus();
        await session.page.keyboard.press("Enter");
        const bio = profile.getByRole("textbox", { name: "Bio", exact: true });
        await expect(bio).toBeVisible();
        const original = await bio.inputValue();
        await bio.fill("Unsaved local UX check");
        await profile.locator("summary").click();
        await profile.locator("summary").click();
        await expect(bio).toHaveValue("Unsaved local UX check");
        await bio.fill(original);
      }
      started = Date.now();
      await session.page.goto(path);
      await expect(
        session.page.getByText(childName, { exact: true }).first(),
      ).toBeVisible();
      const studentSearch = session.page.getByRole("textbox", {
        name: "Search students",
        exact: true,
      });
      await studentSearch.fill("NoStudentMatchesThisQuery");
      await expect(
        session.page.getByRole("heading", {
          name: "No matching students",
          exact: true,
        }),
      ).toBeVisible();
      await expect(session.page.locator(".student-journey")).toHaveCount(0);
      await session.page
        .getByRole("button", { name: "Clear search", exact: true })
        .click();
      await expect(session.page.locator(".student-journey")).toBeVisible();
      if (role === "coach") {
        await expect(
          session.page.getByText("Assignment-scoped access"),
        ).toBeVisible();
        await expect(
          session.page.getByText(
            "Family contacts and finance are not included in coach access.",
          ),
        ).toBeVisible();
        await session.page.screenshot({
          path: "outputs/portal-ux/after/coach-students.png",
          fullPage: true,
        });
      } else if (role === "branch") {
        await expect(
          session.page.getByText("Permission-scoped records"),
        ).toBeVisible();
        await session.page.screenshot({
          path: "outputs/portal-ux/after/front-desk-students.png",
          fullPage: true,
        });
        await session.page
          .locator(".portal-sidebar nav")
          .getByRole("button", { name: "Customers", exact: true })
          .click();
        await session.page
          .getByRole("button", { name: "Manage family", exact: true })
          .first()
          .click();
        await expect(
          session.page.locator("summary").filter({ hasText: "Add a child" }),
        ).toBeVisible();
        await expect(
          session.page.locator("form").filter({
            has: session.page.getByRole("heading", {
              name: "Add a child",
              exact: true,
            }),
          }),
        ).toBeHidden();
        await session.page.screenshot({
          path: "outputs/portal-ux/after/front-desk-family.png",
          fullPage: true,
        });
      } else {
        await session.page.screenshot({
          path: "outputs/portal-ux/after/owner-students.png",
          fullPage: true,
        });
        await session.page.setViewportSize({ width: 720, height: 900 });
        await session.page.keyboard.press("Tab");
        await expect(session.page.locator(":focus")).toBeVisible();
        expect(
          await session.page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        await session.page.screenshot({
          path: "outputs/portal-ux/after/owner-students-200-percent-equivalent.png",
          fullPage: true,
        });
      }
      observations.push({
        role,
        observed: role === "coach" ? "assigned student" : "authorized student",
        trigger: "fresh authenticated navigation",
        latency_ms: Date.now() - started,
      });
    }

    const branch = contexts[2].pages()[0];
    await branch.goto("/admin");
    await expect(branch).toHaveURL(/\/account/);
    observations.push({
      role: "branch",
      observed: "owner route denied",
      result: "redirected to granted workspace selector",
    });

    writeFileSync(
      "outputs/portal-ux/after/cross-account-observation.json",
      `${JSON.stringify(
        {
          at: new Date().toISOString(),
          source: "local compiled build",
          separateBrowserContexts: true,
          childName,
          observations,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await closeAll(contexts);
  }
});

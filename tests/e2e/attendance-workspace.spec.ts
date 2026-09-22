import {
  test,
  expect,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import { demoPassword } from "./private-config";
const session = process.env.ATTENDANCE_REHEARSAL_SESSION;
const base = process.env.BASE_URL || "http://127.0.0.1:3101";
test.skip(
  !session,
  "Requires an existing authorized synthetic rehearsal occurrence; never seeds or resets the active database.",
);
async function account(browser: Browser, role: string) {
  const context = await browser.newContext({ baseURL: base });
  const response = await context.request.post("/api/auth/login", {
    headers: { Origin: base },
    data: {
      identifier: `${role}.kafou@example.com`,
      password: demoPassword,
      remember: false,
    },
  });
  expect(response.ok()).toBeTruthy();
  return context;
}
test("Coach and Branch read the same canonical finalized register", async ({
  browser,
}) => {
  const contexts: BrowserContext[] = [];
  try {
    const registers = [];
    for (const role of ["coach", "branch"]) {
      const c = await account(browser, role);
      contexts.push(c);
      const response = await c.request.get(
        `/api/attendance/register?session=${session}`,
      );
      expect(response.status()).toBe(200);
      const r = (await response.json()).data;
      expect(r.finalized_at).toBeTruthy();
      registers.push(r);
      const p = await c.newPage();
      await p.goto(
        `/${role}?view=${role === "coach" ? "Assigned%20sessions" : "Attendance"}&recordKind=session&record=${session}`,
      );
      const register = p.locator(`[data-attendance-session="${session}"]`);
      await expect(register).toBeVisible();
      await expect(register.locator(".attendance-row")).toHaveCount(
        r.roster.length,
      );
      await expect(register.locator("select").first()).toBeDisabled();
      await expect(register.locator(".attendance-avatar")).toHaveCount(
        r.roster.length,
      );
      await expect
        .poll(() =>
          register
            .locator(".attendance-avatar")
            .first()
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBeGreaterThan(0);
    }
    expect(registers[0].roster).toEqual(registers[1].roster);
  } finally {
    for (const c of contexts) await c.close();
  }
});
test("Parent cannot access staff register or photo scope", async ({
  browser,
}) => {
  const c = await account(browser, "parent");
  try {
    for (const route of ["register", "photo-scope"]) {
      const r = await c.request.get(
        `/api/attendance/${route}?session=${session}`,
      );
      expect(r.status()).toBe(403);
    }
  } finally {
    await c.close();
  }
});
test("Coach register remains usable on mobile Arabic", async ({ browser }) => {
  const c = await account(browser, "coach");
  try {
    await c.addCookies([{ name: "kafou-locale", value: "ar", url: base }]);
    const p = await c.newPage();
    await p.setViewportSize({ width: 360, height: 844 });
    await p.goto(
      `/coach?view=Assigned%20sessions&recordKind=session&record=${session}`,
    );
    await expect(
      p.locator(`[data-attendance-session="${session}"]`),
    ).toBeVisible();
    await expect(p.locator("html")).toHaveAttribute("dir", "rtl");
    expect(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
  } finally {
    await c.close();
  }
});

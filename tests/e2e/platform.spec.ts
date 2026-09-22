import { test, expect } from "@playwright/test";
import { emailLink } from "./email-helper";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=/g, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const o = digest[19] & 15;
  return ((digest.readUInt32BE(o) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
const password = process.env.KAFOU_LOCAL_TEST_PASSWORD || "";
async function login(page: import("@playwright/test").Page, role = "parent") {
  await page.goto("/auth");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(`${role}@kafou.example.test`);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLInputElement>('input[type="password"]')
      .forEach((input) => {
        input.value = "";
      }),
  );
  await expect(page).toHaveURL(role === "parent" ? /\/parent/ : /\/account/);
}
test("parent creates family, child and child profile; keeps Arabic and secure session", async ({
  page,
  context,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Family", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  const create = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Create your family profile" }),
  });
  if (await create.count()) {
    await create.getByLabel("Family name").fill("Synthetic Test Family");
    await create.getByLabel("Mobile number").fill("+971501234567");
    await create.getByRole("button", { name: "Save", exact: true }).click();
  }
  await page
    .locator("summary")
    .filter({ hasText: "Family contact information" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Family contact information" }),
  ).toBeVisible();
  const child = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Add a child", exact: true }),
  });
  await child.getByLabel("Child name").fill(`Synthetic Child ${Date.now()}`);
  await child.getByLabel("Age", { exact: true }).fill("8");
  await child.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".ops-child")).not.toHaveCount(0);
  const cookies = await context.cookies();
  expect(
    cookies.filter((c) => c.name.includes("auth-token")).length,
  ).toBeGreaterThan(0);
  expect(
    cookies
      .filter((c) => c.name.includes("auth-token"))
      .every((c) => c.httpOnly),
  ).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Family", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "الملف والأمان", exact: true })
    .click();
  await page.getByRole("button", { name: "تسجيل الخروج", exact: true }).click();
  await expect(page).toHaveURL(/auth/);
  await page.goto("/parent");
  await expect(page).toHaveURL(/auth/);
});
test("branch enquiry queue and forged admin mutation are isolated", async ({
  page,
}) => {
  await login(page, "branch");
  await page.goto("/branch");
  await page.getByRole("button", { name: "Enquiries", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "New lead", exact: true }),
  ).toBeVisible();
  const origin = new URL(page.url()).origin;
  const r = await page.request.post("/api/commands", {
    headers: { Origin: origin },
    data: {
      action: "branch.save",
      data: {
        slug: "unauthorized",
        name: "Unauthorized",
        name_ar: "",
        area: "",
        provisional: true,
        active: true,
      },
    },
  });
  expect(r.status()).toBe(403);
  await page.goto("/admin");
  await expect(page).toHaveURL(/account/);
});
test("super administrator MFA gate and verification unlock management", async ({
  page,
  browser,
}) => {
  const env = JSON.parse(
    readFileSync("outputs/foundation/local-keys.json", "utf8"),
  );
  if (!env.API_URL.startsWith("http://127.0.0.1:"))
    throw new Error("Local tests only");
  const admin = createClient(env.API_URL, env.SECRET_KEY);
  const fixtures = JSON.parse(
    readFileSync("outputs/foundation/test-users.json", "utf8"),
  );
  const uid = fixtures.find(
    (u: { role: string }) => u.role === "super_admin",
  ).id;
  const fs = await admin.auth.admin.mfa.listFactors({ userId: uid });
  for (const f of fs.data?.factors || [])
    await admin.auth.admin.mfa.deleteFactor({ userId: uid, id: f.id });
  await login(page, "super_admin");
  await expect(
    page.getByText(
      "Verify your authenticator before using administrator tools.",
    ),
  ).toBeVisible();
  const origin = new URL(page.url()).origin;
  const headers = { Origin: origin };
  const factors = await (await page.request.get("/api/auth/mfa")).json();
  let factor = factors.data.totp.find(
    (f: { status: string }) => f.status === "verified",
  );
  // Only fresh local fixtures run this enrolment case; a stored verified factor is exercised separately.
  expect(factor).toBeUndefined();
  const enrolled = await (
    await page.request.post("/api/auth/mfa/enroll", { headers, data: {} })
  ).json();
  expect(enrolled.ok).toBe(true);
  factor = enrolled.data;
  const verified = await (
    await page.request.post("/api/auth/mfa/verify", {
      headers,
      data: { factorId: factor.id, code: totp(factor.totp.secret) },
    })
  ).json();
  expect(verified.ok).toBe(true);
  await page.goto("/admin");
  await expect(page.locator(".portal-skeleton")).toHaveCount(0);
  await page.screenshot({
    path: "outputs/product/screens-regression/owner-action-centre-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "outputs/product/screens-regression/owner-action-centre-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    page.getByRole("button", { name: "Team", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Branches", exact: true }).click();
  await expect(
    page.getByText(
      "Provisional preferences are not confirmed venues. Confirm actual details before publishing availability.",
    ),
  ).toBeVisible();
  const email = `invited-${Date.now()}@example.test`;
  const workspace = await (await page.request.get("/api/workspace")).json();
  const invited = await (
    await page.request.post("/api/staff/invite", {
      headers,
      data: {
        email,
        role: "branch",
        branch_ids: [workspace.data.branches[0].id],
      },
    })
  ).json();
  expect(invited.ok).toBe(true);
  const recipient = await browser.newContext({ baseURL: origin });
  const recipientPage = await recipient.newPage();
  await recipientPage.goto(await emailLink(email));
  await expect(recipientPage).toHaveURL(/auth\/reset/);
  await recipientPage.getByLabel("Password", { exact: true }).fill(password);
  await recipientPage
    .getByLabel("Confirm password", { exact: true })
    .fill(password);
  await recipientPage.getByRole("button", { name: "Update password" }).click();
  await expect(recipientPage.getByRole("status")).toContainText(
    "Password updated",
  );
  await recipientPage.goto("/auth");
  await recipientPage.getByLabel("Email", { exact: true }).fill(email);
  await recipientPage.getByLabel("Password", { exact: true }).fill(password);
  await recipientPage
    .getByRole("button", { name: "Log in", exact: true })
    .click();
  await expect(recipientPage).toHaveURL(/account/);
  const repeated = await recipientPage.request.post("/api/commands", {
    headers,
    data: { action: "invitation.accept", data: { id: invited.data.id } },
  });
  expect(repeated.status()).toBe(403);
  await recipientPage.goto("/branch");
  await expect(
    recipientPage.getByRole("button", { name: "Enquiries", exact: true }),
  ).toBeVisible();
  await recipient.close();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("same-origin mutation boundary rejects cross-site requests", async ({
  request,
}) => {
  const r = await request.post("/api/enquiries", {
    headers: { Origin: "https://untrusted.example" },
    data: {},
  });
  expect(r.status()).toBe(403);
});

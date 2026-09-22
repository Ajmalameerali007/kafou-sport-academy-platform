import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { emailLink } from "./email-helper";
test("captured signup verification and recovery links establish secure sessions", async ({
  page,
}) => {
  const email = `verify-${Date.now()}@example.test`,
    password = randomUUID() + "Aa9!";
  await page.goto("/auth?view=signup");
  await page
    .getByLabel("Parent / Guardian name")
    .fill("Synthetic Verification");
  await page.getByLabel("Mobile number", { exact: true }).fill("+971501234567");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await emailLink(email));
  await expect(page).toHaveURL(/\/account/);
  await page.getByRole("button", { name: "Profile and security" }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/auth$/);
  await page.goto("/auth?view=forgot");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset instructions" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  await page.goto(await emailLink(email));
  await expect(page).toHaveURL(/\/auth\/reset/);
  await page.getByLabel("Password", { exact: true }).fill(password + "New");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill(password + "New");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  await page.goto("/parent");
  await expect(page).toHaveURL(/auth/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password + "New");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/parent/);
});

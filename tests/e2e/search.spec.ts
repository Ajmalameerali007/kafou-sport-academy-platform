import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { demoPassword } from "./private-config";
const fixture = JSON.parse(
  readFileSync(
    `outputs/product/local-${process.env.KAFOU_PRODUCT_BATCH || "connected-auth-v2-2026-09-20"}.json`,
    "utf8",
  ),
);
test.use({ trace: "off", video: "off" });
test("server search and record hydration use real current role scope", async ({
  page,
  baseURL,
}) => {
  if (!baseURL || !/^http:\/\/(localhost|127\.0\.0\.1):310[012]$/.test(baseURL))
    throw Error("Known local app required");
  const login = async (role: string) => {
    const r = await page.request.post("/api/auth/login", {
      headers: { Origin: baseURL },
      data: {
        identifier: fixture.accounts[role].email,
        password: demoPassword,
        remember: false,
      },
    });
    expect(r.status()).toBe(200);
  };
  await login("parent");
  const first = await page.request.get(
    "/api/search?q=DEMO&kinds=child&limit=1",
  );
  expect(first.status()).toBe(200);
  const result = (await first.json()).data;
  expect(result.total).toBeGreaterThan(1);
  expect(result.items).toHaveLength(1);
  expect(result.next_cursor).toBeTruthy();
  const second = await page.request.get(
    `/api/search?q=DEMO&kinds=child&limit=1&after=${encodeURIComponent(result.next_cursor)}`,
  );
  expect(second.status()).toBe(200);
  const next = (await second.json()).data;
  expect(next.total).toBe(result.total);
  expect(next.items[0].id).not.toBe(result.items[0].id);
  const family = result.items[0].record;
  const hydrate = await page.request.get(
    `/api/search/record?kind=family&id=${family}`,
  );
  expect(hydrate.status()).toBe(200);
  const rows = (await hydrate.json()).data;
  expect(rows.data.families[0].id).toBe(family);
  expect(
    rows.data.children.every(
      (c: { family_id: string }) => c.family_id === family,
    ),
  ).toBe(true);
  expect(rows.data.children.length).toBeLessThanOrEqual(100);
  expect(rows.pagination.children.total).toBeGreaterThan(0);
  const invalid = await page.request.get("/api/search?q=x");
  expect(invalid.status()).toBe(400);
  await page.goto("/parent");
  await expect(page.getByLabel("Child context")).toBeVisible();
  await expect(page.locator(".portal-skeleton")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Search workspace", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Search workspace", exact: true })
    .click();
  await page.getByLabel("Search records").fill("DEMO");
  await expect(
    page.getByRole("dialog").getByText(/Matching records:/),
  ).toBeVisible();
  await expect(
    page.locator(".portal-search-results button").first(),
  ).toBeVisible();
  for (const role of ["sales", "coach"]) {
    await login(role);
    const search = await page.request.get(
      "/api/search?q=DEMO&kinds=family,child",
    );
    expect(search.status()).toBe(200);
    expect((await search.json()).data).toEqual({
      items: [],
      total: 0,
      next_cursor: null,
    });
    const forbidden = await page.request.get(
      `/api/search/record?kind=family&id=${family}`,
    );
    expect(forbidden.status()).toBe(404);
  }
  await login("coach");
  const sessions = await page.request.get("/api/search?q=DEMO&kinds=session");
  expect(sessions.status()).toBe(200);
  const sessionPage = (await sessions.json()).data;
  expect(sessionPage.total).toBeGreaterThan(0);
  const detail = await page.request.get(
    `/api/search/record?kind=session&id=${sessionPage.items[0].record}`,
  );
  expect(detail.status()).toBe(200);
  const targetProjection = (await detail.json()).data.data;
  expect(targetProjection.coach_sessions[0].id).toBe(
    sessionPage.items[0].record,
  );
  expect(targetProjection.development_sessions).toEqual(
    targetProjection.coach_sessions,
  );
});

test("search navigation survives a delayed initial load, deep reload, transient detail failure and history", async ({
  page,
  baseURL,
}) => {
  if (!baseURL || !/^http:\/\/(localhost|127\.0\.0\.1):310[012]$/.test(baseURL))
    throw Error("Known local app required");
  const signedIn = await page.request.post("/api/auth/login", {
    headers: { Origin: baseURL },
    data: {
      identifier: fixture.accounts.parent.email,
      password: demoPassword,
      remember: false,
    },
  });
  expect(signedIn.status()).toBe(200);
  let firstWorkspace = true;
  await page.route("**/api/workspace", async (route) => {
    if (firstWorkspace) {
      firstWorkspace = false;
      await new Promise((resolve) => setTimeout(resolve, 1800));
    }
    await route.continue();
  });
  await page.goto("/parent?view=Overview");
  await expect.poll(() => firstWorkspace).toBe(false);
  await page.getByRole("button", { name: "Family", exact: true }).click();
  await expect(page.locator(".portal-breadcrumb strong")).toHaveText("Family");
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".portal-skeleton")).toHaveCount(0);
  const query = await page.request.get(
    "/api/search?q=DEMO&kinds=child&limit=1",
  );
  expect(query.status()).toBe(200);
  const selected = (await query.json()).data.items[0];
  expect(selected).toBeTruthy();
  await page
    .getByRole("button", { name: "Search workspace", exact: true })
    .click();
  await page.getByLabel("Search records").fill("DEMO");
  await expect(
    page.locator(".portal-search-results button").first(),
  ).toBeVisible();
  await page
    .locator(".portal-search-results button")
    .filter({ hasText: selected.title })
    .first()
    .click();
  await expect(page).toHaveURL(
    new RegExp(`record=${selected.record}.*recordKind=child`),
  );
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.locator(".portal-breadcrumb strong")).toHaveText("Family");
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".portal-skeleton")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("record")).toBe(selected.record);
  let detailCalls = 0;
  await page.route("**/api/search/record?*", async (route) => {
    detailCalls++;
    if (detailCalls === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          code: "unavailable",
          message: "Temporary selected-record test outage.",
        }),
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Temporary selected-record test outage.",
  );
  expect(new URL(page.url()).searchParams.get("record")).toBe(selected.record);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(detailCalls).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".portal-breadcrumb strong")).toHaveText(
    "Overview",
  );
  expect(new URL(page.url()).searchParams.get("record")).toBe(null);
  await page.goBack();
  await expect(page.locator(".portal-breadcrumb strong")).toHaveText("Family");
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  expect(new URL(page.url()).searchParams.get("record")).toBe(selected.record);
});

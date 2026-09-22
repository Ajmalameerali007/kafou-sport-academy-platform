import {
  test,
  expect,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { demoPassword } from "./private-config";

// Provision with the guarded seed and the real-role walkthrough first. These
// checks never reset fixtures, change attendance, or alter an existing booking.
const batch = process.env.KAFOU_PRODUCT_BATCH || "connected-auth-v2-2026-09-20";
if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(batch))
  throw Error("Invalid product batch");
const fixture = JSON.parse(
  readFileSync(resolve("outputs/product", `local-${batch}.json`), "utf8"),
);
if (fixture.url !== "http://127.0.0.1:56321" || fixture.status !== "ready")
  throw Error("Ready local product fixtures required");
const prefix = `DEMO PRODUCT · ${batch}`;
const screenshots = resolve("outputs/product/screens-regression");
mkdirSync(screenshots, { recursive: true });
const sessionCookies: Record<
  string,
  Awaited<ReturnType<BrowserContext["cookies"]>>
> = {};

// Authentication requests contain private credentials. Do not retain network
// traces or recordings; screenshots are taken only after authentication.
test.use({ trace: "off", video: "off" });
test.setTimeout(120_000);

async function login(page: Page, role: string, origin: string) {
  if (!["http://127.0.0.1:3101", "http://localhost:3100"].includes(origin))
    throw Error(
      "Product browser checks accept only the known local app origins",
    );
  if (sessionCookies[role]?.length) {
    await page.context().addCookies(sessionCookies[role]);
    const session = await page.request.get("/api/auth/session");
    if (session.status() === 200) return;
    delete sessionCookies[role];
  }
  const result = await page.request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: {
      identifier: fixture.accounts[role].email,
      password: demoPassword,
      remember: false,
    },
  });
  expect(result.status(), "Authenticate existing synthetic actor").toBe(200);
  sessionCookies[role] = await page.context().cookies();
}

async function visit(page: Page, role: string, view: string) {
  await page.goto(`/${role}?view=${encodeURIComponent(view)}`);
  await expect(
    page.getByRole("button", { name: "Switch to Arabic" }),
  ).toBeEnabled();
  await expect(page.locator(".portal-breadcrumb strong")).toHaveText(view);
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("This page couldn’t load", { exact: true }),
  ).toHaveCount(0);
  // Data readiness is distinct from SSR shell hydration.
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator(".portal-skeleton")).toHaveCount(0);
  if (role === "parent")
    await expect(page.getByLabel("Child context")).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const path = resolve(screenshots, `${name}.png`);
  await page.screenshot({ path, fullPage: false, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function fitsViewport(page: Page) {
  expect
    .soft(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "All content should fit the viewport without horizontal page scrolling",
    )
    .toBe(true);
  expect
    .soft(
      await page
        .locator("main")
        .evaluate(
          (main) =>
            main.getBoundingClientRect().width >=
            innerWidth * (innerWidth >= 768 ? 0.6 : 0.85),
        ),
      "Workspace content must use its available width, not collapse into a sidebar-sized column",
    )
    .toBe(true);
}

const views: Record<string, string[]> = {
  parent: ["Overview", "Progress", "Schedule", "Makeups", "Finance"],
  coach: ["Assigned sessions", "Coaching", "Business Reports"],
  branch: ["Overview", "Attendance", "Business Reports"],
  admin: ["Overview", "Finance", "Business Reports"],
  sales: ["Overview", "Enquiries", "Business Reports"],
};
for (const [role, sections] of Object.entries(views)) {
  test(`${role}: real records render on desktop and mobile without runtime errors`, async ({
    page,
    baseURL,
  }, testInfo) => {
    await login(page, role, baseURL!);
    const releaseResponse = await page.request.get("/api/release");
    expect(releaseResponse.status()).toBe(200);
    const release = (await releaseResponse.json()).data;
    const localSource = JSON.parse(
      readFileSync("lib/platform/build-provenance.json", "utf8"),
    );
    expect(
      release.sourceSha256,
      "Browser checks must target the current compiled source",
    ).toBe(localSource.sourceSha256);
    writeFileSync(
      resolve("outputs/product", "browser-verified-release.json"),
      JSON.stringify(release, null, 2),
    );
    const runtimeErrors: string[] = [],
      failedAssets: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /(?:TypeError|ReferenceError|React component|Minified React)/.test(
          message.text(),
        )
      )
        runtimeErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        /\/_next\/|\/api\/(?:product|workspace)(?:\?|$)/.test(response.url())
      )
        failedAssets.push(
          `${response.status()} ${new URL(response.url()).pathname}`,
        );
    });
    for (const view of sections) {
      await test.step(view, async () => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await visit(page, role, view);
        if (
          role === "parent" &&
          ["Progress", "Schedule", "Makeups"].includes(view)
        ) {
          await page
            .getByLabel("Child context")
            .selectOption(fixture.ids.child);
          await expect(page).toHaveURL(
            new RegExp(`child=${fixture.ids.child}`),
          );
          await expect(
            page.getByRole("heading", { name: "This page couldn’t load" }),
          ).toHaveCount(0);
          await expect(page.locator("main h2").first()).toBeVisible();
        }
        if (role === "parent" && view === "Progress") {
          const guidance = page
            .getByRole("heading", {
              name: "Training and safety instructions",
              exact: true,
            })
            .locator("..");
          await expect(guidance.locator("details")).toHaveCount(1);
          await expect(guidance.locator("summary")).toContainText(
            `${prefix} · Child`,
          );
          await expect(
            page.locator("p").filter({
              hasText:
                /^Synthetic assessment: maintained an independent float for 12 seconds\.$/,
            }),
          ).toBeVisible();
          await expect(
            page.getByText(
              "Synthetic confidential coach note for independent staff review.",
              { exact: true },
            ),
          ).toHaveCount(0);
        }
        if (role === "coach")
          await expect(
            page.getByRole("button", {
              name: "Finalize Attendance",
              exact: true,
            }),
          ).toHaveCount(0);
        if (view === "Overview" && role === "admin") {
          await page
            .getByRole("button", { name: /^Follow-ups due/ })
            .first()
            .click();
          await expect(
            page.getByRole("region", { name: "Follow-ups due", exact: true }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: /^Attendance unresolved/ })
            .first()
            .click();
          await expect(page.locator(".admin-action-centre")).toBeVisible();
          await expect(page.locator(".desk-home")).toHaveCount(0);
        }
        if (view === "Overview" && role === "branch") {
          await page
            .getByRole("button", { name: "Find a family", exact: true })
            .click();
          await expect(
            page.getByRole("dialog", { name: "Search workspace" }),
          ).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.locator(".desk-home")).toBeVisible();
          await expect(page.locator(".admin-action-centre")).toHaveCount(0);
        }
        const slug = `${role}-${view.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
        await capture(page, testInfo, `${slug}-desktop`);
        await fitsViewport(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await capture(page, testInfo, `${slug}-mobile`);
        await fitsViewport(page);
        if (role === "parent" && view === "Progress") {
          const assessment = page.locator("p").filter({
            hasText:
              /^Synthetic assessment: maintained an independent float for 12 seconds\.$/,
          });
          for (const size of [
            { name: "desktop", width: 1440, height: 1000 },
            { name: "mobile", width: 390, height: 844 },
          ]) {
            await page.setViewportSize({
              width: size.width,
              height: size.height,
            });
            await assessment.scrollIntoViewIfNeeded();
            await capture(page, testInfo, `parent-child-journey-${size.name}`);
            await fitsViewport(page);
          }
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        if (
          (role === "coach" && view === "Coaching") ||
          (role === "branch" && view === "Attendance")
        ) {
          const item =
            role === "coach"
              ? page
                  .getByRole("heading", {
                    name: "Your assigned sessions",
                    exact: true,
                  })
                  .locator("..")
                  .locator("details")
                  .filter({ has: page.locator("summary", { hasText: prefix }) })
                  .first()
              : page
                  .locator(".product-session")
                  .filter({ hasText: prefix })
                  .filter({
                    has: page.getByRole("heading", {
                      name: "Attendance roster",
                      exact: true,
                      includeHidden: true,
                    }),
                  })
                  .first();
          await item.locator("summary").first().click();
          const heading = item
            .getByRole("heading", {
              name: role === "coach" ? "Assess athlete" : "Attendance roster",
              exact: true,
            })
            .first();
          await expect(heading).toBeVisible();
          for (const size of [
            { name: "desktop", width: 1440, height: 1000 },
            { name: "mobile", width: 390, height: 844 },
          ]) {
            await page.setViewportSize({
              width: size.width,
              height: size.height,
            });
            await heading.scrollIntoViewIfNeeded();
            await capture(
              page,
              testInfo,
              `${role}-${role === "coach" ? "assessment" : "attendance-editor"}-${size.name}`,
            );
            await fitsViewport(page);
          }
          // Read-only visual inspection. No form values or records are changed.
          await item.locator("summary").first().click();
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        if (view === "Overview" && ["branch", "admin"].includes(role))
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
        if (view === "Business Reports") {
          if (role === "sales") {
            await expect(
              page.getByRole("heading", { name: "Sales", exact: true }),
            ).toBeVisible();
            await expect(
              page.getByRole("heading", { name: "Finance", exact: true }),
            ).toHaveCount(0);
            await expect(
              page.getByRole("heading", { name: "Operations", exact: true }),
            ).toHaveCount(0);
          } else {
            await expect(
              page.getByRole("heading", {
                name: "Sport performance",
                exact: true,
              }),
            ).toBeVisible();
            await expect(
              page.getByRole("heading", {
                name: "Daily attendance trend",
                exact: true,
              }),
            ).toBeVisible();
          }
          await page.getByRole("button", { name: "Switch to Arabic" }).click();
          await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
          await expect(
            page.locator(".admin-reports > .portal-panel-head h2"),
          ).toHaveText("تقارير الأعمال");
          await capture(page, testInfo, `${role}-reports-arabic-mobile`);
          await fitsViewport(page);
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
          await page.getByRole("button", { name: "Switch to English" }).click();
        }
        expect(runtimeErrors).toEqual([]);
        expect(failedAssets).toEqual([]);
      });
    }
    if (["parent", "coach", "branch", "admin"].includes(role)) {
      if (role === "coach") await visit(page, role, "Coaching");
      if (["branch", "admin"].includes(role))
        await visit(page, role, "Overview");
      await page.getByRole("button", { name: "Switch to Arabic" }).click();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(
        page.getByRole("heading", {
          name:
            role === "parent"
              ? "الفواتير والإيصالات"
              : role === "coach"
                ? "التدريب والتقييمات"
                : role === "branch"
                  ? "الاستقبال اليوم"
                  : "اليوم في كافو",
          exact: true,
        }),
      ).toBeVisible();
      await capture(page, testInfo, `${role}-arabic-mobile`);
      await fitsViewport(page);
      expect(runtimeErrors).toEqual([]);
    }
  });
}

test("parent child context survives reload and filters projected participation", async ({
  page,
  baseURL,
}) => {
  await login(page, "parent", baseURL!);
  await visit(page, "parent", "Schedule");
  await page.getByLabel("Child context").selectOption(fixture.ids.child);
  await expect(
    page.getByRole("heading", { name: "Your schedule", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Child context")).toHaveValue(fixture.ids.child);
  await page.reload();
  await expect(page.getByLabel("Child context")).toHaveValue(fixture.ids.child);
  await expect(page.locator(".product-session").first()).toBeVisible();
  for (const item of await page.locator(".product-session").all()) {
    await item.locator("summary").first().click();
    await expect(item.locator(".product-session-body")).toContainText(
      `${prefix} · Child`,
    );
    await expect(item.locator(".product-session-body")).not.toContainText(
      `${prefix} · Trial child`,
    );
  }
  await expect(
    page.getByRole("button", { name: "Finalize Attendance", exact: true }),
  ).toHaveCount(0);
});

test("read outage preserves loaded records, reports failure, and recovers on refresh", async ({
  page,
  baseURL,
}) => {
  await login(page, "parent", baseURL!);
  await visit(page, "parent", "Finance");
  await expect(
    page.getByRole("heading", { name: "Invoices and receipts", exact: true }),
  ).toBeVisible();
  // Only this error branch is injected. Successful records and retry use the real API.
  await page.route(
    "**/api/product",
    async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          code: "unavailable",
          message: "Synthetic read outage. Please retry.",
        }),
      });
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Synthetic read outage. Please retry.",
  );
  await expect(
    page.getByRole("heading", { name: "Invoices and receipts", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByText("Synthetic read outage. Please retry.", { exact: false }),
  ).toHaveCount(0);
});

test("HeadOffice schedule preview lists real impact and invalidates changed inputs", async ({
  page,
  baseURL,
}) => {
  await login(page, "admin", baseURL!);
  await visit(page, "admin", "Schedule");
  const session = page
    .locator(".product-session")
    .filter({ hasText: prefix })
    .last();
  await session.locator("summary").first().click();
  const change = session
    .locator("details")
    .filter({
      has: page.locator("summary", { hasText: "Review a schedule change" }),
    })
    .first();
  await change.locator("summary").first().click();
  await change
    .getByLabel("Reason", { exact: true })
    .fill("Synthetic preview only; no timetable mutation.");
  await expect(
    change.getByRole("button", { name: "Confirm time change", exact: true }),
  ).toHaveCount(0);
  await change
    .getByRole("button", { name: "Review affected sessions", exact: true })
    .click();
  await expect(change.getByRole("heading", { level: 4 })).toContainText(
    "1 sessions affected",
  );
  await expect(change.getByRole("heading", { level: 4 })).toContainText(
    "bookings affected",
  );
  await expect(
    change.getByRole("button", { name: "Confirm time change", exact: true }),
  ).toBeVisible();
  await change
    .getByRole("combobox", { name: "Apply to", exact: true })
    .selectOption("future");
  await expect(
    change.getByRole("button", { name: "Confirm time change", exact: true }),
  ).toHaveCount(0);
});

test("invoice and receipt PDFs follow family finance access and certificate downloads follow teaching scope", async ({
  browser,
  baseURL,
}) => {
  let receiptId = "",
    invoiceId = "";
  const parent = await browser.newContext({ baseURL });
  try {
    const page = await parent.newPage();
    await login(page, "parent", baseURL!);
    await visit(page, "parent", "Finance");
    const product = await (await page.request.get("/api/product")).json();
    const invoice = product.data.commercial_invoices[0];
    expect(invoice).toBeTruthy();
    invoiceId = invoice.id;
    const invoiceDownloadPromise = page.waitForEvent("download");
    await page
      .locator(`a[href="/api/product/invoices/${invoiceId}?locale=en"]`)
      .click();
    const invoiceDownload = await invoiceDownloadPromise;
    expect(invoiceDownload.suggestedFilename()).toBe(
      `KAFOU-Invoice-${invoice.reference}.pdf`,
    );
    mkdirSync(resolve("outputs/launch-rehearsal/2026-09-21-completion/pdf"), {
      recursive: true,
    });
    const invoiceEnglish = resolve(
      "outputs/launch-rehearsal/2026-09-21-completion/pdf/invoice-demo-en.pdf",
    );
    await invoiceDownload.saveAs(invoiceEnglish);
    expect(readFileSync(invoiceEnglish).subarray(0, 5).toString()).toBe(
      "%PDF-",
    );
    await page.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(
      page.getByRole("button", { name: "Switch to English" }),
    ).toBeVisible();
    const invoiceArabic = await page.request.get(
      `/api/product/invoices/${invoiceId}?locale=ar`,
    );
    expect(invoiceArabic.status()).toBe(200);
    expect(invoiceArabic.headers()["content-type"]).toBe("application/pdf");
    const invoiceArabicPath = resolve(
      "outputs/launch-rehearsal/2026-09-21-completion/pdf/invoice-demo-ar.pdf",
    );
    writeFileSync(invoiceArabicPath, await invoiceArabic.body());
    expect(readFileSync(invoiceArabicPath).subarray(0, 5).toString()).toBe(
      "%PDF-",
    );
    await page
      .context()
      .addCookies([{ name: "kafou-locale", value: "en", url: baseURL! }]);
    await login(page, "parent", baseURL!);
    await visit(page, "parent", "Finance");
    const receipt = product.data.commercial_receipts[0];
    expect(receipt).toBeTruthy();
    receiptId = receipt.id;
    const downloadPromise = page.waitForEvent("download");
    await page
      .locator(`a[href="/api/product/receipts/${receiptId}?locale=en"]`)
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`KAFOU-${receipt.reference}.pdf`);
    const path = resolve("outputs/product/receipt-current-en.pdf");
    await download.saveAs(path);
    expect(readFileSync(path).subarray(0, 5).toString()).toBe("%PDF-");
    const arabic = await page.request.get(
      `/api/product/receipts/${receiptId}?locale=ar`,
    );
    expect(arabic.status()).toBe(200);
    expect(arabic.headers()["content-type"]).toBe("application/pdf");
    expect(arabic.headers()["cache-control"]).toBe("private, no-store");
    expect((await arabic.body()).subarray(0, 5).toString()).toBe("%PDF-");
    writeFileSync(
      resolve("outputs/product/receipt-current-ar.pdf"),
      await arabic.body(),
    );
    const absent = await page.request.get(
      "/api/product/receipts/10000000-0000-4000-8000-000000000999",
    );
    expect(absent.status()).toBe(404);
  } finally {
    await parent.close();
  }
  for (const role of ["sales", "coach"]) {
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      await login(page, role, baseURL!);
      const data = await (await page.request.get("/api/product")).json();
      expect(data.ok).toBe(true);
      expect(data.data.commercial_invoices || []).toEqual([]);
      expect(data.data.commercial_payments || []).toEqual([]);
      const denied = await page.request.post("/api/product", {
        headers: { Origin: baseURL! },
        data: {
          action: "commercial.payment.record",
          key: crypto.randomUUID(),
          data: {
            family_id: fixture.familyId,
            branch_id: fixture.branchId,
            amount_minor: 1,
            method: "cash",
            reference: "SYNTHETIC DENIED REGRESSION",
          },
        },
      });
      expect(denied.status()).toBe(403);
      const receipt = await page.request.get(
        `/api/product/receipts/${receiptId}`,
      );
      expect([403, 404]).toContain(receipt.status());
      const invoice = await page.request.get(
        `/api/product/invoices/${invoiceId}`,
      );
      expect([403, 404]).toContain(invoice.status());
      const certificateId =
        role === "coach"
          ? data.data.development_certificates?.[0]?.id
          : fixture.workflow.certificate;
      if (role === "coach") expect(certificateId).toBeTruthy();
      const download = await page.request.get(
        `/api/product/certificates/${certificateId}`,
      );
      if (role === "sales") expect([403, 404]).toContain(download.status());
      else {
        expect(download.status()).toBe(200);
        expect((await download.body()).subarray(0, 5).toString()).toBe("%PDF-");
      }
    } finally {
      await context.close();
    }
  }
});

test("an unavailable initial workspace is not rendered as zero successful records", async ({
  page,
  baseURL,
}) => {
  await login(page, "admin", baseURL!);
  let unavailable = true;
  await page.route("**/api/product", (route) =>
    unavailable
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            code: "unavailable",
            message:
              "The service could not complete this request. Please try again.",
          }),
        })
      : route.continue(),
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "This page couldn’t load" }),
  ).toBeVisible();
  await expect(page.locator(".admin-action-centre")).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".admin-action-centre")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This page couldn’t load" }),
  ).toHaveCount(0);
});

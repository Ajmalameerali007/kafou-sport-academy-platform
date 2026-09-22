import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PDFDocument,
  PDFArray,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import { demoPassword } from "./private-config";
const batch = process.env.KAFOU_PRODUCT_BATCH || "connected-auth-v2-2026-09-20";
if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(batch))
  throw Error("Invalid synthetic report batch");
const fixture = JSON.parse(
  readFileSync(resolve("outputs/product", `local-${batch}.json`), "utf8"),
);
const report = JSON.parse(
  readFileSync(
    resolve("outputs/product", `local-${batch}-report-export.json`),
    "utf8",
  ),
);
if (fixture.url !== "http://127.0.0.1:56321" || report.status !== "ready")
  throw Error("Ready local report fixture required");
test.use({ trace: "off", video: "off" });
test.setTimeout(60000);
async function login(
  page: import("@playwright/test").Page,
  role: string,
  origin: string,
) {
  if (!['http://127.0.0.1:3101', 'http://localhost:3100'].includes(origin))
    throw Error("Report export browser tests require the local source or compiled app");
  const response = await page.request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: {
      identifier: fixture.accounts[role].email,
      password: demoPassword,
      remember: false,
    },
  });
  expect(response.status()).toBe(200);
}
function content(doc: PDFDocument) {
  return doc
    .getPages()
    .flatMap((page) => {
      const c = page.node.Contents();
      return (
        c instanceof PDFArray
          ? c.asArray().map((ref) => doc.context.lookup(ref) as PDFRawStream)
          : [c as PDFRawStream]
      ).map((stream) =>
        Buffer.from(decodePDFRawStream(stream).decode()).toString(),
      );
    })
    .join("\n");
}
test("parent downloads the exact published report in English and Arabic while the later draft remains private", async ({
  page,
  baseURL,
}) => {
  await login(page, "parent", baseURL!);
  await page.goto("/parent?view=Reports");
  const link = page.locator(
    `a[href="/api/product/reports/${report.published}?locale=en"]`,
  );
  await expect(link).toBeVisible();
  await expect(
    page.locator(`a[href*="/api/product/reports/${report.draft}"]`),
  ).toHaveCount(0);
  const pending = page.waitForEvent("download");
  await link.click();
  const download = await pending;
  expect(download.suggestedFilename()).toContain(
    `-v${report.publishedVersion}-`,
  );
  const path = resolve("outputs/product/report-current-en.pdf");
  await download.saveAs(path);
  const doc = await PDFDocument.load(readFileSync(path));
  expect(doc.getSubject()).toBe(
    `Published report ${report.published}; exact version ${report.publishedVersion}`,
  );
  expect(content(doc)).not.toContain(
    Buffer.from(
      "Synthetic confidential coach note for independent staff review.",
    )
      .toString("hex")
      .toUpperCase(),
  );
  const arabic = await page.request.get(
    `/api/product/reports/${report.published}?locale=ar`,
  );
  expect(arabic.status()).toBe(200);
  expect(arabic.headers()["content-type"]).toBe("application/pdf");
  expect(arabic.headers()["cache-control"]).toBe("private, no-store");
  const bytes = await arabic.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  writeFileSync(resolve("outputs/product/report-current-ar.pdf"), bytes);
  expect((await PDFDocument.load(bytes)).getTitle()).toContain(
    "تقرير كفو الشهري",
  );
  expect(
    (await page.request.get(`/api/product/reports/${report.draft}`)).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get(
        "/api/product/reports/10000000-0000-4000-8000-000000000999",
      )
    ).status(),
  ).toBe(404);
});
test("current assigned coach and authorized reviewer can export; Sales, Branch and anonymous cannot", async ({
  browser,
  baseURL,
}) => {
  for (const role of ["coach", "admin", "sales", "branch"]) {
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      await login(page, role, baseURL!);
      const response = await page.request.get(
        `/api/product/reports/${report.published}`,
      );
      if (["coach", "admin"].includes(role)) {
        expect(response.status()).toBe(200);
        expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
        expect(
          (
            await page.request.get(`/api/product/reports/${report.draft}`)
          ).status(),
        ).toBe(404);
      } else expect([403, 404]).toContain(response.status());
    } finally {
      await context.close();
    }
  }
  const anon = await browser.newContext({ baseURL });
  try {
    expect(
      (
        await anon.request.get(`/api/product/reports/${report.published}`)
      ).status(),
    ).toBe(401);
  } finally {
    await anon.close();
  }
});

import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { demoPassword } from "./private-config";

type Row = Record<string, unknown>;
type Data = Record<string, Row[]>;
const batch = process.env.KAFOU_PRODUCT_BATCH || "connected-auth-v2-2026-09-20";
if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(batch))
  throw Error("Invalid local batch");
const fixture = JSON.parse(
  readFileSync(`outputs/product/local-${batch}.json`, "utf8"),
);
if (fixture.url !== "http://127.0.0.1:56321" || fixture.status !== "ready")
  throw Error("Ready local synthetic fixture required");
test.use({ trace: "off", video: "off", actionTimeout: 15000 });
test.setTimeout(180000);

async function data(page: Page, endpoint = "product") {
  const merged: Data = {};
  for (let offset = 0; offset <= 100000; offset += 200) {
    const response = await page.request.get(
      `/api/${endpoint}?offset=${offset}`,
    );
    expect(response.status(), `Read ${endpoint}`).toBe(200);
    const result = (await response.json()).data as Data;
    for (const [key, value] of Object.entries(result))
      if (key !== "pagination" && Array.isArray(value))
        merged[key] = [...(merged[key] || []), ...value];
    if (!result.pagination?.[0]?.more) return merged;
  }
  throw Error("Synthetic workspace exceeded bounded pagination");
}
async function command(
  page: Page,
  origin: string,
  action: string,
  payload: Row,
  endpoint = "product",
) {
  const response = await page.request.post(`/api/${endpoint}`, {
    headers: { Origin: origin },
    data: { action, data: payload, key: crypto.randomUUID() },
  });
  expect(response.status(), action).toBe(200);
  const result = await response.json();
  expect(result.ok, action).toBe(true);
  return result.data as Row;
}
async function submit(
  page: Page,
  button: Locator,
  action: string,
  status = 200,
) {
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/product") &&
      r.request().method() === "POST" &&
      r.request().postDataJSON()?.action === action,
  );
  await button.click();
  const result = await response;
  expect(result.status(), action).toBe(status);
  return result.json();
}
async function visit(page: Page, role: string) {
  await page.goto(`/${role}?view=Finance`);
  await expect(page.locator(".portal-skeleton")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("This page couldn’t load", { exact: true }),
  ).toHaveCount(0);
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

test("compiled invoice authoring and reviewed cancellation preserve exact money and role boundaries", async ({
  browser,
  baseURL,
}) => {
  if (baseURL !== "http://127.0.0.1:3101")
    throw Error("Compiled local Worker only");
  const [headContext, parentContext] = await Promise.all([
    browser.newContext({ baseURL }),
    browser.newContext({ baseURL }),
  ]);
  const head = await headContext.newPage(),
    parent = await parentContext.newPage();
  const errors: string[] = [];
  for (const page of [head, parent])
    page.on("pageerror", (e) => errors.push(e.message));
  const run = `commercial-ui-${Date.now()}`;
  const evidence: Row = {
    status: "running",
    phase: "compiled",
    batch,
    run,
    actors: ["explicitly_granted_head_office", "current_family_parent"],
  };
  mkdirSync("outputs/product/screens-commercial", { recursive: true });
  try {
    for (const [role, page] of [
      ["admin", head],
      ["parent", parent],
    ] as const) {
      const result = await page.request.post("/api/auth/login", {
        headers: { Origin: baseURL },
        data: {
          identifier: fixture.accounts[role].email,
          password: demoPassword,
          remember: false,
        },
      });
      expect(result.status(), `Authenticate ${role}`).toBe(200);
    }
    // Additive synthetic setup uses the real authorized actors and commands only.
    const child = await command(
      parent,
      baseURL,
      "child.save",
      {
        family_id: fixture.familyId,
        name: `Synthetic cancellation ${run}`,
        reported_age: 8,
      },
      "commands",
    );
    await command(
      parent,
      baseURL,
      "child.sport",
      { child_id: child.id, sport: "swimming" },
      "commands",
    );
    const pkg = await command(head, baseURL, "commercial.package.create", {
      branch_id: fixture.branchId,
      sport: "swimming",
      name: `Synthetic commercial ${run}`,
      name_ar: "باقة اختبار مالية تجريبية",
      price_minor: 25010,
      session_allowance: 8,
      terms:
        "Explicit synthetic test price and cancellation policy; no live settlement.",
      terms_ar: "سعر وسياسة إلغاء تجريبيان للاختبار فقط دون تسوية مالية فعلية.",
    });
    const before = await data(head);
    await visit(head, "admin");
    const commercialNav = head.getByRole("navigation", {
      name: "Commercial sections",
    });
    await commercialNav
      .getByRole("button", { name: "Invoices and receipts", exact: true })
      .click();
    await head.getByText("Create standalone invoice", { exact: true }).click();
    const form = head.getByRole("form", { name: "Create standalone invoice" });
    await form
      .getByLabel("Branch", { exact: true })
      .selectOption(fixture.branchId);
    await form
      .getByLabel("Family", { exact: true })
      .selectOption(fixture.familyId);
    await form.getByLabel("Invoice request reference").fill(run);
    const first = form.getByRole("group", {
      name: "Invoice line 1",
      exact: true,
    });
    await first
      .getByLabel("Child", { exact: true })
      .selectOption(fixture.ids.child);
    await first
      .getByLabel("Package", { exact: true })
      .selectOption(String(pkg.id));
    await first.getByLabel("Quantity", { exact: true }).fill("2");
    await form
      .getByRole("button", { name: "Add invoice line", exact: true })
      .click();
    const second = form.getByRole("group", {
      name: "Invoice line 2",
      exact: true,
    });
    await second
      .getByLabel("Child", { exact: true })
      .selectOption(String(child.id));
    await second
      .getByLabel("Package", { exact: true })
      .selectOption(String(pkg.id));
    await expect(form).toContainText("750.30");
    await form.getByRole("checkbox").check();
    await form.scrollIntoViewIfNeeded();
    await fits(head);
    await head.screenshot({
      path: "outputs/product/screens-commercial/invoice-author-desktop.png",
      animations: "disabled",
    });
    await head.setViewportSize({ width: 390, height: 844 });
    await head.getByRole("button", { name: "Switch to Arabic" }).click();
    const arabicInvoice = head.getByRole("form", {
      name: "إنشاء فاتورة مستقلة",
    });
    await expect(arabicInvoice).toBeVisible();
    await fits(head);
    await arabicInvoice.screenshot({
      path: "outputs/product/screens-commercial/invoice-author-mobile-ar.png",
      animations: "disabled",
    });
    await head.getByRole("button", { name: "Switch to English" }).click();
    await head.setViewportSize({ width: 1440, height: 1000 });
    const posted = await submit(
      head,
      form.getByRole("button", { name: "Post invoice", exact: true }),
      "commercial.invoice.create",
    );
    evidence.invoice_id = posted.data.id;
    const authored = await data(head);
    const invoice = authored.commercial_invoices.find(
      (r) => r.id === posted.data.id,
    )!;
    expect(invoice.membership_id).toBeNull();
    const lines = authored.commercial_invoice_lines.filter(
      (r) => r.invoice_id === posted.data.id,
    );
    expect(lines).toHaveLength(2);
    expect(lines.map((r) => r.child_id).sort()).toEqual(
      [fixture.ids.child, child.id].sort(),
    );
    expect(
      lines.reduce(
        (sum, r) => sum + Number(r.quantity) * Number(r.unit_minor),
        0,
      ),
    ).toBe(75030);
    expect(authored.commercial_memberships.length).toBe(
      before.commercial_memberships.length,
    );
    expect(authored.entitlement_ledger.length).toBe(
      before.entitlement_ledger.length,
    );
    const duplicate = await head.request.post("/api/product", {
      headers: { Origin: baseURL },
      data: {
        action: "commercial.invoice.create",
        key: crypto.randomUUID(),
        data: {
          family_id: fixture.familyId,
          branch_id: fixture.branchId,
          reference: run,
          lines: [
            { child_id: fixture.ids.child, package_id: pkg.id, quantity: 2 },
            { child_id: child.id, package_id: pkg.id, quantity: 1 },
          ],
        },
      },
    });
    expect(duplicate.status()).toBe(409);
    const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
    const member = await command(
      parent,
      baseURL,
      "commercial.membership.start",
      {
        child_id: child.id,
        package_id: pkg.id,
        starts_on: today,
        accepted: true,
      },
    );
    evidence.membership_id = member.id;
    const memberInvoice = (await data(head)).commercial_invoices.find(
      (r) => r.membership_id === member.id,
    )!;
    const payment = await command(head, baseURL, "commercial.payment.record", {
      family_id: fixture.familyId,
      branch_id: fixture.branchId,
      amount_minor: 25010,
      method: "cash",
      reference: `${run}-offline`,
      invoice_id: memberInvoice.id,
    });
    await visit(head, "admin");
    await head
      .getByRole("navigation", { name: "Commercial sections" })
      .getByRole("button", { name: "Memberships", exact: true })
      .click();
    await head.getByText("Cancel a membership", { exact: true }).click();
    const cancellation = head.getByRole("form", {
      name: "Cancel a membership",
    });
    await cancellation
      .getByLabel("Membership", { exact: true })
      .selectOption(String(member.id));
    await cancellation
      .getByLabel("Reason", { exact: true })
      .fill("Reviewed explicit synthetic unused entitlement cancellation");
    await expect(
      cancellation.getByRole("button", {
        name: "Calculate cancellation preview",
      }),
    ).toBeDisabled();
    await cancellation
      .getByLabel("Synthetic cancellation policy")
      .selectOption("unused_entitlements");
    await submit(
      head,
      cancellation.getByRole("button", {
        name: "Calculate cancellation preview",
      }),
      "commercial.membership.cancel.preview",
    );
    const preview = cancellation.getByRole("region", {
      name: "Cancellation preview",
      exact: true,
    });
    await expect(preview).toContainText("250.10");
    const allocation = (await data(head)).commercial_allocations.find(
      (r) => r.payment_id === payment.id,
    )!;
    await command(head, baseURL, "commercial.payment.unallocate", {
      allocation_id: allocation.id,
      amount_minor: 1,
      reason: "Synthetic concurrent ledger correction after preview",
    });
    await preview.getByRole("checkbox").check();
    await submit(
      head,
      preview.getByRole("button", { name: "Confirm membership cancellation" }),
      "commercial.membership.cancel",
      409,
    );
    await expect(cancellation.getByRole("status")).toHaveText(
      "Membership changed; calculate cancellation again",
    );
    await submit(
      head,
      cancellation.getByRole("button", {
        name: "Calculate cancellation preview",
      }),
      "commercial.membership.cancel.preview",
    );
    await expect(preview).toContainText("250.09");
    await preview.scrollIntoViewIfNeeded();
    await head.screenshot({
      path: "outputs/product/screens-commercial/cancellation-preview-desktop.png",
      animations: "disabled",
    });
    await head.setViewportSize({ width: 390, height: 844 });
    await preview.scrollIntoViewIfNeeded();
    await fits(head);
    await head.screenshot({
      path: "outputs/product/screens-commercial/cancellation-preview-mobile-en.png",
      animations: "disabled",
    });
    await head.getByRole("button", { name: "Switch to Arabic" }).click();
    const arPreview = head.getByRole("region", {
      name: "معاينة الإلغاء",
      exact: true,
    });
    await expect(arPreview).toBeVisible();
    await arPreview.scrollIntoViewIfNeeded();
    await fits(head);
    await head.screenshot({
      path: "outputs/product/screens-commercial/cancellation-preview-mobile-ar.png",
      animations: "disabled",
    });
    await head.getByRole("button", { name: "Switch to English" }).click();
    await preview.getByRole("checkbox").check();
    await submit(
      head,
      preview.getByRole("button", { name: "Confirm membership cancellation" }),
      "commercial.membership.cancel",
    );
    const cancelled = await data(head);
    expect(
      cancelled.commercial_memberships.find((r) => r.id === member.id)?.status,
    ).toBe("cancelled");
    const outcome = cancelled.commercial_membership_cancellations.find(
      (r) => r.membership_id === member.id,
    )!;
    expect(outcome.credit_minor).toBe(25010);
    expect(outcome.released_payment_minor).toBe(25009);
    expect(
      cancelled.commercial_allocations
        .filter((r) => r.payment_id === payment.id)
        .reduce((sum, r) => sum + Number(r.amount_minor), 0),
    ).toBe(0);
    expect(
      cancelled.commercial_refunds.filter((r) => r.payment_id === payment.id),
    ).toHaveLength(0);
    expect(
      cancelled.entitlement_ledger.filter(
        (r) => r.membership_id === member.id && r.kind === "grant",
      ),
    ).toHaveLength(1);
    const denied = await parent.request.post("/api/product", {
      headers: { Origin: baseURL },
      data: {
        action: "commercial.invoice.create",
        key: crypto.randomUUID(),
        data: {
          family_id: fixture.familyId,
          branch_id: fixture.branchId,
          reference: `${run}-parent-denied`,
          lines: [{ child_id: child.id, package_id: pkg.id, quantity: 1 }],
        },
      },
    });
    expect(denied.status()).toBe(403);
    const family = await data(parent);
    expect(family.commercial_invoices.some((r) => r.id === invoice.id)).toBe(
      true,
    );
    expect(
      family.commercial_memberships.find((r) => r.id === member.id)?.status,
    ).toBe("cancelled");
    await visit(parent, "parent");
    await parent
      .getByRole("navigation", { name: "Commercial sections" })
      .getByRole("button", { name: "Invoices and receipts", exact: true })
      .click();
    await expect(
      parent.getByRole("form", { name: "Create standalone invoice" }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
    evidence.status = "passed";
    evidence.invoice_total_minor = 75030;
    evidence.cancellation_credit_minor = 25010;
    evidence.separate_offline_refund_recorded = false;
    evidence.boundaries = [
      "Local synthetic records only",
      "No entitlement from standalone invoice",
      "No provider or money-transfer claim",
      "Parent authoring denied",
      "Stale preview denied",
    ];
  } finally {
    writeFileSync(
      "outputs/product/commercial-authoring-browser.json",
      JSON.stringify(evidence, null, 2) + "\n",
    );
    await headContext.close();
    await parentContext.close();
  }
});

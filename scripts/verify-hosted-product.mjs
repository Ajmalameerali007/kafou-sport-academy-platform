/** Explicit, private synthetic-staging smoke. No live intake or external messages. */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

const origin = "https://kafou-sport-academy.ajazx800.chatgpt.site";
if (!process.argv.includes("--confirm-synthetic-staging"))
  throw Error("Explicit synthetic-staging acknowledgement required");
const token = process.env.KAFOU_TEST_BYPASS,
  password = process.env.KAFOU_DEMO_PASSWORD;
if (!token || !password) throw Error("Private test configuration required");
const file = "outputs/product/staging-connected-release-2026-09-20.json";
const fixture = JSON.parse(readFileSync(file, "utf8"));
assert.equal(fixture.url, "https://cwdazidovxqeevmpicng.supabase.co");
assert.equal(fixture.status, "ready");
const walkthrough = JSON.parse(
  readFileSync(
    "outputs/product/staging-connected-release-2026-09-20-walkthrough.json",
    "utf8",
  ),
);
assert.equal(walkthrough.status, "passed");
const workflow = { ...fixture.workflow, ...walkthrough.ids };
const reports = JSON.parse(
  readFileSync(
    "outputs/product/staging-connected-release-2026-09-20-report-export.json",
    "utf8",
  ),
);
const doc = await PDFDocument.create();
const syntheticPage = doc.addPage([400, 240]);
syntheticPage.drawText("KAFOU synthetic private document acceptance", {
  x: 24,
  y: 185,
  size: 12,
  font: await doc.embedFont(StandardFonts.Helvetica),
});
const documentBytes = Buffer.from(await doc.save());
const documentHash = createHash("sha256").update(documentBytes).digest("hex");
const out = "outputs/product/hosted";
mkdirSync(out, { recursive: true, mode: 0o700 });
const report = {
  startedAt: new Date().toISOString(),
  origin,
  syntheticOnly: true,
  status: "running",
  checks: [],
  screenshots: [],
  runtimeErrors: [],
  recordIds: {},
};
const check = (name, condition) => {
  assert.ok(condition, name);
  report.checks.push({ name, result: "pass" });
};
const browser = await chromium.launch();
let receipt, ticket, privateFile;
try {
  for (const role of [
    "parent",
    "branch",
    "coach",
    "sales",
    "admin",
    "super_admin",
    "parent",
  ]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: { "OAI-Sites-Authorization": `Bearer ${token}` },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      report.runtimeErrors.push({ role, message: error.message }),
    );
    const request = async (path, data) =>
      context.request.fetch(origin + path, {
        method: data ? "POST" : "GET",
        headers: { Origin: origin },
        ...(data ? { data } : {}),
      });
    const login = await request("/api/auth/login", {
      identifier: fixture.accounts[role].email,
      password,
      remember: false,
    });
    check(`${role} actual HTTPS login`, login.status() === 200);
    const cookies = await context.cookies();
    check(
      `${role} secure HttpOnly cookie`,
      cookies.some(
        (c) => c.name.includes("auth-token") && c.secure && c.httpOnly,
      ),
    );
    if (role === "super_admin") {
      const denied = await request("/api/product");
      check("Super Admin remains MFA gated", denied.status() === 403);
      await context.close();
      continue;
    }
    const result = await request("/api/product");
    check(
      `${role} current product API`,
      result.status() === 200 &&
        /no-store/.test(result.headers()["cache-control"] || ""),
    );
    const product = (await result.json()).data;
    const workspace = await request("/api/workspace");
    check(`${role} current workspace API`, workspace.status() === 200);
    const records = (await workspace.json()).data;
    if (role === "parent") {
      check(
        "Parent persisted enrollment",
        records.enrollments.some((x) => x.id === workflow.trial_enrollment),
      );
      check(
        "Parent published progress",
        product.development_assessments.some(
          (x) => x.id === workflow.trial_assessment && x.status === "published",
        ),
      );
      check("Parent receives in-app events", product.notifications.length > 0);
      receipt = product.commercial_receipts.find(
        (x) => x.payment_id === workflow.trial_payment,
      );
      check("Parent persisted offline receipt", Boolean(receipt));
      for (const [kind, id] of [
        ["receipts", receipt.id],
        ["certificates", workflow.certificate],
        ["reports", reports.published],
      ]) {
        const pdf = await request(`/api/product/${kind}/${id}?locale=ar`);
        const bytes = await pdf.body();
        check(
          `Private actual ${kind} PDF`,
          pdf.status() === 200 &&
            bytes.subarray(0, 5).toString() === "%PDF-" &&
            /no-store/.test(pdf.headers()["cache-control"] || ""),
        );
      }
      check(
        "Parent cannot download report draft",
        (await request(`/api/product/reports/${reports.draft}`)).status() ===
          404,
      );
      const search = await request("/api/search?q=DEMO&kinds=child&limit=1");
      check(
        "Parent scoped search",
        search.status() === 200 && (await search.json()).data.total > 0,
      );
      if (!ticket) {
        const uploadPayload = {
          family_id: fixture.familyId,
          child_id: workflow.trial_child,
          branch_id: fixture.branchId,
          name: "Synthetic hosted document.pdf",
          mime_type: "application/pdf",
          content: documentBytes.toString("base64"),
          key: randomUUID(),
        };
        const upload = await request("/api/files/upload", uploadPayload);
        check("Hosted private document stored", upload.status() === 200);
        privateFile = (await upload.json()).data.id;
        const retryUpload = await request("/api/files/upload", uploadPayload);
        check(
          "Private upload retry reuses record",
          retryUpload.status() === 200 &&
            (await retryUpload.json()).data.id === privateFile,
        );
        const file = await request(`/api/files/${privateFile}`);
        check(
          "Parent downloads exact private bytes",
          file.status() === 200 &&
            createHash("sha256")
              .update(await file.body())
              .digest("hex") === documentHash,
        );
        const payload = {
          action: "community.ticket.open",
          key: randomUUID(),
          data: {
            family_id: fixture.familyId,
            branch_id: fixture.branchId,
            child_id: workflow.trial_child,
            subject: "Synthetic hosted acceptance",
            message:
              "Synthetic support request from the parent session; no real contact needed.",
          },
        };
        const response = await request("/api/product", payload);
        check(
          "Parent creates durable support request",
          response.status() === 200,
        );
        ticket = (await response.json()).data.id;
        const retried = await request("/api/product", payload);
        check(
          "Support retry returns original",
          retried.status() === 200 && (await retried.json()).data.id === ticket,
        );
        report.recordIds = {
          ticket,
          receipt: receipt.id,
          enrollment: workflow.trial_enrollment,
          certificate: workflow.certificate,
        };
      } else {
        const withdrawal = await request("/api/product", {
          action: "files.withdraw",
          key: randomUUID(),
          data: { id: privateFile },
        });
        check(
          "Parent withdraws private document access",
          withdrawal.status() === 200,
        );
        check(
          "Withdrawn private bytes inaccessible",
          (await request(`/api/files/${privateFile}`)).status() === 404,
        );
        check(
          "Fresh Parent login sees staff response",
          product.support_messages.some(
            (x) =>
              x.ticket_id === ticket &&
              x.message ===
                "Synthetic reception reply: this request is persisted across workspaces.",
          ),
        );
      }
      const mail = await request("/api/auth/forgot", {
        email: fixture.accounts.parent.email,
      });
      check(
        "Hosted email remains explicitly unavailable",
        mail.status() === 503,
      );
    }
    if (role === "branch") {
      const file = await request(`/api/files/${privateFile}`);
      check(
        "Authorized reception downloads shared private bytes",
        file.status() === 200 &&
          createHash("sha256")
            .update(await file.body())
            .digest("hex") === documentHash,
      );
      check(
        "Front Desk sees parent support request",
        product.support_tickets.some((x) => x.id === ticket),
      );
      check(
        "Branch retains exact branch permission",
        records.account.branchIds.length === 1,
      );
      const response = await request("/api/product", {
        action: "community.ticket.reply",
        key: randomUUID(),
        data: {
          id: ticket,
          message:
            "Synthetic reception reply: this request is persisted across workspaces.",
        },
      });
      check("Front Desk reply persists", response.status() === 200);
    }
    if (role === "coach" || role === "sales") {
      check(
        `${role} finance isolated`,
        product.commercial_invoices.length === 0 &&
          product.commercial_payments.length === 0,
      );
      check(
        `${role} private family file denied`,
        (await request(`/api/files/${privateFile}`)).status() === 404,
      );
      const denied = await request(`/api/product/receipts/${receipt.id}`);
      check(`${role} known receipt denied`, denied.status() === 404);
    }
    if (role === "coach")
      check(
        "Coach assigned sessions only",
        product.development_sessions.length > 0 &&
          product.coach_attendance_sessions.length === 0,
      );
    if (role === "sales")
      check(
        "Sales no family directory",
        records.families.length === 0 && records.children.length === 0,
      );
    if (role === "admin") {
      const denied = await request("/api/product", {
        action: "permission.grant",
        key: randomUUID(),
        data: {
          user_id: fixture.accounts.sales.id,
          permission: "finance.view",
        },
      });
      check("Head Office cannot grant privilege", denied.status() === 403);
    }
    await page.goto(`${origin}/${role}`);
    await page
      .locator(".portal-skeleton")
      .waitFor({ state: "hidden", timeout: 30_000 });
    await page
      .getByRole("button", { name: "Refresh", exact: true })
      .waitFor({ state: "visible", timeout: 30_000 });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.evaluate(() => document.fonts.ready);
      check(
        `${role} layout ${width}`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const path = `${out}/${role}-${width}.png`;
      await page.screenshot({ path, animations: "disabled" });
      report.screenshots.push(path);
    }
    if (role === "parent") {
      await page.getByRole("button", { name: "Switch to Arabic" }).click();
      check(
        "Hosted Arabic direction",
        (await page.locator("html").getAttribute("dir")) === "rtl",
      );
      await page.screenshot({
        path: `${out}/parent-arabic.png`,
        animations: "disabled",
      });
    }
    const logout = await request("/api/auth/logout", {});
    check(`${role} logout`, logout.status() === 200);
    check(
      `${role} protected API after logout`,
      (await request("/api/product")).status() === 401,
    );
    await context.close();
  }
  const context = await browser.newContext({
    extraHTTPHeaders: { "OAI-Sites-Authorization": `Bearer ${token}` },
  });
  const page = await context.newPage();
  for (const path of ["/", "/auth", "/trial?sport=swimming"]) {
    const response = await page.goto(origin + path);
    check(`Hosted public ${path}`, response.status() === 200);
    await page.locator("main").waitFor();
  }
  const assets = await page
    .locator("script[src]")
    .evaluateAll((nodes) =>
      nodes
        .map((n) => n.getAttribute("src"))
        .filter((s) => s?.startsWith("/_next/static/")),
    );
  check("Compiled browser assets present", assets.length > 0);
  for (const asset of assets.slice(0, 3)) {
    const response = await context.request.get(origin + asset);
    const bytes = await response.body();
    check(
      "Hosted asset matches compiled source",
      response.status() === 200 &&
        createHash("sha256").update(bytes).digest("hex") ===
          createHash("sha256")
            .update(readFileSync("dist/client" + asset))
            .digest("hex"),
    );
  }
  check("No hosted runtime errors", report.runtimeErrors.length === 0);
  await context.close();
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  throw error;
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  writeFileSync(`${out}/evidence.json`, JSON.stringify(report, null, 2), {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      evidence: `${out}/evidence.json`,
    }),
  );
}

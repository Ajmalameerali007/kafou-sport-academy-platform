import { test, expect, type Page, type Locator } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
const password = process.env.KAFOU_DEMO_PASSWORD!;
const base = "http://127.0.0.1:3101";
const out = "outputs/branch-operations-2026-09-21";
test.setTimeout(240000);
test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
});
test.use({ trace: "off", video: "off" });
async function login(page: Page, email: string) {
  page.setDefaultTimeout(15000);
  await page.goto(base + "/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth$/);
  await ready(page);
}
async function ready(page: Page) {
  await expect(page.locator(".portal-skeleton")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "This page couldn’t load", exact: true }),
  ).toHaveCount(0);
}
const form = (page: Page, title: string) =>
  page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
async function save(page: Page, f: Locator, action: string) {
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.request().postDataJSON()?.action === action,
  );
  await f
    .getByRole("button", { name: /Save|Register|Record|Accept/ })
    .last()
    .click();
  const r = await response;
  console.log("UI action:", action, r.status());
  const payload = await r.json();
  expect(payload.ok, JSON.stringify(payload)).toBe(true);
  await ready(page);
  return payload.data;
}
async function close(page: Page) {
  await page
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
}

test("central configuration drives isolated branch sales and coach earnings", async ({
  browser,
}) => {
  if (process.env.SUPABASE_URL !== "http://127.0.0.1:56321")
    throw Error("Exact local synthetic database required");
  mkdirSync(out + "/screens", { recursive: true });
  const tag = String(Date.now()).slice(-7);
  const north = "Rehearsal North " + tag,
    south = "Rehearsal South " + tag;
  const ownerContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  ownerContext.setDefaultTimeout(15000);
  const owner = await ownerContext.newPage();
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const actors: Record<string, { id: string; email: string; name: string }> =
    {};
  for (const role of ["north", "south", "coach"]) {
    const email = `rehearsal-${tag}-${role}@example.test`,
      name = `Rehearsal ${role} ${tag}`;
    const r = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (r.error)
      throw Error("Could not provision authorized local synthetic account");
    actors[role] = { id: r.data.user.id, email, name };
    await db
      .from("profiles")
      .update({ synthetic: true })
      .eq("id", r.data.user.id);
  }
  await login(owner, "admin.kafou@example.com");
  const branches: Record<string, string> = {};
  for (const [key, name] of [
    ["north", north],
    ["south", south],
  ]) {
    await owner.goto(base + "/admin?view=Branches");
    await ready(owner);
    await owner
      .getByRole("button", { name: "Add branch", exact: true })
      .click();
    let f = form(owner, "Branch details");
    await f.getByLabel("Branch name", { exact: true }).fill(name);
    await f
      .getByLabel("Branch code", { exact: true })
      .fill("rehearsal-" + key + "-" + tag);
    await f
      .getByLabel("Area", { exact: true })
      .fill("Synthetic local rehearsal");
    branches[key] = (await save(owner, f, "branch.save")).id;
    await close(owner);
    await owner
      .getByRole("row")
      .filter({ hasText: name })
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    f = form(owner, "Branch details");
    await f.getByLabel("Details pending confirmation").uncheck();
    await save(owner, f, "branch.save");
    const activities = form(owner, "Branch activities");
    await activities
      .getByRole("checkbox", { name: "swimming", exact: true })
      .check();
    await save(owner, activities, "branch.sports");
    const venue = form(owner, "Add a venue");
    await venue.getByLabel("Venue name").fill(name + " Pool");
    await venue
      .getByLabel("Address", { exact: true })
      .fill("Local synthetic venue");
    await venue
      .getByLabel("Facilities and operating hours")
      .fill("Pool · Monday–Saturday 14:00–20:00");
    await save(owner, venue, "venue.save");
    await close(owner);
  }
  await owner.screenshot({
    path: out + "/screens/central-branches.png",
    fullPage: true,
  });
  await owner
    .getByRole("row")
    .filter({ hasText: north })
    .getByRole("button", { name: "Open branch", exact: true })
    .click();
  await ready(owner);
  await expect(owner).toHaveURL(new RegExp("branch=" + branches.north));
  await expect(owner.locator(".management-branch-context")).toContainText(
    north,
  );
  await owner.screenshot({
    path: out + "/screens/owner-branch-workspace.png",
    fullPage: true,
  });
  for (const [key, actor] of Object.entries(actors)) {
    await owner.goto(base + "/admin?view=Team");
    await ready(owner);
    await owner.getByLabel("Search users", { exact: true }).fill(actor.name);
    const row = owner
      .locator("details.ops-child")
      .filter({ hasText: actor.name });
    await row.locator("summary").click();
    await row.getByRole("checkbox", { name: "Parent", exact: true }).uncheck();
    await row
      .getByRole("checkbox", {
        name: key === "coach" ? "Coach" : "Branch",
        exact: true,
      })
      .check();
    await row
      .getByRole("checkbox", {
        name: key === "south" ? south : north,
        exact: true,
      })
      .check();
    if (key === "coach")
      await row.getByRole("checkbox", { name: south, exact: true }).check();
    await save(owner, row.locator("form"), "staff.access");
  }
  await owner.goto(base + "/admin?view=Team");
  await ready(owner);
  await owner.getByText("Advanced permissions", { exact: true }).click();
  await owner
    .getByText("Financial and operational permissions", { exact: true })
    .click();
  for (const role of ["north", "south"])
    for (const permission of [
      "finance.view",
      "finance.memberships",
      "finance.payment",
      "attendance.finalize",
    ]) {
      const f = owner
        .locator("form")
        .filter({ has: owner.locator('select[name="user_id"]') });
      await f
        .getByRole("combobox", { name: "Staff account", exact: true })
        .selectOption(actors[role].id);
      await f
        .getByRole("combobox", { name: "Permission", exact: true })
        .selectOption(permission);
      await f
        .getByRole("combobox", {
          name: "Branch (blank means all permitted branches)",
          exact: true,
        })
        .selectOption(branches[role]);
      await save(owner, f, "permission.grant");
    }
  await owner.goto(base + "/admin?view=Packages");
  await ready(owner);
  await owner
    .getByRole("button", { name: "Create package", exact: true })
    .click();
  const pkg = form(owner, "Package configuration");
  await pkg
    .getByLabel("Package name", { exact: true })
    .fill("Rehearsal Swimming " + tag);
  await pkg.getByLabel("Default price (AED)").fill("120");
  await pkg.getByLabel("Minimum age").fill("6");
  await pkg.getByLabel("Maximum age").fill("12");
  await pkg
    .getByLabel("Package terms")
    .fill("Eight sessions in one calendar month. Synthetic rehearsal only.");
  await pkg.getByRole("checkbox", { name: north, exact: true }).check();
  const catalogue = (await save(owner, pkg, "commercial.catalogue.save")).id;
  await close(owner);
  await owner.screenshot({
    path: out + "/screens/package-branch-availability.png",
    fullPage: true,
  });
  const northContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    southContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
  const a = await northContext.newPage(),
    b = await southContext.newPage();
  await login(a, actors.north.email);
  await login(b, actors.south.email);
  await expect(a).toHaveURL(new RegExp("branch=" + branches.north));
  await expect(a.locator(".management-branch-context")).toContainText(north);
  await a.goto(base + "/branch?view=Families&branch=" + branches.north);
  await ready(a);
  await a
    .getByRole("button", { name: "Register customer", exact: true })
    .click();
  const registration = form(a, "Parent and child");
  await registration.getByLabel("Family name").fill("Rehearsal family " + tag);
  await registration.getByLabel("Mobile number").fill("+97150" + tag);
  await registration.getByLabel("Child name").fill("Rehearsal child " + tag);
  await registration.getByLabel("Age", { exact: true }).fill("8");
  const customer = await save(a, registration, "commercial.customer.create");
  await close(a);
  await a.goto(base + "/branch?view=Memberships&branch=" + branches.north);
  await ready(a);
  const member = form(a, "Start a membership");
  await member
    .getByRole("combobox", { name: "Child", exact: true })
    .selectOption(customer.child_id);
  const packages = (
    await db
      .from("commercial_packages")
      .select("id,branch_id")
      .eq("catalogue_id", catalogue)
  ).data!;
  const offer = packages.find((p) => p.branch_id === branches.north)!;
  await member
    .getByRole("combobox", { name: "Package", exact: true })
    .selectOption(offer.id);
  await member.getByRole("checkbox").check();
  const membership = await save(a, member, "commercial.membership.start");
  await a.goto(base + "/branch?view=Finance&branch=" + branches.north);
  await ready(a);
  await a
    .getByRole("button", { name: "Open invoice / record payment", exact: true })
    .click();
  await a.screenshot({
    path: out + "/screens/contextual-invoice-payment.png",
    fullPage: true,
  });
  const payment = form(a, "Record payment");
  await expect(payment.getByLabel("Family", { exact: true })).toHaveCount(0);
  await expect(payment.getByLabel("Branch", { exact: true })).toHaveCount(0);
  await payment
    .getByLabel("Payment reference", { exact: true })
    .fill("REHEARSAL-CASH-" + tag);
  await save(a, payment, "commercial.payment.record");
  await expect(
    a.getByText("Invoice paid. Receipt available in Receipts.", {
      exact: true,
    }),
  ).toBeVisible();
  await close(a);
  await expect(a.locator(".management-metrics")).toContainText("120");
  await a.screenshot({
    path: out + "/screens/branch-invoice-payment.png",
    fullPage: true,
  });
  await b.goto(base + "/branch?view=Packages&branch=" + branches.south);
  await ready(b);
  await expect(
    b.getByText("Rehearsal Swimming " + tag, { exact: true }),
  ).toHaveCount(0);
  const denied = await b.request.get(
    base + "/api/management/invoice?id=" + membership.invoice_id,
  );
  expect(denied.status()).toBe(403);
  const deniedSale = await b.request.post(base + "/api/product", {
    headers: { Origin: base },
    data: {
      action: "commercial.membership.start",
      key: crypto.randomUUID(),
      data: {
        child_id: customer.child_id,
        package_id: offer.id,
        starts_on: new Date().toISOString().slice(0, 10),
        accepted: true,
      },
    },
  });
  expect(deniedSale.status()).toBe(403);
  const other = await b.request.get(
    base +
      `/api/management/finance?branch=${branches.south}&from=${new Date().toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`,
  );
  expect((await other.json()).data.branches[0].finance.receivedMinor).toBe(0);
  await owner.goto(base + "/admin?view=Coaches");
  await ready(owner);
  await owner.getByLabel("Search coaches").fill(actors.coach.name);
  await owner.getByRole("button", { name: "Manage coach" }).click();
  await owner.getByRole("button", { name: "Assignments", exact: true }).click();
  const assign = form(owner, "Assign branch and activity");
  await assign
    .getByRole("combobox", { name: "Branch", exact: true })
    .selectOption(branches.north);
  await assign
    .getByRole("combobox", { name: "Sport", exact: true })
    .selectOption("swimming");
  await save(owner, assign, "commercial.coach.assign");
  await owner.getByRole("button", { name: "Agreements", exact: true }).click();
  const agreement = form(owner, "Add effective agreement");
  await agreement
    .getByRole("combobox", { name: "Branch", exact: true })
    .selectOption(branches.north);
  await agreement.getByLabel("Rate (AED)").fill("50");
  await agreement
    .getByLabel("Effective from", { exact: true })
    .fill(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  await agreement
    .getByLabel("Effective until (exclusive)")
    .fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const rate = (await save(owner, agreement, "commercial.agreement.create")).id;
  await close(owner);
  // Prepare only historical work timing; completion, accrual approval and payout are exercised through UI.
  const venue = (
    await db
      .from("venues")
      .select("id")
      .eq("branch_id", branches.north)
      .single()
  ).data!;
  const level = (
    await db
      .from("sport_levels")
      .select("id")
      .eq("sport", "swimming")
      .eq("active", true)
      .limit(1)
  ).data![0];
  const age = (await db.from("age_groups").select("id").limit(1)).data![0];
  const cls = await db
    .from("academy_classes")
    .insert({
      branch_id: branches.north,
      venue_id: venue.id,
      coach_id: actors.coach.id,
      sport: "swimming",
      level_id: level.id,
      age_group_id: age.id,
      name: "Rehearsal completed class " + tag,
      capacity: 10,
      weekdays: [1],
      local_time: "16:00",
      duration_minutes: 60,
    })
    .select("id")
    .single();
  expect(cls.error).toBeNull();
  const session = await db
    .from("class_sessions")
    .insert({
      class_id: cls.data!.id,
      starts_at: new Date(Date.now() - 7200000).toISOString(),
      ends_at: new Date(Date.now() - 3600000).toISOString(),
      capacity: 10,
      finalized_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  expect(session.error).toBeNull();
  await a.goto(base + "/branch?view=Attendance&branch=" + branches.north);
  await ready(a);
  await a
    .getByRole("row")
    .filter({ hasText: "Rehearsal completed class " + tag })
    .getByRole("button", { name: "Open roster", exact: true })
    .click();
  const sessionCard = a.getByRole("dialog");
  await sessionCard
    .getByRole("button", {
      name: "Confirm session delivered",
    })
    .click();
  await owner.goto(base + "/admin?view=Coaches");
  await ready(owner);
  await owner.getByLabel("Search coaches").fill(actors.coach.name);
  await owner.getByRole("button", { name: "Manage coach" }).click();
  await owner
    .getByRole("button", { name: "Earnings and payments", exact: true })
    .click();
  await owner
    .getByRole("button", { name: "Review earnings", exact: true })
    .click();
  let review = form(owner, "AED 50.00");
  if (!(await review.count()))
    review = owner.locator(".portal-drawer form").last();
  await review
    .getByLabel("Reason")
    .fill("Completed work verified in local rehearsal");
  await save(owner, review, "commercial.compensation.review");
  await owner
    .getByRole("button", { name: "Record payout", exact: true })
    .click();
  const payout = owner.locator(".portal-drawer form").last();
  await payout.getByLabel("Payment reference").fill("REHEARSAL-COACH-" + tag);
  await payout
    .getByLabel("Reason")
    .fill("Synthetic offline payout already completed");
  await save(owner, payout, "commercial.compensation.settle");
  await expect(
    owner.getByRole("button", { name: "Record payout", exact: true }),
  ).toHaveCount(0);
  await expect(owner.locator(".portal-drawer .management-table")).toContainText(
    "Recorded",
  );
  await owner.screenshot({
    path: out + "/screens/coach-earned-paid-balance.png",
    fullPage: true,
  });
  await close(owner);
  await owner.goto(base + "/admin?view=Packages");
  await ready(owner);
  await owner.getByLabel("Search packages").fill("Rehearsal Swimming " + tag);
  await owner.getByRole("button", { name: "Edit availability" }).click();
  const edit = form(owner, "Package configuration");
  await edit.getByRole("checkbox", { name: north, exact: true }).uncheck();
  await save(owner, edit, "commercial.catalogue.save");
  await close(owner);
  expect(
    (
      await db
        .from("commercial_memberships")
        .select("status")
        .eq("id", membership.id)
        .single()
    ).data?.status,
  ).toBe("active");
  await owner.goto(base + "/admin?view=Coaches");
  await ready(owner);
  await owner.getByLabel("Search coaches").fill(actors.coach.name);
  await owner.getByRole("button", { name: "Manage coach" }).click();
  const coachProfile = form(owner, "Coach details");
  await coachProfile.getByLabel("Account active").uncheck();
  await save(owner, coachProfile, "commercial.coach.save");
  await close(owner);
  const earnings = (
    await db
      .from("commercial_compensation_accruals")
      .select("id,amount_minor,status")
      .eq("rate_id", rate)
  ).data!;
  expect(earnings).toHaveLength(1);
  expect(earnings[0].amount_minor).toBe(5000);
  expect(earnings[0].status).toBe("approved");
  await owner.goto(base + "/admin?view=Finance");
  await ready(owner);
  const range = new Date().toISOString().slice(0, 10);
  const consolidated = (
    await (
      await owner.request.get(
        base + `/api/management/finance?from=${range}&to=${range}`,
      )
    ).json()
  ).data;
  const summary = consolidated.branches.find(
    (x: { id: string }) => x.id === branches.north,
  );
  expect(summary.finance.receivedMinor).toBe(12000);
  expect(summary.earnedMinor).toBe(5000);
  expect(summary.paidMinor).toBe(5000);
  expect(summary.coachOutstandingMinor).toBe(0);
  await owner.screenshot({
    path: out + "/screens/central-finance.png",
    fullPage: true,
  });
  const totalsBeforePage = await owner
    .locator(".management-metrics")
    .textContent();
  const nextPage = owner.getByRole("button", { name: "Next", exact: true });
  if (await nextPage.count()) {
    await nextPage.click();
    await expect(owner.locator(".management-metrics")).toHaveText(
      totalsBeforePage || "",
    );
    await owner.getByRole("button", { name: "Previous", exact: true }).click();
  }
  await owner.setViewportSize({ width: 390, height: 844 });
  await owner.screenshot({
    path: out + "/screens/central-finance-mobile.png",
    fullPage: true,
  });
  expect(
    await owner.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await owner.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(owner.locator("html")).toHaveAttribute("dir", "rtl");
  await owner.screenshot({
    path: out + "/screens/central-finance-mobile-ar.png",
    fullPage: true,
  });
  expect(
    await owner.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await owner.getByRole("button", { name: "Switch to English" }).click();
  await a.reload();
  await ready(a);
  await expect(a.locator(".management-branch-context")).toContainText(north);
  const release = (
    await (await owner.request.get(base + "/api/release")).json()
  ).data;
  writeFileSync(
    out + "/journey.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        scope: "local synthetic",
        branches,
        actors: Object.fromEntries(
          Object.entries(actors).map(([k, v]) => [
            k,
            { id: v.id, name: v.name },
          ]),
        ),
        catalogue,
        customer,
        membership,
        rate,
        summary,
        release,
        checks: [
          "branch creation and venue configuration",
          "roles and branch grants through UI",
          "one-branch package availability",
          "branch customer and invoice-led payment",
          "other-branch read and sale denied",
          "completed delivery accrual approval payout",
          "package and coach disabled with history retained",
          "central totals with no duplicated cost",
        ],
      },
      null,
      2,
    ),
  );
  await ownerContext.close();
  await northContext.close();
  await southContext.close();
});

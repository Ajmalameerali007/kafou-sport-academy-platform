import { test, expect, type Page, type Locator } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { demoPassword } from "./private-config";

type Row = Record<string, unknown>;
const batch = process.env.KAFOU_PRODUCT_BATCH || "connected-auth-v2-2026-09-20";
if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(batch))
  throw Error("Invalid synthetic acceptance batch");
const phase = process.env.KAFOU_DEVELOPMENT_ACCEPTANCE_PHASE || "compiled";
if (!["source", "compiled"].includes(phase))
  throw Error("Unknown acceptance phase");
const fixture = JSON.parse(
  readFileSync(resolve("outputs/product", `local-${batch}.json`), "utf8"),
);
const preparationPath = resolve(
  "outputs/product",
  `local-${batch}-development-acceptance.json`,
);
const statePath = resolve(
  "outputs/product",
  `local-${batch}-development-browser-state.json`,
);
if (fixture.url !== "http://127.0.0.1:56321" || fixture.status !== "ready")
  throw Error("Existing ready local synthetic fixture required");
test.use({ trace: "off", video: "off", actionTimeout: 15000 });
test.setTimeout(180000);
const form = (page: Page, title: string) =>
  page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
async function submit(page: Page, control: Locator, action: string) {
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/product") &&
      r.request().method() === "POST" &&
      r.request().postDataJSON()?.action === action,
  );
  await control
    .locator('button[type="submit"],button:not([type])')
    .last()
    .click();
  const result = await response;
  expect(result.status(), action).toBe(200);
  const body = await result.json();
  expect(body.ok, action).toBe(true);
  return body.data as Row;
}
async function product(page: Page) {
  const response = await page.request.get("/api/product");
  expect(response.status()).toBe(200);
  return (await response.json()).data as Record<string, Row[]>;
}
async function command(page: Page, action: string, data: Row, origin: string) {
  const response = await page.request.post("/api/product", {
    headers: { Origin: origin },
    data: { action, data, key: crypto.randomUUID() },
  });
  expect(response.status(), action).toBe(200);
  const body = await response.json();
  expect(body.ok, action).toBe(true);
  return body.data as Row;
}
async function visit(page: Page, role: string, view: string) {
  await page.goto(`/${role}?view=${encodeURIComponent(view)}`);
  await expect(
    page.getByRole("button", { name: "Switch to Arabic" }),
  ).toBeEnabled();
  await expect(page.locator(".portal-skeleton")).toHaveCount(0);
  await expect(
    page.getByText("This page couldn’t load", { exact: true }),
  ).toHaveCount(0);
}

test("guardian emergency contact and independent tracked-target lifecycle through real local roles", async ({
  browser,
  baseURL,
}, testInfo) => {
  if (
    !baseURL ||
    ![
      "http://localhost:3100",
      "http://127.0.0.1:3100",
      "http://127.0.0.1:3101",
    ].includes(baseURL)
  )
    throw Error("Known local app origin required");
  if (phase === "compiled" && baseURL !== "http://127.0.0.1:3101")
    throw Error("Compiled acceptance requires the local Worker");
  execFileSync(
    process.execPath,
    ["scripts/prepare-development-acceptance.mjs", `--batch=${batch}`],
    { env: process.env, stdio: "pipe" },
  );
  const prep = JSON.parse(readFileSync(preparationPath, "utf8"));
  const prior = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf8"))
    : {};
  const contexts = await Promise.all(
    ["parent", "coach", "admin"].map(() => browser.newContext({ baseURL })),
  );
  const [parent, coach, admin] = await Promise.all(
    contexts.map((context) => context.newPage()),
  );
  const pages = { parent, coach, admin };
  const errors: string[] = [];
  for (const page of Object.values(pages))
    page.on("pageerror", (error) => errors.push(error.message));
  let originalContact: Row | undefined;
  let policyEnabled = false;
  const report: Row = {
    phase,
    status: "running",
    authenticated_roles: ["parent", "coach", "admin"],
    session_id: prep.sessionId,
  };
  try {
    // Exactly three app-auth calls; no passwords or session material are retained in artifacts.
    for (const role of ["parent", "coach", "admin"] as const) {
      const response = await pages[role].request.post("/api/auth/login", {
        headers: { Origin: baseURL },
        data: {
          identifier: fixture.accounts[role].email,
          password: demoPassword,
          remember: false,
        },
      });
      expect(response.status(), `Authenticate synthetic ${role}`).toBe(200);
    }
    originalContact = (await product(parent)).family_emergency_contacts.find(
      (row) => row.family_id === prep.familyId,
    );
    await visit(parent, "parent", "Family access");
    const contactForm = form(parent, "Save emergency contact");
    await contactForm
      .getByRole("combobox", { name: "Family", exact: true })
      .selectOption(prep.familyId);
    await contactForm
      .getByLabel("Contact name", { exact: true })
      .fill("Synthetic Session Safety Contact");
    await contactForm
      .getByLabel("Mobile number", { exact: true })
      .fill("+971500088881");
    await contactForm
      .getByLabel("Relationship", { exact: true })
      .fill("Synthetic guardian");
    await submit(parent, contactForm, "community.contact.save");
    await command(
      admin,
      "development.emergency.policy",
      {
        branch_id: prep.branchId,
        enabled: false,
        minutes_before: 60,
        synthetic_acknowledged: true,
      },
      baseURL,
    );
    expect(
      (await product(coach)).development_coach_emergency_contacts.filter(
        (row) => row.session_id === prep.sessionId,
      ),
    ).toHaveLength(0);
    await visit(admin, "admin", "Criteria");
    const policyForm = admin.locator("form").filter({
      has: admin.getByLabel(
        "Allow assigned coaches to view emergency contacts",
      ),
    });
    await policyForm
      .getByRole("combobox", { name: "Branch", exact: true })
      .selectOption(prep.branchId);
    await policyForm
      .getByLabel("Minutes before session (0–360)", { exact: true })
      .fill("60");
    await policyForm
      .getByLabel("Allow assigned coaches to view emergency contacts", {
        exact: true,
      })
      .check();
    await policyForm
      .getByLabel(
        "I acknowledge this synthetic safety policy needs academy approval before use with real families.",
        { exact: true },
      )
      .check();
    await submit(admin, policyForm, "development.emergency.policy");
    policyEnabled = true;
    await visit(coach, "coach", "Coaching");
    const emergency = coach
      .getByRole("heading", { name: "Session emergency contacts", exact: true })
      .locator("..");
    await expect(
      emergency.getByRole("link", { name: "+971500088881", exact: true }),
    ).toBeVisible();
    const coachData = await product(coach);
    expect(coachData.family_emergency_contacts).toHaveLength(0);
    const contact = coachData.development_coach_emergency_contacts.find(
      (row) => row.session_id === prep.sessionId,
    );
    expect(contact?.child_id).toBe(prep.childId);
    expect(Object.keys(contact ?? {}).sort()).toEqual([
      "child_id",
      "contact_name",
      "id",
      "mobile",
      "relationship",
      "session_id",
    ]);
    expect(
      (await product(parent)).development_coach_emergency_contacts,
    ).toHaveLength(0);
    await coach.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        coach.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      )
      .toBe(true);
    await coach.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(
      coach.getByRole("heading", {
        name: "جهات اتصال الطوارئ للحصة",
        exact: true,
      }),
    ).toBeVisible();
    await coach.screenshot({
      path: resolve(
        "outputs/product",
        `development-emergency-${phase}-ar-mobile.png`,
      ),
      fullPage: false,
    });
    await coach.getByRole("button", { name: "Switch to English" }).click();
    await coach.setViewportSize({ width: 1440, height: 1000 });
    let target = (await product(coach)).development_targets.find(
      (row) => row.id === prior.targetId,
    );
    if (!target) {
      await coach.getByText("Create tracked target", { exact: true }).click();
      await coach
        .getByRole("combobox", {
          name: "Published baseline measurement",
          exact: true,
        })
        .selectOption(prep.baseline.id);
      const draftForm = form(coach, "Draft training target");
      await draftForm
        .getByLabel("Measurable training goal", { exact: true })
        .fill(prep.targetTitle);
      await draftForm
        .getByLabel("Target measurement", { exact: true })
        .fill(String(prep.targetValue));
      const due = new Date(Date.now() + 14 * 86400000)
        .toISOString()
        .slice(0, 10);
      await draftForm.getByLabel("Target date", { exact: true }).fill(due);
      const created = await submit(coach, draftForm, "development.target.save");
      target = (await product(coach)).development_targets.find(
        (row) => row.id === created.id,
      );
    }
    expect(target).toBeTruthy();
    const targetId = String(target!.id),
      targetTitle = String(target!.title);
    writeFileSync(
      statePath,
      JSON.stringify(
        { targetId, targetTitle, sessionId: prep.sessionId },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    report.target_id = targetId;
    expect(
      (await product(parent)).development_targets.some(
        (row) => row.id === targetId,
      ),
    ).toBe(false);
    if (phase === "source") {
      report.status = "passed";
      report.target_stage =
        "draft UI and privacy checked; compiled phase continues same draft";
      return;
    }
    await visit(coach, "coach", "Coaching");
    let card = coach.locator("article").filter({
      has: coach.getByRole("heading", { name: new RegExp(targetTitle) }),
    });
    if (target!.status === "draft")
      await submit(
        coach,
        card.locator("form").filter({
          has: coach.getByRole("heading", {
            name: "Submit target for review",
            exact: true,
          }),
        }),
        "development.target.submit",
      );
    await visit(admin, "admin", "Progress");
    let reviewCard = admin.locator("article").filter({
      has: admin.getByRole("heading", { name: new RegExp(targetTitle) }),
    });
    let reviewForm = reviewCard.locator("form").filter({
      has: admin.getByRole("heading", {
        name: "Review training target",
        exact: true,
      }),
    });
    await reviewForm
      .getByRole("combobox", { name: "Review decision", exact: true })
      .selectOption("approved");
    await reviewForm
      .getByLabel("Internal review reason", { exact: true })
      .fill(
        "Private synthetic target review: baseline, metric and goal checked.",
      );
    await submit(admin, reviewForm, "development.target.review");
    await expect(
      reviewCard.getByRole("heading", {
        name: "Publish training target",
        exact: true,
      }),
    ).toBeVisible();
    await submit(
      admin,
      reviewCard.locator("form").filter({
        has: admin.getByRole("heading", {
          name: "Publish training target",
          exact: true,
        }),
      }),
      "development.target.publish",
    );
    await visit(parent, "parent", "Progress");
    await expect(
      parent.getByRole("heading", { name: new RegExp(targetTitle) }),
    ).toBeVisible();
    expect((await product(parent)).development_target_reviews).toHaveLength(0);
    await expect(
      parent.getByText("Private synthetic target review:", { exact: false }),
    ).toHaveCount(0);
    await expect
      .poll(() => Date.now() >= new Date(prep.startsAt).getTime())
      .toBe(true);
    const scores = Object.fromEntries(
      prep.criteria.criteria.map((definition: Row) => [
        definition.key,
        definition.key === prep.baseline.metric_key
          ? prep.proofValue
          : Math.max(
              Number(definition.min),
              Math.min(Number(definition.max), Number(definition.min) + 1),
            ),
      ]),
    );
    const assessment = await command(
      coach,
      "development.assessment.save",
      {
        session_id: prep.sessionId,
        child_id: prep.childId,
        criteria_id: prep.criteria.id,
        scores,
        summary:
          "Synthetic tracked target acceptance: later independently measured practice result.",
        internal_note: "Private synthetic completion coaching note.",
      },
      baseURL,
    );
    await command(
      coach,
      "development.assessment.submit",
      { id: assessment.id },
      baseURL,
    );
    await command(
      admin,
      "development.assessment.review",
      {
        id: assessment.id,
        decision: "approved",
        reason: "Synthetic later measurement independently reviewed.",
      },
      baseURL,
    );
    await command(
      admin,
      "development.assessment.publish",
      { id: assessment.id },
      baseURL,
    );
    const proof = (await product(coach)).development_results.find(
      (row) =>
        row.assessment_id === assessment.id &&
        row.metric_key === prep.baseline.metric_key,
    );
    expect(proof).toBeTruthy();
    await visit(coach, "coach", "Coaching");
    card = coach.locator("article").filter({
      has: coach.getByRole("heading", { name: new RegExp(targetTitle) }),
    });
    const completionForm = card.locator("form").filter({
      has: coach.getByRole("heading", {
        name: "Submit target completion",
        exact: true,
      }),
    });
    await completionForm
      .getByRole("combobox", {
        name: "Later published measurement",
        exact: true,
      })
      .selectOption(String(proof!.id));
    await submit(coach, completionForm, "development.target.completion.submit");
    expect(
      (await product(parent)).development_targets.find(
        (row) => row.id === targetId,
      )?.status,
    ).toBe("completion_submitted");
    await visit(admin, "admin", "Progress");
    reviewCard = admin.locator("article").filter({
      has: admin.getByRole("heading", { name: new RegExp(targetTitle) }),
    });
    reviewForm = reviewCard.locator("form").filter({
      has: admin.getByRole("heading", {
        name: "Review target completion",
        exact: true,
      }),
    });
    await reviewForm
      .getByRole("combobox", { name: "Review decision", exact: true })
      .selectOption("approved");
    await reviewForm
      .getByLabel("Internal review reason", { exact: true })
      .fill(
        "Private synthetic completion review: later compatible evidence reaches the goal.",
      );
    await submit(admin, reviewForm, "development.target.completion.review");
    await visit(parent, "parent", "Progress");
    const parentCard = parent.locator("article").filter({
      has: parent.getByRole("heading", { name: new RegExp(targetTitle) }),
    });
    await expect(
      parentCard.getByText("Target completed", { exact: true }),
    ).toBeVisible();
    await expect(
      parentCard.getByText("Private synthetic completion review:", {
        exact: false,
      }),
    ).toHaveCount(0);
    await parent.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        parent.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      )
      .toBe(true);
    await parent.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(
      parent.getByRole("heading", {
        name: "أهداف التدريب المتتبعة",
        exact: true,
      }),
    ).toBeVisible();
    await parent.screenshot({
      path: resolve(
        "outputs/product",
        "development-target-completed-ar-mobile.png",
      ),
      fullPage: false,
    });
    await command(
      admin,
      "development.target.withdraw",
      {
        id: targetId,
        reason:
          "Synthetic acceptance complete; retain reviewed demonstration history.",
      },
      baseURL,
    );
    const final = await product(parent);
    expect(
      final.development_targets.find((row) => row.id === targetId)?.status,
    ).toBe("withdrawn");
    expect(final.development_target_reviews).toHaveLength(0);
    expect(
      final.development_target_events
        .filter((row) => row.target_id === targetId)
        .map((row) => row.action)
        .sort(),
    ).toEqual(["completed", "published", "withdrawn"]);
    report.status = "passed";
    report.target_stage =
      "reviewed, published, independently completed, withdrawn with retained family history";
  } catch (error) {
    report.status = "failed";
    report.failure =
      error instanceof Error
        ? error.message.slice(0, 500)
        : "Acceptance failed";
    throw error;
  } finally {
    try {
      if (policyEnabled)
        await command(
          admin,
          "development.emergency.policy",
          {
            branch_id: prep.branchId,
            enabled: false,
            minutes_before: 60,
            synthetic_acknowledged: true,
          },
          baseURL,
        );
      if (originalContact)
        await command(
          parent,
          "community.contact.save",
          {
            family_id: originalContact.family_id,
            name: originalContact.name,
            mobile: originalContact.mobile,
            relationship: originalContact.relationship,
          },
          baseURL,
        );
      const last = await product(coach);
      expect(
        last.development_coach_emergency_contacts.filter(
          (row) => row.session_id === prep.sessionId,
        ),
      ).toHaveLength(0);
      report.phone_sharing_after_test = "disabled";
      report.runtime_errors = errors;
      expect(errors).toEqual([]);
    } finally {
      writeFileSync(
        resolve("outputs/product", `development-browser-${phase}.json`),
        JSON.stringify(report, null, 2),
        { mode: 0o600 },
      );
      await testInfo.attach(`development-${phase}`, {
        body: JSON.stringify(report),
        contentType: "application/json",
      });
      for (const context of contexts) await context.close().catch(() => {});
    }
  }
});

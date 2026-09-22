import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
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
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=/g, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", key).update(counter).digest(),
    offset = digest[19] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
async function rows(page: Page, endpoint = "product") {
  const merged: Data = {};
  for (let offset = 0; offset <= 100000; offset += 200) {
    const response = await page.request.get(
      `/api/${endpoint}?offset=${offset}`,
    );
    expect(response.status(), `Read ${endpoint}`).toBe(200);
    const data = (await response.json()).data as Data;
    for (const [key, value] of Object.entries(data))
      if (key !== "pagination" && Array.isArray(value))
        merged[key] = [...(merged[key] || []), ...value];
    if (!data.pagination?.[0]?.more) return merged;
  }
  throw Error("Synthetic workspace exceeded bounded pagination");
}
async function command(page: Page, origin: string, action: string, data: Row) {
  const response = await page.request.post("/api/product", {
    headers: { Origin: origin },
    data: { action, data, key: crypto.randomUUID() },
  });
  expect(response.status(), action).toBe(200);
  const body = await response.json();
  expect(body.ok, action).toBe(true);
  return body.data as Row;
}
async function submit(page: Page, button: Locator, action: string) {
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/product") &&
      r.request().method() === "POST" &&
      r.request().postDataJSON()?.action === action,
  );
  await button.click();
  const result = await response;
  expect(result.status(), action).toBe(200);
  const body = await result.json();
  expect(body.ok, action).toBe(true);
  return body.data as Row;
}
async function visit(page: Page, role: string) {
  await page.goto(`/${role}?view=Events`);
  await expect(page.locator(".portal-skeleton")).toHaveCount(0);
  await expect(
    page.getByText("This page couldn’t load", { exact: true }),
  ).toHaveCount(0);
}
const card = (page: Page, title: string) =>
  page
    .locator("article.ops-editor")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const localDate = (timestamp: string) =>
  new Date(Date.parse(timestamp) + 4 * 3600000).toISOString().slice(0, 16);
const overlaps = (row: Row, start: number, end: number) =>
  Date.parse(String(row.starts_at)) < end &&
  Date.parse(String(row.ends_at)) > start;

test("compiled camp timetable, atomic sibling consent and safe assigned-coach roster", async ({
  browser,
  baseURL,
}) => {
  if (baseURL !== "http://127.0.0.1:3101")
    throw Error("Compiled local Worker only");
  const foundation = JSON.parse(
    readFileSync("outputs/foundation/local-keys.json", "utf8"),
  );
  if (foundation.API_URL !== "http://127.0.0.1:56321")
    throw Error("Isolated local Auth fixture only");
  const users = JSON.parse(
    readFileSync("outputs/foundation/test-users.json", "utf8"),
  );
  const ownerId = users.find(
    (u: { role: string }) => u.role === "super_admin",
  ).id;
  const authAdmin = createClient(foundation.API_URL, foundation.SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ownerUser = await authAdmin.auth.admin.getUserById(ownerId);
  expect(ownerUser.data.user?.email).toBe("super_admin@kafou.example.test");
  // Explicit local test setup only: reset factors for the isolated foundation fixture,
  // then perform real enrolment/challenge/verification. This is not recovery evidence.
  const factors = await authAdmin.auth.admin.mfa.listFactors({
    userId: ownerId,
  });
  if (factors.error) throw Error("Cannot inspect isolated local test factors");
  for (const factor of factors.data.factors) {
    const reset = await authAdmin.auth.admin.mfa.deleteFactor({
      userId: ownerId,
      id: factor.id,
    });
    if (reset.error) throw Error("Cannot reset isolated local test factor");
  }
  const contexts = await Promise.all(
    ["owner", "admin", "parent", "coach"].map(() =>
      browser.newContext({ baseURL }),
    ),
  );
  const [owner, admin, parent, coach] = await Promise.all(
    contexts.map((c) => c.newPage()),
  );
  const errors: string[] = [];
  for (const page of [owner, admin, parent, coach])
    page.on("pageerror", (error) => errors.push(error.message));
  let grantId = "",
    eventId = "",
    factorId = "",
    cancelled = false;
  const report: Row = {
    status: "running",
    phase: "compiled",
    authenticated_roles: [
      "isolated_local_owner_with_real_mfa",
      "admin",
      "parent",
      "coach",
    ],
  };
  try {
    const login = async (page: Page, identifier: string, password: string) => {
      expect(password.length).toBeGreaterThan(0);
      const result = await page.request.post("/api/auth/login", {
        headers: { Origin: baseURL },
        data: { identifier, password, remember: false },
      });
      expect(result.status(), "Synthetic app login").toBe(200);
    };
    await login(
      owner,
      "super_admin@kafou.example.test",
      process.env.KAFOU_LOCAL_TEST_PASSWORD || "",
    );
    const enrolledResponse = await owner.request.post("/api/auth/mfa/enroll", {
      headers: { Origin: baseURL },
      data: {},
    });
    expect(enrolledResponse.status()).toBe(200);
    const factor = (await enrolledResponse.json()).data;
    factorId = factor.id;
    const verified = await owner.request.post("/api/auth/mfa/verify", {
      headers: { Origin: baseURL },
      data: { factorId, code: totp(factor.totp.secret) },
    });
    expect(verified.status()).toBe(200);
    expect((await verified.json()).ok).toBe(true);
    const existing = (await rows(owner)).product_permissions.find(
      (p) =>
        p.user_id === fixture.accounts.admin.id &&
        p.permission === "events.manage" &&
        (p.branch_id === fixture.branchId || p.branch_id === null),
    );
    if (!existing) {
      await command(owner, baseURL, "permission.grant", {
        user_id: fixture.accounts.admin.id,
        permission: "events.manage",
        branch_id: fixture.branchId,
      });
      grantId = String(
        (await rows(owner)).product_permissions.find(
          (p) =>
            p.user_id === fixture.accounts.admin.id &&
            p.permission === "events.manage" &&
            p.branch_id === fixture.branchId,
        )?.id || "",
      );
      expect(grantId).not.toBe("");
    }
    for (const [role, page] of [
      ["admin", admin],
      ["parent", parent],
      ["coach", coach],
    ] as const)
      await login(page, fixture.accounts[role].email, demoPassword);
    const [adminBase, parentBase, productData] = await Promise.all([
      rows(admin, "workspace"),
      rows(parent, "workspace"),
      rows(admin),
    ]);
    const cls = adminBase.academy_classes.find(
      (c) => c.id === fixture.ids.class,
    )!;
    expect(cls.synthetic).toBe(true);
    expect(cls.branch_id).toBe(fixture.branchId);
    expect(cls.coach_id).toBe(fixture.accounts.coach.id);
    const age = adminBase.age_groups.find((g) => g.id === cls.age_group_id)!;
    const eligible = parentBase.children
      .filter(
        (c) =>
          c.family_id === fixture.familyId &&
          c.synthetic === true &&
          Number(c.reported_age) >= Number(age.min_age) &&
          Number(c.reported_age) + 1 <= Number(age.max_age) &&
          parentBase.child_sports.some(
            (s) =>
              s.child_id === c.id &&
              s.sport === cls.sport &&
              s.level_id === cls.level_id &&
              s.status === "reviewed",
          ),
      )
      .sort((a, b) =>
        a.id === fixture.ids.child
          ? -1
          : b.id === fixture.ids.child
            ? 1
            : String(a.id).localeCompare(String(b.id)),
      )
      .slice(0, 2);
    expect(eligible).toHaveLength(2);
    const occupied = [
      ...adminBase.class_sessions.filter((s) => s.status !== "cancelled"),
      ...productData.event_occurrences.filter((o) => o.status === "scheduled"),
    ];
    const occurrences: Row[] = [];
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
    tomorrow.setUTCHours(8, 0, 0, 0);
    for (let day = 0; day < 30 && occurrences.length < 2; day++) {
      const start = tomorrow.getTime() + day * 86400000,
        end = start + 30 * 60000;
      if (!occupied.some((r) => overlaps(r, start, end)))
        occurrences.push({
          venue_id: cls.venue_id,
          coach_id: cls.coach_id,
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(end).toISOString(),
        });
    }
    expect(occurrences).toHaveLength(2);
    const title = `Synthetic compiled camp ${crypto.randomUUID().slice(0, 8)}`;
    const waiver = await command(owner, baseURL, "community.document.create", {
      title: `${title} waiver`,
      purpose: "waiver",
      version: `synthetic-${Date.now()}`,
      body: "Synthetic local acceptance fixture only. No legal policy or real event activation. Registration covers the displayed dates.",
    });
    await visit(admin, "admin");
    const create = admin.locator("form").filter({
      has: admin.getByRole("heading", {
        name: "Create synthetic event",
        exact: true,
      }),
    });
    await create
      .getByRole("combobox", { name: "Event format", exact: true })
      .selectOption("camp");
    const campForm = admin.locator("form").filter({
      has: admin.getByRole("heading", {
        name: "Create synthetic camp",
        exact: true,
      }),
    });
    await campForm.getByLabel("Event title", { exact: true }).fill(title);
    await campForm
      .getByRole("combobox", { name: "Branch", exact: true })
      .selectOption(fixture.branchId);
    await campForm
      .getByRole("combobox", { name: "Sport", exact: true })
      .selectOption(String(cls.sport));
    await campForm
      .getByRole("combobox", { name: "Level", exact: true })
      .selectOption(String(cls.level_id));
    await campForm
      .getByRole("combobox", { name: "Age group", exact: true })
      .selectOption(String(cls.age_group_id));
    await campForm
      .getByRole("combobox", { name: "Waiver version", exact: true })
      .selectOption(String(waiver.id));
    await campForm.getByLabel("Capacity", { exact: true }).fill("2");
    for (const [i, slot] of occurrences.entries()) {
      await campForm
        .locator(`[name="occurrence_${i}_venue"]`)
        .selectOption(String(slot.venue_id));
      await campForm
        .locator(`[name="occurrence_${i}_coach"]`)
        .selectOption(String(slot.coach_id));
      await campForm
        .locator(`[name="occurrence_${i}_start"]`)
        .fill(localDate(String(slot.starts_at)));
      await campForm
        .locator(`[name="occurrence_${i}_end"]`)
        .fill(localDate(String(slot.ends_at)));
    }
    await campForm.getByRole("checkbox").check();
    const created = await submit(
      admin,
      campForm.getByRole("button", {
        name: "Create synthetic camp",
        exact: true,
      }),
      "events.camp.create",
    );
    eventId = String(created.event_id);
    report.event_id = eventId;
    report.waiver_id = waiver.id;
    const collision = await admin.request.post("/api/product", {
      headers: { Origin: baseURL },
      data: {
        action: "events.camp.create",
        key: crypto.randomUUID(),
        data: {
          branch_id: fixture.branchId,
          sport: cls.sport,
          level_id: cls.level_id,
          age_group_id: cls.age_group_id,
          document_id: waiver.id,
          title: `${title} collision`,
          capacity: 2,
          policy_acknowledged: true,
          occurrences,
        },
      },
    });
    expect(collision.status()).toBe(409);
    await visit(parent, "parent");
    const parentCard = card(parent, title);
    await parentCard
      .getByRole("combobox", { name: "Family", exact: true })
      .selectOption(fixture.familyId);
    for (const child of eligible)
      await parentCard
        .getByRole("checkbox", {
          name: `${child.name} — Accept this waiver for this child`,
          exact: true,
        })
        .check();
    await submit(
      parent,
      parentCard.getByRole("button", {
        name: "Register selected children",
        exact: true,
      }),
      "events.register",
    );
    const parentData = await rows(parent);
    const registrations = parentData.event_registrations.filter(
      (r) => r.event_id === eventId,
    );
    expect(registrations).toHaveLength(2);
    const consents = parentData.event_consents.filter((c) =>
      registrations.some((r) => r.id === c.registration_id),
    );
    expect(consents).toHaveLength(2);
    expect(
      consents.every(
        (c) =>
          Array.isArray(c.occurrence_snapshot) &&
          c.occurrence_snapshot.length === 2,
      ),
    ).toBe(true);
    expect(
      parentData.event_attendance_register.filter(
        (r) => r.event_id === eventId,
      ),
    ).toHaveLength(0);
    await visit(coach, "coach");
    await expect(card(coach, title)).toBeVisible();
    const coachData = await rows(coach),
      safe = coachData.event_attendance_register.filter(
        (r) => r.event_id === eventId,
      );
    expect(safe).toHaveLength(4);
    expect(Object.keys(safe[0]).sort()).toEqual(
      [
        "id",
        "occurrence_id",
        "event_id",
        "registration_id",
        "child_id",
        "child_name",
        "attendance",
        "registration_status",
        "finalized_at",
        "can_record",
        "can_correct",
      ].sort(),
    );
    expect(coachData.event_registrations).toHaveLength(0);
    expect(coachData.event_consents).toHaveLength(0);
    expect(coachData.event_attendance).toHaveLength(0);
    const future = await admin.request.post("/api/product", {
      headers: { Origin: baseURL },
      data: {
        action: "events.attendance.finalize",
        key: crypto.randomUUID(),
        data: { occurrence_id: safe[0].occurrence_id },
      },
    });
    expect(future.status()).toBe(409);
    await coach.setViewportSize({ width: 390, height: 844 });
    await coach.getByRole("button", { name: "Switch to Arabic" }).click();
    await expect(coach.locator("html")).toHaveAttribute("dir", "rtl");
    await card(coach, title)
      .locator("details")
      .first()
      .locator("summary")
      .click();
    await expect(
      card(coach, title).getByRole("heading", {
        name: "حضور الأطفال لهذا الموعد",
      }),
    ).toBeVisible();
    expect(
      await coach.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await card(coach, title).screenshot({
      path: "outputs/product/camp-coach-register-compiled-ar-mobile.png",
    });
    await visit(admin, "admin");
    const occurrenceCard = card(admin, title).locator("details").first();
    await occurrenceCard.locator("summary").click();
    await occurrenceCard
      .getByLabel("Cancellation reason", { exact: true })
      .fill("Synthetic compiled acceptance date cleanup");
    await submit(
      admin,
      occurrenceCard.getByRole("button", {
        name: "Cancel this date",
        exact: true,
      }),
      "events.occurrence.cancel",
    );
    const afterDate = await rows(parent);
    expect(
      afterDate.event_registrations.filter(
        (r) => r.event_id === eventId && r.status === "registered",
      ),
    ).toHaveLength(2);
    expect(
      afterDate.event_occurrences.filter(
        (o) => o.event_id === eventId && o.status === "scheduled",
      ),
    ).toHaveLength(1);
    const cancelForm = card(admin, title)
      .locator("form")
      .filter({
        has: admin.getByRole("button", { name: "Cancel event", exact: true }),
      });
    await cancelForm
      .getByLabel("Cancellation reason", { exact: true })
      .fill("Synthetic compiled acceptance complete; test camp closed");
    await submit(
      admin,
      cancelForm.getByRole("button", { name: "Cancel event", exact: true }),
      "events.cancel",
    );
    cancelled = true;
    const finalParent = await rows(parent);
    expect(
      finalParent.event_registrations.filter(
        (r) => r.event_id === eventId && r.status === "registered",
      ),
    ).toHaveLength(0);
    expect(
      finalParent.event_consents.filter((c) =>
        registrations.some((r) => r.id === c.registration_id),
      ),
    ).toHaveLength(2);
    expect(
      (await rows(coach)).event_attendance_register.filter(
        (r) => r.event_id === eventId,
      ),
    ).toHaveLength(0);
    expect(errors).toEqual([]);
    Object.assign(report, {
      status: "passed",
      siblings: 2,
      dated_roster_rows: 4,
      consent_snapshots: 2,
      resource_conflict_rejected: true,
      future_attendance_rejected: true,
      parent_drafts_hidden: true,
      coach_raw_family_records_denied: true,
      arabic_mobile_no_overflow: true,
      individual_and_global_cancellation: true,
      runtime_errors: errors,
    });
  } catch (error) {
    report.status = "failed";
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (eventId && !cancelled) {
      try {
        await command(owner, baseURL, "events.cancel", {
          event_id: eventId,
          reason: "Synthetic acceptance cleanup after interrupted test",
        });
        cancelled = true;
      } catch {
        report.cleanup_error = "Test camp cancellation failed";
      }
    }
    if (grantId) {
      try {
        await command(owner, baseURL, "permission.revoke", { id: grantId });
        report.test_grant_revoked = true;
      } catch {
        report.cleanup_error = "Test-created permission cleanup failed";
      }
    }
    if (factorId) {
      const result = await authAdmin.auth.admin.mfa.deleteFactor({
        userId: ownerId,
        id: factorId,
      });
      if (result.error) report.factor_cleanup_error = true;
    }
    report.camp_cancelled = cancelled;
    const cleanupFailed =
      !!report.cleanup_error || !!report.factor_cleanup_error;
    if (cleanupFailed) {
      report.status = "failed";
      report.error = "Synthetic test cleanup failed";
    }
    writeFileSync(
      "outputs/product/camp-browser-compiled.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    await Promise.all(contexts.map((c) => c.close().catch(() => {})));
    if (cleanupFailed)
      throw Error("Synthetic test cleanup failed; see acceptance report");
  }
});

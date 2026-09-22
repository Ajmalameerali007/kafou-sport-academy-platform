import { demoPassword } from "./private-config";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const env = JSON.parse(
  readFileSync("outputs/foundation/local-keys.json", "utf8"),
);
const fixtures = JSON.parse(
  readFileSync("outputs/phase2/demo-records.json", "utf8"),
);
if (!env.API_URL.startsWith("http://127.0.0.1:"))
  throw Error("Local fixtures only");
const db = createClient(env.API_URL, env.SECRET_KEY, {
  auth: { persistSession: false },
});
const pass = demoPassword;
async function login(page: import("@playwright/test").Page, role: string) {
  await page.goto("/auth");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(`${role}.kafou@example.com`);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(pass);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLInputElement>('input[type="password"]')
      .forEach((input) => {
        input.value = "";
      }),
  );
  await expect(page).not.toHaveURL(/\/auth/);
}
async function command(
  page: import("@playwright/test").Page,
  action: string,
  data: unknown,
) {
  const response = await page.request.post("/api/operations", {
    headers: { Origin: new URL(page.url()).origin },
    data: { action, data },
  });
  return { status: response.status(), ...(await response.json()) };
}
test("connected trial, roster, attendance, conversion and persistent parent enrollment", async ({
  page,
}) => {
  await login(page, "parent");
  const origin = new URL(page.url()).origin;
  const childName = `DEMO Journey ${Date.now()}`;
  const child = await (
    await page.request.post("/api/commands", {
      headers: { Origin: origin },
      data: {
        action: "child.save",
        data: {
          family_id: fixtures.family.id,
          name: childName,
          reported_age: 6,
        },
      },
    })
  ).json();
  expect(child.ok).toBe(true);
  const payload = {
    parentName: "DEMO Journey Parent",
    mobile: "+971500000000",
    email: "parent.kafou@example.com",
    childName,
    childId: child.data.id,
    age: "6",
    sport: "swimming",
    experience: "beginner",
    preferredBranch: "demo-dubai",
  };
  const enquiry = await (
    await page.request.post("/api/enquiries", {
      headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
      data: payload,
    })
  ).json();
  expect(enquiry.ok).toBe(true);
  const available = await (
    await page.request.get(
      `/api/availability?enquiry=${enquiry.data.requestId}`,
    )
  ).json();
  expect(available.ok).toBe(true);
  expect(available.data.length).toBeGreaterThan(0);
  const slot = available.data[0];
  const booked = await command(page, "trial.book", {
    enquiry_id: enquiry.data.requestId,
    session_id: slot.id,
  });
  expect(booked.ok).toBe(true);
  const retry = await command(page, "trial.book", {
    enquiry_id: enquiry.data.requestId,
    session_id: slot.id,
  });
  expect(retry.data.id).toBe(booked.data.id);
  await page.reload();
  await page.getByRole("button", { name: "Trials", exact: true }).click();
  await page.locator("summary").filter({ hasText: childName }).click();
  await expect(
    page.getByText(booked.data.reference, { exact: false }),
  ).toBeVisible();
  await page.request.post("/api/auth/logout", {
    headers: { Origin: origin },
    data: {},
  });
  await login(page, "branch");
  await page
    .getByRole("button", { name: "Classes / Sessions", exact: true })
    .click();
  // The clock shift is local fixture setup, not a production attendance bypass.
  await db
    .from("class_sessions")
    .update({
      starts_at: new Date(Date.now() - 3600000).toISOString(),
      ends_at: new Date(Date.now() - 60000).toISOString(),
    })
    .eq("id", slot.id);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .locator(`[data-session-id="${slot.id}"]`)
    .getByRole("button", { name: "Open roster" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Attendance roster" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark All Present" }).click();
  await page
    .getByRole("button", { name: "Finalize Attendance", exact: true })
    .click();
  await expect(
    page.getByText("Attendance finalized. Normal editing is locked."),
  ).toBeVisible();
  const convert = await command(page, "trial.convert", {
    id: booked.data.id,
    class_id: slot.class_id,
  });
  expect(convert.ok, convert.message).toBe(true);
  expect(
    (
      await command(page, "trial.convert", {
        id: booked.data.id,
        class_id: slot.class_id,
      })
    ).data.id,
  ).toBe(convert.data.id);
  await page.request.post("/api/auth/logout", {
    headers: { Origin: origin },
    data: {},
  });
  await login(page, "parent");
  await page.getByRole("button", { name: "Trials", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Active enrollments" }),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        "Package configuration pending. No payment has been collected.",
      )
      .first(),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: "outputs/phase2/parent-enrollment.png",
    fullPage: true,
  });
});
test("guest capability allows only its own saved enquiry and booking", async ({
  page,
  browser,
}) => {
  await page.goto("/trial");
  const origin = new URL(page.url()).origin;
  const r = await (
    await page.request.post("/api/enquiries", {
      headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
      data: {
        parentName: "DEMO Guest",
        mobile: "+971500000009",
        childName: "DEMO Guest Child",
        age: "6",
        sport: "karate",
        experience: "beginner",
        preferredBranch: "demo-dubai",
      },
    })
  ).json();
  expect(r.ok).toBe(true);
  const slots = await (
    await page.request.get(`/api/availability?enquiry=${r.data.requestId}`)
  ).json();
  expect(slots.ok).toBe(true);
  expect(slots.data.length).toBeGreaterThan(0);
  const other = await browser.newContext();
  const denied = await other.request.get(
    `${origin}/api/availability?enquiry=${r.data.requestId}`,
  );
  expect(denied.status()).toBe(401);
  const deniedBooking = await other.request.post(`${origin}/api/operations`, {
    headers: { Origin: origin },
    data: {
      action: "trial.book",
      data: { enquiry_id: r.data.requestId, session_id: slots.data[0].id },
    },
  });
  expect(deniedBooking.status()).toBe(401);
  // A copied enquiry ID or a modified/expired capability never confers access.
  // Cookie values are used only in-memory and are not written to test evidence.
  const capability = (
    await page.context().cookies(`${origin}/api/availability`)
  ).find((cookie) => cookie.name === "kafou-enquiry");
  expect(Boolean(capability)).toBe(true);
  const [record, expires, signature] = capability!.value.split(".");
  for (const value of [
    `${record}.${expires}.${signature[0] === "0" ? "1" : "0"}${signature.slice(1)}`,
    `${record}.0.${signature}`,
  ]) {
    await other.addCookies([{ ...capability!, value }]);
    const tampered = await other.request.get(
      `${origin}/api/availability?enquiry=${r.data.requestId}`,
    );
    expect(tampered.status()).toBe(401);
  }
  await other.close();
  const booked = await command(page, "trial.book", {
    enquiry_id: r.data.requestId,
    session_id: slots.data[0].id,
  });
  expect(booked.ok).toBe(true);
  expect(booked.data.reference).toMatch(/^TRI-/);
});
test("role-specific operational screens and Arabic remain accessible", async ({
  page,
}) => {
  await login(page, "sales");
  expect(
    (
      await command(page, "class.status", {
        id: fixtures.classes[0].id,
        active: false,
      })
    ).status,
  ).toBe(403);
  await page.getByRole("button", { name: "Enquiries", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "New lead", exact: true }),
  ).toBeVisible();
  await page.request.post("/api/auth/logout", {
    headers: { Origin: new URL(page.url()).origin },
    data: {},
  });
  await login(page, "coach");
  await page
    .getByRole("button", { name: "Assigned sessions", exact: true })
    .click();
  await expect(
    page.getByText(
      "Times shown in UAE time. Booking type and attendance are separate.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("button", { name: "الحصص المعيّنة", exact: true }),
  ).toBeVisible();
});
test("simultaneous last-place requests commit exactly one booking", async ({
  browser,
}) => {
  const cls = fixtures.classes.find(
    (c: { sport: string }) => c.sport === "badminton",
  );
  const when = new Date(Date.now() + 40 * 86400000);
  const inserted = await db
    .from("class_sessions")
    .insert({
      class_id: cls.id,
      starts_at: when.toISOString(),
      ends_at: new Date(+when + 3600000).toISOString(),
      capacity: 1,
    })
    .select()
    .single();
  expect(inserted.error).toBeNull();
  const pages = [];
  const enquiries: string[] = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext();
    const p = await context.newPage();
    pages.push(p);
    await p.goto("/trial");
    const r = await (
      await p.request.post("/api/enquiries", {
        headers: {
          Origin: new URL(p.url()).origin,
          "Idempotency-Key": crypto.randomUUID(),
        },
        data: {
          parentName: `DEMO Race ${i}`,
          mobile: `+97150000000${i}`,
          childName: `DEMO Race Child ${i}`,
          age: "6",
          sport: "badminton",
          experience: "beginner",
          preferredBranch: "demo-dubai",
        },
      })
    ).json();
    expect(r.ok).toBe(true);
    enquiries.push(r.data.requestId);
  }
  const results = await Promise.all(
    pages.map((p, i) =>
      command(p, "trial.book", {
        enquiry_id: enquiries[i],
        session_id: inserted.data.id,
      }),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const roster = await db
    .from("session_roster")
    .select("id")
    .eq("session_id", inserted.data.id)
    .eq("cancelled", false);
  expect(roster.data).toHaveLength(1);
  for (const p of pages) await p.context().close();
});
test("Head Office creates recurring classes and materializes sessions idempotently", async ({
  page,
}) => {
  await login(page, "headoffice");
  const origin = new URL(page.url()).origin;
  const workspace = await (await page.request.get("/api/workspace")).json();
  expect(workspace.ok).toBe(true);
  const formData = {
    branch_id: fixtures.dubai.id,
    name: `DEMO Test Venue ${Date.now()}`,
    address: "Local synthetic test only",
    operating_information: "",
  };
  const venue = await (
    await page.request.post("/api/commands", {
      headers: { Origin: origin },
      data: { action: "venue.save", data: formData },
    })
  ).json();
  expect(venue.ok).toBe(true);
  const cls = await command(page, "class.create", {
    branch_id: fixtures.dubai.id,
    venue_id: venue.data.id,
    coach_id: fixtures.accounts.coach.id,
    sport: "swimming",
    level_id: fixtures.classes[0].level_id,
    age_group_id: fixtures.classes[0].age_group_id,
    name: `DEMO Generated ${Date.now()}`,
    capacity: 5,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    local_time: "10:00",
    duration_minutes: 45,
  });
  expect(cls.ok).toBe(true);
  // Pick an actually free coach window so rerunning against persistent local fixtures remains valid.
  const coachClasses = await db
    .from("academy_classes")
    .select("id")
    .eq("coach_id", fixtures.accounts.coach.id);
  expect(coachClasses.error).toBeNull();
  const occupied = await db
    .from("class_sessions")
    .select("starts_at,ends_at")
    .in(
      "class_id",
      coachClasses.data!.map((c) => c.id),
    )
    .neq("status", "cancelled");
  expect(occupied.error).toBeNull();
  let offset = 20;
  for (; offset < 80; offset += 2) {
    const dates = [offset, offset + 1].map((n) => {
      const d = new Date(Date.now() + n * 86400000);
      d.setUTCHours(6, 0, 0, 0);
      return d;
    });
    if (
      dates.every(
        (d) =>
          !occupied.data!.some(
            (s) =>
              new Date(s.starts_at).getTime() < d.getTime() + 45 * 60000 &&
              new Date(s.ends_at) > d,
          ),
      )
    )
      break;
  }
  expect(offset).toBeLessThan(80);
  const from = new Date(Date.now() + offset * 86400000)
    .toISOString()
    .slice(0, 10);
  const to = new Date(Date.now() + (offset + 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  const generated = await command(page, "sessions.generate", {
    class_id: cls.data.id,
    from,
    to,
  });
  expect(generated.ok).toBe(true);
  expect(generated.data.created).toBe(2);
  const again = await command(page, "sessions.generate", {
    class_id: cls.data.id,
    from,
    to,
  });
  expect(again.data.created).toBe(0);
  await page
    .getByRole("button", { name: "Classes / Sessions", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dated sessions" }),
  ).toBeVisible();
  expect(
    (await command(page, "class.status", { id: cls.data.id, active: false }))
      .ok,
  ).toBe(true);
  expect(
    (
      await page.request.post("/api/commands", {
        headers: { Origin: origin },
        data: {
          action: "staff.access",
          data: {
            user_id: fixtures.accounts.sales.id,
            roles: ["super_admin"],
            branch_ids: [],
            active: true,
          },
        },
      })
    ).status(),
  ).toBe(403);
});

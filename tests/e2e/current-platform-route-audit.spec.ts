import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { demoPassword } from "./private-config";

const origin = process.env.BASE_URL || "http://127.0.0.1:3101";
if (!origin.startsWith("http://127.0.0.1:"))
  throw new Error("Current platform route audit is local-only");

const roles = {
  super_admin: {
    email: "admin.kafou@example.com",
    path: "/admin",
    views: [
      "Overview", "Enquiries", "Families", "Students", "Trials",
      "Sports / Levels", "Classes / Sessions", "Branches", "Team", "Events",
      "Schedule", "Attendance", "Makeups", "Packages", "Memberships",
      "Finance", "Compensation", "Criteria", "Progress", "Reports",
      "Business Reports", "Certificates", "Recognition", "Engagement", "Support",
      "Coach messages", "Handover", "Documents", "Communications", "Notifications",
      "Audit", "Security",
    ],
  },
  head_office: {
    email: "headoffice.kafou@example.com",
    path: "/admin",
    views: [
      "Overview", "Enquiries", "Families", "Students", "Trials",
      "Sports / Levels", "Classes / Sessions", "Branches", "Events", "Schedule",
      "Attendance", "Makeups", "Packages", "Memberships", "Finance",
      "Compensation", "Criteria", "Progress", "Reports", "Business Reports",
      "Certificates", "Recognition", "Engagement", "Support", "Coach messages",
      "Handover", "Documents", "Communications", "Notifications", "Audit", "Security",
    ],
  },
  branch: {
    email: "branch.kafou@example.com",
    path: "/branch",
    views: [
      "Overview", "Enquiries", "Trials", "Classes / Sessions", "Families", "Students",
      "Business Reports", "Events", "Schedule", "Attendance", "Makeups", "Memberships",
      "Finance", "Support", "Coach messages", "Handover", "Recognition", "Engagement",
      "Notifications", "Security",
    ],
  },
  sales: {
    email: "sales.kafou@example.com",
    path: "/sales",
    views: ["Overview", "Enquiries", "Trials", "Business Reports", "Security"],
  },
  coach: {
    email: "coach.kafou@example.com",
    path: "/coach",
    views: [
      "Overview", "Assigned sessions", "Students", "Coach messages", "Events", "Coaching",
      "Business Reports", "Progress", "Reports", "Recognition", "Engagement", "Notifications",
      "Security",
    ],
  },
  parent: {
    email: "parent.kafou@example.com",
    path: "/parent",
    views: [
      "Overview", "Schedule", "Events", "Progress", "Family", "Enquiries", "Trials",
      "Memberships", "Finance", "Makeups", "Reports", "Certificates", "Recognition",
      "Engagement", "Support", "Coach messages", "Family access", "Documents",
      "Notifications", "Security",
    ],
  },
} as const;

test.setTimeout(120_000);
test.use({ trace: "off", video: "off" });

const evidence: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  environment: "local compiled synthetic build",
  origin,
  sideEffects: "authentication and notification read receipts only; no business transaction is authored",
  browser: "Playwright Chromium desktop emulation",
  roles: {},
};
const failures: string[] = [];
const evidenceDirectory = "outputs/current-platform-audit";
function saveEvidence() {
  const provenance = JSON.parse(
    readFileSync(resolve("lib/platform/build-provenance.json"), "utf8"),
  );
  evidence.release = {
    gitHead: provenance.gitHead,
    sourceSha256: provenance.sourceSha256,
    dirty: provenance.dirty,
    builtAt: provenance.createdAt,
  };
  const all = Object.values(
    evidence.roles as Record<string, Array<{ ok: boolean }>>,
  ).flat();
  evidence.summary = {
    expectedRoutes: Object.values(roles).reduce(
      (sum, role) => sum + role.views.length,
      0,
    ),
    executed: all.length,
    passed: all.filter((route) => route.ok).length,
    failed: failures.length,
    failures,
  };
  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(
    `${evidenceDirectory}/route-audit.json`,
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}

for (const [role, config] of Object.entries(roles)) {
  test(`${role}: every authorized route resolves to its exact view and ready content`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ baseURL: origin, reducedMotion: "reduce" });
    const roleEvidence: Array<Record<string, unknown>> = [];
    try {
      const page = await context.newPage();
      const login = await page.request.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { identifier: config.email, password: demoPassword, remember: false },
      });
      expect(login.status(), `${role} authentication`).toBe(200);
      for (const view of config.views) {
        const apiFailures: string[] = [];
        const runtimeErrors: string[] = [];
        const responseListener = (response: { status(): number; url(): string }) => {
          const url = new URL(response.url());
          if (
            response.status() >= 400 &&
            url.origin === origin &&
            (/^\/api\//.test(url.pathname) || /\.(?:js|css|woff2?|png|webp|svg)$/.test(url.pathname))
          )
            apiFailures.push(`${response.status()} ${url.pathname}`);
        };
        const requestFailureListener = (request: { url(): string; failure(): { errorText: string } | null }) => {
          const url = new URL(request.url());
          if (url.origin === origin)
            apiFailures.push(`transport ${url.pathname}: ${request.failure()?.errorText || "failed"}`);
        };
        const errorListener = (error: Error) => runtimeErrors.push(error.message);
        page.on("response", responseListener);
        page.on("requestfailed", requestFailureListener);
        page.on("pageerror", errorListener);
        const started = Date.now();
        let status = 0;
        let heading = "";
        let breadcrumb = "";
        let loadError = "";
        let finalUrl = "";
        try {
        const response = await page.goto(
          `${config.path}?view=${encodeURIComponent(view)}`,
          { waitUntil: "domcontentloaded" },
        );
        status = response?.status() || 0;
        await expect(page.locator(".portal-skeleton")).toHaveCount(0, { timeout: 15_000 });
        await expect(page.locator("main")).toBeVisible();
        await expect(page.locator("main > *")).not.toHaveCount(0);
        await expect(page.locator(".portal-breadcrumb strong")).toHaveText(view);
        heading = (await page.locator("main h1").first().textContent())?.trim() || "";
        breadcrumb = (await page.locator(".portal-breadcrumb strong").textContent())?.trim() || "";
        finalUrl = page.url();
        loadError = (await page.getByText("This page couldn’t load", { exact: true }).count())
          ? "page load error panel rendered"
          : "";
        if (role === "parent" && view === "Overview") {
          const primary = await page.locator(".portal-sidebar nav > button span").allTextContents();
          expect(primary).toEqual(["Home", "Schedule", "Progress", "Family", "Membership", "Support"]);
        }
        } catch (error) {
          loadError = error instanceof Error ? error.message : String(error);
          finalUrl = page.url();
        } finally {
          page.off("response", responseListener);
          page.off("requestfailed", requestFailureListener);
          page.off("pageerror", errorListener);
        }
        const actual = finalUrl ? new URL(finalUrl) : null;
        const exactView =
          actual?.pathname === config.path &&
          actual.searchParams.get("view") === view;
        const ok =
          status === 200 &&
          breadcrumb === view &&
          !loadError &&
          runtimeErrors.length === 0 &&
          apiFailures.length === 0 &&
          exactView;
        if (!ok) {
          const screenshot = `${evidenceDirectory}/failure-${role}-${view.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
          await page.screenshot({ path: screenshot, fullPage: false }).catch(() => undefined);
          failures.push(`${role}/${view}: ${loadError || apiFailures.join(", ") || runtimeErrors.join(", ") || `HTTP ${status}; exactView=${exactView}`}`);
        }
        roleEvidence.push({
          view,
          ok,
          status,
          heading,
          breadcrumb,
          finalUrl,
          durationMs: Date.now() - started,
          apiFailures: [...new Set(apiFailures)],
          runtimeErrors: [...new Set(runtimeErrors)],
          loadError,
        });
        (evidence.roles as Record<string, unknown>)[role] = roleEvidence;
        saveEvidence();
      }
      const ownFailures = failures.filter((failure) => failure.startsWith(`${role}/`));
      expect(ownFailures, ownFailures.join("\n")).toEqual([]);
    } finally {
      (evidence.roles as Record<string, unknown>)[role] = roleEvidence;
      mkdirSync(evidenceDirectory, { recursive: true });
      writeFileSync(
        `${evidenceDirectory}/route-audit-${role}.json`,
        `${JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            environment: evidence.environment,
            origin,
            role,
            routes: roleEvidence,
            failures: failures.filter((failure) =>
              failure.startsWith(`${role}/`),
            ),
          },
          null,
          2,
        )}\n`,
      );
      saveEvidence();
      await context.close();
      await testInfo.attach(`${role}-route-audit`, {
        body: Buffer.from(JSON.stringify(roleEvidence, null, 2)),
        contentType: "application/json",
      });
    }
  });
}

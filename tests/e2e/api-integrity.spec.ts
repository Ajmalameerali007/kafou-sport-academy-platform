import { test, expect } from "@playwright/test";
test("concurrent retries persist one enquiry and reject a changed payload", async ({
  request,
  baseURL,
}) => {
  const headers = { Origin: baseURL!, "Idempotency-Key": crypto.randomUUID() };
  const data = {
    parentName: "Synthetic Retry",
    mobile: "+971501234567",
    childName: "Synthetic Retry Child",
    age: "8",
    sport: "swimming",
    preferredBranch: "dubai",
    experience: "unsure",
  };
  const results = await Promise.all([
    request.post("/api/enquiries", { headers, data }),
    request.post("/api/enquiries", { headers, data }),
  ]);
  expect(results.map((r) => r.status())).toEqual([200, 200]);
  expect(await results[0].json()).toEqual(await results[1].json());
  expect(
    (
      await request.post("/api/enquiries", {
        headers,
        data: { ...data, age: "9" },
      })
    ).status(),
  ).toBe(409);
});
test("expired browser snapshot refreshes session cookies in the Worker", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("/auth");
  const response = await page.request.post("/api/auth/login", {
    headers: { Origin: baseURL! },
    data: {
      identifier: "parent@kafou.example.test",
      password: process.env.KAFOU_LOCAL_TEST_PASSWORD || "",
      remember: true,
    },
  });
  expect(response.status()).toBe(200);
  const cookies = (await context.cookies())
    .filter((c) => c.name.includes("auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name));
  expect(cookies.length).toBeGreaterThan(0);
  const original = JSON.parse(
    Buffer.from(
      cookies
        .map((c) => c.value)
        .join("")
        .replace(/^base64-/, ""),
      "base64url",
    ).toString(),
  );
  const value =
    "base64-" +
    Buffer.from(JSON.stringify({ ...original, expires_at: 1 })).toString(
      "base64url",
    );
  for (let i = 0; i < cookies.length; i++)
    await context.addCookies([
      { ...cookies[i], value: value.slice(i * 3180, (i + 1) * 3180) },
    ]);
  const r = await page.goto("/parent");
  await expect(page).toHaveURL(/parent/);
  expect(r?.headers()["cache-control"]).toContain("no-store");
  const refreshed = (await context.cookies())
    .filter((c) => c.name.includes("auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const current = JSON.parse(
    Buffer.from(
      refreshed
        .map((c) => c.value)
        .join("")
        .replace(/^base64-/, ""),
      "base64url",
    ).toString(),
  );
  expect(current.expires_at).toBeGreaterThan(Date.now() / 1000);
  expect(current.refresh_token).not.toBe(original.refresh_token);
  expect(refreshed.every((c) => c.httpOnly)).toBe(true);
});

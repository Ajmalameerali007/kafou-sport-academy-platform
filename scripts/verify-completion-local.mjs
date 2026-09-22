import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const origin = "http://127.0.0.1:3101";
const fixture = JSON.parse(
  readFileSync("outputs/product/local-meeting-tuning-2026-09-20.json", "utf8"),
);
assert.equal(fixture.url, "http://127.0.0.1:56321");
const checks = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push({ name, result: "pass" });
};
const sessions = {};
async function request(role, path, data) {
  const r = await fetch(origin + "/api/" + path, {
    method: data ? "POST" : "GET",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(sessions[role] ? { Cookie: sessions[role] } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const cookies = r.headers.getSetCookie();
  if (cookies.length)
    sessions[role] = cookies.map((c) => c.split(";")[0]).join("; ");
  const body = await r.json();
  return { status: r.status, ...body };
}
const workspaces = {};
for (const role of [
  "parent",
  "sales",
  "branch",
  "coach",
  "admin",
  "super_admin",
]) {
  const login = await request(role, "auth/login", {
    identifier: fixture.accounts[role].email,
    password: process.env.KAFOU_DEMO_PASSWORD,
    remember: false,
  });
  check(role + " authenticated HTTP session", login.ok);
  const session = await request(role, "auth/session");
  check(role + " named role confirmed", session.data?.roles.includes(role));
  const data = await request(role, "workspace");
  if (role === "super_admin" && !session.data?.localDemoMfaExempt) {
    check("Owner remains genuine MFA gated", data.status === 403);
    continue;
  }
  check(role + " persisted workspace loaded", data.ok);
  workspaces[role] = data.data;
  const product = await request(role, "product");
  check(role + " product with added tables loaded", product.ok);
  const report = await request(
    role,
    "reports/summary?from=2026-09-01&to=2026-09-30&branch=" + fixture.branchId,
  );
  check(
    role + " reporting boundary",
    role === "parent" ? report.status === 403 : report.ok,
  );
  if (["coach", "sales"].includes(role))
    check(
      role + " financial aggregate excluded",
      report.data?.finance === null,
    );
  if (role === "admin") {
    const before = JSON.stringify(report.data.finance);
    await request(role, "product?offset=200");
    const after = await request(
      role,
      "reports/summary?from=2026-09-01&to=2026-09-30&branch=" +
        fixture.branchId,
    );
    check(
      "Head Office total independent of next detail page",
      before === JSON.stringify(after.data.finance),
    );
  }
  const chat = await request(role, "coach-conversations");
  check(
    role + " conversation options cannot enable inactive policy",
    chat.ok && chat.data.every((option) => option.enabled === false),
  );
  await request(role, "auth/logout", {});
  const again = await request(role, "auth/login", {
    identifier: fixture.accounts[role].email,
    password: process.env.KAFOU_DEMO_PASSWORD,
    remember: false,
  });
  check(role + " logout and reauthentication", again.ok);
}
const parent = workspaces.parent;
const child = parent.children.find((c) =>
  parent.trial_enquiries.some((q) => q.child_id === c.id),
);
assert.ok(child);
const q = parent.trial_enquiries.find((q) => q.child_id === child.id);
const salesLead = workspaces.sales.leads.find((l) => l.id === q.lead_id);
assert.ok(salesLead);
const issued = await request("sales", "registration-link", {
  action: "issue",
  data: { lead_id: salesLead.id },
});
check(
  "Sales issues private registration capability",
  issued.ok && issued.data.token.length === 64,
);
const continued = await request("parent", "registration-link", {
  action: "continue",
  data: { token: issued.data.token, child_id: child.id },
});
check(
  "Authenticated parent continues original enquiry",
  continued.ok && continued.data.id === q.id,
);
const retried = await request("parent", "registration-link", {
  action: "continue",
  data: { token: issued.data.token, child_id: child.id },
});
check("Continuation retry idempotent", retried.ok && retried.data.id === q.id);
const revoked = await request("sales", "registration-link", {
  action: "revoke",
  data: { lead_id: salesLead.id, id: issued.data.id },
});
check("Staff revokes capability", revoked.ok);
const denied = await request("parent", "registration-link", {
  action: "continue",
  data: { token: issued.data.token, child_id: child.id },
});
check("Revoked capability refused over HTTP", denied.status === 403);
const parentProduct = await request("parent", "product");
check(
  "Published certificate retained after linking",
  parentProduct.data.development_certificates.some(
    (c) => c.id === fixture.workflow.certificate,
  ),
);
writeFileSync(
  "docs/product/evidence/completion-http.json",
  JSON.stringify(
    {
      environment: origin,
      database: fixture.url,
      synthetic: true,
      at: new Date().toISOString(),
      checks,
      externalDelivery: "not_configured",
    },
    null,
    2,
  ) + "\n",
  { mode: 0o600 },
);
console.log(
  `${checks.length} real local HTTP checks passed across six named roles; no credentials or capabilities retained.`,
);

// Additive synthetic reports using existing authenticated Coach and Head Office roles.
// No credentials, roles, account settings, or published history are changed.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFixtureConfig,
  readFixture,
  signInActor,
  fixtureId,
  unwrap,
} from "./seed-product-demo.mjs";
const config = loadFixtureConfig(process.argv.slice(2), false);
const fixture = readFixture(config);
assert.equal(fixture.status, "ready");
const path = resolve(
  config.directory,
  `${config.hosted ? "staging" : "local"}-${config.batch}-report-export.json`,
);
const clients = {};
try {
  for (const role of ["coach", "admin", "parent", "sales"])
    clients[role] = (await signInActor(config, fixture.accounts[role])).client;
  const command = async (role, action, data, step) =>
    unwrap(
      clients[role].rpc("product_command", {
        p_action: action,
        p_data: data,
        p_key: fixtureId(`${config.url}/${config.batch}/report-export/${step}`),
      }),
      `${role} ${action}`,
    );
  const base = {
    session_id: fixture.ids.sessions.assessment,
    child_id: fixture.ids.child,
    month: fixture.startsOn.slice(0, 7),
    evidence_ids: [fixture.workflow.assessment],
  };
  const summary = `Synthetic monthly export ${config.batch}: reviewed independent float progress, supported by the exact published assessment.`;
  let published = (
    await unwrap(
      clients.coach
        .from("development_reports")
        .select("*")
        .eq("child_id", fixture.ids.child)
        .eq("summary", summary),
      "Read existing report export fixture",
    )
  )[0];
  if (!published) {
    const result = await command(
      "coach",
      "development.report.create",
      { ...base, summary },
      "published-create",
    );
    published = await unwrap(
      clients.coach
        .from("development_reports")
        .select("*")
        .eq("id", result.id)
        .single(),
      "Read created report",
    );
  }
  if (published.status === "draft") {
    await command(
      "coach",
      "development.report.submit",
      { id: published.id },
      "published-submit",
    );
    published.status = "submitted";
  }
  if (published.status === "submitted") {
    await command(
      "admin",
      "development.report.review",
      {
        id: published.id,
        decision: "approved",
        reason:
          "Synthetic reviewed export: measurements and narrative verified against published assessment.",
      },
      "published-review",
    );
    published.status = "approved";
  }
  if (published.status === "approved")
    await command(
      "admin",
      "development.report.publish",
      { id: published.id },
      "published-publish",
    );
  const draftSummary = `Synthetic monthly export ${config.batch}: unpublished follow-up draft, never family-facing.`;
  let draft = (
    await unwrap(
      clients.coach
        .from("development_reports")
        .select("*")
        .eq("child_id", fixture.ids.child)
        .eq("summary", draftSummary),
      "Read existing unpublished fixture",
    )
  )[0];
  if (!draft) {
    const result = await command(
      "coach",
      "development.report.create",
      { ...base, summary: draftSummary },
      "draft-create",
    );
    draft = await unwrap(
      clients.coach
        .from("development_reports")
        .select("*")
        .eq("id", result.id)
        .single(),
      "Read draft report",
    );
  }
  assert.equal(draft.status, "draft");
  const own = await unwrap(
    clients.parent
      .from("development_reports")
      .select("*")
      .eq("id", published.id),
    "Parent published report",
  );
  assert.equal(own.length, 1);
  assert.equal(own[0].status, "published");
  assert.equal(
    (
      await unwrap(
        clients.parent
          .from("development_reports")
          .select("*")
          .eq("id", draft.id),
        "Parent draft denial",
      )
    ).length,
    0,
  );
  assert.equal(
    (
      await unwrap(
        clients.sales
          .from("development_reports")
          .select("*")
          .eq("id", published.id),
        "Sales report denial",
      )
    ).length,
    0,
  );
  const record = {
    status: "ready",
    url: config.url,
    batch: config.batch,
    published: own[0].id,
    publishedVersion: own[0].version,
    draft: draft.id,
    draftVersion: draft.version,
    evidence: fixture.workflow.assessment,
    child: fixture.ids.child,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n");
  console.log(
    JSON.stringify({
      status: "ready",
      reportFixture: path,
      publishedVersion: record.publishedVersion,
      draftVersion: record.draftVersion,
      rlsChecks: 3,
    }),
  );
} finally {
  for (const client of Object.values(clients))
    await client.auth.signOut({ scope: "local" });
}

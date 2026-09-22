// Local additive fixture only. No roles, passwords, existing schedules or published evidence are changed.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  clientFor,
  fixtureId,
  loadFixtureConfig,
  readFixture,
  saveFixture,
  unwrap,
} from "./seed-product-demo.mjs";
const config = loadFixtureConfig();
assert.equal(
  config.hosted,
  false,
  "Hosted writes are not supported by this acceptance helper",
);
assert.equal(config.url, "http://127.0.0.1:56321");
const fixture = readFixture(config);
assert.equal(fixture.status, "ready");
const db = clientFor(config, config.secret);
const path = resolve(
  config.directory,
  `local-${config.batch}-development-acceptance.json`,
);
if (existsSync(path)) {
  const prior = JSON.parse(readFileSync(path, "utf8"));
  const session = await unwrap(
    db
      .from("class_sessions")
      .select("*")
      .eq("id", prior.sessionId)
      .maybeSingle(),
    "Inspect prior acceptance session",
  );
  if (
    session?.class_id === fixture.ids.class &&
    session.status !== "cancelled" &&
    new Date(session.ends_at).getTime() > Date.now() + 5 * 60000
  ) {
    console.log(JSON.stringify({ status: "ready", reused: true, path }));
    process.exit(0);
  }
}
const [cls, child, enrollment, profiles, base] = await Promise.all([
  unwrap(
    db.from("academy_classes").select("*").eq("id", fixture.ids.class).single(),
    "Verify synthetic class",
  ),
  unwrap(
    db
      .from("children")
      .select("id,family_id,synthetic")
      .eq("id", fixture.ids.child)
      .single(),
    "Verify synthetic athlete",
  ),
  unwrap(
    db
      .from("enrollments")
      .select("*")
      .eq("id", fixture.ids.enrollment)
      .single(),
    "Verify active synthetic enrollment",
  ),
  unwrap(
    db
      .from("profiles")
      .select("id,synthetic,active")
      .in(
        "id",
        ["parent", "coach", "admin"].map((role) => fixture.accounts[role].id),
      ),
    "Verify existing synthetic actors",
  ),
  unwrap(
    db
      .from("development_results")
      .select("*")
      .eq("assessment_id", fixture.workflow.assessment),
    "Read published baseline",
  ),
]);
assert.ok(
  cls.synthetic &&
    cls.active &&
    cls.coach_id === fixture.accounts.coach.id &&
    cls.branch_id === fixture.branchId,
  "Known synthetic active class required",
);
assert.ok(
  child.synthetic &&
    enrollment.child_id === child.id &&
    enrollment.class_id === cls.id &&
    enrollment.status === "active",
  "Known synthetic active enrollment required",
);
assert.ok(
  profiles.length === 3 && profiles.every((row) => row.synthetic && row.active),
  "Three existing active synthetic actors required",
);
assert.ok(base.length > 0, "Published baseline required");
const criteria = await unwrap(
  db
    .from("development_criteria")
    .select("*")
    .eq("id", base[0].criteria_id)
    .single(),
  "Read versioned baseline criterion",
);
const baseline = base.find((row) => {
  const definition = criteria.criteria.find(
    (metric) => metric.key === row.metric_key,
  );
  return row.direction === "higher"
    ? row.value < definition.max
    : row.value > definition.min;
});
assert.ok(baseline, "A baseline with room to improve is required");
const metric = criteria.criteria.find(
  (item) => item.key === baseline.metric_key,
);
const targetValue =
  baseline.direction === "higher"
    ? Math.min(metric.max, Number(baseline.value) + 1)
    : Math.max(metric.min, Number(baseline.value) - 1);
const proofValue =
  baseline.direction === "higher"
    ? Math.min(metric.max, Number(baseline.value) + 2)
    : Math.max(metric.min, Number(baseline.value) - 2);
const start = new Date(Date.now() + 15000),
  end = new Date(start.getTime() + 20 * 60000);
const classes = await unwrap(
  db.from("academy_classes").select("id").eq("coach_id", cls.coach_id),
  "Read current synthetic coach schedule",
);
const conflicts = await unwrap(
  db
    .from("class_sessions")
    .select("id")
    .in(
      "class_id",
      classes.map((row) => row.id),
    )
    .neq("status", "cancelled")
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString()),
  "Check immediate acceptance slot",
);
assert.equal(
  conflicts.length,
  0,
  "A current coach session prevents a new test occurrence; existing schedules remain untouched",
);
const sessionId = fixtureId(
  `${config.url}/${config.batch}/development-acceptance/${start.toISOString()}`,
);
await unwrap(
  db
    .from("class_sessions")
    .insert({
      id: sessionId,
      class_id: cls.id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      capacity: cls.capacity,
    }),
  "Create new synthetic occurrence",
);
const roster = await unwrap(
  db
    .from("session_roster")
    .insert({
      session_id: sessionId,
      enrollment_id: enrollment.id,
      kind: "enrollment",
    })
    .select("id")
    .single(),
  "Create new synthetic roster",
);
await unwrap(
  db
    .from("audit_events")
    .insert({
      actor_id: null,
      action: "SYNTHETIC_DEVELOPMENT_ACCEPTANCE_SETUP",
      entity: "class_sessions",
      entity_id: sessionId,
      new_value: {
        synthetic: true,
        batch: config.batch,
        source: "guarded_local_acceptance_helper",
      },
    }),
  "Audit isolated fixture setup",
);
saveFixture(path, {
  status: "ready",
  url: config.url,
  batch: config.batch,
  sessionId,
  rosterId: roster.id,
  familyId: child.family_id,
  childId: child.id,
  classId: cls.id,
  branchId: cls.branch_id,
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
  baseline,
  criteria,
  targetValue,
  proofValue,
  targetTitle: `Synthetic tracked goal ${sessionId.slice(0, 8)}`,
});
console.log(JSON.stringify({ status: "ready", reused: false, path }));

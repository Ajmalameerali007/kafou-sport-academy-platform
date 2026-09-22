import { test } from "node:test";
import assert from "node:assert/strict";
import { businessReports } from "../lib/platform/reports";

const range = { from: "2026-09-01", to: "2026-09-30" };

test("sales figures count leads within range by stage and compute conversion/lost rates", () => {
  const data = {
    leads: [
      { id: "l1", stage: "converted", created_at: "2026-09-10T09:00Z" },
      { id: "l2", stage: "lost", created_at: "2026-09-11T09:00Z" },
      { id: "l3", stage: "new", created_at: "2026-09-12T09:00Z" },
      { id: "l4", stage: "new", created_at: "2026-08-01T09:00Z" },
    ],
  };
  const report = businessReports(data, range);
  assert.equal(report.sales.total, 3);
  assert.equal(report.sales.byStage.converted, 1);
  assert.equal(report.sales.byStage.new, 1);
  assert.equal(report.sales.conversionRate, 1 / 3);
  assert.equal(report.sales.lostRate, 1 / 3);
});

test("operations attendance rate only reflects finalized sessions and excludes cancelled roster", () => {
  const data = {
    class_sessions: [
      {
        id: "s1",
        starts_at: "2026-09-05T09:00Z",
        status: "completed",
        finalized_at: "2026-09-05T10:00Z",
      },
      {
        id: "s2",
        starts_at: "2026-09-06T09:00Z",
        status: "scheduled",
        finalized_at: null,
      },
    ],
    session_roster: [
      { id: "r1", session_id: "s1", attendance: "present", cancelled: false },
      { id: "r2", session_id: "s1", attendance: "absent", cancelled: false },
      { id: "r3", session_id: "s1", attendance: "present", cancelled: true },
      { id: "r4", session_id: "s2", attendance: "present", cancelled: false },
    ],
  };
  const report = businessReports(data, range);
  assert.equal(report.operations.total, 2);
  assert.equal(report.operations.byStatus.completed, 1);
  assert.equal(report.operations.attendanceRate, 0.5);
});

test("operations attendance rate is explicitly null when nothing is finalized yet", () => {
  const data = {
    class_sessions: [
      { id: "s1", starts_at: "2026-09-05T09:00Z", status: "scheduled" },
    ],
    session_roster: [],
  };
  const report = businessReports(data, range);
  assert.equal(report.operations.attendanceRate, null);
});

test("finance totals combine invoiced, received and outstanding minor units correctly", () => {
  const data = {
    commercial_invoices: [
      { id: "i1", created_at: "2026-09-10T09:00Z" },
      { id: "i2", created_at: "2026-08-01T09:00Z" },
    ],
    commercial_invoice_lines: [
      { id: "l1", invoice_id: "i1", quantity: 1, unit_minor: 10000 },
      { id: "l2", invoice_id: "i2", quantity: 1, unit_minor: 5000 },
    ],
    commercial_payments: [
      { id: "p1", amount_minor: 4000, created_at: "2026-09-11T09:00Z" },
      { id: "p2", amount_minor: 5000, created_at: "2026-08-01T09:00Z" },
    ],
    commercial_allocations: [],
    commercial_adjustments: [],
    commercial_memberships: [
      { id: "m1", status: "active", expires_on: "2026-09-20" },
      { id: "m2", status: "active", expires_on: "2026-12-20" },
      { id: "m3", status: "cancelled", expires_on: "2026-09-20" },
    ],
  };
  const report = businessReports(data, range);
  assert.equal(report.finance.invoicedMinor, 10000);
  assert.equal(report.finance.receivedMinor, 4000);
  assert.equal(report.finance.outstandingMinor, 15000);
  assert.equal(report.finance.activeMemberships, 2);
  assert.equal(report.finance.expiringSoon, 1);
});

test("coaching figures count delivered sessions per coach and published assessments within range", () => {
  const data = {
    class_sessions: [
      {
        id: "s1",
        starts_at: "2026-09-05T09:00Z",
        status: "completed",
        delivered_by: "coach-1",
      },
      {
        id: "s2",
        starts_at: "2026-09-06T09:00Z",
        status: "completed",
        delivered_by: "coach-1",
      },
      { id: "s3", starts_at: "2026-09-06T09:00Z", status: "scheduled" },
    ],
    development_assessments: [
      {
        id: "a1",
        created_at: "2026-09-05T09:00Z",
        published_at: "2026-09-06T09:00Z",
      },
      { id: "a2", created_at: "2026-09-05T09:00Z", published_at: null },
    ],
  };
  const report = businessReports(data, range);
  assert.equal(report.coaching.deliveredSessions, 2);
  assert.equal(report.coaching.byCoach["coach-1"], 2);
  assert.equal(report.coaching.assessments, 2);
  assert.equal(report.coaching.publishedAssessments, 1);
});

test("comparisons exclude cancelled and unmarked attendance, retain absences and measure booked capacity", () => {
  const report = businessReports(
    {
      academy_classes: [
        { id: "c1", branch_id: "dubai", sport: "swimming" },
        { id: "c2", branch_id: "sharjah", sport: "football" },
      ],
      class_sessions: [
        {
          id: "s1",
          class_id: "c1",
          starts_at: "2026-09-04T21:00Z",
          status: "completed",
          finalized_at: "2026-09-05T00:00Z",
          capacity: 10,
        },
        {
          id: "s2",
          class_id: "c2",
          starts_at: "2026-09-05T10:00Z",
          status: "scheduled",
          capacity: 5,
        },
        {
          id: "cancel",
          class_id: "c1",
          starts_at: "2026-09-05T11:00Z",
          status: "cancelled",
          finalized_at: "2026-09-05T12:00Z",
          capacity: 100,
          delivered_by: "coach",
        },
      ],
      session_roster: [
        { session_id: "s1", attendance: "late" },
        { session_id: "s1", attendance: "absent" },
        { session_id: "s1", attendance: "excused" },
        { session_id: "s1", attendance: "unmarked" },
        { session_id: "s1", attendance: "present", cancelled: true },
        { session_id: "s2", attendance: "unmarked" },
        { session_id: "cancel", attendance: "absent" },
      ],
    },
    range,
  );
  assert.equal(report.operations.attendanceRate, 1 / 3);
  assert.equal(report.operations.utilization, 5 / 15);
  assert.equal(report.operations.absent, 1);
  assert.equal(report.operations.excused, 1);
  assert.equal(report.coaching.deliveredSessions, 0);
  assert.deepEqual(
    report.branches.map((b) => [b.key, b.booked, b.capacity]),
    [
      ["dubai", 4, 10],
      ["sharjah", 1, 5],
    ],
  );
  assert.equal(
    report.sports.find((s) => s.key === "football")?.attendanceRate,
    null,
  );
  assert.deepEqual(
    report.trend.map((d) => d.key),
    ["2026-09-05"],
  );
});

test("progress comparisons follow original assessment branch, distinct athletes and unreversed decisions", () => {
  const report = businessReports(
    {
      academy_classes: [{ id: "old", branch_id: "dubai", sport: "swimming" }],
      class_sessions: [
        {
          id: "before",
          class_id: "old",
          starts_at: "2026-08-30T09:00Z",
          status: "completed",
        },
      ],
      development_assessments: [
        {
          id: "a",
          session_id: "before",
          created_at: "2026-08-30T09:00Z",
          published_at: "2026-09-01T09:00Z",
        },
      ],
      development_level_history: [
        {
          id: "h1",
          child_id: "child",
          sport: "swimming",
          assessment_id: "a",
          created_at: "2026-09-01T09:00Z",
        },
        {
          id: "h2",
          child_id: "child",
          sport: "swimming",
          assessment_id: "a",
          created_at: "2026-09-02T09:00Z",
        },
        {
          id: "h3",
          child_id: "other",
          sport: "swimming",
          assessment_id: "a",
          created_at: "2026-09-03T09:00Z",
        },
      ],
      development_level_reversals: [{ history_id: "h3" }],
    },
    range,
  );
  assert.equal(report.coaching.assessments, 0);
  assert.equal(report.coaching.publishedAssessments, 1);
  assert.equal(report.branches[0].key, "dubai");
  assert.equal(report.branches[0].progressedStudents, 1);
  assert.equal(report.branches[0].utilization, null);
  assert.equal(report.sports[0].progressedStudents, 1);
});

test("selected branch cannot count another branch's assessments or progression", () => {
  const data = {
    display_branch_id: [{ id: "dubai" }],
    academy_classes: [{ id: "c", branch_id: "dubai", sport: "football" }],
    class_sessions: [
      {
        id: "dubai-session",
        class_id: "c",
        starts_at: "2026-09-05T09:00Z",
        status: "scheduled",
        capacity: 10,
      },
    ],
    development_assessments: [
      {
        id: "sharjah-assessment",
        session_id: "sharjah-session",
        created_at: "2026-09-05T09:00Z",
        published_at: "2026-09-06T09:00Z",
      },
    ],
    development_level_history: [
      {
        id: "h",
        assessment_id: "sharjah-assessment",
        child_id: "child",
        sport: "swimming",
        created_at: "2026-09-06T09:00Z",
      },
    ],
  };
  const report = businessReports(data, range);
  assert.equal(report.coaching.assessments, 0);
  assert.equal(report.coaching.publishedAssessments, 0);
  assert.deepEqual(
    report.sports.map((s) => s.key),
    ["football"],
  );
  assert.deepEqual(
    report.branches.map((b) => b.key),
    ["dubai"],
  );
});

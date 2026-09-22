import { test } from "node:test";
import assert from "node:assert/strict";
import { operationalHome } from "../lib/platform/operational-home";
const now = new Date("2026-09-20T08:15:00Z");
test("arrival workspace selects ongoing session and separates booking purpose from attendance", () => {
  const data = {
    academy_classes: [{ id: "c", branch_id: "b" }],
    class_sessions: [
      {
        id: "past",
        class_id: "c",
        starts_at: "2026-09-20T06:00Z",
        ends_at: "2026-09-20T07:00Z",
        status: "scheduled",
      },
      {
        id: "now",
        class_id: "c",
        starts_at: "2026-09-20T08:00Z",
        ends_at: "2026-09-20T09:00Z",
        status: "scheduled",
      },
      {
        id: "cancel",
        class_id: "c",
        starts_at: "2026-09-20T08:10Z",
        ends_at: "2026-09-20T09:00Z",
        status: "cancelled",
      },
    ],
    session_roster: [
      { id: "trial", session_id: "now", kind: "trial", attendance: "unmarked" },
      { id: "arrived", session_id: "now", kind: "regular", attendance: "late" },
      { id: "removed", session_id: "now", cancelled: true },
      { id: "other", session_id: "cancel", attendance: "unmarked" },
    ],
  };
  const home = operationalHome(data, now);
  assert.equal(home.current?.id, "now");
  assert.deepEqual(
    home.arrivals.map((x) => x.id),
    ["trial", "arrived"],
  );
  assert.equal(home.arrived, 1);
  assert.equal(home.awaiting, 1);
  assert.equal(home.branchSummary[0].sessions, 2);
});
test("renewal queue uses UAE dates and ignores expired or cancelled memberships", () => {
  const home = operationalHome(
    {
      commercial_memberships: [
        { id: "now", status: "active", expires_on: "2026-09-20" },
        { id: "week", status: "active", expires_on: "2026-09-27" },
        { id: "later", status: "active", expires_on: "2026-09-28" },
        { id: "past", status: "active", expires_on: "2026-09-19" },
        { id: "cancel", status: "cancelled", expires_on: "2026-09-22" },
      ],
    },
    now,
  );
  assert.deepEqual(
    home.expiring.map((x) => x.id),
    ["now", "week"],
  );
});
test("no scheduled arrivals fabricate zero-occupancy sessions; next future session is explicit", () => {
  const home = operationalHome(
    {
      class_sessions: [
        {
          id: "future",
          starts_at: "2026-09-22T09:00Z",
          ends_at: "2026-09-22T10:00Z",
          status: "scheduled",
        },
      ],
    },
    now,
  );
  assert.equal(home.current, undefined);
  assert.equal(home.next?.id, "future");
  assert.equal(home.arrivals.length, 0);
  assert.equal(home.branchSummary.length, 0);
});
test("collections distinguish money received, invoices issued in period and outstanding balance", () => {
  const home = operationalHome(
    {
      commercial_invoices: [
        { id: "in-range", created_at: "2026-09-20T05:00Z" },
        { id: "out-of-range", created_at: "2026-09-01T05:00Z" },
      ],
      commercial_invoice_lines: [
        { invoice_id: "in-range", quantity: 1, unit_minor: 10000 },
        { invoice_id: "out-of-range", quantity: 1, unit_minor: 5000 },
      ],
      commercial_allocations: [{ invoice_id: "in-range", amount_minor: 4000 }],
      commercial_adjustments: [],
      commercial_payments: [
        { id: "p1", amount_minor: 4000, created_at: "2026-09-20T05:00Z" },
        { id: "p2", amount_minor: 9999, created_at: "2026-09-01T05:00Z" },
      ],
    },
    now,
  );
  assert.equal(home.collections.receivedMinor, 4000);
  assert.equal(home.collections.invoicedMinor, 10000);
  assert.equal(home.collections.outstandingMinor, 6000 + 5000);
});
test("date range control widens period figures beyond a single day", () => {
  const home = operationalHome(
    {
      commercial_payments: [
        { id: "p1", amount_minor: 1000, created_at: "2026-09-18T05:00Z" },
        { id: "p2", amount_minor: 2000, created_at: "2026-09-20T05:00Z" },
      ],
    },
    now,
    { from: "2026-09-18", to: "2026-09-20" },
  );
  assert.equal(home.collections.receivedMinor, 3000);
  assert.deepEqual(home.range, { from: "2026-09-18", to: "2026-09-20" });
});
test("cancelled sessions needing follow-up only surface while a makeup credit is still unused", () => {
  const home = operationalHome(
    {
      academy_classes: [{ id: "c", name: "Swim", branch_id: "b" }],
      class_sessions: [
        {
          id: "cancelled-open",
          class_id: "c",
          starts_at: "2026-09-15T09:00Z",
          ends_at: "2026-09-15T10:00Z",
          status: "cancelled",
        },
        {
          id: "cancelled-resolved",
          class_id: "c",
          starts_at: "2026-09-15T09:00Z",
          ends_at: "2026-09-15T10:00Z",
          status: "cancelled",
        },
        {
          id: "cancelled-old",
          class_id: "c",
          starts_at: "2026-08-01T09:00Z",
          ends_at: "2026-08-01T10:00Z",
          status: "cancelled",
        },
      ],
      session_roster: [
        { id: "r1", session_id: "cancelled-open" },
        { id: "r2", session_id: "cancelled-resolved" },
        { id: "r3", session_id: "cancelled-old" },
      ],
      makeup_credits: [
        { source_roster_id: "r1", status: "available" },
        { source_roster_id: "r2", status: "consumed" },
        { source_roster_id: "r3", status: "available" },
      ],
    },
    now,
  );
  assert.deepEqual(
    home.cancelledFollowUp.map((x) => x.id),
    ["cancelled-open"],
  );
});

test("staffing alerts require active branch-qualified coaches or a full-session substitute", () => {
  const session = {
    class_id: "c",
    starts_at: "2026-09-21T08:00Z",
    ends_at: "2026-09-21T09:00Z",
    status: "scheduled",
  };
  const data = {
    academy_classes: [{ id: "c", branch_id: "b", coach_id: "inactive" }],
    coach_directory: [{ id: "sub", branch_ids: ["b"] }],
    class_sessions: [
      { ...session, id: "uncovered" },
      { ...session, id: "covered" },
      { ...session, id: "partial" },
      { ...session, id: "cancelled", status: "cancelled" },
    ],
    coach_substitutions: [
      {
        session_id: "covered",
        coach_id: "sub",
        starts_at: session.starts_at,
        ends_at: session.ends_at,
      },
      {
        session_id: "partial",
        coach_id: "sub",
        starts_at: "2026-09-21T08:30Z",
        ends_at: session.ends_at,
      },
    ],
  };
  assert.deepEqual(
    operationalHome(data, now).staffingAlerts.map((s) => s.id),
    ["uncovered", "partial"],
  );
  assert.equal(
    operationalHome(
      { ...data, coach_directory: [{ id: "inactive", branch_ids: ["b"] }] },
      now,
    ).staffingAlerts.length,
    0,
  );
  const withoutDirectory = {
    academy_classes: data.academy_classes,
    class_sessions: data.class_sessions,
    coach_substitutions: data.coach_substitutions,
  };
  assert.equal(operationalHome(withoutDirectory, now).staffingAlerts.length, 0);
});

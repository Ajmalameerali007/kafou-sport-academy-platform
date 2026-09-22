import test from "node:test";
import assert from "node:assert/strict";
import {
  scopeOperations,
  portalSnapshot,
  searchRecords,
  dubaiDay,
} from "../lib/platform/portal-model";
const now = new Date("2026-09-20T20:30:00Z");
const data = {
  branches: [
    { id: "a", name: "Dubai" },
    { id: "b", name: "Sharjah" },
  ],
  academy_classes: [
    { id: "c", branch_id: "a", name: "Swimming", capacity: 4 },
    { id: "d", branch_id: "b", name: "Karate", capacity: 9 },
  ],
  class_sessions: [
    {
      id: "s",
      class_id: "c",
      starts_at: "2026-09-20T20:00:00Z",
      ends_at: "2026-09-20T21:00:00Z",
      capacity: 4,
      status: "scheduled",
    },
    {
      id: "x",
      class_id: "d",
      starts_at: "2026-09-20T21:00:00Z",
      ends_at: "2026-09-20T22:00:00Z",
      capacity: 9,
      status: "cancelled",
    },
  ],
  session_roster: [
    {
      id: "r",
      session_id: "s",
      kind: "enrollment",
      enrollment_id: "e",
      attendance: "present",
      cancelled: false,
    },
    { id: "r2", session_id: "s", cancelled: true },
  ],
  enrollments: [
    { id: "e", class_id: "c", child_id: "kid", status: "active" },
    { id: "e2", class_id: "c", child_id: "kid", status: "active" },
    { id: "other", class_id: "d", child_id: "other", status: "active" },
  ],
  children: [
    { id: "kid", name: "Omar", family_id: "f" },
    { id: "other", name: "Sara", family_id: "g" },
  ],
  families: [
    { id: "f", name: "Ahmed Family" },
    { id: "g", name: "Other Family" },
  ],
  leads: [
    {
      id: "l",
      parent_name: "Ahmed",
      branch_id: "a",
      stage: "contacted",
      follow_up_at: "2026-09-20T18:00:00Z",
    },
    {
      id: "closed",
      branch_id: "a",
      stage: "converted",
      follow_up_at: "2026-09-20T18:00:00Z",
    },
    { id: "l2", branch_id: "b", stage: "new" },
  ],
  trial_enquiries: [
    { id: "q", lead_id: "l", child_name: "Omar", sport: "swimming" },
  ],
  trial_bookings: [
    { id: "b", enquiry_id: "q", session_id: "s", status: "attended" },
  ],
  lead_activities: [
    { id: "ac", lead_id: "l" },
    { id: "ac2", lead_id: "l2" },
  ],
  pagination: [{ more: false }],
};
test("uses Dubai calendar date, excludes cancelled sessions/roster and closed followups", () => {
  assert.equal(dubaiDay(now), "2026-09-21");
  const s = portalSnapshot(data, now);
  assert.equal(s.today.length, 1);
  assert.equal(s.expected, 1);
  assert.equal(s.followups.length, 1);
  assert.equal(s.activeStudents, 2);
  assert.equal(s.pendingAttendance.length, 1);
  assert.equal(s.conversionReady.length, 1);
  assert.equal(s.attendancePercent, null);
});
test("branch view follows relationships and does not retain other branch operational records", () => {
  const d = scopeOperations(data, "a");
  assert.equal(d.academy_classes.length, 1);
  assert.equal(d.class_sessions.length, 1);
  assert.equal(d.leads.length, 2);
  assert.equal(d.lead_activities.length, 1);
  assert.equal(d.children.length, 1);
  assert.equal(d.families.length, 1);
  assert.equal(scopeOperations(data, "").class_sessions.length, 2);
});
test("search only loaded scoped records, no blanks and no synthetic unsupported entities", () => {
  const d = scopeOperations(data, "a");
  assert.equal(searchRecords(d, "sara").length, 0);
  assert.ok(searchRecords(d, "omar").some((x) => x.kind === "Child"));
  assert.equal(searchRecords(d, " ").length, 0);
  assert.ok(
    searchRecords(d, "swimming").every((x) =>
      ["Class", "Trial"].includes(x.kind),
    ),
  );
});
test("attendance percentage only includes finalized marked attendance and is explicit when unknown", () => {
  const d = {
    ...data,
    class_sessions: [
      { ...data.class_sessions[0], finalized_at: now.toISOString() },
    ],
  };
  assert.equal(portalSnapshot(d, now).attendancePercent, 100);
  assert.equal(portalSnapshot({}, now).attendancePercent, null);
});

test("family upcoming includes only enrolled roster or actual bookings, not every eligible class session", async () => {
  const { familyUpcoming } = await import("../lib/platform/portal-model");
  const d = {
    ...data,
    class_sessions: [
      ...data.class_sessions,
      {
        id: "unbooked",
        class_id: "c",
        starts_at: "2026-09-21T10:00:00Z",
        ends_at: "2026-09-21T11:00:00Z",
        status: "scheduled",
      },
    ],
  };
  assert.deepEqual(
    familyUpcoming(d, now).map((s) => s.id),
    ["s"],
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { coachAttendanceSchema } from "../lib/platform/coach-attendance";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AcademyPanel } from "../components/platform/academy-panel";
import type { AccountContext } from "../lib/platform/contracts";
const sid = "91000000-0000-4000-8000-000000000001";
const rid = "92000000-0000-4000-8000-000000000001";
const payload = (entries: unknown[]) => ({
  action: "coach_attendance.finalize",
  data: { session_id: sid, entries },
});
test("coach attendance accepts a complete bounded mark list", () => {
  for (const attendance of ["present", "absent", "late", "excused"])
    assert.equal(
      coachAttendanceSchema.safeParse(payload([{ id: rid, attendance }]))
        .success,
      true,
    );
  assert.equal(coachAttendanceSchema.safeParse(payload([])).success, true);
});
test("duplicate, malformed and oversized roster entries are rejected", () => {
  const row = { id: rid, attendance: "present" };
  for (const entries of [
    [row, row],
    [{ ...row, attendance: "unmarked" }],
    [{ attendance: "present" }],
    [{ ...row, child_id: sid }],
    Array.from({ length: 101 }, () => row),
  ])
    assert.equal(
      coachAttendanceSchema.safeParse(payload(entries)).success,
      false,
    );
});
test("coach attendance cannot smuggle actor or delivery claims", () => {
  const value = payload([{ id: rid, attendance: "present" }]);
  assert.equal(
    coachAttendanceSchema.safeParse({
      ...value,
      data: { ...value.data, finalized_by: sid },
    }).success,
    false,
  );
  assert.equal(
    coachAttendanceSchema.safeParse({ ...value, action: "attendance.finalize" })
      .success,
    false,
  );
});

test("Coach directory exposes attendance entry without treating cached grants as write authorization", () => {
  const account: AccountContext = {
    userId: "coach-test",
    name: "Coach",
    active: true,
    roles: ["coach"],
    branchIds: ["branch-test"],
    aal: "aal1",
  };
  const session = {
    id: sid,
    branch_id: "branch-test",
    status: "scheduled",
    starts_at: "2026-01-01T08:00:00Z",
    ends_at: "2026-01-01T09:00:00Z",
    name: "Assigned class",
    can_coach: true,
    students: [],
  };
  const grant = {
    user_id: account.userId,
    permission: "attendance.finalize",
    branch_id: "branch-test",
  };
  const scopedRoster = {
    id: sid,
    roster: [{ id: rid, name: "Unlinked trial athlete", kind: "trial" }],
  };
  const render = (
    permission = true,
    assignment = true,
    completeRoster = true,
  ) =>
    renderToStaticMarkup(
      createElement(AcademyPanel, {
        account,
        section: "Assigned sessions",
        refresh: () => {},
        data: {
          development_sessions: [{ ...session, can_coach: assignment }],
          product_permissions: permission ? [grant] : [],
          coach_attendance_sessions: completeRoster ? [scopedRoster] : [],
        },
      }),
    );
  for (const args of [
    [false, true, true],
    [true, false, true],
    [true, true, false],
  ])
    assert.doesNotMatch(
      render(...(args as [boolean, boolean, boolean])),
      /Finalize Attendance/,
    );
  assert.match(render(), /Take attendance/);
  assert.doesNotMatch(render(), /Unlinked trial athlete/);
  assert.doesNotMatch(render(), /Finish attendance/);
});

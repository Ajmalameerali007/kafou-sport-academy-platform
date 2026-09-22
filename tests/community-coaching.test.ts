import test from "node:test";
import assert from "node:assert/strict";
import { recognitionChildren } from "../lib/platform/community-model";

test("coach recognition uses only current assigned safe student projections", () => {
  const data = {
    children: [
      {
        id: "sibling",
        name: "Raw unrelated child",
        family_id: "private-family",
      },
    ],
    development_sessions: [
      {
        can_coach: true,
        status: "scheduled",
        students: [
          { id: "athlete", name: "Assigned athlete", roster_id: "safe-roster" },
        ],
      },
      {
        can_coach: true,
        status: "completed",
        students: [{ id: "athlete", name: "Assigned athlete" }],
      },
      {
        can_coach: false,
        status: "scheduled",
        students: [{ id: "reader", name: "Review-only athlete" }],
      },
      {
        can_coach: true,
        status: "cancelled",
        students: [{ id: "cancelled", name: "Cancelled athlete" }],
      },
    ],
  };
  assert.deepEqual(recognitionChildren(data, false), [
    { id: "athlete", name: "Assigned athlete" },
  ]);
  assert.equal(recognitionChildren(data, true).length, 2);
});
test("revoked assignments leave no selectable coach child and no raw-row fallback", () => {
  assert.deepEqual(
    recognitionChildren(
      {
        children: [{ id: "x", name: "Raw child" }],
        development_sessions: [
          { can_coach: false, students: [{ id: "x", name: "Old assignment" }] },
        ],
      },
      false,
    ),
    [],
  );
});

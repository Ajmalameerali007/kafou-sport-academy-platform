import { test } from "node:test";
import assert from "node:assert/strict";
import { childJourney, scopeProduct } from "../lib/platform/product-model";
test("child context includes only that child while retaining valid makeup and trial schedule", () => {
  const data = {
    children: [{ id: "a" }, { id: "b" }],
    enrollments: [{ id: "e", child_id: "a" }],
    trial_enquiries: [{ id: "q", child_id: "a" }],
    trial_bookings: [{ id: "t", enquiry_id: "q" }],
    session_roster: [
      { id: "r", session_id: "s", enrollment_id: "e", kind: "makeup" },
      { id: "r2", session_id: "s2", trial_booking_id: "t" },
      { id: "other", session_id: "s3" },
    ],
    class_sessions: [{ id: "s" }, { id: "s2" }, { id: "s3" }],
    development_assessments: [{ child_id: "a" }, { child_id: "b" }],
    development_safety_children: [
      { id: "a", name: "Athlete A" },
      { id: "b", name: "Athlete B" },
    ],
  };
  const scoped = childJourney(data, "a");
  assert.deepEqual(
    scoped.class_sessions.map((x) => x.id),
    ["s", "s2"],
  );
  assert.equal(scoped.children.length, 1);
  assert.equal(scoped.development_assessments.length, 1);
  assert.deepEqual(scoped.development_safety_children, [
    { id: "a", name: "Athlete A" },
  ]);
  assert.equal(data.children.length, 2);
});
test("branch filters do not manufacture permission or discard shared source catalogs", () => {
  assert.deepEqual(
    scopeProduct(
      {
        families: [{ id: "f" }],
        commercial_memberships: [{ branch_id: "a" }, { branch_id: "b" }],
      },
      "a",
    ),
    { families: [{ id: "f" }], commercial_memberships: [{ branch_id: "a" }] },
  );
});
test("non-record response metadata cannot crash child or branch projections", () => {
  const data = {
    account: { roles: ["parent"] },
    children: [{ id: "a" }],
  } as unknown as Parameters<typeof childJourney>[0];
  assert.doesNotThrow(() => childJourney(data, "a"));
  assert.doesNotThrow(() => scopeProduct(data, "b"));
});

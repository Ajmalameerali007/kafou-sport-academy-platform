import test from "node:test";
import assert from "node:assert/strict";
import { arrivalDecision } from "../lib/platform/student-arrival";

test("saved Present without an arrival can still be checked in; exceptions need review", () => {
  assert.equal(arrivalDecision("present", null, true).canCheckIn, true);
  for (const mark of ["late", "absent", "excused"])
    assert.equal(arrivalDecision(mark, null, true).canCheckIn, false);
  assert.equal(arrivalDecision("", null, false).canCheckIn, false);
});
test("finalization attestation is never presented as a timed check-in", () => {
  assert.equal(
    arrivalDecision("present", { source: "finalization" }, false).label,
    "Attendance confirmed",
  );
  assert.equal(
    arrivalDecision("present", { source: "check_in" }, true).label,
    "Checked in",
  );
  assert.equal(
    arrivalDecision("present", { source: "check_in" }, true).canCheckIn,
    false,
  );
});

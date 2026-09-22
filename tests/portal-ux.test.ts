import { test } from "node:test";
import assert from "node:assert/strict";
import {
  navigationGroups,
  overviewTitle,
  primaryTask,
} from "../lib/platform/portal-ux";

test("grouped navigation preserves every authorized destination exactly once", () => {
  const tabs = [
    "Overview",
    "Families",
    "Students",
    "Attendance",
    "Finance",
    "Support",
    "Audit",
    "Security",
  ];
  const groups = navigationGroups(tabs);
  const flattened = groups.flatMap((group) => group.tabs);
  assert.deepEqual(flattened.toSorted(), tabs.toSorted());
  assert.equal(new Set(flattened).size, tabs.length);
  assert.deepEqual(
    groups.map((group) => group.label),
    ["Today", "People", "Programmes", "Accounts", "Communication", "Settings"],
  );
});

test("role homes and primary actions describe the actual next task", () => {
  assert.equal(overviewTitle("parent"), "Parent Home");
  assert.equal(overviewTitle("coach"), "Coach Today");
  assert.deepEqual(primaryTask("parent"), {
    section: "Family",
    label: "Manage family",
  });
  assert.deepEqual(primaryTask("coach"), {
    section: "Assigned sessions",
    label: "Open next roster",
  });
  assert.deepEqual(primaryTask("branch"), {
    section: "Student check-in",
    label: "Open student check-in",
  });
});

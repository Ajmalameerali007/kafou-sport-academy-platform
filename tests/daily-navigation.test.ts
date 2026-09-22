import test from "node:test";
import assert from "node:assert/strict";
import {
  navigationGroups,
  operationalNavigation,
} from "../lib/platform/portal-ux";
test("attendance and check-in stay reachable for central, branch and coach users", () => {
  const tabs = [
    "Overview",
    "Student check-in",
    "Attendance",
    "Staff attendance",
  ];
  for (const [role, branch] of [
    ["admin", false],
    ["admin", true],
    ["branch", true],
    ["coach", false],
  ] as const) {
    const destinations = operationalNavigation(role, branch, tabs).flatMap(
      (g) => g.tabs,
    );
    for (const tab of tabs)
      assert.equal(
        destinations.filter((t) => t === tab).length,
        1,
        `${role}: ${tab}`,
      );
  }
  assert.equal(
    operationalNavigation("coach", false, ["Overview"])
      .flatMap((g) => g.tabs)
      .includes("Staff attendance"),
    false,
  );
});
test("central management groups programmes and accounts by task", () => {
  const groups = navigationGroups([
    "Overview",
    "Branches",
    "Team",
    "Coaches",
    "Packages",
    "Finance",
    "Business Reports",
    "Security",
  ]);
  assert.equal(
    groups.find((g) => g.tabs.includes("Packages"))?.label,
    "Programmes",
  );
  assert.equal(
    groups.find((g) => g.tabs.includes("Finance"))?.label,
    "Accounts",
  );
  assert.equal(groups.find((g) => g.tabs.includes("Team"))?.label, "People");
});

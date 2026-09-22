import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authService,
  locationService,
  trialService,
  roleDestination,
} from "../lib/kafou/services";
import {
  validateAuth,
  validateTrialStep,
  validateQuickTrialStep,
} from "../lib/kafou/validation";
const parent = {
  name: "Test Parent",
  mobile: "+971501234567",
  email: "parent@example.test",
  password: "LongTestPass12",
  confirmPassword: "LongTestPass12",
};
test("unconnected services never report account, reset or booking success", async () => {
  for (const result of [
    await authService.login({
      identifier: parent.email,
      password: parent.password,
      remember: false,
    }),
    await authService.signup(parent),
    await authService.forgotPassword(parent.email),
    await authService.resetPassword("token", parent.password),
    await trialService.submit({
      parentName: parent.name,
      mobile: parent.mobile,
      email: parent.email,
      childName: "Test Child",
      dob: "2018-01-01",
      sport: "football",
      locationId: null,
      experience: "beginner",
    }),
  ])
    assert.equal(result.ok, false);
  assert.deepEqual(await locationService.list(), []);
});
test("role routes only accept recognized server roles", () => {
  assert.equal(roleDestination("parent"), "/parent");
  assert.equal(roleDestination("coach"), "/coach");
  assert.equal(roleDestination("super_admin"), "/admin");
  assert.equal(roleDestination("reception"), "/branch");
  assert.equal(roleDestination("unknown"), null);
});
test("signup validates matching passwords, mobile and email", () => {
  assert.deepEqual(validateAuth("signup", parent), {});
  assert.ok(
    validateAuth("signup", { ...parent, confirmPassword: "different" })
      .confirmPassword,
  );
  assert.ok(validateAuth("signup", { ...parent, mobile: "1" }).mobile);
  assert.ok(validateAuth("signup", { ...parent, email: "bad" }).email);
  assert.ok(
    validateAuth("login", { identifier: "bad", password: "x" }).identifier,
  );
});
test("trial requires child data and supported sport; permits unresolved location", () => {
  assert.ok(validateTrialStep(1, { childName: "A", dob: "2099-01-01" }).dob);
  assert.ok(validateTrialStep(2, { sport: "tennis" }).sport);
  assert.deepEqual(validateTrialStep(3, { locationId: null }, []), {});
  assert.ok(validateTrialStep(3, { locationId: "invented" }, []).locationId);
  assert.deepEqual(
    validateTrialStep(1, { childName: "Test Child", dob: "2018-01-01" }),
    {},
  );
});

test("short enquiry validates real essentials without requiring email or exact DOB", () => {
  const family = {
    parentName: "Test Parent",
    mobile: "+971501234567",
    childName: "Test Child",
    age: "9",
    email: "",
  };
  assert.deepEqual(validateQuickTrialStep(1, family), {});
  assert.ok(validateQuickTrialStep(1, { ...family, age: "0" }).age);
  assert.ok(validateQuickTrialStep(1, { ...family, age: "18" }).age);
  assert.ok(validateQuickTrialStep(1, { ...family, email: "bad" }).email);
  assert.ok(validateQuickTrialStep(0, { sport: "tennis" }).sport);
  assert.ok(
    validateQuickTrialStep(0, { sport: "karate", preferredBranch: "invalid branch spaces" })
      .preferredBranch,
  );
  assert.deepEqual(
    validateQuickTrialStep(0, { sport: "karate", preferredBranch: "dxb-2" }),
    {},
  );
});

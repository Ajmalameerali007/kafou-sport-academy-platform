import { test } from "node:test";
import assert from "node:assert/strict";
import { isLocalDemoRuntime } from "../lib/platform/local-demo";
import {
  administratorVerified,
  mayCommand,
  type AccountContext,
} from "../lib/platform/contracts";

test("MFA demo exemption is accepted only with the exact local database and loopback HTTP app", () => {
  assert.equal(
    isLocalDemoRuntime("http://127.0.0.1:56321", "http://127.0.0.1:3101"),
    true,
  );
  for (const [db, app] of [
    ["https://project.supabase.co", "http://localhost:3101"],
    ["http://127.0.0.1:56321", "https://academy.example.com"],
    ["http://127.0.0.1:56321", "http://localhost.attacker.test"],
    ["http://127.0.0.1:56321", "https://localhost:3101"],
    ["http://127.0.0.1:56322", "http://localhost:3101"],
    [undefined, undefined],
  ])
    assert.equal(isLocalDemoRuntime(db, app), false);
});

test("local exemption retains real authentication level, activity and owner role requirements", () => {
  const owner: AccountContext = {
    userId: "demo",
    name: "Demo",
    roles: ["super_admin"],
    branchIds: [],
    active: true,
    aal: "aal1",
  };
  assert.equal(administratorVerified(owner), false);
  assert.equal(mayCommand(owner, "staff.access"), false);
  const demo = { ...owner, localDemoMfaExempt: true };
  assert.equal(mayCommand(demo, "staff.access"), true);
  assert.equal(demo.aal, "aal1");
  assert.equal(mayCommand({ ...demo, active: false }, "staff.access"), false);
  assert.equal(
    mayCommand({ ...demo, roles: ["parent"] }, "staff.access"),
    false,
  );
  assert.equal(mayCommand({ ...owner, aal: "aal2" }, "staff.access"), true);
});

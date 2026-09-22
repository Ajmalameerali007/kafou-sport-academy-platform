import test from "node:test";
import assert from "node:assert/strict";
import {
  commercialSchema,
  allocationRemaining,
  membershipStatus,
} from "../lib/platform/commercial";
const id = "71000000-0000-4000-8000-000000000001";
const parse = (action: string, data: unknown) =>
  commercialSchema.safeParse({ action, data });
test("cancellation requires an explicit synthetic policy and persisted preview confirmation", () => {
  for (const policy of ["none", "unused_calendar_days", "unused_entitlements"])
    assert.equal(
      parse("commercial.membership.cancel.preview", { id, policy }).success,
      true,
    );
  assert.equal(
    parse("commercial.membership.cancel.preview", { id }).success,
    false,
  );
  assert.equal(
    parse("commercial.membership.cancel", {
      preview_id: id,
      reason: "Reviewed synthetic cancellation",
    }).success,
    true,
  );
  assert.equal(
    parse("commercial.membership.cancel", {
      id,
      amount_minor: 999,
      reason: "Client invented credit",
    }).success,
    false,
  );
});
test("partial allocation reversals carry integer minor units", () => {
  const result = parse("commercial.payment.unallocate", {
    allocation_id: id,
    amount_minor: 105,
    reason: "Partial correction",
  });
  assert.equal(result.success, true);
  if (result.success)
    assert.equal(
      (result.data.data as Record<string, unknown>).amount_minor,
      105,
    );
  for (const amount_minor of [0, -1, 1.5])
    assert.equal(
      parse("commercial.payment.unallocate", {
        allocation_id: id,
        amount_minor,
        reason: "Partial correction",
      }).success,
      false,
    );
});
test("freeze extension is explicit and bounded", () => {
  const result = parse("commercial.membership.freeze", {
    id,
    frozen: false,
    extend_days: 3,
    reason: "Reviewed elapsed freeze",
  });
  assert.equal(result.success, true);
  if (result.success)
    assert.equal((result.data.data as Record<string, unknown>).extend_days, 3);
  for (const extend_days of [-1, 1.5, 367])
    assert.equal(
      parse("commercial.membership.freeze", {
        id,
        frozen: false,
        extend_days,
        reason: "Reviewed elapsed freeze",
      }).success,
      false,
    );
});
test("partial reversal selectors retain only the remaining amount and cancellation stays terminal", () => {
  const original = { id: "original", amount_minor: 12505 };
  assert.equal(
    allocationRemaining(original, [
      original,
      { reversal_of: "original", amount_minor: -5000 },
      { reversal_of: "original", amount_minor: -2000 },
      { reversal_of: "other", amount_minor: -999 },
    ]),
    5505,
  );
  assert.equal(
    membershipStatus(
      { status: "cancelled", expires_on: "2020-01-01" },
      0,
      [],
      "2026-09-20",
    ),
    "cancelled",
  );
});

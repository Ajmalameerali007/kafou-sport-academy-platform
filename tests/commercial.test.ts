import test from "node:test";
import assert from "node:assert/strict";
import {
  commercialSchema,
  invoiceBalance,
  entitlementBalance,
  money,
  membershipStatus,
} from "../lib/platform/commercial";
const id = "10000000-0000-4000-8000-000000000001";
test("offline money rejects fractional, negative and imprecise minor units", () => {
  for (const amount_minor of [
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    "0.01",
  ]) {
    assert.equal(
      commercialSchema.safeParse({
        action: "commercial.payment.record",
        data: {
          family_id: id,
          branch_id: id,
          amount_minor,
          method: "cash",
          reference: "cash-001",
        },
      }).success,
      false,
    );
  }
  assert.equal(
    commercialSchema.safeParse({
      action: "commercial.payment.record",
      data: {
        family_id: id,
        branch_id: id,
        amount_minor: "12505",
        method: "bank_transfer",
        reference: "bank-001",
      },
    }).success,
    true,
  );
});
test("membership requires explicit terms acceptance and a real calendar date", () => {
  const base = {
    child_id: id,
    package_id: id,
    starts_on: "2026-02-28",
    accepted: true,
  };
  assert.equal(
    commercialSchema.safeParse({
      action: "commercial.membership.start",
      data: base,
    }).success,
    true,
  );
  for (const changed of [{ accepted: false }, { starts_on: "2026-02-30" }])
    assert.equal(
      commercialSchema.safeParse({
        action: "commercial.membership.start",
        data: { ...base, ...changed },
      }).success,
      false,
    );
});
test("adjustments need a reason, while provider settlement cannot be fabricated", () => {
  assert.equal(
    commercialSchema.safeParse({
      action: "commercial.invoice.adjust",
      data: {
        invoice_id: id,
        kind: "discount",
        amount_minor: 100,
        reason: "x",
      },
    }).success,
    false,
  );
  assert.equal(
    commercialSchema.safeParse({
      action: "commercial.payment.record",
      data: {
        family_id: id,
        branch_id: id,
        amount_minor: 100,
        method: "online",
        reference: "fake",
      },
    }).success,
    false,
  );
});
test("invoice balances include partial payments, reversed allocations and posted adjustments exactly", () => {
  assert.equal(
    invoiceBalance(
      "i",
      [{ invoice_id: "i", quantity: 2, unit_minor: 12505 }],
      [
        { invoice_id: "i", amount_minor: 5005 },
        { invoice_id: "i", amount_minor: -1000 },
      ],
      [{ invoice_id: "i", amount_minor: 505 }],
    ),
    20500,
  );
});
test("ledger reconciles grants, reservations, consumption and reversals without editing history", () => {
  assert.deepEqual(
    entitlementBalance("m", [
      {
        membership_id: "m",
        available_delta: 8,
        reserved_delta: 0,
        consumed_delta: 0,
      },
      {
        membership_id: "m",
        available_delta: -1,
        reserved_delta: 1,
        consumed_delta: 0,
      },
      {
        membership_id: "m",
        available_delta: 0,
        reserved_delta: -1,
        consumed_delta: 1,
      },
      {
        membership_id: "m",
        available_delta: 1,
        reserved_delta: 0,
        consumed_delta: -1,
      },
      {
        membership_id: "elsewhere",
        available_delta: 99,
        reserved_delta: 0,
        consumed_delta: 0,
      },
    ]),
    { available: 8, reserved: 0, consumed: 0 },
  );
  assert.equal(money(12505, "en"), "AED 125.05");
});

test("expired credit cannot display an unpaid membership as active", () => {
  const member = { status: "active", expires_on: "2026-10-01" };
  assert.equal(
    membershipStatus(
      member,
      5000,
      [{ amount_minor: 5000, expires_on: "2026-09-19", revoked_at: null }],
      "2026-09-20",
    ),
    "suspended",
  );
  assert.equal(
    membershipStatus(
      member,
      5000,
      [{ amount_minor: 5000, expires_on: "2026-09-20", revoked_at: null }],
      "2026-09-20",
    ),
    "active",
  );
  assert.equal(membershipStatus(member, 0, [], "2026-10-01"), "Expired");
});

test("compensation settlement and reversal require durable references and reasons", () => {
  for (const action of [
    "commercial.compensation.settle",
    "commercial.compensation.reverse",
  ]) {
    assert.equal(
      commercialSchema.safeParse({
        action,
        data: {
          id,
          reference: "SYNTHETIC-PAY-001",
          reason: "Confirmed offline payment record",
        },
      }).success,
      true,
    );
    assert.equal(
      commercialSchema.safeParse({
        action,
        data: { id, reference: "", reason: "x" },
      }).success,
      false,
    );
    assert.equal(
      commercialSchema.safeParse({
        action,
        data: {
          id: "forged",
          reference: "SYNTHETIC-PAY-001",
          reason: "Confirmed offline payment record",
        },
      }).success,
      false,
    );
  }
});

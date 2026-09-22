import test from "node:test";
import assert from "node:assert/strict";
import { commercialSchema } from "../lib/platform/commercial";
const family = "a1000000-0000-4000-8000-000000000001";
const child = "a2000000-0000-4000-8000-000000000001";
const otherChild = "a2000000-0000-4000-8000-000000000002";
const pkg = "a3000000-0000-4000-8000-000000000001";
const base = {
  family_id: family,
  branch_id: family,
  reference: "SYNTHETIC-INVOICE-001",
  lines: [
    { child_id: child, package_id: pkg, quantity: 2 },
    { child_id: otherChild, package_id: pkg, quantity: 1 },
  ],
};
const valid = (data: unknown) =>
  commercialSchema.safeParse({ action: "commercial.invoice.create", data })
    .success;
test("standalone invoices accept multiple child/package lines without payment or entitlement fields", () => {
  assert.equal(valid(base), true);
  assert.equal(valid({ ...base, lines: [base.lines[0]] }), true);
});
test("invoice authors cannot override catalogue price, description or grant memberships", () => {
  for (const injected of [
    { unit_minor: 1 },
    { description: "Lower price" },
    { membership_id: family },
  ])
    assert.equal(
      valid({ ...base, lines: [{ ...base.lines[0], ...injected }] }),
      false,
    );
  assert.equal(valid({ ...base, membership_id: family }), false);
});
test("invoice batches and references are bounded and duplicate child/package lines are rejected", () => {
  for (const lines of [
    [],
    Array.from({ length: 21 }, () => base.lines[0]),
    [base.lines[0], base.lines[0]],
    [{ ...base.lines[0], quantity: 0 }],
    [{ ...base.lines[0], quantity: 1.5 }],
    [{ ...base.lines[0], quantity: 101 }],
  ])
    assert.equal(valid({ ...base, lines }), false);
  assert.equal(valid({ ...base, reference: "" }), false);
});

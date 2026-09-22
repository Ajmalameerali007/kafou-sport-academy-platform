import test from "node:test";
import assert from "node:assert/strict";
import {
  engagementSchema,
  rewardBalance,
  describeChallengeRule,
} from "../lib/platform/engagement";
const id = "10000000-0000-4000-8000-000000000001";
test("challenge rules reject invented percentages, invalid windows and fractional attendance", () => {
  const data = {
    branch_id: id,
    sport: "swimming",
    title: "Steady swimmer",
    description: "Attend four sessions",
    starts_at: "2026-09-01T00:00:00Z",
    ends_at: "2026-10-01T00:00:00Z",
    reward_policy_id: id,
    rule: { kind: "attendance", count: 4 },
  };
  assert.equal(
    engagementSchema.safeParse({ action: "engagement.challenge.create", data })
      .success,
    true,
  );
  for (const patch of [
    { ends_at: "2026-08-01T00:00:00Z" },
    { rule: { kind: "attendance", count: 1.5 } },
    { rule: { kind: "percentage", target: 70 } },
  ])
    assert.equal(
      engagementSchema.safeParse({
        action: "engagement.challenge.create",
        data: { ...data, ...patch },
      }).success,
      false,
    );
});
test("reward rules allow only non-cash fixed units and immutable source type", () => {
  const data = {
    branch_id: id,
    code: "steady_swimmer",
    title: "Steady swimmer badge",
    description: "One badge after reviewed completion",
    source_kind: "challenge",
    unit: "badge",
    quantity: 1,
  };
  assert.equal(
    engagementSchema.safeParse({
      action: "engagement.reward_rule.create",
      data,
    }).success,
    true,
  );
  assert.equal(
    engagementSchema.safeParse({
      action: "engagement.reward_rule.create",
      data: { ...data, cash_minor: 10000 },
    }).success,
    false,
  );
  assert.equal(
    engagementSchema.safeParse({
      action: "engagement.reward_rule.create",
      data: { ...data, quantity: 0 },
    }).success,
    false,
  );
});
test("referral redemption accepts only opaque academy code and owned family context", () => {
  assert.equal(
    engagementSchema.safeParse({
      action: "engagement.referral.redeem",
      data: { family_id: id, code: "KRF-A1B2C3D4E5F6" },
    }).success,
    true,
  );
  assert.equal(
    engagementSchema.safeParse({
      action: "engagement.referral.redeem",
      data: { family_id: id, code: "KRF-A1B2C3D4E5F6", qualified: true },
    }).success,
    false,
  );
});
test("reward balances group noncash units and retain reversal effects", () => {
  const rows = [
    { policy_id: "badge-v1", unit: "badge", delta: 1 },
    { policy_id: "points-v1", unit: "star", delta: 10 },
    { policy_id: "points-v1", unit: "star", delta: -10 },
  ];
  assert.deepEqual(rewardBalance(rows), [
    { policy_id: "badge-v1", unit: "badge", balance: 1 },
    { policy_id: "points-v1", unit: "star", balance: 0 },
  ]);
  assert.equal(
    describeChallengeRule({ kind: "attendance", count: 4 }),
    "Attend 4 sessions (present or late).",
  );
});

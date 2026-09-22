import assert from "node:assert/strict";
import test from "node:test";
import { developmentSchema } from "../lib/platform/development";
import {
  targetBaselineChoices,
  targetCompletionResults,
} from "../lib/platform/development-targets";
const id = "e1000000-0000-4000-8000-000000000001";
test("target commands reject forged state, malformed dates and nonnumeric goals", () => {
  const payload = {
    action: "development.target.save",
    data: {
      session_id: id,
      baseline_result_id: id,
      title: "Swim the next distance",
      target_value: 50,
      due_on: "2026-10-20",
    },
  };
  assert.equal(developmentSchema.safeParse(payload).success, true);
  for (const patch of [
    { status: "completed" },
    { target_value: "50" },
    { target_value: Infinity },
    { due_on: "2026-02-30" },
    { title: "ab" },
  ])
    assert.equal(
      developmentSchema.safeParse({
        ...payload,
        data: { ...payload.data, ...patch },
      }).success,
      false,
    );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.target.completion.submit",
      data: { id, result_id: id },
    }).success,
    true,
  );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.target.withdraw",
      data: { id, reason: "" },
    }).success,
    false,
  );
});
test("completion choices require later compatible published measurements reaching the goal", () => {
  const baseline = {
    id: "base",
    child_id: "child",
    criteria_id: "v1",
    metric_key: "distance",
    unit: "m",
    direction: "higher",
    value: 20,
    measured_at: "2026-09-01",
    assessment_id: "a1",
  };
  const proof = {
    ...baseline,
    id: "proof",
    value: 50,
    measured_at: "2026-09-20",
    assessment_id: "a2",
  };
  const target = {
    ...baseline,
    baseline_result_id: "base",
    target_value: 50,
    published_at: "2026-09-10",
  };
  const data = {
    development_results: [
      baseline,
      proof,
      { ...proof, id: "other", child_id: "other" },
      { ...proof, id: "version", criteria_id: "v2" },
      { ...proof, id: "short", value: 49 },
      { ...proof, id: "old", measured_at: "2026-08-20" },
      { ...proof, id: "unpublished", assessment_id: "draft" },
    ],
    development_assessments: [
      { id: "a1", status: "published", published_at: "2026-09-01" },
      { id: "a2", status: "published", published_at: "2026-09-20" },
      { id: "draft", status: "draft" },
    ],
  };
  assert.deepEqual(
    targetCompletionResults(target, data).map((row) => row.id),
    ["proof"],
  );
  assert.equal(
    targetCompletionResults({ ...target, published_at: "2026-09-21" }, data)
      .length,
    0,
  );
  const lowerData = {
    ...data,
    development_results: [
      { ...baseline, direction: "lower", value: 60 },
      { ...proof, direction: "lower", value: 50 },
    ],
  };
  assert.equal(
    targetCompletionResults({ ...target, direction: "lower" }, lowerData)
      .length,
    1,
  );
});
test("target baseline picker uses actual assigned athlete roster and published evidence", () => {
  const result = {
    id: "base",
    child_id: "child",
    sport: "swimming",
    assessment_id: "a1",
  };
  const session = {
    id: "session",
    can_coach: true,
    status: "scheduled",
    sport: "swimming",
    students: [{ id: "child", name: "Synthetic Athlete" }],
  };
  const data = {
    development_sessions: [session],
    development_results: [
      result,
      { ...result, id: "sibling", child_id: "sibling" },
    ],
    development_assessments: [{ id: "a1", status: "published" }],
  };
  assert.equal(targetBaselineChoices(data).length, 1);
  assert.equal(
    targetBaselineChoices({
      ...data,
      development_sessions: [{ ...session, can_coach: false }],
    }).length,
    0,
  );
  assert.equal(
    targetBaselineChoices({
      ...data,
      development_sessions: [{ ...session, status: "cancelled" }],
    }).length,
    0,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { eventRegistrationSchema } from "../lib/platform/events";
const id = "11111111-1111-4111-8111-111111111111";
const child = "22222222-2222-4222-8222-222222222222";
const valid = {
  event_id: id,
  family_id: id,
  children: [{ child_id: child, document_id: id, accepted: true }],
};
test("event registration requires explicit per-child versioned acceptance", () => {
  assert.equal(eventRegistrationSchema.safeParse(valid).success, true);
  for (const children of [
    [],
    [{ child_id: child, document_id: id, accepted: false }],
    [{ child_id: child, accepted: true }],
    Array(9).fill(valid.children[0]),
    [valid.children[0], valid.children[0]],
  ])
    assert.equal(
      eventRegistrationSchema.safeParse({ ...valid, children }).success,
      false,
    );
});
test("event registration rejects hidden payment and foreign fields", () => {
  assert.equal(
    eventRegistrationSchema.safeParse({ ...valid, amount: 99 }).success,
    false,
  );
  assert.equal(
    eventRegistrationSchema.safeParse({
      ...valid,
      children: [{ ...valid.children[0], guardian_id: id }],
    }).success,
    false,
  );
});

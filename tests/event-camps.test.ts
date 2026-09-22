import test from "node:test";
import { z } from "zod";
import assert from "node:assert/strict";
import {
  campCreateSchema,
  eventAttendanceSchema,
  eventCommands,
} from "../lib/platform/events";
const id = "fb100000-0000-4000-8000-000000000001";
const camp = {
  branch_id: id,
  sport: "swimming",
  level_id: id,
  age_group_id: id,
  document_id: id,
  title: "Synthetic camp",
  capacity: 10,
  policy_acknowledged: true,
  occurrences: [
    {
      venue_id: id,
      coach_id: id,
      starts_at: "2026-10-01T08:00:00+04:00",
      ends_at: "2026-10-01T10:00:00+04:00",
    },
    {
      venue_id: id,
      coach_id: id,
      starts_at: "2026-10-02T08:00:00+04:00",
      ends_at: "2026-10-02T10:00:00+04:00",
    },
  ],
};
test("camp timeline requires explicitly acknowledged bounded non-overlapping dated occurrences", () => {
  assert.equal(campCreateSchema.safeParse(camp).success, true);
  for (const patch of [
    { policy_acknowledged: false },
    { occurrences: camp.occurrences.slice(0, 1) },
    { occurrences: Array(31).fill(camp.occurrences[0]) },
    { occurrences: [camp.occurrences[0], camp.occurrences[0]] },
    {
      occurrences: [
        camp.occurrences[0],
        {
          ...camp.occurrences[1],
          starts_at: "2027-02-01T08:00:00+04:00",
          ends_at: "2027-02-01T10:00:00+04:00",
        },
      ],
    },
    {
      occurrences: [
        { ...camp.occurrences[0], ends_at: "2026-10-01T23:00:00+04:00" },
        camp.occurrences[1],
      ],
    },
    { price_minor: 100 },
  ])
    assert.equal(
      campCreateSchema.safeParse({ ...camp, ...patch }).success,
      false,
    );
});
test("event attendance requires explicit unique registration rows and disallows actor/child injection", () => {
  const data = {
    occurrence_id: id,
    entries: [{ registration_id: id, attendance: "present" }],
  };
  assert.equal(eventAttendanceSchema.safeParse(data).success, true);
  for (const entries of [
    [],
    [...data.entries, ...data.entries],
    [{ ...data.entries[0], attendance: "unknown" }],
    [{ ...data.entries[0], child_id: id }],
  ])
    assert.equal(
      eventAttendanceSchema.safeParse({ ...data, entries }).success,
      false,
    );
  assert.equal(
    eventAttendanceSchema.safeParse({ ...data, recorded_by: id }).success,
    false,
  );
});

test("camp dates use Dubai-day boundaries and accept adjacent slots", () => {
  assert.equal(
    campCreateSchema.safeParse({
      ...camp,
      occurrences: [
        {
          ...camp.occurrences[0],
          starts_at: "2026-10-01T18:00:00Z",
          ends_at: "2026-10-01T21:00:00Z",
        },
        camp.occurrences[1],
      ],
    }).success,
    false,
  );
  assert.equal(
    campCreateSchema.safeParse({
      ...camp,
      occurrences: [
        camp.occurrences[0],
        {
          ...camp.occurrences[0],
          starts_at: "2026-10-01T10:00:00+04:00",
          ends_at: "2026-10-01T12:00:00+04:00",
        },
      ],
    }).success,
    true,
  );
  assert.equal(
    campCreateSchema.safeParse({
      ...camp,
      occurrences: [
        { ...camp.occurrences[0], starts_at: "invalid" },
        camp.occurrences[1],
      ],
    }).success,
    false,
  );
});

test("camp lifecycle commands reject actor injection and require attributable correction reasons", () => {
  const commands = z.discriminatedUnion("action", eventCommands);
  assert.equal(
    commands.safeParse({
      action: "events.attendance.finalize",
      data: { occurrence_id: id },
    }).success,
    true,
  );
  assert.equal(
    commands.safeParse({
      action: "events.attendance.finalize",
      data: { occurrence_id: id, finalized_by: id },
    }).success,
    false,
  );
  assert.equal(
    commands.safeParse({
      action: "events.attendance.correct",
      data: { id, attendance: "late", reason: "Observed delayed arrival" },
    }).success,
    true,
  );
  assert.equal(
    commands.safeParse({
      action: "events.attendance.correct",
      data: { id, attendance: "late", reason: " " },
    }).success,
    false,
  );
  assert.equal(
    commands.safeParse({
      action: "events.occurrence.cancel",
      data: { occurrence_id: id, reason: "Synthetic fixture closure" },
    }).success,
    true,
  );
  assert.equal(
    commands.safeParse({
      action: "events.occurrence.cancel",
      data: { occurrence_id: id },
    }).success,
    false,
  );
});

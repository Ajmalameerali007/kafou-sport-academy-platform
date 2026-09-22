import test from "node:test";
import assert from "node:assert/strict";
import { developmentSchema, personalBests } from "../lib/platform/development";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { certificatePdf } from "../lib/platform/certificate-pdf";
const id = "10000000-0000-4000-8000-000000000001";
test("criteria definitions require unique keys and ordered ranges", () => {
  const valid = {
    action: "development.criteria.create",
    data: {
      sport: "swimming",
      level_id: id,
      title: "Water confidence",
      criteria: [
        {
          key: "distance",
          label: "Distance",
          unit: "m",
          min: 0,
          max: 100,
          direction: "higher",
        },
      ],
    },
  };
  assert.equal(developmentSchema.safeParse(valid).success, true);
  assert.equal(
    developmentSchema.safeParse({
      ...valid,
      data: {
        ...valid.data,
        criteria: [...valid.data.criteria, ...valid.data.criteria],
      },
    }).success,
    false,
  );
  assert.equal(
    developmentSchema.safeParse({
      ...valid,
      data: {
        ...valid.data,
        criteria: [{ ...valid.data.criteria[0], max: -1 }],
      },
    }).success,
    false,
  );
});
test("assessment values cannot be coerced from empty input and cannot inject internal publish state", () => {
  const data = {
    session_id: id,
    child_id: id,
    criteria_id: id,
    scores: { distance: 10 },
    summary: "Good endurance",
    internal_note: "Coach-only observation",
  };
  assert.equal(
    developmentSchema.safeParse({ action: "development.assessment.save", data })
      .success,
    true,
  );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.assessment.save",
      data: { ...data, scores: { distance: "" } },
    }).success,
    false,
  );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.assessment.save",
      data: { ...data, status: "published" },
    }).success,
    false,
  );
});
test("report creation requires real bounded evidence and a calendar month", () => {
  const data = {
    session_id: id,
    child_id: id,
    month: "2026-09",
    summary: "Strong month",
    evidence_ids: [id],
  };
  assert.equal(
    developmentSchema.safeParse({ action: "development.report.create", data })
      .success,
    true,
  );
  for (const extra of [
    { month: "2026-19" },
    { evidence_ids: [] },
    { evidence_ids: [id, id] },
  ])
    assert.equal(
      developmentSchema.safeParse({
        action: "development.report.create",
        data: { ...data, ...extra },
      }).success,
      false,
    );
});
test("personal bests retain metric versions, units and direction", () => {
  const rows = [
    {
      id: "a",
      criteria_id: "v1",
      metric_key: "sprint",
      value: 20,
      unit: "s",
      direction: "lower",
    },
    {
      id: "b",
      criteria_id: "v1",
      metric_key: "sprint",
      value: 18,
      unit: "s",
      direction: "lower",
    },
    {
      id: "c",
      criteria_id: "v2",
      metric_key: "sprint",
      value: 30,
      unit: "m",
      direction: "higher",
    },
  ];
  assert.deepEqual(
    personalBests(rows).map((x) => x.id),
    ["b", "c"],
  );
});
test("certificate creates an actual landscape PDF with private issue metadata", async () => {
  const bytes = await certificatePdf({
    reference: "KAF-CERT-123",
    recipient_name: "A (B) \\ C",
    sport: "Swimming",
    level_name: "Level 1",
    title: "Progress award",
    issued_at: "2026-09-20T00:00:00Z",
  });
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  assert.deepEqual(doc.getPages()[0].getSize(), { width: 842, height: 595 });
  assert.match(doc.getSubject() ?? "", /KAF-CERT-123/);
  assert.ok(bytes.length > 1000);
});
test("Arabic certificate shapes connected glyphs and requires its licensed font", async () => {
  const certificate = {
    reference: "KAF-CERT-AR",
    recipient_name: "أَحْمَد محمد",
    sport: "Swimming",
    level_name: "Level 1",
    title: "Progress award",
    issued_at: "2026-09-20T00:00:00Z",
  };
  await assert.rejects(certificatePdf(certificate), /font/);
  const fontBytes = await readFile(
    new URL(
      "../public/fonts/noto-sans-arabic-certificate.ttf",
      import.meta.url,
    ),
  );
  const shaped = fontkit.create(fontBytes).layout(certificate.recipient_name);
  assert.equal(shaped.direction, "rtl");
  assert.ok(shaped.positions.some((p) => p.xOffset !== 0 || p.yOffset !== 0));
  assert.ok(shaped.glyphs.every((g) => g.id !== 0));
  const bytes = await certificatePdf(certificate, fontBytes);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  assert.equal(doc.getTitle(), "Progress award — أَحْمَد محمد");
  assert.ok(bytes.length > 2000);
});

test("certificate replacement and progression reversal require explicit evidence IDs and reasons", () => {
  assert.equal(
    developmentSchema.safeParse({
      action: "development.certificate.reissue",
      data: {
        id,
        title: "Corrected achievement",
        reason: "Correct approved award title",
      },
    }).success,
    true,
  );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.level.reverse",
      data: { id, reason: "Reviewed progression was premature" },
    }).success,
    true,
  );
  for (const action of [
    "development.certificate.reissue",
    "development.level.reverse",
  ])
    assert.equal(
      developmentSchema.safeParse({ action, data: { id, reason: "" } }).success,
      false,
    );
});
test("training guidance is bounded and cannot accept forged safety ownership", () => {
  assert.equal(
    developmentSchema.safeParse({
      action: "development.safety.save",
      data: {
        child_id: id,
        instructions: "Synthetic instruction: use the marked warm-up area.",
      },
    }).success,
    true,
  );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.safety.save",
      data: { child_id: id, instructions: "" },
    }).success,
    true,
  );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.safety.save",
      data: { child_id: id, instructions: "x".repeat(1001) },
    }).success,
    false,
  );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.safety.save",
      data: {
        child_id: id,
        instructions: "Bounded instructions",
        updated_by: id,
      },
    }).success,
    false,
  );
  const data = {
    session_id: id,
    child_id: id,
    criteria_id: id,
    scores: {},
    summary: "Practice progress",
    next_target: "Practice the reviewed 25 metre technique.",
  };
  assert.equal(
    developmentSchema.safeParse({ action: "development.assessment.save", data })
      .success,
    true,
  );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.assessment.save",
      data: { ...data, next_target: "x".repeat(1001) },
    }).success,
    false,
  );
});
test("coach emergency visibility needs an explicitly acknowledged bounded policy", () => {
  const data = {
    branch_id: id,
    enabled: true,
    minutes_before: 60,
    synthetic_acknowledged: true,
  };
  assert.equal(
    developmentSchema.safeParse({
      action: "development.emergency.policy",
      data,
    }).success,
    true,
  );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.emergency.policy",
      data: { ...data, synthetic_acknowledged: false },
    }).success,
    false,
  );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.emergency.policy",
      data: { ...data, minutes_before: 361 },
    }).success,
    false,
  );
  assert.equal(
    developmentSchema.safeParse({
      action: "development.emergency.policy",
      data: { ...data, minutes_before: -1 },
    }).success,
    false,
  );
});

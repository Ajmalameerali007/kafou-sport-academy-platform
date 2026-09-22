import { z } from "zod";
const id = z.string().uuid();
const short = z.string().trim().min(2).max(120);
const text = z.string().trim().min(3).max(3000);
const sport = z.enum(["swimming", "football", "karate", "badminton"]);
export const criterionSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    label: short,
    label_ar: z.string().max(120).default(""),
    unit: z.string().trim().min(1).max(20),
    min: z.number().finite().min(-1000000).max(1000000),
    max: z.number().finite().min(-1000000).max(1000000),
    direction: z.enum(["higher", "lower"]),
  })
  .strict()
  .refine((x) => x.max > x.min, "Maximum must be greater than minimum.");
export type DevelopmentCriterion = z.infer<typeof criterionSchema>;
const byId = z.object({ id }).strict();
const review = z
  .object({ id, decision: z.enum(["approved", "rejected"]), reason: text })
  .strict();
export const developmentSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("development.target.save"),
    data: z
      .object({
        id: id.optional(),
        session_id: id,
        baseline_result_id: id,
        title: z.string().trim().min(3).max(1000),
        target_value: z.number().finite().min(-1000000).max(1000000),
        due_on: z.string().date(),
      })
      .strict(),
  }),
  z.object({ action: z.literal("development.target.submit"), data: byId }),
  z.object({ action: z.literal("development.target.review"), data: review }),
  z.object({ action: z.literal("development.target.publish"), data: byId }),
  z.object({
    action: z.literal("development.target.completion.submit"),
    data: z.object({ id, result_id: id }).strict(),
  }),
  z.object({
    action: z.literal("development.target.completion.review"),
    data: review,
  }),
  z.object({
    action: z.literal("development.target.withdraw"),
    data: z.object({ id, reason: text }).strict(),
  }),
  z.object({
    action: z.literal("development.emergency.policy"),
    data: z
      .object({
        branch_id: id,
        enabled: z.boolean(),
        minutes_before: z.number().int().min(0).max(360),
        synthetic_acknowledged: z.literal(true),
      })
      .strict(),
  }),
  z.object({
    action: z.literal("development.safety.save"),
    data: z
      .object({
        child_id: id,
        instructions: z
          .string()
          .max(1000)
          .transform((value) => value.trim()),
      })
      .strict(),
  }),
  z.object({
    action: z.literal("development.certificate.reissue"),
    data: z.object({ id, title: short, reason: text }).strict(),
  }),
  z.object({
    action: z.literal("development.level.reverse"),
    data: z.object({ id, reason: text }).strict(),
  }),
  z.object({
    action: z.literal("development.criteria.create"),
    data: z
      .object({
        sport,
        level_id: id,
        title: short,
        criteria: z
          .array(criterionSchema)
          .min(1)
          .max(20)
          .refine(
            (v) => new Set(v.map((x) => x.key)).size === v.length,
            "Metric keys must be unique.",
          ),
      })
      .strict(),
  }),
  z.object({
    action: z.literal("development.plan.save"),
    data: z
      .object({
        session_id: id,
        objectives: text,
        activities: text,
        internal_note: z.string().max(3000).default(""),
      })
      .strict(),
  }),
  z.object({
    action: z.literal("development.assessment.save"),
    data: z
      .object({
        id: id.optional(),
        session_id: id,
        child_id: id,
        criteria_id: id,
        scores: z
          .record(
            z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
            z.number().finite(),
          )
          .refine((x) => Object.keys(x).length <= 20),
        summary: text,
        next_target: z
          .string()
          .max(1000)
          .transform((value) => value.trim())
          .default(""),
        internal_note: z.string().max(3000).default(""),
        recommended_level_id: id.optional(),
      })
      .strict(),
  }),
  z.object({ action: z.literal("development.assessment.submit"), data: byId }),
  z.object({
    action: z.literal("development.assessment.review"),
    data: review,
  }),
  z.object({ action: z.literal("development.assessment.publish"), data: byId }),
  z.object({
    action: z.literal("development.level.approve"),
    data: z.object({ assessment_id: id, reason: text }).strict(),
  }),
  z.object({
    action: z.literal("development.certificate.issue"),
    data: z.object({ assessment_id: id, title: short }).strict(),
  }),
  z.object({
    action: z.literal("development.certificate.revoke"),
    data: z.object({ id, reason: text }).strict(),
  }),
  z.object({
    action: z.literal("development.report.create"),
    data: z
      .object({
        session_id: id,
        child_id: id,
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        summary: text,
        evidence_ids: z
          .array(id)
          .min(1)
          .max(30)
          .refine((x) => new Set(x).size === x.length),
      })
      .strict(),
  }),
  z.object({ action: z.literal("development.report.submit"), data: byId }),
  z.object({ action: z.literal("development.report.review"), data: review }),
  z.object({ action: z.literal("development.report.publish"), data: byId }),
]);
export const developmentTables = [
  "development_targets",
  "development_target_reviews",
  "development_target_events",
  "development_emergency_policies",
  "development_coach_emergency_contacts",
  "development_safety_children",
  "development_criteria",
  "development_session_plans",
  "development_assessments",
  "development_assessment_notes",
  "development_reviews",
  "development_results",
  "development_level_history",
  "development_reports",
  "development_certificates",
  "development_certificate_revocations",
  "development_certificate_records",
  "development_level_reversals",
] as const;
export type DevelopmentCommand = z.infer<typeof developmentSchema>;
export interface DevelopmentResult {
  id: string;
  child_id?: string;
  criteria_id: string;
  metric_key: string;
  value: number;
  unit: string;
  direction: string;
  [key: string]: unknown;
}
/** Versions and units deliberately form separate series. No invented normalized percentages. */
export function personalBests<T extends DevelopmentResult>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = [
      row.child_id ?? "",
      row.criteria_id,
      row.metric_key,
      row.unit,
      row.direction,
    ].join("|");
    const previous = best.get(key);
    if (
      !previous ||
      (row.direction === "lower"
        ? row.value < previous.value
        : row.value > previous.value)
    )
      best.set(key, row);
  }
  return [...best.values()];
}

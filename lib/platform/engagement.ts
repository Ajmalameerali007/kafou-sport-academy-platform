import { z } from "zod";
const id = z.string().uuid(),
  short = z.string().trim().min(2).max(120),
  text = z.string().trim().min(5).max(2000),
  date = z.string().datetime({ offset: true });
const sport = z.enum(["swimming", "football", "karate", "badminton"]);
const source = z.enum(["challenge", "recognition", "referral"]);
const rule = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("attendance"),
      count: z.number().int().min(1).max(200),
    })
    .strict(),
  z
    .object({
      kind: z.literal("metric"),
      criteria_id: id,
      metric_key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
      target: z.number().finite().min(-1000000).max(1000000),
    })
    .strict(),
]);
const windowFields = {
  branch_id: id,
  title: short,
  description: text,
  starts_at: date,
  ends_at: date,
  reward_policy_id: id,
};
const review = z
  .object({ id, decision: z.enum(["approved", "rejected"]), reason: text })
  .strict();
export const engagementSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("engagement.report.edit"),
    data: z
      .object({ id, summary: z.string().trim().min(3).max(3000) })
      .strict(),
  }),
  z.object({
    action: z.literal("engagement.reward_rule.create"),
    data: z
      .object({
        branch_id: id,
        code: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/),
        title: short,
        description: text,
        source_kind: source,
        unit: z.enum(["badge", "star", "point"]),
        quantity: z.coerce.number().int().min(1).max(1000),
      })
      .strict(),
  }),
  z.object({
    action: z.literal("engagement.reward_rule.publish"),
    data: z.object({ id }).strict(),
  }),
  z.object({
    action: z.literal("engagement.challenge.create"),
    data: z
      .object({ ...windowFields, sport, level_id: id.optional(), rule })
      .strict()
      .refine(
        (x) => Date.parse(x.ends_at) > Date.parse(x.starts_at),
        "End must follow start.",
      ),
  }),
  z.object({
    action: z.literal("engagement.challenge.publish"),
    data: z.object({ id }).strict(),
  }),
  z.object({
    action: z.literal("engagement.challenge.join"),
    data: z.object({ challenge_id: id, child_id: id }).strict(),
  }),
  z.object({
    action: z.literal("engagement.completion.submit"),
    data: z.object({ entry_id: id }).strict(),
  }),
  z.object({ action: z.literal("engagement.completion.review"), data: review }),
  z.object({
    action: z.literal("engagement.reward.grant"),
    data: z
      .object({
        source_kind: source,
        source_id: id,
        reward_policy_id: id.optional(),
        reason: text,
      })
      .strict(),
  }),
  z.object({
    action: z.literal("engagement.reward.reverse"),
    data: z.object({ id, reason: text }).strict(),
  }),
  z.object({
    action: z.literal("engagement.referral_campaign.create"),
    data: z
      .object(windowFields)
      .strict()
      .refine((x) => Date.parse(x.ends_at) > Date.parse(x.starts_at)),
  }),
  z.object({
    action: z.literal("engagement.referral_campaign.publish"),
    data: z.object({ id }).strict(),
  }),
  z.object({
    action: z.literal("engagement.referral.code"),
    data: z.object({ campaign_id: id, family_id: id }).strict(),
  }),
  z.object({
    action: z.literal("engagement.referral.redeem"),
    data: z
      .object({
        family_id: id,
        code: z
          .string()
          .trim()
          .regex(/^KRF-[A-F0-9]{12}$/),
      })
      .strict(),
  }),
  z.object({ action: z.literal("engagement.referral.review"), data: review }),
  z.object({
    action: z.literal("engagement.report.generate"),
    data: z
      .object({
        session_id: id,
        child_id: id,
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      })
      .strict(),
  }),
]);
export const engagementTables = [
  "engagement_reward_rules",
  "engagement_challenges",
  "engagement_entries",
  "engagement_completions",
  "engagement_reviews",
  "engagement_reward_ledger",
  "engagement_referral_campaigns",
  "engagement_referral_codes",
  "engagement_referral_claims",
] as const;
export type ChallengeRule = z.infer<typeof rule>;
export function describeChallengeRule(r: ChallengeRule): string {
  return r.kind === "attendance"
    ? `Attend ${r.count} sessions (present or late).`
    : `Meet ${r.metric_key} target ${r.target} in the published criteria version.`;
}
export function rewardBalance(
  rows: { policy_id: string; unit: string; delta: number }[],
) {
  const totals = new Map<
    string,
    { policy_id: string; unit: string; balance: number }
  >();
  for (const row of rows) {
    const key = `${row.policy_id}:${row.unit}`;
    const current = totals.get(key) ?? {
      policy_id: row.policy_id,
      unit: row.unit,
      balance: 0,
    };
    current.balance += Number(row.delta);
    totals.set(key, current);
  }
  return [...totals.values()];
}
